// sidebar.js - robust widget sidebar (replace your existing file with this)
// - Ensures shell + footer buttons are created and visible
// - Exposes API: sidebar.dmSidebar.addWidget/removeWidget/listWidgets/open/close
// - Built-in widgets include: d20, dice, npc, trinket, loot, name, encounter, inspo
(function () {
  const SIDEBAR_ID = 'sidebar';
  const TAB_ID = 'sidebarTab';
  const CSS_ID = 'dmtoolkit-sidebar-styles';
  const STORAGE_WIDGETS = 'dmtoolkit.sidebar.widgets.v1';
  const STORAGE_OPEN = 'dmtoolkit.sidebar.open';

  // inject minimal CSS if absent
  if (!document.getElementById(CSS_ID)) {
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
/* dmtoolkit minimal sidebar styles */
.dm-sidebar { position: fixed; left: 0; top: 0; height: 100vh; width: 320px; max-width: 92vw;
  background: var(--panel, rgba(8,12,18,0.98)); color: inherit; transform: translateX(-100%);
  transition: transform .22s ease; z-index: 9999; box-sizing: border-box; padding: 10px; overflow: auto; -webkit-overflow-scrolling: touch; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
.dm-sidebar.dm-open { transform: translateX(0); }
.dm-header{display:flex;align-items:center;justify-content:space-between;padding:6px 4px;margin-bottom:8px}
.dm-title{font-weight:700}
.dm-widgets{display:flex;flex-direction:column;gap:8px}
.dm-widget{background: rgba(255,255,255,0.02); border-radius:8px; padding:8px}
.dm-widget-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.dm-widget-title{font-weight:600}
.dm-widget-body{font-size:0.95rem;color:var(--muted,#cfcfcf)}
.dm-btn{background:var(--accent,#ffd166);color:#002;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-weight:700}
.dm-icon-btn{background:transparent;border:1px solid rgba(255,255,255,0.06);padding:6px;border-radius:6px;cursor:pointer;color:inherit}
.dm-footer{margin-top:10px;border-top:1px solid rgba(255,255,255,0.03);padding-top:8px;display:flex;gap:6px;flex-wrap:wrap}
#${TAB_ID}{position:fixed;left:0;top:50%;transform:translate(-50%,-50%) rotate(-90deg);transform-origin:center;background:var(--accent,#ffd166);color:var(--sidebar-tab-fore,#002);border:none;padding:8px 12px;border-radius:6px 6px 0 0;cursor:pointer;z-index:10000;box-shadow:0 6px 18px rgba(0,0,0,0.22);font-weight:700;transition:left .18s ease,transform .18s ease}
`;
    document.head.appendChild(style);
  }

  // storage helpers
  function sGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ensure sidebar element
  let sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = SIDEBAR_ID;
    sidebar.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(sidebar, document.body.firstChild);
  }
  sidebar.classList.add('dm-sidebar');
  if (!sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');

  // ensure tab
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

  // widget registry & helpers
  const widgetRegistry = {};
  let widgets = [];
  const uid = (p='w') => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);

  // helper: safe JSON parse
  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // built-in widgets (d20 + others). Keep concise; same behavior as before
  widgetRegistry.d20 = {
    title: 'd20 Roller',
    initState: () => ({ lastRoll: null, history: [] }),
    render(widget, container, save) {
      container.innerHTML = '';
      const last = document.createElement('div'); last.style.marginBottom='8px';
      last.textContent = widget.state && widget.state.lastRoll ? `Last roll: ${widget.state.lastRoll}` : 'Last roll: —';
      container.appendChild(last);
      const btn = document.createElement('button'); btn.className='dm-btn'; btn.textContent='Roll d20';
      container.appendChild(btn);
      const his = document.createElement('div'); his.style.marginTop='8px'; his.style.fontSize='0.9rem'; his.style.color='var(--muted,#cfcfcf)';
      his.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: ' + widget.state.history.slice(-8).join(', ') : 'History: —';
      container.appendChild(his);
      btn.addEventListener('click', ()=> {
        const v = Math.floor(Math.random()*20)+1;
        widget.state = widget.state || widgetRegistry.d20.initState();
        widget.state.lastRoll = v;
        widget.state.history = (widget.state.history||[]).concat(v);
        if (widget.state.history.length>50) widget.state.history = widget.state.history.slice(-50);
        last.textContent = `Last roll: ${v}`;
        his.textContent = 'History: ' + widget.state.history.slice(-8).join(', ');
        save(widget);
      });
    }
  };

  // generic dice widget for d4,d6,d8,d10,d12
  widgetRegistry.dice = {
    title: 'Dice Roller',
    initState: ()=> ({ last:null, history:[] }),
    render(widget, container, save) {
      container.innerHTML = '';
      const row = document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.alignItems='center'; row.style.marginBottom='8px';
      const sel = document.createElement('select');
      [4,6,8,10,12].forEach(n=>{ const o=document.createElement('option'); o.value = n; o.textContent = 'd'+n; sel.appendChild(o); });
      row.appendChild(sel);
      const count = document.createElement('input'); count.type='number'; count.min='1'; count.max='20'; count.value='1'; count.style.width='60px'; row.appendChild(count);
      const rbtn = document.createElement('button'); rbtn.className='dm-btn'; rbtn.textContent='Roll'; row.appendChild(rbtn);
      container.appendChild(row);
      const out = document.createElement('div'); out.style.marginBottom='8px'; out.textContent = 'Last: —'; container.appendChild(out);
      const his = document.createElement('div'); his.style.fontSize='0.9rem'; his.style.color='var(--muted,#cfcfcf)'; his.textContent = 'History: —'; container.appendChild(his);
      if (widget.state && widget.state.last) {
        out.textContent = `Last: ${widget.state.last.values.join(', ')} (sum ${widget.state.last.sum})`;
        his.textContent = 'History: ' + (widget.state.history||[]).slice(-8).map(h=>`${h.sum} [${h.values.join(',')}]`).join('; ');
        sel.value = widget.state.last.die || sel.value;
        count.value = widget.state.last.count || count.value;
      }
      rbtn.addEventListener('click', ()=> {
        const die = parseInt(sel.value,10)||6; let c = parseInt(count.value,10)||1; c = Math.max(1, Math.min(20,c));
        const values = []; for (let i=0;i<c;i++) values.push(Math.floor(Math.random()*die)+1);
        const sum = values.reduce((a,b)=>a+b,0);
        widget.state = widget.state || widgetRegistry.dice.initState();
        widget.state.last = { die, count:c, values, sum, ts:Date.now() };
        widget.state.history = (widget.state.history||[]).concat(widget.state.last);
        if (widget.state.history.length>80) widget.state.history = widget.state.history.slice(-80);
        out.textContent = `Last: ${values.join(', ')} (sum ${sum})`;
        his.textContent = 'History: ' + widget.state.history.slice(-8).map(h=>`${h.sum} [${h.values.join(',')}]`).join('; ');
        save(widget);
      });
    }
  };

  // npc, trinket, loot, name, encounter, inspo (use same implementations as before but compact)
  // To keep this file concise, re-use earlier implementations but ensure they exist when rendering.
  // (I'll implement simplified versions here.)
  widgetRegistry.npc = {
    title:'NPC Quick-Desc',
    initState: ()=> ({ last:null, history:[] }),
    render(widget, container, save) {
      container.innerHTML = '';
      const last = document.createElement('div'); last.style.marginBottom='8px'; last.textContent = widget.state && widget.state.last ? 'Last: '+widget.state.last.summary : 'Last: —'; container.appendChild(last);
      const btn = document.createElement('button'); btn.className='dm-btn'; btn.textContent='Generate NPC'; container.appendChild(btn);
      const copy = document.createElement('button'); copy.className='dm-icon-btn'; copy.textContent='Copy'; copy.style.marginLeft='8px'; container.appendChild(copy);
      const pre = document.createElement('pre'); pre.style.marginTop='8px'; pre.style.whiteSpace='pre-wrap'; if (widget.state && widget.state.last && widget.state.last.full) pre.textContent = widget.state.last.full; container.appendChild(pre);
      const his = document.createElement('div'); his.style.marginTop='8px'; his.style.fontSize='0.9rem'; his.style.color='var(--muted,#cfcfcf)'; his.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: '+widget.state.history.slice(-6).map(h=>h.summary).join('; ') : 'History: —'; container.appendChild(his);
      const NAMES = ['Arin','Bel','Cara','Drenn','Elora','Fenn','Garr','Hela','Ivo','Jora','Keth'];
      const RACES = ['Human','Elf','Dwarf','Halfling','Gnome','Tiefling'];
      const OCC = ['Innkeeper','Mercenary','Scholar','Thief','Blacksmith','Bard','Priest'];
      const TRAITS = ['gruff','cheerful','mysterious','loyal','cowardly','brash'];
      const QUIRKS = ['smokes a pipe','collects buttons','speaks in rhymes','polishes boots','twitches left eye'];
      function build(){ const name=NAMES[Math.floor(Math.random()*NAMES.length)]; const race=RACES[Math.floor(Math.random()*RACES.length)]; const occ=OCC[Math.floor(Math.random()*OCC.length)]; const trait=TRAITS[Math.floor(Math.random()*TRAITS.length)]; const quirk=QUIRKS[Math.floor(Math.random()*QUIRKS.length)]; const age=18+Math.floor(Math.random()*60); const summary=`${name}, ${age}-yr ${race} ${occ} — ${trait}, ${quirk}`; const full = `Name: ${name}\nAge: ${age}\nRace: ${race}\nOccupation: ${occ}\nTrait: ${trait}\nQuirk: ${quirk}`; return {summary, full, ts:Date.now()}; }
      btn.addEventListener('click', ()=> { const n = build(); widget.state = widget.state || widgetRegistry.npc.initState(); widget.state.last = n; widget.state.history = (widget.state.history||[]).concat(n); if (widget.state.history.length>30) widget.state.history = widget.state.history.slice(-30); last.textContent='Last: '+n.summary; pre.textContent = n.full; his.textContent = 'History: ' + widget.state.history.slice(-6).map(h=>h.summary).join('; '); save(widget); });
      copy.addEventListener('click', ()=> { const t = widget.state && widget.state.last && widget.state.last.full; if (!t) return; navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).then(()=> { copy.textContent='Copied'; setTimeout(()=>copy.textContent='Copy',900); }).catch(()=>{}) : null; });
    }
  };

  widgetRegistry.trinket = {
    title:'Trinket Generator',
    initState: ()=> ({ last:null, history:[] }),
    render(widget, container, save) {
      container.innerHTML=''; const last=document.createElement('div'); last.style.marginBottom='8px'; last.textContent = widget.state && widget.state.last ? 'Last: '+widget.state.last.summary : 'Last: —'; container.appendChild(last);
      const btn=document.createElement('button'); btn.className='dm-btn'; btn.textContent='Generate Trinket'; container.appendChild(btn);
      const copy=document.createElement('button'); copy.className='dm-icon-btn'; copy.textContent='Copy'; copy.style.marginLeft='8px'; container.appendChild(copy);
      const details=document.createElement('div'); details.style.marginTop='8px'; if (widget.state && widget.state.last && widget.state.last.full) details.textContent = widget.state.last.full; container.appendChild(details);
      const his=document.createElement('div'); his.style.marginTop='8px'; his.style.fontSize='0.9rem'; his.style.color='var(--muted,#cfcfcf)'; his.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: '+widget.state.history.slice(-8).map(h=>h.summary).join('; ') : 'History: —'; container.appendChild(his);
      const pool = ['a tiny silver bell','a faded map','a small wooden box','a brass coin','a glass eye','a parcel of dried flowers','a key with no lock','a child’s wooden horse','a sealed note','a tiny music box'];
      btn.addEventListener('click', ()=> { const pick = pool[Math.floor(Math.random()*pool.length)]; const extra = Math.random()<0.4 ? ' — '+['has a hidden compartment','feels warm','whispers when held','is cold to the touch'][Math.floor(Math.random()*4)] : ''; const full = pick+extra; const obj = { summary: pick, full, ts:Date.now() }; widget.state = widget.state||widgetRegistry.trinket.initState(); widget.state.last = obj; widget.state.history = (widget.state.history||[]).concat(obj); if (widget.state.history.length>50) widget.state.history = widget.state.history.slice(-50); last.textContent='Last: '+obj.summary; details.textContent = obj.full; his.textContent = 'History: '+widget.state.history.slice(-8).map(h=>h.summary).join('; '); save(widget); });
      copy.addEventListener('click', ()=> { const t = widget.state && widget.state.last && widget.state.last.full; if (!t) return; navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : null; });
    }
  };

  widgetRegistry.loot = {
    title:'Loot Generator',
    initState: ()=> ({ last:null, history:[] }),
    render(widget, container, save) {
      container.innerHTML=''; const last=document.createElement('div'); last.style.marginBottom='8px'; last.textContent = widget.state && widget.state.last ? 'Last: '+widget.state.last.summary : 'Last: —'; container.appendChild(last);
      const btn=document.createElement('button'); btn.className='dm-btn'; btn.textContent='Generate Loot'; container.appendChild(btn);
      const details=document.createElement('div'); details.style.marginTop='8px'; if (widget.state && widget.state.last && widget.state.last.full) details.textContent = widget.state.last.full; container.appendChild(details);
      const his=document.createElement('div'); his.style.marginTop='8px'; his.style.fontSize='0.9rem'; his.style.color='var(--muted,#cfcfcf)'; his.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: '+widget.state.history.slice(-6).map(h=>h.summary).join('; ') : 'History: —'; container.appendChild(his);
      const gemVals = ['1 gp gem','10 gp gem','25 gp gem','50 gp gem','100 gp gem']; const arts = ['small painting','silver necklace','golden comb','carved statuette','jeweled dagger hilt'];
      btn.addEventListener('click', ()=> { const coins = `${Math.floor(Math.random()*100)+1} gp`; const gems = Math.random()<0.6? gemVals[Math.floor(Math.random()*gemVals.length)]:null; const art = Math.random()<0.4? arts[Math.floor(Math.random()*arts.length)]:null; const items = [gems,art].filter(Boolean); const summary = `${coins}${items.length ? ' + '+items.join(', ') : ''}`; const full = `Coins: ${coins}${gems?`\nGem: ${gems}`:''}${art?`\nArt: ${art}`:''}`; const obj = { summary, full, ts:Date.now() }; widget.state = widget.state||widgetRegistry.loot.initState(); widget.state.last = obj; widget.state.history = (widget.state.history||[]).concat(obj); if (widget.state.history.length>40) widget.state.history = widget.state.history.slice(-40); last.textContent='Last: '+obj.summary; details.textContent = obj.full; his.textContent = 'History: '+widget.state.history.slice(-6).map(h=>h.summary).join('; '); save(widget); });
    }
  };

  widgetRegistry.name = {
    title:'Name Generator',
    initState: ()=> ({ last:null, history:[] }),
    render(widget, container, save) {
      container.innerHTML=''; const last=document.createElement('div'); last.style.marginBottom='8px'; last.textContent = widget.state && widget.state.last ? 'Last: '+widget.state.last.name : 'Last: —'; container.appendChild(last);
      const row=document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.marginBottom='8px'; const raceInput=document.createElement('input'); raceInput.placeholder='Race (opt)'; raceInput.style.flex='1'; const gender=document.createElement('select'); ['Any','Male','Female','Neutral'].forEach(g=>{ const o=document.createElement('option'); o.value=g; o.textContent=g; gender.appendChild(o); }); row.appendChild(raceInput); row.appendChild(gender); container.appendChild(row);
      const btn=document.createElement('button'); btn.className='dm-btn'; btn.textContent='Generate Name'; container.appendChild(btn);
      const details=document.createElement('div'); details.style.marginTop='8px'; container.appendChild(details);
      const his=document.createElement('div'); his.style.marginTop='8px'; his.style.fontSize='0.9rem'; his.style.color='var(--muted,#cfcfcf)'; his.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: '+widget.state.history.slice(-8).map(h=>h.name).join(', ') : 'History: —'; container.appendChild(his);
      const s1 = ['Ara','Bel','Cal','Dar','Ela','Fa','Gar','Hel','Ira','Jon']; const s2 = ['a','e','i','o','u','ae','io']; const s3=['n','r','s','l','d','m'];
      btn.addEventListener('click', ()=> { const name = (s1[Math.floor(Math.random()*s1.length)] + s2[Math.floor(Math.random()*s2.length)] + s3[Math.floor(Math.random()*s3.length)]); const obj = { name, summary:name, full:`Name: ${name}${raceInput.value? `\nRace: ${raceInput.value}`:''}${gender.value && gender.value!=='Any'?`\nGender: ${gender.value}`:''}`, ts:Date.now() }; widget.state = widget.state||widgetRegistry.name.initState(); widget.state.last = obj; widget.state.history = (widget.state.history||[]).concat(obj); if (widget.state.history.length>80) widget.state.history = widget.state.history.slice(-80); last.textContent='Last: '+name; details.textContent = obj.full; his.textContent='History: '+widget.state.history.slice(-8).map(h=>h.name).join(', '); save(widget); });
    }
  };

  widgetRegistry.encounter = {
    title:'Encounter Idea',
    initState: ()=> ({ last:null, history:[] }),
    render(widget, container, save) {
      container.innerHTML=''; const last=document.createElement('div'); last.style.marginBottom='8px'; last.textContent = widget.state && widget.state.last ? 'Last: '+widget.state.last.summary : 'Last: —'; container.appendChild(last);
      const btn=document.createElement('button'); btn.className='dm-btn'; btn.textContent='Generate Encounter'; container.appendChild(btn);
      const details=document.createElement('div'); details.style.marginTop='8px'; details.style.whiteSpace='pre-wrap'; container.appendChild(details);
      const his=document.createElement('div'); his.style.marginTop='8px'; his.style.fontSize='0.9rem'; his.style.color='var(--muted,#cfcfcf)'; his.textContent = (widget.state && widget.state.history && widget.state.history.length) ? 'History: '+widget.state.history.slice(-6).map(h=>h.summary).join('; ') : 'History: —'; container.appendChild(his);
      const enemies=['bandit patrol','lost wight','goblin ambush','rival party','animated armor']; const loc=['in a foggy marsh','inside an abandoned chapel','at a ruined watchtower','in a crowded market']; const twist = ['they are protecting something','they want help','they were hired by the party’s foe','they carry a cursed item'];
      btn.addEventListener('click', ()=> { const e = enemies[Math.floor(Math.random()*enemies.length)]; const l = loc[Math.floor(Math.random()*loc.length)]; const t = twist[Math.floor(Math.random()*twist.length)]; const obj = { summary:`${e} ${l}`, full:`Encounter: ${e}\nLocation: ${l}\nTwist: ${t}`, ts:Date.now() }; widget.state = widget.state||widgetRegistry.encounter.initState(); widget.state.last = obj; widget.state.history = (widget.state.history||[]).concat(obj); if (widget.state.history.length>40) widget.state.history = widget.state.history.slice(-40); last.textContent='Last: '+obj.summary; details.textContent = obj.full; his.textContent='History: '+widget.state.history.slice(-6).map(h=>h.summary).join('; '); save(widget); });
    }
  };

  widgetRegistry.inspo = {
    title:'Inspiration Prompt',
    initState: ()=> ({ last:null, history:[] }),
    render(widget, container, save) {
      container.innerHTML=''; const last=document.createElement('div'); last.style.marginBottom='8px'; last.textContent = widget.state && widget.state.last ? 'Last: '+widget.state.last : 'Last: —'; container.appendChild(last);
      const btn=document.createElement('button'); btn.className='dm-btn'; btn.textContent='New Prompt'; container.appendChild(btn);
      const details=document.createElement('div'); details.style.marginTop='8px'; container.appendChild(details);
      const promps = ['A stranger offers a secret in exchange for silence.','A festival reveals a wanted poster with your face.','A lullaby is heard at midnight from the hills.','A merchant begs you to retrieve a stolen heirloom.'];
      btn.addEventListener('click', ()=> { const p = promps[Math.floor(Math.random()*promps.length)]; widget.state=widget.state||widgetRegistry.inspo.initState(); widget.state.last = p; widget.state.history = (widget.state.history||[]).concat(p); if (widget.state.history.length>50) widget.state.history = widget.state.history.slice(-50); last.textContent='Last: '+p; details.textContent = p; save(widget); });
    }
  };

  // persistence
  function loadWidgets() {
    const raw = sGet(STORAGE_WIDGETS);
    if (!raw) return null;
    const parsed = safeParse(raw);
    if (Array.isArray(parsed)) return parsed;
    return null;
  }
  function saveWidgets() { try { sSet(STORAGE_WIDGETS, JSON.stringify(widgets)); console.info('sidebar: widgets saved', widgets.length); } catch(e) { console.warn('sidebar: save failed', e); } }

  // UI skeleton
  const headerEl = document.createElement('div'); headerEl.className='dm-header';
  const titleEl = document.createElement('div'); titleEl.className='dm-title'; titleEl.textContent='Tools'; headerEl.appendChild(titleEl);
  const closeBtn = document.createElement('button'); closeBtn.className='dm-icon-btn'; closeBtn.title='Close'; closeBtn.innerHTML='✕'; closeBtn.addEventListener('click', ()=> sidebar.dmSidebar && sidebar.dmSidebar.close()); headerEl.appendChild(closeBtn);
  const widgetsContainer = document.createElement('div'); widgetsContainer.className='dm-widgets';
  const footerEl = document.createElement('div'); footerEl.className='dm-footer';
  function mkBtn(text, cls, handler) { const b=document.createElement('button'); b.className=cls; b.textContent=text; b.addEventListener('click', handler); return b; }
  footerEl.appendChild(mkBtn('Add d20','dm-btn', ()=> addWidget('d20')));
  footerEl.appendChild(mkBtn('Add Dice','dm-btn', ()=> addWidget('dice')));
  footerEl.appendChild(mkBtn('Add NPC','dm-btn', ()=> addWidget('npc')));
  footerEl.appendChild(mkBtn('Add Trinket','dm-btn', ()=> addWidget('trinket')));
  footerEl.appendChild(mkBtn('Add Loot','dm-btn', ()=> addWidget('loot')));
  footerEl.appendChild(mkBtn('Add Name','dm-btn', ()=> addWidget('name')));
  footerEl.appendChild(mkBtn('Add Encounter','dm-btn', ()=> addWidget('encounter')));
  footerEl.appendChild(mkBtn('Add Prompt','dm-btn', ()=> addWidget('inspo')));
  footerEl.appendChild(mkBtn('Reset','dm-icon-btn', ()=> { if(!confirm('Remove all widgets?')) return; widgets=[]; saveWidgets(); renderWidgets(); }));

  function renderShell() { sidebar.innerHTML=''; sidebar.appendChild(headerEl); sidebar.appendChild(widgetsContainer); sidebar.appendChild(footerEl); }

  // add/remove and render widgets
  function saveWidgetState(widget) { const idx = widgets.findIndex(w=>w.id===widget.id); if (idx>=0) widgets[idx] = widget; saveWidgets(); }

  function createWidgetElement(widget) {
    const wrap = document.createElement('div'); wrap.className='dm-widget'; wrap.id='widget-'+widget.id;
    const head = document.createElement('div'); head.className='dm-widget-header';
    const t = document.createElement('div'); t.className='dm-widget-title'; t.textContent = widget.title || widget.type; head.appendChild(t);
    const ctrls = document.createElement('div'); ctrls.className='dm-widget-controls';
    const rm = document.createElement('button'); rm.className='dm-icon-btn'; rm.title='Remove widget'; rm.innerHTML='🗑'; rm.addEventListener('click', ()=> { if(!confirm('Remove this widget?')) return; removeWidget(widget.id); }); ctrls.appendChild(rm);
    head.appendChild(ctrls); wrap.appendChild(head);
    const body = document.createElement('div'); body.className='dm-widget-body'; wrap.appendChild(body);
    const reg = widgetRegistry[widget.type];
    if (reg && typeof reg.render === 'function') { if (!widget.state) widget.state = (reg.initState ? reg.initState() : {}); reg.render(widget, body, (w)=> saveWidgetState(w)); } else { body.textContent='(Unknown widget)'; }
    return wrap;
  }

  function renderWidgets() { renderShell(); widgetsContainer.innerHTML=''; if (!widgets.length) { const e = document.createElement('div'); e.style.color='var(--muted,#cfcfcf)'; e.textContent='No widgets. Use the buttons below to add one.'; widgetsContainer.appendChild(e); } else { widgets.forEach(w=> widgetsContainer.appendChild(createWidgetElement(w))); } }

  function addWidget(type, opts={}) {
    if (!widgetRegistry[type]) { console.warn('Unknown widget type', type); return null; }
    const reg = widgetRegistry[type];
    const widget = { id: uid('widget'), type, title: opts.title || reg.title || type, state: opts.state || (reg.initState ? reg.initState() : {}) };
    widgets.push(widget);
    saveWidgets();
    renderWidgets();
    console.info('sidebar: added widget', widget.type, widget.id);
    return widget;
  }

  function removeWidget(id) {
    const idx = widgets.findIndex(w=>w.id===id);
    if (idx === -1) return false;
    widgets.splice(idx,1);
    saveWidgets();
    renderWidgets();
    return true;
  }

  // load saved widgets or set default
  const loaded = loadWidgets();
  if (loaded && Array.isArray(loaded) && loaded.length) {
    widgets = loaded.map(w=> ({ id: w.id || uid('widget'), type: w.type || 'd20', title: w.title || (widgetRegistry[w.type] ? widgetRegistry[w.type].title : w.type), state: w.state || (widgetRegistry[w.type] && widgetRegistry[w.type].initState ? widgetRegistry[w.type].initState() : {}) }) );
  } else {
    // default: include one d20 by default
    widgets = [{ id: uid('widget'), type: 'd20', title: widgetRegistry.d20.title, state: widgetRegistry.d20.initState() }];
    saveWidgets();
  }
  renderWidgets();

  // open/close + tab position
  function applyOpen(open) { sidebar.classList.toggle('dm-open', Boolean(open)); sidebar.setAttribute('aria-hidden', String(!open)); tab.setAttribute('aria-expanded', String(open)); tab.setAttribute('aria-pressed', String(open)); if (open) { const f = sidebar.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); (f||sidebar).focus && (f||sidebar).focus(); } else { try{ tab.focus(); } catch(e){} } requestAnimationFrame(updateTabPosition); }
  function setOpen(open) { applyOpen(open); sSet(STORAGE_OPEN, open ? '1' : '0'); }

  const savedOpen = sGet(STORAGE_OPEN);
  const wasOpen = savedOpen === '1' || sidebar.getAttribute('aria-hidden') === 'false';
  applyOpen(Boolean(wasOpen));

  function updateTabPosition() {
    tab.style.top = '50%';
    const tabRect = tab.getBoundingClientRect(); const tabW = Math.max(tabRect.width, 36);
    if (sidebar.classList.contains('dm-open')) {
      const sRect = sidebar.getBoundingClientRect();
      const left = Math.round(sRect.right - (tabW / 2));
      tab.style.left = left + 'px';
      tab.style.transform = 'translateY(-50%) rotate(0deg)';
    } else {
      tab.style.left = '0px';
      tab.style.transform = 'translate(-50%,-50%) rotate(-90deg)';
    }
  }

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
  window.addEventListener('resize', () => setTimeout(updateTabPosition, 60));
  window.addEventListener('scroll', () => setTimeout(updateTabPosition, 60), { passive: true });
  sidebar.addEventListener('transitionend', () => setTimeout(updateTabPosition, 40));
  window.addEventListener('load', () => setTimeout(updateTabPosition, 40));

  // expose API
  try {
    sidebar.dmSidebar = {
      open: ()=> setOpen(true),
      close: ()=> setOpen(false),
      toggle: ()=> setOpen(!sidebar.classList.contains('dm-open')),
      isOpen: ()=> sidebar.classList.contains('dm-open'),
      addWidget, removeWidget,
      listWidgets: ()=> widgets.map(w=>({ id:w.id, type:w.type, title:w.title })),
      updateTabPosition
    };
    window.dmSidebar = sidebar.dmSidebar;
  } catch (e) { console.warn('sidebar: api exposure failed', e); }

  console.info('sidebar.js loaded — API: sidebar.dmSidebar. Use sidebar.dmSidebar.addWidget("trinket") to add a trinket.');
})();
