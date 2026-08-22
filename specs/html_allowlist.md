# spec — Lista blanca de HTML de presentación en el render

> Estado: **ESPECIFICADO.** Reemplaza el escape total de HTML crudo por un escape
> con excepciones acotadas. Toca `reader::to_safe_html`, que es código de seguridad:
> el arnés se fija ANTES de implementar y NO se toca después (Regla de Oro).

## 1. Problema (medido, no supuesto)
`to_safe_html` convierte TODO evento HTML en texto:
```rust
Event::Html(html)       => Event::Text(html),
Event::InlineHtml(html) => Event::Text(html),
```
Es correcto para seguridad, pero el efecto colateral es que Lekto muestra etiquetas
sueltas donde GitHub muestra contenido.

**Medición sobre archivos reales del equipo (1403 `.md`):** 128 (**9%**) contienen HTML
crudo. Frecuencia por etiqueta: `<div>` 858, `<a>` 684, `<br>` 268, `<img>` 176,
`<details>`/`<summary>` 224, `<kbd>` 110, `<table>` 12, `<sub>`/`<sup>` 3.
Además, los comentarios `<!-- ... -->` se muestran como texto visible.

## 2. Comportamiento especificado
Un fragmento de HTML crudo se recorre de izquierda a derecha:

1. **Comentario** `<!-- ... -->` → se DESCARTA (no se emite nada). Es lo que hace GitHub.
   Un comentario sin cierre descarta hasta el final del fragmento.
2. **Etiqueta permitida SIN atributos** (apertura, cierre o auto-cerrada) → pasa TAL CUAL.
3. **Todo lo demás** (etiqueta no permitida, o permitida CON atributos, o basura) → se
   escapa a texto visible, exactamente como hoy.

## 3. Constantes, con su justificación
```rust
const ALLOWED_TAGS: &[&str] = &["br", "details", "summary", "kbd", "sub", "sup"];
```
- `br`, `kbd`, `sub`, `sup`: presentación en línea, sin atributos y sin comportamiento.
- `details`, `summary`: bloques plegables; es semántica nativa del navegador, no script.
- **Se EXCLUYEN a propósito `div`, `p`, `table`, `span`** aunque `div` sea la más
  frecuente: en la práctica casi siempre aparece como `<div align="...">`, y permitir
  atributos es justo lo que abre la puerta. Sin atributos, un `<div>` pelado no aporta.
- **Se EXCLUYEN `a` e `img`**: son los dos vectores clásicos (`href="javascript:"`,
  `onerror=`). El Markdown ya tiene sintaxis propia para ambos, ya endurecida.
- **Ningún atributo se emite jamás**, ni siquiera en las etiquetas permitidas. Cero
  atributos es una regla que se puede verificar de un vistazo; una lista blanca de
  atributos no.

## 4. Invariantes (Pilar 2)
- **INV-1** Ninguna etiqueta fuera de `ALLOWED_TAGS` se emite como HTML. En particular
  `script`, `img`, `a`, `iframe`, `style`, `object`, `embed`, `svg`, `form`, `input`.
- **INV-2** Ningún atributo se emite nunca. `<br onload=x>` se escapa, no se deja pasar.
- **INV-3** Las mayúsculas no evaden la lista: `<SCRIPT>` se escapa, `<BR>` se permite.
- **INV-4** Un nombre que solo EMPIEZA como uno permitido no pasa: `<brx>`, `<script>`
  frente a `<sub>`.
- **INV-5** El endurecimiento de URLs en enlaces e imágenes de Markdown queda intacto.
- **INV-6** Nunca entra en pánico, con cualquier entrada malformada.
- **INV-7** Los 40 tests previos siguen verdes.

## 5. Casos borde fijados ANTES (Pilar 4)
`<br/>` · `<br />` · `<BR>` · `</br>` · `< br>` (inválida) · `<brx>` · `<b>` ·
`<details open>` (con atributo → se escapa) · `<!--sin espacios-->` ·
comentario multilínea · comentario sin cerrar · `<script>` dentro de un bloque de
código (debe seguir siendo texto, no evento HTML) · `<` suelto · `<>` vacío.

## 6. Fuera de alcance
- Atributos permitidos (ni siquiera `open` en `details`). Otra etapa si hace falta.
- `div`, `img`, `a`, `table` crudos.
- Balancear etiquetas: un `<details>` sin cerrar lo cierra el navegador al final del
  contenedor. Afecta a la maquetación, no permite ejecutar nada.

## 7. Verificación
Arnés en `src-tauri/tests/html_allowlist.rs`, escrito y CALIBRADO (fallando contra el
código actual) antes de implementar. `cargo test` completo + `clippy -D warnings`.
