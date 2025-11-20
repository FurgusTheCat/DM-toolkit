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

   const tags = [
  'dungeon',
  'tavern',
  'temple',
  'library',
  'cave',
  'crypt',
  'market',
  'workshop',
  'shrine',
  'cellar',
  'barracks',
  'throne',
  'storeroom',
  'laboratory',
  'garden',
  'armory',
  'kitchen',
  'study',
  'observatory',
  'prison',
  'bathhouse',
  'arena',
  'inn',
  'magic_shop',
  'stable',
  'war_room',
  'crypt_vault',
  'training_yard',
  'balcony',
  'chapel',
  'thieves_guild',
  'portal_chamber',
  'smithy',
  'aquarium',
  'narcotics_den',
  'trophy_room',
  'druid_grove'
];
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
  dungeon: {
    adjs: ['moldy','dank','stone-lined','dripping','chill','shadowy','ceiling-cracked','narrow','gloomy','slime-streaked','crumbling','echoing','claustrophobic','torch-lit','stale','vermin-infested','slick','rough-hewn','dimly-lit','littered'],
    scent: ['mildew','iron','stale water','sweat','rust','wet stone','old blood','rot','fungus','earthy','stagnant air'],
    items: ['chain','rusted grate','broken manacle','torch sconce','skull','rat','dented helm','tattered banner','pile of straw','iron ring','old bucket','rotten rope','cobweb','rusted lock','empty flask'],
    items_plural: ['chains','rusted grates','broken manacles','torch sconces','skulls','rats','dented helms','tattered banners','piles of straw','iron rings','old buckets','rotten ropes','cobwebs','rusted locks','empty flasks']
  },
  tavern: {
    adjs: ['smoky','rowdy','stained','crowded','raucous','sticky','dim','bustling','greasy','boisterous','fire-lit','ale-soaked','cheerful','lantern-lit','raucous','noisy','rowdy','grease-smudged','rickety','welcoming'],
    scent: ['ale','stew','pipe smoke','spilled wine','sweat','roasting meat','wood smoke','bread','burnt onions','yeast','cider','apple','cheese'],
    items: ['barrel','broken mug','stool','tankard','fireplace','table','bench','card deck','spilled dice','serving tray','chalkboard','dartboard','half-eaten loaf','apron','spoon','pitcher'],
    items_plural: ['barrels','broken mugs','stools','tankards','fireplaces','tables','benches','card decks','spilled dice','serving trays','chalkboards','dartboards','half-eaten loaves','aprons','spoons','pitchers']
  },
  temple: {
    adjs: ['hallowed','serene','dusty','quiet','sacred','vaulted','echoing','marble','golden','solemn','ancient','candlelit','sun-dappled','ornate','incense-wreathed','peaceful','polished','reverent','tranquil'],
    scent: ['incense','wax','myrrh','oil','old parchment','polished stone','frankincense','lavender','holy oil','burnt herbs','rosewater'],
    items: ['altar','candle','icon','prayer mat','offering bowl','stained glass','statue','scroll','holy book','chalice','bell','vestment','censor','reliquary','rosary','tapestry'],
    items_plural: ['altars','candles','icons','prayer mats','offering bowls','stained glass panes','statues','scrolls','holy books','chalices','bells','vestments','censors','reliquaries','rosaries','tapestries']
  },
  library: {
    adjs: ['quiet','book-lined','scented','dusty','shadowed','tall-shelved','scroll-stuffed','echoing','lamp-lit','silent','musty','mahogany-paneled','scholarly','dim','orderly','leather-bound','echoing','spacious','narrow-aisled'],
    scent: ['paper','leather','ink','parchment','old book','wax','dust','glue','polished wood','aging scroll','candle'],
    items: ['shelf','scroll','book','reading desk','inkpot','quill','globe','ladder','lantern','catalog','magnifying glass','map','bookend','reading chair','tome','index cards'],
    items_plural: ['shelves','scrolls','books','reading desks','inkpots','quills','globes','ladders','lanterns','catalogs','magnifying glasses','maps','bookends','reading chairs','tomes','index cards']
  },
  cave: {
    adjs: ['echoing','limestone','drip-slick','narrow','jagged','winding','low-ceilinged','pitch-black','glistening','mossy','bat-filled','gaping','root-choked','uneven','deep','cold','clammy','twisting','shadowy'],
    scent: ['damp stone','earth','bat guano','moss','stale air','wet soil','clay','fungus','minerals','flowstone','lichen'],
    items: ['stalagmite','puddle','bat','fungus patch','crack','pool','rockfall','spider web','pebble','glow-worm','bone','cave painting','dripping water','snail','moss mat'],
    items_plural: ['stalagmites','puddles','bats','fungus patches','cracks','pools','rockfalls','spider webs','pebbles','glow-worms','bones','cave paintings','dripping water pools','snails','moss mats']
  },
  crypt: {
    adjs: ['sepulchral','cold','shadowed','ancient','dust-choked','gloomy','damp','crumbling','vaulted','fungus-stained','sarcophagus-lined','cobwebbed','eerie','mossy','stone-cold','silent','sunken','claustrophobic','creaking'],
    scent: ['old wax','rot','mold','dust','decay','stone','must','damp','earth','burnt offering','dry air'],
    items: ['sarcophagus','bones','urn','shroud','skeletal hand','rusted lantern','carved lid','chain','torch stub','shadow','tombstone','amulet','broken seal','cobweb','key'],
    items_plural: ['sarcophagi','bones','urns','shrouds','skeletal hands','rusted lanterns','carved lids','chains','torch stubs','shadows','tombstones','amulets','broken seals','cobwebs','keys']
  },
  market: {
    adjs: ['clamorous','colorful','sprawling','crowded','bustling','noisy','packed','sunlit','open-air','vibrant','scented','shouted','busy','tent-filled','haggling','muddy','rain-damp','fragrant','rowdy'],
    scent: ['spices','fruit','sweat','fresh bread','grilled meat','fish','flowers','cheese','leather','herbs','perfume'],
    items: ['stall','crate','basket','coin purse','apple','bale','cloth','display table','jug','fish','knife','scale','vendor sign','jug','sack','tarp','spice jar'],
    items_plural: ['stalls','crates','baskets','coin purses','apples','bales','cloths','display tables','jugs','fish','knives','scales','vendor signs','jugs','sacks','tarps','spice jars']
  },
  workshop: {
    adjs: ['clanking','oily','organized','tool-strewn','busy','crowded','lamp-lit','metal-shod','sawdust-covered','smoky','sweat-stained','purposeful','orderly','hammering','well-used','scattered','wood-paneled','greased','battered'],
    scent: ['metal','oil','smoke','grease','wood shavings','sweat','hot iron','leather','coal','char','solvent'],
    items: ['anvil','tools','vise','mallet','scrap metal','apron','workbench','file','tongs','bucket','nail','blueprint','whetstone','gear','caliper','hammer'],
    items_plural: ['anvils','tools','vises','mallets','scrap metals','aprons','workbenches','files','tongs','buckets','nails','blueprints','whetstones','gears','calipers','hammers']
  },
  shrine: {
    adjs: ['quiet','ornate','votive','tiny','flower-strewn','hidden','sunlit','rustic','candle-lit','decorated','hushed','sacred','simple','stone-built','colorful','reverent','peaceful','sheltered','modest'],
    scent: ['incense','flowers','candle','herbs','perfume','myrrh','rainwater','fresh grass','oil','frankincense','sage'],
    items: ['votive bowl','ribbons','stone bench','idol','flower petals','offering plate','prayer beads','prayer flag','small bell','charm','statue','candle stub','oiled cloth','icon','blessing paper'],
    items_plural: ['votive bowls', 'ribbons', 'stone benches', 'idols', 'flower petals', 'offering plates', 'prayer beads', 'prayer flags', 'small bells', 'charms', 'statues', 'candle stubs', 'oiled cloths', 'icons', 'blessing papers']
  },
  cellar: {
    adjs: ['moldy','cool','low','dark','cramped','musty','dirt-floored','shadowy','cluttered','damp','cobwebbed','stone-walled','barrel-lined','chill','silent','dripping','shelved','root-choked','creaking'],
    scent: ['ferment','damp earth','wine','must','mold','old fruit','sour beer','cork','stale air','root','yeast'],
    items: ['cask','shelf','bottle','barrel','rack','jar','shovel','crate','basket','spigot','ladder','keg','pickaxe','spade','apple','root vegetable'],
    items_plural: ['casks','shelves','bottles','barrels','racks','jars','shovels','crates','baskets','spigots','ladders','kegs','pickaxes','spades','apples','root vegetables']
  },
  barracks: {
    adjs: ['spartan','barrack-stale','lined with bunks','orderly','utilitarian','crowded','rough','drafty','military','noisy','muddy-booted','discipline-filled','harsh-lit','plain','blanketed','weapon-racked','shield-lined','loud','musty'],
    scent: ['sweat','leather','oiled steel','old boots','blanket','stale air','polish','stale bread','wet wool','charcoal','smoke'],
    items: ['rack','bench','bunk','footlocker','helmet','shield','sword','blanket','mess kit','weapon stand','dice','belt','tin cup','canteen','bedroll'],
    items_plural: ['racks','benches','bunks','footlockers','helmets','shields','swords','blankets','mess kits','weapon stands','dice','belts','tin cups','canteens','bedrolls']
  },
  throne: {
    adjs: ['grand','tarnished','opulent','gilded','echoing','marble','canopied','velvet-draped','ornate','chilled','red-carpeted','polished','majestic','vaulted','sunlit','spectacular','aged','shadowed','imposing'],
    scent: ['tallow','parfum','old velvet','brass polish','incense','smoke','perfume','lemon oil','aged wood','roses','dust'],
    items: ['throne','banner','scepter','cushion','rug','torch','crown','goblet','tapestry','pedestal','orb','mirror','footstool','velvet cord','plaque'],
    items_plural: ['thrones','banners','scepters','cushions','rugs','torches','crowns','goblets','tapestries','pedestals','orbs','mirrors','footstools','velvet cords','plaques']
  },
  storeroom: {
    adjs: ['stacked','dusty','cramped','crowded','musty','box-filled','dim','cobwebbed','shadowy','locked','rickety','spider-haunted','orderly','overflowing','cold','wooden','damp','plain','neglected'],
    scent: ['wood','paper','rope','old grain','mothball','mold','cardboard','dust','canvas','oil','must'],
    items: ['crate','rope','box','sack','barrel','shelf','jar','lantern','ladder','tarp','nail','padlock','candle stub','chest','chalk'],
    items_plural: ['crates','ropes','boxes','sacks','barrels','shelves','jars','lanterns','ladders','tarps','nails','padlocks','candle stubs','chests','chalks']
  },
  laboratory: {
    adjs: ['sterile','flickering','smoke-streaked','cluttered','bubbling','chemical-stained','orderly','glass-filled','musty','acid-scarred','glowing','tiled','steamy','goggled','burnt','alchemical','herb-scented','shelf-lined','beaker-strewn'],
    scent: ['chemicals','ozone','brimstone','alcohol','burnt hair','distilled spirit','herbs','acid','smoke','potions','ether'],
    items: ['vials','bunsen','beaker','mortar','scales','flask','pipette','tongs','journal','cauldron','herbs','alembic','burner','telescope','goggles','retort'],
    items_plural: ['vials', 'bunsens', 'beakers', 'mortars', 'scales', 'flasks', 'pipettes', 'tongs', 'journals', 'cauldrons', 'herbs', 'alembics', 'burners', 'telescopes', 'goggles', 'retorts']
  },
  garden: {
    adjs: ['lush','overgrown','flowering','sun-dappled','buzzing','walled','tranquil','fragrant','leafy','wild','well-tended','shaded','fountain-fed','hedged','blooming','verdant','chattering','secretive','herbaceous'],
    scent: ['flowers','earth','dew','fresh grass','herbs','rose','compost','pollen','rain','petals','mint'],
    items: ['bench','fountain','trellis','herb bed','statue','watering can','birdbath','glove','trowel','basket','lantern','hedge','wheelbarrow','shrub','arbor'],
    items_plural: ['benches','fountains','trellises','herb beds','statues','watering cans','birdbaths','gloves','trowels','baskets','lanterns','hedges','wheelbarrows','shrubs','arbors']
  },
  armory: {
    adjs: ['weapon-lined','fortified','steel-braced','echoing','orderly','dusty','guarded','rack-lined','dim','vaulted','stone-walled','neat','well-stocked','polished','shadowy','chilled','clangorous','spacious','reinforced'],
    scent: ['oil','metal','leather','steel','polish','sweat','smoke','brass','grease','charcoal','cloth'],
    items: ['sword','shield','rack','helmet','mail','gauntlet','arrow','quiver','stand','banner','lance','scabbard','crossbow','armor','halberd','greaves'],
    items_plural: ['swords','shields','racks','helmets','mails','gauntlets','arrows','quivers','stands','banners','lances','scabbards','crossbows','armors','halberds','greaves']
  },
  kitchen: {
    adjs: ['busy','steamy','spice-filled','cluttered','chaotic','fire-lit','stained','well-used','bustling','crowded','greasy','sizzling','floury','knife-scarred','sunlit','rustic','warm','orderly','aromatic'],
    scent: ['bread','spices','stew','smoke','onion','roast','garlic','herbs','wine','cheese','lemon'],
    items: ['pot','pan','knife','spoon','ladle','bowl','apron','oven','table','basket','jug','rolling pin','tray','spices','cup','skillet'],
    items_plural: ['pots','pans','knives','spoons','ladles','bowls','aprons','ovens','tables','baskets','jugs','rolling pins','trays','spices','cups','skillets']
  },
  study: {
    adjs: ['quiet','book-strewn','paper-cluttered','lamplit','orderly','dusty','mahogany','cozy','leather-chaired','curtained','ink-stained','windowed','carpeted','well-read','tall-shelved','sunlit','spacious','scholarly','comfortable'],
    scent: ['ink','paper','leather','wax','tea','dust','parchment','cigar','perfume','old books','wood polish'],
    items: ['desk','chair','inkpot','quill','scroll','book','lamp','globe','paperweight','shelf','letter','magnifier','rug','pen','journal','map'],
    items_plural: ['desks','chairs','inkpots','quills','scrolls','books','lamps','globes','paperweights','shelves','letters','magnifiers','rugs','pens','journals','maps']
  },
  observatory: {
    adjs: ['star-lit','domed','telescope-filled','quiet','high-vaulted','lamp-lit','shadowy','cold','glass-paned','scholarly','celestial','dusty','chart-lined','dark','marble-floored','cluttered','spacious','instrument-packed','silent'],
    scent: ['wax','old paper','ozone','dust','polish','night air','brass','oil','smoke','metal','ink'],
    items: ['telescope','star chart','globe','notebook','compass','lens','astrolabe','quill','books','ladder','chair','ink','clock','sextant','map'],
    items_plural: ['telescopes','star charts','globes','notebooks','compasses','lenses','astrolabes','quills','books','ladders','chairs','ink bottles','clocks','sextants','maps']
  },
  prison: {
    adjs: ['barred','grim','stone-walled','damp','cramped','echoing','guarded','cold','dark','rust-stained','crowded','dirty','claustrophobic','foul-smelling','loud','silent','chained','gloomy','windowless'],
    scent: ['sweat','rot','mildew','blood','rust','stale air','urine','stale bread','damp stone','fear','unwashed bodies'],
    items: ['manacle','iron bar','cot','bucket','stool','chain','shackle','grate','torch','rat','bowl','bone','lock','key','rope'],
    items_plural: ['manacles','iron bars','cots','buckets','stools','chains','shackles','grates','torches','rats','bowls','bones','locks','keys','ropes']
  },
  bathhouse: {
    adjs: ['steamy','marble','sunken','tile-lined','echoing','warm','lantern-lit','mosaic','luxurious','scented','bubbly','watered','ornate','damp','vaulted','polished','crowded','tranquil','private'],
    scent: ['soap','steam','perfume','rosewater','oil','herbs','mineral water','lavender','citrus','mint','sandalwood'],
    items: ['towel','basin','soap','sponge','bucket','bench','mirror','comb','robe','slipper','brush','bottle','candle','fan','vial'],
    items_plural: ['towels','basins','soaps','sponges','buckets','benches','mirrors','combs','robes','slippers','brushes','bottles','candles','fans','vials']
  },
  arena: {
    adjs: ['sandy','blood-spattered','open','crowded','tiered','sunlit','dusty','noisy','grand','cheering','arena-wide','barricaded','ornate','guarded','banner-hung','brutal','fierce','trophy-lined','ringed'],
    scent: ['sweat','blood','dirt','leather','dust','smoke','metal','spilled beer','grass','oil','fear'],
    items: ['sand','shield','helm','banner','trophy','gate','bench','weapon','rope','arena stone','drum','horn','coin','torch','flag'],
    items_plural: ['sands','shields','helms','banners','trophies','gates','benches','weapons','ropes','arena stones','drums','horns','coins','torches','flags']
  },
  inn: {
    adjs: ['welcoming','timbered','homey','fire-lit','crowded','creaking','soft-lit','quaint','bustling','warm','cozy','lantern-glowing','hospitable','straw-matted','rustic','bustling','cheerful','windowed','chattering'],
    scent: ['stew','fresh bread','ale','lavender','candle wax','firewood','flowers','smoke','soap','lemon','mead'],
    items: ['bed','blanket','wash basin','pitcher','table','mug','candlestick','towel','rug','chamber pot','footstool','shutter','pillow','nightstand','mirror'],
    items_plural: ['beds','blankets','wash basins','pitchers','tables','mugs','candlesticks','towels','rugs','chamber pots','footstools','shutters','pillows','nightstands','mirrors']
  },
  magic_shop: {
    adjs: ['arcane','cluttered','glowing','mysterious','candle-lit','curio-filled','shadowy','colorful','dusty','potion-lined','odd','glittering','talisman-strewn','enchanting','incense-wreathed','shelf-packed','potion-splattered','ornate','aura-filled','packed'],
    scent: ['incense','ozone','herbs','sulfur','parchment','old leather','perfume','candle smoke','oil','spice','flowers'],
    items: ['potion','wand','tome','amulet','crystal','orb','scroll','ring','rune stone','feather','vial','mirror','charm','pouch','candle'],
    items_plural: ['potions','wands','tomes','amulets','crystals','orbs','scrolls','rings','rune stones','feathers','vials','mirrors','charms','pouches','candles']
  },
  stable: {
    adjs: ['hay-strewn','muddy','wooden','spacious','sawdusty','open-air','crowded','warm','sunlit','drafty','barn-like','orderly','animal-filled','noisy','rustic','rain-spattered','damp','hoof-marked','fragrant'],
    scent: ['hay','manure','horse','saddle soap','leather','grain','sawdust','sweat','damp straw','grass','fresh air'],
    items: ['saddle','hay bale','bucket','feed','bridle','blanket','pitchfork','trough','stall','harness','wheelbarrow','carrot','shoe','bucket','rope'],
    items_plural: ['saddles','hay bales','buckets','feeds','bridles','blankets','pitchforks','troughs','stalls','harnesses','wheelbarrows','carrots','shoes','buckets','ropes']
  },
  war_room: {
    adjs: ['map-lined','strategic','dim','tense','orderly','soldier-filled','cluttered','quiet','bannered','shadowed','oak-paneled','guarded','urgent','candle-lit','planning','bustling','spacious','smoke-scented','ink-stained'],
    scent: ['wax','smoke','parchment','leather','oil','sweat','polish','candle','ink','dust','steel'],
    items: ['table','map','miniature','flag','chair','chess piece','document','dagger','scroll','candle','sword','cup','ledger','banner','compass'],
    items_plural: ['tables','maps','miniatures','flags','chairs','chess pieces','documents','daggers','scrolls','candles','swords','cups','ledgers','banners','compasses']
  },
  crypt_vault: {
    adjs: ['hidden','heavy-doored','gloomy','dust-choked','gold-lined','fortified','cold','sealed','ancient','shadowed','mossy','cobwebbed','buried','vaulted','damp','quiet','secret','guarded','forbidding','silent'],
    scent: ['old wax','dust','coin','mold','earth','rot','stone','must','oiled metal','parchment','incense'],
    items: ['coffer','lock','key','gold bar','chest','sarcophagus','scroll','skull','urn','amulet','torch','trap','seal','bone','candle'],
    items_plural: ['coffers','locks','keys','gold bars','chests','sarcophagi','scrolls','skulls','urns','amulets','torches','traps','seals','bones','candles']
  },
  training_yard: {
    adjs: ['muddy','packed','open-air','barricaded','scuffed','sunlit','gravelly','crowded','banner-hung','supervised','dusty','well-used','ringed','spacious','trampled','guarded','weapon-strewn','shout-filled','rowdy'],
    scent: ['sweat','dust','grass','leather','oil','blood','wood','iron','earth','fresh air','smoke'],
    items: ['dummy','target','sword','shield','bow','arrow','helmet','bench','rope','spear','whistle','bucket','fence','sand bag','flag'],
    items_plural: ['dummies','targets','swords','shields','bows','arrows','helmets','benches','ropes','spears','whistles','buckets','fences','sand bags','flags']
  },
  balcony: {
    adjs: ['overlooking','railed','stone','high','windblown','ornate','ivy-clad','moonlit','narrow','grand','sun-drenched','open','shadowed','arched','frosted','guarded','flowered','gilded','spacious'],
    scent: ['fresh air','flowers','dew','candle','night air','incense','rain','smoke','roses','dust','wind'],
    items: ['chair','railing','lantern','bench','potted plant','rug','table','candelabra','vase','curtain','cup','telescope','screen','statue','banner'],
    items_plural: ['chairs','railings','lanterns','benches','potted plants','rugs','tables','candelabra','vases','curtains','cups','telescopes','screens','statues','banners']
  },
  chapel: {
    adjs: ['sunlit','quiet','simple','pew-lined','stained-glass','echoing','peaceful','sacred','hushed','modest','candle-lit','flower-decked','serene','arched','columned','reverent','tranquil','prayerful','incense-wreathed','orderly'],
    scent: ['incense','flowers','wax','old wood','parchment','oil','polish','rose','sage','candle','linen'],
    items: ['pew','altar','prayer book','candle','icon','hymnal','vase','stained glass','bell','offering plate','cushion','cross','banner','lectern','statue'],
    items_plural: ['pews','altars','prayer books','candles','icons','hymnals','vases','stained glass panes','bells','offering plates','cushions','crosses','banners','lecterns','statues']
  },
  thieves_guild: {
    adjs: ['shadowy','secret','cluttered','torch-lit','crowded','low-ceilinged','guarded','hushed','trap-riddled','rickety','hidden','rough','map-lined','smoke-filled','bustling','greasy','whisper-filled','watchful','dangerous'],
    scent: ['ale','tobacco','grease','stale smoke','sweat','spilled wine','leather','damp wood','oil','must','parchment'],
    items: ['dice','cards','dagger','map','lockpick','hood','coin','candle','rope','note','key','pouch','bench','trap','inkpot'],
    items_plural: ['dice','cards','daggers','maps','lockpicks','hoods','coins','candles','ropes','notes','keys','pouches','benches','traps','inkpots']
  },
  portal_chamber: {
    adjs: ['glowing','sigil-marked','echoing','mystical','dim','aura-filled','crystal-lined','circular','strange','arcane','mirror-walled','energy-filled','cold','shadowy','locked','ancient','rune-carved','silent','flickering'],
    scent: ['ozone','incense','stone','oil','dust','magic','parchment','candle','flowers','ether','breeze'],
    items: ['portal','sigil','rune','circle','crystal','mirror','torch','pedestal','orb','book','lock','key','banner','rope','feather'],
    items_plural: ['portals','sigils','runes','circles','crystals','mirrors','torches','pedestals','orbs','books','locks','keys','banners','ropes','feathers']
  },
  smithy: {
    adjs: ['hot','smoky','anvil-lined','crowded','hammering','charcoal-filled','busy','metal-clad','greasy','open-air','furnace-lit','tool-strewn','broad','orderly','well-used','sweat-filled','dirty','noisy','brick-walled'],
    scent: ['smoke','hot metal','coal','oil','sweat','burnt wood','leather','grease','ash','furnace','iron'],
    items: ['anvil','hammer','tongs','bellows','forge','bucket','apron','horseshoe','nail','axe','sword','shield','bar','charcoal','rack'],
    items_plural: ['anvils','hammers','tongs','bellows','forges','buckets','aprons','horseshoes','nails','axes','swords','shields','bars','charcoals','racks']
  },
  aquarium: {
    adjs: ['watery','glass-walled','bubbly','colorful','quiet','fish-filled','echoing','clean','sunlit','damp','tank-lined','cool','crowded','tile-floored','humid','ornate','tranquil','shaded','panel-lit'],
    scent: ['salt','water','algae','fish','seaweed','fresh','clean','soap','brine','glass','chlorine'],
    items: ['tank','coral','fish','net','bucket','shell','plant','filter','rock','scoop','algae','starfish','gravel','lamp','sign'],
    items_plural: ['tanks','corals','fish','nets','buckets','shells','plants','filters','rocks','scoops','algae','starfish','gravels','lamps','signs']
  },
  arcotics_den: {
    adjs: ['smoke-filled','dim','pillow-strewn','secret','crowded','odorous','hazily-lit','opulent','curtained','intimate','whispered','stained','perfumed','cluttered','shadowed','soft','exotic','drug-lined','candle-lit'],
    scent: ['smoke','opium','perfume','incense','sweat','wine','flowers','herbs','spice','leather','musk'],
    items: ['pipe','cushion','bottle','tray','vial','bowl','candle','pouch','cloth','fan','mirror','box','figurine','blanket','goblet'],
    items_plural: ['pipes','cushions','bottles','trays','vials','bowls','candles','pouches','cloths','fans','mirrors','boxes','figurines','blankets','goblets']
  },
  trophy_room: {
    adjs: ['mahogany-lined','imposing','trophy-packed','carpeted','polished','taxidermy-filled','quiet','dim','ornate','gilded','glass-fronted','shadowy','spacious','rugged','mounted','antler-hung','tall','bannered','rug-strewn','well-lit'],
    scent: ['polish','old wood','leather','dust','fur','flowers','trophy','wax','brandy','pipe','velvet'],
    items: ['trophy','plaque','antler','banner','rug','glass case','horn','stuffed animal','medal','goblet','sword','shield','lamp','chair','book'],
    items_plural: ['trophies','plaques','antlers','banners','rugs','glass cases','horns','stuffed animals','medals','goblets','swords','shields','lamps','chairs','books']
  },
  druid_grove: {
    adjs: ['sacred','leafy','sun-dappled','circle','root-woven','ancient','natural','mossy','flowering','ringed','open','hidden','quiet','wild','bough-shaded','animal-filled','peaceful','rustic','verdant'],
    scent: ['earth','flowers','grass','herbs','bark','dew','moss','fruit','smoke','pollen','water'],
    items: ['stone','altar','herb','flower','vines','staff','leaf','bowl','log','totem','cairn','cloak','animal','fire','feather'],
    items_plural: ['stones','altars','herbs','flowers','vines','staffs','leaves','bowls','logs','totems','cairns','cloaks','animals','fires','feathers']
  }
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



