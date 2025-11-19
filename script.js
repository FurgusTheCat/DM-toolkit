/* Dungeon Toolkit — Enhanced: richer NPCs, more creative dungeon layouts, props, and varied room descriptions
   Still client-side and GitHub Pages compatible.
*/

(() => {
  // Utilities
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function createPRNG(seed) {
    seed = (seed >>> 0) || (Math.floor(Math.random()*0xFFFFFFFF) >>> 0);
    const f = mulberry32(seed);
    return {
      seed: seed >>> 0,
      next() { return f(); },
      intRange(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; },
      choice(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    };
  }

  // Core state
  let state = {
    map: null,
    npcs: [],
    props: [],
    seed: Math.floor(Math.random()*0xFFFFFFFF)
  };

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
    npcCount: document.getElementById('npcCount'),
    genNpcs: document.getElementById('genNpcs'),
    npcList: document.getElementById('npcList'),
    exportNpcs: document.getElementById('exportNpcs'),
    describeSelected: document.getElementById('describeSelected'),
    describeRandom: document.getElementById('describeRandom'),
    descComplexity: document.getElementById('descComplexity'),
    roomInfo: document.getElementById('roomInfo'),
    description: document.getElementById('description'),
    randomizeSeed: document.getElementById('randomizeSeed'),
    seedDisplay: document.getElementById('seedDisplay'),
    placeProps: document.getElementById('placeProps'),
    propDensity: document.getElementById('propDensity'),
    propList: document.getElementById('propList')
  };

  function updateSeedDisplay() {
    els.seedDisplay.textContent = `seed: ${state.seed >>> 0}`;
  }
  updateSeedDisplay();

  // Enhanced dungeon generator
  // Produces rooms, corridors and props. Uses MST-based room connections plus extra tunnels and randomized "branches".
  function generateMap(opts) {
    const { width, height, roomAttempts, minRoom, maxRoom, rng, placeProps, propDensity } = opts;
    const grid = Array.from({length: height}, ()=> new Array(width).fill(0)); // 0 wall, 1 floor, 2 corridor
    const rooms = [];

    // Place rooms using random attempts and soft packing
    let attempts = 0;
    while (rooms.length < roomAttempts && attempts < roomAttempts * 12) {
      attempts++;
      const w = rng.intRange(minRoom, maxRoom);
      const h = rng.intRange(minRoom, maxRoom);
      const x = Math.floor(rng.next() * (width - w - 2)) + 1;
      const y = Math.floor(rng.next() * (height - h - 2)) + 1;

      const rect = {x, y, w, h};
      let ok = true;
      for (const r of rooms) {
        // allow slight touching but avoid heavy overlap: use padding random to create variety
        const pad = rng.intRange(0, 2);
        if (x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y) { ok = false; break; }
      }
      if (!ok) continue;

      // jittered carve with some interior variation (small alcoves)
      rooms.push(rect);
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          grid[yy][xx] = 1;
        }
      }
      // optionally carve a small niche occasionally
      if (rng.next() < 0.18) {
        const nx = Math.max(1, x + rng.intRange(0, Math.max(0,w-1)));
        const ny = Math.max(1, y + rng.intRange(0, Math.max(0,h-1)));
        grid[ny][nx] = 1;
      }
    }

    // Build centers & connect them using a Prim-like MST for more organic backbone
    function center(r){ return {cx: Math.floor(r.x + r.w/2), cy: Math.floor(r.y + r.h/2)}; }
    const centers = rooms.map(center);
    const connected = new Set();
    const edges = [];
    if (centers.length) {
      connected.add(0);
      while (connected.size < centers.length) {
        let best = null;
        let bestDist = Infinity;
        for (const aIdx of connected) {
          for (let bIdx = 0; bIdx < centers.length; bIdx++) {
            if (connected.has(bIdx)) continue;
            const a = centers[aIdx], b = centers[bIdx];
            const dx = a.cx - b.cx, dy = a.cy - b.cy;
            const d = dx*dx + dy*dy;
            if (d < bestDist || (d === bestDist && rng.next() < 0.5)) {
              bestDist = d; best = {aIdx, bIdx};
            }
          }
        }
        if (!best) break;
        edges.push(best);
        connected.add(best.bIdx);
      }
    }

    // Carve corridors with slight randomness and occasional wiggle
    function carveCorridor(ax, ay, bx, by) {
      if (rng.next() < 0.6) {
        // L-shaped with random pivot offset
        if (rng.next() < 0.5) {
          const midx = rng.intRange(Math.min(ax,bx), Math.max(ax,bx));
          for (let x = Math.min(ax,midx); x <= Math.max(ax,midx); x++) grid[ay][x] = 2;
          for (let y = Math.min(ay,by); y <= Math.max(ay,by); y++) grid[y][midx] = 2;
          for (let x = Math.min(midx,bx); x <= Math.max(midx,bx); x++) grid[by][x] = 2;
        } else {
          const midy = rng.intRange(Math.min(ay,by), Math.max(ay,by));
          for (let y = Math.min(ay,midy); y <= Math.max(ay,midy); y++) grid[y][ax] = 2;
          for (let x = Math.min(ax,bx); x <= Math.max(ax,bx); x++) grid[midy][x] = 2;
          for (let y = Math.min(midy,by); y <= Math.max(midy,by); y++) grid[y][bx] = 2;
        }
      } else {
        // straight-ish tunnel with jitter
        let x = ax, y = ay;
        while (x !== bx || y !== by) {
          grid[y][x] = 2;
          if (x !== bx && rng.next() < 0.6) x += Math.sign(bx - x);
          if (y !== by && rng.next() < 0.6) y += Math.sign(by - y);
          // occasional sideways drift
          if (rng.next() < 0.05) {
            const sx = x + (rng.next() < 0.5 ? -1 : 1);
            const sy = y + (rng.next() < 0.5 ? -1 : 1);
            if (sx > 0 && sx < width && sy > 0 && sy < height) grid[sy][sx] = 2;
          }
        }
        grid[by][bx] = 2;
      }
    }

    for (const e of edges) {
      const a = centers[e.aIdx], b = centers[e.bIdx];
      carveCorridor(a.cx, a.cy, b.cx, b.cy);
      // extra branches sometimes
      if (rng.next() < 0.25) {
        const randomCenter = centers[rng.intRange(0, centers.length-1)];
        carveCorridor(b.cx, b.cy, randomCenter.cx, randomCenter.cy);
      }
    }

    // Add a few random tunnels to create loops and more interesting navigation
    const extraTunnels = Math.max(1, Math.floor(rooms.length * 0.18));
    for (let i=0;i<extraTunnels;i++){
      const a = centers[rng.intRange(0, centers.length-1)];
      const b = centers[rng.intRange(0, centers.length-1)];
      if (a && b) carveCorridor(a.cx, a.cy, b.cx, b.cy);
    }

    // Create roomIndexGrid and optionally place props
    const roomIndexGrid = Array.from({length: height}, ()=> new Array(width).fill(-1));
    rooms.forEach((r, idx) => {
      for (let yy = r.y; yy < r.y + r.h; yy++){
        for (let xx = r.x; xx < r.x + r.w; xx++){
          roomIndexGrid[yy][xx] = idx;
        }
      }
    });

    const props = [];
    const propTypes = [
      {id:'brazier', name:'rusty iron brazier'},
      {id:'bones', name:'pile of bleached bones'},
      {id:'ward', name:'faded warding sigil'},
      {id:'amphora', name:'cracked amphora'},
      {id:'tapestry', name:'tattered tapestry'},
      {id:'shelf', name:'bookshelf of moth-eaten tomes'},
      {id:'table', name:'sturdy oak table'},
      {id:'altar', name:'small stone altar'},
      {id:'trap', name:'concealed pressure plate'},
      {id:'chest', name:'locked iron-bound chest'}
    ];

    if (placeProps) {
      // For each room, place a number of props proportional to room area and propDensity
      rooms.forEach((r, ridx) => {
        const area = r.w * r.h;
        const maxProps = Math.floor((area / 12) * propDensity) + (rng.next() < propDensity ? 1 : 0);
        const count = rng.intRange(0, Math.max(0, maxProps));
        const placed = new Set();
        for (let i=0;i<count;i++){
          let tries = 0;
          while (tries < 20) {
            tries++;
            const px = rng.intRange(r.x, r.x + r.w - 1);
            const py = rng.intRange(r.y, r.y + r.h - 1);
            const key = `${px},${py}`;
            if (roomIndexGrid[py][px] === ridx && grid[py][px] === 1 && !placed.has(key)) {
              placed.add(key);
              const type = rng.choice(propTypes);
              props.push({type: type.id, name: type.name, x:px, y:py, room:ridx});
              break;
            }
          }
        }
      });
    }

    return {grid, rooms, roomIndexGrid, width, height, props};
  }

  // Drawing the map with props and selected tile
  function drawMap(map, tileSize, selected, showNPCs=true) {
    const canvas = els.mapCanvas;
    const w = map.width * tileSize;
    const h = map.height * tileSize;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#061021';
    ctx.fillRect(0,0,w,h);

    for (let y=0;y<map.height;y++){
      for (let x=0;x<map.width;x++){
        const tile = map.grid[y][x];
        let color;
        if (selected && selected.x===x && selected.y===y) {
          color = getComputedStyle(document.documentElement).getPropertyValue('--tile-selected').trim() || '#ffd166';
        } else if (map.roomIndexGrid[y][x] >= 0) {
          color = '#e6eef8'; // floor
        } else if (tile === 2) {
          color = '#bbf7d0'; // corridor
        } else {
          color = '#071224'; // wall
        }
        ctx.fillStyle = color;
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }

    // Draw props as small icons (circles) slightly inset
    for (const p of (map.props||[])) {
      const cx = p.x * tileSize + tileSize/2;
      const cy = p.y * tileSize + tileSize/2;
      ctx.beginPath();
      ctx.fillStyle = 'var(--prop-color)';
      ctx.globalAlpha = 0.95;
      ctx.arc(cx, cy, Math.max(2, tileSize/4), 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw NPC markers if they are assigned to rooms
    if (showNPCs && state.npcs && state.npcs.length) {
      for (let i=0;i<state.npcs.length;i++){
        const n = state.npcs[i];
        if (n.room !== undefined && n.room >= 0 && n.room < map.rooms.length) {
          const r = map.rooms[n.room];
          const nx = r.x + Math.floor(r.w/2);
          const ny = r.y + Math.floor(r.h/2);
          ctx.fillStyle = 'var(--npc-color)';
          ctx.font = `${Math.max(8, Math.floor(tileSize * 0.9))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('●', nx*tileSize + tileSize/2, ny*tileSize + tileSize/2);
        }
      }
    }

    // subtle grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (let x=0;x<=map.width;x++){
      ctx.beginPath();
      ctx.moveTo(x*tileSize+0.5,0);
      ctx.lineTo(x*tileSize+0.5,h);
      ctx.stroke();
    }
    for (let y=0;y<=map.height;y++){
      ctx.beginPath();
      ctx.moveTo(0,y*tileSize+0.5);
      ctx.lineTo(w,y*tileSize+0.5);
      ctx.stroke();
    }
  }

  // Enhanced NPC generator: create rich backstories, motivations, physical detail, quirks, and possessions
  const npcData = {
    first: ["Tahl","Mira","Borin","Edda","Kellen","Orin","Lysa","Haru","Juna","Garr","Rook","Sera","Fenn","Thora","Ves","Kadia","Aeron","Rina","Silas","Ner"],
    last: ["Stone","Rivers","Voss","Hale","Marek","Thistle","Crow","Fen","Maris","Ward","Cole","Bren","Locke","Iver","Dun","Grey"],
    occupations: ["Innkeeper","Merchant","Guard","Scholar","Thief","Alchemist","Blacksmith","Sailor","Priest","Ranger","Cartographer","Herbalist","Apothecary","Relic-hunter","Scribe"],
    traits: ["gruff","cheerful","secretive","suspicious","friendly","nervous","haughty","clumsy","witty","pensive","aloof","brusque","meticulous","eccentric"],
    physical: ["scar along the jaw","a missing finger","tattooed forearms","bright, curious eyes","a limp","a low, rumbling laugh","hands stained with ink","calloused palms"],
    quirks: ["taps a ring when nervous","speaks in proverbs","sing-song humming","nervous whistle","shuffles papers obsessively","collects small glass beads","stares at the ceiling while thinking"],
    goals: ["find a lost sibling","pay off a debt","uncover a buried secret","win favor with a patron","catalog a dangerous artifact","escape their past","learn an ancient language"],
    possessions: ["a worn journal of travel notes","a string of small keys","a dented brass spyglass","a locket with hair braided inside","a pouch of peculiar powders","a map with strange annotations"]
  };

  function describeNPCDetailed(npc, rng) {
    // Compose a multi-sentence, varied biography
    const lines = [];
    // Opening — name, age estimate, occupation, trait
    const age = rng.intRange(18,65);
    lines.push(`${npc.name}, approximately ${age} years old, is known in these halls as a ${npc.occupation.toLowerCase()}.`);
    // Physical
    lines.push(`They are ${rng.choice(npcData.physical)}, giving them a ${rng.choice(['weathered','distinct','unforgettable'])} look.`);
    // Personality + quirk
    lines.push(`Often described as ${npc.trait}, they ${rng.choice(npcData.quirks)} when under pressure.`);
    // Backstory fragment and goal
    lines.push(`Rumors say they once ${rng.choice(['served a noble house','sailed to distant shores','studied under a reclusive sage','lost everything in a fire','escaped a prison camp'])}, and now they aim to ${rng.choice(npcData.goals)}.`);
    // Possessions & mannerisms
    lines.push(`They carry ${rng.choice(npcData.possessions)}; when they speak, they often ${rng.choice(['speak softly','pause to consider words','gesture with flourished hands','lower their voice to a hush'])}.`);
    // Optional hook
    if (rng.next() < 0.35) lines.push(`If approached, they may ask about ${rng.choice(['an old map','a family crest','a forgotten hymn','a rare herb','a missing relic'])}.`);
    return lines.join(' ');
  }

  function generateNPCs(count, rng, map) {
    const list = [];
    for (let i=0;i<count;i++){
      const name = `${rng.choice(npcData.first)} ${rng.choice(npcData.last)}`;
      const occupation = rng.choice(npcData.occupations);
      const trait = rng.choice(npcData.traits);
      const level = rng.intRange(1,12);
      const npc = {id: i, name, occupation, trait, level};
      list.push(npc);
    }
    // Assign NPCs to rooms as evenly as possible (or randomly)
    if (map && map.rooms && map.rooms.length) {
      for (let i=0;i<list.length;i++){
        // more interesting distribution: cluster some NPCs in same rooms
        const clusterFactor = rng.next();
        let roomIndex;
        if (clusterFactor < 0.2) {
          roomIndex = rng.intRange(0, Math.max(0, Math.floor(map.rooms.length*0.25)));
        } else {
          roomIndex = rng.intRange(0, map.rooms.length-1);
        }
        list[i].room = roomIndex;
      }
    } else {
      for (let i=0;i<list.length;i++) list[i].room = -1;
    }

    // Generate detailed biographies
    for (const n of list) {
      n.description = describeNPCDetailed(n, createPRNG((rng.seed ^ (n.id*374761393)) >>> 0));
    }
    return list;
  }

  // Rich room description generator with many templates & dynamic content
  const descParts = {
    adjectives: ["damp","musty","bright","shadowy","narrow","spacious","low-ceilinged","vaulted","dusty","ornate","crumbling","gloom-rimmed","luminous"],
    scents: ["mildew","spices","smoke","salt","old parchment","sweat","iron","roses","herbs","cave-rot","burnt oil"],
    sounds: ["dripping water","distant chatter","the wind whining","mice squeaking","scuffled footsteps","a low hum","the creak of aging wood","tinkle of glass"],
    items: ["a wooden table","an iron chest","a broken statue","shelves of dusty tomes","a cracked mirror","a pile of bones","an old rug","hanging lanterns","a child-sized shoe","a rusted helmet"],
    lighting: ["faint torchlight","moonlight through a crack","darkness","a single flickering candle","phosphorescent mold","sullen braziers","a candlelight cluster"],
    moods: ["ominous","cozy","abandoned","lively","lonely","foreboding","peaceful","tense","melancholic"],
    entrances: ["a heavy oak door","a narrow archway","a hole in the wall","a trapdoor","a collapsed passage","a grated shaft"]
  };

  function describeRoom(roomIndex, complexity, map, rng, npcsInRoom=[], propsInRoom=[]) {
    if (!map) return "No map to describe.";
    if (roomIndex < 0 || roomIndex >= map.rooms.length) return "This tile is not part of a room.";
    const r = map.rooms[roomIndex];
    const lines = [];
    const useTemplates = {
      short: 2,
      medium: 3,
      long: 5
    };
    const templates = [
      // Template set: atmospheric, utilitarian, narrative, historical, hazard-focused
      function atmosphere() {
        return `${rng.choice(descParts.adjectives)} and ${rng.choice(['stale','stony','sour','humid'])}, the chamber measures about ${r.w} by ${r.h} tiles. ${rng.choice(descParts.lighting)} throws ${rng.choice(['long shadows','a weak glow','shapes across the floor'])}, revealing ${rng.choice(descParts.items)}.`;
      },
      function utilitarian() {
        return `This room looks used: ${rng.choice(['scuff-marks','stains','scattered tools','a scatter of coins'])} mar the floor, and someone has arranged ${rng.choice(['sacks','crates','benches'])} along the walls. A ${rng.choice(descParts.entrances)} provides the main exit.`;
      },
      function narrative() {
        return `You find traces of recent activity: ${rng.choice(['shoe prints','fresh embers','a hastily burned scrap','a child's toy'])} suggests someone passed through not long ago. ${rng.choice(descParts.items)} lies in one corner, half-buried by dust.`;
      },
      function historical() {
        return `Faded carvings near the ceiling hint this chamber once served as ${rng.choice(['a shrine','a storeroom','an armory','a study'])}. Time has left ${rng.choice(['pits','chips','stains'])}, but the outline of purpose remains.`;
      },
      function hazard() {
        return `The floor here is uneven; you notice ${rng.choice(['a narrow trench','a rusted spike','odd tile patterns'])} that might conceal ${rng.choice(['a trap','a sudden drop','an ancient mechanism'])}. Move carefully.`;
      },
      function propsAndNPCs() {
        const propText = propsInRoom.length ? `Props: ${propsInRoom.map(p=>p.name).slice(0,4).join(', ')}.` : '';
        const npcText = npcsInRoom.length ? ` Present: ${npcsInRoom.map(n=>n.name+" ("+n.occupation+")").join(', ')}.` : '';
        return `${propText} ${npcText}`.trim();
      },
      function sensory() {
        return `The air smells faintly of ${rng.choice(descParts.scents)} and you can hear ${rng.choice(descParts.sounds)}. The overall mood is ${rng.choice(descParts.moods)}.`;
      },
      function detail() {
        return `${rng.choice(['A loose tapestry flutters','An overturned stool','A faded rug conceals scratches','A rusted brazier still holds ash'])} near the far wall catches your eye.`;
      }
    ];

    // Choose a small set of templates depending on complexity
    const templateCount = useTemplates[complexity] || 3;
    // ensure variety: pick random templates (no duplicates)
    const picks = [];
    for (let i=0;i<templateCount;i++){
      let tries = 0;
      while (tries < 20) {
        tries++;
        const idx = Math.floor(rng.next() * templates.length);
        if (!picks.includes(idx)) { picks.push(idx); break; }
      }
    }
    for (const idx of picks) lines.push(templates[idx]());

    // Add longer paragraph for 'long' complexity using props & NPC bios
    if (complexity === 'long') {
      if (propsInRoom.length) {
        const pdesc = propsInRoom.map(p => {
          return `${p.name} ${rng.choice(['sits','rests','is propped','leans'])} ${rng.choice(['against the wall','in the corner','on a pedestal','beside the doorway'])}`;
        }).slice(0,4).join('. ') + '.';
        lines.push(pdesc);
      }
      if (npcsInRoom.length) {
        // include short bios
        for (const n of npcsInRoom.slice(0,3)) {
          lines.push(`${n.name} — ${n.occupation}. ${n.description.split('. ').slice(0,2).join('. ')}.`);
        }
      }
      // small closing line about exits / hooks
      lines.push(`An exit is ${rng.choice(descParts.entrances)}. You sense ${rng.choice(['a faint draft','distant echo','a lingering warmth','the distant clatter of armor'])} beyond it.`);
    }

    // polish final output
    const text = lines.join(' ').replace(/\s+/g,' ').trim();
    return text;
  }

  // Tile click handling
  let selectedTile = null;
  function canvasCoordsToTile(evt, tileSize) {
    const rect = els.mapCanvas.getBoundingClientRect();
    const cx = (evt.clientX - rect.left) * (els.mapCanvas.width / rect.width);
    const cy = (evt.clientY - rect.top) * (els.mapCanvas.height / rect.height);
    const tx = Math.floor(cx / tileSize);
    const ty = Math.floor(cy / tileSize);
    return {x: tx, y: ty};
  }

  // UI actions
  function doGenerateMap() {
    const width = parseInt(els.mapWidth.value,10);
    const height = parseInt(els.mapHeight.value,10);
    const tileSize = parseInt(els.tileSize.value,10);
    const roomCount = parseInt(els.roomCount.value,10);
    const minRoom = parseInt(els.minRoom.value,10);
    const maxRoom = parseInt(els.maxRoom.value,10);
    const placeProps = !!els.placeProps.checked;
    const propDensity = parseFloat(els.propDensity.value);

    const rng = createPRNG(state.seed);
    state.map = generateMap({
      width, height, roomAttempts: roomCount, minRoom, maxRoom, rng, placeProps, propDensity
    });
    state.props = state.map.props || [];
    // redraw and reset selection
    selectedTile = null;
    drawMap(state.map, tileSize, selectedTile);
    els.roomInfo.textContent = `Map generated. Rooms: ${state.map.rooms.length} — Props: ${state.map.props.length}`;
    // if NPCs exist, reassign them to new map (so their room indices match)
    if (state.npcs && state.npcs.length) {
      const rng2 = createPRNG(state.seed ^ 0x9e3779b9);
      state.npcs = generateNPCs(state.npcs.length, rng2, state.map);
      renderNpcList();
    }
    renderPropListForRoom(-1);
  }

  function doClearMap(){
    state.map = null;
    state.props = [];
    selectedTile = null;
    els.mapCanvas.width = 640;
    els.mapCanvas.height = 480;
    const ctx = els.mapCanvas.getContext('2d');
    ctx.clearRect(0,0,els.mapCanvas.width, els.mapCanvas.height);
    els.roomInfo.textContent = "Map cleared.";
    els.description.textContent = "Generate a description";
    els.npcList.innerHTML = "";
    els.propList.innerHTML = "";
  }

  function doExportMap() {
    if (!state.map) { alert('No map to export'); return; }
    const payload = {
      seed: state.seed,
      width: state.map.width,
      height: state.map.height,
      rooms: state.map.rooms,
      grid: state.map.grid,
      props: state.map.props
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dungeon-map.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function doGenerateNpcs() {
    const count = parseInt(els.npcCount.value,10);
    const rng = createPRNG((state.seed ^ 0x9e3779b9) >>> 0);
    state.npcs = generateNPCs(count, rng, state.map || {rooms:[]});
    renderNpcList();
    drawMap(state.map || {width:64,height:48,rooms:[],roomIndexGrid:[],props:[]}, parseInt(els.tileSize.value,10), selectedTile);
  }

  function renderNpcList() {
    els.npcList.innerHTML = '';
    for (let i=0;i<state.npcs.length;i++){
      const n = state.npcs[i];
      const li = document.createElement('li');
      const short = `${n.name} — ${n.occupation} (lvl ${n.level})`;
      li.innerHTML = `<strong>${short}</strong><div style="font-size:0.9rem;color:var(--muted);margin-top:6px">${n.description}</div>`;
      els.npcList.appendChild(li);
    }
  }

  function doExportNpcs() {
    if (!state.npcs.length) { alert('No NPCs to export'); return; }
    const blob = new Blob([JSON.stringify(state.npcs, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'npcs.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderPropListForRoom(roomIndex) {
    els.propList.innerHTML = '';
    if (!state.map) return;
    const list = state.map.props.filter(p => p.room === roomIndex);
    if (!list.length) {
      els.propList.innerHTML = '<li style="color:var(--muted)">No props in this room</li>';
      return;
    }
    for (const p of list) {
      const li = document.createElement('li');
      li.textContent = `${p.name} at (${p.x}, ${p.y})`;
      els.propList.appendChild(li);
    }
  }

  function describeSelectedTile() {
    if (!state.map) { alert('Generate a map first'); return; }
    if (!selectedTile) { alert('Select a tile by clicking the map first'); return; }
    const rx = selectedTile.x, ry = selectedTile.y;
    if (ry < 0 || ry >= state.map.roomIndexGrid.length || rx < 0 || rx >= state.map.roomIndexGrid[0].length) {
      alert('Selected tile outside of map');
      return;
    }
    const ridx = state.map.roomIndexGrid[ry][rx] !== undefined ? state.map.roomIndexGrid[ry][rx] : -1;
    const rng = createPRNG((state.seed ^ 0x12345678) >>> 0);
    const npcsInRoom = (state.npcs || []).filter(n => n.room === ridx);
    const propsInRoom = (state.map.props || []).filter(p => p.room === ridx);
    const desc = describeRoom(ridx, els.descComplexity.value, state.map, rng, npcsInRoom, propsInRoom);
    els.description.textContent = desc;
    updateRoomInfo(ridx);
    renderPropListForRoom(ridx);
  }

  function describeRandomRoom() {
    if (!state.map) { alert('Generate a map first'); return; }
    const rng = createPRNG((state.seed ^ 0x87654321) >>> 0);
    if (!state.map.rooms.length) { alert('No rooms'); return;}
    const ridx = Math.floor(rng.next() * state.map.rooms.length);
    // pick random tile from room (center)
    const r = state.map.rooms[ridx];
    selectedTile = {x: r.x + Math.floor((r.w-1)/2), y: r.y + Math.floor((r.h-1)/2)};
    drawMap(state.map, parseInt(els.tileSize.value,10), selectedTile);
    const npcsInRoom = (state.npcs || []).filter(n => n.room === ridx);
    const propsInRoom = (state.map.props || []).filter(p => p.room === ridx);
    const desc = describeRoom(ridx, els.descComplexity.value, state.map, rng, npcsInRoom, propsInRoom);
    els.description.textContent = desc;
    updateRoomInfo(ridx);
    renderPropListForRoom(ridx);
  }

  function updateRoomInfo(ridx) {
    if (!state.map) { els.roomInfo.textContent = "No map."; return; }
    if (ridx === undefined || ridx === null || ridx < 0) {
      els.roomInfo.textContent = "Selected tile is not in a room.";
      return;
    }
    const r = state.map.rooms[ridx];
    const propsCount = state.map.props.filter(p => p.room === ridx).length;
    const npcsCount = (state.npcs || []).filter(n => n.room === ridx).length;
    els.roomInfo.textContent = `Room #${ridx}\nPosition: (${r.x}, ${r.y})\nSize: ${r.w} × ${r.h}\nProps: ${propsCount}  NPCs: ${npcsCount}`;
  }

  // Canvas click
  els.mapCanvas.addEventListener('click', (evt) => {
    if (!state.map) return;
    const tileSize = parseInt(els.tileSize.value,10);
    const t = canvasCoordsToTile(evt, tileSize);
    if (t.x < 0 || t.x >= state.map.width || t.y < 0 || t.y >= state.map.height) return;
    selectedTile = t;
    drawMap(state.map, tileSize, selectedTile, true);
    const ridx = state.map.roomIndexGrid[t.y][t.x];
    updateRoomInfo(ridx);
    renderPropListForRoom(ridx);
  });

  // Buttons
  els.genMap.addEventListener('click', () => { doGenerateMap(); });
  els.clearMap.addEventListener('click', () => { doClearMap(); });
  els.exportMap.addEventListener('click', () => { doExportMap(); });
  els.genNpcs.addEventListener('click', () => { doGenerateNpcs(); });
  els.exportNpcs.addEventListener('click', () => { doExportNpcs(); });
  els.describeSelected.addEventListener('click', () => { describeSelectedTile(); });
  els.describeRandom.addEventListener('click', () => { describeRandomRoom(); });
  els.randomizeSeed.addEventListener('click', () => { state.seed = Math.floor(Math.random()*0xFFFFFFFF); updateSeedDisplay(); });

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') { doGenerateMap(); }
    if (e.key === 'n' || e.key === 'N') { doGenerateNpcs(); }
  });

  // initial blank canvas
  (function initCanvas(){
    els.mapCanvas.width = 640;
    els.mapCanvas.height = 480;
    const ctx = els.mapCanvas.getContext('2d');
    ctx.fillStyle = '#071224';
    ctx.fillRect(0,0,els.mapCanvas.width, els.mapCanvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Generate a map to begin', 12, 20);
  })();

  // Expose state for debug in console
  window.DungeonToolkit = {
    state,
    generateMap: doGenerateMap,
    generateNpcs: doGenerateNpcs,
    describeSelected: describeSelectedTile
  };

})();