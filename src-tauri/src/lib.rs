

/// Esquemas que pueden ejecutar código o inyectar contenido al navegar/clicar; son los vectores XSS clásicos en `href`/`src`.
pub const DANGEROUS_SCHEMES: &[&str] = &["javascript:", "data:", "vbscript:"];

/// URL inerte con la que se reemplaza una peligrosa: el link queda visible pero no navega a nada ejecutable.
pub const SAFE_REPLACEMENT: &str = "#";

pub const MAX_FILE_SIZE_BYTES: u64 = 10 * 1024 * 1024;
pub const ALLOWED_EXTENSIONS: &[&str] = &["md", "markdown"];
/// Etiquetas de presentación que se dejan pasar TAL CUAL desde el HTML crudo de un
/// `.md`, y solo si vienen SIN atributos (ver `specs/html_allowlist.md`).
/// Se excluyen `div`, `p`, `a`, `img` y `table` a propósito: las dos primeras casi
/// siempre traen atributos, y las otras son los vectores clásicos de inyección.
pub const ALLOWED_TAGS: &[&str] = &["br", "details", "summary", "kbd", "sub", "sup"];

#[derive(serde::Serialize, Debug, Clone, PartialEq, Eq)]
pub struct MarkdownFile {
    pub path: String,      // ruta canónica/absoluta realmente leída (tras canonicalize)
    pub content: String,   // contenido UTF-8 del archivo
    pub bytes: u64,        // tamaño en bytes del contenido leído
}

#[derive(serde::Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "kind")]   // el frontend discrimina por "kind"
pub enum ReadMdError {
    NotFound,                       // la ruta no existe
    NotAFile,                       // existe pero no es un archivo regular (dir, etc.)
    NotMarkdown { extension: String }, // extensión no permitida
    TooLarge { size: u64, max: u64 },  // supera MAX_FILE_SIZE_BYTES
    PermissionDenied,               // permisos del SO denegados
    InvalidUtf8,                    // el contenido no es UTF-8 válido
    Io { message: String },         // cualquier otro error de IO (mensaje del SO)
}

#[derive(serde::Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "kind")]
pub enum ExportError {
    PermissionDenied,
    Io { message: String },
}

pub mod export {
    use super::ExportError;
    use std::fs::File;
    use std::io::Write;
    use std::path::Path;

    pub fn write_html(path: &Path, html: &str) -> Result<(), ExportError> {
        let mut file = match File::create(path) {
            Ok(f) => f,
            Err(err) => {
                return Err(match err.kind() {
                    std::io::ErrorKind::PermissionDenied => ExportError::PermissionDenied,
                    _ => ExportError::Io { message: err.to_string() },
                });
            }
        };

        if let Err(err) = file.write_all(html.as_bytes()) {
            return Err(match err.kind() {
                std::io::ErrorKind::PermissionDenied => ExportError::PermissionDenied,
                _ => ExportError::Io { message: err.to_string() },
            });
        }

        if let Err(err) = file.flush() {
            return Err(match err.kind() {
                std::io::ErrorKind::PermissionDenied => ExportError::PermissionDenied,
                _ => ExportError::Io { message: err.to_string() },
            });
        }

        Ok(())
    }
}

pub mod reader {
    use super::{MAX_FILE_SIZE_BYTES, MarkdownFile, ReadMdError};
    use std::fs::File;
    use std::io::Read;
    use std::path::Path;

