# SPEC — Lógica de recarga automática (file watcher)

> SDD (Pilar 1). Fijada ANTES de codear, NO se redefine (Regla de Oro). Alcance
> acotado: la **lógica pura testeable** del watcher (anti-rebote +
> filtro de eventos), con `cargo test` como árbitro. La integración con `notify`,
> el comando Tauri y el frontend quedan fuera de esta spec. Si algo es ambiguo,
> se detiene y se documenta el bloqueo.

## 1. Propósito (una frase)
Aislar y probar la lógica que decide CUÁNDO refrescar el render cuando el archivo
abierto cambia en disco, sin acoplarla a la integración del sistema de archivos.

## 2. Entregable único
- Un módulo `pub mod watcher` en `src-tauri/src/lib.rs` con **dos funciones puras**:
  1. Anti-rebote (debounce): decide si emitir según el tiempo desde la última emisión.
  2. Filtro de eventos: clasifica un `notify::EventKind` como "relevante" (hay que
     re-leer) o no.
- Tests Rust que cubran ambas (§7).
- Añadir la dependencia `notify` en `Cargo.toml` con su comentario-justificación.

## 3. Comportamiento / firmas EXACTAS (no redefinir)
```rust
/// Decide si corresponde emitir un refresco, aplicando anti-rebote.
/// Devuelve true si nunca se emitió, o si pasó >= debounce_ms desde la última.
/// `now_ms`/`last_emit_ms`: milisegundos de un reloj monótono (inyectado por el llamador).
pub fn should_emit(last_emit_ms: Option<u64>, now_ms: u64, debounce_ms: u64) -> bool

/// Clasifica un evento del watcher: true si el cambio amerita re-leer el archivo.
/// Relevante: modificaciones de contenido y creación. NO relevante: accesos (lectura),
/// y por ahora tampoco la eliminación (el archivo ya no está; se maneja aparte).
pub fn is_relevant_change(kind: &notify::EventKind) -> bool
```
- `should_emit`: usar resta saturada (`now_ms.saturating_sub(last)`), nunca panic por
  desbordamiento ni por `now < last`.
- `is_relevant_change`: `EventKind::Modify(_)` → true; `EventKind::Create(_)` → true;
  `EventKind::Access(_)` → false; `EventKind::Remove(_)` → false; cualquier otro
  (`Any`/`Other`) → false (conservador: ante la duda, no refrescar).

## 4. Dependencia (Pilar 0/1)
- Añadir `notify = "6"` a `[dependencies]` en `src-tauri/Cargo.toml` con comentario que
  justifique (watcher de archivos liviano y multiplataforma, estándar del ecosistema).
- NO añadir ningún otro crate. NO añadir features innecesarias.

## 5. Invariantes (Pilar 2)
- I1. Las dos funciones son **puras** (sin IO, sin hilos, sin estado global): mismo
  input → mismo output. El reloj entra como parámetro (`now_ms`), no se lee adentro.
- I2. Ningún `unwrap`/`panic`; `should_emit` no entra en pánico con `now_ms < last_emit_ms`.
- I3. Sin regresión: los 30 tests previos siguen verdes + los nuevos; `clippy` 0 warnings.
- I4. NO tocar `reader::*`, `export::*` ni los comandos existentes.

## 6. Fuera de alcance (NO hacer en esta spec)
- NO crear el watcher real de `notify` (el `RecommendedWatcher`, hilos, callbacks).
- NO crear el comando `#[tauri::command] watch_file` ni emitir eventos Tauri.
- NO tocar el frontend (`index.html`/`main.js`).
- NO registrar nada nuevo en `generate_handler!`.
> Todo eso se cablea después, encima de estas funciones puras ya probadas.

## 7. Casos borde (Pilar 4) — tests Rust de §3
| Caso | Esperado |
|---|---|
| `should_emit(None, 1000, 300)` | `true` (primera vez) |
| `should_emit(Some(1000), 1100, 300)` | `false` (dentro de la ventana) |
| `should_emit(Some(1000), 1300, 300)` | `true` (justo en el límite) |
| `should_emit(Some(1000), 5000, 300)` | `true` (muy pasado) |
| `should_emit(Some(1000), 900, 300)` | `false` sin panic (now < last, resta saturada) |
| `is_relevant_change(&EventKind::Modify(ModifyKind::Any))` | `true` |
| `is_relevant_change(&EventKind::Create(CreateKind::Any))` | `true` |
| `is_relevant_change(&EventKind::Access(AccessKind::Any))` | `false` |
| `is_relevant_change(&EventKind::Remove(RemoveKind::Any))` | `false` |

## 8. Verificación (Pilar 5 — se corre el árbitro COMPLETO)
- `cargo test` (30 previos + nuevos del watcher, todos verdes), `cargo build`,
  `clippy` 0 warnings. Se reportan números reales; no se declara éxito sin correr `cargo test`.

## 9. Alcance / límites
- Se tocan ÚNICAMENTE: `src-tauri/src/lib.rs`
  (nuevo `pub mod watcher` + sus tests) y `src-tauri/Cargo.toml` (dep `notify`).
- NADA de integración con el sistema de archivos, comando Tauri, eventos ni frontend.
- Un entregable, verificable con `cargo test`. Ante una duda sobre la API de
  `notify::EventKind`, se detiene y se documenta el bloqueo.
