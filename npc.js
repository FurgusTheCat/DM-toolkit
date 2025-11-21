/* NPC generator page: profession tags, filters, long descriptions, deep categories.
   - Tags are professions; filtering and generation revolve around chosen professions.
   - Large trait pools, extended background/support fields.
   - Multi-paragraph rich descriptions.
   - Local save & export as before.
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

  // List of supported professions (tags and pool entry)
  const PROFESSIONS = [
    "Innkeeper", "Merchant", "Guard", "Scholar", "Thief", "Alchemist", "Blacksmith", "Sailor", "Priest", "Ranger", "Cartographer",
    "Herbalist", "Apothecary", "Relic-hunter", "Scribe", "Chef", "Barkeep", "Bandit", "Noble", "Minstrel", "Fisher", "Carpenter", "Stablehand", "Brewer", "Fence", "Hunter", "Smuggler", "Beggar", "Soldier", "Medic", "Explorer", "Cook"
  ];

  let state = {
    seed: Math.floor(Math.random()*0xFFFFFFFF),
    npcs: [],
    availableTags: [...PROFESSIONS],
    activeFilters: new Set()
  };

  function updateSeedDisplay(){ els.seedDisplay.textContent = `seed: ${state.seed >>> 0}`; }
  updateSeedDisplay();

  const pool = {
    first: [
      "Tahl","Mira","Borin","Edda","Kellen","Orin","Lysa","Haru","Juna","Garr","Rook","Sera","Fenn","Thora","Ves","Kadia","Aeron",
      "Rina","Silas","Ner","Ari","Bren","Cora","Jareth","Tamsin","Rowan","Isolde","Tova","Galen","Kes","Darian","Opal","Fyra"
    ],
    last: [
      "Stone","Rivers","Voss","Hale","Marek","Thistle","Crow","Fen","Maris","Ward","Cole","Bren","Locke","Iver","Dun","Grey","Ashfall",
      "Briar","Coldwater","Tor","Morland","Vale","Sable","Quick","Frost","Grove","Beryl"
    ],
    occupations: [...PROFESSIONS],
    traits: [
      "gruff","cheerful","secretive","suspicious","friendly","nervous","haughty","clumsy","witty","pensive","aloof","brusque",
      "meticulous","eccentric","cunning","charismatic","soft-spoken","vengeful","wise","stoic","superstitious","unflappable","naive"
    ],
    physical: [
      "scarred jaw","missing finger","tattooed forearms","bright eyes","a limp","low laugh","ink-stained hands","calloused palms",
      "gold tooth","pierced ear","weather-beaten skin","shock of white hair","crooked nose","peculiar birthmark","mismatched eyes",
      "elegant hands","sunburned face","silver earring"
    ],
    quirks: [
      "taps a ring","speaks in proverbs","hums constantly","whistles tunelessly","shuffles papers","collects beads","stares at the ceiling",
      "writes on scraps","counts coins","punctuates speech with gestures","rolls eyes often","avoids eye contact","rubs lucky stone","talks to belongings"
    ],
    backgrounds: [
      "raised among mountain nomads","noble's disgraced child","exiled from a ruined city","grew up on the docks","survived a magical catastrophe",
      "orphaned and raised by monks","apprenticed to a bard","learned magic in secret","escaped a desert clan","descended from heroes",
      "hidden royal","witness to a great injustice","foundling raised by druids","adopted by kobolds"
    ],
    hobbies: [
      "woodcarving","cooking rare dishes","birdwatching","collecting coins","brewing teas","writing poetry","studying old maps","sword-dancing","training pigeons",
      "painting sea scenes","amateur astronomy","storytelling","puzzle-solving"
    ],
    weaknesses: [
      "quick temper","secretive","paranoid","greedy","easily distracted","haunted by guilt","overly blunt","fears magic","easily flustered",
      "soft spot for children","addicted to gambling","hopeless romantic"
    ],
    notableSkills: [
      "forgery","deciphering languages","sleight of hand","tracking","gambling","public speaking","brewing potions","swordfighting","oratory","musical improvisation",
      "lockpicking","negotiation","archery","navigation by stars","cooking under pressure","herb identification","bartering"
    ],
    favoriteItems: [
      "worn compass","childhood scarf","ruby-inlaid dagger","copper locket","chipped chess piece","miniature hourglass",
      "scribbled journal page","trinket from a lost love","phantom seashell"
    ],
    relationships: [
      "estranged twin","secret mentor","local crime boss as friend","childhood bard acquaintance","secret lover in rival town",
      "adopted stray dog","rival merchant","overbearing mother","mysterious benefactor","sibling adventurer"
    ],
    moods: [
      "melancholy","joyful","anxious","fiery","serene","bitter","optimistic","scornful","restless","somber","flirtatious","hopeful"
    ],
    goals: [
      "redeem a lost love","invent a famous recipe","restore the family’s name","expose a corrupt official","catalog rare birds",
      "master a fighting style","earn villagers' trust","find someone worth believing in","see the world","restore a lost heirloom"
    ]
  };

  function createPRNG(seed){
    return SHARED.createPRNG(seed);
  }

  // Only parse tags as a single profession string, or nothing
  function parseTags(text){
    if (!text) return null;
    text = text.trim();
    // Only professions allowed, match existing
    if (pool.occupations.map(p=>p.toLowerCase()).includes(text.toLowerCase())) return text;
    // Allow common typos/flex
    for (let p of pool.occupations) {
      if (p.toLowerCase() === text.toLowerCase()) return p;
    }
    return null;
  }

  // Construct a single NPC using RNG; profession possibly enforced
  function createNPC(i, rng, customProfession){
    const name = `${rng.choice(pool.first)} ${rng.choice(pool.last)}`;
    let occupation = customProfession || rng.choice(pool.occupations);

    // Curve attributes toward relevant to the profession
    function themed(valArr, prof, themedMap) {
      if (themedMap && themedMap[prof]) {
        let themed = themedMap[prof];
        return rng.choice(Array.isArray(themed) ? themed : valArr.concat());
      }
      return rng.choice(valArr);
    }

    // Themed variants for some professions, fallback to generic pool
    const themedTraits = {
      "Thief": ["cunning","secretive","nervous","reckless","witty"],
      "Guard": ["dutiful","stoic","loyal","honorable","suspicious"],
      "Merchant": ["ambitious","friendly","persuasive","meticulous","greedy"],
      "Blacksmith": ["gruff","strong","meticulous","stubborn"],
      "Scholar": ["wise","eccentric","inquisitive","aloof","meticulous"],
      "Bandit": ["reckless","sarcastic","bold","short-tempered","secretive"],
      "Innkeeper": ["friendly","witty","meticulous","cheerful"]
      // Add more as desired...
    };
    const themedQuirks = {
      "Blacksmith": ["wipes brow on sooty sleeve"],
      "Thief": ["scans the crowd suspiciously","fidgets with lockpicks"],
      "Priest": ["mutters a small prayer","quotes scripture frequently"],
      "Cartographer": ["studying maps in downtime","inspects the horizon"],
      "Scholar": ["jots notes on scraps","adjusts glasses"],
      "Merchant": ["winks knowingly","rubs coins together"],
      "Sailor": ["hums sea shanties","chews sea-weed"],
      "Chef": ["sniffs the air for spice","wields a wooden spoon"],
      "Guard": ["checks weapon frequently"]
    };
    const themedSkills = {
      "Sailor": ["navigation by stars","ropework","singing shanties","fishing","weather prediction"],
      "Chef": ["cooking under pressure","herb identification","food presentation","quick frying"],
      "Alchemist": ["brewing potions","identifying toxins","distilling solutions"],
      "Merchant": ["bartering","public speaking","detecting fakes"],
      "Guard": ["swordfighting","hand-to-hand combat","armor maintenance","crowd control"],
      "Thief": ["pickpocketing","lockpicking","forgery","blending into crowds","escape artistry"],
      "Ranger": ["archery","tracking","field medicine","animal handling"],
      "Priest": ["ritual chanting","public oratory","counseling"]
    };

    let trait = themed(pool.traits, occupation, themedTraits);
    let physical = rng.choice(pool.physical);
    let quirk = themed(pool.quirks, occupation, themedQuirks);
    let motivation = rng.choice(pool.goals);
    let possession = rng.choice(pool.favoriteItems);
    let background = rng.choice(pool.backgrounds);
    let hobby = rng.choice(pool.hobbies);
    let weakness = rng.choice(pool.weaknesses);
    let notableSkill = themed(pool.notableSkills, occupation, themedSkills);
    let relationship = rng.choice(pool.relationships);
    let mood = rng.choice(pool.moods);

    // Multi-paragraph rich description
    let desc = [
      `<strong>${name}</strong> is a ${trait}, ${physical} <strong>${occupation.toLowerCase()}</strong> who is known to ${quirk}.`,
      `<em>Background:</em> ${background}.`,
      `Currently feeling <b>${mood}</b>, and secretly wants to ${motivation}.`,
      `Their specialized skill is <b>${notableSkill}</b>; for enjoyment they spend time ${hobby}.`,
      `Weakness: ${weakness}. Their most valued item is a <b>${possession}</b>.`,
      `Socially, their life is shaped by: ${relationship}.`
    ];

    // Profession tag for filtering
    let tags = [occupation];

    return {
      id: i,
      name: name,
      occupation: occupation,
      description: desc.join(" "),
      tags,
      trait, physical, quirk, motivation, possession, background, hobby, weakness, notableSkill, relationship, mood
    };
  }

  function generateNPCs(count){
    const rng = createPRNG(state.seed ^ 0x9E3779B9);
    let chosenProf = state.activeFilters.size === 1 ? Array.from(state.activeFilters)[0] : null;
    let arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(createNPC(i, rng, chosenProf));
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
        if (state.activeFilters.has(t)) state.activeFilters.delete(t);
        else {
          state.activeFilters.clear(); // Professions: single tag only for exclusive filtering/generation
          state.activeFilters.add(t);
        }
        renderTagFilter(); renderList();
      });
      els.tagFilter.appendChild(btn);
    }
  }

  function renderList(){
    els.npcList.innerHTML = '';
    const list = state.npcs.filter(n => {
      if (!state.activeFilters.size) return true;
      for (const f of state.activeFilters) if (n.tags && n.tags.includes(f)) return true;
      return false;
    });
    for (const n of list){
      const box = document.createElement('div');
      box.style.padding = '8px'; box.style.borderRadius = '8px'; box.style.marginBottom = '8px';
      box.style.background = 'rgba(255,255,255,0.02)';
      box.innerHTML = `<div style="font-size: 1.1em"><strong>${n.name}</strong> — ${n.occupation}</div><div style="margin-top:6px;color:var(--muted)">${n.description}</div>`;
      // tags display
      const tagWrap = document.createElement('div'); tagWrap.style.marginTop = '8px';
      if (n.tags && n.tags.length) {
        for (const t of n.tags){
          const tEl = document.createElement('span'); tEl.className = 'tag'; tEl.textContent = t;
          tagWrap.appendChild(tEl);
        }
      }
      box.appendChild(tagWrap);
      els.npcList.appendChild(box);
    }
  }

  // add custom profession tag button (adds a profession if not present)
  els.addTag.addEventListener('click', ()=>{
    const t = els.newTag.value.trim();
    if (!t) return;
    // Only professions allowed!
    if (!pool.occupations.includes(t)) return alert("That's not a recognized profession!");
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
