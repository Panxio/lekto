// Frontend mínimo. Sin bundler: usa el global de Tauri v2
// (withGlobalTauri). La lógica/validación vive en Rust; esto solo invoca y pinta.

const SIDEBAR_MIN = 180, SIDEBAR_MAX = 480;
const CONTENT_MIN = 600, CONTENT_MAX = 2000, CONTENT_DEFAULT = 900;
const ZOOM_MIN = 0.7, ZOOM_MAX = 2.0, ZOOM_STEP = 0.1, ZOOM_DEFAULT = 1.0;

// 1. Aplicar tema e idioma lo antes posible para evitar parpadeo (FOUC)
let currentTheme = "light";
try {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") {
    currentTheme = saved;
  } else {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      currentTheme = "dark";
    }
  }
} catch (e) {
  // Ignorar si localStorage no está disponible
}

if (currentTheme === "dark") {
  document.documentElement.setAttribute("data-theme", "dark");
} else {
  document.documentElement.removeAttribute("data-theme");
}

// macOS conserva el semáforo nativo (ver tauri.macos.conf.json), así que la UI tiene
// que esconder nuestros controles de ventana y correr la marca. Mismo patrón que
// `html.fullscreen` / `html.maximized`: una clase en <html> y el resto es CSS.
// Se detecta con userAgent en vez de traer @tauri-apps/plugin-os: el motor ya lo
// sabe, y un plugin para leer una cadena es peso que no se justifica (Pilar 0).
if (/Macintosh|Mac OS X/i.test(navigator.userAgent)) {
  document.documentElement.classList.add("macos");
}

try {
  if (localStorage.getItem("sidebarCollapsed") === "1") document.documentElement.classList.add("sidebar-collapsed");
} catch (e) {}

try {
  const savedWidth = localStorage.getItem("sidebarWidth");
  if (savedWidth) {
    const w = parseInt(savedWidth, 10);
    if (!isNaN(w)) {
      const clampedWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));
      document.documentElement.style.setProperty("--sidebar-width", clampedWidth + "px");
    }
  }
} catch (e) {}

try {
  const savedContentWidth = localStorage.getItem("contentWidth");
  if (savedContentWidth) {
    const w = parseInt(savedContentWidth, 10);
    if (!isNaN(w)) {
      const clampedContentWidth = Math.min(CONTENT_MAX, Math.max(CONTENT_MIN, w));
      document.documentElement.style.setProperty("--content-width", clampedContentWidth + "px");
    }
  }
} catch (e) {}

try {
  const savedContentZoom = localStorage.getItem("contentZoom");
  if (savedContentZoom) {
    const z = parseFloat(savedContentZoom);
    if (!isNaN(z)) {
      const cz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
      document.documentElement.style.setProperty("--content-zoom", cz);
    }
  }
} catch (e) {}

const translations = {
  es: {
    open: "Abrir",
    selectFile: "Abrir archivo...",
    recentsPlaceholder: "Recientes",
    recentsTitle: "Recientes",
    recentsEmpty: "Sin recientes",
    recentsRemove: "Quitar",
    recentsRemoveAll: "Quitar todos",
    recentsClearAll: "Limpiar todo",
    tocTitle: "Índice",
    tocEmpty: "Sin encabezados",
    exportHtml: "Exportar HTML",
    exportPdf: "Exportar PDF",
    searchAria: "Buscar",
    themeAria: "Cambiar tema",
    pathPlaceholder: "/ruta/al/archivo.md",
    searchPlaceholder: "Buscar...",
    searchPrev: "Anterior",
    searchNext: "Siguiente",
    searchClose: "Cerrar",
    langAria: "Cambiar idioma",
    errNoPath: "Indica una ruta.",
    errNoDoc: "No hay ningún documento cargado para exportar.",
    errDialog: "Error al abrir el diálogo:",
    errExportOk: "Exportado",
    errNotFound: "El archivo no existe.",
    errNotAFile: "La ruta no es un archivo.",
    errNotMarkdown: "No es Markdown (extensión: {ext}).",
    errTooLarge: "Archivo demasiado grande ({size} > {max} bytes).",
    errPermission: "Permiso denegado por el sistema.",
    errInvalidUtf8: "El archivo no es texto UTF-8 válido.",
    errIo: "Error de E/S: {msg}",
    errUnknown: "Error desconocido al leer el archivo.",
    none: "ninguna",
    errExportPermission: "Permiso denegado al guardar el archivo.",
    errExportIo: "Error al guardar: {msg}",
    errExportUnknown: "Error desconocido al guardar el archivo.",
    searchInputAria: "Texto a buscar",
    exportedDocTitle: "Documento Exportado",
    exportHtmlTitle: "Exportar HTML",
    exportHtmlAria: "Exportar HTML",
    exportPdfTitle: "Exportar PDF",
    exportPdfAria: "Exportar PDF",
    searchTitle: "Buscar",
    themeTitle: "Cambiar tema",
    sidebarTitle: "Alternar panel",
    sidebarAria: "Alternar panel",
    pinnedTitle: "Fijados",
    pinnedEmpty: "Sin fijados",
    pinAria: "Fijar",
    unpinAria: "Quitar",
    widthTitle: "Ancho de lectura",
    widthAria: "Ancho de lectura",
    zoomInTitle: "Acercar (Ctrl +)",
    zoomInAria: "Acercar",
    zoomOutTitle: "Alejar (Ctrl −)",
    zoomOutAria: "Alejar",
    mermaidError: "Error en el diagrama Mermaid",
    copyTitle: "Copiar código",
    copyAria: "Copiar código",
    copied: "Copiado",
    calloutNote: "Nota",
    calloutTip: "Sugerencia",
    calloutImportant: "Importante",
    calloutWarning: "Advertencia",
    calloutCaution: "Precaución",
    pastedTitle: "Pegado",
    tabClose: "Cerrar pestaña",
    splitTitle: "Dividir pantalla",
    splitAria: "Dividir pantalla",
    openRight: "Abrir a la derecha",
    closeSplit: "Cerrar panel",
    menuTitle: "Menú",
    quickOpenTitle: "Abrir archivo",
    winMinTitle: "Minimizar",
    winMaxTitle: "Maximizar",
    winRestoreTitle: "Restaurar",
    winCloseTitle: "Cerrar",
    menuAbout: "Acerca de Lekto",
    menuFullscreen: "Pantalla completa (F11)",
    readingTitle: "Ajustes de lectura",
    readingTheme: "Tema",
    readingZoom: "Zoom",
    readingWidth: "Ancho de lectura",
    aboutVersionLabel: "Versión",
    aboutDesc: "Lector de Markdown minimalista.",
    aboutTech: "Hecho con Tauri.",
    aboutLicense: "Licencia GPL-3.0",
    aboutClose: "Cerrar",
    emptyRecentsHead: "Continuar donde estabas",
    emptyHint: "Pega con %s, arrastra un archivo .md, o ábrelo con el botón +.",
    emptyRecentsHint: "…o pega con %s · arrastra un .md · abre con +",
    featPasteTitle: "Pega y listo",
    featPasteDesc: "Copia lo que te compartió la IA y se renderiza al instante, sin guardar nada.",
    featExportTitle: "Exporta",
    featExportDesc: "Guarda como HTML o PDF con un clic. Tablas, código y diagramas incluidos.",
    featSplitTitle: "Vista dividida",
    featSplitDesc: "Compara dos documentos lado a lado. Arrastra una pestaña al borde."
  },
  en: {
    open: "Open",
    selectFile: "Open file...",
    recentsPlaceholder: "Recent",
    recentsTitle: "Recent",
    recentsEmpty: "No recent files",
    recentsRemove: "Remove",
    recentsRemoveAll: "Remove all",
    recentsClearAll: "Clear all",
    tocTitle: "Contents",
    tocEmpty: "No headings",
    exportHtml: "Export HTML",
    exportPdf: "Export PDF",
    searchAria: "Search",
    themeAria: "Toggle theme",
    pathPlaceholder: "/path/to/file.md",
    searchPlaceholder: "Search...",
    searchPrev: "Previous",
    searchNext: "Next",
    searchClose: "Close",
    langAria: "Change language",
    errNoPath: "Enter a path.",
    errNoDoc: "No document loaded to export.",
    errDialog: "Error opening dialog:",
    errExportOk: "Exported",
    errNotFound: "File does not exist.",
    errNotAFile: "The path is not a file.",
    errNotMarkdown: "Not Markdown (extension: {ext}).",
    errTooLarge: "File too large ({size} > {max} bytes).",
    errPermission: "Permission denied by the system.",
    errInvalidUtf8: "File is not valid UTF-8 text.",
    errIo: "I/O error: {msg}",
    errUnknown: "Unknown error reading the file.",
    none: "none",
    errExportPermission: "Permission denied saving the file.",
    errExportIo: "Error saving: {msg}",
    errExportUnknown: "Unknown error saving the file.",
    searchInputAria: "Text to search",
    exportedDocTitle: "Exported Document",
    exportHtmlTitle: "Export HTML",
    exportHtmlAria: "Export HTML",
    exportPdfTitle: "Export PDF",
    exportPdfAria: "Export PDF",
    searchTitle: "Search",
    themeTitle: "Toggle theme",
    sidebarTitle: "Toggle sidebar",
    sidebarAria: "Toggle sidebar",
    pinnedTitle: "Pinned",
    pinnedEmpty: "No pinned",
    pinAria: "Pin",
    unpinAria: "Unpin",
    widthTitle: "Reading width",
    widthAria: "Reading width",
    zoomInTitle: "Zoom in (Ctrl +)",
    zoomInAria: "Zoom in",
    zoomOutTitle: "Zoom out (Ctrl −)",
    zoomOutAria: "Zoom out",
    mermaidError: "Mermaid diagram error",
    copyTitle: "Copy code",
    copyAria: "Copy code",
    copied: "Copied",
    calloutNote: "Note",
    calloutTip: "Tip",
    calloutImportant: "Important",
    calloutWarning: "Warning",
    calloutCaution: "Caution",
    pastedTitle: "Pasted",
    tabClose: "Close tab",
    splitTitle: "Split view",
    splitAria: "Split view",
    openRight: "Open on the right",
    closeSplit: "Close panel",
    menuTitle: "Menu",
    quickOpenTitle: "Open file",
    winMinTitle: "Minimize",
    winMaxTitle: "Maximize",
    winRestoreTitle: "Restore",
    winCloseTitle: "Close",
    menuAbout: "About Lekto",
    menuFullscreen: "Full screen (F11)",
    readingTitle: "Reading settings",
    readingTheme: "Theme",
    readingZoom: "Zoom",
    readingWidth: "Reading width",
    aboutVersionLabel: "Version",
    aboutDesc: "Minimalist Markdown reader.",
    aboutTech: "Built with Tauri.",
    aboutLicense: "GPL-3.0 licensed",
    aboutClose: "Close",
    emptyRecentsHead: "Continue where you left off",
    emptyHint: "Paste with %s, drag a .md file, or open it with the + button.",
    emptyRecentsHint: "…or paste with %s · drag a .md · open with +",
    featPasteTitle: "Paste and go",
    featPasteDesc: "Copy what the AI shared with you and it renders instantly — nothing saved.",
    featExportTitle: "Export",
    featExportDesc: "Save as HTML or PDF in one click. Tables, code and diagrams included.",
    featSplitTitle: "Split view",
    featSplitDesc: "Compare two documents side by side. Drag a tab to the edge."
  }
};

