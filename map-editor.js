// map-editor.js
// Fixes:
// - props render immediately and are easy to add
// - viewport fixed while zooming (canvasContent is scaled)
// - prop drag/rotate/scale handle visualScale correctly
// - smooth wall/door drag
//
// How to add props easily:
// - Call registerProp({ id: 'new_prop', name: 'My Prop', img: 'assets/props/myprop.svg', defaultTiles:2 });
// - Or use the "Add Prop" form in the Props panel.

(() => {
  // --- DOM refs ---
  const canvasViewport = document.getElementById('canvasViewport');
  const canvasContent = document.getElementById('canvasContent');
  const canvasWrap = document.getElementById('canvasWrap');
  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const propLayer = document.getElementById('propLayer');

  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const resetZoom = document.getElementById('resetZoom');

  const colsInput = document.getElementById('cols');
  const rowsInput = document.getElementById('rows');
  const tileSizeInput = document.getElementById('tileSize');
  const applyGridBtn = document.getElementById('applyGrid');
  const clearGridBtn = document.getElementById('clearGrid');
  const toolSelect = document.getElementById('tool');
  const colorInput = document.getElementById('color');

  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const importJsonBtn = document.getElementById('importJson');
  const importFile = document.getElementById('importFile');
  const exportJsonBtn = document.getElementById('exportJson');
  const exportPngBtn = document.getElementById('exportPng');

  const propLibrary = document.getElementById('propLibrary');
  const propSearch = document.getElementById('propSearch');
  const propReset = document.getElementById('propReset');
  const placedPropsList = document.getElementById('placedPropsList');

  const sideTabs = Array.from(document.querySelectorAll('.side-tab'));
  const toggleSidebar = document.getElementById('toggleSidebar');
  const tabTools = document.getElementById('tab-tools');
  const tabProps = document.getElementById('tab-props');
  const hint = document.getElementById('hint');
  const mapInfo = document.getElementById('mapInfo');

  // --- Model ---
  let cols = Math.max(1, parseInt(colsInput.value, 10) || 64);
  let rows = Math.max(1, parseInt(rowsInput.value, 10) || 48);
  let tileSize = Math.max(4, parseInt(tileSizeInput.value, 10) || 12);

  let grid = createEmptyGrid(cols, rows);
  let walls = { h: createWallH(rows, cols), v: createWallV(rows, cols) };
  let doors = { h: createWallH(rows, cols), v: createWallV(rows, cols) };
  let props = []; // placed props

  let selectedPropId = null;
  let placingProp = null;
  let lastRooms = null;

  // --- Visual zoom (scale only canvasContent) ---
  let visualScale = 1.0;
  function setVisualScale(s) {
    visualScale = s;
    canvasContent.style.transform = `scale(${visualScale})`;
  }
  zoomIn.addEventListener('click', () => setVisualScale(Math.min(4, visualScale * 1.25)));
  zoomOut.addEventListener('click', () => setVisualScale(Math.max(0.25, visualScale / 1.25)));
  resetZoom.addEventListener('click', () => setVisualScale(1.0));

  // --- Undo/redo ---
  const undoStack = [], redoStack = [], MAX_UNDO = 150;
  function pushSnapshot() {
    undoStack.push({
      grid: cloneGrid(grid),
      props: JSON.parse(JSON.stringify(props)),
      walls: { h: clone2D(walls.h), v: clone2D(walls.v) },
      doors: { h: clone2D(doors.h), v: clone2D(doors.v) }
    });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push({
      grid: cloneGrid(grid),
      props: JSON.parse(JSON.stringify(props)),
      walls: { h: clone2D(walls.h), v: clone2D(walls.v) },
      doors: { h: clone2D(doors.h), v: clone2D(doors.v) }
    });
    const s = undoStack.pop();
    grid = cloneGrid(s.grid);
    props = JSON.parse(JSON.stringify(s.props));
    walls.h = clone2D(s.walls.h); walls.v = clone2D(s.walls.v);
    doors.h = clone2D(s.doors.h); doors.v = clone2D(s.doors.v);
    render();
    updateUndoButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push({
      grid: cloneGrid(grid),
      props: JSON.parse(JSON.stringify(props)),
      walls: { h: clone2D(walls.h), v: clone2D(walls.v) },
      doors: { h: clone2D(doors.h), v: clone2D(doors.v) }
    });
    const s = redoStack.pop();
    grid = cloneGrid(s.grid);
    props = JSON.parse(JSON.stringify(s.props));
    walls.h = clone2D(s.walls.h); walls.v = clone2D(s.walls.v);
    doors.h = clone2D(s.doors.h); doors.v = clone2D(s.doors.v);
    render();
    updateUndoButtons();
  }
  function updateUndoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  // --- Prop assets storage & helper API (make adding props easy) ---
  const PROP_ASSETS = {};
  function registerProp(meta) {
    // meta: { id: 'key', name: 'Label', img: 'url-or-data-url', defaultTiles: 2 }
    if (!meta || !meta.id) throw new Error('registerProp requires {id, name, img}');
    PROP_ASSETS[meta.id] = { id: meta.id, name: meta.name || meta.id, img: meta.img, defaultTiles: meta.defaultTiles || 2 };
  }

  // Example initial props (SVG data-urls). You can replace or add by calling registerProp.
  registerProp({ id: 'chest', name: 'Wooden Chest', img: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 96"><rect rx="6" width="120" height="72" x="4" y="12" fill="#8b5a2b"/></svg>`), defaultTiles: 2 });
  registerProp({ id: 'barrel', name: 'Barrel', img: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><ellipse cx="48" cy="18" rx="28" ry="12" fill="#aa6a39"/></svg>`), defaultTiles: 1 });
  registerProp({ id: 'table', name: 'Round Table', img: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 96"><ellipse cx="64" cy="40" rx="44" ry="18" fill="#7a4f31"/></svg>`), defaultTiles: 2 });

  // --- Build library UI ---
  function buildLibrary(filter = '') {
    propLibrary.innerHTML = '';
    const q = (filter || '').toLowerCase().trim();
    Object.keys(PROP_ASSETS).forEach(k => {
      const meta = PROP_ASSETS[k];
      if (q && !(meta.name.toLowerCase().includes(q) || meta.id.toLowerCase().includes(q))) return;
      const el = document.createElement('div');
      el.className = 'lib-item';
      el.title = meta.name;
      el.dataset.type = meta.id;
      el.innerHTML = `<img src="${meta.img}" alt="${meta.name}">`;
      el.addEventListener('click', () => {
        placingProp = { meta, wTiles: meta.defaultTiles || 2, hTiles: meta.defaultTiles || 2 };
        toolSelect.value = 'select';
        tabSwitch('props');
        hint.textContent = `Placing: ${meta.name} — click map to place`;
      });
      propLibrary.appendChild(el);
    });
  }
  propSearch.addEventListener('input', () => buildLibrary(propSearch.value));
  propReset.addEventListener('click', () => { propSearch.value = ''; buildLibrary(); });

  // --- Canvas sizing & render ---
  function resizeCanvas() {
    const w = cols * tileSize, h = rows * tileSize;
    canvas.width = w; canvas.height = h;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    propLayer.style.width = canvas.style.width; propLayer.style.height = canvas.style.height;
  }

  function render() {
    resizeCanvas();
    // background
    ctx.fillStyle = '#071018'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // tiles
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = grid[y][x];
        if (v) {
          ctx.fillStyle = (typeof v === 'string') ? v : '#8fd3a6';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * tileSize + 0.5, 0); ctx.lineTo(x * tileSize + 0.5, rows * tileSize); ctx.stroke(); }
    for (let y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * tileSize + 0.5); ctx.lineTo(cols * tileSize, y * tileSize + 0.5); ctx.stroke(); }

    // walls
    const wth = Math.max(2, Math.floor(tileSize * 0.33));
    ctx.fillStyle = '#000';
    for (let hy = 0; hy < walls.h.length; hy++) for (let x = 0; x < cols; x++) if (walls.h[hy][x]) {
      const ypix = hy * tileSize - Math.floor(wth / 2); ctx.fillRect(x * tileSize, ypix, tileSize, wth);
    }
    for (let y = 0; y < rows; y++) for (let vx = 0; vx < walls.v[y].length; vx++) if (walls.v[y][vx]) {
      const xpix = vx * tileSize - Math.floor(wth / 2); ctx.fillRect(xpix, y * tileSize, wth, tileSize);
    }

    // doors (thicker, brown)
    const dth = Math.max(3, Math.floor(tileSize * 0.5));
    ctx.fillStyle = '#8b5a2b';
    for (let hy = 0; hy < doors.h.length; hy++) for (let x = 0; x < cols; x++) if (doors.h[hy][x]) {
      const ypix = hy * tileSize - Math.floor(dth / 2); ctx.fillRect(x * tileSize, ypix, tileSize, dth);
    }
    for (let y = 0; y < rows; y++) for (let vx = 0; vx < doors.v[y].length; vx++) if (doors.v[y][vx]) {
      const xpix = vx * tileSize - Math.floor(dth / 2); ctx.fillRect(xpix, y * tileSize, dth, tileSize);
    }

    // props DOM
    renderPropsDOM();
    updatePlacedList();
    updateMapInfo();
  }

  // --- Painting & edge drawing (canvas events mapped from canvasContent bounding rect) ---
  let paintState = null; // { rect, scaleX, scaleY, lastCell }
  let edgeDrag = null; // { type, action, lastKey }

  canvas.addEventListener('pointerdown', e => {
    const tool = toolSelect.value;
    const contentRect = canvasContent.getBoundingClientRect();
    const scaleX = canvas.width / contentRect.width;
    const scaleY = canvas.height / contentRect.height;

    if (tool === 'select') {
      if (placingProp) placePropAtEvent(e, contentRect, scaleX, scaleY);
      else deselectProp();
      return;
    }

    if (tool === 'wall' || tool === 'door') {
      pushSnapshot();
      const edge = detectEdge(e, contentRect, scaleX, scaleY);
      if (!edge) return;
      const present = (tool === 'wall') ? getWall(edge) : getDoor(edge);
      const action = present ? 'remove' : 'add';
      edgeDrag = { type: tool, action, lastKey: null };
      applyEdge(edge, tool, action === 'add');
      window.addEventListener('pointermove', edgePointerMove);
      window.addEventListener('pointerup', edgePointerUp, { once: true });
      return;
    }

    // tile paint
    paintState = { rect: contentRect, scaleX: canvas.width / contentRect.width, scaleY: canvas.height / contentRect.height, lastCell: null };
    pushSnapshot();
    handlePaint(e, paintState.rect, paintState.scaleX, paintState.scaleY);
    window.addEventListener('pointermove', paintPointerMove);
    window.addEventListener('pointerup', paintPointerUp, { once: true });
  });

  function edgePointerMove(e) {
    if (!edgeDrag) return;
    const contentRect = canvasContent.getBoundingClientRect();
    const scaleX = canvas.width / contentRect.width, scaleY = canvas.height / contentRect.height;
    const edge = detectEdge(e, contentRect, scaleX, scaleY);
    if (!edge) return;
    const key = `${edge.axis}:${edge.row}:${edge.idx}`;
    if (edgeDrag.lastKey === key) return;
    edgeDrag.lastKey = key;
    applyEdge(edge, edgeDrag.type, edgeDrag.action === 'add');
  }
  function edgePointerUp() { edgeDrag = null; window.removeEventListener('pointermove', edgePointerMove); }

  function paintPointerMove(e) { if (!paintState) return; handlePaint(e, paintState.rect, paintState.scaleX, paintState.scaleY); }
  function paintPointerUp() { paintState = null; window.removeEventListener('pointermove', paintPointerMove); }

  function handlePaint(e, rect, scaleX, scaleY) {
    const c = getCellFromEvent(e, rect, scaleX, scaleY);
    if (!c) return;
    if (paintState.lastCell && paintState.lastCell.x === c.x && paintState.lastCell.y === c.y) return;
    paintState.lastCell = { x: c.x, y: c.y };
    const tool = toolSelect.value;
    if (tool === 'brush') { grid[c.y][c.x] = colorInput.value; render(); }
    else if (tool === 'erase') { grid[c.y][c.x] = 0; render(); }
    else if (tool === 'fill') { const target = grid[c.y][c.x]; floodFill(c.x, c.y, target, colorInput.value); render(); }
  }

  function getCellFromEvent(e, rect, scaleX, scaleY) {
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(sx / tileSize);
    const y = Math.floor(sy / tileSize);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return { x, y, sx, sy };
  }

  function detectEdge(e, rect, scaleX, scaleY) {
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const fx = sx / tileSize, fy = sy / tileSize;
    const cx = Math.floor(fx), cy = Math.floor(fy);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
    const fracX = fx - cx, fracY = fy - cy;
    const left = fracX, right = 1 - fracX, top = fracY, bottom = 1 - fracY;
    const minVert = Math.min(left, right), minHoriz = Math.min(top, bottom);
    if (minVert < minHoriz) {
      const useLeft = left <= right;
      const vx = useLeft ? cx : cx + 1;
      return { axis: 'v', row: cy, idx: vx };
    } else {
      const useTop = top <= bottom;
      const hy = useTop ? cy : cy + 1;
      return { axis: 'h', row: hy, idx: cx };
    }
  }

  function getWall(edge) { return edge.axis === 'h' ? walls.h[edge.row][edge.idx] : walls.v[edge.row][edge.idx]; }
  function getDoor(edge) { return edge.axis === 'h' ? doors.h[edge.row][edge.idx] : doors.v[edge.row][edge.idx]; }

  function applyEdge(edge, type, setOn) {
    if (!edge) return;
    if (type === 'wall') {
      if (edge.axis === 'h') walls.h[edge.row][edge.idx] = setOn;
      else walls.v[edge.row][edge.idx] = setOn;
    } else {
      if (edge.axis === 'h') { doors.h[edge.row][edge.idx] = setOn; if (setOn) walls.h[edge.row][edge.idx] = false; }
      else { doors.v[edge.row][edge.idx] = setOn; if (setOn) walls.v[edge.row][edge.idx] = false; }
    }
    render();
  }

  function floodFill(sx, sy, startColor, replaceColor) {
    if (startColor === replaceColor) return;
    const stack = [[sx, sy]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      if (grid[cy][cx] !== startColor) continue;
      grid[cy][cx] = replaceColor;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  // --- Props DOM & interactions ---
  function renderPropsDOM() {
    propLayer.innerHTML = '';
    for (const p of props) {
      const el = document.createElement('div');
      el.className = 'prop';
      el.dataset.id = p.id;
      const pxW = Math.max(6, Math.round((p.wTiles || 2) * tileSize));
      const pxH = Math.max(6, Math.round((p.hTiles || 2) * tileSize));
      el.style.width = pxW + 'px';
      el.style.height = pxH + 'px';
      el.style.left = Math.round(p.x * tileSize) + 'px';
      el.style.top = Math.round(p.y * tileSize) + 'px';
      el.style.transform = `rotate(${p.rotDeg || 0}deg) scale(${p.scale || 1})`;
      el.innerHTML = `<img src="${resolvePropImg(p)}" alt="${p.type}"><div class="handle rotate" title="Rotate"></div><div class="handle scale" title="Scale"></div>`;
      el.style.pointerEvents = 'auto';
      el.addEventListener('pointerdown', onPropPointerDown);
      propLayer.appendChild(el);
      if (p.id === selectedPropId) el.classList.add('selected');
    }
  }

  function resolvePropImg(p) { if (p.img) return p.img; if (PROP_ASSETS[p.type]) return PROP_ASSETS[p.type].img; return ''; }

  function updatePlacedList() {
    placedPropsList.innerHTML = '';
    for (const p of props) {
      const row = document.createElement('div');
      row.className = 'placed-item';
      row.innerHTML = `<img src="${resolvePropImg(p)}" alt="${p.type}"><div style="flex:1"><strong>${p.type}</strong><div style="font-size:12px;color:var(--muted)">x:${p.x} y:${p.y} rot:${(p.rotDeg||0).toFixed(1)}°</div></div><button data-id="${p.id}">Select</button>`;
      row.querySelector('button').addEventListener('click', (ev) => { ev.stopPropagation(); selectProp(p.id); });
      row.addEventListener('click', () => selectProp(p.id));
      placedPropsList.appendChild(row);
    }
  }

  // Prop pointer lifecycle: account for visualScale when converting deltas
  let propActive = null;
  function onPropPointerDown(e) {
    e.stopPropagation(); e.preventDefault();
    const el = e.currentTarget;
    const id = el.dataset.id;
    const p = props.find(pp => pp.id === id);
    if (!p) return;
    selectProp(id);
    const rect = el.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const baseLeft = parseFloat(el.style.left || 0), baseTop = parseFloat(el.style.top || 0);
    const baseScale = p.scale || 1;
    const pointerId = e.pointerId;
    const target = e.target;

    if (target.classList && target.classList.contains('rotate')) {
      propActive = { propId: id, mode: 'rotate', centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, baseRot: p.rotDeg || 0, pointerId, el };
    } else if (target.classList && target.classList.contains('scale')) {
      propActive = { propId: id, mode: 'scale', startX, baseScale, pointerId, el };
    } else {
      propActive = { propId: id, mode: 'drag', startX, startY, baseLeft, baseTop, pointerId, el };
    }

    try { el.setPointerCapture(pointerId); } catch (err) {}
    document.addEventListener('pointermove', onPropPointerMove);
    document.addEventListener('pointerup', onPropPointerUp);
    pushSnapshot();
  }

  function onPropPointerMove(e) {
    if (!propActive) return; if (e.pointerId !== propActive.pointerId) return;
    const p = props.find(pp => pp.id === propActive.propId);
    if (!p) return;
    const el = propLayer.querySelector(`.prop[data-id="${p.id}"]`);
    if (!el) return;

    if (propActive.mode === 'drag') {
      const dx = (e.clientX - propActive.startX) / visualScale;
      const dy = (e.clientY - propActive.startY) / visualScale;
      let nx = propActive.baseLeft + dx, ny = propActive.baseTop + dy;
      nx = Math.round(nx / tileSize) * tileSize; ny = Math.round(ny / tileSize) * tileSize;
      nx = Math.max(0, Math.min(nx, canvas.width - parseFloat(el.style.width)));
      ny = Math.max(0, Math.min(ny, canvas.height - parseFloat(el.style.height)));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
      p.x = Math.round(nx / tileSize); p.y = Math.round(ny / tileSize);
      updatePlacedList();
    } else if (propActive.mode === 'rotate') {
      const cx = propActive.centerX, cy = propActive.centerY;
      let ang = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      p.rotDeg = ang;
      el.style.transform = `rotate(${p.rotDeg}deg) scale(${p.scale || 1})`;
      updatePlacedList();
    } else if (propActive.mode === 'scale') {
      const dx = (e.clientX - propActive.startX) / visualScale;
      const factor = 1 + dx / Math.max(80, tileSize * 4);
      p.scale = Math.max(0.25, propActive.baseScale * factor);
      el.style.transform = `rotate(${p.rotDeg || 0}deg) scale(${p.scale})`;
      updatePlacedList();
    }
  }

  function onPropPointerUp(e) {
    if (!propActive) return;
    try { propActive.el.releasePointerCapture(propActive.pointerId); } catch (err) {}
    document.removeEventListener('pointermove', onPropPointerMove);
    document.removeEventListener('pointerup', onPropPointerUp);
    propActive = null;
    render();
  }

  // place prop by clicking canvas (map) — map click measured using content rect
  function placePropAtEvent(e, contentRect, scaleX, scaleY) {
    const cell = getCellFromEvent(e, contentRect, scaleX, scaleY);
    if (!cell) return;
    const meta = placingProp.meta;
    const p = { id: uid('p'), type: meta.id, img: meta.img, x: cell.x, y: cell.y, wTiles: placingProp.wTiles, hTiles: placingProp.hTiles, rotDeg: 0, scale: 1 };
    pushSnapshot(); props.push(p); placingProp = null; selectProp(p.id); render();
  }

  // select/deselect
  function selectProp(id) { selectedPropId = id; render(); }
  function deselectProp() { selectedPropId = null; render(); }

  // import/export
  importJsonBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { try { importFromJSON(JSON.parse(r.result)); } catch (err) { alert('Invalid JSON: ' + err.message); } };
    r.readAsText(f); ev.target.value = '';
  });

  function importFromJSON(obj) {
    const w = obj.width || obj.cols || (obj.grid && obj.grid[0] && obj.grid[0].length) || cols;
    const h = obj.height || obj.rows || (obj.grid && obj.grid.length) || rows;
    cols = w; rows = h; colsInput.value = cols; rowsInput.value = rows;
    const g = obj.grid || obj.gridTiles || obj.map?.grid || null;
    if (g && Array.isArray(g) && g.length === rows && Array.isArray(g[0]) && g[0].length === cols) grid = g;
    else grid = createEmptyGrid(cols, rows);
    if (obj.walls && obj.walls.h && obj.walls.v) { walls.h = obj.walls.h; walls.v = obj.walls.v; } else { walls = { h: createWallH(rows,cols), v: createWallV(rows,cols) }; }
    if (obj.doors && obj.doors.h && obj.doors.v) { doors.h = obj.doors.h; doors.v = obj.doors.v; } else { doors = { h: createWallH(rows,cols), v: createWallV(rows,cols) }; }
    const rawProps = obj.props || obj.map?.props || obj.items || [];
    props = rawProps.map(rp => {
      const x = Number.isFinite(rp.x)?rp.x:(rp.tileX||rp.tx||rp.col||0);
      const y = Number.isFinite(rp.y)?rp.y:(rp.tileY||rp.ty||rp.row||0);
      return { id: rp.id || uid('p'), type: rp.type || rp.name || 'chest', img: rp.img || (PROP_ASSETS[(rp.type||rp.name)]?PROP_ASSETS[(rp.type||rp.name)].img:undefined), x:Math.round(x), y:Math.round(y), wTiles:rp.wTiles||rp.w||2, hTiles:rp.hTiles||rp.h||2, rotDeg:rp.rotDeg||rp.rot||0, scale:rp.scale||1 };
    });
    lastRooms = obj.rooms || obj.map?.rooms || null;
    pushSnapshot(); render();
  }

  exportJsonBtn.addEventListener('click', () => {
    const payload = { seed: 0, width: cols, height: rows, rooms: lastRooms||[], grid, walls:{h:walls.h, v:walls.v}, doors:{h:doors.h, v:doors.v}, props: props.map(p=>({id:p.id,type:p.type,x:p.x,y:p.y,wTiles:p.wTiles,hTiles:p.hTiles,rotDeg:p.rotDeg,scale:p.scale,img:p.img})) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'dungeon-map.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  });

  exportPngBtn.addEventListener('click', () => {
    const off = document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height; const octx = off.getContext('2d', { alpha: false });
    octx.fillStyle = '#071018'; octx.fillRect(0, 0, off.width, off.height);
    for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){ const v=grid[y][x]; if(v){ octx.fillStyle=(typeof v==='string')?v:'#8fd3a6'; octx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize); } }
    octx.strokeStyle='rgba(255,255,255,0.03)'; octx.lineWidth=1;
    for(let x=0;x<=cols;x++){ octx.beginPath(); octx.moveTo(x*tileSize+0.5,0); octx.lineTo(x*tileSize+0.5, rows*tileSize); octx.stroke(); }
    for(let y=0;y<=rows;y++){ octx.beginPath(); octx.moveTo(0,y*tileSize+0.5); octx.lineTo(cols*tileSize,y*tileSize+0.5); octx.stroke(); }
    const wth = Math.max(2, Math.floor(tileSize*0.33)); octx.fillStyle='#000';
    for(let hy=0; hy<walls.h.length; hy++) for(let x=0;x<cols;x++) if(walls.h[hy][x]){ const ypix=hy*tileSize - Math.floor(wth/2); octx.fillRect(x*tileSize, ypix, tileSize, wth); }
    for(let y=0;y<rows;y++) for(let vx=0; vx<walls.v[y].length; vx++) if(walls.v[y][vx]){ const xpix = vx*tileSize - Math.floor(wth/2); octx.fillRect(xpix, y*tileSize, wth, tileSize); }
    const dth = Math.max(3, Math.floor(tileSize*0.5)); octx.fillStyle='#8b5a2b';
    for(let hy=0; hy<doors.h.length; hy++) for(let x=0;x<cols;x++) if(doors.h[hy][x]){ const ypix=hy*tileSize - Math.floor(dth/2); octx.fillRect(x*tileSize, ypix, tileSize, dth); }
    for(let y=0;y<rows;y++) for(let vx=0; vx<doors.v[y].length; vx++) if(doors.v[y][vx]){ const xpix = vx*tileSize - Math.floor(dth/2); octx.fillRect(xpix, y*tileSize, dth, tileSize); }

    const loads = props.map(p => new Promise(resolve => { const img = new Image(); img.crossOrigin='anonymous'; img.onload = ()=> resolve({p,img}); img.onerror = ()=> resolve({p,img:null}); img.src = resolvePropImg(p); }));
    Promise.all(loads).then(results=>{
      results.forEach(r => {
        const p = r.p, img = r.img;
        const pxW = Math.max(6, Math.round((p.wTiles||2) * tileSize));
        const pxH = Math.max(6, Math.round((p.hTiles||2) * tileSize));
        const xPx = p.x * tileSize, yPx = p.y * tileSize;
        octx.save(); octx.translate(xPx + pxW/2, yPx + pxH/2);
        const rot = (p.rotDeg || 0) * Math.PI / 180; octx.rotate(rot); octx.scale(p.scale || 1, p.scale || 1);
        if(img) octx.drawImage(img, -pxW/2, -pxH/2, pxW, pxH); else { octx.fillStyle='#c08040'; octx.fillRect(-pxW/2, -pxH/2, pxW, pxH); }
        octx.restore();
      });
      const url = off.toDataURL('image/png'); const a = document.createElement('a'); a.href = url; a.download='map.png'; a.click();
    });
  });

  // --- UI wiring (grid/apply/clear/undo/tabs) ---
  applyGridBtn.addEventListener('click', () => {
    cols = Math.max(1, parseInt(colsInput.value,10) || cols);
    rows = Math.max(1, parseInt(rowsInput.value,10) || rows);
    tileSize = Math.max(4, parseInt(tileSizeInput.value,10) || tileSize);
    colsInput.value = cols; rowsInput.value = rows; tileSizeInput.value = tileSize;
    pushSnapshot(); grid = createEmptyGrid(cols, rows); walls = {h:createWallH(rows,cols), v:createWallV(rows,cols)}; doors={h:createWallH(rows,cols),v:createWallV(rows,cols)}; props=[]; render();
  });
  clearGridBtn.addEventListener('click', ()=>{ if(confirm('Clear grid and props?')) { pushSnapshot(); grid = createEmptyGrid(cols,rows); props=[]; walls={h:createWallH(rows,cols),v:createWallV(rows,cols)}; doors={h:createWallH(rows,cols),v:createWallV(rows,cols)}; render(); } });

  undoBtn.addEventListener('click', undo); redoBtn.addEventListener('click', redo);

  sideTabs.forEach(btn => btn.addEventListener('click', ()=> {
    sideTabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tabSwitch(btn.dataset.tab);
  }));
  toggleSidebar.addEventListener('click', ()=> { document.getElementById('sidebar').classList.toggle('collapsed'); });

  canvas.addEventListener('click', (e) => { if (toolSelect.value === 'select' && placingProp) placePropAtEvent(e); });

  // --- helpers & utilities ---
  function renderPropsDOM() {
    propLayer.innerHTML='';
    for(const p of props){
      const el = document.createElement('div'); el.className='prop'; el.dataset.id=p.id;
      const pxW=Math.max(6, Math.round((p.wTiles||2)*tileSize)); const pxH=Math.max(6, Math.round((p.hTiles||2)*tileSize));
      el.style.width=pxW+'px'; el.style.height=pxH+'px'; el.style.left=(p.x*tileSize)+'px'; el.style.top=(p.y*tileSize)+'px';
      el.style.transform = `rotate(${p.rotDeg||0}deg) scale(${p.scale||1})`;
      el.innerHTML = `<img src="${resolvePropImg(p)}" alt="${p.type}"><div class="handle rotate" title="Rotate"></div><div class="handle scale" title="Scale"></div>`;
      el.style.pointerEvents='auto'; el.addEventListener('pointerdown', onPropPointerDown); propLayer.appendChild(el);
      if(p.id===selectedPropId) el.classList.add('selected');
    }
  }
  function updatePlacedList(){ placedPropsList.innerHTML=''; props.forEach(p=>{ const row=document.createElement('div'); row.className='placed-item'; row.innerHTML = `<img src="${resolvePropImg(p)}" alt="${p.type}"><div style="flex:1"><strong>${p.type}</strong><div style="font-size:12px;color:var(--muted)">x:${p.x} y:${p.y} rot:${(p.rotDeg||0).toFixed(1)}°</div></div><button data-id="${p.id}">Select</button>`; row.querySelector('button').addEventListener('click', ev=>{ ev.stopPropagation(); selectProp(p.id); }); row.addEventListener('click', ()=> selectProp(p.id)); placedPropsList.appendChild(row); }); }
  function resolvePropImg(p){ if(p.img) return p.img; if(PROP_ASSETS[p.type]) return PROP_ASSETS[p.type].img; return ''; }

  function onPropPointerDown(e){
    e.stopPropagation(); e.preventDefault();
    const el = e.currentTarget; const id = el.dataset.id; const p = props.find(pp=>pp.id===id); if(!p) return;
    selectProp(id);
    const rect = el.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const baseLeft = parseFloat(el.style.left || 0), baseTop = parseFloat(el.style.top || 0);
    const pointerId = e.pointerId;
    const target = e.target;
    if (target.classList && target.classList.contains('rotate')) {
      // compute center in client coords from canvasContent mapping
      const contentRect = canvasContent.getBoundingClientRect();
      const pxW = Math.max(6, Math.round((p.wTiles || 2) * tileSize));
      const pxH = Math.max(6, Math.round((p.hTiles || 2) * tileSize));
      const centerCanvasX = p.x * tileSize + pxW / 2;
      const centerCanvasY = p.y * tileSize + pxH / 2;
      const centerClientX = contentRect.left + (centerCanvasX / canvas.width) * contentRect.width;
      const centerClientY = contentRect.top + (centerCanvasY / canvas.height) * contentRect.height;
      propActive = { propId: id, mode: 'rotate', centerX: centerClientX, centerY: centerClientY, baseRot: p.rotDeg || 0, pointerId, el };
    } else if (target.classList && target.classList.contains('scale')) {
      propActive = { propId: id, mode: 'scale', startX, baseScale: p.scale || 1, pointerId, el };
    } else {
      propActive = { propId: id, mode: 'drag', startX, startY, baseLeft, baseTop, pointerId, el };
    }
    try { el.setPointerCapture(pointerId); } catch(e) {}
    document.addEventListener('pointermove', onPropPointerMove);
    document.addEventListener('pointerup', onPropPointerUp);
    pushSnapshot();
  }

  function onPropPointerMove(e){
    if(!propActive) return; if(e.pointerId !== propActive.pointerId) return;
    const p = props.find(pp=>pp.id===propActive.propId); if(!p) return;
    const el = propLayer.querySelector(`.prop[data-id="${p.id}"]`); if(!el) return;
    if(propActive.mode === 'drag'){
      const dx = (e.clientX - propActive.startX) / visualScale;
      const dy = (e.clientY - propActive.startY) / visualScale;
      let nx = propActive.baseLeft + dx, ny = propActive.baseTop + dy;
      nx = Math.round(nx / tileSize) * tileSize; ny = Math.round(ny / tileSize) * tileSize;
      nx = Math.max(0, Math.min(nx, canvas.width - parseFloat(el.style.width)));
      ny = Math.max(0, Math.min(ny, canvas.height - parseFloat(el.style.height)));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
      p.x = Math.round(nx / tileSize); p.y = Math.round(ny / tileSize);
      updatePlacedList();
    } else if (propActive.mode === 'rotate') {
      const cx = propActive.centerX, cy = propActive.centerY;
      let ang = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      p.rotDeg = ang;
      el.style.transform = `rotate(${p.rotDeg}deg) scale(${p.scale || 1})`;
      updatePlacedList();
    } else if (propActive.mode === 'scale') {
      const dx = (e.clientX - propActive.startX) / visualScale;
      const factor = 1 + dx / Math.max(80, tileSize * 4);
      p.scale = Math.max(0.25, propActive.baseScale * factor);
      el.style.transform = `rotate(${p.rotDeg || 0}deg) scale(${p.scale})`;
      updatePlacedList();
    }
  }

  function onPropPointerUp(e){
    if(!propActive) return;
    try { propActive.el.releasePointerCapture(propActive.pointerId); } catch(e){}
    document.removeEventListener('pointermove', onPropPointerMove);
    document.removeEventListener('pointerup', onPropPointerUp);
    propActive = null; render();
  }

  // place prop by clicking canvas
  function placePropAtEvent(e) {
    const contentRect = canvasContent.getBoundingClientRect();
    const scaleX = canvas.width / contentRect.width, scaleY = canvas.height / contentRect.height;
    const cell = getCellFromEvent(e, contentRect, scaleX, scaleY);
    if (!cell) return;
    const meta = placingProp.meta;
    const p = { id: uid('p'), type: meta.id, img: meta.img, x: cell.x, y: cell.y, wTiles: placingProp.wTiles, hTiles: placingProp.hTiles, rotDeg: 0, scale: 1 };
    pushSnapshot(); props.push(p); placingProp = null; selectProp(p.id); render();
  }

  // helpers
  function getCellFromEvent(e, rect, scaleX, scaleY) {
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(sx / tileSize), y = Math.floor(sy / tileSize);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return { x, y, sx, sy };
  }

  // add-prop form
  document.getElementById('addPropBtn').addEventListener('click', () => {
    const id = document.getElementById('newPropId').value.trim();
    const name = document.getElementById('newPropName').value.trim() || id;
    const url = document.getElementById('newPropUrl').value.trim();
    const tiles = parseInt(document.getElementById('newPropTiles').value, 10) || 2;
    if (!id || !url) return alert('Provide id and image URL (or data URL).');
    registerProp({ id, name, img: url, defaultTiles: tiles });
    buildLibrary();
    document.getElementById('newPropId').value=''; document.getElementById('newPropName').value=''; document.getElementById('newPropUrl').value='';
  });

  // import/export wiring already set above

  // misc UI wiring
  applyGridBtn.addEventListener('click', () => {
    cols = Math.max(1, parseInt(colsInput.value, 10) || cols);
    rows = Math.max(1, parseInt(rowsInput.value, 10) || rows);
    tileSize = Math.max(4, parseInt(tileSizeInput.value, 10) || tileSize);
    colsInput.value = cols; rowsInput.value = rows; tileSizeInput.value = tileSize;
    pushSnapshot();
    grid = createEmptyGrid(cols, rows); walls = { h:createWallH(rows,cols), v:createWallV(rows,cols) }; doors = { h:createWallH(rows,cols), v:createWallV(rows,cols) }; props = []; render();
  });
  clearGridBtn.addEventListener('click', ()=>{ if(confirm('Clear grid and props?')){ pushSnapshot(); grid=createEmptyGrid(cols,rows); props=[]; walls={h:createWallH(rows,cols),v:createWallV(rows,cols)}; doors={h:createWallH(rows,cols),v:createWallV(rows,cols)}; render(); } });

  undoBtn.addEventListener('click', undo); redoBtn.addEventListener('click', redo);
  sideTabs.forEach(btn => btn.addEventListener('click', ()=>{ sideTabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); tabSwitch(btn.dataset.tab); }));
  toggleSidebar.addEventListener('click', ()=>{ document.getElementById('sidebar').classList.toggle('collapsed'); });

  // initial
  buildLibrary();
  updateUndoButtons();
  setVisualScale(1.0);
  render();

  // small helpers
  function tabSwitch(tab){
    if(tab==='tools'){ tabTools.classList.remove('hidden'); tabProps.classList.add('hidden'); }
    else { tabTools.classList.add('hidden'); tabProps.classList.remove('hidden'); }
  }

  function render() { resizeCanvas(); ctx.fillStyle='#071018'; ctx.fillRect(0,0,canvas.width,canvas.height); for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ const v=grid[y][x]; if(v){ ctx.fillStyle = (typeof v==='string')?v:'#8fd3a6'; ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize); } } ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1; for(let x=0;x<=cols;x++){ ctx.beginPath(); ctx.moveTo(x*tileSize+0.5,0); ctx.lineTo(x*tileSize+0.5,rows*tileSize); ctx.stroke(); } for(let y=0;y<=rows;y++){ ctx.beginPath(); ctx.moveTo(0,y*tileSize+0.5); ctx.lineTo(cols*tileSize,y*tileSize+0.5); ctx.stroke(); } const wth=Math.max(2,Math.floor(tileSize*0.33)); ctx.fillStyle='#000'; for(let hy=0;hy<walls.h.length;hy++) for(let x=0;x<cols;x++) if(walls.h[hy][x]){ const ypix=hy*tileSize - Math.floor(wth/2); ctx.fillRect(x*tileSize, ypix, tileSize, wth); } for(let y=0;y<rows;y++) for(let vx=0;vx<walls.v[y].length;vx++) if(walls.v[y][vx]){ const xpix=vx*tileSize - Math.floor(wth/2); ctx.fillRect(xpix, y*tileSize, wth, tileSize); } const dth=Math.max(3,Math.floor(tileSize*0.5)); ctx.fillStyle='#8b5a2b'; for(let hy=0;hy<doors.h.length;hy++) for(let x=0;x<cols;x++) if(doors.h[hy][x]){ const ypix=hy*tileSize - Math.floor(dth/2); ctx.fillRect(x*tileSize, ypix, tileSize, dth); } for(let y=0;y<rows;y++) for(let vx=0;vx<doors.v[y].length;vx++) if(doors.v[y][vx]){ const xpix=vx*tileSize - Math.floor(dth/2); ctx.fillRect(xpix, y*tileSize, dth, tileSize); } renderPropsDOM(); updatePlacedList(); updateMapInfo(); }

  function resizeCanvas(){ const w=cols*tileSize, h=rows*tileSize; canvas.width=w; canvas.height=h; canvas.style.width=w+'px'; canvas.style.height=h+'px'; propLayer.style.width=canvas.style.width; propLayer.style.height=canvas.style.height; }

  function updateMapInfo(){ mapInfo.textContent = `Size: ${cols} x ${rows} tiles\nTile: ${tileSize}px\nProps: ${props.length}`; }

  // utilities
  function createEmptyGrid(c,r){ const g=new Array(r); for(let y=0;y<r;y++) g[y]=new Array(c).fill(0); return g; }
  function cloneGrid(g){ return g.map(row=>row.slice()); }
  function createWallH(r,c){ const a=new Array(r+1); for(let y=0;y<r+1;y++) a[y]=new Array(c).fill(false); return a; }
  function createWallV(r,c){ const a=new Array(r); for(let y=0;y<r;y++) a[y]=new Array(c+1).fill(false); return a; }
  function clone2D(a){ return a.map(row=>row.slice()); }
  function uid(pref='p'){ return pref + Date.now().toString(36) + Math.floor(Math.random()*1000).toString(36); }

  // expose registerProp globally
  window.registerProp = registerProp;
})();