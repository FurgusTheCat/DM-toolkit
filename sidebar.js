// sidebar.js - self-contained, injects CSS, creates a little side-tab and toggles #sidebar
(function () {
  const SIDEBAR_ID = 'sidebar';
  const TAB_ID = 'sidebarTab';
  const STORAGE_KEY = 'dmtoolkit.sidebar.open';
  const CSS_ID = 'dmtoolkit-sidebar-styles';

  // Inject CSS once
  if (!document.getElementById(CSS_ID)) {
    const css = document.createElement('style');
    css.id = CSS_ID;
    css.textContent = `
/* dmtoolkit sidebar minimal styles (injected by sidebar.js) */
.dm-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 300px;
  max-width: 85vw;
  background: rgba(10,14,20,0.98);
  color: inherit;
  transform: translateX(-100%);
  transition: transform .22s ease;
  z-index: 9999;
  box-sizing: border-box;
  padding: 12px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
.dm-sidebar.dm-open { transform: translateX(0); }

/* side tab */
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
}
#${TAB_ID}:focus{ outline: 3px solid rgba(255,255,255,0.12); outline-offset: 3px; }

/* small icon fallback if you want smaller display on mobile */
@media (max-width: 520px) {
  #${TAB_ID} {
    font-size: 0.86rem;
    padding: 6px 10px;
  }
  .dm-sidebar { width: 86vw; }
}

/* keep existing pages unchanged: the sidebar overlays rather than pushes */
`;
    document.head.appendChild(css);
  }

  // Locate or create the aside element
  let sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = SIDEBAR_ID;
    // create it as first child so it doesn't break document flow
    document.body.insertBefore(sidebar, document.body.firstChild);
  }

  // Make sure the aside has our helper class and is focusable
  sidebar.classList.add('dm-sidebar');
  if (!sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');

  // Create the tab if missing
  let tab = document.getElementById(TAB_ID);
  if (!tab) {
    tab = document.createElement('button');
    tab.id = TAB_ID;
    tab.type = 'button';
    tab.title = 'Open tools (Ctrl/Cmd+B)';
    tab.setAttribute('aria-controls', SIDEBAR_ID);
    tab.setAttribute('aria-expanded', 'false');
    // Tab label (hamburger). Change to text if you prefer.
    tab.textContent = '☰';
    // Append to body so it's always visible
    document.body.appendChild(tab);
  }

  // Read saved state: '1' for open, otherwise closed
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore storage errors */ }
  const wasOpen = saved === '1' || sidebar.getAttribute('aria-hidden') === 'false';

  // Apply open/closed state
  function apply(open) {
    sidebar.classList.toggle('dm-open', Boolean(open));
    sidebar.setAttribute('aria-hidden', String(!open));
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-pressed', String(open));
    // focus management for accessibility
    if (open) {
      // focus first focusable element inside sidebar if present, otherwise the sidebar
      const focusable = sidebar.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (focusable || sidebar).focus && (focusable || sidebar).focus();
    } else {
      // return focus to tab
      try { tab.focus(); } catch (e) { /* ignore */ }
    }
  }

  function setOpen(open) {
    apply(open);
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  // initialize
  apply(Boolean(wasOpen));

  // Toggle handlers
  tab.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setOpen(!sidebar.classList.contains('dm-open'));
  });

  tab.addEventListener('keydown', (ev) => {
    // Enter or Space toggles
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      setOpen(!sidebar.classList.contains('dm-open'));
    }
  });

  // Global keyboard shortcuts
  window.addEventListener('keydown', (ev) => {
    const key = ev.key ? ev.key.toLowerCase() : '';
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? ev.metaKey : ev.ctrlKey;

    // Ctrl/Cmd+B toggles
    if (mod && key === 'b') {
      ev.preventDefault();
      setOpen(!sidebar.classList.contains('dm-open'));
      return;
    }

    // Escape closes
    if (key === 'escape' && sidebar.classList.contains('dm-open')) {
      setOpen(false);
    }
  });

  // Click outside closes (ignore clicks on the tab)
  document.addEventListener('click', (ev) => {
    if (!sidebar.classList.contains('dm-open')) return;
    const target = ev.target;
    if (sidebar.contains(target) || tab.contains(target)) return;
    setOpen(false);
  });

  // Expose a tiny API for debugging / manual control
  try {
    sidebar.dmSidebar = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!sidebar.classList.contains('dm-open')),
      isOpen: () => sidebar.classList.contains('dm-open'),
    };
  } catch (e) { /* ignore */ }

  // console hint
  console.info('dmtoolkit sidebar loaded — toggle with the side tab, Esc, or Ctrl/Cmd+B. Use sidebar.dmSidebar in console to control.');
})();
