/* map builder — minimal mode:
   - **No props at all** (no SVG image, no prop UI, no prop placement)
   - **No door or secret door UI or placement** (all logic and UI hooks for doors/secrets removed/disabled)
   - **Map window size is fixed** to its CSS/container area (does not stretch to screen)
   - **Square rooms only in man-made**, **rounded/cave rooms only in cave mode**
   - All panning/zooming only moves the world, not the canvas element/view area
*/
(function(){
  const els = {
    mapCanvas: document.getElementById('mapCanvas'),
    mapWrap: document.getElementById('mapWrap'),
    genMap: document.getElementById('genMap'),
    clearMap: document.getElementById('clearMap'),
    exportMap: document.getElementById('exportMap'),
    mapWidth: document.getElementById('mapWidth'),
    mapHeight: document.getElementById('mapHeight'),
    tileSize: document.getElementById('tileSize'),
    roomCount: document.getElementById('roomCount'),
    minRoom: document.getElementById('minRoom'),
    maxRoom: document.getElementById('maxRoom'),
    mapInfo: document.getElementById('mapInfo'),
    selInfo: document.getElementById('selInfo'),
    modePan: document.getElementById('modePan'),
    revealSecrets: document.getElementById('revealSecrets'),
    hallwayStyle: document.getElementById('hallwayStyle'),
    mainRoom: document.getElementById('mainRoom'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    resetZoom: document.getElementById('resetZoom')
  };

  let state = {
    seed: null,
    map: null,
    selected: null,
    mode: 'pan',
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    panStart: null
  };

  function setMode(btn, name){
    state.mode = name;
    [els.modePan].forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
  }
  setMode(els.modePan,'pan');
  els.modePan.addEventListener('click', ()=> setMode(els.modePan,'pan'));

  // random helpers
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function inBounds(map,x,y){ return x>=0 && x<map.width && y>=0 && y<map.height; }
  function isFloorLike(v){ return v === 1 || v === 2; }

  function generateMap(opts){
    state.seed = Date.now() & 0xFFFFFFFF;
    const rng = SHARED.createPRNG(state.seed);
    const width = opts.width, height = opts.height;
    const grid = Array.from({length:height}, ()=> new Array(width).fill(0)); // 0 wall,1 room-floor,2 corridor
    const rooms = [];
    const layout = (els.hallwayStyle && els.hallwayStyle.value) || 'manmade';

    // optional main room placement; only square for manmade, only cave-carved for cave
    if(els.mainRoom && els.mainRoom.checked && rng.next() < 0.9){
      const mw = clamp(Math.floor(opts.maxRoom * (1.2 + rng.next()*0.6)), opts.maxRoom+1, Math.floor(Math.min(width,height)/2)-2);
      const mh = clamp(Math.floor(opts.maxRoom * (1.1 + rng.next()*0.5)), opts.maxRoom+1, Math.floor(Math.min(width,height)/2)-2);
      const mx = rng.intRange(1, Math.max(1, width-mw-2));
      const my = rng.intRange(1, Math.max(1, height-mh-2));
      if(layout === 'manmade'){
        const main = {x:mx, y:my, w:mw, h:mh, main:true, type:'manmade'};
        rooms.push(main);
        for(let yy=my; yy<my+mh; yy++) for(let xx=mx; xx<mx+mw; xx++) grid[yy][xx] = 1;
      } else {
        const main = {x:mx, y:my, w:mw, h:mh, main:true, type:'cave'};
        rooms.push(main);
        const fillCount = Math.max(Math.floor((mw*mh)*0.6), Math.floor((mw*mh)*(0.6 + rng.next()*0.3)));
        let cx = mx + Math.floor(mw/2), cy = my + Math.floor(mh/2);
        for(let i=0;i<fillCount;i++){
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
            const nx = cx+dx, ny = cy+dy;
            if(inBounds({width,height}, nx, ny) && nx>=mx && nx<mx+mw && ny>=my && ny<my+mh && rng.next()<0.72) grid[ny][nx] = 1;
          }
          const dir = rng.intRange(0,3);
          if(dir===0 && cx+1 < mx+mw) cx++;
          if(dir===1 && cx-1 >= mx) cx--;
          if(dir===2 && cy+1 < my+mh) cy++;
          if(dir===3 && cy-1 >= my) cy--;
        }
        // roughen a little for boss cave
        for(let yy=my; yy<my+mh; yy++) for(let xx=mx; xx<mx+mw; xx++){
          if(grid[yy][xx] === 1 && rng.next()<0.12){
            const adjWalls = [[1,0],[-1,0],[0,1],[0,-1]].filter(d=> !inBounds({width,height},xx+d[0],yy+d[1]) || grid[yy+d[1]][xx+d[0]]===0).length;
            if(adjWalls >= 3 && rng.next()<0.5) grid[yy][xx]=0;
          }
        }
      }
    }

    // rest of rooms: square in manmade, cave-blobs in cave
    let attempts = 0;
    while(rooms.filter(r=>!r.main).length < opts.roomCount && attempts < opts.roomCount*30){
      attempts++;
      const w = rng.intRange(opts.minRoom, opts.maxRoom);
      const h = rng.intRange(opts.minRoom, opts.maxRoom);
      const x = rng.intRange(1, Math.max(1, width-w-2));
      const y = rng.intRange(1, Math.max(1, height-h-2));
      let ok = true; for(const r of rooms){ const pad=rng.intRange(0,2); if(x < r.x+r.w+pad && x+w+pad>r.x && y < r.y+r.h+pad && y+h+pad>r.y){ ok=false; break; } }
      if(!ok) continue;
      if(layout === 'manmade'){
        const room = {x, y, w, h, type:'manmade'};
        rooms.push(room);
        for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) grid[yy][xx]=1;
      } else{
        const room = {x, y, w, h, type:'cave'};
        rooms.push(room);
        const fillCount = Math.max(Math.floor((w*h)*0.5), Math.floor((w*h)*(0.6 + rng.next()*0.4)));
        let cx = x + Math.floor(w/2), cy = y + Math.floor(h/2);
        for(let i=0;i<fillCount;i++){
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
            const nx = cx+dx, ny = cy+dy;
            if(inBounds({width,height}, nx, ny) && nx>=x && nx<x+w && ny>=y && ny<y+h && rng.next() < 0.65) grid[ny][nx]=1;
          }
          const dir = rng.intRange(0,3);
          if(dir===0 && cx+1 < x+w) cx++;
          if(dir===1 && cx-1 >= x) cx--;
          if(dir===2 && cy+1 < y+h) cy++;
          if(dir===3 && cy-1 >= y) cy--;
        }
      }
    }

    // connect rooms (MST-ish), cave skips some
    function center(r){ return {cx: Math.floor(r.x + r.w/2), cy: Math.floor(r.y + r.h/2)} }
    const centers = rooms.map(center);
    const connected = new Set(); const edges = [];
    if(centers.length){
      connected.add(0);
      while(connected.size < centers.length){
        let best=null, bestDist=Infinity;
        for(const aIdx of connected){
          for(let bIdx=0;bIdx<centers.length;bIdx++){
            if(connected.has(bIdx)) continue;
            const a = centers[aIdx], b = centers[bIdx];
            const d = (a.cx-b.cx)*(a.cx-b.cx) + (a.cy-b.cy)*(a.cy-b.cy);
            if(d < bestDist){ bestDist = d; best = {aIdx,bIdx}; }
          }
        }
        if(!best) break;
        edges.push(best); connected.add(best.bIdx);
      }
    }
    function carveCorridor(ax,ay,bx,by){
      if(layout === 'manmade'){
        if(rng.next()<0.5){
          const midx = Math.floor((ax+bx)/2);
          for(let x=Math.min(ax,midx); x<=Math.max(ax,midx); x++) grid[ay][x]=2;
          for(let y=Math.min(ay,by); y<=Math.max(ay,by); y++) grid[y][midx]=2;
          for(let x=Math.min(midx,bx); x<=Math.max(midx,bx); x++) grid[by][x]=2;
        } else {
          const midy = Math.floor((ay+by)/2);
          for(let y=Math.min(ay,midy); y<=Math.max(ay,midy); y++) grid[y][ax]=2;
          for(let x=Math.min(ax,bx); x<=Math.max(ax,bx); x++) grid[midy][x]=2;
          for(let y=Math.min(midy,by); y<=Math.max(midy,by); y++) grid[y][bx]=2;
        }
      } else {
        let x=ax, y=ay, steps=0, max = Math.abs(ax-bx)+Math.abs(ay-by)+25;
        while((x!==bx || y!==by) && steps++ < max){
          grid[y][x]=2;
          const dx=bx-x, dy=by-y;
          if(Math.abs(dx)>Math.abs(dy)) x+=Math.sign(dx); else y+=Math.sign(dy);
          if(rng.next()<0.12){
            const j = rng.next()<0.5 ? -1 : 1;
            if(rng.next()<0.6 && x+j>0 && x+j<width-1) grid[y][x+j]=2;
            if(rng.next()<0.4 && y+j>0 && y+j<height-1) grid[y+j][x]=2;
          }
        }
        grid[by][bx]=2;
      }
    }
    for(const e of edges){
      const a = centers[e.aIdx], b = centers[e.bIdx];
      if(layout==='cave' && rng.next()<0.35) continue;
      carveCorridor(a.cx,a.cy,b.cx,b.cy);
    }

    // build roomIndexGrid for tile info UI
    const roomIndexGrid = Array.from({length:height}, ()=> new Array(width).fill(-1));
    rooms.forEach((r, idx)=>{ for(let yy=r.y; yy<r.y+r.h; yy++) for(let xx=r.x; xx<r.x+r.w; xx++) if(inBounds({width,height},xx,yy) && grid[yy][xx]===1) roomIndexGrid[yy][xx] = idx; });

    return {grid, rooms, roomIndexGrid, width, height};
  }

  // drawMap: fixed CSS window area (never grows), pan/zoom only world transform, no props/doors
  function drawMap(map, baseTileSize, selected){
    if(!map) return;
    const wrapRect = els.mapWrap.getBoundingClientRect();
    const cssW = 800; // fixed size for map window
    const cssH = 600;
    const dpr = window.devicePixelRatio || 1;
    const canvas = els.mapCanvas;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');

    // zoom/pan: scale + offset, *dpr
    ctx.setTransform(dpr * state.scale, 0, 0, dpr * state.scale, state.offsetX * dpr, state.offsetY * dpr);
    ctx.clearRect(-10000, -10000, 20000, 20000);
    const tile = baseTileSize;

    // draw base tiles
    for(let y=0;y<map.height;y++){
      for(let x=0;x<map.width;x++){
        const v = map.grid[y][x];
        let color = '#071224';
        if(map.roomIndexGrid[y][x] >= 0) color = '#e6eef8';
        else if(v === 2) color = '#bbf7d0';
        ctx.fillStyle = color;
        ctx.fillRect(x*tile, y*tile, tile, tile);
      }
    }

    // outlines
    for(const r of map.rooms){
      if(r.type === 'manmade'){
        ctx.lineWidth = Math.max(2, Math.floor(tile/4));
        ctx.strokeStyle = '#000';
        ctx.strokeRect(r.x*tile + 0.5, r.y*tile + 0.5, r.w*tile - 1, r.h*tile - 1);
      } else {
        ctx.lineWidth = Math.max(1, Math.floor(tile/6));
        ctx.strokeStyle = '#000';
        for(let yy=r.y; yy<r.y+r.h; yy++){
          for(let xx=r.x; xx<r.x+r.w; xx++){
            if(map.grid[yy][xx] !== 1) continue;
            if(!inBounds(map,xx+1,yy) || map.grid[yy][xx+1] === 0){ ctx.beginPath(); ctx.moveTo((xx+1)*tile+0.5, yy*tile+0.5); ctx.lineTo((xx+1)*tile+0.5, (yy+1)*tile-0.5); ctx.stroke(); }
            if(!inBounds(map,xx-1,yy) || map.grid[yy][xx-1] === 0){ ctx.beginPath(); ctx.moveTo(xx*tile+0.5, yy*tile+0.5); ctx.lineTo(xx*tile+0.5, (yy+1)*tile-0.5); ctx.stroke(); }
            if(!inBounds(map,xx,yy+1) || map.grid[yy+1][xx] === 0){ ctx.beginPath(); ctx.moveTo(xx*tile+0.5, (yy+1)*tile+0.5); ctx.lineTo((xx+1)*tile-0.5, (yy+1)*tile+0.5); ctx.stroke(); }
            if(!inBounds(map,xx,yy-1) || map.grid[yy-1][xx] === 0){ ctx.beginPath(); ctx.moveTo(xx*tile+0.5, yy*tile+0.5); ctx.lineTo((xx+1)*tile-0.5, yy*tile+0.5); ctx.stroke(); }
          }
        }
      }
    }

    // corridor edge strokes
    ctx.lineWidth = Math.max(1, Math.floor(tile/8)); ctx.strokeStyle = '#000';
    for(let y=1;y<map.height-1;y++){
      for(let x=1;x<map.width-1;x++){
        if(map.grid[y][x] !== 2) continue;
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{
          const nx = x + d[0], ny = y + d[1];
          if(inBounds(map,nx,ny) && map.grid[ny][nx] === 0){
            ctx.beginPath();
            if(d[0]===1){ ctx.moveTo((x+1)*tile+0.5, y*tile+0.5); ctx.lineTo((x+1)*tile+0.5, (y+1)*tile-0.5); }
            else if(d[0]===-1){ ctx.moveTo(x*tile+0.5,y*tile+0.5); ctx.lineTo(x*tile+0.5,(y+1)*tile-0.5); }
            else if(d[1]===1){ ctx.moveTo(x*tile+0.5,(y+1)*tile+0.5); ctx.lineTo((x+1)*tile-0.5,(y+1)*tile+0.5); }
            else { ctx.moveTo(x*tile+0.5,y*tile+0.5); ctx.lineTo((x+1)*tile-0.5,y*tile+0.5); }
            ctx.stroke();
          }
        });
      }
    }

    // selection stroke
    if(selected){
      ctx.strokeStyle = 'rgba(255,215,75,0.95)'; ctx.lineWidth = Math.max(2, Math.floor(tile/10));
      ctx.strokeRect(selected.x*tile + 0.5, selected.y*tile + 0.5, tile - 1, tile - 1);
    }

    ctx.setTransform(1,0,0,1,0,0);
    // UI info
    if(state.selected && map){
      const sx = state.selected.x, sy = state.selected.y;
      const rid = (sy >= 0 && sy < map.roomIndexGrid.length && sx >= 0 && sx < map.roomIndexGrid[0].length) ? map.roomIndexGrid[sy][sx] : -1;
      const roomLabel = rid >= 0 ? `Room ${rid}` : 'None';
      els.mapInfo.textContent = `Rooms: ${map.rooms.length}`;
      els.selInfo.textContent = `Tile: (${sx},${sy}) — room: ${roomLabel}`;
    } else {
      els.mapInfo.textContent = `Rooms: ${map.rooms.length}`;
      els.selInfo.textContent = 'No selection';
    }
  }

  // pointer pan handlers (no other interactives, since no doors/props)
  els.mapCanvas.addEventListener('pointerdown', (evt)=>{
    state.isPanning = true;
    state.panStart = {x: evt.clientX, y: evt.clientY, offsetX: state.offsetX, offsetY: state.offsetY};
    try{ els.mapCanvas.setPointerCapture(evt.pointerId); }catch(e){}
    els.mapCanvas.style.cursor = 'grabbing';
  });
  els.mapCanvas.addEventListener('pointermove', (evt)=>{
    if(state.isPanning && state.panStart){
      const dx = evt.clientX - state.panStart.x, dy = evt.clientY - state.panStart.y;
      state.offsetX = state.panStart.offsetX + dx; state.offsetY = state.panStart.offsetY + dy;
      if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected);
    }
  });
  els.mapCanvas.addEventListener('pointerup', (evt)=>{
    if(state.isPanning){ state.isPanning = false; state.panStart = null; try{ els.mapCanvas.releasePointerCapture(evt.pointerId); }catch(e){} els.mapCanvas.style.cursor = 'crosshair'; }
  });
  els.mapCanvas.addEventListener('pointercancel', ()=>{ state.isPanning = false; state.panStart = null; els.mapCanvas.style.cursor = 'crosshair'; });

  els.mapCanvas.addEventListener('click', (evt)=>{
    // select tile (for info only)
    if(!state.map) return;
    const wrapRect = els.mapWrap.getBoundingClientRect();
    const cssW = 800, cssH = 600;
    const dpr = window.devicePixelRatio || 1;
    const cx = (evt.clientX - wrapRect.left) * (els.mapCanvas.width / cssW / dpr);
    const cy = (evt.clientY - wrapRect.top) * (els.mapCanvas.height / cssH / dpr);
    const worldX = (cx - state.offsetX) / state.scale, worldY = (cy - state.offsetY) / state.scale;
    const baseTile = parseInt(els.tileSize.value,10) || 12;
    const tx = Math.floor(worldX / baseTile), ty = Math.floor(worldY / baseTile);
    if(tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) return;
    state.selected = {x: tx, y: ty};
    drawMap(state.map, parseInt(els.tileSize.value,10), state.selected);
  });

  els.genMap.addEventListener('click', ()=>{
    const opts = {
      width: parseInt(els.mapWidth.value,10),
      height: parseInt(els.mapHeight.value,10),
      roomCount: parseInt(els.roomCount.value,10),
      minRoom: parseInt(els.minRoom.value,10),
      maxRoom: parseInt(els.maxRoom.value,10)
    };
    state.map = generateMap(opts);
    state.scale = 1.0; state.offsetX = 0; state.offsetY = 0;
    state.selected = null;
    drawMap(state.map, parseInt(els.tileSize.value,10), null);
  });

  els.clearMap.addEventListener('click', ()=>{
    state.map = null; state.selected = null; state.offsetX = 0; state.offsetY = 0; state.scale = 1.0;
    const ctx = els.mapCanvas.getContext('2d'); ctx.clearRect(0,0,els.mapCanvas.width, els.mapCanvas.height);
    els.mapInfo.textContent = 'Cleared'; els.selInfo.textContent = 'No selection';
  });

  els.exportMap.addEventListener('click', ()=>{
    if(!state.map){ alert('No map to export'); return; }
    SHARED.downloadJSON('dungeon-map.json', state.map);
  });

  els.zoomIn.addEventListener('click', ()=>{ state.scale = clamp(state.scale + 0.15, 0.25, 3.0); if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected); });
  els.zoomOut.addEventListener('click', ()=>{ state.scale = clamp(state.scale - 0.15, 0.25, 3.0); if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected); });
  els.resetZoom.addEventListener('click', ()=>{ state.scale = 1.0; state.offsetX = 0; state.offsetY = 0; if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected); });

  (function initCanvas(){
    els.mapCanvas.width = 800; els.mapCanvas.height = 600;
    els.mapCanvas.style.width = '800px'; els.mapCanvas.style.height = '600px';
    const ctx = els.mapCanvas.getContext('2d'); ctx.fillStyle = '#071224'; ctx.fillRect(0,0,800,600);
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.fillText('Generate a map to begin', 12, 20);
  })();

  window.MapBuilder = { state, generateMap, drawMap };

})();