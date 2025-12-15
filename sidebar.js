// sidebar.js - sidebar with movable tab + widget system (persisted to localStorage)
// - Injects minimal CSS
// - Creates/uses <aside id="sidebar"> and a moving <button id="sidebarTab">
// - Supports open/close, Esc, Ctrl/Cmd+B, click outside to close
// - Widget system: add/remove widgets, persisted order and per-widget state
// - Ships with a simple "d20" widget (rolls 1-20, shows last result + history)
// Usage: include <aside id="sidebar" aria-hidden="true"></aside> after <body>
// and <script src="sidebar.js"></script> before </body>
(function () {
  const SIDEBAR_ID = 'sidebar';
  const TAB_ID = 'sidebarTab';
  const CSS_ID = 'dmtoolkit-sidebar-styles';
  const STORAGE_WIDGETS = 'dmtoolkit.sidebar.widgets.v1'; // array of widgets {id,type,title,state}
  const STORAGE_OPEN = 'dmtoolkit.sidebar.open';

  // ---------- Inject CSS ----------
  if (!document.getElementById(CSS_ID)) {
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
/* dmtoolkit sidebar styles */
.dm-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 320px;
  max-width: 92vw;
  background: var(--panel, rgba(8,12,18,0.98));
  color: inherit;
  transform: translateX(-100%);
  transition: transform .22s ease;
  z-index: 9999;
  box-sizing: border-box;
  padding: 10px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
}
.dm-sidebar.dm-open { transform: translateX(0); }

/* container inside sidebar for layout */
.dm-sidebar .dm-header {
  display:flex;align-items:center;justify-content:space-between;padding:6px 4px;margin-bottom:8px;
}
.dm-sidebar .dm-title { font-weight:700;font-size:1rem; }
.dm-sidebar .dm-widgets { display:flex;flex-direction:column;gap:8px; padding-bottom:8px; }

/* widget card */
.dm-widget {
  background: rgba(255,255,255,0.02);
  border-radius:8px;
  padding:8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.16);
  color: inherit;
}
.dm-widget .dm-widget-header {
  display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;
}
.dm-widget .dm-widget-title { font-weight:600; font-size:0.95rem; }
.dm-widget .dm-widget-controls button { margin-left:6px; }

/* widget body */
.dm-widget .dm-widget-body { font-size:0.95rem; color:var(--muted,#cfcfcf); }

/* small controls */
.dm-btn {
  background: var(--accent, #ffd166);
  color: #002;
  border: none;
  padding:6px 8px;
  border-radius:6px;
  cursor:pointer;
  font-weight:700;
}
.dm-icon-btn {
  background:transparent;border:1px solid rgba(255,255,255,0.06);padding:6px;border-radius:6px;cursor:pointer;color:inherit;
}

/* footer area for adding widgets */
.dm-sidebar .dm-footer { margin-top:10px;border-top:1px solid rgba(255,255,255,0.03);padding-top:8px;display:flex;gap:8px;align-items:center; }

/* the moving tab (will be positioned by script) */
#${TAB_ID} {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-90deg);
  transform-origin: center;
  background: var(--accent, #ffd166);
  color: var(--sidebar-tab-fore, #002);
  border: none;
  padding: 8px 12px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  z-index: 10000;
  box-shadow: 0 6px 18px rgba(0,0,0,0.22);
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1;
  transition: left .18s ease, transform .18s ease;
}
#${TAB_ID}:focus{ outline: 3px solid rgba(255,255,255,0.12); outline-offset: 3px; }

/* responsive */
@media (max-width:520px) {
  #${TAB_ID} { font-size: 0.86rem; padding: 6px 10px; }
  .dm-sidebar { width: 86vw; }
}
`;
    document.head.appendChild(style);
  }

  // ---------- Helpers: storage ----------
  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) { /* ignore */ }
  }

  // ---------- Create/resolve DOM ----------
  let sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = SIDEBAR_ID;
    sidebar.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(sidebar, document.body.firstChild);
  }
  sidebar.classList.add('dm-sidebar');
  if (!sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');

  let tab = document.getElementById(TAB_ID);
  if (!tab) {
    tab = document.createElement('button');
    tab.id = TAB_ID;
    tab.type = 'button';
    tab.title = 'Open tools (Ctrl/Cmd+B)';
    tab.setAttribute('aria-controls', SIDEBAR_ID);
    tab.setAttribute('aria-expanded', 'false');
    tab.textContent = 'Tools';
    document.body.appendChild(tab);
  }

  // ---------- Widget system state ----------
  // widgets: array of {id, type, title, state}
  let widgets = [];
  const widgetRegistry = {}; // type -> {create:fn, render:fn}

  // ---------- Utilities ----------
  function uid(prefix = 'w') {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
  }

  // ---------- Built-in widget: d20 ----------
  // create initial state if missing: { lastRoll: number|null, history: [numbers] }
  widgetRegistry['d20'] = {
    title: 'd20 Roller',
    initState: () => ({ lastRoll: null, history: [] }),
    // render the widget body into container (widget is the saved widget object)
    render: function (widget, bodyEl, saveState) {
      bodyEl.innerHTML = '';
      // last roll display
      const last = document.createElement('div');
      last.style.marginBottom = '8px';
      last.textContent = widget.state && widget.state.lastRoll ? `Last roll: ${widget.state.lastRoll}` : 'Last roll: —';
      bodyEl.appendChild(last);

      // roll button
      const rollBtn = document.createElement('button');
      rollBtn.className = 'dm-btn';
      rollBtn.textContent = 'Roll d20';
      bodyEl.appendChild(rollBtn);

      // history
      const hist = document.createElement('div');
      hist.style.marginTop = '8px';
      hist.style.fontSize = '0.9rem';
      hist.style.color = 'var(--muted, #cfcfcf)';
      hist.innerHTML = (widget.state && widget.state.history && widget.state.history.length)
        ? 'History: ' + widget.state.history.slice(-8).join(', ')
        : 'History: —';
      bodyEl.appendChild(hist);

      function doRoll() {
        const val = Math.floor(Math.random() * 20) + 1;
        widget.state = widget.state || widgetRegistry['d20'].initState();
        widget.state.lastRoll = val;
        widget.state.history = (widget.state.history || []).concat(val);
        // keep history trimmed
        if (widget.state.history.length > 50) widget.state.history = widget.state.history.slice(-50);
        // update UI
        last.textContent = `Last roll: ${val}`;
        hist.innerHTML = 'History: ' + widget.state.history.slice(-8).join(', ');
        saveState(widget);
      }

      rollBtn.addEventListener('click', doRoll);
    }
  };

  // register more widget types here later if desired

  // ---------- Persistence ----------
  function loadWidgets() {
    const raw = storageGet(STORAGE_WIDGETS);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveWidgets() {
    try {
      storageSet(STORAGE_WIDGETS, JSON.stringify(widgets));
    } catch (e) { /* ignore */ }
  }

  // ---------- Rendering UI ----------
  // root structure inside sidebar:
  // header, widgets container, footer(add controls)
  const headerEl = document.createElement('div');
  headerEl.className = 'dm-header';
  const titleEl = document.createElement('div');
  titleEl.className = 'dm-title';
  titleEl.textContent = 'Tools';
  headerEl.appendChild(titleEl);
  // simple close icon in header
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dm-icon-btn';
  closeBtn.title = 'Close';
  closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('click', () => sidebar.dmSidebar && sidebar.dmSidebar.close());
  headerEl.appendChild(closeBtn);

  const widgetsContainer = document.createElement('div');
  widgetsContainer.className = 'dm-widgets';

  const footerEl = document.createElement('div');
  footerEl.className = 'dm-footer';
  // add widget selector: for now, simple Add d20 button
  const addD20Btn = document.createElement('button');
  addD20Btn.className = 'dm-btn';
  addD20Btn.textContent = 'Add d20';
  addD20Btn.title = 'Add a d20 roller widget';
  addD20Btn.addEventListener('click', () => {
    const w = addWidget('d20');
    // focus the new widget (scroll into view)
    requestAnimationFrame(() => {
      const el = document.getElementById('widget-' + w.id);
      el && el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  footerEl.appendChild(addD20Btn);

  const clearAllBtn = document.createElement('button');
  clearAllBtn.className = 'dm-icon-btn';
  clearAllBtn.textContent = 'Reset';
  clearAllBtn.title = 'Remove all widgets';
  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Remove all widgets from the sidebar?')) return;
    widgets = [];
    saveWidgets();
    renderWidgets();
  });
  footerEl.appendChild(clearAllBtn);

  // place the header/footer into sidebar
  function renderSidebarShell() {
    // keep existing content minimal: replace
    sidebar.innerHTML = '';
    sidebar.appendChild(headerEl);
    sidebar.appendChild(widgetsContainer);
    sidebar.appendChild(footerEl);
  }

  // save single widget state and persist
  function saveWidgetState(widget) {
    const idx = widgets.findIndex(w => w.id === widget.id);
    if (idx >= 0) widgets[idx] = widget;
    saveWidgets();
  }

  // create widget DOM and render content
  function createWidgetElement(widget) {
    const wrap = document.createElement('div');
    wrap.className = 'dm-widget';
    wrap.id = 'widget-' + widget.id;

    const head = document.createElement('div');
    head.className = 'dm-widget-header';

    const t = document.createElement('div');
    t.className = 'dm-widget-title';
    t.textContent = widget.title || widget.type;
    head.appendChild(t);

    const controls = document.createElement('div');
    controls.className = 'dm-widget-controls';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'dm-icon-btn';
    removeBtn.title = 'Remove widget';
    removeBtn.innerHTML = '🗑';
    removeBtn.addEventListener('click', () => {
      if (!confirm('Remove this widget?')) return;
      removeWidget(widget.id);
    });
    controls.appendChild(removeBtn);

    head.appendChild(controls);
    wrap.appendChild(head);

    const body = document.createElement('div');
    body.className = 'dm-widget-body';
    wrap.appendChild(body);

    // render widget type-specific UI
    const reg = widgetRegistry[widget.type];
    if (reg && typeof reg.render === 'function') {
      // ensure widget has state
      if (!widget.state) widget.state = (reg.initState ? reg.initState() : {});
      reg.render(widget, body, (w) => { saveWidgetState(w); });
    } else {
      body.textContent = '(Unknown widget type)';
    }

    return wrap;
  }

  // render all widgets
  function renderWidgets() {
    renderSidebarShell();
    widgetsContainer.innerHTML = '';
    if (!widgets.length) {
      const empty = document.createElement('div');
      empty.style.fontSize = '0.95rem';
      empty.style.color = 'var(--muted,#cfcfcf)';
      empty.textContent = 'No widgets. Use "Add d20" to add one.';
      widgetsContainer.appendChild(empty);
    } else {
      widgets.forEach(w => {
        const el = createWidgetElement(w);
        widgetsContainer.appendChild(el);
      });
    }
  }

  // ---------- API: add & remove ----------
  function addWidget(type, options = {}) {
    if (!widgetRegistry[type]) {
      console.warn('Unknown widget type', type);
      return null;
    }
    const reg = widgetRegistry[type];
    const widget = {
      id: uid('widget'),
      type,
      title: options.title || reg.title || type,
      state: options.state || (reg.initState ? reg.initState() : {})
    };
    widgets.push(widget);
    saveWidgets();
    renderWidgets();
    return widget;
  }

  function removeWidget(id) {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx === -1) return false;
    widgets.splice(idx, 1);
    saveWidgets();
    renderWidgets();
    return true;
  }

  // ---------- Load initial widgets and render ----------
  const loaded = loadWidgets();
  if (loaded && Array.isArray(loaded) && loaded.length) {
    widgets = loaded.map(w => {
      // keep only known fields; ensure we have title for rendering
      return {
        id: w.id || uid('widget'),
        type: w.type || 'd20',
        title: w.title || (widgetRegistry[w.type] ? widgetRegistry[w.type].title : w.type),
        state: w.state || (widgetRegistry[w.type] && widgetRegistry[w.type].initState ? widgetRegistry[w.type].initState() : {})
      };
    });
  } else {
    // default: add a single d20 widget (if none saved)
    widgets = [ { id: uid('widget'), type: 'd20', title: widgetRegistry['d20'].title, state: widgetRegistry['d20'].initState() } ];
    saveWidgets();
  }

  renderWidgets();

  // ---------- Sidebar open/close & moving tab behaviour ----------
  // Reuse patterns from previous version, but integrate updateTabPosition so tab attaches to sidebar edge when open
  function applyOpen(open) {
    sidebar.classList.toggle('dm-open', Boolean(open));
    sidebar.setAttribute('aria-hidden', String(!open));
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-pressed', String(open));
    if (open) {
      // focus first focusable widget or sidebar
      const focusable = sidebar.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || sidebar).focus && (focusable || sidebar).focus();
    } else {
      try { tab.focus(); } catch (e) { /* ignore */ }
    }
    // schedule tab position update
    requestAnimationFrame(updateTabPosition);
  }

  function setOpen(open) {
    applyOpen(open);
    storageSet(STORAGE_OPEN, open ? '1' : '0');
  }

  // initialize open state
  const savedOpen = storageGet(STORAGE_OPEN);
  const wasOpen = (savedOpen === '1') || (sidebar.getAttribute('aria-hidden') === 'false');
  applyOpen(Boolean(wasOpen));

  // Tab positioning: when sidebar open, place tab at right edge of sidebar (attached),
  // when closed, place tab at left viewport edge rotated.
  function updateTabPosition() {
    tab.style.top = '50%'; // vertical center
    const tabRect = tab.getBoundingClientRect();
    const tabW = Math.max(tabRect.width, 36);

    if (sidebar.classList.contains('dm-open')) {
      const sRect = sidebar.getBoundingClientRect();
      // position tab so it appears attached to sidebar outer edge
      const left = Math.round(sRect.right - (tabW / 2));
      tab.style.left = left + 'px';
      // make tab horizontal handle
      tab.style.transform = 'translateY(-50%) rotate(1530deg)';
    } else {
      tab.style.left = '0px';
      tab.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
    }
  }

  // Debounced update helper
  let debounceTimer = null;
  function scheduleUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { debounceTimer = null; updateTabPosition(); }, 60);
  }

  // Events
  tab.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setOpen(!sidebar.classList.contains('dm-open'));
  });

  tab.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      setOpen(!sidebar.classList.contains('dm-open'));
    }
  });

  window.addEventListener('keydown', (ev) => {
    const key = ev.key ? ev.key.toLowerCase() : '';
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? ev.metaKey : ev.ctrlKey;
    if (mod && key === 'b') {
      ev.preventDefault();
      setOpen(!sidebar.classList.contains('dm-open'));
      return;
    }
    if (key === 'escape' && sidebar.classList.contains('dm-open')) {
      setOpen(false);
    }
  });

  document.addEventListener('click', (ev) => {
    if (!sidebar.classList.contains('dm-open')) return;
    const t = ev.target;
    if (sidebar.contains(t) || tab.contains(t)) return;
    setOpen(false);
  });

  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  sidebar.addEventListener('transitionend', scheduleUpdate);
  window.addEventListener('load', () => requestAnimationFrame(updateTabPosition));

  // expose API for debugging / programmatic control
  try {
    sidebar.dmSidebar = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!sidebar.classList.contains('dm-open')),
      isOpen: () => sidebar.classList.contains('dm-open'),
      addWidget,
      removeWidget,
      listWidgets: () => widgets.map(w => ({ id: w.id, type: w.type, title: w.title })),
      updateTabPosition
    };
    // also make a global convenience reference
    window.dmSidebar = sidebar.dmSidebar;
  } catch (e) { /* ignore */ }

  console.info('sidebar.js loaded — use the side tab, Esc, or Ctrl/Cmd+B. Widgets saved locally; API: sidebar.dmSidebar');
})();
