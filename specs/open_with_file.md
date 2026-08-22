# SPEC — Abrir un `.md` desde el explorador de archivos ("Abrir con Lekto")

> SDD (Pilar 1). Fijada ANTES de codear, NO se redefine para que el código pase
> (Regla de Oro). Frontera de confianza Rust ↔ Frontend = LÍNEA ROJA: la ruta que
> entrega el sistema operativo es entrada NO confiable.

Plataformas en alcance: **Linux y Windows**. macOS queda fuera (usa Apple Events,
no `argv`, y no hay ojo humano en un Mac).

---

## 1. Propósito (una frase)
Que al elegir "Abrir con → Lekto" sobre un archivo `.md` —o al ejecutar
`lekto documento.md`— la aplicación muestre ese documento renderizado.

## 2. Estado actual medido (no supuesto)
| Pieza | Estado | Evidencia |
|---|---|---|
| `fileAssociations` en `tauri.conf.json` | Declarado y correcto | ext `md`/`markdown`, `mimeType: text/markdown` |
| `.desktop` dentro del `.deb` | `Exec=lekto` **sin `%F`** | `dpkg-deb -x` sobre el `.deb` construido |
| Aparecer en "Abrir con" de GNOME | **NO aparece** | Captura del diálogo; con `%F` añadido a mano, aparece primero en Recommended |
| El SO entrega la ruta | Sí, cuando hay `%F` | `/proc/<pid>/cmdline` = `/usr/bin/lekto /ruta/prueba.md` |
| La app lee la ruta | **NO** | No existe `env::args` en ningún `.rs` |

**Causa raíz:** dos defectos independientes que se suman. `tauri-bundler` 2.11.3
emite el `MimeType` pero no el `%F`, y el escritorio filtra del diálogo toda
aplicación cuyo `Exec` no acepta un archivo. Aunque apareciera, la app ignora `argv`.

> ⚠️ `gio mime text/markdown` lista Lekto como "Recommended" **con el bug puesto**.
> Es un comando que da VERDE sobre lo que no mira: no verifica que el `Exec` acepte
> el archivo. No sirve como árbitro de este defecto.

## 3. Comportamiento especificado
1. `lekto` sin argumentos → comportamiento actual, sin cambios.
2. `lekto a.md` con la app cerrada → abre y muestra `a.md` renderizado.
3. `lekto b.md` con la app YA abierta → **pestaña nueva en la ventana existente**,
   con el foco puesto en ella. No se abre una segunda ventana.
4. Varios archivos a la vez (`%F` puede entregar N) → una pestaña por archivo,
   foco en la primera.
5. Ruta inválida (no existe, sin permisos, es un directorio, no es `.md`) → la app
   abre normalmente y reporta el error por el flujo de errores que ya existe.
   Nunca un panic, nunca una ventana en blanco sin explicación.

## 4. Invariantes (Pilar 2)
- **I1.** Ninguna ruta venida de `argv` toca el sistema de archivos sin pasar por la
  misma validación que `read_markdown_file`. El SO no es fuente de verdad confiable.
- **I2.** Lanzar sin argumentos deja el comportamiento actual **byte a byte igual**.
- **I3.** Un argumento que empieza por `-` se ignora: es un flag, no una ruta.
- **I4.** Ninguna entrada de `argv` produce `panic!`. Los errores se propagan como `Result`.
- **I5.** El `.desktop` **dentro del `.deb`** contiene `%F` en su `Exec`. Se verifica
  sobre el paquete construido, nunca sobre `tauri.conf.json`.

## 5. Constantes
| Constante | Valor | Justificación |
|---|---|---|
| Extensiones aceptadas | `md`, `markdown` | Las mismas que ya declara `fileAssociations`; no se amplía el contrato en este ciclo. |
| Prefijo de flag ignorado | `-` | Convención POSIX; evita tratar `--flag` como ruta (I3). |

## 6. Casos borde anticipados (Pilar 4)
- Sin argumentos · Ruta relativa (se resuelve contra el cwd) · Ruta con espacios y
  con caracteres no-ASCII · Directorio en vez de archivo · Archivo inexistente ·
  Archivo sin permiso de lectura · Extensión que no es `.md` · Flags mezclados con
  rutas · N archivos a la vez · Segundo lanzamiento con la app ya abierta.

## 7. Arnés de verificación (Pilar 5 — se construye ANTES de implementar, y se calibra)
**Unitario, sin runtime de Tauri:** `rutas_desde_argv(&[String]) -> Vec<PathBuf>`
como función pura, cubriendo todos los casos de §6.

**Sobre el ARTEFACTO, no sobre la config (I5):** test que extrae el `.deb`
construido y afirma que el `.desktop` tiene `%F` en `Exec` y `text/markdown` en
`MimeType`.

**Calibración obligatoria antes de aceptar** — cada guarda se provoca:
1. Quitar `%F` de la plantilla ⇒ el test del artefacto debe ponerse ROJO.
2. Degradar el filtro de flags (aceptar `-x` como ruta) ⇒ ROJO.
3. Saltarse la validación de ruta ⇒ ROJO.

**Verificación humana (respuesta + captura, siempre):** el diálogo real de
GNOME es el único árbitro de que Lekto aparezca. Ningún comando lo sustituye.

## 8. Meta numérica de cierre (Pilar 7 — fijada ANTES)
- Crecimiento del binario por `tauri-plugin-single-instance`: **≤ 0.30 MiB**.
  Se reporta el número real medido, crezca lo que crezca.
  > 🔴 **NO SE CUMPLIÓ: +2.905 MiB** (11.562 → 14.468 MiB). La meta se deja escrita
  > tal como se fijó; no se reescribe para que el resultado pase.
  > **Causa:** el plugin arrastra `zbus` 5.19.0, una implementación completa de
  > D-Bus, confirmada con `cargo tree -i zbus`. No hay salida por configuración:
  > las únicas features del plugin (`deep-link`, `semver`) son aditivas.
  > **Decisión tomada:** se acepta el peso. 14.47 MiB sigue siendo del orden de una
  > décima parte de un Electron equivalente —el benchmark declarado del proyecto— y
  > «liviano» es la 4ª de las cinco prioridades. El costo es el precio de que un
  > segundo archivo entre como pestaña en vez de abrir otra ventana.
- `cargo test`: los 55 actuales siguen verdes + los nuevos. Se reporta el total real.
- `cargo clippy -D warnings`: 0 warnings. `cargo audit`: 0 vulnerabilidades.
- Linux: Lekto aparece en "Abrir con" y el documento se ve renderizado (captura).
- Windows: la asociación queda declarada en el `.msi` y se comprueba con el ojo.

## 9. Alcance / límites
- SÍ: lectura de `argv`, plugin single-instance, plantilla `.desktop` con `%F`,
  entrega de las rutas al frontend, apertura como pestañas.
- NO: macOS · registrar `text/plain` · abrir carpetas · argumentos de configuración
  (`--theme`, etc.) · cambiar el flujo de apertura desde dentro de la app.