let currentLang = "es";
try {
  const savedLang = localStorage.getItem("lang");
  if (savedLang === "es" || savedLang === "en") {
    currentLang = savedLang;
  } else {
    const sysLang = navigator.language || navigator.userLanguage || "es";
    currentLang = sysLang.toLowerCase().startsWith("es") ? "es" : "en";
  }
} catch (e) {
  const sysLang = navigator.language || navigator.userLanguage || "es";
  currentLang = sysLang.toLowerCase().startsWith("es") ? "es" : "en";
}

document.documentElement.setAttribute("lang", currentLang);

// 2. Esperar a que el DOM esté listo para interactuar con los elementos
document.addEventListener("DOMContentLoaded", () => {
  const { invoke } = window.__TAURI__.core;
  const APP_VERSION = "0.1.1"; // refleja src-tauri/tauri.conf.json

  // ---- Ajustes de lectura ----
  // El valor vive en la PESTAÑA; :root guarda solo el DEFAULT global que heredan los docs nuevos.
  function defaultZoom() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--content-zoom").trim();
    const z = parseFloat(raw);
    return isNaN(z) ? ZOOM_DEFAULT : z;
  }
  function defaultWidth() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--content-width").trim();
    const w = parseInt(raw, 10);
    return isNaN(w) ? CONTENT_DEFAULT : w;
  }
  // Prefs iniciales de una pestaña nueva: hereda el default global.
  function newTabPrefs() {
    return { zoom: defaultZoom(), width: defaultWidth() };
  }
  // La pestaña activa del panel con FOCO (fuente única para zoom/ancho/exportar).
  function focusedTab() {
    return focusedPane === "right" ? getActiveRightTab() : getActiveTab();
  }
  // Los controles de lectura actúan sobre la pestaña activa del panel con FOCO.
  function readingTargetTab() {
    return focusedTab();
  }
  function getZoom() {
    const t = readingTargetTab();
    return t && typeof t.zoom === "number" ? t.zoom : defaultZoom();
  }
  function setZoom(z) {
    z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));
    const t = readingTargetTab();
    if (t) t.zoom = z;
    document.documentElement.style.setProperty("--content-zoom", z); // nuevo default global
    try { localStorage.setItem("contentZoom", String(z)); } catch (e) {}
    refreshReading();
  }
  function getWidth() {
    const t = readingTargetTab();
    return t && typeof t.width === "number" ? t.width : defaultWidth();
  }
  function setWidth(w, persist) {
    w = Math.min(CONTENT_MAX, Math.max(CONTENT_MIN, w));
    const t = readingTargetTab();
    if (t) t.width = w;
    document.documentElement.style.setProperty("--content-width", w + "px"); // nuevo default global
    if (persist) { try { localStorage.setItem("contentWidth", String(w)); } catch (e) {} }
    refreshReading();
  }

  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  if (zoomInBtn) zoomInBtn.addEventListener("click", () => setZoom(getZoom() + ZOOM_STEP));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => setZoom(getZoom() - ZOOM_STEP));
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom(getZoom() + ZOOM_STEP); }
    else if (e.key === "-") { e.preventDefault(); setZoom(getZoom() - ZOOM_STEP); }
    else if (e.key === "0") { e.preventDefault(); setZoom(ZOOM_DEFAULT); }
  });

  const widthRange = document.getElementById("width-range");
  if (widthRange !== null) {
    widthRange.value = defaultWidth();
    widthRange.addEventListener("input", () => {
      const w = parseInt(widthRange.value, 10);
      if (!isNaN(w)) setWidth(w, false);   // arrastre: aplica, no persiste
    });
    widthRange.addEventListener("change", () => {
      const w = parseInt(widthRange.value, 10);
      if (!isNaN(w)) setWidth(w, true);    // soltó: persiste como default global
    });
  }

  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mainEl = document.querySelector(".main");

  const resizer = document.getElementById("sidebar-resizer");
  const appEl = document.querySelector(".app");

  if (resizer && appEl) {
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      appEl.classList.add("resizing");
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onResize);
      document.addEventListener("mouseup", stopResize);
    });

    function onResize(e) {
      let w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      document.documentElement.style.setProperty("--sidebar-width", w + "px");
    }

    function stopResize() {
      appEl.classList.remove("resizing");
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onResize);
      document.removeEventListener("mouseup", stopResize);
      const cur = getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width").trim();
      const n = parseInt(cur, 10);
      if (!isNaN(n)) {
        try {
          localStorage.setItem("sidebarWidth", String(n));
        } catch (e) {}
      }
    }
  }

  const selectFileBtn = document.getElementById("select-file");
  const themeToggleBtn = document.getElementById("theme-toggle");
  const langToggleBtn = document.getElementById("lang-toggle");
  const errorEl = document.getElementById("error");
  const contentEl = document.getElementById("content");
  const recentsSelect = document.getElementById("recents");
  const exportHtmlBtn = document.getElementById("export-html");
  const exportPdfBtn = document.getElementById("export-pdf");

  const searchToggleBtn = document.getElementById("search-toggle");
  const searchContainer = document.getElementById("search-container");
  const searchInput = document.getElementById("search-input");
  const searchCounter = document.getElementById("search-counter");
  const searchPrevBtn = document.getElementById("search-prev");
  const searchNextBtn = document.getElementById("search-next");
  const searchCloseBtn = document.getElementById("search-close");

  const appMenuBtn = document.getElementById("app-menu-btn");
  const quickOpenBtn = document.getElementById("quick-open-btn");
  const aboutOverlay = document.getElementById("about-overlay");
  const aboutCloseBtn = document.getElementById("about-close");

  document.getElementById("about-version-num").textContent = APP_VERSION;

  let originalHtml = null;
  let currentOpenPath = null;
  let isOpeningDialog = false; // evita abrir múltiples diálogos nativos (Ubuntu abre uno por clic)
  let matches = [];
  let currentIndex = -1;

  // Acordeón con persistencia
  document.querySelectorAll(".side-section-header").forEach(header => {
    const section = header.closest(".side-section");
    if (!section) return;
    const key = "sec-" + section.id + "-collapsed";
    try {
      if (localStorage.getItem(key) === "1") {
        section.classList.add("collapsed");
      }
    } catch (e) {
      console.error("Error al leer de localStorage:", e);
    }
    header.addEventListener("click", () => {
      const isCollapsed = section.classList.toggle("collapsed");
      try {
        localStorage.setItem(key, isCollapsed ? "1" : "0");
      } catch (e) {
        console.error("Error al escribir en localStorage:", e);
      }
    });
  });

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function updateCounter() {
    if (matches.length === 0) {
      searchCounter.textContent = "0/0";
    } else {
      searchCounter.textContent = `${currentIndex + 1}/${matches.length}`;
    }
  }

  function resetSearchState() {
    searchInput.value = "";
    matches = [];
    currentIndex = -1;
    updateCounter();
  }

  function clearSearch() {
    searchInput.value = "";
    restorePaneHtml(focusedPane);
    matches = [];
    currentIndex = -1;
    updateCounter();
  }

  function closeSearch() {
    searchContainer.classList.add("hidden");
    searchToggleBtn.classList.remove("active");
    clearSearch();
  }

  function showSearch() {
    searchContainer.classList.remove("hidden");
    searchToggleBtn.classList.add("active");
    searchInput.focus();
    searchInput.select();
  }

  function toggleSearch() {
    if (searchContainer.classList.contains("hidden")) {
      showSearch();
    } else {
      closeSearch();
    }
  }

  function performSearch() {
    const searchRoot = focusedContentEl();
    if (!searchRoot || paneDocHtml(focusedPane) === null) return;
    restorePaneHtml(focusedPane);
    matches = [];
    currentIndex = -1;

    const query = searchInput.value;
    if (!query) {
      updateCounter();
      return;
    }

    const escaped = escapeRegExp(query);
    const regex = new RegExp(escaped, "gi");

    const walker = document.createTreeWalker(
      searchRoot,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentNode;
          if (parent) {
            const tagName = parent.tagName.toLowerCase();
            if (tagName === "script" || tagName === "style") {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      const text = textNode.nodeValue;
      let match;
      const nodeMatches = [];
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) break;
        nodeMatches.push({
          start: match.index,
          end: regex.lastIndex,
          text: match[0]
        });
      }

      if (nodeMatches.length > 0) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        for (const m of nodeMatches) {
          if (m.start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, m.start)));
          }
          const mark = document.createElement("mark");
          mark.className = "search-match";
          mark.textContent = m.text;
          fragment.appendChild(mark);
          matches.push(mark);
          lastIndex = m.end;
        }
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    }

    if (matches.length > 0) {
      currentIndex = 0;
      matches[currentIndex].classList.add("search-match-active");
      matches[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    updateCounter();
  }

  function navigateSearch(direction) {
    if (matches.length === 0) return;

    if (currentIndex >= 0 && currentIndex < matches.length) {
      matches[currentIndex].classList.remove("search-match-active");
    }

    if (direction === 1) {
      currentIndex = (currentIndex + 1) % matches.length;
    } else if (direction === -1) {
      currentIndex = (currentIndex - 1 + matches.length) % matches.length;
    }

    matches[currentIndex].classList.add("search-match-active");
    matches[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });

    updateCounter();
  }

  const MAX_RECENTS = 10;

  function getRecents() {
    try {
      const stored = localStorage.getItem("recents");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error al leer recents de localStorage:", e);
    }
    return [];
  }

  function saveRecent(path) {
    try {
      let recents = getRecents();
      recents = recents.filter(p => p !== path);
      recents.unshift(path);
      if (recents.length > MAX_RECENTS) {
        recents = recents.slice(0, MAX_RECENTS);
      }
      localStorage.setItem("recents", JSON.stringify(recents));
    } catch (e) {
      console.error("Error al guardar recent en localStorage:", e);
    }
  }

  function getBasename(path) {
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    if (lastSlash === -1) return path;
    return path.substring(lastSlash + 1);
  }

  function removeRecent(path) {
    try {
      const recents = getRecents().filter(p => p !== path);
      localStorage.setItem("recents", JSON.stringify(recents));
    } catch (e) { console.error("Error al quitar reciente:", e); }
    updateRecentsSelect();
  }

  function clearRecents() {
    try { localStorage.removeItem("recents"); } catch (e) { console.error("Error al limpiar recientes:", e); }
    updateRecentsSelect();
  }

  let recentsMenuEl = null;
  function onRecentsMenuKey(e) { if (e.key === "Escape") closeRecentsMenu(); }
  function closeRecentsMenu() {
    if (recentsMenuEl) { recentsMenuEl.remove(); recentsMenuEl = null; }
    document.removeEventListener("click", closeRecentsMenu);
    document.removeEventListener("keydown", onRecentsMenuKey);
    window.removeEventListener("blur", closeRecentsMenu);
  }

  function showRecentsMenu(e, path) {
    e.preventDefault();
    closeRecentsMenu();
    const trans = translations[currentLang] || translations.es;
    const menu = document.createElement("div");
    menu.className = "context-menu";
    const b1 = document.createElement("button");
    b1.type = "button";
    b1.textContent = trans.recentsRemove;
    b1.addEventListener("click", () => { closeRecentsMenu(); removeRecent(path); });
    const b2 = document.createElement("button");
    b2.type = "button";
    b2.textContent = trans.recentsRemoveAll;
    b2.addEventListener("click", () => { closeRecentsMenu(); clearRecents(); });
    menu.appendChild(b1);
    menu.appendChild(b2);
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";
    document.body.appendChild(menu);
    recentsMenuEl = menu;
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 8) + "px";
    if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 8) + "px";
    setTimeout(() => {
      document.addEventListener("click", closeRecentsMenu);
      document.addEventListener("keydown", onRecentsMenuKey);
      window.addEventListener("blur", closeRecentsMenu);
    }, 0);
  }

  function updateRecentsSelect() {
    if (!recentsSelect) return;
    const recents = getRecents();
    const trans = translations[currentLang] || translations.es;
    recentsSelect.textContent = "";

    if (recents.length === 0) {
      const li = document.createElement("li");
      li.className = "recents-empty";
      li.textContent = trans.recentsEmpty;
      recentsSelect.appendChild(li);
      return;
    }

    recents.forEach(path => {
      const li = document.createElement("li");
      li.className = "recents-row";

      const button = document.createElement("button");
      button.className = "recent-item";
      button.title = path;
      button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`;
      const span = document.createElement("span");
      span.textContent = getBasename(path);
      button.appendChild(span);
      button.addEventListener("click", () => { if (paneDragJustDropped) return; openFile(path); });
      button.addEventListener("pointerdown", (e) => startPaneDrag(e, {
        target: button, label: getBasename(path), fromPane: "left", onDrop: () => openRecentInRight(path)
      }));

      const remove = document.createElement("button");
      remove.className = "recent-remove";
      remove.title = trans.recentsRemove;
      remove.setAttribute("aria-label", trans.recentsRemove);
      remove.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      remove.addEventListener("click", (e) => { e.stopPropagation(); removeRecent(path); });

      li.addEventListener("contextmenu", (e) => showRecentsMenu(e, path));

      li.appendChild(button);
      li.appendChild(remove);
      recentsSelect.appendChild(li);
    });

    const actions = document.createElement("li");
    actions.className = "recents-actions";
    const clear = document.createElement("button");
    clear.className = "recents-clear";
    clear.type = "button";
    clear.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>` + trans.recentsClearAll + `</span>`;
    clear.addEventListener("click", clearRecents);
    actions.appendChild(clear);
    recentsSelect.appendChild(actions);
  }

  // Configurar select de recientes
  updateRecentsSelect();

  // Traduce el ReadMdError tipado de Rust a un mensaje legible (discrimina por kind).
  function describeError(err) {
    const trans = translations[currentLang] || translations.es;
    if (!err) {
      return trans.errUnknown;
    }
    switch (err.kind) {
      case "NotFound": return trans.errNotFound;
      case "NotAFile": return trans.errNotAFile;
      case "NotMarkdown":
        return (trans.errNotMarkdown || "No es Markdown (extensión: {ext}).")
          .replace("{ext}", err.extension || trans.none || "ninguna");
      case "TooLarge":
        return (trans.errTooLarge || "Archivo demasiado grande ({size} > {max} bytes).")
          .replace("{size}", err.size !== undefined ? err.size : "")
          .replace("{max}", err.max !== undefined ? err.max : "");
      case "PermissionDenied": return trans.errPermission;
      case "InvalidUtf8": return trans.errInvalidUtf8;
      case "Io":
        return (trans.errIo || "Error de E/S: {msg}")
          .replace("{msg}", err.message || "");
      default: return trans.errUnknown;
    }
  }

  function describeExportError(err) {
    const trans = translations[currentLang] || translations.es;
    if (!err) {
      return trans.errExportUnknown;
    }
    switch (err.kind) {
      case "PermissionDenied": return trans.errExportPermission;
      case "Io":
        return (trans.errExportIo || "Error al guardar: {msg}")
          .replace("{msg}", err.message || "");
      default: return trans.errExportUnknown;
    }
  }

  async function exportHtml() {
    errorEl.textContent = "";
    const trans = translations[currentLang] || translations.es;
    const docHtml = paneDocHtml(focusedPane);
    if (!docHtml) {
      errorEl.textContent = trans.errNoDoc;
      return;
    }

    try {
      let defaultPath = 'documento.html';
      const t = focusedTab();
      const currentPath = t ? t.path : null;
      if (currentPath) {
        const basename = getBasename(currentPath);
        const dotIndex = basename.lastIndexOf('.');
        const nameWithoutExt = dotIndex === -1 ? basename : basename.substring(0, dotIndex);
        defaultPath = nameWithoutExt + '.html';
      }

      const savePath = await window.__TAURI__.dialog.save({
        filters: [{ name: 'HTML', extensions: ['html'] }],
        defaultPath: defaultPath
      });

      if (!savePath) {
        return;
      }

      const htmlContent = `<!DOCTYPE html>
<html lang="${currentLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trans.exportedDocTitle || "Documento Exportado"}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #24292f;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    h1, h2, h3 {
      font-weight: 600;
      border-bottom: 1px solid #d0d7de;
      padding-bottom: 0.3em;
      margin-top: 1.5rem;
      margin-bottom: 1rem;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
      font-size: 85%;
      background-color: rgba(175, 184, 193, 0.2);
      padding: 0.2em 0.4em;
      border-radius: 6px;
    }
    pre {
      background-color: #f6f8fa;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid #d0d7de;
      margin: 1rem 0;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      font-size: 0.9rem;
    }
    ul, ol {
      padding-left: 2rem;
      margin: 1rem 0;
    }
    a {
      color: #0969da;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${cleanDocHtml(docHtml)}
</body>
</html>`;

      await invoke("export_html", { path: savePath, html: htmlContent });
      errorEl.textContent = trans.errExportOk;
    } catch (err) {
      errorEl.textContent = describeExportError(err);
    }
  }

  // ---- Pestañas ----
  let tabs = [];            // { id, path|null, title, html, scrollY }  (path=null => pegado)
  let activeTabId = null;
  let tabSeq = 0;
  let pasteSeq = 0;

  // ---- Panel derecho: grupo de pestañas propio ----
  let rightTabs = [];        // { id, path|null, title, html, scrollY }  — mismas formas que la izquierda
  let activeRightId = null;
  let focusedPane = "left";  // "left" | "right"

  function getActiveTab() { return tabs.find(t => t.id === activeTabId) || null; }

  function saveActiveTabState() {
    const t = getActiveTab();
    if (!t) return;
    if (originalHtml !== null) t.html = originalHtml; // HTML limpio post-pipeline, no el marcado de búsqueda
    t.scrollY = mainEl ? mainEl.scrollTop : 0;
  }

  function armWatcher(path) {
    if (!path) return; // pegado: no re-armar (reload se protege con currentOpenPath null)
    invoke("watch_file", { path }).catch(e => console.error("watch_file:", e));
  }

  function renderTabBar() {
    const bar = document.getElementById("tabbar");
    if (!bar) return;
    const trans = translations[currentLang] || translations.es;
    bar.textContent = "";
    if (tabs.length === 0) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    tabs.forEach(t => {
      const tab = document.createElement("div");
      tab.className = "tab" + (t.id === activeTabId ? " active" : "");
      tab.title = t.path || t.title;
      tab.addEventListener("contextmenu", (e) => showTabMenu(e, t));
      tab.addEventListener("pointerdown", (e) => startPaneDrag(e, {
        target: tab, label: t.title, fromPane: "left", onDrop: () => moveTabToRight(t), ignoreSelector: ".tab-close"
      }));
      tab.addEventListener("dragstart", (e) => e.preventDefault()); // mata el drag nativo de webkit
      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = t.title;
      label.addEventListener("click", () => activateTab(t.id));
      const close = document.createElement("button");
      close.className = "tab-close";
      close.type = "button";
      close.setAttribute("aria-label", trans.tabClose);
      close.title = trans.tabClose;
      close.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      close.addEventListener("click", (e) => { e.stopPropagation(); closeTab(t.id); });
      tab.appendChild(label);
      tab.appendChild(close);
      bar.appendChild(tab);
    });
  }

  function activateTab(id) {
    if (id === activeTabId) return;
    saveActiveTabState();
    const t = tabs.find(x => x.id === id);
    if (!t) return;
    activeTabId = id;
    contentEl.innerHTML = t.html;
    originalHtml = t.html;
    currentOpenPath = t.path;
    resetSearchState();
    buildToc();
    renderTabBar();
    if (mainEl) mainEl.scrollTop = t.scrollY || 0;
    armWatcher(t.path);
    refreshReading();
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const wasActive = (id === activeTabId);
    tabs.splice(idx, 1);
    if (!wasActive) { renderTabBar(); return; }
    if (tabs.length === 0) {
      activeTabId = null;
      renderEmptyState();
      originalHtml = null;
      currentOpenPath = null;
      resetSearchState();
      buildToc();
      renderTabBar();
      refreshReading();
      return;
    }
    const next = tabs[Math.min(idx, tabs.length - 1)];
    activateTab(next.id); // activeTabId aún apunta al id eliminado, así que no sale temprano
  }

  function renderEmptyState() {
    if (!contentEl) return;
    const trans = translations[currentLang] || translations.es;
    const recents = getRecents();
    const KBD = '<kbd>Ctrl</kbd>+<kbd>V</kbd>';
    contentEl.textContent = "";
    const wrap = document.createElement("div");
    wrap.className = "empty-state";

    if (recents.length > 0) {
      const box = document.createElement("div");
      box.className = "empty-recents";
      const head = document.createElement("div");
      head.className = "empty-recents-head";
      head.textContent = trans.emptyRecentsHead;
      box.appendChild(head);
      const grid = document.createElement("div");
      grid.className = "empty-rec-grid";
      recents.forEach(path => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "empty-rec-card";
        card.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        const txt = document.createElement("span");
        txt.className = "empty-rec-text";
        const name = document.createElement("span");
        name.className = "empty-rec-name";
        name.textContent = getBasename(path);
        const p = document.createElement("span");
        p.className = "empty-rec-path";
        p.textContent = path;
        txt.appendChild(name);
        txt.appendChild(p);
        card.appendChild(txt);
        card.addEventListener("click", () => openFile(path));
        grid.appendChild(card);
      });
      box.appendChild(grid);
      const hint = document.createElement("p");
      hint.className = "empty-recents-hint";
      hint.innerHTML = trans.emptyRecentsHint.replace("%s", KBD);
      box.appendChild(hint);
      wrap.appendChild(box);
    } else {
      const logo = document.createElement("div");
      logo.className = "empty-logo";
      logo.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
      const lname = document.createElement("span");
      lname.textContent = "Lekto";
      logo.appendChild(lname);
      wrap.appendChild(logo);

      const hint = document.createElement("p");
      hint.className = "empty-hint";
      hint.innerHTML = trans.emptyHint.replace("%s", KBD);
      wrap.appendChild(hint);

      const feats = document.createElement("div");
      feats.className = "empty-features";
      [
        { icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/>', t: trans.featPasteTitle, d: trans.featPasteDesc },
        { icon: '<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 21h16"/>', t: trans.featExportTitle, d: trans.featExportDesc },
        { icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>', t: trans.featSplitTitle, d: trans.featSplitDesc },
      ].forEach(f => {
        const fe = document.createElement("div");
        fe.className = "empty-feature";
        fe.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + f.icon + '</svg>';
        const h = document.createElement("strong");
        h.className = "empty-feature-title";
        h.textContent = f.t;
        const p = document.createElement("p");
        p.className = "empty-feature-desc";
        p.textContent = f.d;
        fe.appendChild(h);
        fe.appendChild(p);
        feats.appendChild(fe);
      });
      wrap.appendChild(feats);
    }
    contentEl.appendChild(wrap);
  }

  // ---- Split view (panel derecho = grupo de pestañas) ----
  const splitPane = document.getElementById("split-pane");
  const contentRight = document.getElementById("content-right");
  const tabbarRight = document.getElementById("tabbar-right");
  const mainCol = document.querySelector(".main-col");
  const panesEl = document.querySelector(".panes");
  const dropZoneRight = document.getElementById("drop-zone-right");
  const dropZoneLeft = document.getElementById("drop-zone-left");

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
    const changed = (p !== focusedPane);
    // El panel que PIERDE el foco no debe quedar con marcado de búsqueda (INV-2).
    if (changed && matches.length > 0) restorePaneHtml(focusedPane);
    focusedPane = p;
    if (mainCol) mainCol.classList.toggle("pane-focused", p === "left");
    if (splitPane) splitPane.classList.toggle("pane-focused", p === "right" && rightTabs.length > 0);
    // El CSS de @media print necesita saber el foco desde el <html> (no hay :has() confiable en webkit).
    document.documentElement.classList.toggle("focus-right", p === "right" && rightTabs.length > 0);
    if (changed) {
      resetSearchState();   // caja vacía + contador 0/0, ya apuntando al panel nuevo
      buildToc();           // el índice pasa a ser el del documento enfocado
    }
    refreshReading();
  }
  function getActiveRightTab() { return rightTabs.find(t => t.id === activeRightId) || null; }
  function paintRight() {
    const t = getActiveRightTab();
    contentRight.innerHTML = t ? (t.html || "") : "";
    contentRight.querySelectorAll(".copy-btn").forEach(b => b.remove()); // panel sin handlers de copiar
    contentRight.scrollTop = 0;
    refreshReading();
    buildToc();   // si el foco está a la derecha, el índice sigue al documento que se pintó
  }

  // Aplica a un panel las vars de lectura de SU pestaña activa; sin pestaña, hereda :root (INV-5).
  function applyReadingVars(el, t) {
    if (!el) return;
    if (t && typeof t.zoom === "number") el.style.setProperty("--content-zoom", t.zoom);
    else el.style.removeProperty("--content-zoom");
    if (t && typeof t.width === "number") el.style.setProperty("--content-width", t.width + "px");
    else el.style.removeProperty("--content-width");
  }
  // Punto único: repinta las vars de AMBOS paneles y sincroniza el slider con el panel enfocado.
  function refreshReading() {
    applyReadingVars(contentEl, getActiveTab());
    applyReadingVars(contentRight, getActiveRightTab());
    if (widthRange) widthRange.value = getWidth();
  }

  // ---- Documento con FOCO: TOC/fijados/búsqueda se RE-APUNTAN al panel enfocado ----
  function paneContentEl(p) { return p === "right" ? contentRight : contentEl; }
  // El HTML limpio (sin marcado de búsqueda) del documento de un panel.
  // Izquierda: la global originalHtml. Derecha: el html de su pestaña activa.
  function paneDocHtml(p) {
    if (p === "right") { const t = getActiveRightTab(); return t ? (t.html || null) : null; }
    return originalHtml;
  }
  // El HTML del documento sin el cromo de la app: los botones «copiar» viven dentro del
  // html guardado de la pestaña (originalHtml se captura DESPUÉS de addCopyButtons).
  function cleanDocHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.querySelectorAll(".copy-btn").forEach(b => b.remove());
    return tmp.innerHTML;
  }
  function focusedContentEl() { return paneContentEl(focusedPane); }
  // Repinta el documento limpio de un panel (deshace el marcado de búsqueda).
  function restorePaneHtml(p) {
    const el = paneContentEl(p);
    const html = paneDocHtml(p);
    if (!el || html === null) return;
    el.innerHTML = html;
    // El panel derecho no recablea los handlers de copiar (ver paintRight) → INV-4.
    if (p === "right") el.querySelectorAll(".copy-btn").forEach(b => b.remove());
  }

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
      tab.addEventListener("pointerdown", (e) => startPaneDrag(e, {
        target: tab, label: t.title, fromPane: "right", onDrop: () => moveTabToLeft(t), ignoreSelector: ".tab-close"
      }));
      tab.addEventListener("dragstart", (e) => e.preventDefault()); // mata el drag nativo de webkit (mismo fix que la izquierda)
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
      refreshReading();
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
  // Saca una pestaña del panel DERECHO sin cerrarla; devuelve su objeto (o null). Espejo de detachLeftTab.
  function detachRightTab(id) {
    const idx = rightTabs.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const wasActive = (id === activeRightId);
    const [t] = rightTabs.splice(idx, 1);
    if (rightTabs.length === 0) {
      activeRightId = null;
      renderRightTabBar();
      hideSplit();
    } else if (wasActive) {
      activeRightId = rightTabs[Math.min(idx, rightTabs.length - 1)].id;
      paintRight();
      renderRightTabBar();
    } else {
      renderRightTabBar();
    }
    return t;
  }
  // MUDANZA derecha → izquierda (la pestaña desaparece de la derecha; nunca duplicada).
  function moveTabToLeft(tab) {
    if (!tab) return;
    const t = detachRightTab(tab.id);
    if (!t) return;
    tabs.push(t);
    activeTabId = null;           // fuerza que activateTab no salga temprano (mismo patrón que detachLeftTab)
    activateTab(t.id);
    setFocusedPane("left");
  }
  // Botón "Dividir" / ítem del menú ☰: manda la pestaña ACTIVA de la izquierda a la derecha.
  function dividirActiva() {
    const t = getActiveTab();
    if (!t) return;                 // nada abierto que dividir
    moveTabToRight(t);
  }

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
      rightTabs.push({ id, path: file.path, title: getBasename(file.path), html: rendered, scrollY: 0, ...newTabPrefs() });
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

  // ---- Arrastrar pestaña/reciente al borde derecho para dividir (gesto por puntero) ----
  const DRAG_THRESHOLD = 5; // px antes de iniciar el arrastre (preserva el clic normal)
  let paneDrag = null; // { startX, startY, active, ghost, pointerId, target, label, onDrop, fromPane, targetPane }
  let paneDragJustDropped = false; // suprime el click sintético tras un arrastre real

  // side: "left" | "right" — ¿el puntero está sobre esa mitad del área de paneles?
  function isOverPane(clientX, side) {
    if (!panesEl) return false;
    const r = panesEl.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    return side === "right" ? (clientX >= mid && clientX <= r.right)
                             : (clientX >= r.left && clientX < mid);
  }
  function startPaneDrag(e, opts) {
    if (e.button !== 0) return;                                   // solo botón izquierdo
    if (opts.ignoreSelector && e.target.closest(opts.ignoreSelector)) return;
    const fromPane = opts.fromPane || "left";       // default "left": preserva llamadores existentes
    const targetPane = fromPane === "right" ? "left" : "right";
    paneDrag = { startX: e.clientX, startY: e.clientY, active: false, ghost: null,
                 pointerId: e.pointerId, target: opts.target, label: opts.label, onDrop: opts.onDrop,
                 fromPane, targetPane };
    document.addEventListener("pointermove", onPaneDragMove);
    document.addEventListener("pointerup", onPaneDragEnd);
    document.addEventListener("pointercancel", onPaneDragEnd);
    document.addEventListener("keydown", onPaneDragKey);
  }
  function onPaneDragMove(e) {
    if (!paneDrag) return;
    if (!paneDrag.active) {
      if (Math.abs(e.clientX - paneDrag.startX) < DRAG_THRESHOLD &&
          Math.abs(e.clientY - paneDrag.startY) < DRAG_THRESHOLD) return;
      paneDrag.active = true;
      try { paneDrag.target.setPointerCapture(paneDrag.pointerId); } catch (_) { /* sin soporte */ }
      document.body.classList.add("tab-dragging");
      clearTextSelection(); // el pointerdown ya inició una selección; user-select:none la congela, no la borra
      const ghost = document.createElement("div");
      ghost.className = "tab-drag-ghost";
      ghost.textContent = paneDrag.label || "";
      document.body.appendChild(ghost);
      paneDrag.ghost = ghost;
    }
    paneDrag.ghost.style.left = (e.clientX + 12) + "px";
    paneDrag.ghost.style.top = (e.clientY + 12) + "px";
    const overTarget = isOverPane(e.clientX, paneDrag.targetPane);
    if (dropZoneRight) dropZoneRight.classList.toggle("visible", paneDrag.targetPane === "right" && overTarget);
    if (dropZoneLeft) dropZoneLeft.classList.toggle("visible", paneDrag.targetPane === "left" && overTarget);
  }
  function onPaneDragEnd(e) {
    if (!paneDrag) return;
    const wasActive = paneDrag.active;
    const shouldDrop = wasActive && isOverPane(e.clientX, paneDrag.targetPane);
    const onDrop = paneDrag.onDrop;
    cleanupPaneDrag();
    // Hubo arrastre real → suprime el click que el navegador dispara tras el pointerup
    // (si no, arrastrar un reciente a la derecha también lo abriría a la izquierda).
    if (wasActive) { paneDragJustDropped = true; setTimeout(() => { paneDragJustDropped = false; }, 0); }
    if (shouldDrop && typeof onDrop === "function") onDrop();
  }
  function onPaneDragKey(e) { if (e.key === "Escape") cleanupPaneDrag(); }
  // Borra la selección de texto nativa. Solo se llama con el arrastre ACTIVO: un clic simple
  // no debe tocar una selección que el usuario hizo a mano.
  function clearTextSelection() {
    try {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    } catch (_) { /* sin soporte */ }
  }
  function cleanupPaneDrag() {
    if (paneDrag) {
      if (paneDrag.active) clearTextSelection(); // al soltar no queda texto "tomado"
      if (paneDrag.ghost) paneDrag.ghost.remove();
      if (paneDrag.target && paneDrag.pointerId != null) {
        try { paneDrag.target.releasePointerCapture(paneDrag.pointerId); } catch (_) { /* ya liberado */ }
      }
    }
    document.body.classList.remove("tab-dragging");
    if (dropZoneRight) dropZoneRight.classList.remove("visible");
    if (dropZoneLeft) dropZoneLeft.classList.remove("visible");
    document.removeEventListener("pointermove", onPaneDragMove);
    document.removeEventListener("pointerup", onPaneDragEnd);
    document.removeEventListener("pointercancel", onPaneDragEnd);
    document.removeEventListener("keydown", onPaneDragKey);
    paneDrag = null;
  }

  // Menú contextual de pestaña (reusa la clase .context-menu)
  let tabMenuEl = null;
  function onTabMenuKey(e) { if (e.key === "Escape") closeTabMenu(); }
  function closeTabMenu() {
    if (tabMenuEl) { tabMenuEl.remove(); tabMenuEl = null; }
    document.removeEventListener("click", closeTabMenu);
    document.removeEventListener("keydown", onTabMenuKey);
    window.removeEventListener("blur", closeTabMenu);
  }
  function showTabMenu(e, tab) {
    e.preventDefault();
    closeTabMenu();
    const trans = translations[currentLang] || translations.es;
    const menu = document.createElement("div");
    menu.className = "context-menu";
    const b1 = document.createElement("button");
    b1.type = "button";
    b1.textContent = trans.openRight;
    b1.addEventListener("click", () => { closeTabMenu(); moveTabToRight(tab); });
    const b2 = document.createElement("button");
    b2.type = "button";
    b2.textContent = trans.tabClose;
    b2.addEventListener("click", () => { closeTabMenu(); closeTab(tab.id); });
    menu.appendChild(b1);
    menu.appendChild(b2);
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";
    document.body.appendChild(menu);
    tabMenuEl = menu;
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 8) + "px";
    if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 8) + "px";
    setTimeout(() => {
      document.addEventListener("click", closeTabMenu);
      document.addEventListener("keydown", onTabMenuKey);
      window.addEventListener("blur", closeTabMenu);
    }, 0);
  }

  async function openFile(path) {
    path = (path || "").trim();
    errorEl.textContent = "";
    const trans = translations[currentLang] || translations.es;
    if (!path) { errorEl.textContent = trans.errNoPath; return; }
    try {
      const file = await invoke("read_markdown_file", { path });
      const existing = tabs.find(t => t.path === file.path);
      if (existing) { activateTab(existing.id); return; } // ya abierto: activar, no duplicar

      saveActiveTabState();
      contentEl.textContent = "";
      originalHtml = null;
      resetSearchState();
      currentOpenPath = file.path;
      saveRecent(path);
      updateRecentsSelect();

      const html = await invoke("render_markdown", { content: file.content });
      contentEl.innerHTML = html;
      highlightCode();
      await renderMermaid();
      await renderMath();
      addCopyButtons();
      renderCallouts();
      buildToc();
      originalHtml = contentEl.innerHTML; // ya resaltado + diagramas

      const id = "tab-" + (++tabSeq);
      tabs.push({ id, path: file.path, title: getBasename(file.path), html: originalHtml, scrollY: 0, ...newTabPrefs() });
      activeTabId = id;
      renderTabBar();
      setFocusedPane("left");
      if (mainEl) mainEl.scrollTop = 0;

      armWatcher(file.path);
    } catch (err) {
      errorEl.textContent = describeError(err);
    }
  }

  async function showPastedMarkdown(text) {
    if (!text || !text.trim()) return;
    errorEl.textContent = "";
    const trans = translations[currentLang] || translations.es;
    saveActiveTabState();
    resetSearchState();
    currentOpenPath = null; // contenido pegado: no es un archivo (no recientes, no watcher)
    try {
      const html = await invoke("render_markdown", { content: text });
      contentEl.innerHTML = html;
      highlightCode();
      await renderMermaid();
      await renderMath();
      addCopyButtons();
      renderCallouts();
      buildToc();
      originalHtml = contentEl.innerHTML;
      const id = "tab-" + (++tabSeq);
      tabs.push({ id, path: null, title: (trans.pastedTitle || "Pegado") + " " + (++pasteSeq), html: originalHtml, scrollY: 0, ...newTabPrefs() });
      activeTabId = id;
      renderTabBar();
      setFocusedPane("left");
      if (mainEl) mainEl.scrollTop = 0;
    } catch (err) {
      errorEl.textContent = describeError(err);
    }
  }

  function looksLikeMarkdown(t) {
    return /(^|\n)```/.test(t)
      || /(^|\n)#{1,6}\s/.test(t)
      || /(^|\n)\s*[-*+]\s+\S/.test(t)
      || /(^|\n)\s*\d+\.\s+\S/.test(t)
      || /(^|\n)>\s/.test(t)
      || /(^|\n)\|.*\|.*\|/.test(t)
      || /\[[^\]]+\]\([^)]+\)/.test(t);
  }
  function looksLikeCode(t) {
    const lines = t.split("\n").filter(l => l.trim().length > 0);
    if (lines.length === 0) return false;
    let codey = 0;
    for (const l of lines) {
      if (/[;{}]\s*$/.test(l)) { codey++; continue; }
      if (/^\s{2,}\S/.test(l)) { codey++; continue; }
      if (/\b(function|const|let|var|import|export|from|class|def|return|public|private|void|int|async|await|if|for|while|switch)\b/.test(l)) { codey++; continue; }
      if (/[=(){}\[\]<>]/.test(l)) { codey++; continue; }
    }
    return (codey / lines.length) >= 0.6;
  }
  function wrapAsCode(t) {
    let maxTicks = 0;
    const m = t.match(/`+/g);
    if (m) for (const s of m) if (s.length > maxTicks) maxTicks = s.length;
    const fence = "`".repeat(Math.max(3, maxTicks + 1));
    return fence + "\n" + t.replace(/\n+$/, "") + "\n" + fence;
  }
  function pasteSmart(text, forceCode) {
    if (!text || !text.trim()) return;
    if (forceCode || (!looksLikeMarkdown(text) && looksLikeCode(text))) {
      showPastedMarkdown(wrapAsCode(text));
    } else {
      showPastedMarkdown(text);
    }
  }
  let forceCodePaste = false; // lo pone el keydown de Ctrl/Cmd+Shift+V, lo consume el evento paste

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "V" || e.key === "v")) {
      forceCodePaste = true;
    }
  });
  document.addEventListener("paste", (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) { forceCodePaste = false; return; }
    const text = (e.clipboardData || window.clipboardData)?.getData("text/plain");
    const force = forceCodePaste;
    forceCodePaste = false;
    if (text && text.trim()) {
      e.preventDefault();
      pasteSmart(text, force);
    }
  });

  // Resalta los bloques de código del documento con highlight.js (bundleado localmente).
  // Opera sobre el HTML YA saneado en Rust; hljs escapa el contenido (no reintroduce HTML).
  function highlightCode(root = contentEl) {
    if (typeof hljs === "undefined") return;
    root.querySelectorAll("pre code").forEach((block) => {
      if (block.classList.contains("language-mermaid")) return; // los renderiza Mermaid, no hljs
      try { hljs.highlightElement(block); } catch (e) { /* lenguaje desconocido: se deja sin resaltar */ }
    });
  }

  // --- Mermaid (diagramas) ---
  // Lazy: el bundle (~3.5 MB) solo se carga si el documento tiene bloques ```mermaid.
  // El contenido ya viene saneado en Rust; mermaid se inicializa con securityLevel "strict".
  let mermaidLoadPromise = null;
  let mermaidIdCounter = 0;
  function loadMermaid() {
    if (mermaidLoadPromise) return mermaidLoadPromise;
    mermaidLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/mermaid.min.js";
      s.onload = () => resolve(window.mermaid);
      s.onerror = () => reject(new Error("no se pudo cargar mermaid"));
      document.head.appendChild(s);
    });
    return mermaidLoadPromise;
  }
  function initMermaid(mermaid) {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    // useMaxWidth:false => el SVG conserva su tamaño natural (no se aplasta para caber);
    // el contenedor .mermaid-diagram aporta scroll horizontal para los diagramas anchos.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "default",
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      class: { useMaxWidth: false },
      state: { useMaxWidth: false },
      er: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
      journey: { useMaxWidth: false }
    });
  }
  function applyMermaidCspFix(wrapper, id) {
    const styleEl = wrapper.querySelector("svg style");
    if (styleEl) {
      const cssText = styleEl.textContent;
      if (cssText) {
        if (window.CSSStyleSheet && document.adoptedStyleSheets) {
          document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
            (sheet) => sheet._mmdId !== id
          );
          const activeIds = new Set(
            Array.from(document.querySelectorAll(".mermaid-diagram svg")).map((svg) => svg.id)
          );
          document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => {
            if (sheet._mmdId) {
              return activeIds.has(sheet._mmdId);
            }
            return true;
          });
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(cssText);
          sheet._mmdId = id;
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        } else {
          let style = document.getElementById("fallback-style-" + id);
          if (!style) {
            style = document.createElement("style");
            style.id = "fallback-style-" + id;
            document.head.appendChild(style);
          }
          while (style.sheet.cssRules.length > 0) {
            style.sheet.deleteRule(0);
          }
          const rules = cssText.split("}");
          for (let rule of rules) {
            rule = rule.trim();
            if (rule) {
              try {
                style.sheet.insertRule(rule + "}", style.sheet.cssRules.length);
              } catch (e) {
                // ignore invalid rules
              }
            }
          }
          const activeIds = new Set(
            Array.from(document.querySelectorAll(".mermaid-diagram svg")).map((svg) => svg.id)
          );
          document.querySelectorAll("style[id^='fallback-style-']").forEach((styleEl) => {
            const styleId = styleEl.id.replace("fallback-style-", "");
            if (!activeIds.has(styleId)) {
              styleEl.remove();
            }
          });
        }
      }
    }
    wrapper.querySelectorAll("[style]").forEach((el) => {
      const styleAttr = el.getAttribute("style");
      if (styleAttr) {
        const declarations = styleAttr.split(";");
        for (let decl of declarations) {
          const colonIndex = decl.indexOf(":");
          if (colonIndex !== -1) {
            const prop = decl.slice(0, colonIndex).trim();
            const val = decl.slice(colonIndex + 1).trim();
            if (prop && val) {
              el.style.setProperty(prop, val);
            }
          }
        }
      }
    });
  }

  // Convierte cada bloque ```mermaid en un SVG. Async: espera la carga lazy del bundle.
  async function renderMermaid(root = contentEl) {
    const blocks = root.querySelectorAll("code.language-mermaid");
    if (blocks.length === 0) return;
    let mermaid;
    try { mermaid = await loadMermaid(); } catch (e) { return; } // sin bundle: se deja como código
    if (!mermaid) return;
    initMermaid(mermaid);
    for (const code of blocks) {
      const pre = code.closest("pre") || code;
      const src = code.textContent;
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-diagram";
      wrapper.setAttribute("data-mermaid-src", src);
      try {
        const { svg } = await mermaid.render("mmd-" + (mermaidIdCounter++), src);
        wrapper.innerHTML = svg;
        const svgEl = wrapper.querySelector("svg");
        if (svgEl) {
          applyMermaidCspFix(wrapper, svgEl.id);
        }
      } catch (e) {
        wrapper.classList.add("mermaid-error");
        wrapper.textContent = "⚠ " + (translations[currentLang].mermaidError || "Error en el diagrama Mermaid") +
          ": " + (e && e.message ? e.message : e);
      }
      pre.replaceWith(wrapper);
    }
  }
  // Re-renderiza los diagramas ya pintados con el tema actual (al alternar claro/oscuro).
  async function rerenderMermaidForTheme() {
    const diagrams = contentEl.querySelectorAll(".mermaid-diagram[data-mermaid-src]");
    if (diagrams.length === 0) return;
    let mermaid;
    try { mermaid = await loadMermaid(); } catch (e) { return; }
    if (!mermaid) return;
    initMermaid(mermaid);
    for (const wrapper of diagrams) {
      const src = wrapper.getAttribute("data-mermaid-src");
      try {
        const { svg } = await mermaid.render("mmd-" + (mermaidIdCounter++), src);
        wrapper.innerHTML = svg;
        const svgEl = wrapper.querySelector("svg");
        if (svgEl) {
          applyMermaidCspFix(wrapper, svgEl.id);
        }
        wrapper.classList.remove("mermaid-error");
      } catch (e) { /* mantiene el render previo */ }
    }
    if (originalHtml !== null) originalHtml = contentEl.innerHTML; // que la búsqueda restaure con el tema nuevo
  }

  // --- KaTeX (matemáticas/LaTeX) ---
  let katexLoadPromise = null;
  function loadKatex() {
    if (katexLoadPromise) return katexLoadPromise;
    katexLoadPromise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "vendor/katex/katex.min.css";
      link.onerror = () => reject(new Error("no se pudo cargar katex.min.css"));
      document.head.appendChild(link);

      const s1 = document.createElement("script");
      s1.src = "vendor/katex/katex.min.js";
      s1.onerror = () => reject(new Error("no se pudo cargar katex.min.js"));
      s1.onload = () => {
        const s2 = document.createElement("script");
        s2.src = "vendor/katex/contrib/auto-render.min.js";
        s2.onerror = () => reject(new Error("no se pudo cargar auto-render.min.js"));
        s2.onload = () => {
          resolve();
        };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
    return katexLoadPromise;
  }

  async function renderMath(root = contentEl) {
    const t = root.textContent || "";
    if (!t.includes("$") && !t.includes("\\(") && !t.includes("\\[")) return;
    try {
      await loadKatex();
    } catch (e) {
      return;
    }
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(root, {
      throwOnError: false,
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "\\[", right: "\\]", display: true},
        {left: "\\(", right: "\\)", display: false},
        {left: "$", right: "$", display: false}
      ]
    });
  }

  async function copyText(txt) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
        return true;
      }
    } catch (e) {}
    try {
      const textarea = document.createElement("textarea");
      textarea.value = txt;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return !!ok;
    } catch (err) {
      return false;
    }
  }

  const CALLOUT_TYPES = {
    NOTE:      { key:"calloutNote",      svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' },
    TIP:       { key:"calloutTip",       svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>' },
    IMPORTANT: { key:"calloutImportant", svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    WARNING:   { key:"calloutWarning",   svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>' },
    CAUTION:   { key:"calloutCaution",   svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.31 2H8.69L2 8.69v6.62L8.69 22h6.62L22 15.31V8.69z"/></svg>' }
  };

  function renderCallouts(root = contentEl) {
    root.querySelectorAll("blockquote").forEach(bq => {
      if (bq.classList.contains("callout")) return; // ya procesado
      const p = bq.querySelector(":scope > p");
      if (!p) return;
      const m = p.textContent.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
      if (!m) return;
      const type = m[1].toUpperCase();
      const info = CALLOUT_TYPES[type];
      if (!info) return;
      p.innerHTML = p.innerHTML.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\s*\/?>)?\s*/i, "");
      if (!p.textContent.trim() && p.children.length === 0) p.remove();
      bq.classList.add("callout", "callout-" + type.toLowerCase());
      const title = document.createElement("div");
      title.className = "callout-title";
      const label = (translations[currentLang] && translations[currentLang][info.key]) || type;
      title.innerHTML = info.svg + '<span data-i18n="' + info.key + '">' + label + '</span>';
      bq.insertBefore(title, bq.firstChild);
    });
  }

  function addCopyButtons() {
    contentEl.querySelectorAll("pre").forEach(pre => {
      if (pre.querySelector(".copy-btn")) return;
      const code = pre.querySelector("code");
      if (!code) return;

      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      
      const trans = translations[currentLang] || translations.es;
      btn.title = trans.copyTitle || "Copiar código";
      btn.setAttribute("aria-label", trans.copyAria || "Copiar código");
      btn.setAttribute("data-i18n-title", "copyTitle");
      btn.setAttribute("data-i18n-aria", "copyAria");
      
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
      
      pre.appendChild(btn);

      btn.addEventListener("click", async () => {
        const txt = code.textContent;
        const ok = await copyText(txt);
        if (ok) {
          if (btn._timeoutId) {
            clearTimeout(btn._timeoutId);
          } else {
            btn._originalHtml = btn.innerHTML;
          }
          const activeTrans = translations[currentLang] || translations.es;
          btn.innerHTML = "✓ " + (activeTrans.copied || "Copiado");
          btn.classList.add("copied");
          btn._timeoutId = setTimeout(() => {
            btn.innerHTML = btn._originalHtml;
            btn.classList.remove("copied");
            btn._timeoutId = null;
            btn._originalHtml = null;
          }, 1500);
        }
      });
    });
  }

  // Helpers de persistencia (por documento; identidad = texto del encabezado)
  function pinsKey() {
    return currentOpenPath ? ("pins:" + currentOpenPath) : null;
  }

  function getPins() {
    const k = pinsKey();
    if (!k) return [];
    try {
      const s = localStorage.getItem(k);
      const a = s ? JSON.parse(s) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function savePins(arr) {
    const k = pinsKey();
    if (!k) return;
    try {
      localStorage.setItem(k, JSON.stringify(arr));
    } catch (e) {}
  }

  function togglePin(text) {
    const arr = getPins();
    const i = arr.indexOf(text);
    if (i === -1) {
      arr.push(text);
    } else {
      arr.splice(i, 1);
    }
    savePins(arr);
    buildToc();
  }

  function findHeadingByText(text) {
    const root = focusedContentEl();
    if (!root) return null;
    const heads = root.querySelectorAll("h1, h2, h3");
    for (const h of heads) {
      if (h.textContent === text) {
        return h;
      }
    }
    return null;
  }

  // Genera el Índice (TOC) a partir de los encabezados h1, h2, h3 del documento.
  function buildToc() {
    const toc = document.getElementById("toc");
    if (!toc) return;
    toc.textContent = "";
    const tocRoot = focusedContentEl();
    if (!tocRoot) return;
    const heads = tocRoot.querySelectorAll("h1, h2, h3");
    const trans = translations[currentLang] || translations.es;

    if (heads.length === 0) {
      const li = document.createElement("li");
      li.className = "toc-empty";
      li.textContent = trans.tocEmpty;
      toc.appendChild(li);
    } else {
      heads.forEach((h, i) => {
        const id = h.id || ("h-" + i);
        h.id = id;
        const li = document.createElement("li");
        li.className = "toc-row";

        const button = document.createElement("button");
        button.className = "toc-item toc-" + h.tagName.toLowerCase();
        button.textContent = h.textContent;
        button.title = h.textContent;
        button.addEventListener("click", () => {
          const el = tocRoot.querySelector("#" + CSS.escape(id));
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });

        const pin = document.createElement("button");
        pin.className = "toc-pin";
        pin.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;
        pin.title = trans.pinAria;
        pin.setAttribute("aria-label", trans.pinAria);

        if (getPins().includes(h.textContent)) {
          pin.classList.add("active");
        }

        pin.addEventListener("click", (e) => {
          e.stopPropagation();
          togglePin(h.textContent);
        });

        li.appendChild(button);
        li.appendChild(pin);
        toc.appendChild(li);
      });
    }
    buildPinned();
  }

  // Genera la lista de elementos fijados (Pinned).
  function buildPinned() {
    const ul = document.getElementById("pinned");
    if (!ul) return;
    ul.textContent = "";
    const pins = getPins();
    const trans = translations[currentLang] || translations.es;

    if (pins.length === 0) {
      const li = document.createElement("li");
      li.className = "pinned-empty";
      li.textContent = trans.pinnedEmpty;
      ul.appendChild(li);
    } else {
      pins.forEach(text => {
        const li = document.createElement("li");
        li.className = "pinned-row";

        const itemBtn = document.createElement("button");
        itemBtn.className = "pinned-item";
        itemBtn.textContent = text;
        itemBtn.title = text;
        itemBtn.addEventListener("click", () => {
          const el = findHeadingByText(text);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });

        const removeBtn = document.createElement("button");
        removeBtn.className = "pinned-remove";
        removeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
        removeBtn.title = trans.unpinAria;
        removeBtn.setAttribute("aria-label", trans.unpinAria);
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          togglePin(text);
        });

        li.appendChild(itemBtn);
        li.appendChild(removeBtn);
        ul.appendChild(li);
      });
    }
  }

  // Recarga el documento actual sin tocar recientes ni perder la posición de scroll.
  async function reloadCurrentFile() {
    if (!currentOpenPath) return;
    try {
      const scrollY = mainEl ? mainEl.scrollTop : 0;
      const file = await invoke("read_markdown_file", { path: currentOpenPath });
      const html = await invoke("render_markdown", { content: file.content });
      contentEl.innerHTML = html;
      highlightCode();
      await renderMermaid();
      await renderMath();
      addCopyButtons();
      renderCallouts();
      buildToc();
      originalHtml = contentEl.innerHTML;
      const t = getActiveTab(); if (t) t.html = originalHtml; // refleja el cambio en la pestaña activa
      resetSearchState();
      if (mainEl) mainEl.scrollTop = scrollY;
    } catch (err) {
      errorEl.textContent = describeError(err);
    }
  }

  async function selectAndOpenFile() {
    if (isOpeningDialog) return; // ya hay un diálogo abierto: no apilar ventanas nativas
    isOpeningDialog = true;
    if (selectFileBtn) selectFileBtn.disabled = true;
    try {
      const path = await window.__TAURI__.dialog.open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
      });
      if (path) {
        openFile(path);
      }
    } catch (err) {
      const trans = translations[currentLang] || translations.es;
      errorEl.textContent = trans.errDialog + " " + err;
    } finally {
      isOpeningDialog = false;
      if (selectFileBtn) selectFileBtn.disabled = false;
    }
  }

  exportHtmlBtn.addEventListener("click", exportHtml);
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      window.print();
    });
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const collapsed = document.documentElement.classList.toggle("sidebar-collapsed");
      try { localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0"); } catch (e) {}
    });
  }

  const splitToggleBtn = document.getElementById("split-toggle");
  if (splitToggleBtn) splitToggleBtn.addEventListener("click", dividirActiva);

  if (mainCol) mainCol.addEventListener("mousedown", () => setFocusedPane("left"));
  if (splitPane) splitPane.addEventListener("mousedown", () => { if (rightTabs.length) setFocusedPane("right"); });

  // Quick Open Btn listener
  if (quickOpenBtn) {
    quickOpenBtn.addEventListener("click", selectAndOpenFile);
  }

  // Modal logic
  function openAbout() {
    closeAppMenu();
    if (aboutOverlay) aboutOverlay.classList.remove("hidden");
  }
  function closeAbout() {
    if (aboutOverlay) aboutOverlay.classList.add("hidden");
  }
  if (aboutCloseBtn) {
    aboutCloseBtn.addEventListener("click", closeAbout);
  }
  if (aboutOverlay) {
    aboutOverlay.addEventListener("click", (e) => {
      if (e.target === aboutOverlay) closeAbout();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && aboutOverlay && !aboutOverlay.classList.contains("hidden")) {
      closeAbout();
    }
  });

  // App Menu (☰) logic
  let appMenuEl = null;
  function onAppMenuKey(e) {
    if (e.key === "Escape") closeAppMenu();
  }
  function closeAppMenu() {
    if (appMenuEl) {
      appMenuEl.remove();
      appMenuEl = null;
    }
    document.removeEventListener("click", closeAppMenu);
    document.removeEventListener("keydown", onAppMenuKey);
    window.removeEventListener("blur", closeAppMenu);
  }

  const htmlEl = document.documentElement;

  function applyFullscreenUI(on) {
    if (on) {
      htmlEl.classList.add("fullscreen");
      htmlEl.classList.remove("topbar-peek");
    } else {
      htmlEl.classList.remove("fullscreen");
      htmlEl.classList.remove("topbar-peek");
    }
    // El botón win-max refleja el estado: en fullscreen su rol es "restaurar".
    const winMaxBtn = document.getElementById("win-max");
    if (winMaxBtn) {
      const trans = translations[currentLang] || translations.es;
      const label = on ? trans.winRestoreTitle : trans.winMaxTitle;
      winMaxBtn.title = label;
      winMaxBtn.setAttribute("aria-label", label);
    }
  }

  async function toggleFullscreen() {
    if (!(window.__TAURI__ && window.__TAURI__.window)) return;
    try {
      const w = window.__TAURI__.window.getCurrentWindow();
      const isFs = await w.isFullscreen();
      await w.setFullscreen(!isFs);
      const nowFs = await w.isFullscreen();
      applyFullscreenUI(nowFs);
    } catch (e) {
      console.error("toggleFullscreen:", e);
    }
  }

  const fsRevealZone = document.getElementById("fs-reveal-zone");
  if (fsRevealZone) {
    fsRevealZone.addEventListener("mouseenter", () => {
      if (htmlEl.classList.contains("fullscreen")) htmlEl.classList.add("topbar-peek");
    });
  }
  const topbarEl = document.querySelector(".topbar");
  if (topbarEl) {
    topbarEl.addEventListener("mouseleave", () => {
      if (htmlEl.classList.contains("fullscreen")) htmlEl.classList.remove("topbar-peek");
    });
  }

  async function refreshMaximizedUI(win) {
    try { htmlEl.classList.toggle("maximized", await win.isMaximized()); } catch (_) {}
  }

  if (window.__TAURI__ && window.__TAURI__.window) {
    try {
      const _fsWin = window.__TAURI__.window.getCurrentWindow();
      _fsWin.onResized(async () => {
        try { applyFullscreenUI(await _fsWin.isFullscreen()); } catch (_) {}
        refreshMaximizedUI(_fsWin);
      });
      refreshMaximizedUI(_fsWin); // estado inicial (por si arranca maximizada)
    } catch (_) {}
  }

  // --- Barra de título propia: controles + resize ---
  if (window.__TAURI__ && window.__TAURI__.window) {
    const appWin = window.__TAURI__.window.getCurrentWindow();
    const bindWinCtl = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => {
        try { fn(); } catch (e) { console.error(id, e); }
      });
    };
    bindWinCtl("win-min", () => appWin.minimize());
    bindWinCtl("win-max", async () => {
      // En fullscreen, "maximizar" es una operación inválida (deja la ventana en un
      // estado inconsistente → fondo negro). Ahí el botón actúa como "restaurar":
      // sale de fullscreen. Fuera de fullscreen, alterna maximizado como siempre.
      try {
        if (await appWin.isFullscreen()) {
          await toggleFullscreen();
        } else {
          await appWin.toggleMaximize();
        }
      } catch (e) { console.error("win-max", e); }
    });
    bindWinCtl("win-close", () => appWin.close());
    document.querySelectorAll(".resize-grip").forEach((g) => {
      g.addEventListener("mousedown", (e) => {
        e.preventDefault();
        try { appWin.startResizeDragging(g.dataset.dir); } catch (err) { console.error("resize", err); }
      });
    });
  }

  function showAppMenu() {
    closeAppMenu();
    const trans = translations[currentLang] || translations.es;
    const overflowInMenu = exportHtmlBtn && getComputedStyle(exportHtmlBtn).display === "none";
    const menu = document.createElement("div");
    menu.className = "context-menu";
    
    const b1 = document.createElement("button");
    b1.type = "button";
    b1.textContent = trans.selectFile;
    b1.addEventListener("click", () => {
      closeAppMenu();
      selectAndOpenFile();
    });
    
    const bFs = document.createElement("button");
    bFs.type = "button";
    bFs.textContent = trans.menuFullscreen;
    bFs.addEventListener("click", () => {
      closeAppMenu();
      toggleFullscreen();
    });
    
    const bLang = document.createElement("button");
    bLang.type = "button";
    bLang.textContent = currentLang === "es" ? "English" : "Español";
    bLang.addEventListener("click", () => {
      closeAppMenu();
      const nextLang = currentLang === "es" ? "en" : "es";
      setLanguage(nextLang);
      try { localStorage.setItem("lang", nextLang); } catch (e) { /* localStorage no disponible */ }
    });

    const b2 = document.createElement("button");
    b2.type = "button";
    b2.textContent = trans.menuAbout;
    b2.addEventListener("click", () => {
      openAbout();
    });
    
    menu.appendChild(b1);
    if (overflowInMenu) {
      const bExportHtml = document.createElement("button");
      bExportHtml.type = "button";
      bExportHtml.textContent = trans.exportHtml;
      bExportHtml.addEventListener("click", () => { closeAppMenu(); exportHtml(); });

      const bExportPdf = document.createElement("button");
      bExportPdf.type = "button";
      bExportPdf.textContent = trans.exportPdf;
      bExportPdf.addEventListener("click", () => { closeAppMenu(); window.print(); });

      const bSplit = document.createElement("button");
      bSplit.type = "button";
      bSplit.textContent = trans.splitTitle;
      bSplit.addEventListener("click", () => { closeAppMenu(); dividirActiva(); });

      menu.appendChild(bExportHtml);
      menu.appendChild(bExportPdf);
      menu.appendChild(bSplit);
    }
    menu.appendChild(bFs);
    menu.appendChild(bLang);
    menu.appendChild(b2);
    
    const r = appMenuBtn.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 4) + "px";
    
    document.body.appendChild(menu);
    appMenuEl = menu;
    
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - menuRect.width - 8) + "px";
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - menuRect.height - 8) + "px";
    }
    
    setTimeout(() => {
      document.addEventListener("click", closeAppMenu);
      document.addEventListener("keydown", onAppMenuKey);
      window.addEventListener("blur", closeAppMenu);
    }, 0);
  }

  if (appMenuBtn) {
    appMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (appMenuEl) {
        closeAppMenu();
      } else {
        showAppMenu();
      }
    });
  }

  // --- Popover "Aa" de ajustes de lectura ---
  const readingBtn = document.getElementById("reading-btn");
  const readingPopover = document.getElementById("reading-popover");
  function onReadingOutside(e) {
    if (!readingPopover) return;
    if (readingPopover.contains(e.target)) return;
    if (readingBtn && readingBtn.contains(e.target)) return;
    closeReadingPopover();
  }
  function onReadingKey(e) { if (e.key === "Escape") closeReadingPopover(); }
  function closeReadingPopover() {
    if (!readingPopover) return;
    readingPopover.classList.add("hidden");
    document.removeEventListener("click", onReadingOutside);
    document.removeEventListener("keydown", onReadingKey);
  }
  function openReadingPopover() {
    if (!readingBtn || !readingPopover) return;
    readingPopover.classList.remove("hidden");
    const r = readingBtn.getBoundingClientRect();
    const pr = readingPopover.getBoundingClientRect();
    let left = r.right - pr.width;
    if (left < 8) left = 8;
    readingPopover.style.top = (r.bottom + 4) + "px";
    readingPopover.style.left = left + "px";
    setTimeout(() => {
      document.addEventListener("click", onReadingOutside);
      document.addEventListener("keydown", onReadingKey);
    }, 0);
  }
  if (readingBtn && readingPopover) {
    readingBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (readingPopover.classList.contains("hidden")) openReadingPopover();
      else closeReadingPopover();
    });
  }

  // Ctrl/Cmd + O shortcut
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      selectAndOpenFile();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "F11") { e.preventDefault(); toggleFullscreen(); }
  });

  // Suscribir al evento drag-drop de Tauri v2
  if (window.__TAURI__ && window.__TAURI__.webview) {
    try {
      window.__TAURI__.webview.getCurrentWebview().onDragDropEvent((event) => {
        const { type, paths } = event.payload;
        if (type === "enter" || type === "over") {
          mainEl.classList.add("drag-over");
        } else if (type === "leave" || type === "drop") {
          mainEl.classList.remove("drag-over");
          if (type === "drop" && paths && paths.length > 0) {
            openFile(paths[0]);
          }
        }
      });
    } catch (err) {
      console.error("Error al registrar onDragDropEvent:", err);
    }
  }

  // Apertura desde el sistema operativo: "Abrir con Lekto" o `lekto doc.md`.
  // Cada ruta entra como una pestaña más; el foco queda en la primera, que es la
  // que el usuario pidió cuando selecciona varios archivos a la vez.
  async function abrirRutasDelSistema(paths) {
    if (!Array.isArray(paths) || paths.length === 0) return;
    const antes = tabs.length;
    for (const ruta of paths) {
      // Secuencial a propósito: openFile toca el DOM y el estado de pestañas.
      await openFile(ruta);
    }
    if (tabs.length > antes) activateTab(tabs[antes].id);
  }

  // Arranque en frío: el backend guardó las rutas de argv porque el webview no
  // existía todavía. Se piden ahora, ya listos para atenderlas.
  if (window.__TAURI__) {
    invoke("take_pending_files")
      .then(abrirRutasDelSistema)
      .catch(err => console.error("take_pending_files:", err));
  }

  // Recarga automática: el backend emite "file-changed" cuando el .md abierto cambia en disco.
  if (window.__TAURI__ && window.__TAURI__.event) {
    try {
      window.__TAURI__.event.listen("file-changed", () => {
        reloadCurrentFile();
      });
      // Segundo lanzamiento con la app viva: el plugin de instancia única
      // reenvía su argv en vez de abrir otra ventana.
      window.__TAURI__.event.listen("files-opened", (event) => {
        abrirRutasDelSistema(event.payload);
      });
    } catch (err) {
      console.error("Error al registrar listener file-changed:", err);
    }
  }

  searchToggleBtn.addEventListener("click", () => {
    toggleSearch();
  });

  searchCloseBtn.addEventListener("click", closeSearch);

  searchPrevBtn.addEventListener("click", () => navigateSearch(-1));
  searchNextBtn.addEventListener("click", () => navigateSearch(1));

  searchInput.addEventListener("input", performSearch);

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        navigateSearch(-1);
      } else {
        navigateSearch(1);
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggleSearch();
    } else if (e.key === "Escape") {
      if (!searchContainer.classList.contains("hidden")) {
        e.preventDefault();
        closeSearch();
      }
    }
  });

  themeToggleBtn.addEventListener("click", () => {
    if (currentTheme === "dark") {
      currentTheme = "light";
      document.documentElement.removeAttribute("data-theme");
    } else {
      currentTheme = "dark";
      document.documentElement.setAttribute("data-theme", "dark");
    }
    
    try {
      localStorage.setItem("theme", currentTheme);
    } catch (e) {
      // Ignorar si localStorage no está disponible
    }
    rerenderMermaidForTheme();
  });

  function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.setAttribute("lang", lang);
    
    // Update data-i18n (text content)
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const trans = translations[lang] || translations.es;
      if (trans[key]) {
        el.textContent = trans[key];
      }
    });

    // Update data-i18n-placeholder (placeholder)
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      const trans = translations[lang] || translations.es;
      if (trans[key]) {
        el.setAttribute("placeholder", trans[key]);
      }
    });

    // Update data-i18n-aria (aria-label)
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      const key = el.getAttribute("data-i18n-aria");
      const trans = translations[lang] || translations.es;
      if (trans[key]) {
        el.setAttribute("aria-label", trans[key]);
      }
    });

    // Update data-i18n-title (title)
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      const trans = translations[lang] || translations.es;
      if (trans[key]) {
        el.setAttribute("title", trans[key]);
      }
    });

    // Language button text content update
    if (langToggleBtn) {
      langToggleBtn.textContent = lang.toUpperCase();
    }

    // Update recents dropdown
    updateRecentsSelect();

    // Rebuild TOC to update empty state translation if needed
    if (tabs.length === 0) renderEmptyState();
    buildToc();

    // Render tab bar to update translations of tooltips / titles
    if (typeof renderTabBar === "function") {
      renderTabBar();
    }
  }

  // Set initial language UI elements
  setLanguage(currentLang);


});
