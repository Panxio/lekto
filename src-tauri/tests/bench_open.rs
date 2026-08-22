//! Mide la ruta Rust de apertura: `read_markdown` + `to_safe_html` sobre un `.md` de ~50 KB.
//!
//! Existe para que el número del README se pueda RE-MEDIR el día que se publica, en vez de
//! arrastrar una cifra vieja etiquetada como "medida". Es autocontenido a propósito: genera
//! su propio fixture en un temporal, así que corre igual en CI y en cualquier máquina.
//!
//! Correr y VER el número:
//!     cargo test --release --test bench_open -- --nocapture
//!
//! No afirma un umbral de tiempo: una máquina de CI compartida es varias veces más lenta que
//! una de escritorio, y un test que falla por la carga del runner no mide nada, solo molesta.
//! El número lo lee una persona antes de publicarlo.
use std::path::Path;
use std::time::Instant;

/// Markdown realista (encabezados, párrafos, listas, tabla, bloque de código, enlace)
/// repetido hasta pasar los 50 KB. Un texto sintético uniforme no ejercita el parser.
fn generar_fixture(objetivo_bytes: usize) -> String {
    let mut s = String::with_capacity(objetivo_bytes + 512);
    let mut i = 0;
    while s.len() < objetivo_bytes {
        i += 1;
        s.push_str(&format!(
            "## Sección {i}\n\n\
             Texto de párrafo con **negrita**, *cursiva*, `código` y un [enlace](https://ejemplo.cl/{i}).\n\n\
             - item uno\n- item dos\n- [ ] tarea\n\n\
             | a | b |\n|---|---|\n| {i} | x |\n\n\
             ```rust\nfn f{i}() -> u32 {{ {i} }}\n```\n\n"
        ));
    }
    s
}

#[test]
fn bench_apertura_50kb() {
    let dir = std::env::temp_dir().join("lekto-bench-open");
    std::fs::create_dir_all(&dir).unwrap();
    let ruta = dir.join("bench50k.md");
    std::fs::write(&ruta, generar_fixture(50 * 1024)).unwrap();
    let ruta: &Path = &ruta;
    let bytes = std::fs::metadata(ruta).unwrap().len();

    // Calentamiento: descarta el primer acceso (cache fría del SO), que no representa
    // el caso de uso real —abrir un archivo recién editado, ya en cache.
    for _ in 0..3 {
        let f = lekto_core::reader::read_markdown(ruta).unwrap();
        std::hint::black_box(lekto_core::reader::to_safe_html(&f.content));
    }

    const N: u32 = 50;
    let t0 = Instant::now();
    for _ in 0..N {
        let f = lekto_core::reader::read_markdown(ruta).unwrap();
        std::hint::black_box(lekto_core::reader::to_safe_html(&f.content));
    }
    let prom_ms = t0.elapsed().as_secs_f64() * 1000.0 / f64::from(N);

    println!("MEDICION apertura (ruta Rust): {bytes} bytes, {N} corridas, promedio {prom_ms:.3} ms");
    let _ = std::fs::remove_dir_all(&dir);
}
