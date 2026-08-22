//! Arnés de la lista blanca de HTML de presentación (`specs/html_allowlist.md`).
//!
//! Es código de SEGURIDAD: estos casos se fijaron ANTES de implementar y no se
//! ajustan para que el código pase. Si uno falla, el que está mal es el código.

use lekto_core::reader::to_safe_html;

/// Lo que se escapó aparece con `&lt;`; lo que pasó, como etiqueta real.
fn paso_tal_cual(md: &str, etiqueta: &str) -> bool {
    to_safe_html(md).contains(etiqueta)
}
fn fue_escapado(md: &str) -> bool {
    to_safe_html(md).contains("&lt;")
}

// ---------- INV-1: solo pasan las etiquetas permitidas ----------
#[test]
fn permite_las_seis_etiquetas_de_la_lista() {
    assert!(paso_tal_cual("uno<br>dos", "<br>"), "br");
    assert!(paso_tal_cual("<details>\n\nx\n\n</details>", "<details>"), "details");
    assert!(paso_tal_cual("<summary>Ver</summary>", "<summary>"), "summary");
    assert!(paso_tal_cual("<kbd>Ctrl</kbd>", "<kbd>"), "kbd");
    assert!(paso_tal_cual("H<sub>2</sub>O", "<sub>"), "sub");
    assert!(paso_tal_cual("x<sup>2</sup>", "<sup>"), "sup");
}

#[test]
fn bloquea_las_etiquetas_peligrosas() {
    for md in [
        "<script>alert(1)</script>",
        "<iframe src=\"x\"></iframe>",
        "<style>body{}</style>",
        "<object data=\"x\"></object>",
        "<embed src=\"x\">",
        "<form><input></form>",
        "<svg onload=\"alert(1)\"></svg>",
        "<a id=\"es\"></a>",
        "<img src=\"x.png\">",
        "<div align=\"center\">x</div>",
    ] {
        assert!(fue_escapado(md), "deberia escaparse: {md}");
        assert!(!to_safe_html(md).contains("<script"), "fuga de script: {md}");
    }
}

// ---------- INV-2: ningun atributo se emite jamas ----------
#[test]
fn etiqueta_permitida_con_atributo_se_escapa() {
    for md in [
        "<br onload=alert(1)>",
        "<br class=\"x\">",
        "<details open>x</details>",
        "<kbd onclick=\"alert(1)\">C</kbd>",
    ] {
        let out = to_safe_html(md);
        assert!(out.contains("&lt;"), "deberia escaparse: {md} -> {out}");
        // El invariante NO es "la cadena onload= no aparece": escapada es texto
        // visible e inofensivo. Es que no exista una etiqueta VIVA con atributos,
        // o sea un `<nombre ` sin escapar.
        for viva in ["<br ", "<kbd ", "<details ", "<summary ", "<sub ", "<sup "] {
            assert!(!out.contains(viva), "etiqueta viva con atributos {viva:?}: {out}");
        }
    }
}

// ---------- INV-3: las mayusculas no evaden ----------
#[test]
fn mayusculas_no_evaden_la_lista() {
    assert!(paso_tal_cual("a<BR>b", "<BR>") || paso_tal_cual("a<BR>b", "<br>"), "BR permitida");
    let out = to_safe_html("<SCRIPT>alert(1)</SCRIPT>");
    assert!(out.contains("&lt;"), "SCRIPT debe escaparse: {out}");
    assert!(!out.to_lowercase().contains("<script"), "fuga: {out}");
}

// ---------- INV-4: prefijos no cuelan ----------
#[test]
fn nombre_que_solo_empieza_igual_no_pasa() {
    for md in ["<brx>", "<subversion>", "<summaryx>", "<detailsy>"] {
        assert!(fue_escapado(md), "deberia escaparse: {md}");
    }
}

// ---------- Comentarios ----------
#[test]
fn comentarios_se_descartan() {
    for md in [
        "<!-- nota -->\n\nVisible.",
        "<!--sin espacios-->\n\nVisible.",
        "<!-- varias\nlineas\naqui -->\n\nVisible.",
    ] {
        let out = to_safe_html(md);
        assert!(!out.contains("&lt;!--"), "comentario visible: {md} -> {out}");
        assert!(!out.contains("nota") && !out.contains("lineas"), "contenido filtrado: {out}");
        assert!(out.contains("Visible."), "se comio el texto real: {out}");
    }
}

#[test]
fn comentario_sin_cerrar_no_rompe() {
    let out = to_safe_html("<!-- sin cierre\n\ntexto");
    assert!(!out.contains("&lt;!--"), "{out}");
}

// ---------- Casos borde ----------
#[test]
fn variantes_de_br() {
    for md in ["a<br/>b", "a<br />b", "a</br>b"] {
        assert!(!fue_escapado(md), "deberia pasar: {md} -> {}", to_safe_html(md));
    }
}

#[test]
fn basura_no_entra_en_panico_y_se_escapa() {
    for md in ["< br>", "<", "<>", "<<>>", "a < b y c > d", "<!", "<!-"] {
        let _ = to_safe_html(md); // INV-6: no entra en panico
    }
    assert!(fue_escapado("< br>"), "'< br>' no es etiqueta valida");
}

#[test]
fn html_dentro_de_bloque_de_codigo_sigue_siendo_texto() {
    let out = to_safe_html("```\n<script>alert(1)</script>\n```");
    assert!(out.contains("&lt;script&gt;"), "el codigo debe verse literal: {out}");
    assert!(!out.contains("<script>"), "fuga desde bloque de codigo: {out}");
}

// ---------- INV-5: el endurecimiento de URLs sigue intacto ----------
#[test]
fn urls_peligrosas_de_markdown_siguen_neutralizadas() {
    for md in [
        "[x](javascript:alert(1))",
        "[x](data:text/html,<script>alert(1)</script>)",
        "[x](vbscript:msgbox)",
        "![x](javascript:alert(1))",
    ] {
        let out = to_safe_html(md);
        assert!(!out.contains("javascript:"), "fuga javascript: {out}");
        assert!(!out.contains("vbscript:"), "fuga vbscript: {out}");
    }
}