const tags = [
  'dungeon',
  'tavern',
  'temple',
  'library',
  'cave',
  'crypt',
  'market',
  'workshop',
  'shrine',
  'cellar',
  'barracks',
  'throne',
  'storeroom',
  'laboratory',
  'garden',
  'armory',
  'kitchen',
  'study',
  'observatory',
  'prison',
  'bathhouse',
  'arena',
  'inn',
  'magic_shop',
  'stable',
  'war_room',
  'crypt_vault',
  'training_yard',
  'balcony',
  'chapel',
  'thieves_guild',
  'portal_chamber',
  'smithy',
  'aquarium',
  'narcotics_den',
  'trophy_room',
  'druid_grove'
];
     const parts = [];
    if (complexity === 'short'){
const mediumTemplates1 = [
  `You step into a ${pick(adjs, rng)} room where the scent of ${pick(scents, rng)} mingles with ${pick(scents, rng)}; ${pick(items, rng)} lies nearby, and ${props.length ? props.join(', ') : 'various items'} catch your eye.`,
  `A ${pick(adjs, rng)} and ${pick(adjs, rng)} space greets you, the smell of ${pick(scents, rng)} hangs in the air, and among the clutter you notice ${pick(items, rng)} and ${props.length ? props.join(', ') : 'assorted possessions'}.`,
  `Within this ${pick(adjs, rng)} chamber, the aroma of ${pick(scents, rng)} lingers; ${pick(items, rng)} rests against the wall, surrounded by ${props.length ? props.join(', ') : 'miscellanea'}.`
];
const mediumTemplates2 = [
  `This Room contains ${pick(adjs, rng)} ${pick(items, rng)} and ${props.length ? props.join(', ') : 'the whole room'} captivates you.`,
  `You notice the underlining smell of ${pick(scents, rng)} lingering in the room.`,
   ];       
parts.push(pick(mediumTemplates1, rng));
parts.push(pick(mediumTemplates2, rng));
 if (npcs.length) parts.push(`You see ${npcs.join(', ')} here.`);
    } else if (complexity === 'medium'){
      const longTemplates = [
  `Crossing the threshold, you find yourself in a ${pick(adjs, rng)} and ${pick(adjs, rng)} room, its atmosphere thick with the scent of ${pick(scents, rng)} and a hint of ${pick(scents, rng)}. ${pick(items, rng)} occupies a prominent spot, while ${props.length ? props.join(', ') : 'numerous objects'} are scattered throughout. ${npcs.length ? 'You notice ' + npcs.join(', ') + ' present as well.' : 'The room feels deserted.'}`,
  `The ${pick(adjs, rng)} space before you is filled with the unmistakable aroma of ${pick(scents, rng)} blending with ${pick(scents, rng)}. Light glints off ${pick(items, rng)}, and your gaze is drawn to ${props.length ? props.join(', ') : 'various oddities'} arranged across the room. ${npcs.length ? 'Nearby, ' + npcs.join(', ') + ' go about their business.' : 'No one else seems to be here.'}`,
  `Stepping inside, you are greeted by a ${pick(adjs, rng)} chamber where ${pick(scents, rng)} lingers. ${pick(items, rng)} can be seen beside ${props.length ? props.join(', ') : 'some scattered items'}, and ${npcs.length ? npcs.join(', ') + ' are here, their presence adding to the atmosphere.' : 'the silence is almost total.'}`
];
parts.push(pick(longTemplates, rng));
    } else {
const veryLongTemplates = [
  `As you enter this ${pick(adjs, rng)}, ${pick(adjs, rng)} room, your senses are immediately engaged by the layered scents of ${pick(scents, rng)}, ${pick(scents, rng)}, and a trace of ${pick(scents, rng)}. In the dim light, ${pick(items, rng)} stands out among ${props.length ? props.join(', ') : 'a surprising collection of objects'}, all arranged in a seemingly haphazard fashion. The ${pick(adjs, rng)} walls are adorned with ${pick(items, rng)}, while ${props.length ? props.join(', ') : 'unusual artifacts'} fill alcoves and shelves. ${npcs.length ? 'You see ' + npcs.join(', ') + ' engaged in various activities, their movements casting shifting shadows.' : 'With no one else here, the silence is broken only by distant echoes.'} Every detail, from the lingering aroma to the scattered possessions, seems to tell a story, making this space feel both mysterious and alive.`,
  `You find yourself in a ${pick(adjs, rng)} chamber, bathed in a ${pick(adjs, rng)} glow. The air is saturated with the scents of ${pick(scents, rng)}, ${pick(scents, rng)}, and ${pick(scents, rng)}. Your eyes are drawn to ${pick(items, rng)}, which lies among ${props.length ? props.join(', ') : 'varied belongings'} on the ancient floor. Along the walls, ${pick(items, rng)} and ${props.length ? props.join(', ') : 'other curiosities'} are arranged, while ${npcs.length ? npcs.join(', ') + ' converse in hushed tones nearby.' : 'the emptiness is almost palpable.'} Every corner holds signs of use, habitation, and history, and the interplay of light, scent, and presence gives the room a vibrant, immersive atmosphere.`,
  `Stepping through the entryway, you are immersed in a world defined by ${pick(adjs, rng)} and ${pick(adjs, rng)} features. The air is thick with the intermingled aromas of ${pick(scents, rng)}, ${pick(scents, rng)}, and ${pick(scents, rng)}. Immediately, you notice ${pick(items, rng)} resting beside ${props.length ? props.join(', ') : 'an assortment of objects'}, while the ${pick(adjs, rng)} lighting reveals ${pick(items, rng)} displayed on shelves and alcoves. ${npcs.length ? npcs.join(', ') + ' move purposefully throughout the chamber, their presence adding to the room\'s dynamic energy.' : 'It is eerily still, with only your footsteps echoing.'} All around you, details clamor for attention—the placement of ${pick(items, rng)}, the scattering of ${props.length ? props.join(', ') : 'tools and trinkets'}, and the haunting mixture of scents—inviting you to explore further and uncover the secrets this space contains.`
];
parts.push(pick(veryLongTemplates, rng));
      parts.push(`Against one wall ${pick(items,rng)} rests${props.length ? ', accompanied by ' + props.slice(0,4).join(', ') : ''}.`);
      parts.push(`Small details suggest the room's purpose: ${activeTags.length ? activeTags.join(', ') + '.' : 'no obvious origin.'}`);
      if (npcs.length) parts.push(`Present are ${npcs.map(n=>`${n}`).join(', ')} — they might be hostile or friendly.`);
      if (rng.next() < 0.45) parts.push(`You find a ${pick(items,rng)} that bears ${pick(['a scratch','a faded mark','an unfamiliar sigil'],rng)}.`);
        const VlongTemplates1 = [
  `An exit is ${pick(['a heavy door','a narrow passage','a low archway','a hidden slit'],rng)}; beyond it you sense ${pick(['a draft','a murmur','silence','a faint light'],rng)}.`,
  `You notice the subtle smell of ${pick(scents, rng)} lingering in the room.`,
   ];    
     parts.push(pick(VlongTemplates1, rng));
    }
    

    // incorporate notes more directly (if user input props field contained sentences, they are included)
    const notesRaw = els.propInput.value || '';
    if (notesRaw && notesRaw.trim()){
      // add as an extra observation
      parts.push(`Props Added: ${notesRaw.trim()}`);
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
