// sidebar.js - expanded-detail widget sidebar with improved non-repeating generators
// - Injects CSS, creates/uses <aside id="sidebar"> and moving <button id="sidebarTab">
// - Widgets persisted to localStorage; each descriptive widget tracks what it has generated
//   and avoids repeating items until its source pool is exhausted (then reshuffles).
// - Enhanced generators with richer, varied outputs: NPC, Trinket, Loot, Name, Encounter,
//   plus dice/d20 rollers. History and copy-to-clipboard supported.
// Install:
// 1) Ensure each page that should have the sidebar contains immediately after <body>:
//      <aside id="sidebar" aria-hidden="true"></aside>
// 2) Include this script before </body>:
//      <script src="sidebar.js"></script>
(function () {
  const SIDEBAR_ID = 'sidebar';
  const TAB_ID = 'sidebarTab';
  const CSS_ID = 'dmtoolkit-sidebar-styles-v2';
  const STORAGE_WIDGETS = 'dmtoolkit.sidebar.widgets.v2';
  const STORAGE_OPEN = 'dmtoolkit.sidebar.open.v2';

  // ---------- Utilities ----------
  const safeLocalGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const safeLocalSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const uid = (p = 'w') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- Inject CSS ----------
  if (!document.getElementById(CSS_ID)) {
    const css = document.createElement('style');
    css.id = CSS_ID;
    css.textContent = `
/* dmtoolkit sidebar styles (v2) */
.dm-sidebar { position: fixed; left: 0; top: 0; height: 100vh; width: 340px; max-width: 92vw;
  background: var(--panel, rgba(8,12,18,0.98)); color: inherit; transform: translateX(-100%);
  transition: transform .22s ease; z-index: 9999; box-sizing: border-box; padding: 12px; overflow: auto;
  -webkit-overflow-scrolling: touch; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
.dm-sidebar.dm-open { transform: translateX(0); }
.dm-header{display:flex;align-items:center;justify-content:space-between;padding:6px 4px;margin-bottom:8px}
.dm-title{font-weight:700}
.dm-widgets{display:flex;flex-direction:column;gap:8px}
.dm-widget{background: rgba(255,255,255,0.02); border-radius:8px; padding:10px; box-shadow: 0 2px 8px rgba(0,0,0,0.16);}
.dm-widget-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.dm-widget-title{font-weight:700}
.dm-widget-body{font-size:0.95rem;color:var(--muted,#cfcfcf)}
.dm-btn{background:var(--accent,#ffd166);color:#002;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-weight:700}
.dm-icon-btn{background:transparent;border:1px solid rgba(255,255,255,0.06);padding:6px;border-radius:6px;cursor:pointer;color:inherit}
.dm-footer{margin-top:10px;border-top:1px solid rgba(255,255,255,0.03);padding-top:8px;display:flex;gap:6px;flex-wrap:wrap}
#${TAB_ID}{position:fixed;left:0;top:50%;transform:translate(-50%,-50%) rotate(-90deg);transform-origin:center;background:var(--accent,#ffd166);color:var(--sidebar-tab-fore,#002);border:none;padding:8px 12px;border-radius:6px 6px 0 0;cursor:pointer;z-index:10000;box-shadow:0 6px 18px rgba(0,0,0,0.22);font-weight:700;transition:left .18s ease,transform .18s ease}
#${TAB_ID}:focus{outline:3px solid rgba(255,255,255,0.12);outline-offset:3px}
@media (max-width:520px){ #${TAB_ID}{font-size:0.86rem;padding:6px 10px} .dm-sidebar{width:86vw} }
`;
    document.head.appendChild(css);
  }

  // ---------- Sidebar + Tab ----------
  let sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = SIDEBAR_ID;
    sidebar.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(sidebar, document.body.firstChild);
  }
  sidebar.classList.add('dm-sidebar');
  if (!sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');

  let tab = document.getElementById(TAB_ID);
  if (!tab) {
    tab = document.createElement('button');
    tab.id = TAB_ID;
    tab.type = 'button';
    tab.title = 'Open tools (Ctrl/Cmd+B)';
    tab.setAttribute('aria-controls', SIDEBAR_ID);
    tab.setAttribute('aria-expanded', 'false');
    tab.textContent = 'Tools';
    document.body.appendChild(tab);
  }

  // ---------- Widget system ----------
  const widgetRegistry = {};
  let widgets = [];

  function loadWidgets() {
    const raw = safeLocalGet(STORAGE_WIDGETS);
    if (!raw) return null;
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (e) {}
    return null;
  }
  function persistWidgets() { safeLocalSet(STORAGE_WIDGETS, JSON.stringify(widgets)); }

  // ---------- Non-repeating pool helper ----------
  // For pool-based generators we will maintain widget.state._pool (shuffled) and widget.state._used
  function pickFromPool(widget, poolKey, poolSource) {
    widget.state = widget.state || {};
    widget.state._pools = widget.state._pools || {};
    const pools = widget.state._pools;
    if (!pools[poolKey] || !Array.isArray(pools[poolKey]) || pools[poolKey].length === 0) {
      // refill
      pools[poolKey] = shuffle(poolSource.slice());
      widget.state._used = widget.state._used || {};
      widget.state._used[poolKey] = widget.state._used[poolKey] || [];
    }
    const item = pools[poolKey].pop();
    widget.state._used = widget.state._used || {};
    widget.state._used[poolKey] = widget.state._used[poolKey] || [];
    widget.state._used[poolKey].push(item);
    return item;
  }

  // ---------- Generators with richer content ----------
  // NPC: richer fields, hooks, motivations, secrets, mannerisms, voice, relationships, goals.
  widgetRegistry.npc = {
    title: 'NPC — Detailed',
    initState: () => ({ last: null, history: [], _pools: {}, _used: {} }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const lastEl = document.createElement('div'); lastEl.style.marginBottom = '8px';
      lastEl.textContent = widget.state && widget.state.last ? `Last: ${widget.state.last.summary}` : 'Last: —';
      container.appendChild(lastEl);

      const controls = document.createElement('div'); controls.style.display = 'flex'; controls.style.gap = '8px';
      const genBtn = document.createElement('button'); genBtn.className = 'dm-btn'; genBtn.textContent = 'Generate NPC';
      const copyBtn = document.createElement('button'); copyBtn.className = 'dm-icon-btn'; copyBtn.textContent = 'Copy';
      controls.appendChild(genBtn); controls.appendChild(copyBtn);
      container.appendChild(controls);

      const details = document.createElement('pre'); details.style.marginTop = '8px'; details.style.whiteSpace = 'pre-wrap'; details.style.fontSize = '0.92rem';
      if (widget.state && widget.state.last && widget.state.last.full) details.textContent = widget.state.last.full;
      container.appendChild(details);

      const hist = document.createElement('div'); hist.style.marginTop = '8px'; hist.style.fontSize = '0.85rem'; hist.style.color = 'var(--muted,#cfcfcf)';
      hist.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: ' + widget.state.history.slice(-6).map(h => h.summary).join(' ; ') : 'History: —';
      container.appendChild(hist);

      // large-ish pools to reduce repeats
      const FIRST = ['Aldric','Brenna','Cael','Daria','Eldon','Fiora','Galen','Hesper','Ilan','Jorren','Kaela','Lorin','Mira','Nolan','Oria','Pavel','Quilla','Rian','Selene','Tamar','Ulric','Vera','Wren','Xander','Yara','Zev'];
      const SUR = ['Ashford','Briar','Cask','Dun','Evenmere','Fallow','Grey','Hearth','Iron','Jade','Keen','Lark','Mire','Nettle','Oak','Proud','Quick','Rook','Stone','Thorne','Under','Vale','Wind','Yew','Zale'];
      const RACES = ['Human','Elf','Dwarf','Halfling','Gnome','Half-elf','Half-orc','Tiefling','Dragonborn','Aasimar'];
      const OCCS = ['Innkeeper','Mercenary','Scholar','Thief','Blacksmith','Bard','Priest','Apothecary','Scribe','Shipwright','Cartographer','Herbalist','Executioner','Beast-keeper','Tanner','Artificer'];
      const TRAITS = ['gruff but kind','blunt and honest','charming and manipulative','wary and watchful','cheerful to a fault','cold and calculating','fiery-tempered','sternly principled','absent-minded','soft-hearted'];
      const MANNER = ['taps fingers when nervous','speaks in short clipped sentences','laughs too loudly','twirls a coin','stares off for long moments','keeps one hand hidden','hums old sea shanties','always smells faintly of smoke'];
      const VOICES = ['low and gravelly','high and bright','soft and breathy','sharp and nasal','smooth and practiced','hoarse from shouting','measured and slow','quick and animated'];
      const GOALS = ['protect their family','amass enough coin to start anew','avenge a past wrong','find a lost relic','win favor with a powerful patron','expose a local corruption','get revenge on a rival','hide a shameful secret'];
      const SECRETS = ['was once part of a thieves’ guild','owes a blood debt','is secretly of noble blood','keeps an illegal magical item','lied about their past','sleeps with a weapon under their bed','is being blackmailed'];
      const QUIRKS = ['collects small locks','has a soft spot for injured animals','is terrified of cats','sleeps with candles lit','paints tiny landscapes','counts things obsessively'];
      const APPEAR = ['scar across one cheek','piercing green eyes','greying streak in hair','intricate tattoos','missing two front teeth','always wears a heavy cloak','faint burn marks on hands','hands stained with ink'];
      const RELS = ['a scarred war buddy who owes them a favor','a child they won’t mention','an estranged sibling who left town','a secret lover in the next village','an old rival now in prison','a mentor who taught them their trade'];

      // function to compose
      function makeNPC() {
        // pick name parts without repeating across pool if possible
        const fn = pickFromPool(widget, '__first', FIRST);
        const sn = pickFromPool(widget, '__surname', SUR);
        const name = `${fn} ${sn}`;
        const race = pickFromPool(widget, '__race', RACES);
        const occ = pickFromPool(widget, '__occ', OCCS);
        const trait = pickFromPool(widget, '__trait', TRAITS);
        const manner = pickFromPool(widget, '__manner', MANNER);
        const voice = pickFromPool(widget, '__voice', VOICES);
        const goal = pickFromPool(widget, '__goal', GOALS);
        const secret = pickFromPool(widget, '__secret', SECRETS);
        const quirk = pickFromPool(widget, '__quirk', QUIRKS);
        const appear = pickFromPool(widget, '__appear', APPEAR);
        const rel = pickFromPool(widget, '__rel', RELS);
        const age = 16 + Math.floor(Math.random() * 60);
        const gender = Math.random() < 0.5 ? 'female' : 'male';

        // hooks
        const hookLines = [];
        // Motivation hook
        hookLines.push(`Motivation: ${goal}.`);
        // Secret hook
        if (Math.random() < 0.6) hookLines.push(`Secret: ${secret}.`);
        // Relationship hook
        if (Math.random() < 0.7) hookLines.push(`Connection: ${rel}.`);
        // Threat / tension
        if (Math.random() < 0.45) hookLines.push(`Current problem: ${choice(['owes a lot of coin to dangerous people','someone accused them of a crime they didn’t commit','they are being spied upon','a rival wants them gone'])}.`);

        const summary = `${name}, ${age}-yr ${race} ${occ} — ${trait}; ${quirk}`;
        const full = `Name: ${name}
Gender: ${gender}
Age: ${age}
Race: ${race}
Occupation: ${occ}
Personality: ${trait}
Mannerism: ${manner}
Voice: ${voice}
Quirk: ${quirk}
Appearance: ${appear}
${hookLines.join('\n')}

Suggested use: Introduce ${name} as ${choice(['an ally','a dubious contact','an easy mark','a reluctant informant','a potential quest-giver'])}.`;

        return { summary, full, ts: Date.now() };
      }

      genBtn.addEventListener('click', () => {
        const npc = makeNPC();
        widget.state = widget.state || widgetRegistry.npc.initState();
        widget.state.last = npc;
        widget.state.history = (widget.state.history || []).concat(npc);
        if (widget.state.history.length > 60) widget.state.history = widget.state.history.slice(-60);
        lastEl.textContent = `Last: ${npc.summary}`;
        details.textContent = npc.full;
        hist.textContent = 'History: ' + widget.state.history.slice(-6).map(h => h.summary).join(' ; ');
        saveState(widget);
      });

      copyBtn.addEventListener('click', () => {
        const t = widget.state && widget.state.last && widget.state.last.full; if (!t) return;
        navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : null;
      });
    }
  };

  // Trinket: longer lore/flavor + hooks + minor effects
  widgetRegistry.trinket = {
    title: 'Trinket — Flavorful',
    initState: () => ({ last: null, history: [], _pools: {}, _used: {} }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const lastEl = document.createElement('div'); lastEl.style.marginBottom = '8px';
      lastEl.textContent = widget.state && widget.state.last ? `Last: ${widget.state.last.summary}` : 'Last: —';
      container.appendChild(lastEl);
      const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '8px';
      const gen = document.createElement('button'); gen.className = 'dm-btn'; gen.textContent = 'Generate Trinket';
      const copyBtn = document.createElement('button'); copyBtn.className = 'dm-icon-btn'; copyBtn.textContent = 'Copy';
      row.appendChild(gen); row.appendChild(copyBtn);
      container.appendChild(row);
      const detail = document.createElement('div'); detail.style.marginTop = '8px'; detail.style.fontSize = '0.95rem';
      if (widget.state && widget.state.last && widget.state.last.full) detail.textContent = widget.state.last.full;
      container.appendChild(detail);
      const hist = document.createElement('div'); hist.style.marginTop = '8px'; hist.style.fontSize = '0.9rem'; hist.style.color = 'var(--muted,#cfcfcf)';
      hist.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: ' + widget.state.history.slice(-8).map(h => h.summary).join('; ') : 'History: —';
      container.appendChild(hist);

      const TRINKETS = [
        'a silver thimble with a tiny etching of a ship',
        'a broken compass that always points toward a lost childhood memory',
        'a marble with a petal trapped inside',
        'a scrap of map showing a single tower',
        'a copper locket sealed with wax',
        'a small stone that hums faintly at dawn',
        'a toy soldier with a hidden inscription',
        'a brass coin stamped with a smiling face',
        'a folded paper crane that never unfolds',
        'a faded love letter written in a foreign tongue',
        'a tiny music box that plays a single bittersweet bar'
      ];
      const ORIGINS = ['from a traveling caravan','found in a tide pool','handed down through generations','taken from a sleeping noble','brought back from a far trading post','discovered in a ruined chapel'];
      const EFFECTS = ['no mechanical effect, excellent roleplay hook','glows faintly when danger is near','warms in presence of certain people','emits a soft chime only heard by the holder','occasionally whispers a single word','reacts to moonlight'];
      const NOTES = ['inscribed initials on the inside','a hair locked under a glass pane','tiny rune you cannot translate','the vendor refuses to buy it back','seams show signs of recent repair'];

      function makeTrinket() {
        const t = pickFromPool(widget, '__trinket', TRINKETS);
        const origin = choice(ORIGINS);
        const effect = Math.random() < 0.6 ? choice(EFFECTS) : 'plain but sentimental';
        const note = Math.random() < 0.45 ? choice(NOTES) : '';
        const summary = t;
        const full = `${t} — ${origin}. Possible effect: ${effect}${note ? '\nNote: ' + note : ''}\nHook ideas: ${choice(['someone will kill for it','it leads to a secret','it binds to its owner','it is sought by a collector','it is cursed in a subtle way'])}.`;
        return { summary, full, ts: Date.now() };
      }

      gen.addEventListener('click', () => {
        const tr = makeTrinket();
        widget.state = widget.state || widgetRegistry.trinket.initState();
        widget.state.last = tr;
        widget.state.history = (widget.state.history || []).concat(tr);
        if (widget.state.history.length > 80) widget.state.history = widget.state.history.slice(-80);
        lastEl.textContent = `Last: ${tr.summary}`;
        detail.textContent = tr.full;
        hist.textContent = 'History: ' + widget.state.history.slice(-8).map(h => h.summary).join('; ');
        saveState(widget);
      });

      copyBtn.addEventListener('click', () => {
        const t = widget.state && widget.state.last && widget.state.last.full; if (!t) return;
        navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : null;
      });
    }
  };

  // Loot: combine coins, gems, art objects with short descriptions and possible curses/quirks
  widgetRegistry.loot = {
    title: 'Loot — Detailed',
    initState: () => ({ last: null, history: [], _pools: {}, _used: {} }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const lastEl = document.createElement('div'); lastEl.style.marginBottom = '8px';
      lastEl.textContent = widget.state && widget.state.last ? `Last: ${widget.state.last.summary}` : 'Last: —';
      container.appendChild(lastEl);
      const btn = document.createElement('button'); btn.className = 'dm-btn'; btn.textContent = 'Generate Loot';
      container.appendChild(btn);
      const detail = document.createElement('div'); detail.style.marginTop = '8px';
      if (widget.state && widget.state.last && widget.state.last.full) detail.textContent = widget.state.last.full;
      container.appendChild(detail);
      const hist = document.createElement('div'); hist.style.marginTop = '8px'; hist.style.fontSize='0.9rem'; hist.style.color='var(--muted,#cfcfcf)';
      hist.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: ' + widget.state.history.slice(-6).map(h => h.summary).join('; ') : 'History: —';
      container.appendChild(hist);

      const GEMS = [
        { name: 'opal of shifting fire', value: '25 gp', note: 'speaks in tiny crystalline chimes when stroked' },
        { name: 'sapphire shard', value: '50 gp', note: 'cold to the touch' },
        { name: 'smoky topaz', value: '10 gp', note: 'clouds rearrange above it on stormy nights' },
        { name: 'rose quartz locket', value: '15 gp', note: 'contains a faded portrait' },
        { name: 'amber bead with insect', value: '5 gp', note: 'small insect fossilized inside' }
      ];
      const ARTS = [
        { name: 'miniature painting of a coastal town', desc: 'framed, detail of a missing ship', value: '40 gp' },
        { name: 'silver filigree comb', desc: 'inlaid with opal dust', value: '30 gp' },
        { name: 'carved wooden statuette', desc: 'depicts a smiling god', value: '22 gp' }
      ];

      function makeLoot() {
        const coinsGp = Math.floor(Math.random() * 500) + 5;
        const coins = `${coinsGp} gp`;
        const gems = Math.random() < 0.7 ? pickFromPool(widget, '__gem', GEMS).name + ' (' + pickFromPool(widget, '__gem', GEMS).value + ')' : null;
        // Note: used pick twice to show reshuffle, but better to select one object:
        let gemObj = null;
        if (Math.random() < 0.7) {
          const g = pickFromPool(widget, '__gem_obj', GEMS);
          gemObj = `${g.name} (${g.value}) — ${g.note}`;
        }
        const art = Math.random() < 0.45 ? pickFromPool(widget, '__art', ARTS) : null;
        const items = [];
        if (gemObj) items.push(gemObj);
        if (art) items.push(`${art.name} (${art.value}) — ${art.desc}`);
        // possible cursed item
        const cursed = Math.random() < 0.12 ? 'One item shows faint runes — might be cursed.' : '';
        const summary = `${coins}${items.length ? ' + ' + items.map(i => (typeof i === 'string' ? i.split(' — ')[0] : i.name)).join(', ') : ''}`;
        const full = `Coins: ${coins}\nItems:\n${items.length ? items.map(i => '- ' + i).join('\n') : '- (none)'}${cursed ? '\n\nCaution: ' + cursed : ''}`;
        return { summary, full, ts: Date.now() };
      }

      btn.addEventListener('click', () => {
        const l = makeLoot();
        widget.state = widget.state || widgetRegistry.loot.initState();
        widget.state.last = l;
        widget.state.history = (widget.state.history || []).concat(l);
        if (widget.state.history.length > 60) widget.state.history = widget.state.history.slice(-60);
        lastEl.textContent = `Last: ${l.summary}`;
        detail.textContent = l.full;
        hist.textContent = 'History: ' + widget.state.history.slice(-6).map(h => h.summary).join('; ');
        saveState(widget);
      });
    }
  };

  // Name generator: more varied syllables, options for race/gender hints
  widgetRegistry.name = {
    title: 'Name — Fancy',
    initState: () => ({ last: null, history: [] }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const lastEl = document.createElement('div'); lastEl.style.marginBottom = '8px';
      lastEl.textContent = widget.state && widget.state.last ? `Last: ${widget.state.last.name}` : 'Last: —';
      container.appendChild(lastEl);

      const opts = document.createElement('div'); opts.style.display = 'flex'; opts.style.gap = '8px'; opts.style.marginBottom = '8px';
      const raceInput = document.createElement('input'); raceInput.placeholder = 'Race (opt)'; raceInput.style.flex = '1';
      const genderSelect = document.createElement('select'); ['Any','Male','Female','Unspecified'].forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; genderSelect.appendChild(o); });
      opts.appendChild(raceInput); opts.appendChild(genderSelect);
      container.appendChild(opts);

      const gen = document.createElement('button'); gen.className = 'dm-btn'; gen.textContent = 'Generate Name';
      container.appendChild(gen);
      const details = document.createElement('div'); details.style.marginTop = '8px';
      if (widget.state && widget.state.last && widget.state.last.full) details.textContent = widget.state.last.full;
      container.appendChild(details);
      const hist = document.createElement('div'); hist.style.marginTop = '8px'; hist.style.fontSize='0.9rem'; hist.style.color='var(--muted,#cfcfcf)';
      hist.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: ' + widget.state.history.slice(-10).map(h => h.name).join(', ') : 'History: —';
      container.appendChild(hist);

      const sylA = ['Ara','Bel','Cal','Dar','Eri','Fen','Gor','Hau','Ira','Jun','Kel','Lor','Ma','Ner','Ori','Pae','Qui','Ral','Sel','Tor','Ula','Ves','Wyn','Xan','Yel','Zor'];
      const sylB = ['a','e','i','o','u','ae','io','ea','ya','ou','ai'];
      const sylC = ['n','r','s','l','d','m','th','k','v','z','sel','nor','wen'];

      function generate(raceHint, genderHint) {
        const a = choice(sylA);
        const b = choice(sylB);
        const c = choice(sylC);
        const name = a + b + c;
        const full = `Name: ${name}${raceHint ? `\nRace hint: ${raceHint}` : ''}${genderHint && genderHint !== 'Any' ? `\nGender hint: ${genderHint}` : ''}`;
        return { name, full, ts: Date.now() };
      }

      gen.addEventListener('click', () => {
        const r = raceInput.value.trim();
        const g = genderSelect.value;
        const n = generate(r, g);
        widget.state = widget.state || widgetRegistry.name.initState();
        widget.state.last = n;
        widget.state.history = (widget.state.history || []).concat(n);
        if (widget.state.history.length > 100) widget.state.history = widget.state.history.slice(-100);
        lastEl.textContent = `Last: ${n.name}`;
        details.textContent = n.full;
        hist.textContent = 'History: ' + widget.state.history.slice(-10).map(h => h.name).join(', ');
        saveState(widget);
      });
    }
  };

  // Encounter generator: richer details and stakes
  widgetRegistry.encounter = {
    title: 'Encounter — Scene',
    initState: () => ({ last: null, history: [] }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const lastEl = document.createElement('div'); lastEl.style.marginBottom = '8px';
      lastEl.textContent = widget.state && widget.state.last ? `Last: ${widget.state.last.summary}` : 'Last: —';
      container.appendChild(lastEl);
      const gen = document.createElement('button'); gen.className = 'dm-btn'; gen.textContent = 'Generate Encounter';
      container.appendChild(gen);
      const details = document.createElement('div'); details.style.marginTop = '8px'; details.style.whiteSpace = 'pre-wrap';
      if (widget.state && widget.state.last && widget.state.last.full) details.textContent = widget.state.last.full;
      container.appendChild(details);
      const hist = document.createElement('div'); hist.style.marginTop = '8px'; hist.style.fontSize='0.9rem'; hist.style.color='var(--muted,#cfcfcf)';
      hist.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: ' + widget.state.history.slice(-6).map(h => h.summary).join('; ') : 'History: —';
      container.appendChild(hist);

      const ENEMIES = ['bandit patrol guarding a chest', 'enchanted armor that patrols a hall', 'goblin ambush set in a ledge', 'savage dire wolves', 'a corrupted treant', 'ghosts bound to a shrine', 'a rival adventuring party', 'cultists performing a ritual'];
      const LOCALES = ['in the shadow of a ruined keep', 'inside a flooded cellar', 'on a narrow mountain pass', 'beneath an ancient oak', 'within a caravan camp', 'at a lonely lighthouse', 'on a bridge during a storm'];
      const TWISTS = ['they were hired to protect the party','they seek help, not conflict','they are guarding something that must not be recovered','they are rightfully defending their home','one of them is an enemy in disguise','the area is trapped'];

      function makeEncounter() {
        const enemy = pickFromPool(widget, '__enc_enemy', ENEMIES);
        const loc = pickFromPool(widget, '__enc_loc', LOCALES);
        const twist = pickFromPool(widget, '__enc_twist', TWISTS);
        const stakes = choice(['high (civilian lives at risk)','medium (valuable loot)','low (minor treasure)']);
        const tactics = choice(['ambush from hiding spots','stand and fight with numbers','use magic to control the field','snipe from a distance and retreat']);
        const summary = `${enemy} ${loc}`;
        const full = `Scene: ${enemy} ${loc}
Twist: ${twist}
Stakes: ${stakes}
Suggested tactics for foes: ${tactics}
Possible loot: ${choice(['coins and gems','minor magical trinket','a map fragment','no treasure, but leads to story'])}
Hook: ${choice(['rescue mission','mystery leads to larger plot','moral choice; who is right?','a chase begins after the encounter'])}`;
        return { summary, full, ts: Date.now() };
      }

      gen.addEventListener('click', () => {
        const e = makeEncounter();
        widget.state = widget.state || widgetRegistry.encounter.initState();
        widget.state.last = e;
        widget.state.history = (widget.state.history || []).concat(e);
        if (widget.state.history.length > 50) widget.state.history = widget.state.history.slice(-50);
        lastEl.textContent = `Last: ${e.summary}`;
        details.textContent = e.full;
        hist.textContent = 'History: ' + widget.state.history.slice(-6).map(h => h.summary).join('; ');
        saveState(widget);
      });
    }
  };

  // inspiration prompts simplified (but larger pool)
  widgetRegistry.inspo = {
    title: 'Inspiration Prompt',
    initState: () => ({ last: null, history: [] }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const last = document.createElement('div'); last.style.marginBottom = '8px';
      last.textContent = widget.state && widget.state.last ? `Last: ${widget.state.last}` : 'Last: —';
      container.appendChild(last);
      const gen = document.createElement('button'); gen.className = 'dm-btn'; gen.textContent = 'New Prompt';
      container.appendChild(gen);
      const detail = document.createElement('div'); detail.style.marginTop = '8px';
      container.appendChild(detail);
      const PROMPTS = [
        'A stranger offers an item in exchange for silence about a murder.',
        'A long-lost letter arrives with no return address and one line: "I remember it differently."',
        'A town square statue weeps during storms.',
        'Your rival offers an uneasy truce in exchange for a dangerous favor.',
        'An old map is found with a circle around a place that doesn’t exist on modern maps.'
      ];
      gen.addEventListener('click', () => {
        const p = pickFromPool(widget, '__prompts', PROMPTS);
        widget.state = widget.state || widgetRegistry.inspo.initState();
        widget.state.last = p;
        widget.state.history = (widget.state.history || []).concat(p);
        if (widget.state.history.length > 80) widget.state.history = widget.state.history.slice(-80);
        last.textContent = `Last: ${p}`;
        detail.textContent = p;
        saveState(widget);
      });
    }
  };

  // d20 and dice remain simple (no need for heavy description)
  widgetRegistry.d20 = {
    title: 'd20 Roller',
    initState: () => ({ lastRoll: null, history: [] }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const last = document.createElement('div'); last.style.marginBottom = '8px';
      last.textContent = widget.state && widget.state.lastRoll ? `Last: ${widget.state.lastRoll}` : 'Last: —';
      container.appendChild(last);
      const btn = document.createElement('button'); btn.className = 'dm-btn'; btn.textContent = 'Roll d20';
      container.appendChild(btn);
      const hist = document.createElement('div'); hist.style.marginTop = '8px'; hist.style.color='var(--muted,#cfcfcf)';
      hist.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: ' + widget.state.history.slice(-10).join(', ') : 'History: —';
      container.appendChild(hist);
      btn.addEventListener('click', () => {
        const v = Math.floor(Math.random() * 20) + 1;
        widget.state = widget.state || widgetRegistry.d20.initState();
        widget.state.lastRoll = v;
        widget.state.history = (widget.state.history || []).concat(v);
        if (widget.state.history.length > 200) widget.state.history = widget.state.history.slice(-200);
        last.textContent = `Last: ${v}`;
        hist.textContent = 'History: ' + widget.state.history.slice(-10).join(', ');
        saveState(widget);
      });
    }
  };

  widgetRegistry.dice = {
    title: 'Dice Roller (d4/6/8/10/12)',
    initState: () => ({ last: null, history: [] }),
    render(widget, container, saveState) {
      container.innerHTML = '';
      const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.marginBottom = '8px';
      const select = document.createElement('select');
      [4,6,8,10,12].forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = 'd' + n; select.appendChild(o); });
      const count = document.createElement('input'); count.type = 'number'; count.min = 1; count.max = 20; count.value = 1; count.style.width = '60px';
      const btn = document.createElement('button'); btn.className = 'dm-btn'; btn.textContent = 'Roll';
      row.appendChild(select); row.appendChild(count); row.appendChild(btn);
      container.appendChild(row);
      const out = document.createElement('div'); out.style.marginBottom = '8px'; out.textContent = 'Last: —';
      const hist = document.createElement('div'); hist.style.color='var(--muted,#cfcfcf)'; hist.textContent = 'History: —';
      container.appendChild(out); container.appendChild(hist);
      btn.addEventListener('click', () => {
        const die = parseInt(select.value, 10) || 6; let c = parseInt(count.value, 10) || 1; c = Math.max(1, Math.min(20, c));
        const vals = []; for (let i=0;i<c;i++) vals.push(Math.floor(Math.random() * die) + 1);
        const sum = vals.reduce((a,b) => a + b, 0);
        widget.state = widget.state || widgetRegistry.dice.initState();
        widget.state.last = { die, count: c, values: vals, sum, ts: Date.now() };
        widget.state.history = (widget.state.history || []).concat(widget.state.last);
        if (widget.state.history.length > 200) widget.state.history = widget.state.history.slice(-200);
        out.textContent = `Last: ${vals.join(', ')} (sum ${sum})`;
        hist.textContent = 'History: ' + widget.state.history.slice(-8).map(h => `${h.sum} [${h.values.join(',')}]`).join('; ');
        saveState(widget);
      });
    }
  };

  // ---------- Sidebar UI: shell, rendering, API ----------
  const headerEl = document.createElement('div'); headerEl.className = 'dm-header';
  const titleEl = document.createElement('div'); titleEl.className = 'dm-title'; titleEl.textContent = 'Tools';
  headerEl.appendChild(titleEl);
  const closeBtn = document.createElement('button'); closeBtn.className = 'dm-icon-btn'; closeBtn.title = 'Close'; closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('click', () => sidebar.dmSidebar && sidebar.dmSidebar.close());
  headerEl.appendChild(closeBtn);

  const widgetsContainer = document.createElement('div'); widgetsContainer.className = 'dm-widgets';
  const footer = document.createElement('div'); footer.className = 'dm-footer';

  const mkBtn = (label, cls, handler) => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.addEventListener('click', handler); return b; };
  footer.appendChild(mkBtn('Add d20','dm-btn', () => addWidget('d20')));
  footer.appendChild(mkBtn('Add Dice','dm-btn', () => addWidget('dice')));
  footer.appendChild(mkBtn('Add NPC','dm-btn', () => addWidget('npc')));
  footer.appendChild(mkBtn('Add Trinket','dm-btn', () => addWidget('trinket')));
  footer.appendChild(mkBtn('Add Loot','dm-btn', () => addWidget('loot')));
  footer.appendChild(mkBtn('Add Name','dm-btn', () => addWidget('name')));
  footer.appendChild(mkBtn('Add Encounter','dm-btn', () => addWidget('encounter')));
  footer.appendChild(mkBtn('Add Prompt','dm-btn', () => addWidget('inspo')));
  footer.appendChild(mkBtn('Reset','dm-icon-btn', () => { if (!confirm('Remove all widgets?')) return; widgets = []; persistWidgets(); renderWidgets(); }));

  function renderShell() {
    sidebar.innerHTML = '';
    sidebar.appendChild(headerEl);
    sidebar.appendChild(widgetsContainer);
    sidebar.appendChild(footer);
  }

  function createWidgetElement(widget) {
    const wrap = document.createElement('div'); wrap.className = 'dm-widget'; wrap.id = 'widget-' + widget.id;
    const head = document.createElement('div'); head.className = 'dm-widget-header';
    const t = document.createElement('div'); t.className = 'dm-widget-title'; t.textContent = widget.title || widget.type;
    head.appendChild(t);
    const controls = document.createElement('div');
    const rm = document.createElement('button'); rm.className = 'dm-icon-btn'; rm.title = 'Remove widget'; rm.innerHTML = '🗑';
    rm.addEventListener('click', () => { if (!confirm('Remove this widget?')) return; removeWidget(widget.id); });
    controls.appendChild(rm);
    head.appendChild(controls);
    wrap.appendChild(head);
    const body = document.createElement('div'); body.className = 'dm-widget-body';
    wrap.appendChild(body);
    // render type
    const reg = widgetRegistry[widget.type];
    if (reg && typeof reg.render === 'function') {
      if (!widget.state) widget.state = reg.initState ? reg.initState() : {};
      reg.render(widget, body, (w) => {
        // save specific widget update
        const idx = widgets.findIndex(x => x.id === w.id); if (idx >= 0) widgets[idx] = w; persistWidgets();
      });
    } else {
      body.textContent = '(Unknown widget type)';
    }
    return wrap;
  }

  function renderWidgets() {
    renderShell();
    widgetsContainer.innerHTML = '';
    if (!widgets.length) {
      const e = document.createElement('div'); e.style.color = 'var(--muted,#cfcfcf)'; e.textContent = 'No widgets. Use the buttons below to add one.'; widgetsContainer.appendChild(e);
    } else {
      widgets.forEach(w => widgetsContainer.appendChild(createWidgetElement(w)));
    }
  }

  function addWidget(type, opts = {}) {
    if (!widgetRegistry[type]) { console.warn('Unknown widget type', type); return null; }
    const reg = widgetRegistry[type];
    const widget = { id: uid('widget'), type, title: opts.title || reg.title || type, state: opts.state || (reg.initState ? reg.initState() : {}) };
    widgets.push(widget);
    persistWidgets();
    renderWidgets();
    return widget;
  }

  function removeWidget(id) {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx === -1) return false;
    widgets.splice(idx, 1);
    persistWidgets();
    renderWidgets();
    return true;
  }

  // load persisted widgets
  const loaded = loadWidgets();
  if (loaded && Array.isArray(loaded) && loaded.length) {
    widgets = loaded.map(w => ({ id: w.id || uid('widget'), type: w.type || 'd20', title: w.title || (widgetRegistry[w.type] ? widgetRegistry[w.type].title : w.type), state: w.state || (widgetRegistry[w.type] && widgetRegistry[w.type].initState ? widgetRegistry[w.type].initState() : {}) }));
  } else {
    // default start with d20
    widgets = [{ id: uid('widget'), type: 'd20', title: widgetRegistry.d20.title, state: widgetRegistry.d20.initState() }];
    persistWidgets();
  }
  renderWidgets();

  // Sidebar open/close & moving tab behavior (attach tab to sidebar edge when open)
  function applyOpen(open) {
    sidebar.classList.toggle('dm-open', Boolean(open));
    sidebar.setAttribute('aria-hidden', String(!open));
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-pressed', String(open));
    if (open) {
      const focusable = sidebar.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (focusable || sidebar).focus && (focusable || sidebar).focus();
    } else {
      try { tab.focus(); } catch (e) {}
    }
    requestAnimationFrame(updateTabPosition);
  }
  function setOpen(open) { applyOpen(open); safeLocalSet(STORAGE_OPEN, open ? '1' : '0'); }
  const savedOpen = safeLocalGet(STORAGE_OPEN);
  const wasOpen = savedOpen === '1' || sidebar.getAttribute('aria-hidden') === 'false';
  applyOpen(Boolean(wasOpen));

  function updateTabPosition() {
    tab.style.top = '50%';
    const tabRect = tab.getBoundingClientRect();
    const tabW = Math.max(tabRect.width, 36);
    if (sidebar.classList.contains('dm-open')) {
      const sRect = sidebar.getBoundingClientRect();
      const left = Math.round(sRect.right - (tabW / 2));
      tab.style.left = left + 'px';
      tab.style.transform = 'translateY(-50%) rotate(1530deg)';
    } else {
      tab.style.left = '0px';
      tab.style.transform = 'translate(-50%,-50%) rotate(-90deg)';
    }
  }

  let debounceTimer = null;
  function scheduleUpdate() { if (debounceTimer) clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { debounceTimer = null; updateTabPosition(); }, 60); }

  tab.addEventListener('click', (ev) => { ev.stopPropagation(); setOpen(!sidebar.classList.contains('dm-open')); });
  tab.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); setOpen(!sidebar.classList.contains('dm-open')); } });

  window.addEventListener('keydown', (ev) => {
    const key = ev.key ? ev.key.toLowerCase() : '';
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? ev.metaKey : ev.ctrlKey;
    if (mod && key === 'b') { ev.preventDefault(); setOpen(!sidebar.classList.contains('dm-open')); return; }
    if (key === 'escape' && sidebar.classList.contains('dm-open')) setOpen(false);
  });

  document.addEventListener('click', (ev) => { if (!sidebar.classList.contains('dm-open')) return; const t = ev.target; if (sidebar.contains(t) || tab.contains(t)) return; setOpen(false); });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  sidebar.addEventListener('transitionend', scheduleUpdate);
  window.addEventListener('load', () => requestAnimationFrame(updateTabPosition));

  // expose API
  try {
    sidebar.dmSidebar = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!sidebar.classList.contains('dm-open')),
      isOpen: () => sidebar.classList.contains('dm-open'),
      addWidget, removeWidget,
      listWidgets: () => widgets.map(w => ({ id: w.id, type: w.type, title: w.title })),
      updateTabPosition
    };
    window.dmSidebar = sidebar.dmSidebar;
  } catch (e) { /* ignore */ }

  console.info('sidebar.js v2 loaded — descriptive generators enhanced and avoid repeating until their pool is exhausted. API: sidebar.dmSidebar');
})();
