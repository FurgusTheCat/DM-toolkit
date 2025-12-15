// sidebar.js - minimal behaviour for the existing <aside id="sidebar"> element.
// - Adds a small toggle button inside the sidebar (if missing)
// - Toggles an "open" class on the aside
// - Persists open/closed in localStorage
// - Adds Ctrl/Cmd+B keyboard shortcut to toggle
(function () {
  const STORAGE_KEY = 'dmtoolkit.sidebar.open';
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    console.warn('sidebar.js: no element with id="sidebar" found.');
    return;
  }

  // Create a toggle button if one doesn't already exist
  let toggle = document.getElementById('sidebarToggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'sidebarToggle';
    toggle.type = 'button';
    toggle.title = 'Toggle sidebar (Ctrl/Cmd+B)';
    // Visual label (keeps markup minimal); you can replace with SVG or text later.
    toggle.textContent = '☰';
    // Basic ARIA
    toggle.setAttribute('aria-controls', 'sidebar');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.style.cursor = 'pointer';
    // Insert as first child so it doesn't move existing content
    sidebar.insertBefore(toggle, sidebar.firstChild);
  }

  // Read initial state:
  //  - If a saved preference exists, use that.
  //  - Otherwise respect the current aria-hidden attribute if present.
  const saved = localStorage.getItem(STORAGE_KEY);
  const initialOpen = saved === null
    ? (sidebar.getAttribute('aria-hidden') === 'false')
    : (saved === '1');

  function apply(open) {
    sidebar.classList.toggle('open', open);
    sidebar.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-pressed', String(open));
  }

  function setOpen(open) {
    apply(open);
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch (_) { /* ignore */ }
  }

  // Initialize
  apply(Boolean(initialOpen));

  // Toggle on button click
  toggle.addEventListener('click', () => {
    setOpen(!sidebar.classList.contains('open'));
  });

  // Keyboard shortcut: Ctrl+B or Cmd+B
  window.addEventListener('keydown', (ev) => {
    const key = ev.key ? ev.key.toLowerCase() : '';
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? ev.metaKey : ev.ctrlKey;
    if (mod && key === 'b') {
      ev.preventDefault();
      setOpen(!sidebar.classList.contains('open'));
    }
  });

  // Expose a tiny API on the element for debugging/manual control
  try {
    sidebar.sidebarToggle = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!sidebar.classList.contains('open')),
      isOpen: () => sidebar.classList.contains('open'),
    };
  } catch (e) { /* no-op */ }

  // Helpful console message
  console.info('sidebar.js loaded — toggle with Ctrl/Cmd+B or the sidebar button.');
})();
