# SPEC — Comando Tauri `read_markdown_file(path)`

> SDD (Pilar 1). Esta spec se fija ANTES de codear y NO se redefine para que el
> código pase (Regla de Oro). Si algo resulta imposible o ambiguo, se detiene y
> se escala, en vez de improvisar una salida.

Perfil: tauri-app · Frontera de confianza Rust ↔ Frontend = **LÍNEA ROJA**.

---

## 1. Propósito (una frase)
Leer de disco un archivo Markdown que el usuario pidió abrir y devolver su
contenido al frontend, validando en Rust que la ruta es segura y legible, porque
el frontend NO es fuente de verdad confiable.

## 2. Firma
```rust
#[tauri::command]
async fn read_markdown_file(path: String) -> Result<MarkdownFile, ReadMdError>;
```
- **Entrada:** `path: String` — ruta tal como llega del frontend (NO confiable).
- **Salida OK:** `MarkdownFile`.
- **Salida ERR:** `ReadMdError` (enum tipado, serializable a JSON). NUNCA `panic!`,
  NUNCA `unwrap()`/`expect()` sobre IO o entrada del usuario (Pilar 2: errores se
  propagan como `Result` tipado, jamás panic — invariante del perfil).

### Tipos de retorno
```rust
#[derive(serde::Serialize)]
struct MarkdownFile {
    path: String,      // ruta canónica/absoluta realmente leída (tras canonicalize)
    content: String,   // contenido UTF-8 del archivo
    bytes: u64,        // tamaño en bytes del contenido leído
}

#[derive(serde::Serialize)]
#[serde(tag = "kind")]   // el frontend discrimina por "kind"
enum ReadMdError {
    NotFound,                       // la ruta no existe
    NotAFile,                       // existe pero no es un archivo regular (dir, etc.)
    NotMarkdown { extension: String }, // extensión no permitida
    TooLarge { size: u64, max: u64 },  // supera MAX_FILE_SIZE_BYTES
    PermissionDenied,               // permisos del SO denegados
    InvalidUtf8,                    // el contenido no es UTF-8 válido
    Io { message: String },         // cualquier otro error de IO (mensaje del SO)
}
```

## 3. Constantes (Pilar 1 — cada una con su valor y justificación)
| Constante | Valor | Justificación (una frase) |
|---|---|---|
| `MAX_FILE_SIZE_BYTES` | `10 * 1024 * 1024` (10 MiB) | Un `.md` típico pesa KB; 10 MiB cubre documentos enormes legítimos mientras acota RAM (meta de cierre < 80 MB) y tiempo de apertura (< 200 ms); por encima se rechaza en vez de arriesgar las metas. |
| `ALLOWED_EXTENSIONS` | `["md", "markdown"]` | Las dos extensiones estándar de Markdown; comparación **case-insensitive** (`.MD`, `.Markdown` válidas). |

## 4. Comportamiento (prosa completa)
1. Normaliza/canonicaliza `path` con `std::fs::canonicalize` (resuelve symlinks y
   `..`). Si falla porque no existe → `NotFound`; si falla por permisos →
   `PermissionDenied`; otro error → `Io { message }`.
2. Valida la **extensión** sobre la ruta canónica (case-insensitive) contra
   `ALLOWED_EXTENSIONS`. Si no coincide → `NotMarkdown { extension }` (sin abrir
   el archivo). Sin extensión → `NotMarkdown { extension: "" }`.
3. **Abre el archivo una sola vez** (`File::open`) y obtén el tamaño desde el
   *handle ya abierto* (`file.metadata()`), NO con un `stat` previo sobre la ruta
   (mitiga TOCTOU — ver §6). Si `open` falla: `NotFound` / `PermissionDenied` /
   `Io` según el `ErrorKind`.
4. Si `metadata` indica que NO es archivo regular (p.ej. directorio) → `NotAFile`.
5. Si `metadata.len() > MAX_FILE_SIZE_BYTES` → `TooLarge { size, max }` (sin leer
   el contenido — no se carga en RAM algo que se va a rechazar).
6. Lee el contenido del handle. Si el SO falla a mitad de lectura → `Io`. Si los
   bytes no son UTF-8 válido → `InvalidUtf8` (NO se hace lectura lossy: alterar
   silenciosamente el contenido violaría la integridad del dato — Regla de Oro).
7. Devuelve `MarkdownFile { path: <canónica>, content, bytes }`.

## 5. Invariantes (Pilar 2 — siempre verdaderos)
- I1. La función **nunca panica** ante ninguna entrada del frontend.
- I2. Nunca se cargan en memoria más de `MAX_FILE_SIZE_BYTES` de contenido.
- I3. `bytes == content.as_bytes().len()` en el caso OK.
- I4. La validación de ruta/extensión/tamaño ocurre **en Rust**, no se delega al
      frontend (LÍNEA ROJA del perfil).
- I5. El comando es `async` y no bloquea el hilo de la UI; la IO bloqueante corre
      fuera del hilo principal (`tokio::task::spawn_blocking` o equivalente).

## 6. Casos borde (Pilar 4 — anticipados, cada uno con resultado esperado)
| Caso | Resultado esperado |
|---|---|
| Ruta no existe | `NotFound` |
| Ruta es un directorio | `NotAFile` |
| Extensión no `.md`/`.markdown` (p.ej. `.txt`) | `NotMarkdown { extension }` |
| Extensión en mayúsculas (`.MD`) | OK (case-insensitive) |
| Archivo > 10 MiB | `TooLarge { size, max }` |
| Archivo exactamente == 10 MiB | OK (límite **inclusivo**: `>` rechaza, `==` pasa) |
| Sin permiso de lectura | `PermissionDenied` |
| Bytes no UTF-8 | `InvalidUtf8` |
| Archivo vacío (0 bytes) | OK, `content == ""`, `bytes == 0` |
| **TOCTOU**: existe al validar pero se borra antes de leer | El error real del SO en `open`/`read` se mapea (`NotFound`/`Io`); NUNCA se asume éxito ni se devuelve contenido fantasma. Mitigado abriendo el handle una sola vez (§4.3). |
| Symlink a un `.md` válido | OK (canonicalize lo resuelve antes de validar). |

## 7. Arnés de verificación (Pilar 5 — `#[cfg(test)]`, aislado del runtime Tauri)
La lógica pura debe ser testeable SIN levantar Tauri. Extraer el núcleo a una
función libre (p.ej. `core::read_markdown(path: &Path) -> Result<MarkdownFile, ReadMdError>`)
y que el `#[tauri::command]` sea un wrapper delgado que la llame. Tests requeridos
(usar `tempfile` o directorio temporal; los casos NO se tocan después de fijados):
- `lee_md_valido_ok`
- `archivo_inexistente_da_notfound`
- `directorio_da_notafile`
- `extension_invalida_da_notmarkdown`
- `extension_mayusculas_ok`
- `excede_tamano_da_toolarge`
- `tamano_exacto_limite_ok`
- `bytes_no_utf8_da_invalidutf8`
- `archivo_vacio_ok`

Cierre (Pilar 7): reportar el número real de tests que pasan/fallan, no "funciona".

## 8. Alcance
- SÍ: `core::read_markdown` + wrapper `#[tauri::command]` + tests `#[cfg(test)]`
  + las dependencias mínimas justificadas en `Cargo.toml` (p.ej. `tempfile` solo
  como `dev-dependency`).
- NO en esta tarea: UI/frontend, registro del comando en un binario Tauri
  completo, parseo/render de Markdown. Solo la lectura segura del archivo.