    pub fn read_markdown(path: &Path) -> Result<MarkdownFile, ReadMdError> {
        // 1. Normaliza/canonicaliza path con std::fs::canonicalize.
        let canonical_path = match std::fs::canonicalize(path) {
            Ok(p) => p,
            Err(err) => {
                return Err(match err.kind() {
                    std::io::ErrorKind::NotFound => ReadMdError::NotFound,
                    std::io::ErrorKind::PermissionDenied => ReadMdError::PermissionDenied,
                    _ => ReadMdError::Io { message: err.to_string() },
                });
            }
        };

        // 2. Valida la extensión sobre la ruta canónica (case-insensitive) contra ALLOWED_EXTENSIONS.
        let ext_str = match canonical_path.extension() {
            Some(ext) => ext.to_string_lossy().into_owned(),
            None => String::new(),
        };
        let ext_lower = ext_str.to_lowercase();
        if ext_lower != "md" && ext_lower != "markdown" {
            return Err(ReadMdError::NotMarkdown { extension: ext_str });
        }

        // 3. Abre el archivo una sola vez (File::open) y obtén el tamaño desde el handle ya abierto.
        let file = match File::open(&canonical_path) {
            Ok(f) => f,
            Err(err) => {
                // Windows falla al abrir un directorio ("acceso denegado"), mientras que
                // Unix lo abre y deja que el chequeo de is_file() de más abajo lo clasifique.
                // Sin esto, elegir una carpeta reportaría PermissionDenied en vez de
                // NotAFile, y el usuario leería un error que no describe lo que hizo.
                if canonical_path.is_dir() {
                    return Err(ReadMdError::NotAFile);
                }
                return Err(match err.kind() {
                    std::io::ErrorKind::NotFound => ReadMdError::NotFound,
                    std::io::ErrorKind::PermissionDenied => ReadMdError::PermissionDenied,
                    _ => ReadMdError::Io { message: err.to_string() },
                });
            }
        };

        let metadata = match file.metadata() {
            Ok(m) => m,
            Err(err) => {
                return Err(match err.kind() {
                    std::io::ErrorKind::NotFound => ReadMdError::NotFound,
                    std::io::ErrorKind::PermissionDenied => ReadMdError::PermissionDenied,
                    _ => ReadMdError::Io { message: err.to_string() },
                });
            }
        };

        // 4. Si metadata indica que NO es archivo regular (p.ej. directorio) -> NotAFile.
        if !metadata.is_file() {
            return Err(ReadMdError::NotAFile);
        }

        // 5. Si metadata.len() > MAX_FILE_SIZE_BYTES -> TooLarge { size, max }.
        let size = metadata.len();
        if size > MAX_FILE_SIZE_BYTES {
            return Err(ReadMdError::TooLarge { size, max: MAX_FILE_SIZE_BYTES });
        }

        // 6. Lee el contenido del handle.
        // Mitigar TOCTOU/race conditions limitando la lectura a MAX_FILE_SIZE_BYTES + 1.
        let mut buffer = Vec::with_capacity(size as usize);
        let mut limit_handle = file.take(MAX_FILE_SIZE_BYTES + 1);
        if let Err(err) = limit_handle.read_to_end(&mut buffer) {
            return Err(match err.kind() {
                std::io::ErrorKind::NotFound => ReadMdError::NotFound,
                std::io::ErrorKind::PermissionDenied => ReadMdError::PermissionDenied,
                _ => ReadMdError::Io { message: err.to_string() },
            });
        }

        if buffer.len() as u64 > MAX_FILE_SIZE_BYTES {
            return Err(ReadMdError::TooLarge {
                size: buffer.len() as u64,
                max: MAX_FILE_SIZE_BYTES,
            });
        }

        // Si los bytes no son UTF-8 válido -> InvalidUtf8.
        let content = match String::from_utf8(buffer) {
            Ok(s) => s,
            Err(_) => return Err(ReadMdError::InvalidUtf8),
        };

        let bytes = content.len() as u64;

        // 7. Devuelve MarkdownFile.
        Ok(MarkdownFile {
            path: canonical_path.to_string_lossy().into_owned(),
            content,
            bytes,
        })
    }

    /// Devuelve la forma normalizada de `raw` si es una etiqueta permitida SIN
    /// atributos; `None` en cualquier otro caso (incluye atributos, nombres fuera
    /// de la lista, y basura).
    fn etiqueta_permitida(raw: &str) -> Option<String> {
        let inner = raw.strip_prefix('<')?.strip_suffix('>')?;
        let (es_cierre, resto) = match inner.strip_prefix('/') {
            Some(r) => (true, r),
            None => (false, inner),
        };
        // Acepta `<br/>` y `<br />`, pero no `</br/>`.
        let (es_auto, nombre) = match resto.trim_end().strip_suffix('/') {
            Some(r) => (true, r.trim_end()),
            None => (false, resto.trim_end()),
        };
        if es_cierre && es_auto {
            return None;
        }
        // Cero atributos: si queda algo que no sea el nombre (un espacio, un `=`),
        // no pasa. Es una regla que se verifica de un vistazo.
        if nombre.is_empty() || !nombre.chars().all(|c| c.is_ascii_alphanumeric()) {
            return None;
        }
        let lower = nombre.to_ascii_lowercase();
        if !super::ALLOWED_TAGS.contains(&lower.as_str()) {
            return None;
        }
        Some(if es_cierre {
            format!("</{lower}>")
        } else if es_auto {
            format!("<{lower}/>")
        } else {
            format!("<{lower}>")
        })
    }

    /// Recorre un fragmento de HTML crudo: descarta comentarios, deja pasar las
    /// etiquetas permitidas sin atributos, y escapa TODO lo demás.
    fn sanear_html_crudo(fragmento: &str, en_comentario: &mut bool) -> String {
        let mut out = String::with_capacity(fragmento.len());
        let mut i = 0;
        while i < fragmento.len() {
            // Un comentario puede abrirse en un evento y cerrarse en otro.
            if *en_comentario {
                match fragmento[i..].find("-->") {
                    Some(rel) => {
                        i += rel + 3;
                        *en_comentario = false;
                    }
                    None => return out,
                }
                continue;
            }
            let resto = &fragmento[i..];
            if let Some(tras_apertura) = resto.strip_prefix("<!--") {
                match tras_apertura.find("-->") {
                    Some(rel) => i += 4 + rel + 3,
                    None => {
                        *en_comentario = true;
                        return out;
                    }
                }
                continue;
            }
            if resto.starts_with('<') {
                if let Some(rel) = resto.find('>') {
                    if let Some(tag) = etiqueta_permitida(&resto[..=rel]) {
                        out.push_str(&tag);
                        i += rel + 1;
                        continue;
                    }
                }
                out.push_str("&lt;");
                i += 1;
                continue;
            }
            let ch = resto.chars().next().expect("resto no vacío");
            match ch {
                '>' => out.push_str("&gt;"),
                '&' => out.push_str("&amp;"),
                '"' => out.push_str("&quot;"),
                _ => out.push(ch),
            }
            i += ch.len_utf8();
        }
        out
    }

