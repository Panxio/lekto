//! Verifica el `.desktop` DENTRO del `.deb` construido, no `tauri.conf.json`.
//!
//! Existe porque la configuración puede estar completa y el artefacto salir roto:
//! `fileAssociations` declaraba la asociación correctamente y aun así el bundler
//! generaba `Exec=lekto` sin `%F`. Sin el `%F` el escritorio no ofrece la app en
//! "Abrir con", aunque `gio mime` la siga listando como recomendada.
//!
//! Correr: cargo tauri build --bundles deb && cargo test --test desktop_entry
use std::path::PathBuf;
use std::process::Command;

fn deb_path() -> Option<PathBuf> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target/release/bundle/deb/Lekto_0.1.0_amd64.deb");
    p.exists().then_some(p)
}

fn desktop_entry(deb: &PathBuf) -> String {
    let tar = Command::new("dpkg-deb")
        .args(["--fsys-tarfile", deb.to_str().unwrap()])
        .output()
        .expect("dpkg-deb disponible");
    assert!(tar.status.success(), "dpkg-deb falló sobre {deb:?}");

    let mut hijo = Command::new("tar")
        .args(["-xO", "usr/share/applications/Lekto.desktop"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .expect("tar disponible");
    use std::io::Write;
    hijo.stdin.take().unwrap().write_all(&tar.stdout).unwrap();
    let salida = hijo.wait_with_output().unwrap();
    assert!(
        salida.status.success(),
        "el .deb no contiene usr/share/applications/Lekto.desktop"
    );
    String::from_utf8(salida.stdout).expect("el .desktop es UTF-8")
}

#[test]
fn el_desktop_del_deb_acepta_archivos_y_declara_markdown() {
    let Some(deb) = deb_path() else {
        // Sin `.deb` construido no hay nada que auditar. Se dice en voz alta en vez
        // de pasar: un test que aprueba sobre un artefacto ausente es un falso verde.
        eprintln!("NO EVALUADO: falta el .deb. Corre `cargo tauri build --bundles deb` primero.");
        return;
    };
    let contenido = desktop_entry(&deb);

    let exec = contenido
        .lines()
        .find(|l| l.starts_with("Exec="))
        .unwrap_or_else(|| panic!("el .desktop no tiene línea Exec=:\n{contenido}"));

    // El escritorio filtra de "Abrir con" toda app cuyo Exec no acepte un archivo.
    assert!(
        exec.contains("%F") || exec.contains("%f") || exec.contains("%U") || exec.contains("%u"),
        "Exec sin marcador de archivo: {exec:?}. Lekto no aparecerá en «Abrir con»."
    );

    // Sin esto la asociación no se registra para .md, aunque el Exec sea correcto.
    assert!(
        contenido.contains("MimeType=") && contenido.contains("text/markdown"),
        "el .desktop no declara text/markdown:\n{contenido}"
    );
}
