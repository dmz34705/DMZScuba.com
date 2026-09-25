(() => {
  'use strict';
  const panels = { logbook: document.querySelector('[data-diving-logbook]'), gear: document.querySelector('[data-diving-gear]') };
  if (!panels.logbook || !panels.gear) return;
  const categories = ['Exposure suit','Undergarment','BCD','Regulator','Cylinder / tank','Fins','Boots','Hood','Gloves','Weights','Mask','Snorkel','Dive computer','Transmitter','Gauges / compass','Lights','Camera','Cutting / signaling','Surface safety','Rebreather','DPV / scooter','Bags / storage','Spare parts','Accessories'];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const number = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const date = (v) => !v || Number.isNaN(new Date(v).getTime()) ? 'No date' : new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  const keyOf = (r) => `${r.kind}/${r.id}`;
  let request, userId, epoch = 0, loaded = false, loading = null, records = new Map(), active = 'logbook';
  const ui = { logbook: { search:'', filter:'', sort:'newest', selected:null }, gear: { search:'', filter:'', sort:'name', selected:null, setup:'' } };
  let imperial = false, dialogRecord = null;
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
      <div class="diving-stats" data-stats></div><p class="diving-status" role="status" data-sync-status>Sign in to load your records.</p>
      ${log ? '' : '<div class="diving-setups" data-setups aria-label="Gear setups"></div>'}
      <div class="diving-toolbar"><input type="search" aria-label="${log ? 'Search dives' : 'Search gear'}" placeholder="${log ? 'Search sites, buddies, notes…' : 'Search equipment, model, serial…'}" data-search>
      <select aria-label="${log ? 'Dive source' : 'Gear category'}" data-filter><option value="">${log ? 'All dives' : 'All categories'}</option>${(log ? ['manual','computer','import','mixed'] : categories).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>
      <select aria-label="Sort records" data-sort>${(log ? [['newest','Newest first'],['oldest','Oldest first'],['deepest','Deepest first']] : [['name','Name A–Z'],['service','Service due'],['newest','Recently added']]).map(([v,t]) => `<option value="${v}">${t}</option>`).join('')}</select>
      ${log ? '<select aria-label="Display units" data-units><option value="metric">Meters / °C</option><option value="imperial">Feet / °F</option></select>' : ''}
      <button class="btn secondary" data-refresh>Refresh</button><button class="btn secondary" data-export>Export</button></div>
      <div class="diving-layout"><div class="diving-list" data-list aria-label="${log ? 'Dives' : 'Equipment'}"></div><div class="diving-detail" data-detail></div></div>
      <p class="diving-footnote">App changes appear after sync succeeds. Photos and documents remain on your device in this version.</p>`;
    const panel = panels[view];
    panel.querySelector('[data-search]').addEventListener('input', (e) => { ui[view].search = e.target.value; render(view); });
    for (const prop of ['filter','sort']) panel.querySelector(`[data-${prop}]`).addEventListener('change', (e) => { ui[view][prop] = e.target.value; render(view); });
    panel.querySelector('[data-units]')?.addEventListener('change', (e) => { imperial = e.target.value === 'imperial'; render(view); });
    panel.addEventListener('click', (e) => {
      const button = e.target.closest('button'); if (!button || !userId) return;
      if (button.hasAttribute('data-refresh')) load(true);
      if (button.hasAttribute('data-add')) edit(button.dataset.add);
      if (button.hasAttribute('data-select')) { ui[view].selected = button.dataset.select; render(view); }
      if (button.hasAttribute('data-edit')) edit(button.dataset.edit, button.dataset.id);
      if (button.hasAttribute('data-delete')) remove(button.dataset.delete, button.dataset.id);
      if (button.hasAttribute('data-setup')) { ui.gear.setup = button.dataset.setup; ui.gear.selected = null; render('gear'); }
      if (button.hasAttribute('data-export')) exportData(view).catch((error) => status(error.message,true));
    });
    panel.addEventListener('change', async (e) => {
      if (!e.target.matches('[data-pack]') || !userId) return;
      const setup = records.get(`setup/${ui.gear.setup}`); if (!setup) return;
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
    if (['Out of service','Retired'].includes(item.condition)) return { label:item.condition, tone:'blocked' };
    if (item.condition === 'Needs attention' || (item.components || []).some((c) => ['Needs attention','Out of service'].includes(c.condition))) return { label:'Needs attention', tone:'attention' };
    const due = dueFor(item), days = due ? (new Date(`${due}T23:59:59`) - new Date()) / 86400000 : Infinity;
    return days < 0 ? { label:'Service overdue', tone:'blocked' } : days < 30 ? { label:'Service due soon', tone:'attention' } : { label:item.condition || 'Ready', tone:'' };
  }
  function render(view) {
    const panel = panels[view], log = view === 'logbook', state = ui[view];
    const values = all(log ? 'dive' : 'gear');
    panel.querySelector('[data-stats]').innerHTML = log
      ? stat(values.length, 'Logged dives') + stat(`${(values.reduce((n,r) => n + number(r.data.durationSeconds),0) / 3600).toFixed(1)} h`, 'Time underwater') + stat(values.length ? depth(Math.max(...values.map((r) => number(r.data.water?.maxDepthMeters)))) : '—', 'Deepest dive')
      : stat(values.length, 'Items in your locker') + stat(all('setup').length, 'Saved setups') + stat(values.filter((r) => gearStatus(r.data).tone).length, 'Need attention');
    if (!log) panel.querySelector('[data-setups]').innerHTML = `<button data-setup="" aria-pressed="${!state.setup}">All equipment</button>` + all('setup').map((r) => `<button data-setup="${esc(r.id)}" aria-pressed="${r.id === state.setup}">${esc(r.data.name)}</button>`).join('') + '<button data-add="setup">+ New setup</button>';
    let shown = values.filter((r) => {
      const d = r.data;
      const text = log ? [d.site?.name,d.site?.location,d.notes,...(d.buddies || [])] : [d.name,d.category,d.manufacturer,d.model,d.serialNumber];
      const setup = records.get(`setup/${state.setup}`);
      return (!state.filter || (log ? d.source : d.category) === state.filter) && text.join(' ').toLowerCase().includes(state.search.toLowerCase()) && (log || !setup || (setup.data.itemIds || []).includes(r.id));
    });
    shown.sort((a,b) => log
      ? state.sort === 'deepest' ? number(b.data.water?.maxDepthMeters) - number(a.data.water?.maxDepthMeters) : String(a.data.startTime || '').localeCompare(String(b.data.startTime || '')) * (state.sort === 'oldest' ? 1 : -1)
      : state.sort === 'service' ? (dueFor(a.data) || '9999').localeCompare(dueFor(b.data) || '9999') : state.sort === 'newest' ? String(b.data.createdAt || '').localeCompare(String(a.data.createdAt || '')) : String(a.data.name || '').localeCompare(String(b.data.name || '')));
    if (!shown.some((r) => r.id === state.selected)) state.selected = shown[0]?.id || null;
    panel.querySelector('[data-list]').innerHTML = shown.map((r) => {
      const d = r.data, condition = log ? null : gearStatus(d);
      return `<button class="diving-entry" data-select="${esc(r.id)}" aria-pressed="${r.id === state.selected}"><small>${log ? `${d.number != null ? `#${esc(d.number)} · ` : ''}${esc(date(d.startTime))}` : esc(d.category)}</small><strong>${esc(log ? d.site?.name || 'Untitled dive' : d.name || 'Unnamed gear')}</strong><span class="diving-entry-meta">${log ? `<span>${esc(depth(d.water?.maxDepthMeters))}</span><span>${esc(duration(d.durationSeconds))}</span><span>${esc(d.gas?.mixes?.[0]?.label || '')}</span>` : `<span class="diving-badge ${condition.tone}">${esc(condition.label)}</span><span>${esc(d.manufacturer || '')}</span>`}</span></button>`;
    }).join('') || `<div class="diving-empty"><h3>${values.length ? 'No matching records' : log ? 'Your next chapter starts here' : 'Build your gear locker'}</h3><p>${values.length ? 'Try a different search or filter.' : log ? 'Sign in on the app to sync your dives, or log your first dive here.' : 'Sync equipment from the app, or add your first item here.'}</p></div>`;
    const selected = shown.find((r) => r.id === state.selected);
    if (selected) detail(view, selected);
    else panel.querySelector('[data-detail]').innerHTML = !log && state.setup ? setupDetail(records.get(`setup/${state.setup}`)) : `<div class="diving-empty"><h3>${loaded ? 'Ready when you are' : 'Loading your account'}</h3><p>${loaded ? 'Select a record to explore its details.' : 'Your records will appear here after loading.'}</p></div>`;
  }
  const pair = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value || '—')}</dd></div>`;
  function setupDetail(record) {
    if (!record) return '';
    const d = record.data;
    return `<h4>${esc(d.name)} · ${esc(d.type)}</h4><p>${esc(d.description)}</p><div class="diving-actions"><button class="btn secondary" data-edit="setup" data-id="${esc(record.id)}">Edit setup</button><button class="btn secondary diving-danger" data-delete="setup" data-id="${esc(record.id)}">Delete setup</button></div>` + (d.itemIds || []).map((id) => {
      const gear = records.get(`gear/${id}`); if (!gear || gear.deleted) return '';
      return `<label class="diving-check"><input type="checkbox" data-pack="${esc(id)}" ${(d.checkedIds || []).includes(id) ? 'checked' : ''}>${esc(gear.data.name)}</label>`;
    }).join('');
  }
  async function detail(view, record) {
    const d = record.data, log = view === 'logbook', container = panels[view].querySelector('[data-detail]');
    container.innerHTML = `<span class="diving-badge">${esc(log ? (d.source || 'manual') + ' dive' : d.category)}</span><h3>${esc(log ? d.site?.name || 'Untitled dive' : d.name)}</h3><p>${esc(log ? [d.site?.location,d.site?.country].filter(Boolean).join(', ') : [d.manufacturer,d.model].filter(Boolean).join(' · '))}</p>
      <div class="diving-actions"><button class="btn secondary" data-edit="${record.kind}" data-id="${esc(record.id)}">Edit ${log ? 'dive' : 'item'}</button><button class="btn secondary diving-danger" data-delete="${record.kind}" data-id="${esc(record.id)}">Delete</button></div>
      <dl>${log ? pair('Date',date(d.startTime)) + pair('Dive time',duration(d.durationSeconds)) + pair('Maximum depth',depth(d.water?.maxDepthMeters)) + pair('Average depth',depth(d.water?.avgDepthMeters)) + pair('Water temperature',temp(d.water?.tempMinC)) + pair('Gas',(d.gas?.mixes || []).map((m) => m.label).join(', ')) + pair('Buddies',(d.buddies || []).join(', ')) + pair('Rating',d.rating ? `${d.rating} / 5` : '') : pair('Condition',d.condition) + pair('Serial number',d.serialNumber) + pair('Next service',dueFor(d) ? date(dueFor(d)) : 'Not set') + pair('Last service',d.lastServiceDate ? date(d.lastServiceDate) : '') + pair('Configuration',d.configuration) + pair('Purchased',d.purchaseDate ? date(d.purchaseDate) : '')}</dl>
      ${log ? '<div data-profile-chart></div>' : (d.components?.length ? `<h4>Assembly components</h4><ul class="diving-components">${d.components.map((c) => `<li><strong>${esc(c.name || c.type)}</strong><small>${esc([c.manufacturer,c.model,c.serialNumber].filter(Boolean).join(' · '))}</small><small>${esc(c.condition || 'Ready')}${dueFor(c) ? ` · Due ${esc(date(dueFor(c)))}` : ''}</small></li>`).join('')}</ul>` : '')}
      ${d.notes ? `<h4>${log ? 'Dive notes' : 'Equipment notes'}</h4><p class="diving-notes">${esc(d.notes)}</p>` : ''}
      ${!log && d.serviceNotes ? `<h4>Service notes</h4><p class="diving-notes">${esc(d.serviceNotes)}</p>` : ''}
      ${!log && ui.gear.setup ? setupDetail(records.get(`setup/${ui.gear.setup}`)) : ''}`;
    if (log) {
      const chart = container.querySelector('[data-profile-chart]'), ticket = epoch;
      const logId = d.primaryLogId || d.logIds?.[0];
      if (!logId) { chart.innerHTML = '<p>No computer profile attached to this dive.</p>'; return; }
      chart.textContent = 'Loading computer profile…';
      try {
        let computer = records.get(`computerLog/${logId}`);
        if (!computer) { computer = (await request(`/api/account/sync/computerLog/${encodeURIComponent(logId)}`)).record; if (epoch !== ticket) return; records.set(keyOf(computer),computer); }
        if (!chart.isConnected || epoch !== ticket) return;
        chart.innerHTML = profileChart(computer.data.profile?.samples || []);
      } catch { if (chart.isConnected && epoch === ticket) chart.textContent = 'The computer profile could not load. Refresh to try again.'; }
    }
  }
  function profileChart(samples) {
    const points = samples.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.depth) && p.t >= 0 && p.depth >= 0);
    if (points.length < 2) return '<p>No depth samples available.</p>';
    const maxT = Math.max(1,...points.map((p) => p.t)), maxD = Math.max(1,...points.map((p) => p.depth));
    const step = Math.max(1, Math.ceil(points.length / 600));
    const xy = points.filter((_,i) => i % step === 0 || i === points.length - 1).map((p) => `${(45 + p.t / maxT * 470).toFixed(1)},${(24 + p.depth / maxD * 145).toFixed(1)}`).join(' ');
    return `<h4>Computer depth profile</h4><svg class="diving-chart" viewBox="0 0 550 215" role="img" aria-label="Dive depth profile, maximum ${esc(depth(maxD))}, duration ${esc(duration(maxT))}"><path d="M45 24H520M45 96H520M45 169H520" stroke="#294357" fill="none"/><polygon points="45,24 ${xy} 515,24" fill="#205563" opacity=".6"/><polyline points="${xy}" fill="none" stroke="#78e3d7" stroke-width="2"/><g fill="#a5bfd2" font-size="10" font-family="sans-serif"><text x="8" y="28">0</text><text x="3" y="174">${esc(depth(maxD))}</text><text x="45" y="198">0 min</text><text x="460" y="198">${esc(duration(maxT))}</text></g></svg>`;
  }
  async function load(force = false) {
    if (!request || !userId || loading || (loaded && !force)) return;
    const ticket = epoch;
    status('Loading your diving records…');
    const task = (async () => {
      // Records arrive with their data, a page at a time; any row without data (an older service) is fetched on its own.
      let after = ''; const manifest = [];
      do { const page = await request(`/api/account/sync?include=dive,gear,setup${after ? `&after=${encodeURIComponent(after)}` : ''}`); if (epoch !== ticket) return; manifest.push(...page.records); after = page.next; } while (after);
      const next = new Map(); const live = manifest.filter((r) => ['dive','gear','setup'].includes(r.kind) && !r.deleted);
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
      render('logbook'); render('gear'); status(`Account records refreshed at ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}.`);
    })().catch((error) => { if (epoch === ticket) status(error.message || 'Records could not load. Try Refresh.', true); }).finally(() => { if (loading === task) loading = null; });
    loading = task; return task;
  }
  async function save(record) {
    const ticket = epoch;
    const payload = { ...record.data, id:record.id, updatedAt:new Date().toISOString() };
    const response = await request(`/api/account/sync/${record.kind}/${encodeURIComponent(record.id)}`, { method:'PUT', body:JSON.stringify({ baseRevision:record.revision || 0, mutationId:crypto.randomUUID(), deleted:!!record.deleted, data:payload }) });
    if (epoch !== ticket) throw new Error('The account changed. Please sign in again.');
    records.set(keyOf(response.record),response.record);
    return response.record;
  }
  function field(label,name,value = '',type = 'text',extra = '') {
    return `<label>${label}<input aria-label="${esc(label)}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
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
  async function exportData(view) {
    if (!loaded) return;
    const ticket = epoch;
    if (view === 'logbook') {
      status('Preparing your logbook export…');
      const ids = [...new Set(all('dive').flatMap((r) => r.data.logIds || []))];
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
  window.DMZDiving = {
    connect(options) {
      request = options.request;
      const next = options.account?.profile?.userId;
      if (next !== userId) { epoch++; userId = next; records.clear(); loaded = false; loading = null; imperial = options.account?.appSettings?.depthUnit === 'ft'; panels.logbook.querySelector('[data-units]').value = imperial ? 'imperial' : 'metric'; render('logbook'); render('gear'); }
    },
    open(view) { active = view; load(); },
    disconnect() { epoch++; userId = null; request = null; loaded = false; loading = null; records.clear(); dialog.close(); dialog.innerHTML = ''; dialogRecord = null; render('logbook'); render('gear'); status('Sign in to load your records.'); },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && userId && loaded && !dialog.open) load(true); });
  window.setInterval(() => {
    if (!document.hidden && userId && loaded && !dialog.open && !panels[active].closest('[data-account-view-panel]').hidden) load(true);
  }, 30000);
})();