    pub fn to_safe_html(md: &str) -> String {
        let options = pulldown_cmark::Options::ENABLE_TABLES
            | pulldown_cmark::Options::ENABLE_STRIKETHROUGH
            | pulldown_cmark::Options::ENABLE_TASKLISTS;
        let parser = pulldown_cmark::Parser::new_ext(md, options);
        // Un comentario HTML puede abarcar varios eventos: el estado cruza el map.
        let mut en_comentario = false;
        let safe_parser = parser.map(move |event| match event {
            pulldown_cmark::Event::Html(html) => {
                pulldown_cmark::Event::Html(sanear_html_crudo(&html, &mut en_comentario).into())
            }
            pulldown_cmark::Event::InlineHtml(html) => {
                pulldown_cmark::Event::InlineHtml(sanear_html_crudo(&html, &mut en_comentario).into())
            }
            pulldown_cmark::Event::Start(pulldown_cmark::Tag::Link { link_type, dest_url, title, id }) => {
                let normalized = dest_url.chars()
                    .filter(|&c| !c.is_whitespace() && !c.is_ascii_control())
                    .collect::<String>()
                    .to_lowercase();
                let is_dangerous = super::DANGEROUS_SCHEMES.iter().any(|scheme| normalized.starts_with(scheme));
                let dest_url = if is_dangerous {
                    pulldown_cmark::CowStr::from(super::SAFE_REPLACEMENT)
                } else {
                    dest_url
                };
                pulldown_cmark::Event::Start(pulldown_cmark::Tag::Link {
                    link_type,
                    dest_url,
                    title,
                    id,
                })
            }
            pulldown_cmark::Event::Start(pulldown_cmark::Tag::Image { link_type, dest_url, title, id }) => {
                let normalized = dest_url.chars()
                    .filter(|&c| !c.is_whitespace() && !c.is_ascii_control())
                    .collect::<String>()
                    .to_lowercase();
                let is_dangerous = super::DANGEROUS_SCHEMES.iter().any(|scheme| normalized.starts_with(scheme));
                let dest_url = if is_dangerous {
                    pulldown_cmark::CowStr::from(super::SAFE_REPLACEMENT)
                } else {
                    dest_url
                };
                pulldown_cmark::Event::Start(pulldown_cmark::Tag::Image {
                    link_type,
                    dest_url,
                    title,
                    id,
                })
            }
            other => other,
        });
        let mut html_output = String::new();
        pulldown_cmark::html::push_html(&mut html_output, safe_parser);
        html_output
    }
}

pub mod watcher {
    use notify::EventKind;

    /// Decide si corresponde emitir un refresco, aplicando anti-rebote.
    /// Devuelve true si nunca se emitió, o si pasó >= debounce_ms desde la última.
    /// `now_ms`/`last_emit_ms`: milisegundos de un reloj monótono (inyectado por el llamador).
    pub fn should_emit(last_emit_ms: Option<u64>, now_ms: u64, debounce_ms: u64) -> bool {
        match last_emit_ms {
            None => true,
            Some(last) => now_ms.saturating_sub(last) >= debounce_ms,
        }
    }

    /// Clasifica un evento del watcher: true si el cambio amerita re-leer el archivo.
    /// Relevante: modificaciones de contenido y creación. NO relevante: accesos (lectura),
    /// y por ahora tampoco la eliminación (el archivo ya no está; se maneja aparte).
    pub fn is_relevant_change(kind: &EventKind) -> bool {
        match kind {
            EventKind::Modify(_) => true,
            EventKind::Create(_) => true,
            EventKind::Access(_) => false,
            EventKind::Remove(_) => false,
            _ => false,
        }
    }
}

/// Rutas de apertura recibidas por línea de comandos.
///
/// El sistema operativo entrega estas rutas cuando el usuario elige "Abrir con
/// Lekto" o ejecuta `lekto documento.md`. Son entrada NO confiable: aquí solo se
/// separan los flags de las rutas y se resuelven las relativas. La validación
/// real (existe, es un archivo, extensión permitida, tamaño) la sigue haciendo
/// `reader::read_markdown`, que es el único camino al disco (invariante I1).
pub mod cli {
    use std::path::{Path, PathBuf};

    /// Extrae de `args` las rutas candidatas a abrir.
    ///
    /// - Descarta `args[0]`, que es la ruta del propio ejecutable.
    /// - Ignora todo argumento que empiece por `-`: es un flag, no una ruta (I3).
    /// - Resuelve las rutas relativas contra `cwd`. Importa de verdad: cuando la
    ///   app ya está abierta, el segundo lanzamiento ocurre en OTRO directorio de
    ///   trabajo, y resolver contra el de la instancia primaria abriría el archivo
    ///   equivocado o ninguno.
    /// - NO valida existencia ni extensión a propósito (I1): un archivo puede
    ///   desaparecer entre este momento y la lectura (TOCTOU), así que comprobarlo
    ///   aquí daría una garantía falsa.
    pub fn rutas_desde_argv(args: &[String], cwd: &Path) -> Vec<PathBuf> {
        args.iter()
            .skip(1)
            .filter(|a| !a.starts_with('-'))
            .filter(|a| !a.is_empty())
            .map(|a| {
                let p = Path::new(a);
                if p.is_absolute() { p.to_path_buf() } else { cwd.join(p) }
            })
            .collect()
    }
}

