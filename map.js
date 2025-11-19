/* map builder: supports doors and secret passages, manual placement, reveal toggle */
(function(){
  // DOM
  const els = {
    mapCanvas: document.getElementById('mapCanvas'),
    genMap: document.getElementById('genMap'),
    clearMap: document.getElementById('clearMap'),
    exportMap: document.getElementById('exportMap'),
    mapWidth: document.getElementById('mapWidth'),
    mapHeight: document.getElementById('mapHeight'),
    tileSize: document.getElementById('tileSize'),
    roomCount: document.getElementById('roomCount'),
    minRoom: document.getElementById('minRoom'),
    maxRoom: document.getElementById('maxRoom'),
    placeProps: document.getElementById('placeProps'),
    propDensity: document.getElementById('propDensity'),
    mapInfo: document.getElementById('mapInfo'),
    selInfo: document.getElementById('selInfo'),
    doorList: document.getElementById('doorList'),
    secretList: document.getElementById('secretList'),
    propList: document.getElementById('propList'),
    modePan: document.getElementById('modePan'),
    modeDoor: document.getElementById('modeDoor'),
    modeSecret: document.getElementById('modeSecret'),
    modeRemove: document.getElementById('modeRemove'),
    revealSecrets: document.getElementById('revealSecrets'),
    autoDoors: document.getElementById('autoDoors')
  };

  // state
  let state = {
    seed: Math.floor(Math.random()*0xFFFFFFFF),
    map: null,
    selected: null,
    mode: 'pan' // pan | door | secret | remove
  };

  function setMode(modeBtn, modeName){
    state.mode = modeName;
    [els.modePan, els.modeDoor, els.modeSecret, els.modeRemove].forEach(b=>b.classList.remove('active'));
    modeBtn.classList.add('active');
  }
  setMode(els.modePan, 'pan');

  els.modePan.addEventListener('click', ()=> setMode(els.modePan,'pan'));
  els.modeDoor.addEventListener('click', ()=> setMode(els.modeDoor,'door'));
  els.modeSecret.addEventListener('click', ()=> setMode(els.modeSecret,'secret'));
  els.modeRemove.addEventListener('click', ()=> setMode(els.modeRemove,'remove'));

  // generation logic (based on earlier generator, with door/secret support)
  function generateMap(opts){
    const rng = SHARED.createPRNG(opts.seed);
    const width = opts.width, height = opts.height;
    const grid = Array.from({length:height}, ()=> new Array(width).fill(0)); // 0 wall,1 floor,2 corridor,3 door,4 secret-endpoint marker
    const rooms = [];

    // place rooms
    let attempts = 0;
    while (rooms.length < opts.roomCount && attempts < opts.roomCount * 12){
      attempts++;
      const w = rng.intRange(opts.minRoom, opts.maxRoom);
      const h = rng.intRange(opts.minRoom, opts.maxRoom);
      const x = Math.floor(rng.next() * (width - w - 2)) + 1;
      const y = Math.floor(rng.next() * (height - h - 2)) + 1;
      let ok = true;
      for (const r of rooms){
        const pad = rng.intRange(0,2);
        if (x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y) { ok = false; break; }
      }
      if (!ok) continue;
      rooms.push({x,y,w,h});
      for (let yy=y; yy<y+h; yy++){
        for (let xx=x; xx<x+w; xx++){
          grid[yy][xx] = 1;
        }
      }
    }

    // connect centers with MST-ish edges, carve corridors
    function center(r){ return {cx: Math.floor(r.x + r.w/2), cy: Math.floor(r.y + r.h/2)} }
    const centers = rooms.map(center);
    const connected = new Set();
    const edges = [];
    if (centers.length){
      connected.add(0);
      while (connected.size < centers.length){
        let best=null; let bestDist=Infinity;
        for (const aIdx of connected){
          for (let bIdx=0;bIdx<centers.length;bIdx++){
            if (connected.has(bIdx)) continue;
            const a=centers[aIdx], b=centers[bIdx];
            const dx=a.cx-b.cx, dy=a.cy-b.cy; const d=dx*dx+dy*dy;
            if (d<bestDist || (d===bestDist && rng.next()<0.5)){ bestDist=d; best={aIdx,bIdx} }
          }
        }
        if (!best) break;
        edges.push(best); connected.add(best.bIdx);
      }
    }

    function carve(ax,ay,bx,by){
      let x=ax,y=ay;
      while (x!==bx || y!==by){
        grid[y][x] = grid[y][x] === 1 ? 1 : 2; // keep floors as floor, corridors as corridor
        if (x !== bx && rng.next() < 0.6) x += Math.sign(bx-x);
        if (y !== by && rng.next() < 0.6) y += Math.sign(by-y);
      }
      grid[by][bx] = grid[by][bx] === 1 ? 1 : 2;
    }

    for (const e of edges){
      const a=centers[e.aIdx], b=centers[e.bIdx];
      carve(a.cx,a.cy,b.cx,b.cy);
      // sometimes branch
      if (rng.next()<0.25){ const c=centers[rng.intRange(0,centers.length-1)]; carve(b.cx,b.cy,c.cx,c.cy); }
    }

    // add extra tunnels & secret endpoints (mark endpoints as 4)
    const extra = Math.max(1, Math.floor(rooms.length * 0.15));
    const secretEndpoints = [];
    for (let i=0;i<extra;i++){
      const a = centers[rng.intRange(0,centers.length-1)];
      const b = centers[rng.intRange(0,centers.length-1)];
      carve(a.cx,a.cy,b.cx,b.cy);
      // pick a random spot along corridor to mark as secret endpoint (if it's adjacent to wall)
      for (let t=0;t<10;t++){
        const sx = rng.intRange(Math.min(a.cx,b.cx), Math.max(a.cx,b.cx));
        const sy = rng.intRange(Math.min(a.cy,b.cy), Math.max(a.cy,b.cy));
        if (grid[sy][sx] === 2){
          // find adjacent wall tile to create a secret entrance into room
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          for (const d of dirs){
            const wx = sx + d[0], wy = sy + d[1];
            if (wx>0 && wx<width-1 && wy>0 && wy<height-1 && grid[wy][wx]===0){
              grid[wy][wx] = 4; // secret endpoint in wall
              secretEndpoints.push({x:wx,y:wy});
              break;
            }
          }
          break;
        }
      }
    }

    // auto-place doors: for any corridor tile next to a floor tile at room edge, mark door (3)
    const doors = [];
    for (let y=1;y<height-1;y++){
      for (let x=1;x<width-1;x++){
        if (grid[y][x] === 2){
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          for (const d of dirs){
            const nx = x + d[0], ny = y + d[1];
            if (grid[ny][nx] === 1){
              // find boundary tile between corridor and room wall; prefer the room-adjacent wall tile position
              const dx = x - nx, dy = y - ny;
              const doorX = nx - dx, doorY = ny - dy;
              if (doorX > 0 && doorX < width && doorY > 0 && doorY < height){
                // Only add door if it's a wall or floor (avoid replacing other doors)
                if (grid[doorY][doorX] === 0 || grid[doorY][doorX] === 1){
                  // push but don't immediately place — allow caller to choose auto-place option
                  doors.push({x:doorX,y:doorY});
                }
              }
            }
          }
        }
      }
    }

    // props placement (simple)
    const propTypes = ['brazier','chest','tapestry','altar','shelf','table','trap','bones'];
    const props = [];
    if (opts.placeProps){
      for (let ri=0;ri<rooms.length;ri++){
        const r = rooms[ri];
        const area = r.w * r.h;
        const maxProps = Math.floor((area/12) * opts.propDensity) + (rng.next() < opts.propDensity ? 1 : 0);
        for (let p=0;p<maxProps;p++){
          let tries=0;
          while (tries<20){
            tries++;
            const px = rng.intRange(r.x, r.x + r.w - 1);
            const py = rng.intRange(r.y, r.y + r.h - 1);
            if (grid[py][px] === 1 && !props.find(pp=>pp.x===px && pp.y===py)){
              props.push({x:px,y:py,room:ri,type:rng.choice(propTypes)});
              break;
            }
          }
        }
      }
    }

    // room index grid
    const roomIndexGrid = Array.from({length:height}, ()=> new Array(width).fill(-1));
    rooms.forEach((r, idx)=>{
      for (let yy=r.y; yy<r.y+r.h; yy++){
        for (let xx=r.x; xx<r.x+r.w; xx++){
          roomIndexGrid[yy][xx] = idx;
        }
      }
    });

    return {grid, rooms, roomIndexGrid, width, height, doors, secretEndpoints, props};
  }

  function drawMap(map, tileSize, selected, revealSecrets){
    const c = els.mapCanvas;
    const w = map.width * tileSize, h = map.height * tileSize;
    c.width = w; c.height = h; c.style.width = w+'px'; c.style.height = h+'px';
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#061021'; ctx.fillRect(0,0,w,h);

    for (let y=0;y<map.height;y++){
      for (let x=0;x<map.width;x++){
        const v = map.grid[y][x];
        let color;
        if (selected && selected.x===x && selected.y===y) color = getComputedStyle(document.documentElement).getPropertyValue('--tile-door').trim();
        else if (map.roomIndexGrid[y][x] >= 0) color = '#e6eef8';
        else if (v === 2) color = '#bbf7d0';
        else color = '#071224';
        ctx.fillStyle = color; ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }

    // draw doors (placed)
    for (const d of map.doors || []) {
      ctx.beginPath();
      ctx.fillStyle = 'var(--tile-door)';
      ctx.arc(d.x*tileSize + tileSize/2, d.y*tileSize + tileSize/2, Math.max(2, tileSize/3), 0, Math.PI*2);
      ctx.fill();
    }

    // draw secret endpoints only if revealSecrets true
    if (revealSecrets) {
      for (const s of map.secretEndpoints || []) {
        ctx.beginPath();
        ctx.fillStyle = 'var(--tile-secret)';
        ctx.arc(s.x*tileSize + tileSize/2, s.y*tileSize + tileSize/2, Math.max(2, tileSize/3), 0, Math.PI*2);
        ctx.fill();
      }
    }

    // props
    for (const p of map.props || []) {
      ctx.beginPath();
      ctx.fillStyle = '#f97316';
      ctx.globalAlpha = 0.9;
      ctx.arc(p.x*tileSize + tileSize/2, p.y*tileSize + tileSize/2, Math.max(1, tileSize/4), 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // subtle grid
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.5;
    for (let x=0;x<=map.width;x++){ ctx.beginPath(); ctx.moveTo(x*tileSize+0.5,0); ctx.lineTo(x*tileSize+0.5,h); ctx.stroke(); }
    for (let y=0;y<=map.height;y++){ ctx.beginPath(); ctx.moveTo(0,y*tileSize+0.5); ctx.lineTo(w,y*tileSize+0.5); ctx.stroke(); }
  }

  // helpers
  function posToTile(evt, tileSize){
    const rect = els.mapCanvas.getBoundingClientRect();
    const cx = (evt.clientX - rect.left) * (els.mapCanvas.width / rect.width);
    const cy = (evt.clientY - rect.top) * (els.mapCanvas.height / rect.height);
    return {x: Math.floor(cx / tileSize), y: Math.floor(cy / tileSize)};
  }

  // UI actions
  els.genMap.addEventListener('click', ()=>{
    const opts = {
      seed: state.seed,
      width: parseInt(els.mapWidth.value,10),
      height: parseInt(els.mapHeight.value,10),
      roomCount: parseInt(els.roomCount.value,10),
      minRoom: parseInt(els.minRoom.value,10),
      maxRoom: parseInt(els.maxRoom.value,10),
      placeProps: !!els.placeProps.checked,
      propDensity: parseFloat(els.propDensity.value)
    };
    state.map = generateMap(opts);
    // by default, don't commit auto-doors; let user press autoDoors
    state.map.doors = [];
    state.map.secretEndpoints = state.map.secretEndpoints || [];
    state.map.revealedSecrets = false;
    updateInfo();
    drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, false);
  });

  els.clearMap.addEventListener('click', ()=>{
    state.map = null; state.selected = null;
    const ctx = els.mapCanvas.getContext('2d'); ctx.clearRect(0,0,els.mapCanvas.width, els.mapCanvas.height);
    els.mapInfo.textContent = 'Cleared';
    els.selInfo.textContent = 'No selection';
    els.doorList.textContent = 'Doors: 0';
    els.secretList.textContent = 'Secret endpoints: 0';
    els.propList.textContent = 'Props: 0';
  });

  els.exportMap.addEventListener('click', ()=>{
    if (!state.map) { alert('No map to export'); return; }
    SHARED.downloadJSON('dungeon-map-with-doors.json', {
      seed: state.seed,
      width: state.map.width,
      height: state.map.height,
      rooms: state.map.rooms,
      grid: state.map.grid,
      doors: state.map.doors || [],
      secretEndpoints: state.map.secretEndpoints || [],
      props: state.map.props || []
    });
  });

  els.autoDoors.addEventListener('click', ()=>{
    if (!state.map) return;
    // place each suggested door if not already present
    const seen = new Set((state.map.doors||[]).map(d=>`${d.x},${d.y}`));
    for (const d of state.map.doorsCandidate || state.map.doors || []) {
      if (!seen.has(`${d.x},${d.y}`)) {
        state.map.doors.push({x:d.x,y:d.y,locked:false});
        seen.add(`${d.x},${d.y}`);
      }
    }
    // fallback: attempt to detect doors now (simple detection)
    if (!state.map.doors.length) {
      // place doors where corridor meets room edge
      const width = state.map.width, height = state.map.height;
      for (let y=1;y<height-1;y++){
        for (let x=1;x<width-1;x++){
          if (state.map.grid[y][x] === 2){
            const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            for (const d of dirs){
              const nx = x + d[0], ny = y + d[1];
              if (state.map.roomIndexGrid[ny] && state.map.roomIndexGrid[ny][nx] >= 0){
                // door at boundary between corridor and room: place at room-adjacent tile
                const dx = x - nx, dy = y - ny;
                const doorX = nx - dx, doorY = ny - dy;
                if (doorX>0 && doorX<state.map.width && doorY>0 && doorY<state.map.height){
                  if (!state.map.doors.find(dd=>dd.x===doorX && dd.y===doorY)) state.map.doors.push({x:doorX,y:doorY,locked:false});
                }
              }
            }
          }
        }
      }
    }
    updateInfo(); drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, state.map.revealedSecrets);
  });

  // click canvas for edit actions
  els.mapCanvas.addEventListener('click', (evt)=>{
    if (!state.map) return;
    const tileSize = parseInt(els.tileSize.value,10);
    const t = posToTile(evt, tileSize);
    if (t.x < 0 || t.x >= state.map.width || t.y < 0 || t.y >= state.map.height) return;
    state.selected = t;

    if (state.mode === 'door'){
      // toggle door at tile
      const existing = (state.map.doors||[]).find(d=>d.x===t.x && d.y===t.y);
      if (existing) state.map.doors = state.map.doors.filter(d=>!(d.x===t.x && d.y===t.y));
      else (state.map.doors = state.map.doors||[]).push({x:t.x,y:t.y,locked:false});
      updateInfo();
    } else if (state.mode === 'secret'){
      // toggle secret endpoint (on wall tiles only)
      const existing = (state.map.secretEndpoints||[]).find(s=>s.x===t.x && s.y===t.y);
      if (existing) state.map.secretEndpoints = state.map.secretEndpoints.filter(s=>!(s.x===t.x && s.y===t.y));
      else (state.map.secretEndpoints = state.map.secretEndpoints||[]).push({x:t.x,y:t.y});
      updateInfo();
    } else if (state.mode === 'remove'){
      // remove door or secret or prop at that tile
      state.map.doors = (state.map.doors||[]).filter(d=>!(d.x===t.x && d.y===t.y));
      state.map.secretEndpoints = (state.map.secretEndpoints||[]).filter(s=>!(s.x===t.x && s.y===t.y));
      state.map.props = (state.map.props||[]).filter(p=>!(p.x===t.x && p.y===t.y));
      updateInfo();
    } else {
      // pan / select: show selection info
    }

    // redraw
    drawMap(state.map, tileSize, state.selected, state.map.revealedSecrets || els.revealSecrets.checked);
    const ridx = state.map.roomIndexGrid[t.y] ? state.map.roomIndexGrid[t.y][t.x] : -1;
    els.selInfo.textContent = `Tile: (${t.x},${t.y}) — type:${state.map.grid[t.y][t.x]} room:${ridx}`;
  });

  // reveal secrets toggle
  els.revealSecrets.addEventListener('change', ()=>{
    if (!state.map) return;
    state.map.revealedSecrets = !!els.revealSecrets.checked;
    drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, state.map.revealedSecrets);
  });

  function updateInfo(){
    if (!state.map){ els.mapInfo.textContent = 'No map yet'; return; }
    els.mapInfo.textContent = `Rooms: ${state.map.rooms.length}  Props: ${state.map.props.length}`;
    els.doorList.textContent = `Doors: ${state.map.doors ? state.map.doors.length : 0}`;
    els.secretList.textContent = `Secret endpoints: ${state.map.secretEndpoints ? state.map.secretEndpoints.length : 0}`;
    els.propList.textContent = `Props: ${state.map.props ? state.map.props.length : 0}`;
  }

  // initial mini-canvas hint
  (function initCanvas(){
    els.mapCanvas.width = 640; els.mapCanvas.height = 480;
    const ctx = els.mapCanvas.getContext('2d'); ctx.fillStyle = '#071224'; ctx.fillRect(0,0,els.mapCanvas.width, els.mapCanvas.height);
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.fillText('Generate a map to begin', 12, 20);
  })();

  // expose for console/debug
  window.MapBuilder = {
    state, generateMap, drawMap
  };
})();