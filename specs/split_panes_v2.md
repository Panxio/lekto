# Spec — Split v2, Fase A: panel derecho como grupo de pestañas + mudanza + foco

> Fuente de verdad de esta fase. NO redefinir ni improvisar. Frontend: `src/main.js` + `src/index.html`.
> Sin Rust. Feedback recibido de otros desarrolladores: en el split (1) el mismo doc NO debe quedar en
> ambos lados, (2) el panel con foco debe ser manipulable. Modelo elegido:
> **VS Code / Obsidian** — dos grupos de pestañas independientes; mover una pestaña a un panel la
> SACA del otro (mudanza, nunca duplicado).

## Alcance de ESTA fase (A) — leer con cuidado
Esta fase hace SOLO la estructura del panel derecho como grupo de pestañas real + la mudanza de
pestañas entre paneles + el foco por clic. **NO** toca zoom/ancho/imprimir por-panel (son los
fases B/D siguientes) ni la búsqueda/TOC/watcher (fase C). El panel IZQUIERDO queda EXACTAMENTE
como está hoy (invariante de no-regresión, ver abajo).

## Clave de diseño (baja el riesgo)
Hoy el panel derecho v1 es un "espejo": `openInRight(tab)` COPIA `tab.html` en `#content-right` y la
pestaña sigue viva en la izquierda (por eso se ve repetida — es justo el bug del feedback). Este
fase lo reemplaza por un **grupo de pestañas propio** (`rightTabs[]` + `activeRightId` + un tab
strip `#tabbar-right`), en PARALELO al de la izquierda. Cada pestaña ya guarda su HTML renderizado
en `tab.html` (post-pipeline); mover una pestaña entre paneles es mover su OBJETO entre los dos
arreglos, conservando su identidad (`id`). No se re-ejecuta el pipeline de render al mover.

## Constantes / decisiones (con su porqué)
- `focusedPane`: `"left" | "right"`. Estado nuevo. Arranca en `"left"`. Determina el panel activo
  para las fases siguientes (zoom/TOC/imprimir); en ESTA fase solo pinta el anillo de foco y es
  el destino del botón Dividir. Un clic (`mousedown`) en un panel lo enfoca.
- `rightTabs` / `activeRightId`: estado del panel derecho, espejo de `tabs` / `activeTabId`.
- ids de pestaña: mismo formato que la izquierda, `"tab-" + (++tabSeq)` (contador GLOBAL compartido
  → sin colisiones al mover). Al MOVER se conserva el `id` del objeto (no se regenera).
- El panel derecho NO tiene `.copy-btn` (se quitan tras inyectar HTML) — igual que en v1.

## Layout / markup (src/index.html)

### Cambio M1 — reemplazar la cabecera del split por un tab strip
Buscar (líneas ~1188-1194):
```html
        <aside id="split-pane" class="split-pane hidden">
          <div class="split-pane-header">
            <span id="split-title" class="split-pane-title"></span>
            <button id="split-close" class="split-pane-close" type="button" aria-label="Cerrar panel" title="Cerrar panel" data-i18n-aria="closeSplit" data-i18n-title="closeSplit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
          </div>
          <div id="content-right" class="split-content"></div>
        </aside>
```
Reemplazar por:
```html
        <aside id="split-pane" class="split-pane hidden">
          <nav id="tabbar-right" class="tabbar hidden"></nav>
          <div id="content-right" class="split-content"></div>
        </aside>
```
> Se elimina `#split-title` y `#split-close` (el cierre ahora es la ✕ de cada pestaña, como en
> Obsidian). El tab strip reusa la clase `.tabbar`/`.tab` existente sin CSS nuevo de pestaña.

### Cambio M2 — CSS del anillo de foco (solo cuando hay split)
Agregar este bloque JUSTO DESPUÉS de la regla `.split-pane.hidden { display: none; }` (~línea 281):
```css
      /* Anillo del panel con foco — solo visible cuando el split está activo */
      .panes.split-active .main-col.pane-focused,
      .panes.split-active #split-pane.pane-focused {
        box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--link-color) 55%, transparent);
      }
```
> Gate por `.panes.split-active`: con un solo panel (sin split) NO se dibuja anillo. El `.main-col`
> necesita ser el contenedor del anillo; ya existe con `overflow:hidden` → el inset se ve dentro.

## Lógica (src/main.js)

