/* map builder — corrected and restored interactivity
   - Fixes so Generate actually creates a map and draws it.
   - Pan (pointer drag) and zoom (overlay) work and do not change the viewing area's CSS size.
   - Door & secret placement works (edge-based, only in Man-Made mode for auto).
   - Tooltip on hover shows prop names (fixed world->screen math).
   - Robust, defensive code: checks for state.map, uses shared PRNG, redraws when images load.
*/
(function(){
  const els = {
    mapCanvas: document.getElementById('mapCanvas'),
    mapWrap: document.getElementById('mapWrap'),
    propTooltip: document.getElementById('propTooltip'),
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
    autoDoors: document.getElementById('autoDoors'),
    hallwayStyle: document.getElementById('hallwayStyle'),
    mainRoom: document.getElementById('mainRoom'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    resetZoom: document.getElementById('resetZoom')
  };

  // state
  let state = {
    seed: null,
    map: null,
    selected: null,
    mode: 'pan',      // 'pan'|'door'|'secret'|'remove'
    scale: 1.0,       // render scale
    offsetX: 0,       // pan offset in CSS pixels
    offsetY: 0,
    isPanning: false,
    panStart: null
  };

  function setMode(btn, name){
    state.mode = name;
    [els.modePan, els.modeDoor, els.modeSecret, els.modeRemove].forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
  }
  setMode(els.modePan,'pan');

  els.modePan.addEventListener('click', ()=> setMode(els.modePan,'pan'));
  els.modeDoor.addEventListener('click', ()=> setMode(els.modeDoor,'door'));
  els.modeSecret.addEventListener('click', ()=> setMode(els.modeSecret,'secret'));
  els.modeRemove.addEventListener('click', ()=> setMode(els.modeRemove,'remove'));

  // inline SVG props
  const PROP_SVGS = {
    stalagmite: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path d='M22 6 L42 6 L32 40 Z' fill='%2388c0a3'/></svg>",
    stalactite: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path d='M22 6 L42 6 L32 40 Z' fill='%2388c0a3'/></svg>",
    crystal: "images/crystal.png",
    barrel: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='14' y='18' width='36' height='28' rx='6' fill='%23b97a2f' stroke='%233d2b10' stroke-width='1'/></svg>",
    crate: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='12' y='16' width='40' height='32' fill='%23c49a6c' stroke='%234e3520' stroke-width='1'/></svg>",
    table: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='12' y='22' width='40' height='18' rx='3' fill='%238b5a2b'/></svg>",
    chair: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='22' y='22' width='20' height='20' fill='%236b3f1a'/></svg>",
    shelf: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='14' width='48' height='6' fill='%236b5800'/><rect x='8' y='28' width='48' height='6' fill='%236b5800'/></svg>",
    brazier: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='26' r='10' fill='%23ff9f43'/><rect x='26' y='36' width='12' height='6' fill='%236b4d00'/></svg>",
    chest: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='10' y='20' width='44' height='28' rx='3' fill='%23a66c00' stroke='%233f2b00' stroke-width='1'/></svg>"
  };
  const _imgCache = {};
  function getPropImage(type){
    if(!_imgCache[type]){
      const img = new Image();
      img.src = PROP_SVGS[type] || PROP_SVGS['crate'];
      img.onload = ()=> { if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets)); };
      _imgCache[type] = img;
    }
    return _imgCache[type];
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function inBounds(map,x,y){ return x>=0 && x<map.width && y>=0 && y<map.height; }
  function isFloorLike(v){ return v === 1 || v === 2; }

  // label corridors to detect different corridor components
  function labelCorridors(grid){
    const h = grid.length, w = grid[0].length;
    const labels = Array.from({length:h}, ()=> new Array(w).fill(-1));
    let id = 0;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        if(grid[y][x] !== 2 || labels[y][x] !== -1) continue;
        // flood
        const stack = [[x,y]]; labels[y][x] = id;
        while(stack.length){
          const [cx,cy] = stack.pop();
          [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{
            const nx = cx+d[0], ny = cy+d[1];
            if(nx>=0 && nx<w && ny>=0 && ny<h && grid[ny][nx] === 2 && labels[ny][nx] === -1){
              labels[ny][nx] = id; stack.push([nx,ny]);
            }
          });
        }
        id++;
      }
    }
    return labels;
  }

  // generator (keeps cave/manmade rules); returns map object
  function generateMap(opts){
    state.seed = Date.now() & 0xFFFFFFFF;
    const rng = SHARED.createPRNG(state.seed);
    const width = opts.width, height = opts.height;
    const grid = Array.from({length:height}, ()=> new Array(width).fill(0)); // 0 wall,1 room-floor,2 corridor
    const rooms = [];
    const layout = (els.hallwayStyle && els.hallwayStyle.value) || 'manmade';

    // main room (may be cave type)
    if(els.mainRoom && els.mainRoom.checked && rng.next() < 0.9){
      const mw = clamp(Math.floor(opts.maxRoom * (1.2 + rng.next()*0.6)), opts.maxRoom+1, Math.floor(Math.min(width,height)/2)-2);
      const mh = clamp(Math.floor(opts.maxRoom * (1.1 + rng.next()*0.5)), opts.maxRoom+1, Math.floor(Math.min(width,height)/2)-2);
      const mx = rng.intRange(1, Math.max(1, width-mw-2));
      const my = rng.intRange(1, Math.max(1, height-mh-2));
      const main = {x:mx,y:my,w:mw,h:mh,main:true,type:(layout==='cave'?'cave':'manmade')};
      rooms.push(main);
      if(main.type === 'manmade'){
        for(let yy=my; yy<my+mh; yy++) for(let xx=mx; xx<mx+mw; xx++) grid[yy][xx] = 1;
      } else {
        // carve boss cave irregularly
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
        // slight roughening
        for(let yy=my; yy<my+mh; yy++) for(let xx=mx; xx<mx+mw; xx++){
          if(grid[yy][xx] === 1 && rng.next()<0.12){
            const adjWalls = [[1,0],[-1,0],[0,1],[0,-1]].filter(d=> !inBounds({width,height},xx+d[0],yy+d[1]) || grid[yy+d[1]][xx+d[0]]===0).length;
            if(adjWalls >= 3 && rng.next()<0.5) grid[yy][xx]=0;
          }
        }
      }
    }

    // other rooms
    let attempts = 0;
    while(rooms.filter(r=>!r.main).length < opts.roomCount && attempts < opts.roomCount*30){
      attempts++;
      const w = rng.intRange(opts.minRoom, opts.maxRoom);
      const h = rng.intRange(opts.minRoom, opts.maxRoom);
      const x = rng.intRange(1, Math.max(1, width-w-2));
      const y = rng.intRange(1, Math.max(1, height-h-2));
      let ok = true;
      for(const r of rooms){ const pad = rng.intRange(0,2); if(x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y){ ok = false; break; } }
      if(!ok) continue;
      const room = {x,y,w,h, type: (layout==='cave' ? (rng.next()<0.75 ? 'cave' : 'manmade') : (rng.next()<0.75 ? 'manmade' : 'cave'))};
      rooms.push(room);
      if(room.type === 'manmade'){
        for(let yy=y; yy<y+h; yy++) for(let xx=x; xx<x+w; xx++) grid[yy][xx] = 1;
      } else {
        const fillCount = Math.max(Math.floor((w*h)*0.5), Math.floor((w*h)*(0.6 + rng.next()*0.4)));
        let cx = x + Math.floor(w/2), cy = y + Math.floor(h/2);
        for(let i=0;i<fillCount;i++){
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
            const nx = cx+dx, ny = cy+dy;
            if(inBounds({width,height}, nx, ny) && nx>=x && nx<x+w && ny>=y && ny<y+h && rng.next() < 0.65) grid[ny][nx] = 1;
          }
          const dir = rng.intRange(0,3);
          if(dir===0 && cx+1 < x+w) cx++;
          if(dir===1 && cx-1 >= x) cx--;
          if(dir===2 && cy+1 < y+h) cy++;
          if(dir===3 && cy-1 >= y) cy--;
        }
      }
    }

    // connect some rooms (MST-ish), but cave mode may skip edges
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
          grid[y][x] = 2;
          const dx = bx - x, dy = by - y;
          if(Math.abs(dx) > Math.abs(dy)) x += Math.sign(dx); else y += Math.sign(dy);
          if(rng.next() < 0.12){
            const j = rng.next() < 0.5 ? -1 : 1;
            if(rng.next()<0.6 && x + j > 0 && x + j < width-1) grid[y][x+j] = 2;
            if(rng.next()<0.4 && y + j > 0 && y + j < height-1) grid[y+j][x] = 2;
          }
        }
        grid[by][bx] = 2;
      }
    }

    for(const e of edges){
      const a = centers[e.aIdx], b = centers[e.bIdx];
      if(layout==='cave' && rng.next() < 0.35) continue;
      carveCorridor(a.cx,a.cy,b.cx,b.cy);
    }

    // roomIndex grid
    const roomIndexGrid = Array.from({length:height}, ()=> new Array(width).fill(-1));
    rooms.forEach((r, idx)=>{ for(let yy=r.y; yy<r.y+r.h; yy++) for(let xx=r.x; xx<r.x+r.w; xx++) if(inBounds({width,height},xx,yy) && grid[yy][xx]===1) roomIndexGrid[yy][xx] = idx; });

    // corridor labels
    const corridorLabels = labelCorridors(grid);

    // compute doorsCandidate based on strict rule: wall tile separating two floor-like tiles that are different areas
    const doorsCandidate = [];
    for(let y=1;y<height-1;y++){
      for(let x=1;x<width-1;x++){
        if(grid[y][x] !== 0) continue;
        // check left-right
        const left = grid[y][x-1], right = grid[y][x+1];
        if(isFloorLike(left) && isFloorLike(right)){
          const lRoom = roomIndexGrid[y][x-1], rRoom = roomIndexGrid[y][x+1];
          const lCorr = corridorLabels[y][x-1], rCorr = corridorLabels[y][x+1];
          const diff = (lRoom >= 0 && rRoom >= 0 && lRoom !== rRoom) ||
                       (left === 2 && right === 1) || (left === 1 && right === 2) ||
                       (left === 2 && right === 2 && lCorr !== rCorr);
          if(diff) doorsCandidate.push({wx:x,wy:y,orientation:'vertical'});
        }
        // up-down
        const up = grid[y-1][x], down = grid[y+1][x];
        if(isFloorLike(up) && isFloorLike(down)){
          const uRoom = roomIndexGrid[y-1][x], dRoom = roomIndexGrid[y+1][x];
          const uCorr = corridorLabels[y-1][x], dCorr = corridorLabels[y+1][x];
          const diff = (uRoom >=0 && dRoom >=0 && uRoom !== dRoom) ||
                       (up === 2 && down === 1) || (up === 1 && down === 2) ||
                       (up === 2 && down === 2 && uCorr !== dCorr);
          if(diff) doorsCandidate.push({wx:x,wy:y,orientation:'horizontal'});
        }
      }
    }

    // place props with restrictions (caves only cave props)
    const props = [];
    if(opts.placeProps){
      const caveProps = ['stalagmite','crystal','stalactite'];
      const manProps = ['barrel','crate','table','shelf','chest','brazier'];
      for(let ri=0; ri<rooms.length; ri++){
        const r = rooms[ri];
        const roomType = r.type || 'manmade';
        const area = Math.max(1, r.w * r.h);
        const maxProps = Math.floor((area/10) * opts.propDensity) + (rng.next() < opts.propDensity ? 1 : 0);
        for(let i=0;i<maxProps;i++){
          let tries = 0;
          while(tries < 80){
            tries++;
            let px,py;
            if(r.main){
              if(r.w >= r.h){ px = (rng.next()<0.5) ? r.x+1 : r.x + r.w - 2; py = rng.intRange(r.y+1, r.y + r.h - 2); }
              else { py = (rng.next()<0.5) ? r.y+1 : r.y + r.h - 2; px = rng.intRange(r.x+1, r.x + r.w - 2); }
            } else {
              px = rng.intRange(r.x, r.x + r.w - 1); py = rng.intRange(r.y, r.y + r.h - 1);
            }
            if(!inBounds({width,height},px,py) || grid[py][px] !== 1) continue;
            let type = (roomType === 'cave') ? caveProps[Math.floor(rng.next()*caveProps.length)] : manProps[Math.floor(rng.next()*manProps.length)];
            if((type === 'table' || type === 'chair') && roomType === 'cave') continue;
            if(type === 'shelf'){
              const adj = [[1,0],[-1,0],[0,1],[0,-1]];
              const adjWall = adj.some(d=> { const nx=px+d[0], ny=py+d[1]; return inBounds({width,height},nx,ny) && grid[ny][nx] === 0; });
              if(!adjWall) continue;
            }
            props.push({x:px,y:py,room:ri,type});
            if(type === 'table'){
              const seatDirs = [[0,-1],[1,0],[0,1],[-1,0]];
              for(const sd of seatDirs){
                const sx = px + sd[0], sy = py + sd[1];
                if(inBounds({width,height},sx,sy) && grid[sy][sx] === 1 && !props.find(pp=>pp.x===sx && pp.y===sy)){
                  if(rng.next() < 0.9) props.push({x:sx,y:sy,room:ri,type:'chair',linkedTo:{x:px,y:py}});
                }
              }
            }
            break;
          }
        }
      }
    }

    return { grid, rooms, roomIndexGrid, width, height, doors: [], doorsCandidate, secretEndpoints: [], props };
  }

  // drawMap — stable viewing area; world transform only (scale + offset) — no CSS resizing on pan/zoom
  function drawMap(map, baseTileSize, selected, revealSecrets){
    if(!map) return;
    const wrapRect = els.mapWrap.getBoundingClientRect();
    const cssW = Math.max(200, Math.floor(wrapRect.width));
    const cssH = Math.max(150, Math.floor(wrapRect.height));
    const dpr = window.devicePixelRatio || 1;
    const canvas = els.mapCanvas;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d');

    // apply DPR * scale and translate by offset (offset in CSS px) -> multiply by DPR
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

    // doors: only display if map layout is manmade (doors are only created in manmade)
    if((els.hallwayStyle && els.hallwayStyle.value) !== 'cave'){
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tile-door').trim() || '#fcd34d';
      for(const d of map.doors || []){
        const wx = d.wx, wy = d.wy;
        const pad = Math.max(1, Math.floor(tile*0.05));
        if(d.orientation === 'vertical'){
          const wRect = Math.max(2, Math.floor(tile*0.32));
          const hRect = tile * 0.96;
          const x = wx*tile - Math.floor(wRect/2);
          const y = wy*tile - Math.floor(tile/2) + pad;
          ctx.fillRect(x, y, wRect, hRect - pad*2);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x+0.5, y+0.5, wRect-1, hRect - pad*2 -1);
        } else {
          const hRect = Math.max(2, Math.floor(tile*0.32));
          const wRect = tile * 0.96;
          const x = wx*tile - Math.floor(tile/2) + pad;
          const y = wy*tile - Math.floor(hRect/2);
          ctx.fillRect(x, y, wRect - pad*2, hRect);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x+0.5, y+0.5, wRect - pad*2 -1, hRect -1);
        }
      }
    }

    // Secret endpoints (bold S) when revealed
    if(revealSecrets){
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tile-secret').trim() || '#a78bfa';
      ctx.font = `bold ${Math.max(10, Math.floor(tile*0.6))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for(const s of map.secretEndpoints || []) ctx.fillText('S', s.wx*tile + tile/2, s.wy*tile + tile/2);
    }

    // props
    for(const p of map.props || []){
      if(!inBounds(map,p.x,p.y)) continue;
      const img = getPropImage(p.type);
      const size = Math.max(8, Math.floor(tile * (p.type === 'chair' ? 0.6 : 1.0)));
      const dx = p.x*tile + Math.floor((tile - size)/2);
      const dy = p.y*tile + Math.floor((tile - size)/2);
      try{
        if(img && img.complete) ctx.drawImage(img, dx, dy, size, size);
        else { ctx.beginPath(); ctx.fillStyle = '#f97316'; ctx.arc(p.x*tile + tile/2, p.y*tile + tile/2, Math.max(2, tile/4), 0, Math.PI*2); ctx.fill(); }
      }catch(e){ ctx.beginPath(); ctx.fillStyle = '#f97316'; ctx.arc(p.x*tile + tile/2, p.y*tile + tile/2, Math.max(2, tile/4), 0, Math.PI*2); ctx.fill(); }
    }

    // selection stroke
    if(selected){
      ctx.strokeStyle = 'rgba(255,215,75,0.95)'; ctx.lineWidth = Math.max(2, Math.floor(tile/10));
      ctx.strokeRect(selected.x*tile + 0.5, selected.y*tile + 0.5, tile - 1, tile - 1);
    }

    // reset transform and update UI info
    ctx.setTransform(1,0,0,1,0,0);
    if(state.selected && map){
      const sx = state.selected.x, sy = state.selected.y;
      const rid = (sy >= 0 && sy < map.roomIndexGrid.length && sx >= 0 && sx < map.roomIndexGrid[0].length) ? map.roomIndexGrid[sy][sx] : -1;
      const roomLabel = rid >= 0 ? `Room ${rid}` : 'None';
      els.mapInfo.textContent = `Rooms: ${map.rooms.length}  Props: ${map.props.length}`;
      els.selInfo.textContent = `Tile: (${sx},${sy}) — room: ${roomLabel}`;
    } else {
      els.mapInfo.textContent = `Rooms: ${map.rooms.length}  Props: ${map.props.length}`;
      els.selInfo.textContent = 'No selection';
    }
    els.doorList.textContent = `Doors: ${(map.doors||[]).length}`;
    els.secretList.textContent = `Secret endpoints: ${(map.secretEndpoints||[]).length}`;
    els.propList.textContent = `Props: ${(map.props||[]).length}`;
  }

  // Auto-place: one corridor<->room and one room<->room in manmade mode
  function autoPlaceDoors(map){
    if(!map) return;
    if((els.hallwayStyle && els.hallwayStyle.value) === 'cave') return;
    const corridorLabels = labelCorridors(map.grid);
    const candCR = [], candRR = [];
    for(let y=1;y<map.height-1;y++){
      for(let x=1;x<map.width-1;x++){
        if(map.grid[y][x] !== 0) continue;
        const left = map.grid[y][x-1], right = map.grid[y][x+1];
        const up = map.grid[y-1][x], down = map.grid[y+1][x];
        if((left===2 && right===1) || (left===1 && right===2)) candCR.push({wx:x,wy:y,orientation:'vertical'});
        if((up===2 && down===1) || (up===1 && down===2)) candCR.push({wx:x,wy:y,orientation:'horizontal'});
        const lIdx = map.roomIndexGrid[y][x-1], rIdx = map.roomIndexGrid[y][x+1];
        if(lIdx>=0 && rIdx>=0 && lIdx !== rIdx) candRR.push({wx:x,wy:y,orientation:'vertical'});
        const uIdx = map.roomIndexGrid[y-1][x], dIdx = map.roomIndexGrid[y+1][x];
        if(uIdx>=0 && dIdx>=0 && uIdx !== dIdx) candRR.push({wx:x,wy:y,orientation:'horizontal'});
      }
    }
    const placed = new Set((map.doors||[]).map(d=>`${d.wx},${d.wy}`));
    if(candCR.length){
      const pick = candCR[Math.floor(Math.random()*candCR.length)];
      if(!placed.has(`${pick.wx},${pick.wy}`)) (map.doors = map.doors||[]).push(pick);
    }
    if(candRR.length){
      const pick = candRR[Math.floor(Math.random()*candRR.length)];
      if(!placed.has(`${pick.wx},${pick.wy}`)) (map.doors = map.doors||[]).push(pick);
    }
  }

  // pointer pan handlers
  els.mapCanvas.addEventListener('pointerdown', (evt)=>{
    if(state.mode !== 'pan') return;
    state.isPanning = true;
    state.panStart = {x: evt.clientX, y: evt.clientY, offsetX: state.offsetX, offsetY: state.offsetY};
    try{ els.mapCanvas.setPointerCapture(evt.pointerId); }catch(e){}
    els.mapCanvas.style.cursor = 'grabbing';
  });
  els.mapCanvas.addEventListener('pointermove', (evt)=>{
    if(state.isPanning && state.panStart){
      const dx = evt.clientX - state.panStart.x, dy = evt.clientY - state.panStart.y;
      state.offsetX = state.panStart.offsetX + dx; state.offsetY = state.panStart.offsetY + dy;
      if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets));
    } else {
      canvasMoveForTooltip(evt);
    }
  });
  els.mapCanvas.addEventListener('pointerup', (evt)=>{
    if(state.isPanning){ state.isPanning = false; state.panStart = null; try{ els.mapCanvas.releasePointerCapture(evt.pointerId); }catch(e){} els.mapCanvas.style.cursor = 'crosshair'; }
  });
  els.mapCanvas.addEventListener('pointercancel', ()=>{ state.isPanning = false; state.panStart = null; els.mapCanvas.style.cursor = 'crosshair'; });

  function canvasMoveForTooltip(evt){
    if(!state.map) return;
    const rect = els.mapCanvas.getBoundingClientRect();
    const cx = (evt.clientX - rect.left) * (els.mapCanvas.width / rect.width);
    const cy = (evt.clientY - rect.top) * (els.mapCanvas.height / rect.height);
    const dpr = window.devicePixelRatio || 1;
    const screenX = cx / dpr, screenY = cy / dpr;
    const worldX = (screenX - state.offsetX) / state.scale, worldY = (screenY - state.offsetY) / state.scale;
    const baseTile = parseInt(els.tileSize.value,10) || 12;
    const tx = Math.floor(worldX / baseTile), ty = Math.floor(worldY / baseTile);
    const prop = (state.map.props || []).find(p=>p.x===tx && p.y===ty);
    if(prop){
      els.propTooltip.style.display = 'block';
      const name = prop.type.charAt(0).toUpperCase() + prop.type.slice(1);
      els.propTooltip.textContent = name + (prop.linkedTo ? ' (seat)' : '');
      const wrapRect = els.mapWrap.getBoundingClientRect();
      let left = evt.clientX - wrapRect.left, top = evt.clientY - wrapRect.top;
      const tt = els.propTooltip.getBoundingClientRect();
      if(left + tt.width > wrapRect.width) left = evt.clientX - wrapRect.left - tt.width;
      if(top + tt.height > wrapRect.height) top = evt.clientY - wrapRect.top - tt.height;
      els.propTooltip.style.left = left + 'px'; els.propTooltip.style.top = top + 'px';
    } else els.propTooltip.style.display = 'none';
  }

  // click handling: place doors/secrets on nearest eligible wall-edge between areas
  els.mapCanvas.addEventListener('click', (evt)=>{
    if(state.isPanning) return;
    if(!state.map) return;
    const rect = els.mapCanvas.getBoundingClientRect();
    const cx = (evt.clientX - rect.left) * (els.mapCanvas.width / rect.width);
    const cy = (evt.clientY - rect.top) * (els.mapCanvas.height / rect.height);
    const dpr = window.devicePixelRatio || 1;
    const screenX = cx / dpr, screenY = cy / dpr;
    const worldX = (screenX - state.offsetX) / state.scale, worldY = (screenY - state.offsetY) / state.scale;
    const baseTile = parseInt(els.tileSize.value,10) || 12;
    const tx = Math.floor(worldX / baseTile), ty = Math.floor(worldY / baseTile);
    if(tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) return;
    state.selected = {x: tx, y: ty};

    // check four adjacent wall positions
    const candidates = [
      {wx: tx+1, wy: ty},
      {wx: tx-1, wy: ty},
      {wx: tx, wy: ty+1},
      {wx: tx, wy: ty-1}
    ].filter(e => e.wx>=0 && e.wx < state.map.width && e.wy>=0 && e.wy < state.map.height && state.map.grid[e.wy][e.wx] === 0);

    // helper: returns true if wall e separates two different floor-like areas
    function separates(e){
      const left = inBounds(state.map,e.wx-1,e.wy)? state.map.grid[e.wy][e.wx-1] : 0;
      const right = inBounds(state.map,e.wx+1,e.wy)? state.map.grid[e.wy][e.wx+1] : 0;
      const up = inBounds(state.map,e.wx,e.wy-1)? state.map.grid[e.wy-1][e.wx] : 0;
      const down = inBounds(state.map,e.wx,e.wy+1)? state.map.grid[e.wy+1][e.wx] : 0;
      // left-right case
      if(isFloorLike(left) && isFloorLike(right)){
        const lRoom = state.map.roomIndexGrid[e.wy][e.wx-1], rRoom = state.map.roomIndexGrid[e.wy][e.wx+1];
        if(lRoom >= 0 && rRoom >= 0 && lRoom !== rRoom) return true;
        if((left === 2 && right === 1) || (left === 1 && right === 2)) return true;
        const cLab = labelCorridors(state.map.grid);
        const lCorr = cLab[e.wy][e.wx-1], rCorr = cLab[e.wy][e.wx+1];
        if(left === 2 && right === 2 && lCorr !== rCorr) return true;
      }
      if(isFloorLike(up) && isFloorLike(down)){
        const uRoom = state.map.roomIndexGrid[e.wy-1][e.wx], dRoom = state.map.roomIndexGrid[e.wy+1][e.wx];
        if(uRoom >= 0 && dRoom >= 0 && uRoom !== dRoom) return true;
        if((up === 2 && down === 1) || (up === 1 && down === 2)) return true;
        const cLab = labelCorridors(state.map.grid);
        const uCorr = cLab[e.wy-1][e.wx], dCorr = cLab[e.wy+1][e.wx];
        if(up === 2 && down === 2 && uCorr !== dCorr) return true;
      }
      return false;
    }

    let chosen = null;
    for(const c of candidates){ if(separates(c)){ chosen = c; break; } }

    if(state.mode === 'door'){
      if(!chosen){ alert('No eligible wall between two different areas nearby. Click the black line between two different areas.'); return; }
      if((els.hallwayStyle && els.hallwayStyle.value) === 'cave'){ alert('Doors are disabled in Cave-Layout.'); return; }
      const left = inBounds(state.map,chosen.wx-1,chosen.wy)? state.map.grid[chosen.wy][chosen.wx-1] : 0;
      const right = inBounds(state.map,chosen.wx+1,chosen.wy)? state.map.grid[chosen.wy][chosen.wx+1] : 0;
      const up = inBounds(state.map,chosen.wx,chosen.wy-1)? state.map.grid[chosen.wy-1][chosen.wx] : 0;
      const down = inBounds(state.map,chosen.wx,chosen.wy+1)? state.map.grid[chosen.wy+1][chosen.wx] : 0;
      const orient = (isFloorLike(left) && isFloorLike(right)) ? 'vertical' : 'horizontal';
      const exists = (state.map.doors||[]).find(d=>d.wx===chosen.wx && d.wy===chosen.wy);
      if(exists) state.map.doors = state.map.doors.filter(d=>!(d.wx===chosen.wx && d.wy===chosen.wy));
      else (state.map.doors = state.map.doors||[]).push({wx: chosen.wx, wy: chosen.wy, orientation: orient});
      drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets));
      return;
    }

    if(state.mode === 'secret'){
      if(!chosen){ alert('No eligible wall near click to place a secret.'); return; }
      const exists = (state.map.secretEndpoints||[]).find(s=>s.wx===chosen.wx && s.wy===chosen.wy);
      if(exists) state.map.secretEndpoints = state.map.secretEndpoints.filter(s=>!(s.wx===chosen.wx && s.wy===chosen.wy));
      else (state.map.secretEndpoints = state.map.secretEndpoints||[]).push({wx: chosen.wx, wy: chosen.wy, revealed:false});
      drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets));
      return;
    }

    if(state.mode === 'remove'){
      if(chosen) state.map.doors = (state.map.doors||[]).filter(d=>!(d.wx===chosen.wx && d.wy===chosen.wy));
      state.map.secretEndpoints = (state.map.secretEndpoints||[]).filter(s=>!(s.wx===tx && s.wy===ty));
      state.map.props = (state.map.props||[]).filter(p=>!(p.x===tx && p.y===ty));
      drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets));
      return;
    }

    drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets));
  });

  // autoPlace button
  els.autoDoors.addEventListener('click', ()=>{
    if(!state.map) return;
    autoPlaceDoors(state.map);
    drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets));
  });

  // generate/clear/export wiring
  els.genMap.addEventListener('click', ()=>{
    const opts = {
      width: parseInt(els.mapWidth.value,10),
      height: parseInt(els.mapHeight.value,10),
      roomCount: parseInt(els.roomCount.value,10),
      minRoom: parseInt(els.minRoom.value,10),
      maxRoom: parseInt(els.maxRoom.value,10),
      placeProps: !!els.placeProps.checked,
      propDensity: parseFloat(els.propDensity.value)
    };
    state.map = generateMap(opts);
    autoPlaceDoors(state.map);
    state.scale = 1.0; state.offsetX = 0; state.offsetY = 0;
    drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, false);
  });

  els.clearMap.addEventListener('click', ()=>{
    state.map = null; state.selected = null; state.offsetX = 0; state.offsetY = 0; state.scale = 1.0;
    const ctx = els.mapCanvas.getContext('2d'); ctx.clearRect(0,0,els.mapCanvas.width, els.mapCanvas.height);
    els.propTooltip.style.display = 'none';
    els.mapInfo.textContent = 'Cleared'; els.selInfo.textContent = 'No selection';
    els.doorList.textContent = 'Doors: 0'; els.secretList.textContent = 'Secret endpoints: 0'; els.propList.textContent = 'Props: 0';
  });

  els.exportMap.addEventListener('click', ()=>{
    if(!state.map){ alert('No map to export'); return; }
    SHARED.downloadJSON('dungeon-map.json', state.map);
  });

  els.zoomIn.addEventListener('click', ()=>{ state.scale = clamp(state.scale + 0.15, 0.25, 3.0); if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets)); });
  els.zoomOut.addEventListener('click', ()=>{ state.scale = clamp(state.scale - 0.15, 0.25, 3.0); if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets)); });
  els.resetZoom.addEventListener('click', ()=>{ state.scale = 1.0; state.offsetX = 0; state.offsetY = 0; if(state.map) drawMap(state.map, parseInt(els.tileSize.value,10), state.selected, !!(state.map && state.map.revealedSecrets)); });

  // initial canvas hint
  (function initCanvas(){
    els.mapCanvas.width = 640; els.mapCanvas.height = 480;
    const ctx = els.mapCanvas.getContext('2d'); ctx.fillStyle = '#071224'; ctx.fillRect(0,0,els.mapCanvas.width, els.mapCanvas.height);
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.fillText('Generate a map to begin', 12, 20);
  })();

  // expose for debugging
  window.MapBuilder = { state, generateMap, drawMap, autoPlaceDoors };

})();
