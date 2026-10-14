(() => {
  'use strict';
  const panels = { logbook: document.querySelector('[data-diving-logbook]'), gear: document.querySelector('[data-diving-gear]') };
  if (!panels.logbook || !panels.gear) return;
  const categories = ['Exposure suit','Undergarment','BCD','Regulator','Cylinder / tank','Fins','Boots','Hood','Gloves','Weights','Mask','Snorkel','Dive computer','Transmitter','Gauges / compass','Lights','Camera','Cutting / signaling','Surface safety','Rebreather','DPV / scooter','Bags / storage','Spare parts','Accessories'];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const number = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const date = (v) => !v || Number.isNaN(new Date(v).getTime()) ? 'No date' : new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  const dateTile = (v) => { const d=v?new Date(v.length===10?`${v}T12:00:00`:v):null; return d&&!Number.isNaN(d.getTime())?{month:d.toLocaleDateString('en-US',{month:'short'}),day:d.toLocaleDateString('en-US',{day:'2-digit'}),year:d.getFullYear()}: {month:'—',day:'—',year:''}; };
  const keyOf = (r) => `${r.kind}/${r.id}`;
  let request, userId, epoch = 0, detailEpoch = 0, loaded = false, loading = null, records = new Map(), active = 'logbook';
  const ui = { logbook: { search:'', filter:'', sort:'newest', selected:null, mobileDetail:false, tab:'profile', page:'dives', from:'', to:'', mode:'' }, gear: { search:'', filter:'', sort:'name', selected:null, setup:'', mobileDetail:false, tab:'overview' } };
  const defaultUi=structuredClone(ui);
  let pendingWorkspace=null;
  window.DMZWorkspace?.register('diving',()=>({owner:userId,value:pendingWorkspace||{
    ui:Object.fromEntries(Object.entries(ui).map(([view,state])=>[view,Object.fromEntries(['search','filter','sort','selected','setup','mobileDetail','tab','page','from','to','mode','pageIndex'].map((key)=>[key,state[key]]))])),
    imperial,scrolls:Object.fromEntries(Object.entries(panels).map(([view,panel])=>[view,window.DMZWorkspace.scrolls(panel)]))
  }}));
  function restoreWorkspace() {
    if(!pendingWorkspace)return null;
    const saved=pendingWorkspace;pendingWorkspace=null;
    for(const view of Object.keys(ui)){
      Object.assign(ui[view],saved.ui?.[view]);
      for(const [attr,prop] of [['search','search'],['filter','filter'],['sort','sort'],['date-from','from'],['date-to','to'],['mode','mode']]) {
        const input=panels[view].querySelector(`[data-${attr}]`);if(input)input.value=ui[view][prop]||'';
      }
    }
    imperial=!!saved.imperial;panels.logbook.querySelector('[data-units]').value=imperial?'imperial':'metric';
    return saved;
  }
  let imperial = false, dialogRecord = null, disposeProfile = null;
  const dialog = document.createElement('dialog');
  dialog.className = 'diving-dialog'; dialog.setAttribute('aria-labelledby', 'diving-editor-title');
  document.body.append(dialog);
  const depth = (v) => v == null ? '—' : `${(number(v) * (imperial ? 3.28084 : 1)).toFixed(1)} ${imperial ? 'ft' : 'm'}`;
  const temp = (v) => v == null ? '—' : `${(imperial ? number(v) * 1.8 + 32 : number(v)).toFixed(0)} °${imperial ? 'F' : 'C'}`;
  const duration = (v) => `${Math.round(number(v) / 60)} min`;
  const all = (kind) => [...records.values()].filter((r) => r.kind === kind && !r.deleted);
  function status(message, error = false) {
    Object.values(panels).forEach((panel) => { const el = panel.querySelector('[data-sync-status]'); if (el) { el.textContent = message; el.classList.toggle('is-error', error); } });
  }
  function shell(view) {
    const log = view === 'logbook';
    panels[view].innerHTML = `<div class="diving-header"><div><p class="diving-kicker">${log ? 'Your time beneath the surface' : 'Prepared for the next dive'}</p><h2 id="${log ? 'logbook' : 'gear'}-title">${log ? 'My logbook' : 'Gear locker'}</h2><p>${log ? 'Every dive, every detail. Your app and account, connected.' : 'Your equipment, setups, and service records in one place.'}</p></div><button class="btn primary" data-add="${log ? 'dive' : 'gear'}">${log ? '+ Log a dive' : '+ Add gear'}</button></div>
      ${log ? '<div class="tool-view-switch" aria-label="Logbook view"><button type="button" data-log-page="dives" aria-pressed="true">Dives</button><button type="button" data-log-page="stats" aria-pressed="false">Statistics</button></div>' : ''}
      <div class="diving-stats" data-stats></div><p class="diving-status" role="status" data-sync-status>Sign in to load your records.</p>
      ${log ? '' : '<div class="diving-setups" data-setups aria-label="Gear setups"></div>'}
      <div class="diving-toolbar"><input type="search" aria-label="${log ? 'Search dives' : 'Search gear'}" placeholder="${log ? 'Search sites, buddies, notes…' : 'Search equipment, model, serial…'}" data-search>
      <select aria-label="${log ? 'Dive source' : 'Gear category'}" data-filter><option value="">${log ? 'All dives' : 'All categories'}</option>${(log ? ['manual','computer','import','mixed'] : categories).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>
      <select aria-label="Sort records" data-sort>${(log ? [['newest','Newest first'],['oldest','Oldest first'],['deepest','Deepest first']] : [['name','Name A–Z'],['service','Service due'],['newest','Recently added']]).map(([v,t]) => `<option value="${v}">${t}</option>`).join('')}</select>
      ${log ? '<select aria-label="Display units" data-units><option value="metric">Meters / °C</option><option value="imperial">Feet / °F</option></select>' : ''}
      <button class="btn secondary" data-refresh>Refresh</button><details class="tool-export"><summary>Export</summary><div><button class="btn secondary" data-export>Complete JSON</button>${log ? '<button class="btn secondary" data-export-csv>Spreadsheet CSV</button>' : ''}</div></details></div>
      ${log ? '<details class="tool-filters"><summary>More filters</summary><div><label>From<input type="date" data-date-from></label><label>Through<input type="date" data-date-to></label><label>Dive mode<select data-mode><option value="">All modes</option><option value="oc">Open circuit</option><option value="ccr">CCR</option><option value="scr">SCR</option><option value="gauge">Gauge</option><option value="freedive">Freedive</option></select></label></div></details><section data-log-analytics hidden></section>' : ''}
      <div class="diving-layout"><div class="diving-list" data-list aria-label="${log ? 'Dives' : 'Equipment'}"></div><div class="diving-detail" data-detail></div></div>
      <p class="diving-footnote">App changes appear after sync succeeds. Photos and documents remain on your device in this version.</p>`;
    const panel = panels[view];
    window.DMZTools.browser(panel);
    if(log){const statistics=document.createElement('section');statistics.dataset.statisticsPane='';statistics.className='diving-statistics';statistics.hidden=true;statistics.innerHTML='<button type="button" class="btn secondary" data-log-page="dives">‹ Back to dives</button>';statistics.append(panel.querySelector('[data-stats]'),panel.querySelector('[data-log-analytics]'));panel.querySelector('.diving-layout').append(statistics);}
    for (const [attr, prop] of [['date-from','from'],['date-to','to'],['mode','mode']]) panel.querySelector(`[data-${attr}]`)?.addEventListener('change', (event) => { ui.logbook[prop] = event.target.value; ui.logbook.pageIndex=0; render(view); });
    panel.querySelector('[data-search]').addEventListener('input', (e) => { ui[view].search = e.target.value; ui[view].pageIndex=0; render(view); });
    for (const prop of ['filter','sort']) panel.querySelector(`[data-${prop}]`).addEventListener('change', (e) => { ui[view][prop] = e.target.value; ui[view].pageIndex=0; render(view); });
    panel.querySelector('[data-units]')?.addEventListener('change', (e) => { imperial = e.target.value === 'imperial'; render(view); });
    panel.addEventListener('click', (e) => {
      const button = e.target.closest('button'); if (!button || !userId) return;
      if (button.hasAttribute('data-log-page')) { ui.logbook.page = button.dataset.logPage; render(view); }
      if (button.hasAttribute('data-gear-page')) { ui.gear.page=button.dataset.gearPage;ui.gear.mobileDetail=false;ui.gear.selected=null;render('gear'); }
      if (button.hasAttribute('data-list-page')) { ui[view].pageIndex=(ui[view].pageIndex||0)+Number(button.dataset.listPage); ui[view].mobileDetail=false; render(view); panels[view].querySelector('[data-list]').scrollTop=0; }
      if (button.hasAttribute('data-refresh')) load(true);
      if (button.hasAttribute('data-add')) edit(button.dataset.add);
      if (button.hasAttribute('data-mobile-back')) {
        ui[view].mobileDetail = false; render(view);
        [...panel.querySelectorAll('[data-select]')].find((entry) => entry.dataset.select === ui[view].selected)?.focus();
      }
      if (button.hasAttribute('data-select')) { if(ui[view].selected !== button.dataset.select) ui[view].tab=view==='logbook'?'profile':'overview'; ui[view].selected = button.dataset.select; ui[view].mobileDetail = true; render(view); }
      if (button.hasAttribute('data-edit')) edit(button.dataset.edit, button.dataset.id);
      if (button.hasAttribute('data-delete')) remove(button.dataset.delete, button.dataset.id);
      if (button.hasAttribute('data-setup')) { ui.gear.setup = button.dataset.setup; ui.gear.page='setups';ui.gear.mobileDetail=true;ui.gear.selected=null;render('gear'); }
      if (button.hasAttribute('data-export')) exportData(view).catch((error) => status(error.message,true));
      if (button.hasAttribute('data-export-csv')) exportCsv().catch((error) => status(error.message,true));
    });
    panel.addEventListener('change', async (e) => {
      if (!e.target.matches('[data-pack]') || !userId) return;
      const setup = records.get(`setup/${e.target.dataset.packSetup || ui.gear.setup}`); if (!setup) return;
      const ids = new Set(setup.data.checkedIds || []);
      if (e.target.checked) ids.add(e.target.dataset.pack); else ids.delete(e.target.dataset.pack);
      e.target.disabled = true;
      try { await save({ ...setup, data: { ...setup.data, checkedIds:[...ids] } }); render('gear'); status('Packing checklist saved.'); }
      catch (error) { e.target.checked = !e.target.checked; status(error.message, true); }
      finally { e.target.disabled = false; }
    });
  }
  const stat = (value, label) => `<div class="diving-stat"><strong>${esc(value)}</strong><span>${label}</span></div>`;
  function dueFor(item) {
    const dates = [item.nextServiceDate, item.visualInspectionDue, item.hydrostaticTestDue].filter(Boolean);
    if (!item.nextServiceDate && item.lastServiceDate && Number(item.serviceIntervalMonths) > 0) {
      const d = new Date(`${item.lastServiceDate}T12:00:00`);
      d.setMonth(d.getMonth() + Number(item.serviceIntervalMonths));
      if (!Number.isNaN(d.getTime())) dates.push(d.toISOString().slice(0,10));
    }
    return [...dates, ...(item.components || []).map(dueFor).filter(Boolean)].sort()[0] || '';
  }
  function gearStatus(item) {
    if(window.DMZGearModel){const status=window.DMZGearModel.serviceStatusForSet(item,all('gear').map((row)=>row.data));return {label:status.label,tone:status.tone==='danger'?'blocked':status.tone==='warning'?'attention':''};}
    if (['Out of service','Retired'].includes(item.condition)) return { label:item.condition, tone:'blocked' };
    if (item.condition === 'Needs attention' || (item.components || []).some((c) => ['Needs attention','Out of service'].includes(c.condition))) return { label:'Needs attention', tone:'attention' };
    const due = dueFor(item), days = due ? (new Date(`${due}T23:59:59`) - new Date()) / 86400000 : Infinity;
    return days < 0 ? { label:'Service overdue', tone:'blocked' } : days < 30 ? { label:'Service due soon', tone:'attention' } : { label:item.condition || 'Ready', tone:'' };
  }
  function render(view) {
    const panel = panels[view], log = view === 'logbook', state = ui[view];
    panel.classList.toggle('has-tool-detail',state.mobileDetail && window.matchMedia('(max-width: 760px)').matches && state.page !== 'stats');
    const values = all(log ? 'dive' : 'gear');
    panel.querySelector('[data-stats]').innerHTML = log
      ? stat(values.length, 'Logged dives') + stat(`${(values.reduce((n,r) => n + number(r.data.durationSeconds),0) / 3600).toFixed(1)} h`, 'Time underwater') + stat(values.length ? depth(Math.max(...values.map((r) => number(r.data.water?.maxDepthMeters)))) : '—', 'Deepest dive')
        + stat(values.length ? duration(values.reduce((n,r) => n + number(r.data.durationSeconds),0) / values.length) : '—', 'Average dive')
        + stat(new Set(values.map((r) => r.data.site?.name).filter(Boolean)).size, 'Dive sites')
        + stat(new Set(values.map((r) => r.data.site?.country).filter(Boolean)).size, 'Countries')
      : stat(values.length, 'Items in your locker') + stat(all('setup').length, 'Saved setups') + stat(values.filter((r) => gearStatus(r.data).tone).length, 'Need attention');
    if (!log) {
      panel.querySelector('[data-setups]').innerHTML = [['inventory','Equipment'],['setups','Setups & packing'],['service','Service center']].map(([page,label])=>`<button type="button" data-gear-page="${page}" aria-pressed="${(state.page||'inventory')===page}">${label}</button>`).join('');
      if(state.page==='setups'){renderSetups(panel);return;}
    }
    let shown = values.filter((r) => {
      const d = r.data;
      if(!log&&state.page==='service'&&!gearStatus(d).tone)return false;
      const text = log ? [d.site?.name,d.site?.location,d.notes,...(d.buddies || [])] : [d.name,d.category,d.manufacturer,d.model,d.serialNumber];
      const setup = records.get(`setup/${state.setup}`);
      const stamp = String(d.startTime || '').slice(0,10);
      return (!log || ((!state.from || stamp >= state.from) && (!state.to || stamp <= state.to) && (!state.mode || d.diveMode === state.mode)))
        && (!state.filter || (log ? d.source : d.category) === state.filter) && text.join(' ').toLowerCase().includes(state.search.toLowerCase());
    });
    shown.sort((a,b) => log
      ? state.sort === 'deepest' ? number(b.data.water?.maxDepthMeters) - number(a.data.water?.maxDepthMeters) : String(a.data.startTime || '').localeCompare(String(b.data.startTime || '')) * (state.sort === 'oldest' ? 1 : -1)
      : state.sort === 'service' ? (dueFor(a.data) || '9999').localeCompare(dueFor(b.data) || '9999') : state.sort === 'newest' ? String(b.data.createdAt || '').localeCompare(String(a.data.createdAt || '')) : String(a.data.name || '').localeCompare(String(b.data.name || '')));
    state.visibleIds=shown.map((r)=>r.id);
    if (log) {
      const statsPage = state.page === 'stats';
      panel.classList.toggle('is-stats-view',statsPage);
      panel.querySelector('[data-log-analytics]').hidden = !statsPage;
      panel.querySelector('[data-detail]').hidden = statsPage;
      panel.querySelector('[data-statistics-pane]').hidden = !statsPage;
      panel.querySelectorAll('[data-log-page]').forEach((button) => button.setAttribute('aria-pressed',String(button.dataset.logPage === state.page)));
      analytics(shown, panel.querySelector('[data-log-analytics]'));
    }
    const total=shown.length, pageSize=24;
    state.pageIndex=Math.max(0,Math.min(state.pageIndex||0,Math.ceil(total/pageSize)-1));
    shown=shown.slice(state.pageIndex*pageSize,(state.pageIndex+1)*pageSize);
    if (!shown.some((r) => r.id === state.selected)) state.selected = shown[0]?.id || null;
    panel.querySelector('.diving-layout').classList.toggle('is-mobile-detail', state.mobileDetail && window.matchMedia('(max-width: 760px)').matches);
    const entryMarkup = (r) => {
      const d=r.data;
      if(log){const mixes=(d.gas?.mixes||[]).map((mix)=>mix.label||`${Math.round(number(mix.o2)*100)}%`).join(' / ');return `<button class="diving-entry diving-entry-log" data-select="${esc(r.id)}" aria-pressed="${r.id===state.selected}"><span class="entry-content"><span class="log-row-meta"><time>${esc(date(d.startTime))}</time>${d.number!=null?`<span>#${esc(d.number)}</span>`:''}</span><strong>${esc(d.site?.name||'Untitled dive')}</strong><small class="entry-subtitle">${esc([d.site?.location,d.site?.country].filter(Boolean).join(' · ')||'Location not set')}</small><span class="log-row-bottom"><span>${esc(depth(d.water?.maxDepthMeters))}</span><span>${esc(duration(d.durationSeconds))}</span>${mixes?`<span class="log-row-gas">${esc(mixes)}</span>`:''}<small class="log-row-source" title="${esc(d.source||'manual')} dive">${esc(d.source||'manual')}</small></span></span><span class="entry-chevron" aria-hidden="true">›</span></button>`;}
      const condition=gearStatus(d),due=dueFor(d);return `<button class="diving-entry diving-entry-gear" data-select="${esc(r.id)}" aria-pressed="${r.id===state.selected}"><span class="entry-gear-icon" aria-hidden="true">${esc((d.category||'G').slice(0,1))}</span><span class="entry-content"><span class="entry-kicker"><span class="diving-badge">${esc(d.category||'Equipment')}</span><span class="diving-badge ${condition.tone}">${esc(condition.label)}</span></span><strong>${esc(d.name||'Unnamed gear')}</strong><small class="entry-subtitle">${esc([d.manufacturer,d.model].filter(Boolean).join(' · ')||'Add manufacturer and model')}</small><span class="entry-metrics"><span><b>${esc(d.serialNumber||'—')}</b><small>serial</small></span><span><b>${esc(due?date(due):'Not scheduled')}</b><small>next service</small></span></span></span><span class="entry-chevron" aria-hidden="true">›</span></button>`;
    };
    let listMarkup;
    if(log&&state.sort!=='deepest'){
      const groups=new Map();for(const row of shown){const stamp=dateTile(row.data.startTime),label=stamp.year||'Date not set';groups.set(label,[...(groups.get(label)||[]),row]);}
      listMarkup=[...groups].map(([year,rows])=>`<section class="diving-entry-group"><h3>${esc(year)} <small>${rows.length} ${rows.length===1?'dive':'dives'}</small></h3>${rows.map(entryMarkup).join('')}</section>`).join('');
    }else listMarkup=shown.map(entryMarkup).join('');
    const pager=total?`<div class="tool-list-pagination"><span>${state.pageIndex*pageSize+1}–${Math.min(total,(state.pageIndex+1)*pageSize)} of ${total}</span><button type="button" data-list-page="-1" ${state.pageIndex===0?'disabled':''} aria-label="Previous records">‹</button><button type="button" data-list-page="1" ${(state.pageIndex+1)*pageSize>=total?'disabled':''} aria-label="Next records">›</button></div>`:'';
    panel.querySelector('[data-browser-pagination]').innerHTML=total>24?pager:`<span class="browser-record-count">${total} ${log?(total===1?'dive':'dives'):(total===1?'item':'items')}</span>`;
    panel.querySelector('[data-list]').innerHTML = (listMarkup || `<div class="diving-empty"><h3>${values.length ? 'No matching records' : log ? 'Your next chapter starts here' : 'Build your gear locker'}</h3><p>${values.length ? 'Try a different search or filter.' : log ? 'Sign in on the app to sync your dives, or log your first dive here.' : 'Sync equipment from the app, or add your first item here.'}</p></div>`);
    const selected = shown.find((r) => r.id === state.selected);
    if (selected) detail(view, selected);
    else panel.querySelector('[data-detail]').innerHTML = !log && state.setup ? setupDetail(records.get(`setup/${state.setup}`)) : `<div class="diving-empty"><h3>${loaded ? 'Ready when you are' : 'Loading your account'}</h3><p>${loaded ? 'Select a record to explore its details.' : 'Your records will appear here after loading.'}</p></div>`;
  }
  const pair = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value == null || value === '' ? '—' : value)}</dd></div>`;
  function gearState(){return {items:all('gear').map((row)=>row.data),setups:all('setup').map((row)=>({checkedIds:[],itemIds:[],...row.data}))};}
  async function persistGearState(next,setupId){
    for(const [kind,values]of [['gear',next.items],['setup',next.setups]])for(const data of values){
      const row=records.get(`${kind}/${data.id}`);if(row&&JSON.stringify(row.data)!==JSON.stringify(data))await save({...row,data});
    }
    const result=records.get(`setup/${setupId}`)?.data;
    const button=[...panels.gear.querySelectorAll('[data-setup]')].find((el)=>el.dataset.setup===setupId);
    if(result&&button){const progress=window.DMZGearModel.setupProgress(result,all('gear').map((row)=>row.data));button.querySelector('small').textContent=`${result.type} · ${progress.checked}/${progress.total} pieces packed`;button.querySelector('progress').value=progress.checked;}
    return result;
  }
  function renderSetups(panel){
    panel.querySelector('[data-browser-pagination]').innerHTML='';
    const state=ui.gear,model=window.DMZGearModel,current=gearState(),setups=all('setup');
    const wanted=setups.filter((row)=>row.data.name?.toLowerCase().includes(state.search.toLowerCase()));
    if(!wanted.some((row)=>row.id===state.setup))state.setup=wanted[0]?.id||'';
    panel.querySelector('.diving-layout').hidden=false;
    panel.querySelector('.diving-layout').classList.toggle('is-mobile-detail',state.mobileDetail&&window.matchMedia('(max-width:760px)').matches);
    panel.querySelector('[data-list]').innerHTML=`<div class="tool-list-pagination"><span>${wanted.length} saved setups</span><button type="button" data-add="setup" aria-label="Create a gear setup">+</button></div>`+wanted.map((row)=>{
      const progress=model.setupProgress(row.data,current.items);
      return `<button type="button" class="diving-entry setup-entry" data-setup="${esc(row.id)}" aria-pressed="${row.id===state.setup}"><span class="entry-gear-icon">◇</span><span><strong>${esc(row.data.name)}</strong><small>${esc(row.data.type)} · ${progress.checked}/${progress.total} pieces packed</small><progress max="${progress.total||1}" value="${progress.checked}"></progress></span><span class="entry-chevron">›</span></button>`;
    }).join('');
    const container=panel.querySelector('[data-detail]'),row=records.get(`setup/${state.setup}`);
    if(!row){container.innerHTML='<div class="diving-empty"><h3>Build your first setup</h3><p>Group the equipment you take diving and pack every component.</p><button class="btn primary" data-add="setup">Create a setup</button></div>';return;}
    container.innerHTML=`<button class="diving-mobile-back" data-mobile-back>Back to setups</button><div class="workbench-title"><div><p class="diving-kicker">${esc(row.data.type)}</p><h3>${esc(row.data.name)}</h3></div><button class="btn secondary" data-edit="setup" data-id="${esc(row.id)}">Edit setup</button></div><div data-setup-packing></div>`;
    window.DMZPacking.mount(container.querySelector('[data-setup-packing]'),{setup:row.data,items:current.items,setups:current.setups,
      onChecks:async(keys,checked)=>persistGearState(model.applyChecks(gearState(),row.id,keys,checked),row.id),
      onSetup:async(data)=>(await save({...records.get(`setup/${row.id}`),data})).data,
      onMove:async(itemId)=>persistGearState(model.moveFloatingItem(gearState(),itemId,row.id),row.id),
      onOpen:(id)=>{state.page='inventory';state.selected=id;state.mobileDetail=true;render('gear');},onAdd:()=>edit('setup',row.id)});
  }
  function analytics(rows, host) {
    const sites = new Map(), years = new Map();
    for (const {data:d} of rows) {
      const name=d.site?.name||'Unspecified site', year=String(d.startTime||'').slice(0,4)||'Undated';
      sites.set(name,(sites.get(name)||0)+1); years.set(year,(years.get(year)||0)+1);
    }
    const bars = (entries) => { const max=Math.max(1,...entries.map(([,n])=>n)); return entries.map(([label,n])=>`<div class="tool-bar-row"><span>${esc(label)}</span><meter min="0" max="${max}" value="${n}">${n}</meter><b>${n}</b></div>`).join(''); };
    host.innerHTML=`<div class="tool-analytics-grid"><article class="tool-card"><h3>Diving by year</h3>${bars([...years].sort((a,b)=>b[0].localeCompare(a[0])))||'<p>No dated dives yet.</p>'}</article><article class="tool-card"><h3>Most visited sites</h3>${bars([...sites].sort((a,b)=>b[1]-a[1]).slice(0,8))||'<p>No sites yet.</p>'}</article><article class="tool-card"><h3>Your filtered logbook</h3><dl>${pair('Dives',String(rows.length))}${pair('Underwater time',`${(rows.reduce((n,r)=>n+number(r.data.durationSeconds),0)/3600).toFixed(1)} hours`)}${pair('Average depth',rows.length?depth(rows.reduce((n,r)=>n+number(r.data.water?.avgDepthMeters),0)/rows.length):'—')}${pair('Countries',String(new Set(rows.map((r)=>r.data.site?.country).filter(Boolean)).size))}</dl><p>Search and filters apply to these statistics and the CSV export.</p></article></div>`;
  }
  function diveSections(d,gasMixes,tanks){const timestamp=d.startTime?new Date(d.startTime):null;return `<div class="record-sections"><section class="record-section"><h4>Time &amp; dive</h4><dl>${pair('Dive number',d.number)}${pair('Date',date(d.startTime))}${pair('Start time',timestamp?timestamp.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'')}${pair('Timezone offset',d.timezoneOffsetMinutes!=null?`${d.timezoneOffsetMinutes} minutes`:'')}${pair('Dive time',duration(d.durationSeconds))}${pair('Surface interval',d.surfaceIntervalSeconds!=null?duration(d.surfaceIntervalSeconds):'')}${pair('Dive mode',d.diveMode)}${pair('Dive types',(d.types||[]).join(', '))}${pair('Decompression model',d.decoModel?.type?`${d.decoModel.type}${d.decoModel.gfLow!=null?` · GF ${d.decoModel.gfLow}/${d.decoModel.gfHigh}`:''}`:'')}</dl></section><section class="record-section"><h4>Site &amp; conditions</h4><dl>${pair('Maximum depth',depth(d.water?.maxDepthMeters))}${pair('Average depth',depth(d.water?.avgDepthMeters))}${pair('Surface temperature',temp(d.water?.tempSurfaceC))}${pair('Minimum temperature',temp(d.water?.tempMinC))}${pair('Maximum temperature',temp(d.water?.tempMaxC))}${pair('Visibility',d.water?.visibilityMeters!=null?depth(d.water.visibilityMeters):'')}${pair('Water type',d.water?.type)}${pair('Coordinates',Number.isFinite(Number(d.site?.latitude))?`${Number(d.site.latitude).toFixed(5)}, ${Number(d.site.longitude).toFixed(5)}`:'')}${pair('Atlas link',d.site?.siteId?`${d.site.siteSource||'linked'} · ${d.site.siteId}`:'')}${pair('Atmospheric pressure',d.atmosphericBar!=null?`${d.atmosphericBar} bar`:'')}</dl></section><section class="record-section"><h4>Gas &amp; exposure</h4><dl>${pair('Gas mixes',gasMixes)}${pair('Cylinder details',tanks)}${pair('Exposure weight',d.gear?.weightKg!=null?`${d.gear.weightKg} kg`:'')}${pair('Exposure suit',d.gear?.exposureSuit)}</dl></section><section class="record-section"><h4>People &amp; notes</h4><dl>${pair('Buddies',(d.buddies||[]).join(', '))}${pair('Operator',d.operator)}${pair('Rating',d.rating?`${d.rating} / 5`:'')}${pair('Tags',(d.tags||[]).join(', '))}</dl></section></div>`;}
  function setupDetail(record) {
    if (!record) return '';
    const d = record.data;
    return `<h4>${esc(d.name)} · ${esc(d.type)}</h4><p>${esc(d.description)}</p><div class="diving-actions"><button class="btn secondary" data-edit="setup" data-id="${esc(record.id)}">Edit setup</button><button class="btn secondary diving-danger" data-delete="setup" data-id="${esc(record.id)}">Delete setup</button></div>` + (d.itemIds || []).map((id) => {
      const gear = records.get(`gear/${id}`); if (!gear || gear.deleted) return '';
      return `<label class="diving-check"><input type="checkbox" data-pack="${esc(id)}" data-pack-setup="${esc(record.id)}" ${(d.checkedIds || []).includes(id) ? 'checked' : ''}>${esc(gear.data.name)}</label>`;
    }).join('');
  }
  async function detail(view, record) {
    if(view==='logbook'){disposeProfile?.();disposeProfile=null;}
    const d = record.data, log = view === 'logbook', container = panels[view].querySelector('[data-detail]');
    const gasMixes=(d.gas?.mixes||[]).map((mix,index)=>`${index+1}: ${mix.label||'Gas'} (O₂ ${Math.round(number(mix.o2)*100)}%, He ${Math.round(number(mix.he)*100)}%)`).join('; ');
    const tanks=(d.gas?.tanks||[]).map((tank,index)=>`${index+1}: ${tank.volumeLiters??'?'} L · ${tank.startBar??'?'} → ${tank.endBar??'?'} bar · ${tank.workPressureBar??'?'} bar working pressure`).join('; ');
    container.innerHTML = `<button type="button" class="diving-mobile-back" data-mobile-back aria-label="Back to ${log ? 'dives' : 'gear list'}">Back to ${log ? 'dive list' : 'gear list'}</button><span class="diving-badge">${esc(log ? (d.source || 'manual') + ' dive' : d.category)}</span><h3>${esc(log ? d.site?.name || 'Untitled dive' : d.name)}</h3><p>${esc(log ? [d.site?.location,d.site?.country].filter(Boolean).join(', ') : [d.manufacturer,d.model].filter(Boolean).join(' · '))}</p>
      <div class="diving-actions"><button class="btn secondary" data-edit="${record.kind}" data-id="${esc(record.id)}">Edit ${log ? 'dive' : 'item'}</button><button class="btn secondary diving-danger" data-delete="${record.kind}" data-id="${esc(record.id)}">Delete</button></div>
      ${log ? diveSections(d,gasMixes,tanks) : `<section class="record-section"><h4>Equipment details</h4><dl>${pair('Condition',d.condition)}${pair('Serial number',d.serialNumber)}${pair('Next service',dueFor(d)?date(dueFor(d)):'Not set')}${pair('Last service',d.lastServiceDate?date(d.lastServiceDate):'')}${pair('Configuration',d.configuration)}${pair('Purchased',d.purchaseDate?date(d.purchaseDate):'')}</dl></section>`}
      ${log ? '<div data-computer-profiles></div>' : (d.components?.length ? `<h4>Assembly components</h4><ul class="diving-components">${d.components.map((c) => `<li><strong>${esc(c.name || c.type)}</strong><small>${esc([c.manufacturer,c.model,c.serialNumber].filter(Boolean).join(' · '))}</small><small>${esc(c.condition || 'Ready')}${dueFor(c) ? ` · Due ${esc(date(dueFor(c)))}` : ''}</small></li>`).join('')}</ul>` : '')}
      ${d.notes ? `<h4>${log ? 'Dive notes' : 'Equipment notes'}</h4><p class="diving-notes">${esc(d.notes)}</p>` : ''}
      ${log ? '<div data-sample-explorer></div>' : ''}
      ${!log && d.serviceNotes ? `<h4>Service notes</h4><p class="diving-notes">${esc(d.serviceNotes)}</p>` : ''}
      `;
    const overview = document.createElement('div'); overview.className = 'tool-record-overview';
    overview.innerHTML = log
      ? `<div class="tool-key-metrics">${stat(depth(d.water?.maxDepthMeters),'Max depth')}${stat(duration(d.durationSeconds),'Dive time')}${stat(temp(d.water?.tempMinC),'Water temp')}${stat((d.gas?.mixes||[]).map((mix)=>mix.label||`${Math.round(number(mix.o2)*100)}% O₂`).join(' / ')||'—','Gas')}</div><dl>${pair('Date',date(d.startTime))}${pair('Dive mode',d.diveMode||'Not recorded')}${pair('Buddies',(d.buddies||[]).join(', '))}${pair('Rating',d.rating?`${d.rating} / 5`:'Not rated')}</dl>`
      : `<div class="tool-key-metrics">${stat(gearStatus(d).label,'Condition')}${stat(dueFor(d)?date(dueFor(d)):'Not scheduled','Next service')}</div>`;
    const notes = container.querySelector('.diving-notes');
    if (notes) { const heading=notes.previousElementSibling; if(heading?.tagName==='H4') heading.remove(); overview.append(notes); }
    const tabHost=document.createElement('div'); tabHost.className='tool-record-tabs';
    if(log) {
      const sections=container.querySelector('.record-sections'), profile=container.querySelector('[data-computer-profiles]'), raw=container.querySelector('[data-sample-explorer]');
      window.DMZTools.tabs(tabHost,[{key:'overview',label:'Overview',nodes:[overview]},{key:'profile',label:'Profile',nodes:[profile]},{key:'details',label:'Dive record',nodes:[sections]},{key:'data',label:'Sample Explorer',nodes:[raw]}],ui[view].tab,(key)=>{ui[view].tab=key;container.classList.toggle('is-profile-view',key==='profile');});
    } else {
      const section=container.querySelector('.record-section'), components=container.querySelector('.diving-components'), service=container.querySelectorAll('.diving-notes');
      const schedule=document.createElement('section'); schedule.className='record-section';
      schedule.innerHTML=`<h4>Service schedule</h4><dl>${pair('Last service',d.lastServiceDate?date(d.lastServiceDate):'Not recorded')}${pair('Next service',dueFor(d)?date(dueFor(d)):'Not scheduled')}${pair('Service interval',d.serviceIntervalMonths?`${d.serviceIntervalMonths} months`:'Not set')}${pair('Visual inspection due',d.visualInspectionDue?date(d.visualInspectionDue):'Not set')}${pair('Hydrostatic test due',d.hydrostaticTestDue?date(d.hydrostaticTestDue):'Not set')}</dl>`;
      if(components?.previousElementSibling?.tagName==='H4')components.previousElementSibling.remove();
      service.forEach((note)=>{if(note.previousElementSibling?.tagName==='H4')note.previousElementSibling.remove();});
      const setupContent=document.createElement('div');setupContent.innerHTML=all('setup').filter((row)=>(row.data.itemIds||[]).includes(record.id)).map((row)=>`<button class="btn secondary" data-setup="${esc(row.id)}">Open ${esc(row.data.name)} checklist →</button>`).join('')||'<p>This item is not assigned to a saved setup yet.</p>';
      if(components){components.querySelectorAll('li').forEach((node,index)=>{const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent='Edit part / service';button.onclick=()=>editComponent(record.id,index);node.append(button);});}
      window.DMZTools.tabs(tabHost,[{key:'overview',label:'Overview',nodes:[overview,section]},{key:'service',label:'Service & parts',nodes:[schedule,components,...service]},{key:'setups',label:'Setups',nodes:[setupContent]}],ui[view].tab,(key)=>{ui[view].tab=key;});
    }
    container.append(tabHost);
    window.DMZTools.tidyActions(container);
    window.DMZTools.recordHeader(container);
    if (log) {
      const ticket = ++detailEpoch, accountTicket = epoch, chart = container.querySelector('[data-computer-profiles]'), raw = container.querySelector('[data-sample-explorer]');
      const logIds = [...new Set([...(d.logIds || []), d.primaryLogId].filter(Boolean))];
      if (!logIds.length) { disposeProfile=window.DMZProfileExplorer.mount(chart,raw,{dive:d,logs:d.profile?.samples?.length?[d]:[],imperial}); return; }
      chart.textContent = 'Loading linked computer profiles…';
      try {
        const computers = await Promise.all(logIds.map(async (logId) => {
          let computer = records.get(`computerLog/${logId}`);
          if (!computer) { computer = (await request(`/api/account/sync/computerLog/${encodeURIComponent(logId)}`)).record; records.set(keyOf(computer), computer); }
          return computer;
        }));
        if (!chart.isConnected || ticket !== detailEpoch || epoch !== accountTicket) return;
        disposeProfile=window.DMZProfileExplorer.mount(chart,raw,{dive:d,logs:computers.map((row)=>row.data),imperial});
      } catch { if (chart.isConnected && ticket === detailEpoch) chart.textContent = 'A linked computer profile could not load. Refresh to try again.'; }
    }
  }
  async function load(force = false) {
    if (!request || !userId || loading || (loaded && !force)) return;
    const ticket = epoch;
    status('Loading your diving records…');
    const task = (async () => {
      // Records arrive with their data, a page at a time; any row without data (an older service) is fetched on its own.
      let after = ''; const manifest = [];
      do { const page = await request(`/api/account/sync?include=dive,gear,setup${after ? `&after=${encodeURIComponent(after)}` : ''}`); if (epoch !== ticket) return; manifest.push(...page.records); after = page.next; status(`Loading your records · ${manifest.length} received…`); } while (after);
      const next = new Map(); const live = manifest.filter((r) => ['dive','computerLog','gear','setup'].includes(r.kind) && !r.deleted);
      for (const row of live) if (row.data) next.set(keyOf(row),row);
      const queue = live.filter((r) => !r.data);
      let cursor = 0;
      await Promise.all(Array.from({ length:Math.min(5,queue.length) }, async () => {
        while (cursor < queue.length && epoch === ticket) {
          const meta = queue[cursor++], cached = records.get(keyOf(meta));
          const row = cached?.revision === meta.revision ? cached : (await request(`/api/account/sync/${meta.kind}/${encodeURIComponent(meta.id)}`)).record;
          next.set(keyOf(row),row);
        }
      }));
      if (epoch !== ticket) return;
      records = next; loaded = true;
      const restored=restoreWorkspace()||{scrolls:Object.fromEntries(Object.entries(panels).map(([view,panel])=>[view,window.DMZWorkspace?.scrolls(panel)]))};
      render('logbook'); render('gear'); status(`Account records refreshed at ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}.`);
      if(restored)for(const view of Object.keys(panels))window.DMZWorkspace.restoreScrolls(panels[view],restored.scrolls?.[view]);
    })().catch((error) => {
      if (epoch !== ticket) return;
      const message = error?.message || 'Records could not load. Try Refresh.';
      const code = Number(error?.status);
      status(code ? `${message} (HTTP ${code})` : message, true);
      console.error('[DMZ Logbook] Record load failed', { status:code || null, code:error?.code || null, message });
    }).finally(() => { if (loading === task) loading = null; });
    loading = task; return task;
  }
  async function save(record) {
    const ticket = epoch;
    const payload = { ...record.data, id:record.id, updatedAt:new Date().toISOString() };
    const response = await request(`/api/account/sync/${record.kind}/${encodeURIComponent(record.id)}`, { method:'PUT', body:JSON.stringify({ baseRevision:record.revision || 0, mutationId:crypto.randomUUID(), deleted:!!record.deleted, data:payload }) });
    if (epoch !== ticket) throw new Error('The account changed. Please sign in again.');
    records.set(keyOf(response.record),response.record);
    document.dispatchEvent(new CustomEvent('dmz-diving-record-changed',{detail:{kind:record.kind}}));
    return response.record;
  }
  function field(label,name,value = '',type = 'text',extra = '') {
    return `<label>${label}<input aria-label="${esc(label)}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  }
  function editComponent(itemId,index){
    const row=records.get(`gear/${itemId}`),part=row?.data.components?.[index];if(!part)return;
    dialog.innerHTML=`<h3 id="diving-editor-title">${esc(part.name||'Equipment part')}</h3><form class="diving-form">${field('Part name','name',part.name,'text','required')}${field('Part type','type',part.type)}${field('Manufacturer','manufacturer',part.manufacturer)}${field('Model','model',part.model)}${field('Serial number','serialNumber',part.serialNumber)}${select('Condition','condition',part.condition||'Ready',['Ready','Needs attention','Out of service','Retired'])}${field('Last service','lastServiceDate',part.lastServiceDate,'date')}${field('Next service','nextServiceDate',part.nextServiceDate,'date')}${field('Service interval (months)','serviceIntervalMonths',part.serviceIntervalMonths,'number','min="0" max="120"')}${field('Visual inspection due','visualInspectionDue',part.visualInspectionDue,'date')}${field('Hydrostatic test due','hydrostaticTestDue',part.hydrostaticTestDue,'date')}<p class="diving-status wide" role="status" data-part-status></p><div class="diving-actions wide"><button type="button" class="btn secondary" data-part-cancel>Cancel</button><button type="submit" class="btn primary">Save part</button></div></form>`;
    dialog.querySelector('[data-part-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=async(event)=>{
      event.preventDefault();const form=event.currentTarget,values=Object.fromEntries(new FormData(form)),data={...row.data,components:row.data.components.map((entry,i)=>i===index?{...entry,...values,serviceIntervalMonths:values.serviceIntervalMonths||''}:entry)};
      form.querySelector('[type="submit"]').disabled=true;
      try{await save({...row,data});dialog.close();render('gear');status('Component and service details saved.');}catch(error){dialog.querySelector('[data-part-status]').textContent=error.status===409?'This item changed elsewhere. Close and refresh before editing this part again.':error.message;form.querySelector('[type="submit"]').disabled=false;}
    };dialog.showModal();
  }
  function select(label,name,value,choices) {
    return `<label>${label}<select aria-label="${esc(label)}" name="${name}">${choices.map((v) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v || 'Not set')}</option>`).join('')}</select></label>`;
  }
  function edit(kind,id) {
    if (!loaded) { status('Wait for your records to load before making changes.',true); return; }
    const record = id ? records.get(`${kind}/${id}`) : { kind,id:crypto.randomUUID(),revision:0,data:{ createdAt:new Date().toISOString() } };
    if (!record) return;
    dialogRecord = structuredClone(record);
    const d = record.data, log = kind === 'dive', setup = kind === 'setup';
    let fields;
    if (log) {
      const t = d.startTime ? new Date(d.startTime) : new Date();
      const localDate = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0,16);
      fields = field('Dive site','site',d.site?.name,'text','required maxlength="160"') + field('Location','location',d.site?.location,'text','maxlength="160"') + field('Date & time (your time zone)','startTime',localDate,'datetime-local','required') + field('Dive number','number',d.number,'number','min="0" max="100000" step="1"') + field('Duration (minutes)','duration',d.durationSeconds ? d.durationSeconds / 60 : '', 'number','min="0" max="1440" step="any" required') + field('Maximum depth (meters)','maxDepth',d.water?.maxDepthMeters,'number','min="0" max="350" step="any" required') + field('Average depth (meters)','avgDepth',d.water?.avgDepthMeters,'number','min="0" max="350" step="any"') + field('Water temperature (°C)','temperature',d.water?.tempMinC,'number','min="-10" max="60" step="any"') + field('Buddies (comma separated)','buddies',(d.buddies || []).join(', '),'text','maxlength="500"') + select('Rating','rating',String(d.rating || ''),['','1','2','3','4','5']);
    } else if (setup) {
      fields = field('Setup name','name',d.name,'text','required maxlength="120"') + select('Setup type','type',d.type || 'Single tank',['Single tank','Doubles','Sidemount','Pony / bailout','Stage / deco','Rebreather','Freedive','Travel','Custom']) + `<label class="wide">Description<textarea name="description" maxlength="2000">${esc(d.description)}</textarea></label><fieldset class="wide"><legend>Equipment in this setup</legend>${all('gear').map((r) => `<label class="diving-check"><input type="checkbox" name="itemIds" value="${esc(r.id)}" ${(d.itemIds || []).includes(r.id) ? 'checked' : ''}>${esc(r.data.name)}</label>`).join('') || '<p>Add equipment to your locker first.</p>'}</fieldset>`;
    } else {
      fields = field('Item name','name',d.name,'text','required maxlength="160"') + select('Category','category',d.category || 'Accessories',categories) + field('Manufacturer','manufacturer',d.manufacturer) + field('Model','model',d.model) + field('Serial number','serialNumber',d.serialNumber) + select('Condition','condition',d.condition || 'Ready',['Ready','Needs attention','Out of service','Retired']) + field('Last service','lastServiceDate',d.lastServiceDate,'date') + field('Next service','nextServiceDate',d.nextServiceDate,'date') + field('Visual inspection due','visualInspectionDue',d.visualInspectionDue,'date') + field('Hydrostatic test due','hydrostaticTestDue',d.hydrostaticTestDue,'date') + `<label class="wide">Service notes<textarea name="serviceNotes" maxlength="10000">${esc(d.serviceNotes)}</textarea></label>`;
    }
    dialog.innerHTML = `<h3 id="diving-editor-title">${id ? 'Edit' : 'Add'} ${log ? 'dive' : setup ? 'setup' : 'equipment'}</h3><form class="diving-form">${fields}${setup ? '' : `<label class="wide">Notes<textarea name="notes" maxlength="20000">${esc(d.notes)}</textarea></label>`}<p class="wide diving-status" role="status" data-editor-status></p><div class="wide diving-actions"><button class="btn secondary" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">Save to account</button></div></form>`;
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.querySelectorAll('textarea').forEach((el) => el.setAttribute('aria-label', el.name === 'serviceNotes' ? 'Service notes' : el.name === 'notes' ? 'Notes' : 'Description'));
    dialog.querySelector('form').onsubmit = submitEditor;
    dialog.showModal();
  }
  async function submitEditor(event) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form), record = dialogRecord;
    const v = (name) => String(values.get(name) || '').trim();
    const n = (name) => v(name) === '' ? null : Number(v(name));
    let data = { ...record.data };
    if (record.kind === 'dive') {
      if (n('avgDepth') != null && n('avgDepth') > n('maxDepth')) { form.querySelector('[data-editor-status]').textContent = 'Average depth cannot exceed maximum depth.'; return; }
      data = { ...data, schemaVersion:2, source:data.source || 'manual', site:{ ...data.site,name:v('site'),location:v('location') }, number:n('number'), startTime:new Date(v('startTime')).toISOString(), durationSeconds:n('duration') * 60,
        water:{ ...data.water,maxDepthMeters:n('maxDepth'),avgDepthMeters:n('avgDepth'),tempMinC:n('temperature') }, buddies:v('buddies').split(',').map((s) => s.trim()).filter(Boolean), rating:n('rating'),notes:v('notes') };
    } else if (record.kind === 'setup') data = { ...data,name:v('name'),type:v('type'),description:v('description'),itemIds:values.getAll('itemIds') };
    else for (const field of ['name','category','manufacturer','model','serialNumber','condition','lastServiceDate','nextServiceDate','visualInspectionDue','hydrostaticTestDue','serviceNotes','notes']) data[field] = v(field);
    const controls = [...form.querySelectorAll('button,input,select,textarea')]; controls.forEach((c) => { c.disabled = true; });
    const message = form.querySelector('[data-editor-status]'); message.textContent = 'Saving…';
    try {
      const saved = await save({ ...record,data });
      ui[record.kind === 'dive' ? 'logbook' : 'gear'].selected = saved.id;
      dialog.close(); render('logbook'); render('gear'); status('Saved to your account. The app will pick up this change on its next sync.');
    } catch (error) {
      message.classList.add('is-error');
      message.textContent = error.status === 409 ? 'This record changed elsewhere. Your draft is still here. Copy any changes you want to keep, then cancel and refresh to review the newer version.' : error.message;
    } finally { controls.forEach((c) => { c.disabled = false; }); }
  }
  async function remove(kind,id) {
    const row = records.get(`${kind}/${id}`); if (!row || !window.confirm('Delete this record from your account and synced devices?')) return;
    try { await save({ ...row,deleted:true }); render('logbook'); render('gear'); status('Record deleted. The deletion will sync to your app.'); }
    catch (error) { status(error.message,true); }
  }
  async function exportCsv() {
    if (!loaded) return;
    const columns = ['id','number','start_time','site','location','country','latitude','longitude','duration_minutes','max_depth_m','avg_depth_m','min_temp_c','visibility_m','dive_mode','gas','buddies','operator','rating','tags','notes'];
    const quote = (value) => `"${String(value ?? '').replace(/"/g,'""')}"`;
    const rows = (ui.logbook.visibleIds||[]).map((id)=>records.get(`dive/${id}`)).filter(Boolean).map(({ data:d }) => [d.id,d.number,d.startTime,d.site?.name,d.site?.location,d.site?.country,d.site?.latitude,d.site?.longitude,number(d.durationSeconds)/60,d.water?.maxDepthMeters,d.water?.avgDepthMeters,d.water?.tempMinC,d.water?.visibilityMeters,d.diveMode,(d.gas?.mixes||[]).map((m)=>m.label).join('; '),(d.buddies||[]).join('; '),d.operator,d.rating,(d.tags||[]).join('; '),d.notes]);
    const blob = new Blob([[columns,...rows].map((row)=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url; link.download=`dmz-logbook-${new Date().toISOString().slice(0,10)}.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); status('Your spreadsheet-ready CSV export is ready.');
  }
  async function exportData(view) {
    if (!loaded) return;
    const ticket = epoch;
    if (view === 'logbook') {
      status('Preparing your logbook export…');
      const ids = [...new Set(all('dive').flatMap((r) => [...(r.data.logIds || []),r.data.primaryLogId].filter(Boolean)))];
      for (const id of ids) {
        if (epoch !== ticket) return;
        if (!records.has(`computerLog/${id}`)) {
          const row = (await request(`/api/account/sync/computerLog/${encodeURIComponent(id)}`)).record;
          if (epoch !== ticket) return;
          records.set(keyOf(row),row);
        }
      }
    }
    const kinds = view === 'logbook' ? ['dive','computerLog'] : ['gear','setup'];
    const blob = new Blob([JSON.stringify({ format:'dmz-account-records',version:1,exportedAt:new Date().toISOString(), note:'Record export including synced computer profiles. Device photos and attachments are not included.',records:[...records.values()].filter((r) => kinds.includes(r.kind) && !r.deleted) },null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `dmz-${view}-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    status('Your record export is ready.');
  }
  shell('logbook'); shell('gear'); render('logbook'); render('gear');
  window.addEventListener('resize', () => {
    const narrow = window.matchMedia('(max-width: 760px)').matches;
    Object.entries(panels).forEach(([view, panel]) => panel.querySelector('.diving-layout')?.classList.toggle('is-mobile-detail', narrow && ui[view].mobileDetail));
  }, { passive:true });
  window.DMZDiving = {
    connect(options) {
      request = options.request;
      const next = options.account?.profile?.userId;
      if (next !== userId) { epoch++; userId = next; pendingWorkspace=window.DMZWorkspace?.read(userId,'diving'); for(const view of Object.keys(ui))ui[view]=structuredClone(defaultUi[view]); records.clear(); loaded = false; loading = null; imperial = options.account?.appSettings?.depthUnit === 'ft'; panels.logbook.querySelector('[data-units]').value = imperial ? 'imperial' : 'metric'; render('logbook'); render('gear'); }
    },
    open(view) { active = view; load(); },
    disconnect() { disposeProfile?.(); disposeProfile=null; epoch++; userId = null; request = null; loaded = false; loading = null; records.clear(); dialog.close(); dialog.innerHTML = ''; dialogRecord = null; render('logbook'); render('gear'); status('Sign in to load your records.'); },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && userId && loaded && !dialog.open) load(true); });
  window.setInterval(() => {
    if (!document.hidden && userId && loaded && !dialog.open && !panels[active].closest('[data-account-view-panel]').hidden) load(true);
  }, 120000);
})();