### Cambio J1 — estado del panel derecho + foco
Agregar JUSTO DESPUÉS de la línea `let pasteSeq = 0;` (~línea 854):
```js
  // ---- Panel derecho: grupo de pestañas propio ----
  let rightTabs = [];        // { id, path|null, title, html, scrollY }  — mismas formas que la izquierda
  let activeRightId = null;
  let focusedPane = "left";  // "left" | "right"
```

### Cambio J2 — referencias del panel derecho
En el bloque `// ---- Split view ... ----` (~líneas 1021-1027), DEJAR `splitPane`, `contentRight`,
`panesEl`, `dropZoneRight`. BORRAR la línea de `splitTitleEl` (ya no existe `#split-title`) y la de
`let splitActive = false;`. AGREGAR estas referencias:
```js
  const tabbarRight = document.getElementById("tabbar-right");
  const mainCol = document.querySelector(".main-col");
```
El bloque queda así:
```js
  // ---- Split view (panel derecho = grupo de pestañas) ----
  const splitPane = document.getElementById("split-pane");
  const contentRight = document.getElementById("content-right");
  const tabbarRight = document.getElementById("tabbar-right");
  const mainCol = document.querySelector(".main-col");
  const panesEl = document.querySelector(".panes");
  const dropZoneRight = document.getElementById("drop-zone-right");
```

### Cambio J3 — helpers de mostrar/ocultar + foco
Agregar (después del bloque de referencias J2):
```js
  function showSplit() {
    splitPane.classList.remove("hidden");
    if (panesEl) panesEl.classList.add("split-active");
  }
  function hideSplit() {
    splitPane.classList.add("hidden");
    contentRight.innerHTML = "";
    if (panesEl) panesEl.classList.remove("split-active");
    setFocusedPane("left");
  }
  function setFocusedPane(p) {
    focusedPane = p;
    if (mainCol) mainCol.classList.toggle("pane-focused", p === "left");
    if (splitPane) splitPane.classList.toggle("pane-focused", p === "right" && rightTabs.length > 0);
  }
  function getActiveRightTab() { return rightTabs.find(t => t.id === activeRightId) || null; }
  function paintRight() {
    const t = getActiveRightTab();
    contentRight.innerHTML = t ? (t.html || "") : "";
    contentRight.querySelectorAll(".copy-btn").forEach(b => b.remove()); // panel sin handlers de copiar
    contentRight.scrollTop = 0;
  }
```

### Cambio J4 — tab strip del panel derecho
Agregar `renderRightTabBar` (modela `renderTabBar`, ~línea 870, pero para `rightTabs`/`#tabbar-right`;
al arrastrar una pestaña derecha se MUEVE a la izquierda; la ✕ la cierra):
```js
  function renderRightTabBar() {
    if (!tabbarRight) return;
    const trans = translations[currentLang] || translations.es;
    tabbarRight.textContent = "";
    if (rightTabs.length === 0) { tabbarRight.classList.add("hidden"); return; }
    tabbarRight.classList.remove("hidden");
    rightTabs.forEach(t => {
      const tab = document.createElement("div");
      tab.className = "tab" + (t.id === activeRightId ? " active" : "");
      tab.title = t.path || t.title;
      // (El arrastre de VUELTA derecha→izquierda queda para una fase posterior; aquí la pestaña derecha
      //  solo se activa por clic o se cierra por ✕.)
      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = t.title;
      label.addEventListener("click", () => activateRightTab(t.id));
      const close = document.createElement("button");
      close.className = "tab-close";
      close.type = "button";
      close.setAttribute("aria-label", trans.tabClose);
      close.title = trans.tabClose;
      close.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      close.addEventListener("click", (e) => { e.stopPropagation(); closeRightTab(t.id); });
      tab.appendChild(label);
      tab.appendChild(close);
      tabbarRight.appendChild(tab);
    });
  }
  function activateRightTab(id) {
    const t = rightTabs.find(x => x.id === id);
    if (!t) return;
    activeRightId = id;
    paintRight();
    renderRightTabBar();
    setFocusedPane("right");
  }
  function closeRightTab(id) {
    const idx = rightTabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const wasActive = (id === activeRightId);
    rightTabs.splice(idx, 1);
    if (rightTabs.length === 0) {
      activeRightId = null;
      renderRightTabBar();
      hideSplit();
      return;
    }
    if (wasActive) {
      activeRightId = rightTabs[Math.min(idx, rightTabs.length - 1)].id;
      paintRight();
    }
    renderRightTabBar();
  }
```

