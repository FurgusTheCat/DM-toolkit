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

  // master list of tags
  const tags = [
    'dungeon','tavern','temple','library','cave','crypt','market','workshop','shrine','cellar',
    'barracks','throne','storeroom','laboratory','garden','armory','kitchen','study','observatory',
    'prison','bathhouse','arena','inn','magic_shop','stable','war_room','crypt_vault','training_yard',
    'balcony','chapel','thieves_guild','portal_chamber','smithy','aquarium','narcotics_den','trophy_room','druid_grove'
  ];

  // vocab bank (extended). Kept compact but complete for runtime.
  const vocab = {
    dungeon: {
      adjs: ['moldy','dank','stone-lined','dripping','chill','shadowy','ceiling-cracked','narrow','gloomy','slime-streaked','crumbling','echoing','claustrophobic','torch-lit','stale','vermin-infested'],
      scent: ['mildew','iron','stale water','sweat','rust','wet stone','old blood','rot','fungus','earthy','stagnant air'],
      items: ['chain','rusted grate','broken manacle','torch sconce','skull','rat','dented helm','tattered banner','pile of straw','iron ring','old bucket','rotten rope','cobweb','rusted lock','empty flask'],
      items_plural: ['chains','rusted grates','broken manacles','torch sconces','skulls','rats','dented helms','tattered banners','piles of straw','iron rings','old buckets','rotten ropes','cobwebs','rusted locks']
    },
    tavern: {
      adjs: ['smoky','rowdy','stained','crowded','raucous','sticky','dim','bustling','greasy','boisterous','fire-lit','ale-soaked','cheerful','lantern-lit'],
      scent: ['ale','stew','pipe smoke','spilled wine','sweat','roasting meat','wood smoke','bread','burnt onions','yeast','cider'],
      items: ['barrel','broken mug','stool','tankard','fireplace','table','bench','card deck','spilled dice','serving tray','chalkboard','dartboard','half-eaten loaf','apron'],
      items_plural: ['barrels','broken mugs','stools','tankards','fireplaces','tables','benches','card decks','spilled dice','serving trays','chalkboards','dartboards','loaves','aprons']
    },
    temple: {
      adjs: ['hallowed','serene','dusty','quiet','sacred','vaulted','echoing','marble','golden','solemn','ancient','candlelit','sun-dappled','ornate','incense-wreathed'],
      scent: ['incense','wax','myrrh','oil','old parchment','polished stone','frankincense','lavender','holy oil','burnt herbs','rosewater'],
      items: ['altar','candle','icon','prayer mat','offering bowl','stained glass','statue','scroll','holy book','chalice','bell','vestment'],
      items_plural: ['altars','candles','icons','prayer mats','offering bowls','stained glass panes','statues','scrolls','holy books','chalices','bells','vestments']
    },
    library: {
      adjs: ['quiet','book-lined','scented','dusty','shadowed','tall-shelved','scroll-stuffed','echoing','lamp-lit','silent','musty','mahogany-paneled','scholarly'],
      scent: ['paper','leather','ink','parchment','old book','wax','dust','glue','polished wood','aging scroll'],
      items: ['shelf','scroll','book','reading desk','inkpot','quill','globe','ladder','lantern','catalog','magnifying glass'],
      items_plural: ['shelves','scrolls','books','reading desks','inkpots','quills','globes','ladders','lanterns','catalogs']
    },
    cave: {
      adjs: ['echoing','limestone','drip-slick','narrow','jagged','winding','low-ceilinged','pitch-black','glistening','mossy'],
      scent: ['damp stone','earth','bat guano','moss','stale air','wet soil','clay'],
      items: ['stalagmite','puddle','bat','fungus patch','crack','pool','rockfall','spider web'],
      items_plural: ['stalagmites','puddles','bats','fungus patches','cracks','pools','rockfalls','spider webs']
    },
    crypt: {
      adjs: ['sepulchral','cold','shadowed','ancient','dust-choked','gloomy','damp','crumbling','vaulted','fungus-stained'],
      scent: ['old wax','rot','mold','dust','decay','stone','must','damp'],
      items: ['sarcophagus','bones','urn','shroud','skeletal hand','rusted lantern','carved lid','chain'],
      items_plural: ['sarcophagi','bones','urns','shrouds','skeletal hands','rusted lanterns','carved lids','chains']
    },
    market: {
      adjs: ['clamorous','colorful','sprawling','crowded','bustling','noisy','packed','sunlit','open-air','vibrant'],
      scent: ['spices','fruit','sweat','fresh bread','grilled meat','fish','flowers','cheese'],
      items: ['stall','crate','basket','coin purse','apple','bale','cloth','display table','jug','knife','scale'],
      items_plural: ['stalls','crates','baskets','coin purses','apples','bales','cloths','display tables']
    },
    workshop: {
      adjs: ['clanking','oily','organized','tool-strewn','busy','crowded','lamp-lit','metal-shod','sawdust-covered','smoky'],
      scent: ['metal','oil','smoke','grease','wood shavings','sweat','hot iron'],
      items: ['anvil','tools','vise','mallet','scrap metal','apron','workbench','file','tongs'],
      items_plural: ['anvils','tools','vises','mallets','scrap metals','aprons','workbenches','files']
    },
    shrine: {
      adjs: ['quiet','ornate','votive','tiny','flower-strewn','hidden','sunlit','rustic','candle-lit'],
      scent: ['incense','flowers','candle','herbs','perfume','myrrh','rainwater'],
      items: ['votive bowl','ribbons','stone bench','idol','flower petals','offering plate','prayer beads'],
      items_plural: ['votive bowls','ribbons','stone benches','idols','flower petals','offering plates']
    },
    cellar: {
      adjs: ['moldy','cool','low','dark','cramped','musty','dirt-floored','shadowy','cluttered'],
      scent: ['ferment','damp earth','wine','must','mold','old fruit','yeast'],
      items: ['cask','shelf','bottle','barrel','rack','jar','shovel','crate'],
      items_plural: ['casks','shelves','bottles','barrels','racks','jars','shovels','crates']
    },
    barracks: {
      adjs: ['spartan','barrack-stale','lined with bunks','orderly','utilitarian','crowded','rough','drafty'],
      scent: ['sweat','leather','oiled steel','old boots','blanket','stale air'],
      items: ['rack','bench','bunk','footlocker','helmet','shield','sword'],
      items_plural: ['racks','benches','bunks','footlockers','helmets','shields','swords']
    },
    throne: {
      adjs: ['grand','tarnished','opulent','gilded','echoing','marble','canopied','velvet-draped','ornate'],
      scent: ['tallow','parfum','old velvet','brass polish','incense','roses'],
      items: ['throne','banner','scepter','cushion','rug','torch','crown'],
      items_plural: ['thrones','banners','scepters','cushions','rugs','torches','crowns']
    },
    storeroom: {
      adjs: ['stacked','dusty','cramped','crowded','musty','box-filled','dim','cobwebbed'],
      scent: ['wood','paper','rope','old grain','mothball','mold'],
      items: ['crate','rope','box','sack','barrel','shelf','jar'],
      items_plural: ['crates','ropes','boxes','sacks','barrels','shelves','jars']
    },
    laboratory: {
      adjs: ['sterile','flickering','smoke-streaked','cluttered','bubbling','chemical-stained','orderly','glass-filled'],
      scent: ['chemicals','ozone','brimstone','alcohol','acid','potions'],
      items: ['vials','bunsen','beaker','mortar','scales','flask','pipette','alembic'],
      items_plural: ['vials','bunsens','beakers','mortars','scales','flasks','pipettes','alembics']
    },
    garden: {
      adjs: ['lush','overgrown','flowering','sun-dappled','buzzing','walled','tranquil','fragrant'],
      scent: ['flowers','earth','dew','fresh grass','herbs','rose'],
      items: ['bench','fountain','trellis','herb bed','statue','watering can'],
      items_plural: ['benches','fountains','trellises','herb beds','statues','watering cans']
    },
    armory: {
      adjs: ['weapon-lined','fortified','steel-braced','echoing','orderly','dusty','guarded'],
      scent: ['oil','metal','leather','polish','smoke'],
      items: ['sword','shield','rack','helmet','mail','gauntlet','arrow'],
      items_plural: ['swords','shields','racks','helmets','mails','gauntlets','arrows']
    },
    kitchen: {
      adjs: ['busy','steamy','spice-filled','cluttered','chaotic','fire-lit','well-used'],
      scent: ['bread','spices','stew','smoke','onion','garlic'],
      items: ['pot','pan','knife','spoon','ladle','bowl','apron'],
      items_plural: ['pots','pans','knives','spoons','ladles','bowls','aprons']
    },
    study: {
      adjs: ['quiet','book-strewn','paper-cluttered','lamplit','orderly','cozy','leather-chaired'],
      scent: ['ink','paper','leather','wax','tea','dust'],
      items: ['desk','chair','inkpot','quill','scroll','book','lamp'],
      items_plural: ['desks','chairs','inkpots','quills','scrolls','books','lamps']
    },
    observatory: {
      adjs: ['star-lit','domed','telescope-filled','quiet','high-vaulted','lamp-lit'],
      scent: ['wax','old paper','ozone','dust','night air'],
      items: ['telescope','star chart','globe','notebook','astrolabe','sextant'],
      items_plural: ['telescopes','star charts','globes','notebooks','astrolabes','sextants']
    },
    prison: {
      adjs: ['barred','grim','stone-walled','damp','cramped','echoing','guarded'],
      scent: ['sweat','rot','mildew','blood','rust','urine'],
      items: ['manacle','iron bar','cot','bucket','shackle','grate','torch'],
      items_plural: ['manacles','iron bars','cots','buckets','shackles','grates','torches']
    },
    bathhouse: {
      adjs: ['steamy','marble','sunken','tile-lined','echoing','luxurious','mosaic'],
      scent: ['soap','steam','perfume','rosewater','lavender'],
      items: ['towel','basin','soap','sponge','bench','mirror'],
      items_plural: ['towels','basins','soaps','sponges','benches','mirrors']
    },
    arena: {
      adjs: ['sandy','blood-spattered','open','crowded','tiered','sunlit','dusty'],
      scent: ['sweat','blood','dirt','leather','dust'],
      items: ['sand','shield','helm','banner','trophy','gate'],
      items_plural: ['sands','shields','helms','banners','trophies','gates']
    },
    inn: {
      adjs: ['welcoming','timbered','homey','fire-lit','cozy','quaint','bustling'],
      scent: ['stew','fresh bread','ale','lavender','firewood'],
      items: ['bed','blanket','wash basin','pitcher','table','mug'],
      items_plural: ['beds','blankets','wash basins','pitchers','tables','mugs']
    },
    magic_shop: {
      adjs: ['arcane','cluttered','glowing','mysterious','candle-lit','curio-filled'],
      scent: ['incense','ozone','herbs','sulfur','candle smoke'],
      items: ['potion','wand','tome','amulet','crystal','orb','scroll'],
      items_plural: ['potions','wands','tomes','amulets','crystals','orbs','scrolls']
    },
    stable: {
      adjs: ['hay-strewn','muddy','wooden','spacious','sawdusty','open-air'],
      scent: ['hay','manure','horse','saddle soap'],
      items: ['saddle','hay bale','bucket','feed','bridle','trough'],
      items_plural: ['saddles','hay bales','buckets','feeds','bridles','troughs']
    },
    war_room: {
      adjs: ['map-lined','strategic','dim','tense','orderly','bannered'],
      scent: ['wax','smoke','parchment','leather'],
      items: ['table','map','miniature','flag','document','scroll'],
      items_plural: ['tables','maps','miniatures','flags','documents','scrolls']
    },
    crypt_vault: {
      adjs: ['hidden','heavy-doored','gloomy','dust-choked','gold-lined','fortified'],
      scent: ['old wax','dust','coin','mold','stone'],
      items: ['coffer','lock','key','gold bar','chest','sarcophagus','trap'],
      items_plural: ['coffers','locks','keys','gold bars','chests','sarcophagi','traps']
    },
    training_yard: {
      adjs: ['muddy','packed','open-air','barricaded','scuffed','sunlit'],
      scent: ['sweat','dust','grass','leather'],
      items: ['dummy','target','sword','shield','bow','arrow'],
      items_plural: ['dummies','targets','swords','shields','bows','arrows']
    },
    balcony: {
      adjs: ['overlooking','railed','stone','high','windblown','ornate'],
      scent: ['fresh air','flowers','dew','night air'],
      items: ['chair','railing','lantern','bench','potted plant','table'],
      items_plural: ['chairs','railings','lanterns','benches','potted plants','tables']
    },
    chapel: {
      adjs: ['sunlit','quiet','simple','pew-lined','stained-glass','echoing'],
      scent: ['incense','flowers','wax','old wood'],
      items: ['pew','altar','prayer book','candle','icon','hymnal'],
      items_plural: ['pews','altars','prayer books','candles','icons','hymnals']
    },
    thieves_guild: {
      adjs: ['shadowy','secret','cluttered','torch-lit','hidden','rickety'],
      scent: ['ale','tobacco','grease','stale smoke'],
      items: ['dice','cards','dagger','map','lockpick','hood'],
      items_plural: ['dice','cards','daggers','maps','lockpicks','hoods']
    },
    portal_chamber: {
      adjs: ['glowing','sigil-marked','echoing','mystical','aura-filled','crystal-lined'],
      scent: ['ozone','incense','stone','oil','ether'],
      items: ['portal','sigil','rune','circle','crystal','orb','pedestal'],
      items_plural: ['portals','sigils','runes','circles','crystals','orbs']
    },
    smithy: {
      adjs: ['hot','smoky','anvil-lined','crowded','hammering','furnace-lit'],
      scent: ['smoke','hot metal','coal','oil'],
      items: ['anvil','hammer','tongs','bellows','forge','horseshoe'],
      items_plural: ['anvils','hammers','tongs','bellows','forges','horseshoes']
    },
    aquarium: {
      adjs: ['watery','glass-walled','bubbly','colorful','fish-filled','cool'],
      scent: ['salt','water','algae','seaweed'],
      items: ['tank','coral','fish','net','shell','filter'],
      items_plural: ['tanks','corals','fish','nets','shells','filters']
    },
    // corrected key: narcotics_den (matches tag list)
    narcotics_den: {
      adjs: ['smoke-filled','dim','pillow-strewn','opulent','secret','intimate'],
      scent: ['smoke','opium','perfume','incense'],
      items: ['pipe','cushion','bottle','tray','vial','blanket'],
      items_plural: ['pipes','cushions','bottles','trays','vials','blankets']
    },
    trophy_room: {
      adjs: ['mahogany-lined','imposing','trophy-packed','carpeted','polished','gilded'],
      scent: ['polish','old wood','dust','fur'],
      items: ['trophy','plaque','antler','glass case','medal'],
      items_plural: ['trophies','plaques','antlers','glass cases','medals']
    },
    druid_grove: {
      adjs: ['sacred','leafy','sun-dappled','circle','root-woven','ancient'],
      scent: ['earth','flowers','grass','herbs','dew'],
      items: ['stone','altar','herb','flower','vines'],
      items_plural: ['stones','altars','herbs','flowers','vines']
    }
  };

  // helper to get element or null
  function get(el){ return el || null; }

  // safe RNG pick
  function pick(arr, rng){
    if (!arr || !arr.length) return '';
    return arr[Math.floor(rng.next() * arr.length)];
  }

  // state and seed display
  const state = { seed: Math.floor(Math.random() * 0xFFFFFFFF), active: new Set() };
  function updateSeed(){ if (els.seedDisplay) els.seedDisplay.textContent = `seed: ${state.seed >>> 0}`; }
  updateSeed();

  // render tag buttons
  function renderTags(){
    if (!els.tagList) return;
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

  // generate description
  function generateDescription(){
    // prefer SHARED.createPRNG if available; fallback to a minimal RNG wrapper
    const rng = (typeof SHARED !== 'undefined' && SHARED && typeof SHARED.createPRNG === 'function')
      ? SHARED.createPRNG(state.seed)
      : { next: ()=>Math.random() };

    const complexity = (els.descComplexity && els.descComplexity.value) ? els.descComplexity.value : 'short';
    const activeTags = Array.from(state.active);
    const props = (els.propInput && els.propInput.value ? els.propInput.value : '').split(',').map(s=>s.trim()).filter(Boolean);
    const npcs = (els.npcInput && els.npcInput.value ? els.npcInput.value : '').split(',').map(s=>s.trim()).filter(Boolean);

    // collect vocab categories
    let adjs = [], scents = [], items = [], items_plural = [];
    for (const t of activeTags){
      const v = vocab[t];
      if (v){
        if (v.adjs) adjs.push(...v.adjs);
        if (v.scent) scents.push(...v.scent);
        if (v.items) items.push(...v.items);
        if (v.items_plural) items_plural.push(...v.items_plural);
      }
    }

    const fallback = {
      adjs: ['damp','musty','shadowy','narrow','spacious','ornate','crumbling','luminous'],
      scents: ['mildew','spices','smoke','salt','old parchment','iron'],
      items: ['wooden table','iron ring','torn curtain','stone basin'],
      items_plural: ['tables','rings','curtains','basins']
    };

    if (!adjs.length) adjs.push(...fallback.adjs);
    if (!scents.length) scents.push(...fallback.scents);
    if (!items.length) items.push(...fallback.items);
    if (!items_plural.length) items_plural.push(...fallback.items_plural);

    const parts = [];

    // Short templates (keeps the many sentence forms you added)
    if (complexity === 'short'){
      const mediumTemplates1 = [
        `You step into a ${pick(adjs, rng)} room where the scent of ${pick(scents, rng)} mingles with ${pick(scents, rng)}; a ${pick(items, rng)} lies nearby, and ${props.length ? props.join(', ') : 'various traces of activity'} catch your eye.`,
        `A ${pick(adjs, rng)} and ${pick(adjs, rng)} space greets you, the smell of ${pick(scents, rng)} hangs in the air, and among the clutter you notice a few ${pick(items_plural, rng)} and ${props.length ? props.join(', ') : 'a scattering of odd objects'}.`,
        `Within this ${pick(adjs, rng)} chamber, the aroma of ${pick(scents, rng)} lingers; a ${pick(items, rng)} rests against the wall, surrounded by ${props.length ? props.join(', ') : pick(items_plural, rng)}.`,
        `A sense of ${pick(adjs, rng)} pervades the area, interlaced with whiffs of ${pick(scents, rng)} and ${pick(scents, rng)}; on a ${pick(items, rng)}, ${props.length ? props.join(', ') : 'an interesting stain'} draws attention.`,
        `This ${pick(adjs, rng)} locale is redolent with ${pick(scents, rng)}, and a scattering of ${pick(items_plural, rng)} is visible alongside ${props.length ? props.join(', ') : 'traces of recent activity'}.`,
        `There’s a ${pick(adjs, rng)} air here, thick with the scent of ${pick(scents, rng)}; resting in the corner, a ${pick(items, rng)} sits among several ${props.length ? props.join(', ') : pick(items_plural, rng)}.`,
        `Passing into this ${pick(adjs, rng)} space, you catch ${pick(scents, rng)} and ${pick(scents, rng)} on the air—several ${pick(items_plural, rng)} and ${props.length ? props.join(', ') : 'miscellaneous detritus'} are scattered about.`,
        `A ${pick(adjs, rng)} chamber opens before you, marked by a lingering ${pick(scents, rng)} aroma, and among its features are ${pick(items_plural, rng)} with ${props.length ? props.join(', ') : 'faded markings'}.`,
        `The ${pick(adjs, rng)} environment carries the fragrant notes of ${pick(scents, rng)} and ${pick(scents, rng)}; a ${pick(items, rng)} rests atop a pile of ${props.length ? props.join(', ') : pick(items_plural, rng)}.`,
        `Within this ${pick(adjs, rng)} and ${pick(adjs, rng)} enclosure, you immediately notice the whiff of ${pick(scents, rng)} and a sight of ${pick(items_plural, rng)}, with ${props.length ? props.join(', ') : 'no obvious owner'}.`
      ];
      const mediumTemplates2 = [
        `This room contains ${pick(adjs, rng)} ${pick(items, rng)} and ${props.length ? props.join(', ') : 'the whole room'} captivates you.`,
        `You notice the underlying smell of ${pick(scents, rng)} lingering in the room.`,
        `A faint aroma of ${pick(scents, rng)} drifts by as you spot a ${pick(adjs, rng)} ${pick(items, rng)}.`,
        `It's easy to spot ${pick(items_plural, rng)} here, each one somehow ${pick(adjs, rng)}.`,
        `A ${pick(adjs, rng)} ${pick(items, rng)} stands out, though it's the scent of ${pick(scents, rng)} you notice first.`,
        `You find yourself drawn to a ${pick(adjs, rng)} ${pick(items, rng)} in the center of the space.`,
        `All around are ${pick(adjs, rng)} signs of life and use—a few ${pick(items_plural, rng)} rest nearby.`,
        `You breathe in, catching a whiff of ${pick(scents, rng)}, and glance at some ${pick(items_plural, rng)}.`,
        `The persistently ${pick(adjs, rng)} quality in the air is underscored by the odor of ${pick(scents, rng)}.`,
        `Your attention is caught by a cluster of ${pick(adjs, rng)} ${pick(items_plural, rng)}.`,
        `A single ${pick(items, rng)} exudes ${pick(adjs, rng)} character; something about ${pick(scents, rng)} lingers too.`
      ];
      parts.push(pick(mediumTemplates1, rng));
      parts.push(pick(mediumTemplates2, rng));
      if (npcs.length) parts.push(`You see ${npcs.join(', ')} here.`);
    }

    // Medium complexity (longer single-paragraph forms)
    else if (complexity === 'medium'){
      const longTemplates = [
        `Crossing the threshold, you find yourself in a ${pick(adjs, rng)} and ${pick(adjs, rng)} room, its atmosphere thick with the scent of ${pick(scents, rng)} and a hint of ${pick(scents, rng)}. A ${pick(items, rng)} rests nearby, and small ${pick(items_plural, rng)} litter the floor.`,
        `The ${pick(adjs, rng)} space before you is filled with the unmistakable aroma of ${pick(scents, rng)} blending with ${pick(scents, rng)}. Light glints off ${pick(items, rng)}, and your gaze is drawn to ${props.length ? props.join(', ') : 'a curious arrangement of objects'}.`,
        `Stepping inside, you are greeted by a ${pick(adjs, rng)} chamber where ${pick(scents, rng)} lingers. ${pick(items_plural, rng)} can be seen beside ${props.length ? props.join(', ') : 'some scattered belongings'}, and the overall effect is ${pick(adjs, rng)}.`
        `A sense of calm descends as you enter this ${pick(adjs, rng)} room. The walls are adorned with patterns that evoke memories of ${pick(scents, rng)} and ${pick(scents, rng)}. On a small table rests a ${pick(items, rng)}, while ${pick(items_plural, rng)} are thoughtfully arranged around ${props.length ? props.join(', ') : 'a central feature you can’t quite identify'}.`,
        `Upon entering, your senses are assaulted by the mingling scents of ${pick(scents, rng)}, ${pick(scents, rng)}, and something unidentifiable wafting from a ${pick(items, rng)} in the corner. The ${pick(adjs, rng)} decor is enhanced by ${props.length ? props.join(', ') : 'unexpected artistic touches'}, while several ${pick(items_plural, rng)} seem almost deliberately placed to catch your attention.`,
        `You step carefully into a ${pick(adjs, rng)} and ${pick(adjs, rng)} room, where the air is thick with ${pick(scents, rng)} and ${pick(scents, rng)}. Off to one side sits a ${pick(items, rng)}, partially covered by ${pick(items_plural, rng)}, as if someone left in haste. The presence of ${props.length ? props.join(', ') : 'peculiar items'} adds to the room’s intrigue.`,
        `The transition into this ${pick(adjs, rng)} chamber is immediate—a blend of ${pick(scents, rng)} and ${pick(scents, rng)} fills the air. A fragile ${pick(items, rng)} sits atop a cluster of ${pick(items_plural, rng)}, and you notice ${props.length ? props.join(', ') : 'various oddities scattered about'}, each contributing to the overall ${pick(adjs, rng)} mood.`,
        `As you move forward, the ${pick(adjs, rng)} space envelopes you, layered with complex scents of ${pick(scents, rng)} and ${pick(scents, rng)}. Glancing around, you spot a ${pick(items, rng)} sitting amidst a few ${pick(items_plural, rng)}, and ${props.length ? props.join(', ') : 'an assortment of small objects'} catches the shifting light from above.`,
        `Entering the room, an atmosphere both ${pick(adjs, rng)} and ${pick(adjs, rng)} draws your focus to a ${pick(items, rng)} on an old shelf, its presence surrounded by traces of ${pick(scents, rng)} and ${pick(scents, rng)}. Scattered around are several ${pick(items_plural, rng)}, each seemingly paired with ${props.length ? props.join(', ') : 'other remnants of past visitors'}.`
      ];
      parts.push(pick(longTemplates, rng));
      if (npcs.length) parts.push(`Present: ${npcs.join(', ')}.`);
    }

    // Verbose / long (multi-sentence descriptions)
    else {
      const veryLongTemplates = [
        `As you enter this ${pick(adjs, rng)}, ${pick(adjs, rng)} room, your senses are immediately engaged by the layered scents of ${pick(scents, rng)}, ${pick(scents, rng)}, and a trace of ${pick(scents, rng)}. Shadows pool in the corners while a ${pick(items, rng)} occupies a place of prominence.`,
        `You find yourself in a ${pick(adjs, rng)} chamber, bathed in a ${pick(adjs, rng)} glow. The air is saturated with the scents of ${pick(scents, rng)}, ${pick(scents, rng)}, and ${pick(scents, rng)}, and scattered ${pick(items_plural, rng)} suggest frequent use.`,
        `Stepping through the entryway, you are immersed in a world defined by ${pick(adjs, rng)} and ${pick(adjs, rng)} features. The air is thick with the intermingled aromas of ${pick(scents, rng)}, ${pick(scents, rng)}, and something faintly sweet. Nearby, a ${pick(items, rng)} bears the marks of whatever occupation took place here.`
      ];
      parts.push(pick(veryLongTemplates, rng));
      parts.push(`Against one wall ${pick(items, rng)} rests${props.length ? ', accompanied by ' + props.slice(0,4).join(', ') : ''}.`);
      parts.push(`Small details suggest the room's purpose: ${activeTags.length ? activeTags.join(', ') + '.' : 'no obvious origin.'}`);
      if (npcs.length) parts.push(`Present are ${npcs.map(n=>`${n}`).join(', ')} — they might be hostile or friendly.`);
      if (rng.next() < 0.45) parts.push(`You find a ${pick(items, rng)} that bears ${pick(['a scratch','a faded mark','an unfamiliar sigil','a smear of ink'], rng)}.`);
      const VlongTemplates1 = [
        `An exit is ${pick(['a heavy door','a narrow passage','a low archway','a hidden slit'], rng)}; beyond it you sense ${pick(['a draft','a murmur','silence','a faint light'], rng)}.`,
        `You notice the subtle smell of ${pick(scents, rng)} lingering in the room, as if something recent disturbed the dust.`
      ];
      parts.push(pick(VlongTemplates1, rng));
    }

    // incorporate any typed notes verbatim as an additional observation
    const notesRaw = (els.propInput && els.propInput.value) ? els.propInput.value : '';
    if (notesRaw && notesRaw.trim()){
      parts.push(`Props Added: ${notesRaw.trim()}`);
    }

    const text = parts.join(' ');
    // save last description locally (useful between pages)
    try { localStorage.setItem('dmtoolkit_last_room_desc', JSON.stringify({text, meta:{tags:activeTags, props, npcs}})); } catch(e){/* ignore */ }

    if (els.description) els.description.textContent = text;
    return text;
  }

  // export as text
  if (els.exportDesc) {
    els.exportDesc.addEventListener('click', ()=>{
      const txt = (els.description && els.description.textContent) || generateDescription();
      if (typeof SHARED !== 'undefined' && SHARED && typeof SHARED.downloadText === 'function') {
        SHARED.downloadText(`room-desc-${Date.now()}.txt`, txt, 'text/plain');
      } else {
        // fallback download behavior
        try {
          const blob = new Blob([txt], {type: 'text/plain'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `room-desc-${Date.now()}.txt`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(()=>URL.revokeObjectURL(url), 10000);
        } catch(e){
          console.warn('export fallback failed', e);
        }
      }
    });
  }

  if (els.genDesc) {
    els.genDesc.addEventListener('click', ()=>{
      generateDescription();
      state.seed = (state.seed + 1) >>> 0;
      updateSeed();
    });
  }

  if (els.randomSeed) {
    els.randomSeed.addEventListener('click', ()=> {
      state.seed = Math.floor(Math.random()*0xFFFFFFFF);
      updateSeed();
    });
  }

  // expose for debug
  window.RoomDescriptor = { state, generateDescription };

})();
