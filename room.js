/* Room descriptor page — tag-driven templates and export */
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

  const tags = ['dungeon','tavern','temple','library','keep','cave','crypt','market','workshop','shrine'];
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

  // small weighted vocabulary to bias by tag
  const vocab = {
    dungeon: {adjs:['moldy','dank','stone-lined'],'scent':['mildew','iron'],'items':['chain','rusted grate']},
    tavern: {adjs:['smoky','rowdy','stained'],'scent':['ale','stew'],'items':['barrel','broken mug']},
    temple: {adjs:['hallowed','serene','dusty'],'scent':['incense','wax'],'items':['altar','candle']},
    library: {adjs:['quiet','scented','book-lined'],'scent':['paper','leather'],'items':['shelf','scroll']},
    cave: {adjs:['echoing','limestone','drip-slick'],'scent':['damp stone','earth'],'items':['stalagmite','puddle']},
    crypt: {adjs:['sepulchral','cold','shadowed'],'scent':['old wax','rot'],'items':['sarcophagus','bones']},
    market: {adjs:['clamorous','colorful','sprawling'],'scent':['spices','fruit'],'items':['stall','crate']},
    workshop: {adjs:['clanking','oily','organized'],'scent':['metal','oil'],'items':['anvil','tools']},
    shrine: {adjs:['quiet','ornate','votive'],'scent':['incense','flowers'],'items':['votive bowl','ribbons']}
  };

  // generator
  function generateDescription(){
    const rng = SHARED.createPRNG(state.seed);
    const complexity = els.descComplexity.value;
    const activeTags = Array.from(state.active);
    const props = (els.propInput.value||'').split(',').map(s=>s.trim()).filter(Boolean);
    const npcs = (els.npcInput.value||'').split(',').map(s=>s.trim()).filter(Boolean);

    // collect vocab from tags
    const adjs = [], scents = [], items = [];
    for (const t of activeTags){
      const v = vocab[t];
      if (v){ adjs.push(...v.adjs); scents.push(...v.scent); items.push(...v.items); }
    }
    // fallback pools
    const fallback = {
      adjs: ['damp','musty','shadowy','narrow','spacious','ornate','crumbling','luminous'],
      scents: ['mildew','spices','smoke','salt','old parchment','iron'],
      items: ['wooden table','iron chest','broken statue','tattered banner','pile of bones']
    };
    if (!adjs.length) adjs.push(...fallback.adjs);
    if (!scents.length) scents.push(...fallback.scents);
    if (!items.length) items.push(...fallback.items);

    function pick(arr){ return arr[Math.floor(rng.next() * arr.length)]; }

    const parts = [];
    if (complexity === 'short'){
      parts.push(`A ${pick(adjs)} space, smelling faintly of ${pick(scents)}.`);
      if (props.length) parts.push(`You notice ${props.join(', ')}.`);
      if (npcs.length) parts.push(`People: ${npcs.join(', ')}.`);
    } else if (complexity === 'medium'){
      parts.push(`You step into a ${pick(adjs)} room; ${pick(scents)} lingers in the air.`);
      parts.push(`Light falls across ${pick(items)} and ${props.length ? props.join(', ') + ' are present.' : 'the room holds little in the way of furniture.'}`);
      if (activeTags.length) parts.push(`This area feels ${activeTags.join('/')}.`);
      if (npcs.length) parts.push(`You catch sight of ${npcs.join(', ')} here.`);
    } else {
      // long: multi-paragraph, weave tag-driven hooks
      parts.push(`The chamber is ${pick(adjs)} and stretches several paces. ${pick(scents)} gives it a distinct character.`);
      parts.push(`Against one wall ${pick(items)} rests${props.length ? ', accompanied by ' + props.slice(0,4).join(', ') : ''}.`);
      parts.push(`Small details suggest the room's purpose: ${activeTags.length ? activeTags.map(t=>`${t}—style details`).join(', ') + '.' : 'no obvious origin.'}`);
      if (npcs.length){
        parts.push(`Present are ${npcs.map(n=>`${n}`).join(', ')} — they might have stories or demands.`);
      }
      // hooks
      if (rng.next() < 0.45) parts.push(`You notice a subtle clue: ${pick(items)} bears ${pick(['a scratch','a faded mark','an unfamiliar sigil'])}. Follow-up might reveal more.`);
      parts.push(`An exit is ${pick(['a heavy door','a narrow passage','a low archway','a hidden slit']).toLowerCase()}; beyond it you sense ${pick(['a draft','a murmur','silence','a faint light'])}.`);
    }

    // polish
    const text = parts.join(' ');
    els.description.textContent = text;
    return text;
  }

  // UI
  els.genDesc.addEventListener('click', ()=>{
    const txt = generateDescription();
    // auto-increment seed for variety if user wants to press again quickly
    state.seed = (state.seed + 1) >>> 0; updateSeed();
  });

  els.exportDesc.addEventListener('click', ()=>{
    const txt = els.description.textContent || generateDescription();
    const name = `room-desc-${Date.now()}.txt`;
    SHARED.downloadJSON(name, {description: txt}); // download as json-like file to keep simple; users can copy plain text
  });

  els.randomSeed.addEventListener('click', ()=> { state.seed = Math.floor(Math.random()*0xFFFFFFFF); updateSeed(); });

  function updateSeed(){ els.seedDisplay.textContent = `seed: ${state.seed >>> 0}`; }

  // expose for debug
  window.RoomDescriptor = { state, generateDescription };
})();