(() => {
  const frame = document.getElementById('oceanAtlasFrame');
  if (!frame) return;
  const tokenKey = 'dmzCustomerAccessToken';
  const signedInKey = 'dmzCustomerSignedIn';
  const preferencesKey = 'dmzOceanAtlasPreferencesV1';
  const adviceKey = 'dmzOceanAtlasWebAdviceV1';
  const gearDialog = document.getElementById('atlasGearDialog');
  const gearContent = gearDialog?.querySelector('[data-atlas-gear-content]');
  // Last "Get me here" or located start, for personal travel ratings; kept in this browser only.
  const originKey = 'dmzOceanAtlasOriginV1';
  const journeyDialog = document.getElementById('atlasJourneyDialog');
  const journeyContent = journeyDialog?.querySelector('[data-atlas-journey-content]');
  const journeyEngineUrl = '/js/ocean-atlas-journey-engine.js?v=20260924-journey1';
  const areaShortcuts = {
    cozumel: { regionId: 'caribbean-gulf', areaName: 'Cozumel' },
    floridakey: { regionId: 'caribbean-gulf', areaName: 'Florida Keys' },
    roatan: { regionId: 'caribbean-gulf', areaName: 'Bay Islands' },
    california: { regionId: 'pacific-north-america', areaName: 'Channel Islands' },
    thailand: { regionId: 'southeast-asia', latitude: 8.6, longitude: 97.6, zoom: 7 },
    playa: { regionId: 'caribbean-gulf', latitude: 20.6, longitude: -87.1, zoom: 8 },
    greatlakesLM: { query: 'Lake Michigan', zoom: 7 },
    haigh: { query: 'Haigh Quarry', zoom: 10 },
    mermet: { query: 'Mermet Springs', zoom: 10 },
    gilboa: { query: 'Gilboa Quarry', zoom: 10 },
  };
  let ready = false;
  let token = '';
  let refreshPromise = null;
  let gearPlan = null;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const monthName = (index) => new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' });
  const fahrenheit = (celsius) => celsius == null ? null : Math.round(celsius * 9 / 5 + 32);
  function advicePreferences() {
    try { return JSON.parse(localStorage.getItem(adviceKey) || '{}') || {}; }
    catch { return {}; }
  }
  function updateAdvicePreferences(value) {
    try { localStorage.setItem(adviceKey, JSON.stringify(value)); } catch (_) { /* optional */ }
    atlas()?.DMZTravelAtlas?.setAdvicePreferences(value);
  }

  const atlas = () => frame.contentWindow;
  const receive = (message) => { if (ready) atlas()?.atlasReceive?.(message); };
  const validCoordinate = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

  function groupDivePins(dives) {
    const groups = new Map();
    let missingCount = 0;
    for (const dive of dives) {
      const rawLat = dive.site?.latitude, rawLon = dive.site?.longitude;
      const lat = rawLat == null || rawLat === '' ? NaN : Number(rawLat);
      const lon = rawLon == null || rawLon === '' ? NaN : Number(rawLon);
      if (!validCoordinate(lat, lon) || dive.deletedAt) { missingCount++; continue; }
      const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      const group = groups.get(key) || { id: `log-${key}`, latitude: lat, longitude: lon,
        name: dive.site?.name || 'Logged dive location', dives: [] };
      group.dives.push({ id: dive.id, name: dive.site?.name || 'Untitled dive', startTime: dive.startTime,
        number: dive.number, maxDepthMeters: dive.water?.maxDepthMeters ?? null,
        durationSeconds: dive.durationSeconds ?? null });
      groups.set(key, group);
    }
    return { pins: [...groups.values()].map((group) => ({ ...group, dives: group.dives.sort((a, b) =>
      String(b.startTime || '').localeCompare(String(a.startTime || ''))) })), missingCount };
  }

  async function refreshToken() {
    if (!refreshPromise) refreshPromise = fetch('/api/account/auth/refresh', {
      method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' },
    }).then(async (response) => {
      if (!response.ok) return '';
      const data = await response.json().catch(() => ({}));
      return String(data.accessToken || '');
    }).catch(() => '').finally(() => { refreshPromise = null; });
    token = await refreshPromise;
    if (token) sessionStorage.setItem(tokenKey, token);
    return token;
  }

  async function accountGet(path, retry = true) {
    const response = await fetch(path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      credentials: 'same-origin' });
    if (response.status === 401 && retry && await refreshToken()) return accountGet(path, false);
    if (!response.ok) throw new Error(`Account data unavailable (${response.status}).`);
    return response.json();
  }

  async function loadPersonalDives() {
    try {
      token = sessionStorage.getItem(tokenKey) || '';
      if (!token && localStorage.getItem(signedInKey) === '1') token = await refreshToken();
      if (!token) { receive({ type: 'logs', status: 'ready', pins: [], missingCount: 0 }); return; }
      const metas = [];
      let after = '';
      do {
        const page = await accountGet(`/api/account/sync${after ? `?after=${encodeURIComponent(after)}` : ''}`);
        metas.push(...(page.records || []).filter((row) => row.kind === 'dive' && !row.deleted));
        after = page.next || '';
      } while (after);
      const dives = [];
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(6, metas.length) }, async () => {
        while (index < metas.length) {
          const meta = metas[index++];
          const result = await accountGet(`/api/account/sync/dive/${encodeURIComponent(meta.id)}`);
          if (result.record && !result.record.deleted) dives.push(result.record.data);
        }
      }));
      receive({ type: 'logs', status: 'ready', ...groupDivePins(dives) });
    } catch (error) {
      console.warn('[Ocean Atlas] Personal dives could not load:', error.message);
      receive({ type: 'logs', status: 'error', pins: [] });
    }
  }

  async function loadGearRecords() {
    token = sessionStorage.getItem(tokenKey) || token;
    if (!token && localStorage.getItem(signedInKey) === '1') token = await refreshToken();
    if (!token) return { items: [], setups: [], signedIn: false };
    const metas = [];
    let after = '';
    do {
      const page = await accountGet(`/api/account/sync${after ? `?after=${encodeURIComponent(after)}` : ''}`);
      metas.push(...(page.records || []).filter((row) => ['gear', 'setup'].includes(row.kind) && !row.deleted));
      after = page.next || '';
    } while (after);
    const items = [], setups = [];
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(6, metas.length) }, async () => {
      while (index < metas.length) {
        const meta = metas[index++];
        const result = await accountGet(`/api/account/sync/${meta.kind}/${encodeURIComponent(meta.id)}`);
        const row = result.record;
        if (!row || row.deleted || !row.data) continue;
        (meta.kind === 'gear' ? items : setups).push({ ...row.data, id: row.id || meta.id });
      }
    }));
    return { items, setups, signedIn: true };
  }

  function renderGearPlan() {
    if (!gearPlan || !gearContent) return;
    const engine = window.DMZAtlasGuideEngine;
    const { context, data, error } = gearPlan;
    const preferences = advicePreferences();
    const threshold = Number.isFinite(preferences.drysuitBelowC) ? fahrenheit(preferences.drysuitBelowC) : 60;
    const depth = gearPlan.depth === '' ? null : Number(gearPlan.depth);
    const bottom = gearPlan.bottom === '' ? null : Number(gearPlan.bottom);
    const invalid = (depth != null && (!Number.isFinite(depth) || depth < 0 || depth > 984))
      || (bottom != null && (!Number.isFinite(bottom) || bottom < 28 || bottom > 104));
    const plan = { ...context, use: gearPlan.use,
      depthMeters: depth == null || invalid ? null : depth / 3.28084,
      bottomTemperatureC: bottom == null || invalid ? null : (bottom - 32) * 5 / 9,
      longDive: gearPlan.longDive };
    const result = !invalid && engine ? engine.recommend(data?.items || [], data?.setups || [], preferences, plan) : null;
    const explanation = result?.advice?.reasons || [];
    gearContent.innerHTML = `
      <p class="atlas-gear-intro"><strong>${escapeHtml(context.name)}</strong> · ${monthName(context.month)} · ${context.temperatureC == null
        ? 'Water temperature unavailable' : `${fahrenheit(context.temperatureC)}°F estimated surface water`}${context.broad ? ' · Broad location estimate' : ''}</p>
      <div class="atlas-gear-grid">
        <label>Planned dive type<select data-gear-field="use"><option value="">Choose a dive type</option>${['Open water', 'Technical', 'Overhead', 'Freedive'].map((value) =>
          `<option value="${value}" ${gearPlan.use === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>Planned depth · ft (optional)<input data-gear-field="depth" type="number" min="0" max="984" value="${escapeHtml(gearPlan.depth)}"></label>
        <label>Expected bottom temperature · °F (optional)<input data-gear-field="bottom" type="number" min="28" max="104" value="${escapeHtml(gearPlan.bottom)}"></label>
        <label class="atlas-gear-check"><input data-gear-field="longDive" type="checkbox" ${gearPlan.longDive ? 'checked' : ''}> Long or repetitive dive</label>
      </div>
      <p class="atlas-gear-note">Depth and bottom temperature refine the starting point. Check actual conditions with your dive operator.</p>
      <div class="atlas-gear-card"><span class="travel-section-kicker">Exposure starting point</span>
        <h3>${escapeHtml(result?.advice?.label || (invalid ? 'Check your planned conditions' : 'Planning…'))}</h3>
        <p>${escapeHtml(result?.advice?.temperatureBasis || '')}</p>
        ${explanation.map((reason) => `<p>${escapeHtml(reason)}</p>`).join('')}</div>
      <details class="atlas-gear-preferences"><summary>Your comfort preferences</summary>
        <p>These browser preferences stay on this device. The app’s separate preferences do not sync to your account yet.</p>
        <label>How you feel in the water<select data-gear-field="tendency">${[['cold', 'I run cold'], ['typical', 'Typical'], ['warm', 'I run warm']]
          .map(([value, label]) => `<option value="${value}" ${(preferences.thermalTendency || 'typical') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Prefer a drysuit below · °F<input data-gear-field="threshold" type="number" min="28" max="104" value="${threshold}"></label>
      </details>
      <div class="atlas-gear-locker"><h3>From your Gear Locker</h3>
        ${data == null && !error ? '<p>Loading your saved equipment and setups…</p>' : ''}
        ${error ? `<p class="atlas-gear-warning">${escapeHtml(error)}</p>` : ''}
        ${data && !data.signedIn ? '<p><a href="/pages/account/#gear">Sign in</a> to match this dive to your saved equipment. The exposure starting point above works without an account.</p>' : ''}
        ${data?.signedIn && !gearPlan.use ? '<p>Choose your planned dive type to see matching setups.</p>' : ''}
        ${data?.signedIn && gearPlan.use && !invalid && !result?.ranked?.length ? '<p>No matching saved setup yet. Review your Gear Locker and its dive-use preferences. Technical and overhead matches require your explicit designation in the app.</p>' : ''}
        ${data?.signedIn && gearPlan.use && !invalid ? (result?.ranked || []).map((entry, index) => `
          <div class="atlas-gear-card"><span class="travel-section-kicker">${index === 0 ? 'Closest starting point' : 'Alternative'} · ${escapeHtml(entry.setup.type)}</span>
            <h4>${escapeHtml(entry.setup.name)}</h4><p>${entry.suit ? `Exposure: ${escapeHtml([entry.suit, ...entry.layers].map((item) => item.name).join(' + '))}` : 'Exposure protection still needed'}</p>
            ${entry.changes.length ? `<p>Bring or add: ${escapeHtml(entry.changes.map((item) => item.name).join(', '))}</p>` : '<p>Keep the saved gear combination.</p>'}
            ${entry.removed.length ? `<p>Leave from this proposal: ${escapeHtml(entry.removed.map((item) => item.name).join(', '))}</p>` : ''}
            ${entry.warnings.map((warning) => `<p class="atlas-gear-warning">${escapeHtml(warning)}</p>`).join('')}
            <details><summary>View ${entry.items.length} proposed items</summary><ul>${entry.items.map((item) => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.category)}</li>`).join('')}</ul></details>
          </div>`).join('') : ''}
        ${data?.signedIn && gearPlan.use && !invalid && result?.exclusions?.length ? `<p class="atlas-gear-warning">${result.exclusions.length} item(s) were excluded due to condition or service status. Check your Gear Locker before packing.</p>` : ''}
      </div>
      <p class="atlas-gear-note">Planning aid only. Confirm training, current conditions, gas planning, redundancy, and equipment compatibility. Nothing here changes your saved setups.</p>`;
    gearContent.querySelectorAll('[data-gear-field]').forEach((field) => field.addEventListener('change', () => {
      const name = field.dataset.gearField;
      if (name === 'tendency' || name === 'threshold') {
        const next = { ...advicePreferences() };
        if (name === 'tendency') next.thermalTendency = field.value;
        else {
          const number = Number(field.value);
          if (!Number.isFinite(number) || number < 28 || number > 104) { field.setCustomValidity('Enter 28–104°F.'); field.reportValidity(); return; }
          next.drysuitBelowC = (number - 32) * 5 / 9;
        }
        updateAdvicePreferences(next);
      } else gearPlan[name] = name === 'longDive' ? field.checked : field.value;
      renderGearPlan();
    }));
  }

  async function showGearAdvice(message) {
    if (!gearDialog || !window.DMZAtlasGuideEngine) return;
    const context = window.DMZAtlasGuideEngine.gearContext(message);
    if (!context) return;
    gearPlan = { context, use: '', depth: '', bottom: '', longDive: false, data: null, error: '' };
    gearDialog.showModal();
    renderGearPlan();
    try { const data = await loadGearRecords(); if (gearPlan?.context === context) { gearPlan.data = data; renderGearPlan(); } }
    catch (error) { if (gearPlan?.context === context) { gearPlan.error = 'Your account gear could not load. You can still use the exposure starting point.'; renderGearPlan(); } }
  }
  function savedOrigin() {
    try {
      const value = JSON.parse(localStorage.getItem(originKey) || 'null');
      return value && validCoordinate(value.latitude, value.longitude) ? value : null;
    } catch { return null; }
  }
  function rememberOrigin(point, label = '') {
    if (!point || !validCoordinate(point.latitude, point.longitude)) return;
    const value = { latitude: point.latitude, longitude: point.longitude, label: String(label || '').slice(0, 200) };
    try { localStorage.setItem(originKey, JSON.stringify(value)); } catch (_) { /* optional */ }
    atlas()?.DMZTravelAtlas?.setOrigin(value);
  }

  // The planner's airport and operator data is large, so it loads only when someone asks for a journey.
  let journeyEngine = null;
  function loadJourneyEngine() {
    if (window.DMZAtlasJourneyEngine) return Promise.resolve(window.DMZAtlasJourneyEngine);
    journeyEngine ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = journeyEngineUrl;
      script.onload = () => window.DMZAtlasJourneyEngine ? resolve(window.DMZAtlasJourneyEngine) : reject(new Error('missing'));
      script.onerror = () => { journeyEngine = null; script.remove(); reject(new Error('unavailable')); };
      document.head.append(script);
    });
    return journeyEngine;
  }

  let journey = null;
  const externalLink = (url, label, className = '') => /^https:\/\//i.test(url || '')
    ? `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>` : '';

  function renderJourney() {
    const engine = window.DMZAtlasJourneyEngine;
    if (!journey || !journeyContent || !engine) return;
    const { site } = journey;
    let plan;
    try {
      plan = engine.planJourney(site, { origin: journey.origin, originPoint: journey.originPoint,
        arrivalIndex: journey.arrival, local: journey.local, units: 'imperial' });
    } catch (error) {
      journeyContent.innerHTML = '<p class="atlas-gear-warning">This journey could not be planned. Try another site.</p>';
      return;
    }
    const { destination, arrivals, legs, base, considerations } = plan;
    const crumbs = [...new Set([destination.country, destination.areaName].filter(Boolean))];
    const closest = destination.closest;
    const baseItems = journey.baseTab === 'operators' ? base.operators : base.stays;
    const baseSearches = base.searches.filter((search) => search.kind === journey.baseTab);
    const sources = [...(destination.profile?.sources || []),
      { name: 'Airports · OurAirports (public domain)', url: 'https://ourairports.com/data/' },
      { name: 'Airport connectivity · OpenFlights (ODbL)', url: 'https://openflights.org/data.php' }];
    const tab = (group, value, label, selected) => `<button type="button" class="atlas-journey-tab${selected ? ' is-active' : ''}"
      data-journey-${group}="${value}" aria-pressed="${selected}">${escapeHtml(label)}</button>`;
    journeyContent.innerHTML = `
      <h3 class="atlas-journey-site">${escapeHtml(site.name)}</h3>
      <p class="atlas-journey-crumbs">${crumbs.map(escapeHtml).join(' › ')}</p>
      ${closest ? `<p class="atlas-gear-note">Nearest scheduled airport: ${escapeHtml(closest.name)} · ${escapeHtml(closest.code)}, ${escapeHtml(engine.approxDistance(closest.distanceKm, 'imperial'))}</p>` : ''}
      <form class="atlas-gear-preferences atlas-journey-origin" data-journey-origin-form>
        <label>Starting from<input data-journey-origin type="text" maxlength="200" autocomplete="address-level2"
          placeholder="City or airport code" value="${escapeHtml(journey.origin)}"></label>
        <button type="button" class="atlas-journey-locate" data-journey-locate ${journey.busy ? 'disabled' : ''}>${journey.busy ? 'Finding you…' : '◎ Use my current location'}</button>
        ${journey.notice ? `<p class="atlas-gear-note" aria-live="polite">${escapeHtml(journey.notice)}</p>` : ''}
      </form>
      <div class="atlas-journey-tabs">${tab('local', 'false', 'Plan arrival', !journey.local)}${tab('local', 'true', 'Already nearby', journey.local)}</div>
      ${journey.local ? '' : arrivals.map((option, index) => `
        <button type="button" class="atlas-journey-option${journey.arrival === index ? ' is-active' : ''}" data-journey-arrival="${index}" aria-pressed="${journey.arrival === index}">
          <span><strong>${escapeHtml(option.label)}${option.recommended ? ' · suggested' : ''}</strong>
          <small>${escapeHtml([option.name, option.summary].filter(Boolean).join(' · '))}</small></span>
          <b>${option.road ? '⟶' : escapeHtml(option.code)}</b></button>`).join('')}
      <div class="atlas-journey-heading"><span class="travel-section-kicker">Your way to the water</span><small>${legs.length} steps</small></div>
      <ol class="atlas-journey-legs">${legs.map((leg, index) => `
        <li><details ${journey.expanded === index ? 'open' : ''} data-journey-leg="${index}"><summary><small>${escapeHtml(leg.mode)}</small>${escapeHtml(leg.title)}</summary>
          <p>${escapeHtml(leg.detail)}</p>${externalLink(leg.url, leg.action)}</details></li>`).join('')}</ol>
      <div class="atlas-journey-heading"><span class="travel-section-kicker">Your dive base</span><small>${escapeHtml(destination.base || destination.areaName)}</small></div>
      <div class="atlas-journey-tabs">${tab('base', 'operators', 'Dive operators', journey.baseTab === 'operators')}${tab('base', 'stays', 'Stay & dive', journey.baseTab === 'stays')}</div>
      ${baseItems.map((item) => `<a class="atlas-gear-card atlas-journey-card" href="${escapeHtml(/^https:\/\//i.test(item.url || '') ? item.url : '#')}" target="_blank" rel="noopener noreferrer">
        <strong>${escapeHtml(item.name)} ↗</strong>
        <small>${item.distanceKm != null ? `${escapeHtml(engine.distanceText(item.distanceKm, 'imperial').replace(/^under/, 'Under'))} from the site · ${escapeHtml(item.kind)}` : `${escapeHtml(item.town)} · local list`}</small>
        <span>${escapeHtml(item.detail)}${item.phone ? ` · ${escapeHtml(item.phone)}` : ''}</span></a>`).join('')}
      ${baseSearches.map((search) => `<a class="atlas-gear-card atlas-journey-card is-search" href="${escapeHtml(search.url)}" target="_blank" rel="noopener noreferrer">
        <strong>${escapeHtml(search.title)} ↗</strong><span>${escapeHtml(search.detail)}</span></a>`).join('')}
      <p class="atlas-gear-note">${baseItems.length ? 'Listed by distance from the dive site — closest first, never ranked or sponsored. From OpenStreetMap (© OpenStreetMap contributors) plus any sourced local list. None is confirmed for this exact site — ask before booking.'
        : 'No operators are mapped near this site yet. Searches open with this dive area filled in — confirm the operator runs trips to this site before booking.'}</p>
      <div class="atlas-journey-heading"><span class="travel-section-kicker">Before you go</span></div>
      ${considerations.map((item) => `<div class="atlas-journey-consider"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)}</p>${externalLink(item.url, 'Look it up')}</div>`).join('')}
      <p class="atlas-gear-note">A trip outline, not a booking. Flight searches and directions open externally with your starting point. Schedules, connections and dive access are confirmed there and locally.</p>
      <p class="atlas-journey-sources">${sources.map((source) => externalLink(source.url, source.name)).join('')}</p>`;
  }

  function setJourneyOrigin(text, point, notice = '') {
    if (!journey) return;
    Object.assign(journey, { origin: text, originPoint: point, arrival: 0, expanded: 0, notice });
    if (point) rememberOrigin(point, text);
    renderJourney();
  }

  function locateJourneyStart() {
    if (!journey || journey.busy) return;
    if (!navigator.geolocation) { journey.notice = 'Location is not available in this browser. Enter a city or airport code.'; renderJourney(); return; }
    const current = journey;
    Object.assign(current, { busy: true, notice: '' });
    renderJourney();
    navigator.geolocation.getCurrentPosition((position) => {
      if (journey !== current) return;
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const label = window.DMZAtlasJourneyEngine.originLabel(point);
      current.busy = false;
      setJourneyOrigin(label || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`, point,
        label ? 'Starting near your current location. Refine it if needed.' : 'Current coordinates selected. Enter a city or airport for a broader flight search.');
    }, () => {
      if (journey !== current) return;
      Object.assign(current, { busy: false, notice: 'Location unavailable. Enter a city or airport code below.' });
      renderJourney();
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  }

  journeyContent?.addEventListener('click', (event) => {
    if (!journey) return;
    const target = event.target.closest('button');
    if (!target) return;
    if (target.matches('[data-journey-locate]')) { locateJourneyStart(); return; }
    if (target.dataset.journeyLocal) Object.assign(journey, { local: target.dataset.journeyLocal === 'true', expanded: 0 });
    else if (target.dataset.journeyArrival) Object.assign(journey, { arrival: Number(target.dataset.journeyArrival), expanded: 0 });
    else if (target.dataset.journeyBase) journey.baseTab = target.dataset.journeyBase;
    else return;
    renderJourney();
  });
  journeyContent?.addEventListener('toggle', (event) => {
    const leg = event.target.closest?.('[data-journey-leg]');
    if (journey && leg?.open) journey.expanded = Number(leg.dataset.journeyLeg);
  }, true);
  const commitOrigin = () => {
    const input = journeyContent?.querySelector('[data-journey-origin]');
    if (!journey || !input) return;
    const text = input.value.trim();
    if (text === journey.origin) return;
    // A typed start is placed by airport code or city name so nearby trips can be offered overland.
    const place = text ? window.DMZAtlasJourneyEngine.placeFromText(text) : null;
    setJourneyOrigin(text, place ? { latitude: place.latitude, longitude: place.longitude } : null);
  };
  journeyContent?.addEventListener('change', (event) => { if (event.target.matches('[data-journey-origin]')) commitOrigin(); });
  journeyContent?.addEventListener('submit', (event) => { event.preventDefault(); commitOrigin(); });

  async function showJourney(destination) {
    if (!journeyDialog) return;
    const lat = Number(destination?.latitude), lon = Number(destination?.longitude);
    if (typeof destination?.name !== 'string' || !validCoordinate(lat, lon)) return;
    const site = { latitude: lat, longitude: lon, ...Object.fromEntries(['id', 'name', 'region', 'country', 'entry']
      .map((key) => [key, typeof destination[key] === 'string' ? destination[key].slice(0, 200) : ''])) };
    const start = savedOrigin();
    journey = { site, origin: start?.label || '', originPoint: start ? { latitude: start.latitude, longitude: start.longitude } : null,
      arrival: 0, local: false, expanded: 0, baseTab: 'operators', busy: false, notice: '' };
    journeyContent.innerHTML = '<p class="atlas-gear-note">Loading the journey planner…</p>';
    journeyDialog.showModal();
    try { await loadJourneyEngine(); renderJourney(); }
    catch (_) { if (journey?.site === site) journeyContent.innerHTML = '<p class="atlas-gear-warning">The journey planner could not load. Check your connection and try again.</p>'; }
  }
  journeyDialog?.querySelector('.atlas-gear-close')?.addEventListener('click', () => journeyDialog.close());
  journeyDialog?.addEventListener('close', () => { journey = null; });

  gearDialog?.querySelector('.atlas-gear-close')?.addEventListener('click', () => gearDialog.close());
  gearDialog?.addEventListener('close', () => { gearPlan = null; });

  function handleAtlasMessage(event) {
    const message = event.detail || {};
    if (message.type === 'preferences') {
      try { localStorage.setItem(preferencesKey, JSON.stringify(message.value)); } catch (_) { /* optional */ }
    } else if (message.type === 'locate') {
      if (!navigator.geolocation) { receive({ type: 'notice', text: 'Location is not available in this browser.' }); return; }
      navigator.geolocation.getCurrentPosition((position) => {
        rememberOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        receive({ type: 'location', latitude: position.coords.latitude, longitude: position.coords.longitude });
      }, () => receive({ type: 'notice', text: 'Location access is off. You can still explore the whole map.' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    } else if (message.type === 'openLogbook' || message.type === 'openDive') {
      window.location.assign('/pages/account/#logbook');
    } else if (message.type === 'retryLogs') {
      loadPersonalDives();
    } else if (message.type === 'gearAdvice') {
      showGearAdvice(message);
    } else if (message.type === 'external' && /^https:\/\//i.test(message.url || '')) {
      window.open(message.url, '_blank', 'noopener,noreferrer');
    } else if (message.type === 'journey') {
      showJourney(message.destination);
    }
  }

  function initializeFrame() {
    if (ready || !atlas()?.DMZTravelAtlas) return;
    ready = true;
    atlas().addEventListener('atlas-message', handleAtlasMessage);
    try { receive({ type: 'preferences', value: JSON.parse(localStorage.getItem(preferencesKey) || 'null') }); }
    catch (_) { /* default Atlas preferences */ }
    atlas().DMZTravelAtlas?.setAdvicePreferences(advicePreferences());
    // Starting point for travel ratings: the saved one, else a recent position if location is already allowed (never prompts).
    const start = savedOrigin();
    if (start) atlas().DMZTravelAtlas?.setOrigin(start);
    else navigator.permissions?.query({ name: 'geolocation' }).then((status) => {
      if (status.state === 'granted') navigator.geolocation.getCurrentPosition((position) => rememberOrigin({
        latitude: position.coords.latitude, longitude: position.coords.longitude }), () => {}, { maximumAge: 7 * 24 * 3600 * 1000, timeout: 15000 });
    }).catch(() => {});
    loadPersonalDives();
  }

  window.addEventListener('message', (event) => {
    if (event.source !== atlas() || event.origin !== window.location.origin || event.data?.source !== 'dmz-ocean-atlas') return;
    if (event.data.type === 'ready') initializeFrame();
  });
  frame.addEventListener('load', initializeFrame);
  window.addEventListener('dmz:travel-atlas-focus', (event) => {
    const item = event.detail || {};
    if (!ready) return;
    const shortcut = areaShortcuts[item.id] || { query: item.name || '', zoom: 8 };
    atlas()?.DMZTravelAtlas?.openArea({ ...shortcut,
      latitude: shortcut.latitude ?? (shortcut.query ? undefined : item.lat),
      longitude: shortcut.longitude ?? (shortcut.query ? undefined : item.lon) });
    frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();
