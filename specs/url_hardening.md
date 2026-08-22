# SPEC — Hardening de URLs peligrosas en el render

> SDD (Pilar 1). Fijada ANTES de codear, NO se redefine (Regla de Oro). Alcance
> acotado: un entregable. Seguridad = LÍNEA ROJA del núcleo. Si algo resulta
> imposible o ambiguo, se detiene y se documenta el bloqueo.

Perfil: tauri-app · Contenido del archivo = NO confiable.

## 1. Propósito (una frase)
Evitar que un `.md` malicioso ejecute código vía URLs peligrosas: aunque el HTML
crudo ya se escapa (ver `render_markdown.md`), un link Markdown `[x](javascript:alert(1))` todavía
produce `<a href="javascript:...">` que ejecuta al hacer clic. Hay que neutralizar
esos esquemas en `reader::to_safe_html`.

## 2. Entregable único
Endurecer `reader::to_safe_html` para sanear el `dest_url` de **links e imágenes**
generados por pulldown-cmark, + tests. NADA más.

## 3. Constantes (Pilar 1 — valor + justificación)
| Constante | Valor | Justificación |
|---|---|---|
| `DANGEROUS_SCHEMES` | `["javascript:", "data:", "vbscript:"]` | Esquemas que pueden ejecutar código o inyectar contenido al navegar/clicar; son los vectores XSS clásicos en `href`/`src`. Comparación **case-insensitive**. |
| `SAFE_REPLACEMENT` | `"#"` | URL inerte con la que se reemplaza una peligrosa: el link queda visible pero no navega a nada ejecutable. |

## 4. Comportamiento
1. Al recorrer los eventos del parser, interceptar `Tag::Link { dest_url, .. }` y
   `Tag::Image { dest_url, .. }`.
2. **Normalizar** `dest_url` antes de evaluar: pasar a minúsculas y quitar espacios
   en blanco y caracteres de control INICIALES (un atacante usa `java\tscript:` o
   `  javascript:` para evadir). Si tras normalizar empieza por algún
   `DANGEROUS_SCHEMES` → reemplazar el `dest_url` por `SAFE_REPLACEMENT`.
3. URLs seguras (http, https, mailto, relativas, `#ancla`) se conservan intactas.
4. El resto del comportamiento del render (escape de HTML crudo) NO cambia.

## 5. Invariantes (Pilar 2)
- I1. Ningún `href`/`src` del HTML de salida contiene un esquema de
      `DANGEROUS_SCHEMES` (línea roja seguridad).
- I2. Los links/imágenes con URL segura siguen funcionando (no romper lo bueno).
- I3. Sin panic ante ninguna entrada.
- I4. Sin regresión: los tests previos siguen verdes; `clippy` 0 warnings.

## 6. Casos borde (Pilar 4)
| Entrada Markdown | Salida esperada |
|---|---|
| `[x](javascript:alert(1))` | `href` NO contiene `javascript:` (queda `href="#"`) |
| `[x](JavaScript:alert(1))` | neutralizado (case-insensitive) |
| `[x](  javascript:alert(1))` | neutralizado (espacios iniciales) |
| `[x](java&#9;script:alert(1))` o con control chars | neutralizado tras normalizar |
| `[x](data:text/html,<script>)` | `href` NO contiene `data:` |
| `[x](https://e.com)` | `href="https://e.com"` intacto |
| `[x](/ruta/rel)` y `[x](#ancla)` | intactos |
| `![i](javascript:alert(1))` | `src` NO contiene `javascript:` |

## 7. Verificación (Pilar 5 — se corre el árbitro COMPLETO)
- Nuevos tests `#[cfg(test)]` cubriendo §6 (incl. el caso de evasión con espacios).
- `cargo test` (nuevos + previos, todos verdes), `cargo build`, `cargo clippy
  --all-targets` 0 warnings. Se reportan números reales; no se declara éxito sin correr.

## 8. Alcance / límites
- Se modifica SOLO `reader::to_safe_html` y sus
  tests (+ las constantes). NO toques el frontend, comandos, ni otros módulos.
- NADA fuera de sanear URLs de link/imagen. No agregues un sanitizador HTML externo.