#[tauri::command]
async fn read_markdown_file(path: String) -> Result<MarkdownFile, ReadMdError> {
    tokio::task::spawn_blocking(move || {
        let p = std::path::Path::new(&path);
        reader::read_markdown(p)
    })
    .await
    .map_err(|e| ReadMdError::Io { message: e.to_string() })?
}

#[tauri::command]
fn render_markdown(content: String) -> String {
    reader::to_safe_html(&content)
}

#[tauri::command]
fn export_html(path: String, html: String) -> Result<(), ExportError> {
    let p = std::path::Path::new(&path);
    export::write_html(p, &html)
}

/// Anti-rebote para coalescer las escrituras múltiples de un mismo guardado en un solo refresco.
const WATCH_DEBOUNCE_MS: u64 = 200;

/// Conserva el watcher activo. Reemplazarlo (al abrir otro archivo) descarta el anterior,
/// de modo que solo se sigue el documento actual.
#[derive(Default)]
struct WatcherState(std::sync::Mutex<Option<notify::RecommendedWatcher>>);

/// Empieza a vigilar `path` y emite el evento `file-changed` (con la ruta canónica) cuando
/// el archivo cambia en disco. Vigila el DIRECTORIO padre y filtra por la ruta para sobrevivir
/// al guardado atómico (temp + rename) que usan muchos editores y que rompería un watch directo.
#[tauri::command]
fn watch_file(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, WatcherState>,
) -> Result<(), String> {
    use notify::Watcher;

    let target = std::fs::canonicalize(&path).map_err(|e| e.to_string())?;
    let parent = target
        .parent()
        .ok_or_else(|| "El archivo no tiene directorio padre".to_string())?
        .to_path_buf();

    // Base monótona + última emisión, compartidas con el callback para el anti-rebote.
    let start = std::time::Instant::now();
    let last_emit = std::sync::Arc::new(std::sync::Mutex::new(None::<u64>));
    let app_handle = app.clone();
    let target_for_cb = target.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        if !watcher::is_relevant_change(&event.kind) {
            return;
        }
        // Solo nos interesan los eventos que tocan el archivo abierto.
        if !event.paths.iter().any(|p| p == &target_for_cb) {
            return;
        }
        let now_ms = start.elapsed().as_millis() as u64;
        let Ok(mut last) = last_emit.lock() else { return };
        if watcher::should_emit(*last, now_ms, WATCH_DEBOUNCE_MS) {
            *last = Some(now_ms);
            use tauri::Emitter;
            let _ = app_handle.emit("file-changed", target_for_cb.to_string_lossy().to_string());
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&parent, notify::RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    // Reemplaza (y descarta) el watcher anterior.
    *state.0.lock().map_err(|e| e.to_string())? = Some(watcher);
    Ok(())
}

/// Rutas que llegaron por `argv` en el arranque y que el frontend todavía no ha
/// recogido. Existe porque el webview no está listo cuando arranca el proceso:
/// emitir un evento ahí se perdería. El frontend las PIDE cuando ya puede
/// atenderlas, y eso elimina la carrera en vez de intentar ganarla.
#[derive(Default)]
struct PendingFiles(std::sync::Mutex<Vec<String>>);

/// Entrega al frontend las rutas pendientes y las vacía: se abren una sola vez.
#[tauri::command]
fn take_pending_files(state: tauri::State<'_, PendingFiles>) -> Vec<String> {
    match state.0.lock() {
        Ok(mut v) => std::mem::take(&mut *v),
        // Un mutex envenenado no justifica tumbar la app: sin archivos pendientes
        // Lekto abre normalmente (I4: nada de argv provoca un panic).
        Err(_) => Vec::new(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // El plugin de instancia única va PRIMERO: debe interceptar el segundo
    // lanzamiento antes de que nadie más levante una ventana.
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        use tauri::{Emitter, Manager};
        let rutas: Vec<String> = cli::rutas_desde_argv(&argv, std::path::Path::new(&cwd))
            .into_iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect();
        // Aquí el webview YA está vivo, así que el evento sí tiene quien lo escuche.
        if !rutas.is_empty() {
            let _ = app.emit("files-opened", rutas);
        }
        // Traer la ventana al frente: el usuario pidió abrir un archivo y espera verlo.
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }));

    builder
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::default())
        .manage(PendingFiles::default())
        .setup(|app| {
            use tauri::Manager;
            // Arranque en frío: `lekto doc.md`. Se guardan para que el frontend
            // las recoja cuando esté listo.
            let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let args: Vec<String> = std::env::args().collect();
            let rutas: Vec<String> = cli::rutas_desde_argv(&args, &cwd)
                .into_iter()
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            if !rutas.is_empty() {
                if let Ok(mut pend) = app.state::<PendingFiles>().0.lock() {
                    *pend = rutas;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_markdown_file,
            render_markdown,
            export_html,
            watch_file,
            take_pending_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests_cli {
    use super::cli::rutas_desde_argv;
    use std::path::{Path, PathBuf};

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn sin_argumentos_no_devuelve_rutas() {
        // Invariante I2: lanzar sin argumentos deja el comportamiento actual intacto.
        assert_eq!(rutas_desde_argv(&args(&["lekto"]), Path::new("/tmp")), Vec::<PathBuf>::new());
        assert_eq!(rutas_desde_argv(&[], Path::new("/tmp")), Vec::<PathBuf>::new());
    }

    #[test]
    fn una_ruta_absoluta_se_devuelve_tal_cual() {
        assert_eq!(
            rutas_desde_argv(&args(&["lekto", "/home/u/doc.md"]), Path::new("/tmp")),
            vec![PathBuf::from("/home/u/doc.md")]
        );
    }

    #[test]
    fn una_ruta_relativa_se_resuelve_contra_el_cwd_recibido() {
        // No contra el cwd del proceso: cuando la app ya está abierta, el segundo
        // lanzamiento viene de otro directorio.
        assert_eq!(
            rutas_desde_argv(&args(&["lekto", "doc.md"]), Path::new("/home/u/notas")),
            vec![PathBuf::from("/home/u/notas/doc.md")]
        );
    }

    #[test]
    fn los_flags_se_ignoran() {
        // Invariante I3.
        assert_eq!(
            rutas_desde_argv(&args(&["lekto", "--verbose", "-x", "/a/doc.md"]), Path::new("/tmp")),
            vec![PathBuf::from("/a/doc.md")]
        );
    }

    #[test]
    fn varios_archivos_conservan_su_orden() {
        // %F puede entregar N archivos; la primera se lleva el foco, así que el orden importa.
        assert_eq!(
            rutas_desde_argv(&args(&["lekto", "/a/1.md", "/a/2.md", "/a/3.md"]), Path::new("/tmp")),
            vec![PathBuf::from("/a/1.md"), PathBuf::from("/a/2.md"), PathBuf::from("/a/3.md")]
        );
    }

    #[test]
    fn acepta_espacios_y_caracteres_no_ascii() {
        assert_eq!(
            rutas_desde_argv(&args(&["lekto", "/a/mis notas/año 2026 — borrador.md"]), Path::new("/tmp")),
            vec![PathBuf::from("/a/mis notas/año 2026 — borrador.md")]
        );
    }

    #[test]
    fn el_argumento_vacio_se_descarta() {
        // Un `` en argv resolvería a `cwd` (un directorio) y produciría un error
        // confuso al usuario en vez de silencio.
        assert_eq!(
            rutas_desde_argv(&args(&["lekto", ""]), Path::new("/tmp")),
            Vec::<PathBuf>::new()
        );
    }

    #[test]
    fn no_valida_existencia_ni_extension() {
        // I1: esta función NO es la guarda de seguridad. Deja pasar lo que sea y
        // `reader::read_markdown` decide. Comprobarlo aquí daría una garantía falsa
        // (el archivo puede desaparecer entre esta línea y la lectura: TOCTOU).
        assert_eq!(
            rutas_desde_argv(&args(&["lekto", "/no/existe.exe", "/tmp"]), Path::new("/tmp")),
            vec![PathBuf::from("/no/existe.exe"), PathBuf::from("/tmp")]
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::Path;

    #[test]
    fn lee_md_valido_ok() {
        let mut temp_file = tempfile::Builder::new()
            .suffix(".md")
            .tempfile()
            .expect("Error al crear archivo temporal");
        let content_str = "# Hello World\nEste es un archivo Markdown válido.";
        temp_file.write_all(content_str.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let path = temp_file.path();
        let res = reader::read_markdown(path);
        assert!(res.is_ok());
        let file_data = res.unwrap();
        assert_eq!(file_data.content, content_str);
        assert_eq!(file_data.bytes, content_str.len() as u64);
        assert_eq!(file_data.path, std::fs::canonicalize(path).unwrap().to_string_lossy().into_owned());
    }

    #[test]
    fn archivo_inexistente_da_notfound() {
        let path = Path::new("este_archivo_no_deberia_existir_nunca_12345.md");
        let res = reader::read_markdown(path);
        assert_eq!(res, Err(ReadMdError::NotFound));
    }

    #[test]
    fn directorio_da_notafile() {
        let temp_dir = tempfile::Builder::new()
            .suffix(".md")
            .tempdir()
            .expect("Error al crear directorio temporal");
        let res = reader::read_markdown(temp_dir.path());
        assert_eq!(res, Err(ReadMdError::NotAFile));
    }

    #[test]
    fn extension_invalida_da_notmarkdown() {
        let mut temp_file = tempfile::Builder::new()
            .suffix(".txt")
            .tempfile()
            .expect("Error al crear archivo temporal");
        temp_file.write_all(b"Contenido").unwrap();
        temp_file.flush().unwrap();

        let res = reader::read_markdown(temp_file.path());
        assert!(matches!(res, Err(ReadMdError::NotMarkdown { .. })));
        if let Err(ReadMdError::NotMarkdown { extension }) = res {
            assert_eq!(extension, "txt");
        }
    }

    #[test]
    fn extension_mayusculas_ok() {
        let mut temp_file = tempfile::Builder::new()
            .suffix(".MD")
            .tempfile()
            .expect("Error al crear archivo temporal");
        let content_str = "Markdown en mayúsculas.";
        temp_file.write_all(content_str.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let res = reader::read_markdown(temp_file.path());
        assert!(res.is_ok());
        let file_data = res.unwrap();
        assert_eq!(file_data.content, content_str);
    }

    #[test]
    fn excede_tamano_da_toolarge() {
        let mut temp_file = tempfile::Builder::new()
            .suffix(".md")
            .tempfile()
            .expect("Error al crear archivo temporal");
        // Escribimos exactamente MAX_FILE_SIZE_BYTES + 1
        let excess_data = vec![b'a'; (MAX_FILE_SIZE_BYTES + 1) as usize];
        temp_file.write_all(&excess_data).unwrap();
        temp_file.flush().unwrap();

        let res = reader::read_markdown(temp_file.path());
        assert_eq!(
            res,
            Err(ReadMdError::TooLarge {
                size: MAX_FILE_SIZE_BYTES + 1,
                max: MAX_FILE_SIZE_BYTES
            })
        );
    }

    #[test]
    fn tamano_exacto_limite_ok() {
        let mut temp_file = tempfile::Builder::new()
            .suffix(".md")
            .tempfile()
            .expect("Error al crear archivo temporal");
        // Escribimos exactamente MAX_FILE_SIZE_BYTES
        let limit_data = vec![b'a'; MAX_FILE_SIZE_BYTES as usize];
        temp_file.write_all(&limit_data).unwrap();
        temp_file.flush().unwrap();

        let res = reader::read_markdown(temp_file.path());
        assert!(res.is_ok());
        let file_data = res.unwrap();
        assert_eq!(file_data.bytes, MAX_FILE_SIZE_BYTES);
    }

    #[test]
    fn bytes_no_utf8_da_invalidutf8() {
        let mut temp_file = tempfile::Builder::new()
            .suffix(".md")
            .tempfile()
            .expect("Error al crear archivo temporal");
        // Secuencia no válida de bytes en UTF-8 (p.ej. 0xFF)
        temp_file.write_all(&[0xff, 0xff, 0xff]).unwrap();
        temp_file.flush().unwrap();

        let res = reader::read_markdown(temp_file.path());
        assert_eq!(res, Err(ReadMdError::InvalidUtf8));
    }

    #[test]
    fn archivo_vacio_ok() {
        let temp_file = tempfile::Builder::new()
            .suffix(".md")
            .tempfile()
            .expect("Error al crear archivo temporal");

        let res = reader::read_markdown(temp_file.path());
        assert!(res.is_ok());
        let file_data = res.unwrap();
        assert_eq!(file_data.content, "");
        assert_eq!(file_data.bytes, 0);
    }

    #[test]
    fn test_to_safe_html_heading() {
        let html = reader::to_safe_html("# Título");
        assert!(html.contains("<h1>Título</h1>"));
    }

    #[test]
    fn test_to_safe_html_bold() {
        let html = reader::to_safe_html("**negrita**");
        assert!(html.contains("<strong>negrita</strong>"));
    }

    #[test]
    fn test_to_safe_html_code_inline() {
        let html = reader::to_safe_html("`code`");
        assert!(html.contains("<code>code</code>"));
    }

    #[test]
    fn test_to_safe_html_code_block() {
        let html = reader::to_safe_html("```rust\nlet x = 42;\n```");
        assert!(html.contains("<pre><code"));
    }

    #[test]
    fn test_to_safe_html_list() {
        let html = reader::to_safe_html("- a\n- b");
        assert!(html.contains("<ul>"));
        assert!(html.contains("<li>a</li>"));
        assert!(html.contains("<li>b</li>"));
    }

    #[test]
    fn test_to_safe_html_link() {
        let html = reader::to_safe_html("[x](https://e.com)");
        assert!(html.contains("<a href=\"https://e.com\""));
    }

    #[test]
    fn test_to_safe_html_url_hardening_javascript() {
        let html = reader::to_safe_html("[x](javascript:alert(1))");
        assert!(html.contains("href=\"#\""));
        assert!(!html.contains("javascript:"));
    }

    #[test]
    fn test_to_safe_html_url_hardening_case_insensitive() {
        let html = reader::to_safe_html("[x](JavaScript:alert(1))");
        assert!(html.contains("href=\"#\""));
        assert!(!html.contains("JavaScript:"));
        assert!(!html.contains("javascript:"));
    }

    #[test]
    fn test_to_safe_html_url_hardening_leading_spaces() {
        let html = reader::to_safe_html("[x](  javascript:alert(1))");
        assert!(html.contains("href=\"#\""));
        assert!(!html.contains("javascript:"));
    }

    #[test]
    fn test_to_safe_html_url_hardening_control_chars() {
        let html_entity = reader::to_safe_html("[x](java&#9;script:alert(1))");
        assert!(html_entity.contains("href=\"#\""));
        assert!(!html_entity.contains("java"));
        assert!(!html_entity.contains("script:"));

        let html_tab = reader::to_safe_html("[x](<java\tscript:alert(1)>)");
        assert!(html_tab.contains("href=\"#\""));

        let html_ctrl = reader::to_safe_html("[x](<java\x01script:alert(1)>)");
        assert!(html_ctrl.contains("href=\"#\""));
    }

    #[test]
    fn test_to_safe_html_url_hardening_data() {
        let html = reader::to_safe_html("[x](data:text/html,<script>)");
        assert!(html.contains("href=\"#\""));
        assert!(!html.contains("data:"));
    }

    #[test]
    fn test_to_safe_html_url_hardening_safe_urls() {
        let rel = reader::to_safe_html("[x](/ruta/rel)");
        assert!(rel.contains("href=\"/ruta/rel\""));

        let anchor = reader::to_safe_html("[x](#ancla)");
        assert!(anchor.contains("href=\"#ancla\""));
    }

    #[test]
    fn test_to_safe_html_url_hardening_image() {
        let html = reader::to_safe_html("![i](javascript:alert(1))");
        assert!(html.contains("src=\"#\""));
        assert!(!html.contains("javascript:"));
    }

    #[test]
    fn test_to_safe_html_script_neutralized() {
        let html = reader::to_safe_html("<script>alert(1)</script>");
        assert!(!html.contains("<script>"));
        assert!(!html.contains("</script>"));
        assert!(html.contains("&lt;script&gt;"));
        assert!(html.contains("&lt;/script&gt;"));
    }

    #[test]
    fn test_to_safe_html_img_onerror_neutralized() {
        let html = reader::to_safe_html("<img src=\"x\" onerror=\"alert(1)\">");
        assert!(!html.contains("<img"));
        assert!(html.contains("&lt;img"));
    }

    #[test]
    fn test_to_safe_html_empty() {
        let html = reader::to_safe_html("");
        assert!(html.is_empty() || html.trim().is_empty());
    }

    #[test]
    fn test_to_safe_html_table() {
        let markdown = "| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |";
        let html = reader::to_safe_html(markdown);
        assert!(html.contains("<table>"));
        assert!(html.contains("<td>Cell 1</td>"));
    }

    #[test]
    fn test_to_safe_html_strikethrough() {
        let markdown = "~~strikethrough~~";
        let html = reader::to_safe_html(markdown);
        assert!(html.contains("<del>strikethrough</del>"));
    }

    #[test]
    fn escribir_ruta_valida_ok() {
        let temp_dir = tempfile::Builder::new()
            .prefix("export_test")
            .tempdir()
            .expect("Error al crear dir temporal");
        let file_path = temp_dir.path().join("test.html");
        let html_content = "<h1>Test</h1>";
        
        let res = export::write_html(&file_path, html_content);
        assert!(res.is_ok());
        
        // Releer y comparar
        let read_content = std::fs::read_to_string(&file_path).expect("Error al releer archivo");
        assert_eq!(read_content, html_content);
    }

    #[test]
    fn escribir_contenido_vacio_ok() {
        let temp_dir = tempfile::Builder::new()
            .prefix("export_test_empty")
            .tempdir()
            .expect("Error al crear dir temporal");
        let file_path = temp_dir.path().join("empty.html");
        
        let res = export::write_html(&file_path, "");
        assert!(res.is_ok());
        
        // Releer y comparar
        let read_content = std::fs::read_to_string(&file_path).expect("Error al releer archivo");
        assert_eq!(read_content, "");
    }

    // Solo Unix: en Windows el atributo readonly de un DIRECTORIO no impide crear
    // archivos dentro (el flag existe, pero el sistema lo ignora para ese fin), así que
    // este escenario concreto no se puede montar allá. La aserción es la misma que
    // siempre; lo que cambia es dónde puede provocarse la condición.
    // La cobertura de Windows la da `escribir_sobre_archivo_solo_lectura_...` de abajo,
    // que usa un ARCHIVO de solo lectura en vez de un directorio.
    #[cfg(unix)]
    #[test]
    fn escribir_dir_sin_permiso_da_permission_denied() {
        let temp_dir = tempfile::Builder::new()
            .prefix("export_test_noperm")
            .tempdir()
            .expect("Error al crear dir temporal");
        
        let dir_path = temp_dir.path();
        
        // Hacer el directorio de solo lectura
        let mut perms = std::fs::metadata(dir_path).unwrap().permissions();
        perms.set_readonly(true);
        std::fs::set_permissions(dir_path, perms).unwrap();
        
        let file_path = dir_path.join("test.html");
        let res = export::write_html(&file_path, "test");
        
        // Restaurar permisos usando un drop guard o de forma explícita
        struct RestorePerms<'a>(&'a Path);
        impl<'a> Drop for RestorePerms<'a> {
            fn drop(&mut self) {
                if let Ok(meta) = std::fs::metadata(self.0) {
                    let mut perms = meta.permissions();
                    #[allow(clippy::permissions_set_readonly_false)]
                    perms.set_readonly(false);
                    let _ = std::fs::set_permissions(self.0, perms);
                }
            }
        }
        let _guard = RestorePerms(dir_path);
        
        // Esperamos PermissionDenied o Io
        assert!(matches!(res, Err(ExportError::PermissionDenied) | Err(ExportError::Io { .. })));
    }

    /// En Windows el camino PermissionDenied de
    /// `write_html` no tenia cobertura automatica.
    ///
    /// POR QUE ESTE ESCENARIO Y NO EL DEL DIRECTORIO: `File::create` sobre un archivo que
    /// YA EXISTE y tiene el atributo de solo lectura falla en las dos plataformas
    /// (ERROR_ACCESS_DENIED en Windows, EACCES en Unix), asi que la condicion se puede
    /// montar en ambas. El test del directorio de arriba no sirve en Windows.
    ///
    /// LIMITE DECLARADO: en Unix, root ignora los bits de permiso y la escritura tendria
    /// exito. Eso no es un fallo de `write_html`: es un entorno donde la condicion no se
    /// puede provocar. Se detecta leyendo el uid del propietario de un archivo recien
    /// creado -- una senal INDEPENDIENTE del camino de escritura que se esta probando,
    /// no una sonda que comparta su modo de fallo -- y ahi el test se salta en vez de
    /// dar un rojo falso. CI y desarrollo normal corren sin privilegios.
    #[test]
    fn escribir_sobre_archivo_solo_lectura_da_permission_denied() {
        let temp_dir = tempfile::Builder::new()
            .prefix("export_test_ro_file")
            .tempdir()
            .expect("Error al crear dir temporal");
        let file_path = temp_dir.path().join("existente.html");

        // El archivo debe EXISTIR antes de marcarlo de solo lectura.
        std::fs::write(&file_path, "contenido previo").expect("Error al crear el archivo");

        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            let uid = std::fs::metadata(&file_path).unwrap().uid();
            if uid == 0 {
                eprintln!(
                    "SALTADO: corriendo como root; los bits de permiso no aplican y la \
                     condicion no se puede provocar en este entorno."
                );
                return;
            }
        }

        let mut perms = std::fs::metadata(&file_path).unwrap().permissions();
        perms.set_readonly(true);
        std::fs::set_permissions(&file_path, perms).expect("Error al marcar solo lectura");

        let res = export::write_html(&file_path, "<h1>nuevo</h1>");

        // Restaurar permisos SIEMPRE, o tempfile no puede limpiar el directorio.
        struct RestaurarPerms<'a>(&'a Path);
        impl Drop for RestaurarPerms<'_> {
            fn drop(&mut self) {
                if let Ok(meta) = std::fs::metadata(self.0) {
                    let mut perms = meta.permissions();
                    #[allow(clippy::permissions_set_readonly_false)]
                    perms.set_readonly(false);
                    let _ = std::fs::set_permissions(self.0, perms);
                }
            }
        }
        let _guard = RestaurarPerms(&file_path);

        assert_eq!(
            res,
            Err(ExportError::PermissionDenied),
            "un archivo de solo lectura debe mapearse a PermissionDenied, no a Io"
        );

        // El contenido previo NO fue tocado: el fallo no destruyo datos del usuario.
        let previo = std::fs::read_to_string(&file_path).expect("Error al releer");
        assert_eq!(previo, "contenido previo");
    }

    #[test]
    fn test_should_emit_first_time() {
        assert!(watcher::should_emit(None, 1000, 300));
    }

    #[test]
    fn test_should_emit_inside_window() {
        assert!(!watcher::should_emit(Some(1000), 1100, 300));
    }

    #[test]
    fn test_should_emit_at_limit() {
        assert!(watcher::should_emit(Some(1000), 1300, 300));
    }

    #[test]
    fn test_should_emit_past_limit() {
        assert!(watcher::should_emit(Some(1000), 5000, 300));
    }

    #[test]
    fn test_should_emit_underflow_no_panic() {
        assert!(!watcher::should_emit(Some(1000), 900, 300));
    }

    #[test]
    fn test_is_relevant_change_modify() {
        use notify::event::{EventKind, ModifyKind};
        let kind = EventKind::Modify(ModifyKind::Any);
        assert!(watcher::is_relevant_change(&kind));
    }

    #[test]
    fn test_is_relevant_change_create() {
        use notify::event::{EventKind, CreateKind};
        let kind = EventKind::Create(CreateKind::Any);
        assert!(watcher::is_relevant_change(&kind));
    }

    #[test]
    fn test_is_relevant_change_access() {
        use notify::event::{EventKind, AccessKind};
        let kind = EventKind::Access(AccessKind::Any);
        assert!(!watcher::is_relevant_change(&kind));
    }

    #[test]
    fn test_is_relevant_change_remove() {
        use notify::event::{EventKind, RemoveKind};
        let kind = EventKind::Remove(RemoveKind::Any);
        assert!(!watcher::is_relevant_change(&kind));
    }

    #[test]
    fn test_is_relevant_change_other() {
        use notify::event::EventKind;
        assert!(!watcher::is_relevant_change(&EventKind::Any));
        assert!(!watcher::is_relevant_change(&EventKind::Other));
    }
}

