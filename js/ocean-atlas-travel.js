(() => {
  const frame = document.getElementById('oceanAtlasFrame');
  if (!frame) return;
  const tokenKey = 'dmzCustomerAccessToken';
  const signedInKey = 'dmzCustomerSignedIn';
  const preferencesKey = 'dmzOceanAtlasPreferencesV1';
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

  function handleAtlasMessage(event) {
    const message = event.detail || {};
    if (message.type === 'preferences') {
      try { localStorage.setItem(preferencesKey, JSON.stringify(message.value)); } catch (_) { /* optional */ }
    } else if (message.type === 'locate') {
      if (!navigator.geolocation) { receive({ type: 'notice', text: 'Location is not available in this browser.' }); return; }
      navigator.geolocation.getCurrentPosition((position) => {
        receive({ type: 'location', latitude: position.coords.latitude, longitude: position.coords.longitude });
      }, () => receive({ type: 'notice', text: 'Location access is off. You can still explore the whole map.' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    } else if (message.type === 'openLogbook' || message.type === 'openDive') {
      window.location.assign('/pages/account/#logbook');
    } else if (message.type === 'retryLogs') {
      loadPersonalDives();
    } else if (message.type === 'external' && /^https:\/\//i.test(message.url || '')) {
      window.open(message.url, '_blank', 'noopener,noreferrer');
    } else if (message.type === 'journey') {
      const rawLat = message.destination?.latitude, rawLon = message.destination?.longitude;
      const lat = rawLat == null || rawLat === '' ? NaN : Number(rawLat);
      const lon = rawLon == null || rawLon === '' ? NaN : Number(rawLon);
      if (validCoordinate(lat, lon)) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
        '_blank', 'noopener,noreferrer');
    }
  }

  function initializeFrame() {
    if (ready || !atlas()?.DMZTravelAtlas) return;
    ready = true;
    atlas().addEventListener('atlas-message', handleAtlasMessage);
    try { receive({ type: 'preferences', value: JSON.parse(localStorage.getItem(preferencesKey) || 'null') }); }
    catch (_) { /* default Atlas preferences */ }
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
