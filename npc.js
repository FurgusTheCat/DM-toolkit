/* NPC generator page: tags, filters, richer descriptions */
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

  // data pools
  const pool = {
    first: ["Tahl","Mira","Borin","Edda","Kellen","Orin","Lysa","Haru","Juna","Garr","Rook","Sera","Fenn","Thora","Ves","Kadia","Aeron","Rina","Silas","Ner"],
    last: ["Stone","Rivers","Voss","Hale","Marek","Thistle","Crow","Fen","Maris","Ward","Cole","Bren","Locke","Iver","Dun","Grey"],
    occupations: ["Innkeeper","Merchant","Guard","Scholar","Thief","Alchemist","Blacksmith","Sailor","Priest","Ranger","Cartographer","Herbalist","Apothecary","Relic-hunter","Scribe","Chef"],
    traits: ["gruff","cheerful","secretive","suspicious","friendly","nervous","haughty","clumsy","witty","pensive","aloof","brusque","meticulous","eccentric"],
    physical: ["scarred jaw","missing finger","tattooed forearms","bright eyes","a limp","low laugh","ink-stained hands","calloused palms"],
    quirks: ["taps a ring","speaks in proverbs","hums","whistles nervously","shuffles papers","collects beads","stares at the ceiling"],
    motivations: ["pay a debt","find a relic","protect a charge","publish a treatise","open a shop","avenge a wrong"],
    possessions: ["worn journal","string of keys","brass spyglass","hairlocked locket","pouch of powders","annotated map"]
  };

  function createNPC(i, rng){
    const name = `${rng.choice(pool.first)} ${rng.choice(pool.last)}`;
    let occupation = rng.choice(pool.occupations);
    // if tag-driven, occupation may be influenced
    const tags = [];
    // assign 0-3 tags, prefer some from availableTags
    const tagCount = rng.intRange(0,2);
    for (let t=0;t<tagCount;t++){
      const tag = rng.choice(state.availableTags);
      if (!tags.includes(tag)) tags.push(tag);
    }
    // occasionally inject occupation-based tag
    if (occupation.toLowerCase() === 'chef' && !tags.includes('chef')) tags.push('chef');

    const trait = rng.choice(pool.traits);
    const level = rng.intRange(1,12);
    const physical = rng.choice(pool.physical);
    const quirk = rng.choice(pool.quirks);
    const motive = rng.choice(pool.motivations);
    const possess = rng.choice(pool.possessions);

    // produce a tag-aware description
    let descParts = [];
    descParts.push(`${name} is a ${occupation.toLowerCase()} known for being ${trait}.`);
    descParts.push(`They are ${physical} and ${quirk}.`);
    descParts.push(`They carry ${possess} and are bent on ${motive}.`);
    // tag-influenced sentences
    if (tags.includes('rogue')) descParts.push(`As a rogue, they favor quiet entrances and keep a small dagger hidden beneath their cloak.`);
    if (tags.includes('chef')) descParts.push(`As a chef, they move with practiced efficiency and often taste odd spices from a little tin.`);
    if (tags.includes('scholar')) descParts.push(`Their pockets hold scraps of translated text and a stub of charcoal for notes.`);
    if (tags.includes('guard')) descParts.push(`They habitually scan entries and rarely let a stranger pass without a question.`);
    if (tags.includes('merchant')) descParts.push(`They haggle softly and their gaze flits toward anything of value.`);
    // small hook
    if (rng.next() < 0.35) descParts.push(`They might ask about ${rng.choice(['a missing coin','a lost heirloom','a strange symbol'])} if engaged.`);

    return {
      id: i,
      name,
      occupation,
      trait,
      level,
      tags,
      description: descParts.join(' ')
    };
  }

  function generateNPCs(count){
    const rng = SHARED.createPRNG(state.seed ^ 0x9E3779B9);
    const arr = [];
    for (let i=0;i<count;i++){
      arr.push(createNPC(i, rng));
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
      for (const f of state.activeFilters) if (n.tags.includes(f)) return true;
      return false;
    });
    for (const n of list){
      const box = document.createElement('div');
      box.style.padding = '8px'; box.style.borderRadius = '8px'; box.style.marginBottom = '8px';
      box.style.background = 'rgba(255,255,255,0.02)';
      box.innerHTML = `<strong>${n.name}</strong> — ${n.occupation} (lvl ${n.level})<div style="margin-top:6px;color:var(--muted)">${n.description}</div>`;
      // tags display & editing
      const tagWrap = document.createElement('div'); tagWrap.style.marginTop = '8px';
      for (const t of n.tags){
        const tEl = document.createElement('span'); tEl.className = 'tag'; tEl.textContent = t;
        tagWrap.appendChild(tEl);
      }
      // quick add tag button
      const addBtn = document.createElement('button'); addBtn.textContent = 'Add tag'; addBtn.style.marginLeft='8px';
      addBtn.addEventListener('click', ()=>{
        const newTag = prompt('Enter tag to add (e.g. smuggler):');
        if (newTag){
          if (!state.availableTags.includes(newTag)) { state.availableTags.push(newTag); renderTagFilter(); }
          if (!n.tags.includes(newTag)) n.tags.push(newTag);
          renderList();
        }
      });
      tagWrap.appendChild(addBtn);
      box.appendChild(tagWrap);
      els.npcList.appendChild(box);
    }
  }

  // add custom tag
  els.addTag.addEventListener('click', ()=>{
    const t = els.newTag.value.trim();
    if (!t) return;
    if (!state.availableTags.includes(t)) state.availableTags.push(t);
    els.newTag.value = '';
    renderTagFilter();
  });

  // generate and export
  els.genNpcs.addEventListener('click', ()=> generateNPCs(parseInt(els.npcCount.value,10)));
  els.exportNpcs.addEventListener('click', ()=>{
    if (!state.npcs.length) { alert('No NPCs to export'); return; }
    SHARED.downloadJSON('npcs.json', state.npcs);
  });

  els.randomizeSeed.addEventListener('click', ()=> { state.seed = Math.floor(Math.random()*0xFFFFFFFF); updateSeedDisplay(); });

  // init
  renderTagFilter();
  updateSeedDisplay();

  // expose
  window.NPCModule = { state, generateNPCs };
})();