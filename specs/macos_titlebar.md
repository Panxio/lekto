# spec-stub — Titlebar por plataforma (macOS: semáforo nativo)

> Estado: **CÓDIGO ESCRITO · SIN VERIFICAR EN macOS.** Decisión de diseño:
> **fijo por plataforma** (NO setting configurable estilo Obsidian).
> Secuencia: **paso 2 de la pista MULTIPLATAFORMA** — va DESPUÉS de la etapa de CI
> (`tauri-action`), porque el árbitro es un artefacto `.dmg` corriendo en macOS real.
>
> ⚠️ **NO declarar esto "listo".** Lo único verificado es que Windows y Linux no se
> rompieron (INV-1) y que la config es coherente consigo misma (arnés
> `src-tauri/tests/config_macos.rs`). **Nadie miró todavía un Mac.** Mientras eso no
> pase, todo lo de abajo es comportamiento ESPERADO, no observado.

## Estado de implementación
| Pieza | Archivo | Verificado |
|---|---|---|
| Config por plataforma | `src-tauri/tauri.macos.conf.json` | ❌ solo por el arnés |
| CSS `html.macos` | `src/index.html` | ❌ escrito a ciegas |
| Detección de SO | `src/main.js` (userAgent, sin plugin) | ❌ el negativo sí: en Linux no se activa |
| Anti-divergencia | `src-tauri/tests/config_macos.rs` | ✅ calibrado con 3 fallos provocados |
| `.dmg` universal (Intel + ARM) | `.github/workflows/build.yml` | ❌ el job no se ha corrido |

## Corrección a esta spec, medida
El texto original decía "NO `decorations:false`" sin más. El detalle exacto, sacado del
código de `tauri-utils` y no de la memoria:
- `trafficLightPosition` **requiere `titleBarStyle: Overlay` Y `decorations: true`.**
- El merge de `tauri.macos.conf.json` **REEMPLAZA el array `app.windows` entero**; NO
  fusiona campo a campo. Comprobado empíricamente en Linux con un
  `tauri.linux.conf.json` que solo traía `title`: reapareció la barra de título nativa
  de GNOME (47 px, medidos sobre la captura) porque `decorations: false` se perdió.
  **Por eso el archivo de macOS repite la ventana completa**, y por eso existe el arnés
  que impide que las dos copias diverjan en silencio.
- El deserializador de `TitleBarStyle` **cae a `Visible` ante cualquier string
  desconocido, sin fallar el build**. Un typo no rompe nada acá; se vería solo en un Mac.

## Problema
Hoy `tauri.conf.json` tiene `decorations: false` GLOBAL → matamos todo el chrome
nativo y dibujamos min/max/cerrar propios a la derecha + 8 resize-grips. Correcto en
Windows/Linux. En **macOS es incorrecto**: el "semáforo" (cerrar/min/zoom) va a la
IZQUIERDA con comportamiento nativo esperado (hover, verde=fullscreen). Con
`decorations:false` lo matamos y se ve "no-Mac".

## Referencia (cómo lo hacen los Electron: Obsidian / Claude Desktop)
Titlebar POR PLATAFORMA. En macOS usan `titleBarStyle:'hiddenInset'`: conservan el
semáforo nativo, ocultan la barra de título, dejan que el contenido se dibuje edge-to-edge
por debajo, y `trafficLightPosition` para alinear los puntitos a su barra. En Win/Linux
usan frame custom (como el nuestro).

## Enfoque para Lekto (aprovecha el Grid de 3 zonas ya existente — sin refactor)
El grid `marca | acciones | controles` ya aísla las zonas. Delta SOLO en macOS:

**Config (build-time, macOS):**
- NO `decorations:false`. Usar `titleBarStyle: "Overlay"` + `hiddenTitle: true`
  (equivalente Tauri de `hiddenInset`) → mantiene el semáforo nativo.
- `trafficLightPosition: {x, y}` para centrar los puntitos en la altura de la topbar.
- Mecanismo por plataforma: **config específica de macOS que se mergea sobre la base**
  (confirmar sintaxis exacta del archivo/merge en la doc de Tauri v2 AL IMPLEMENTAR —
  no darla por cierta de memoria).

**CSS/runtime (macOS):**
- Detectar SO con `platform()` de `@tauri-apps/plugin-os` → clase `html.macos` en `<html>`
  (MISMO patrón que `html.fullscreen`/`html.maximized` ya existentes → consistencia, 0 deuda nueva).
- `html.macos .window-controls { display:none }` (redundante con el semáforo nativo).
- `html.macos .resize-grip { display:none }` (macOS redimensiona nativo con decorations conservadas).
- `html.macos .brand { padding-left: ~70-80px }` para que "Lekto" no quede bajo los puntitos.

**Invariante (INV-1):** en Windows/Linux la app queda IDÉNTICA a hoy (frameless + controles
propios). El bloque `html.macos` solo aplica en Mac.

## Árbitro y BLOQUEO (Regla de Oro)
El árbitro es **macOS real**: semáforo, overlay, fullscreen del botón verde. No es
verificable desde Linux ni headless. El CI *compila* el `.dmg` pero **no lo prueba visualmente**.
→ El código se puede escribir a ciegas, pero **NO declarar "verificado" sin una persona frente a un
Mac.** Si no hay acceso a un Mac al llegar aquí, ESCALAR esa decisión antes de cerrar esta etapa.

## Duda relacionada a resolver aquí también
Si algún día se hace configurable (Obsidian expone Native/Custom frame), sería otra etapa.
Por ahora: FIJO por plataforma (decisión tomada).
