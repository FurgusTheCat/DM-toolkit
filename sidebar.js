// sidebar.js - side tab that moves with the sidebar and attaches to its edge
(function () {
  const SIDEBAR_ID = 'sidebar';
  const TAB_ID = 'sidebarTab';
  const STORAGE_KEY = 'dmtoolkit.sidebar.open';
  const CSS_ID = 'dmtoolkit-sidebar-styles';

  // Inject minimal CSS (if not already injected)
  if (!document.getElementById(CSS_ID)) {
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
/* dmtoolkit sidebar styles injected by sidebar.js */
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

/* the tab is positioned fixed so we can control it precisely;
   script will move it to the edge of the sidebar when open */
#${TAB_ID} {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%) rotate(360deg);
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
#${TAB_ID}:focus { outline: 3px solid rgba(255,255,255,0.12); outline-offset: 3px; }

/* smaller on very small screens */
@media (max-width:520px) {
  #${TAB_ID} { font-size: 0.86rem; padding: 6px 10px; }
  .dm-sidebar { width: 86vw; }
}
`;
    document.head.appendChild(style);
  }

  // Get or create sidebar
  let sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = SIDEBAR_ID;
    sidebar.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(sidebar, document.body.firstChild);
  }
  sidebar.classList.add('dm-sidebar');
  if (!sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');

  // Get or create tab
  let tab = document.getElementById(TAB_ID);
  if (!tab) {
    tab = document.createElement('button');
    tab.id = TAB_ID;
    tab.type = 'button';
    tab.title = 'Open tools (Ctrl/Cmd+B)';
    tab.setAttribute('aria-controls', SIDEBAR_ID);
    tab.setAttribute('aria-expanded', 'false');
    tab.textContent = '☰';
    document.body.appendChild(tab);
  }

  // Utility to safely read/write storage
  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  // initial open state: stored preference > aria-hidden attr (false means open)
  const saved = storageGet(STORAGE_KEY);
  const initialOpen = saved === '1' || sidebar.getAttribute('aria-hidden') === 'false';

  // Apply open/closed state and update tab position
  function apply(open) {
    sidebar.classList.toggle('dm-open', Boolean(open));
    sidebar.setAttribute('aria-hidden', String(!open));
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-pressed', String(open));

    // Focus management
    if (open) {
      const focusable = sidebar.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || sidebar).focus && (focusable || sidebar).focus();
    } else {
      try { tab.focus(); } catch (e) { /* ignore */ }
    }

    // Update tab position (use RAF for smoother positioning after transitions)
    requestAnimationFrame(updateTabPosition);
  }

  function setOpen(open) {
    apply(open);
    storageSet(STORAGE_KEY, open ? '1' : '0');
  }

  // Update tab position so it sits on the sidebar outer edge when sidebar is open
  function updateTabPosition() {
    // Ensure the tab is fixed and vertically centered by default
    tab.style.top = '50%';
    tab.style.transformOrigin = 'center';
    tab.style.transition = 'left .18s ease, transform .18s ease';

    const tabRect = tab.getBoundingClientRect();
    const tabW = Math.max(tabRect.width, 36); // fallback width
    const tabH = tabRect.height || 36;

    if (sidebar.classList.contains('dm-open')) {
      // Sidebar visible; place tab at the sidebar's right outer edge (attached)
      const sRect = sidebar.getBoundingClientRect();
      // put the tab so its middle aligns with the sidebar right edge (outside the sidebar)
      // left value = sRect.right - (tabW/2)
      const left = Math.round(sRect.right - (tabW / 2));
      tab.style.left = left + 'px';
      // keep tab vertically centered; remove rotation (make horizontal if you prefer)
      tab.style.transform = 'translateY(-50%) rotate(450deg)';
    } else {
      // Sidebar closed; place tab at the viewport left edge, rotated
      tab.style.left = '0px';
      tab.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
    }
  }

  // Debounce helper
  let debounceTimer = null;
  function scheduleUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      updateTabPosition();
    }, 80);
  }

  // Initialize
  apply(Boolean(initialOpen));

  // Toggle on tab click
  tab.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setOpen(!sidebar.classList.contains('dm-open'));
  });

  // Keyboard accessibility for tab (Enter/Space)
  tab.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      setOpen(!sidebar.classList.contains('dm-open'));
    }
  });

  // Global keyboard shortcuts: Ctrl/Cmd+B toggle, Esc close
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

  // Click outside closes sidebar
  document.addEventListener('click', (ev) => {
    if (!sidebar.classList.contains('dm-open')) return;
    const t = ev.target;
    if (sidebar.contains(t) || tab.contains(t)) return;
    setOpen(false);
  });

  // Update tab position on resize and scroll
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('scroll', scheduleUpdate, { passive: true });

  // Also schedule update after transition end (sidebar opening)
  sidebar.addEventListener('transitionend', scheduleUpdate);

  // Expose small API
  try {
    sidebar.dmSidebar = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!sidebar.classList.contains('dm-open')),
      isOpen: () => sidebar.classList.contains('dm-open'),
      updateTabPosition
    };
  } catch (e) { /* ignore */ }

  // ensure position is correct after load
  window.addEventListener('load', () => requestAnimationFrame(updateTabPosition));

  console.info('sidebar.js loaded — side-tab will move with the sidebar; toggle with the tab, Esc, or Ctrl/Cmd+B.');
})();
