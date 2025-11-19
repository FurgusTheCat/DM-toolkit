/* Room descriptor page — tag-driven templates and export
   - Fixed prior formatting issues and made templates more robust.
   - Added more tags and vocab, integrated notes and NPC hints more directly into output.
   - Save/export to localStorage and via SHARED.downloadText/JSON for Chromebook compatibility.
*/
(function(){
  const els = {
    descComplexity: document.getElementById('descComplexity'),
    tagList: document.getElementById('tagList'),
    propInput: document.getElementById('propInput'),
    npcInput: document.getElementById('npcInput'),
    genDesc: document.getElementById('genDesc'),
    description: document.getElementById('description'),
    exportDesc: document.getElementById('exportDesc'),
    seedDisplay: document.getElementById('seedDisplay'),
    randomSeed: document.getElementById('randomSeed')
  };

  const tags = ['dungeon','tavern','temple','library','keep','cave','crypt','market','workshop','shrine','cellar','barracks','throne','storeroom','laboratory'];
  let state = { seed: Math.floor(Math.random()*0xFFFFFFFF), active: new Set() };
  function updateSeed(){ els.seedDisplay.textContent = `seed: ${state.seed >>> 0}`; }
  updateSeed();

  // render tag buttons
  function renderTags(){
    els.tagList.innerHTML = '';
    for (const t of tags){
      const btn = document.createElement('button');
      btn.className = 'tag' + (state.active.has(t) ? ' active' : '');
      btn.textContent = t;
      btn.addEventListener('click', ()=>{
        if (state.active.has(t)) state.active.delete(t); else state.active.add(t);
        renderTags();
      });
      els.tagList.appendChild(btn);
    }
  }
  renderTags();

  // vocab bank (extended)
  const vocab = {
    dungeon: {adjs:['moldy','dank','stone-lined'],'scent':['mildew','iron'],'items':['chain','rusted grate']},
    tavern: {adjs:['smoky','rowdy','stained'],'scent':['ale','stew'],'items':['barrel','broken mug']},
    temple: {adjs:['hallowed','serene','dusty'],'scent':['incense','wax'],'items':['altar','candle']},
    library: {adjs:['quiet','book-lined','scented'],'scent':['paper','leather'],'items':['shelf','scroll']},
    cave: {adjs:['echoing','limestone','drip-slick'],'scent':['damp stone','earth'],'items':['stalagmite','puddle']},
    crypt: {adjs:['sepulchral','cold','shadowed'],'scent':['old wax','rot'],'items':['sarcophagus','bones']},
    market: {adjs:['clamorous','colorful','sprawling'],'scent':['spices','fruit'],'items':['stall','crate']},
    workshop: {adjs:['clanking','oily','organized'],'scent':['metal','oil'],'items':['anvil','tools']},
    shrine: {adjs:['quiet','ornate','votive'],'scent':['incense','flowers'],'items':['votive bowl','ribbons']},
    cellar: {adjs:['moldy','cool','low'],'scent':['ferment','damp earth'],'items':['cask','shelf']},
    barracks: {adjs:['spartan','barrack-stale','lined with bunks'],'scent':['sweat','leather'],'items':['rack','bench']},
    throne: {adjs:['grand','tarnished','opulent'],'scent':['tallow','parfum'],'items':['throne','banner']},
    storeroom: {adjs:['stacked','dusty','cramped'],'scent':['wood','paper'],'items':['crate','rope']},
    laboratory: {adjs:['sterile','flickering','smoke-streaked'],'scent':['chemicals','ozone'],'items':['vials','bunsen']}
  };

  function pick(arr, rng){ if (!arr || !arr.length) return ''; return arr[Math.floor(rng.next() * arr.length)]; }

  // generate description
  function generateDescription(){
    const rng = SHARED.createPRNG(state.seed);
    const complexity = els.descComplexity.value;
    const activeTags = Array.from(state.active);
    const props = (els.propInput.value||'').split(',').map(s=>s.trim()).filter(Boolean);
    const npcs = (els.npcInput.value||'').split(',').map(s=>s.trim()).filter(Boolean);

    // collect vocab
    let adjs = [], scents = [], items = [];
    for (const t of activeTags){
      const v = vocab[t];
      if (v){ adjs.push(...v.adjs); scents.push(...v.scent); items.push(...v.items); }
    }
    const fallback = {adjs:['damp','musty','shadowy','narrow','spacious','ornate','crumbling','luminous'], scents:['mildew','spices','smoke','salt','old parchment','iron'], items:['wooden table','iron chest','broken statue','tattered banner','pile of bones']};
    if (!adjs.length) adjs.push(...fallback.adjs);
    if (!scents.length) scents.push(...fallback.scents);
    if (!items.length) items.push(...fallback.items);

    const parts = [];
    if (complexity === 'short'){
      parts.push(`A ${pick(adjs,rng)} space, smelling faintly of ${pick(scents,rng)}.`);
      if (props.length) parts.push(`You notice ${props.join(', ')}.`);
      if (npcs.length) parts.push(`People: ${npcs.join(', ')}.`);
    } else if (complexity === 'medium'){
      parts.push(`You step into a ${pick(adjs,rng)} room; ${pick(scents,rng)} lingers in the air.`);
      parts.push(`Light falls across ${pick(items,rng)} and ${props.length ? props.join(', ') + ' are present.' : 'the room holds little in the way of furniture.'}`);
      if (activeTags.length) parts.push(`This area feels ${activeTags.join(', ')}.`);
      if (npcs.length) parts.push(`You catch sight of ${npcs.join(', ')} here.`);
    } else {
      parts.push(`The chamber is ${pick(adjs,rng)} and stretches several paces. ${pick(scents,rng)} gives it a distinct character.`);
      parts.push(`Against one wall ${pick(items,rng)} rests${props.length ? ', accompanied by ' + props.slice(0,4).join(', ') : ''}.`);
      parts.push(`Small details suggest the room's purpose: ${activeTags.length ? activeTags.join(', ') + '.' : 'no obvious origin.'}`);
      if (npcs.length) parts.push(`Present are ${npcs.map(n=>`${n}`).join(', ')} — they might have stories or demands.`);
      if (rng.next() < 0.45) parts.push(`You notice a subtle clue: ${pick(items,rng)} bears ${pick(['a scratch','a faded mark','an unfamiliar sigil'],rng)}.`);
      parts.push(`An exit is ${pick(['a heavy door','a narrow passage','a low archway','a hidden slit'],rng)}; beyond it you sense ${pick(['a draft','a murmur','silence','a faint light'],rng)}.`);
    }

    // incorporate notes more directly (if user input props field contained sentences, they are included)
    const notesRaw = els.propInput.value || '';
    if (notesRaw && notesRaw.trim()){
      // add as an extra observation
      parts.push(`Note: ${notesRaw.trim()}`);
    }

    const text = parts.join(' ');
    // save last description locally (useful between pages)
    try { localStorage.setItem('dmtoolkit_last_room_desc', JSON.stringify({text, meta:{tags:activeTags, props, npcs}})); } catch(e){}
    els.description.textContent = text;
    return text;
  }

  // export as text
  els.exportDesc.addEventListener('click', ()=>{
    const txt = els.description.textContent || generateDescription();
    SHARED.downloadText(`room-desc-${Date.now()}.txt`, txt, 'text/plain');
  });

  els.genDesc.addEventListener('click', ()=>{
    generateDescription();
    state.seed = (state.seed + 1) >>> 0; updateSeed();
  });

  els.randomSeed.addEventListener('click', ()=> { state.seed = Math.floor(Math.random()*0xFFFFFFFF); updateSeed(); });

  function updateSeed(){ els.seedDisplay.textContent = `seed: ${state.seed >>> 0}`; }

  // expose for debug
  window.RoomDescriptor = { state, generateDescription };

})();