### Cambio J5 — mudanza de pestañas entre paneles
Agregar. `detachLeftTab` replica la parte de `closeTab` que reactiva vecino/estado vacío pero
DEVUELVE el objeto (no lo destruye):
```js
  // Saca una pestaña del panel IZQUIERDO sin cerrarla; devuelve su objeto (o null).
  function detachLeftTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return null;
    if (id === activeTabId) saveActiveTabState(); // persiste html/scroll actuales antes de sacarla
    const wasActive = (id === activeTabId);
    const [t] = tabs.splice(idx, 1);
    if (tabs.length === 0) {
      activeTabId = null;
      currentOpenPath = null;
      originalHtml = null;
      renderTabBar();
      renderEmptyState();
      resetSearchState();
      buildToc();
    } else if (wasActive) {
      const next = tabs[Math.min(idx, tabs.length - 1)];
      activeTabId = null;           // fuerza que activateTab no salga temprano
      activateTab(next.id);
    } else {
      renderTabBar();
    }
    return t;
  }
  // MUDANZA izquierda → derecha (la pestaña desaparece de la izquierda; nunca duplicada).
  function moveTabToRight(tab) {
    if (!tab) return;
    const t = detachLeftTab(tab.id);
    if (!t) return;
    rightTabs.push(t);
    activeRightId = t.id;
    showSplit();
    paintRight();
    renderRightTabBar();
    setFocusedPane("right");
  }
  // (moveTabToLeft — mudanza derecha→izquierda — queda para una fase posterior, junto al arrastre simétrico.)
  // Botón "Dividir" / ítem del menú ☰: manda la pestaña ACTIVA de la izquierda a la derecha.
  function dividirActiva() {
    const t = getActiveTab();
    if (!t) return;                 // nada abierto que dividir
    moveTabToRight(t);
  }
```

### Cambio J6 — reemplazar las funciones v1 del split
BORRAR por completo estas 4 funciones actuales (~líneas 1029-1076): `openInRight`, `closeSplit`,
`toggleSplit`, y REESCRIBIR `openRecentInRight` así (arrastrar un reciente crea/activa una pestaña
REAL a la derecha; respeta "no duplicado"):
```js
  async function openRecentInRight(path) {
    path = (path || "").trim();
    if (!path || !splitPane) return;
    try {
      const file = await invoke("read_markdown_file", { path });
      // Ya abierto a la derecha → solo activarlo.
      const existingRight = rightTabs.find(t => t.path === file.path);
      if (existingRight) { activateRightTab(existingRight.id); return; }
      // Ya abierto a la izquierda → MUDARLO a la derecha (no duplicar).
      const existingLeft = tabs.find(t => t.path === file.path);
      if (existingLeft) { moveTabToRight(existingLeft); saveRecent(path); updateRecentsSelect(); return; }
      // Nuevo: renderizar y crear pestaña derecha.
      const html = await invoke("render_markdown", { content: file.content });
      contentRight.innerHTML = html;
      highlightCode(contentRight);
      await renderMermaid(contentRight);
      await renderMath(contentRight);
      renderCallouts(contentRight);
      const rendered = contentRight.innerHTML;               // captura post-pipeline
      contentRight.querySelectorAll(".copy-btn").forEach(b => b.remove());
      const id = "tab-" + (++tabSeq);
      rightTabs.push({ id, path: file.path, title: getBasename(file.path), html: rendered, scrollY: 0 });
      activeRightId = id;
      showSplit();
      contentRight.scrollTop = 0;
      renderRightTabBar();
      setFocusedPane("right");
      saveRecent(path);
      updateRecentsSelect();
    } catch (err) {
      if (errorEl) errorEl.textContent = describeError(err);
    }
  }
```

### Cambio J7 — arrastre de la pestaña IZQUIERDA ahora MUEVE (no espeja)
En `renderTabBar` (~línea 882-884), el `onDrop` de la pestaña izquierda pasa de `openInRight` a
`moveTabToRight`:
```js
      tab.addEventListener("pointerdown", (e) => startPaneDrag(e, {
        target: tab, label: t.title, onDrop: () => moveTabToRight(t), ignoreSelector: ".tab-close"
      }));
```

