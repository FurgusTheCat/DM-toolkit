/* NPC generator page: tags, filters, richer descriptions
   - Increased tag support and custom-tag parser that influences generation.
   - Removed levels appended to displayed names.
   - Added local save (localStorage) and export (download JSON) via SHARED.downloadJSON.
   - Kept original generator structure and UI behavior but extended the trait pools and templates.
*/
(function(){
  const els = {
    npcCount: document.getElementById('npcCount'),
    genNpcs: document.getElementById('genNpcs'),
    npcList: document.getElementById('npcList'),
    exportNpcs: document.getElementById('exportNpcs'),
    tagFilter: document.getElementById('tagFilter'),
    newTag: document.getElementById('newTag'),
    addTag: document.getElementById('addTag'),
    seedDisplay: document.getElementById('seedDisplay'),
    randomizeSeed: document.getElementById('randomizeSeed')
  };

  let state = {
    seed: Math.floor(Math.random()*0xFFFFFFFF),
    npcs: [],
    availableTags: ['rogue','chef','merchant','guard','scholar','alchemist','priest','sailor','blacksmith'],
    activeFilters: new Set()
  };

  function updateSeedDisplay(){ els.seedDisplay.textContent = `seed: ${state.seed >>> 0}`; }
  updateSeedDisplay();

  // extended data pools
  const pool = {
    first: ["Tahl","Mira","Borin","Edda","Kellen","Orin","Lysa","Haru","Juna","Garr","Rook","Sera","Fenn","Thora","Ves","Kadia","Aeron","Rina","Silas","Ner","Ari","Bren","Cora"],
    last: ["Stone","Rivers","Voss","Hale","Marek","Thistle","Crow","Fen","Maris","Ward","Cole","Bren","Locke","Iver","Dun","Grey","Ashfall","Briar","Coldwater"],
    occupations: ["Innkeeper","Merchant","Guard","Scholar","Thief","Alchemist","Blacksmith","Sailor","Priest","Ranger","Cartographer","Herbalist","Apothecary","Relic-hunter","Scribe","Chef"],
    traits: ["gruff","cheerful","secretive","suspicious","friendly","nervous","haughty","clumsy","witty","pensive","aloof","brusque","meticulous","eccentric"],
    physical: ["scarred jaw","missing finger","tattooed forearms","bright eyes","a limp","low laugh","ink-stained hands","calloused palms","gold tooth","pierced ear"],
    quirks: ["taps a ring","speaks in proverbs","hums","whistles","shuffles papers","collects beads","stares at the ceiling","writes on scraps","counts coins"],
    motivations: ["pay a debt","find a relic","protect a charge","publish a treatise","open a shop","avenge a wrong","seek redemption","hide a crime"],
    possessions: ["worn journal","string of keys","brass spyglass","hairlocked locket","pouch of powders","annotated map"]
  };

  function createPRNG(seed){
    return SHARED.createPRNG(seed);
  }

  // parse custom tags: "key:value,flag"
  function parseTags(text){
    const out = {};
    if (!text) return out;
    const tokens = text.split(',').map(t=>t.trim()).filter(Boolean);
    for (const tok of tokens){
      const kv = tok.split(':').map(s=>s.trim());
      if (kv.length === 1) out[kv[0].toLowerCase()] = true;
      else out[kv[0].toLowerCase()] = kv.slice(1).join(':');
    }
    return out;
  }

  // Apply custom tags into the npc seed data to influence generation
  function applyCustoms(npcBase, tags){
    const base = Object.assign({}, npcBase);
    if (!tags) return base;
    if (tags.occupation) base.occupation = tags.occupation;
    if (tags.voice) base.voice = tags.voice;
    if (tags.quirk) base.quirk = tags.quirk;
    if (tags.feature) base.feature = tags.feature;
    if (tags.motive) base.motive = tags.motive;
    if (tags.attitude) base.attitude = tags.attitude;
    if (tags.secret) base.secret = tags.secret;
    if (tags.friendly) base.attitude = 'friendly';
    if (tags.hostile) base.attitude = 'hostile';
    return base;
  }

  // Construct a single NPC using RNG; optional tags can be provided (object)
  function createNPC(i, rng, customTags){
    const name = `${rng.choice(pool.first)} ${rng.choice(pool.last)}`;
    let occupation = rng.choice(pool.occupations);
    let trait = rng.choice(pool.traits);
    let physical = rng.choice(pool.physical);
    let quirk = rng.choice(pool.quirks);
    let motive = rng.choice(pool.motivations);
    let possession = rng.choice(pool.possessions);
    let voice = rng.choice(['soft','gravelly','whispery','booming','measured','singsong']);
    let attitude = rng.choice(['friendly','aloof','suspicious','helpful','boastful','dutiful']);

    let npcBase = {name, occupation, trait, physical, quirk, motive, possession, voice, attitude};

    if (customTags) {
      npcBase = applyCustoms(npcBase, customTags);
    }

    // varied templates for description
    const templates = [
      `${npcBase.name} is a ${npcBase.occupation.toLowerCase()} who appears ${npcBase.attitude}. ${npcBase.physical} draws the eye; they ${npcBase.quirk} when thinking. They often say little, but their motive seems to be ${npcBase.motive}.`,
      `You see ${npcBase.name}, a ${npcBase.occupation.toLowerCase()} with ${npcBase.physical}. They move ${npcBase.attitude}ly and often ${npcBase.quirk}. Their voice is ${npcBase.voice} and they carry ${npcBase.possession}.`,
      `${npcBase.name} — ${npcBase.occupation}. ${npcBase.physical}. Known to be ${npcBase.trait}, they ${npcBase.quirk} and seem driven to ${npcBase.motive}. A ${npcBase.voice} tone marks their speech.`,
      `${npcBase.name} bears ${npcBase.physical} and a ${npcBase.trait} demeanor. As a ${npcBase.occupation.toLowerCase()} they frequently ${npcBase.quirk}. There are whispers they are ${npcBase.motive}.`
    ];

    let desc = rng.choice(templates);

    // tags add optional lines
    const extra = [];
    if (customTags) {
      if (customTags.secret) extra.push(`There is a hidden detail: ${customTags.secret}.`);
      if (customTags.valuable || customTags.treasure) extra.push('They likely carry something valuable.');
      if (customTags.hostile) extra.push('They seem ready to put up a fight.');
    }

    if (rng.next() < 0.35 && extra.length) desc += ' ' + rng.choice(extra);

    // produce tag list for display and quick inspection
    const tags = [];
    if (customTags) {
      for (const k of Object.keys(customTags)) tags.push(k + (customTags[k] === true ? '' : ':'+customTags[k]));
    }

    return { id: i, name: name, occupation: npcBase.occupation, trait: npcBase.trait, description: desc, tags: tags };
  }

  function generateNPCs(count){
    const rng = createPRNG(state.seed ^ 0x9E3779B9);
    const arr = [];
    for (let i=0;i<count;i++){
      arr.push(createNPC(i, rng, null));
    }
    state.npcs = arr;
    renderList();
  }

  function renderTagFilter(){
    els.tagFilter.innerHTML = '';
    for (const t of state.availableTags){
      const btn = document.createElement('button');
      btn.className = 'tag';
      btn.textContent = t;
      if (state.activeFilters.has(t)) btn.style.background = 'var(--accent)', btn.style.color = '#002';
      btn.addEventListener('click', ()=>{
        if (state.activeFilters.has(t)) state.activeFilters.delete(t); else state.activeFilters.add(t);
        renderTagFilter(); renderList();
      });
      els.tagFilter.appendChild(btn);
    }
  }

  function renderList(){
    els.npcList.innerHTML = '';
    const list = state.npcs.filter(n => {
      if (!state.activeFilters.size) return true;
      // if npc.tags includes any active filter
      for (const f of state.activeFilters) if (n.tags && n.tags.some(ts=>ts.startsWith(f))) return true;
      return false;
    });
    for (const n of list){
      const box = document.createElement('div');
      box.style.padding = '8px'; box.style.borderRadius = '8px'; box.style.marginBottom = '8px';
      box.style.background = 'rgba(255,255,255,0.02)';
      box.innerHTML = `<strong>${n.name}</strong> — ${n.occupation}<div style="margin-top:6px;color:var(--muted)">${n.description}</div>`;
      // tags display
      const tagWrap = document.createElement('div'); tagWrap.style.marginTop = '8px';
      if (n.tags && n.tags.length) {
        for (const t of n.tags){
          const tEl = document.createElement('span'); tEl.className = 'tag'; tEl.textContent = t;
          tagWrap.appendChild(tEl);
        }
      }
      // quick add tag
      const addBtn = document.createElement('button'); addBtn.textContent = 'Add tag'; addBtn.style.marginLeft='8px';
      addBtn.addEventListener('click', ()=>{
        const newTag = prompt('Enter tag to add (e.g. smuggler):');
        if (newTag){
          if (!state.availableTags.includes(newTag)) { state.availableTags.push(newTag); renderTagFilter(); }
          n.tags = n.tags || [];
          if (!n.tags.includes(newTag)) n.tags.push(newTag);
          renderList();
        }
      });
      tagWrap.appendChild(addBtn);
      box.appendChild(tagWrap);
      els.npcList.appendChild(box);
    }
  }

  // add custom tag button
  els.addTag.addEventListener('click', ()=>{
    const t = els.newTag.value.trim();
    if (!t) return;
    if (!state.availableTags.includes(t)) state.availableTags.push(t);
    els.newTag.value = '';
    renderTagFilter();
  });

  // generator & export
  els.genNpcs.addEventListener('click', ()=> generateNPCs(parseInt(els.npcCount.value,10)));

  els.exportNpcs.addEventListener('click', ()=>{
    if (!state.npcs.length) { alert('No NPCs to export'); return; }
    SHARED.downloadJSON('npcs.json', state.npcs);
  });

  els.randomizeSeed.addEventListener('click', ()=> { state.seed = Math.floor(Math.random()*0xFFFFFFFF); updateSeedDisplay(); });

  // persist last generated npcs to localStorage automatically when generating
  function persistNPCs(){
    try { localStorage.setItem('dmtoolkit_npcs', JSON.stringify(state.npcs)); } catch(e){}
  }

  // hook into generate to persist
  const origGen = generateNPCs;
  generateNPCs = function(count){
    const result = origGen(count);
    persistNPCs();
    return result;
  };

  // load saved NPCs on start
  (function loadSaved(){
    try {
      const raw = localStorage.getItem('dmtoolkit_npcs');
      if (raw){ state.npcs = JSON.parse(raw); renderList(); }
    } catch(e){}
  })();

  // init
  renderTagFilter();
  updateSeedDisplay();

  window.NPCModule = { state, generateNPCs, parseTags, createNPC };
})();
