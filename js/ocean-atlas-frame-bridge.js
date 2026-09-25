// Inlined into the app-generated Atlas document by build-ocean-atlas-travel.cjs.
// Existing travel destinations are only shortcuts into Atlas areas, never extra pins.
(() => {
  const map = window.DMZ_TRAVEL_ATLAS_MAP;
  if (!map || !window.L) return;
  let advicePreferences = {};
  let origin = null;
  const style = document.createElement('style');
  style.textContent = '#back { display: none !important; }';
  document.head.append(style);
  window.addEventListener('atlas-message', (event) => {
    const engine = window.DMZAtlasGuideEngine;
    if (!engine) return;
    const message = event.detail || {};
    if (!['siteGuide', 'regionGuide', 'quickLook', 'placeAt', 'openPlace'].includes(message.type)) return;
    queueMicrotask(() => {
      const response = engine.respond(message, { advicePreferences, origin });
      if (response) window.atlasReceive?.(response);
    });
  });
  const validCoordinate = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  window.DMZTravelAtlas = {
    setAdvicePreferences(value) {
      advicePreferences = value && typeof value === 'object' ? value : {};
      window.atlasReceive?.({ type: 'adviceChanged' });
    },
    setOrigin(value) {
      if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return;
      origin = { latitude: value.latitude, longitude: value.longitude };
      window.atlasReceive?.({ type: 'originChanged' });
    },
    openArea({ regionId = '', areaName = '', query = '', latitude, longitude, zoom = 7 } = {}) {
      // Reuse the Atlas's own curated region/area controls and detail sheets.
      const browse = document.getElementById('browse-toggle');
      if (regionId && browse?.getAttribute('aria-expanded') !== 'true') {
        browse?.click();
      }
      const region = [...document.querySelectorAll('[data-dive-region]')]
        .find((button) => button.dataset.diveRegion === regionId);
      if (region) {
        region.click();
        const expand = document.querySelector('#expand[aria-label="Expand details"]');
        if (expand) expand.click();
        const area = [...document.querySelectorAll('.area-row[data-area]')]
          .find((button) => button.querySelector('strong')?.textContent === areaName);
        if (area) { area.click(); return true; }
      }
      const lat = latitude == null || latitude === '' ? NaN : Number(latitude);
      const lon = longitude == null || longitude === '' ? NaN : Number(longitude);
      if (validCoordinate(lat, lon)) map.flyTo([lat, lon], Math.min(12, Math.max(3, Number(zoom) || 7)), { duration: 0.8 });
      if (query) {
        const search = document.getElementById('search');
        const toggle = document.getElementById('search-toggle');
        if (search && toggle) {
          if (document.getElementById('search-panel')?.hidden) toggle.click();
          search.value = String(query).slice(0, 100);
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.focus();
        }
      }
      return Boolean(region || validCoordinate(lat, lon) || query);
    },
  };
  window.parent.postMessage({ source: 'dmz-ocean-atlas', type: 'ready' }, window.location.origin);
})();