### Cambio J8 — menú contextual de pestaña izquierda ("Abrir a la derecha" → mudar)
En `showTabMenu` (~línea 1157), el handler de `b1` pasa de `openInRight(tab)` a `moveTabToRight(tab)`:
```js
    b1.addEventListener("click", () => { closeTabMenu(); moveTabToRight(tab); });
```

### Cambio J9 — listeners del botón Dividir, menú ☰ y quitar split-close
- Botón `#split-toggle` (~línea 1819-1820): `toggleSplit` → `dividirActiva`.
```js
  const splitToggleBtn = document.getElementById("split-toggle");
  if (splitToggleBtn) splitToggleBtn.addEventListener("click", dividirActiva);
```
- BORRAR las 2 líneas de `#split-close` (~1821-1822): ese botón ya no existe en el markup.
- Ítem del menú ☰ (~línea 2013): `toggleSplit()` → `dividirActiva()`.
```js
      bSplit.addEventListener("click", () => { closeAppMenu(); dividirActiva(); });
```

### Cambio J10 — foco por clic en cada panel
Agregar (junto a los otros listeners de init, p.ej. tras el listener de `#split-toggle`):
```js
  if (mainCol) mainCol.addEventListener("mousedown", () => setFocusedPane("left"));
  if (splitPane) splitPane.addEventListener("mousedown", () => { if (rightTabs.length) setFocusedPane("right"); });
```

## Invariantes (RECHAZO si se violan)
- INV-1 (no-regresión izquierda): abrir/cerrar/activar pestañas a la izquierda, búsqueda, TOC,
  fijados, watcher, zoom y ancho funcionan EXACTAMENTE igual que antes. `cargo test` 40/0.
- INV-2 (mudanza, no espejo): al mandar una pestaña a la derecha, su `id` YA NO está en `tabs` y SÍ
  está en `rightTabs`. Nunca el mismo `id` en ambos arreglos a la vez.
- INV-4 (cierre): cerrar la última pestaña derecha oculta `#split-pane` y quita `.split-active`.
- INV-5 (Dividir): el botón/ítem manda la pestaña ACTIVA izquierda a la derecha (si hay alguna).
- INV-6 (foco): un `mousedown` en un panel le pone `.pane-focused` (y lo quita al otro). El anillo
  solo se ve con split activo.
- INV-7: el panel derecho no contiene `.copy-btn`.
- `node --check src/main.js` sin errores; `git status` solo `src/index.html` + `src/main.js`.

## Verificación objetiva headless (sin ver imágenes)
Arnés en `/tmp` que carga `src/main.js` con `window.__TAURI__` STUBEADO (al menos `.core.invoke`
que resuelve `render_markdown`/`read_markdown_file`; sin stub el init aborta — lección aprendida). Emite
señales a `document.title`. Simular sin diálogo nativo: crear 2 pestañas izquierdas por código (o
invocar el pipeline con contenido dummy), luego:
1. `node --check src/main.js` → sin errores.
2. S1 mudanza: tras `moveTabToRight(tabA)` → `tabs` no contiene `tabA.id`, `rightTabs` sí; `#tabbar-right`
   tiene 1 `.tab`; `#split-pane` sin clase `hidden`; `.panes` con `split-active`.
3. S2 no-duplicado (INV-2): el id movido NO aparece en ambos arreglos.
4. S4 cierre: cerrar la última pestaña derecha → `#split-pane` con `hidden`, `.panes` sin `split-active`.
6. S5 Dividir: `dividirActiva()` con una pestaña activa la mueve a la derecha.
7. S6 foco: `setFocusedPane("right")` pone `.pane-focused` en `#split-pane` y lo quita de `.main-col`.
8. S7 regresión: `buildToc()`/búsqueda siguen operando sobre `#content` (izquierda) sin romperse.
9. `cd src-tauri && cargo test` → 40/0. Volver al root.
10. `grep -n "moveTabToRight\|rightTabs\|renderRightTabBar\|dividirActiva\|split-active" src/main.js`.

Se reporta cada resultado (OK / valor real). Si algo no cuadra con el spec, se detiene y se escribe
documentar el bloqueo con el problema + 2-3 alternativas — NO falsear (Regla de Oro).

## Alcance
SOLO `src/main.js` y `src/index.html`. NO tocar Rust, `tauri.conf.json`,
ni ningún otro archivo. NO agregar claves i18n nuevas (se reusa `trans.tabClose`).
NO tocar zoom/ancho/imprimir/TOC/búsqueda (son fases B/C/D). Scratch temporal a `/tmp`.
