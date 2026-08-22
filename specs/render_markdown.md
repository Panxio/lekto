# SPEC — Render de Markdown a HTML seguro

> SDD (Pilar 1). Fijada ANTES de codear, NO se redefine (Regla de Oro). Alcance
> deliberadamente acotado: un entregable, verificable con `cargo test`. Si algo
> resulta imposible o ambiguo, se detiene y se documenta el bloqueo.

Perfil: tauri-app · Lógica pesada en Rust, frontend delgado · Seguridad = LÍNEA ROJA.

## 1. Propósito (una frase)
Convertir el texto Markdown de un archivo (contenido ya leído por
`reader::read_markdown`) en **HTML seguro** para mostrarlo renderizado, sin permitir
inyección de HTML/JS desde el contenido no confiable del archivo.

## 2. Entregable único
- Función pura `reader::to_safe_html(md: &str) -> String`.
- Comando `#[tauri::command] fn render_markdown(content: String) -> String` (wrapper
  delgado que llama a la función pura; sin `pub`, por diseño).
- Frontend: tras leer OK, invocar `render_markdown` y pintar el HTML resultante.
- Tests `#[cfg(test)]` de la función pura.

## 3. Dependencia (Pilar 0/1)
- `pulldown-cmark` (última 0.x): parser CommonMark estándar de Rust, puro, liviano,
  sin deps pesadas. Justificación en `Cargo.toml` en una frase. NO usar libs JS de
  Markdown en el frontend (sumarían peso y un bundler; el perfil pide frontend delgado).

## 4. Comportamiento + SEGURIDAD (línea roja)
1. Parsear `md` con pulldown-cmark (CommonMark).
2. **Neutralizar HTML crudo del contenido:** los eventos `Event::Html` y
   `Event::InlineHtml` del parser NO se emiten como HTML vivo. El contenido del
   archivo es NO confiable: un `.md` con `<script>…</script>` o `<img onerror=…>`
   NO debe producir HTML ejecutable. Estrategia: filtrar/escapar esos eventos antes
   de generar el HTML (dependency-free; no se añade sanitizador externo si filtrar
   los eventos basta).
3. Generar el HTML del resto de eventos (headings, párrafos, listas, énfasis,
   código, links, etc.) con `pulldown_cmark::html::push_html`.
4. Devolver el String HTML.

## 5. Invariantes (Pilar 2)
- I1. Contenido no confiable NUNCA produce HTML/JS ejecutable (línea roja seguridad).
- I2. La función pura no panica ante ninguna entrada (incl. vacío, no-UTF8 ya filtrado
      aguas arriba, markdown malformado).
- I3. Los 9 tests previos de `reader` siguen pasando (sin regresión).
- I4. `cargo clippy --all-targets` sin warnings nuevos.

## 6. Casos borde (Pilar 4)
| Entrada | Salida esperada |
|---|---|
| `# Título` | contiene `<h1>Título</h1>` |
| `**negrita**` | contiene `<strong>negrita</strong>` |
| `` `code` `` | contiene `<code>code</code>` |
| bloque cercado ```` ```rust\n... ``` ```` | contiene `<pre><code` |
| `- a\n- b` | contiene `<ul>` y dos `<li>` |
| `[x](https://e.com)` | contiene `<a href="https://e.com"` |
| `<script>alert(1)</script>` | el `<script>` NO aparece como etiqueta viva (escapado o eliminado) |
| string vacío | `""` o HTML vacío, sin panic |

## 7. Frontend (cambio mínimo en `src/main.js`)
- Tras `read_markdown_file` OK: `const html = await invoke('render_markdown', { content: file.content });`
- Pintar: `contentEl.innerHTML = html;` (ahora SÍ innerHTML, porque el HTML ya viene
  saneado desde Rust — la confianza se estableció en la frontera Rust). Defensa en
  profundidad: la CSP `script-src 'self'` ya bloquea scripts inline igualmente.
- Añadir CSS mínimo para los elementos renderizados (h1-h3, code, pre, ul, a).

## 8. Verificación (Pilar 5 — se corre el árbitro COMPLETO)
- `cargo test` (nuevos tests de §6 + sin romper los previos).
- `cargo build` + `cargo tauri build` (compila binario y bundle).
- `cargo clippy --all-targets` 0 warnings.
- Se reporta el número REAL de tests. No se declara éxito sin correr `cargo test`.

## 9. Alcance / límites
- NO toques `reader::read_markdown` ni sus tests salvo para añadir `to_safe_html`.
- Solo este entregable: render seguro. NADA de temas, configuración, ni más comandos.
