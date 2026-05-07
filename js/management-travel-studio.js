// management-travel-studio.js — Native travel/destinations editor for the management studio
(() => {
  'use strict';

  const TOKEN_KEY = 'dmzMediaToken';
  const PREVIEW_SRC = '/pages/travel/';

  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function apiFetch(url, opts = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = j.error || j.message || msg; } catch (_) {}
      throw new Error(`${res.status}: ${msg}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ── State ────────────────────────────────────────────────────────────────
  const st = {
    dests: [],
    selected: null,
    edits: {},
    deleting: new Set(),
    activeTab: 'core',
  };

  let R = {};

  function hasDirty() {
    return Object.keys(st.edits).length > 0 || st.deleting.size > 0;
  }

  let statusTimer = null;
  function setStatus(msg, type) {
    if (!R.status) return;
    R.status.textContent = msg;
    R.status.dataset.stype = type || '';
    clearTimeout(statusTimer);
    if (msg && type !== 'error') {
      statusTimer = setTimeout(() => { if (R.status) R.status.textContent = ''; }, 3500);
    }
  }

  function syncDirtyBadge() {
    if (R.dirtyBadge) R.dirtyBadge.hidden = !hasDirty();
  }

  function getMerged(id) {
    const base = st.dests.find(d => d.id === id);
    if (!base) return null;
    return st.edits[id] ? { ...base, ...st.edits[id] } : base;
  }

  function getSelected() { return st.selected ? getMerged(st.selected) : null; }

  // ── Load ─────────────────────────────────────────────────────────────────
  async function load() {
    setStatus('Loading destinations…');
    try {
      const [baseRes, expandedRes] = await Promise.all([
        apiFetch('/api/v2/destinations'),
        apiFetch('/api/destinations-expanded').catch(() => []),
      ]);

      const bases = Array.isArray(baseRes) ? baseRes : (baseRes?.destinations ?? baseRes?.items ?? []);
      const expanded = Array.isArray(expandedRes) ? expandedRes : (expandedRes?.destinations ?? expandedRes?.items ?? []);
      const expandedMap = Object.fromEntries(expanded.map(e => [e.id, e]));

      st.dests = bases.map(b => ({ ...b, ...(expandedMap[b.id] || {}) }));
      st.edits = {};
      st.deleting.clear();
      syncDirtyBadge();
      renderList();
      renderEditArea();
      setStatus('');
    } catch (err) {
      setStatus(`Load failed: ${err.message}`, 'error');
    }
  }

  // ── List ─────────────────────────────────────────────────────────────────
  function renderList() {
    if (!R.list) return;
    const items = st.dests.filter(d => !st.deleting.has(d.id));

    if (!items.length) {
      R.list.innerHTML = '<p class="mstudio-empty">No destinations yet. Click + Add Destination.</p>';
      return;
    }

    R.list.innerHTML = items.map(base => {
      const dest = getMerged(base.id);
      const sel = dest.id === st.selected;
      const dirty = Boolean(st.edits[dest.id]);
      return `<div class="mstudio-list-item mstudio-dest-item${sel ? ' is-selected' : ''}" data-id="${esc(dest.id)}" role="option" aria-selected="${sel}" tabindex="0">
        <div class="mstudio-dest-flag">&#127758;</div>
        <div class="mstudio-list-meta">
          <span class="mstudio-list-title">${esc(dest.name || dest.id)}</span>
          <div class="mstudio-chips">
            ${dest.subtitle ? `<span class="mstudio-chip">${esc(dest.subtitle.length > 30 ? dest.subtitle.slice(0, 30) + '…' : dest.subtitle)}</span>` : ''}
            ${dirty ? '<span class="mstudio-chip mstudio-chip-dirty">edited</span>' : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Edit Area ─────────────────────────────────────────────────────────────
  function renderEditArea() {
    const dest = getSelected();
    const hasSelection = Boolean(dest);

    if (R.hint) R.hint.hidden = hasSelection;
    if (R.tabs) R.tabs.hidden = !hasSelection;
    if (R.panels) R.panels.hidden = !hasSelection;
    if (R.actions) R.actions.hidden = !hasSelection;

    const deleteBtn = R.panel?.querySelector('[data-ts-delete-btn]');
    if (deleteBtn) deleteBtn.disabled = !hasSelection;

    if (hasSelection) renderTabPanel(dest);
  }

  function renderTabPanel(dest) {
    if (!R.panels) return;
    const tab = st.activeTab;

    if (tab === 'core') {
      const bulletsVal = (dest.bullets || []).join('\n');
      const tagsVal = (dest.tags || []).join(', ');
      R.panels.innerHTML = `
        <div class="mstudio-tab-panel" data-tab-panel="core">
          <div class="mstudio-row-2">
            <label class="mstudio-label"><span>Name</span>
              <input class="mstudio-input" name="dest-name" value="${esc(dest.name || '')}" maxlength="100" placeholder="Cozumel" />
            </label>
            <label class="mstudio-label"><span>ID <em>(slug)</em></span>
              <input class="mstudio-input" name="dest-id" value="${esc(dest.id || '')}" maxlength="80" placeholder="cozumel" readonly style="opacity:.55;cursor:not-allowed" />
            </label>
          </div>
          <label class="mstudio-label"><span>Subtitle</span>
            <input class="mstudio-input" name="dest-subtitle" value="${esc(dest.subtitle || '')}" maxlength="120" placeholder="Mexico's premier reef system" />
          </label>
          <div class="mstudio-row-2">
            <label class="mstudio-label"><span>Latitude</span>
              <input class="mstudio-input" name="dest-lat" type="number" step="0.0001" value="${esc(dest.lat ?? '')}" placeholder="20.4233" />
            </label>
            <label class="mstudio-label"><span>Longitude</span>
              <input class="mstudio-input" name="dest-lon" type="number" step="0.0001" value="${esc(dest.lon ?? '')}" placeholder="-86.9223" />
            </label>
          </div>
          <label class="mstudio-label"><span>Tags <em>(comma-separated)</em></span>
            <input class="mstudio-input" name="dest-tags" value="${esc(tagsVal)}" placeholder="reef, caribbean, warm-water" />
          </label>
          <label class="mstudio-label"><span>Summary</span>
            <textarea class="mstudio-input mstudio-textarea" name="dest-summary" rows="4" maxlength="800" placeholder="Destination overview…">${esc(dest.summary || '')}</textarea>
          </label>
          <label class="mstudio-label"><span>Snapshot Bullets <em>(one per line)</em></span>
            <textarea class="mstudio-input mstudio-textarea" name="dest-bullets" rows="5" placeholder="World-class wall dives&#10;Warm water year-round&#10;5-star resort options">${esc(bulletsVal)}</textarea>
          </label>
        </div>`;

    } else if (tab === 'content') {
      R.panels.innerHTML = `
        <div class="mstudio-tab-panel" data-tab-panel="content">
          <label class="mstudio-label"><span>Narrative <em>(long-form page description)</em></span>
            <textarea class="mstudio-input mstudio-textarea" name="dest-narrative" rows="6" placeholder="Describe the full dive experience…">${esc(dest.narrative || '')}</textarea>
          </label>
          <label class="mstudio-label"><span>Experience / Who It Fits</span>
            <textarea class="mstudio-input mstudio-textarea" name="dest-experience" rows="3" placeholder="Open Water and above; suits all levels…">${esc(dest.experience || '')}</textarea>
          </label>
          <label class="mstudio-label"><span>Logistics</span>
            <textarea class="mstudio-input mstudio-textarea" name="dest-logistics" rows="3" placeholder="Getting there, best season, visa notes…">${esc(dest.logistics || '')}</textarea>
          </label>
          <label class="mstudio-label"><span>Day-to-Day Breakdown</span>
            <textarea class="mstudio-input mstudio-textarea" name="dest-day" rows="5" placeholder="Morning: Two-tank boat dive…&#10;Afternoon: Surface interval at resort…">${esc(dest.dayToDay || '')}</textarea>
          </label>
          <label class="mstudio-label"><span>Resort Details</span>
            <textarea class="mstudio-input mstudio-textarea" name="dest-resort" rows="3" placeholder="Resort amenities, rooms, dive center…">${esc(dest.resortDetails || '')}</textarea>
          </label>
        </div>`;

    } else if (tab === 'json') {
      const jsonVal = JSON.stringify(dest, null, 2);
      R.panels.innerHTML = `
        <div class="mstudio-tab-panel mstudio-json-panel" data-tab-panel="json">
          <p class="mstudio-hint mstudio-hint-sm">Raw JSON — edits here override all other tabs. Apply merges into draft; Save stages for publish.</p>
          <textarea class="mstudio-input mstudio-json-editor" name="dest-raw-json" spellcheck="false" autocomplete="off" rows="18">${esc(jsonVal)}</textarea>
          <button class="mstudio-btn mstudio-btn-sm" type="button" data-ts-apply-json>Apply JSON to Draft</button>
        </div>`;
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function selectDest(id) {
    st.selected = id;
    renderList();
    renderEditArea();
  }

  function switchTab(tab) {
    st.activeTab = tab;
    R.tabs?.querySelectorAll('[data-ts-tab]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tsTab === tab);
    });
    const dest = getSelected();
    if (dest) renderTabPanel(dest);
  }

  function readCoreFields() {
    if (!R.panels) return {};
    const p = R.panels;
    const bullets = (p.querySelector('[name=dest-bullets]')?.value || '')
      .split('\n').map(s => s.trim()).filter(Boolean);
    const tags = (p.querySelector('[name=dest-tags]')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    return {
      name: p.querySelector('[name=dest-name]')?.value.trim() || '',
      subtitle: p.querySelector('[name=dest-subtitle]')?.value.trim() || '',
      lat: parseFloat(p.querySelector('[name=dest-lat]')?.value) || 0,
      lon: parseFloat(p.querySelector('[name=dest-lon]')?.value) || 0,
      tags, bullets,
      summary: p.querySelector('[name=dest-summary]')?.value.trim() || '',
    };
  }

  function readContentFields() {
    if (!R.panels) return {};
    const p = R.panels;
    return {
      narrative: p.querySelector('[name=dest-narrative]')?.value.trim() || '',
      experience: p.querySelector('[name=dest-experience]')?.value.trim() || '',
      logistics: p.querySelector('[name=dest-logistics]')?.value.trim() || '',
      dayToDay: p.querySelector('[name=dest-day]')?.value.trim() || '',
      resortDetails: p.querySelector('[name=dest-resort]')?.value.trim() || '',
    };
  }

  function saveChanges() {
    if (!st.selected) return;
    let updates = {};

    if (st.activeTab === 'core') {
      updates = readCoreFields();
    } else if (st.activeTab === 'content') {
      updates = readContentFields();
    } else if (st.activeTab === 'json') {
      const raw = R.panels?.querySelector('[name=dest-raw-json]')?.value || '';
      try { updates = JSON.parse(raw); }
      catch { setStatus('Invalid JSON — fix syntax and try again.', 'error'); return; }
    }

    st.edits[st.selected] = { ...(st.edits[st.selected] || {}), ...updates };
    syncDirtyBadge();
    renderList();
    setStatus('Saved locally — publish to push live.');
  }

  function applyJson() {
    if (!st.selected) return;
    const raw = R.panels?.querySelector('[name=dest-raw-json]')?.value || '';
    try {
      const parsed = JSON.parse(raw);
      st.edits[st.selected] = { ...(st.edits[st.selected] || {}), ...parsed };
      syncDirtyBadge();
      renderList();
      renderTabPanel(getMerged(st.selected));
      setStatus('JSON applied to draft.');
    } catch {
      setStatus('Invalid JSON — fix syntax and try again.', 'error');
    }
  }

  function discardChanges() {
    if (!st.selected) return;
    delete st.edits[st.selected];
    syncDirtyBadge();
    renderList();
    renderEditArea();
    setStatus('Changes discarded.');
  }

  function addDest() {
    const name = prompt('New destination name:')?.trim();
    if (!name) return;
    const id = name.toLowerCase()
      .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      || `dest-${Date.now()}`;
    if (st.dests.find(d => d.id === id)) {
      setStatus(`ID "${id}" already exists — choose a different name.`, 'error');
      return;
    }
    const newDest = {
      id, name, subtitle: '', lat: 0, lon: 0, tags: [],
      summary: '', bullets: [], heroImage: '', isoImage: '',
      isoTitle: '', isoDesc: '', narrative: '', experience: '',
      logistics: '', dayToDay: '', resortDetails: '',
    };
    st.dests.unshift(newDest);
    st.edits[id] = {};
    syncDirtyBadge();
    selectDest(id);
    setStatus('Destination added. Fill in details and publish.');
  }

  function deleteDest() {
    const dest = getSelected();
    if (!dest) return;
    if (!confirm(`Delete "${dest.name || dest.id}"?\n\nThis takes effect when you publish.`)) return;
    st.deleting.add(dest.id);
    delete st.edits[dest.id];
    st.selected = null;
    syncDirtyBadge();
    renderList();
    renderEditArea();
    setStatus('Marked for deletion — publish to remove.');
  }

  async function publish() {
    if (!getToken()) { setStatus('Not authenticated — log in first.', 'error'); return; }
    const deleteIds = [...st.deleting];
    const items = st.dests
      .filter(d => !st.deleting.has(d.id))
      .map(base => ({ ...base, ...(st.edits[base.id] || {}) }));

    setStatus('Publishing…');
    try {
      await apiFetch('/api/admin/destinations-bulk', {
        method: 'PUT',
        body: JSON.stringify({ items, deleteIds }),
      });
      st.dests = items;
      st.edits = {};
      st.deleting.clear();
      syncDirtyBadge();
      renderList();
      renderEditArea();
      setStatus('Published to site!', 'success');
      refreshPreview();
    } catch (err) {
      setStatus(`Publish failed: ${err.message}`, 'error');
    }
  }

  function refreshPreview() {
    if (!R.preview) return;
    const src = R.preview.dataset.previewSrc || PREVIEW_SRC;
    R.preview.src = '';
    requestAnimationFrame(() => { R.preview.src = src; });
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function bindEvents() {
    R.list?.addEventListener('click', e => {
      const row = e.target.closest('[data-id]');
      if (row) selectDest(row.dataset.id);
    });
    R.list?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const row = e.target.closest('[data-id]');
        if (row) { e.preventDefault(); selectDest(row.dataset.id); }
      }
    });

    R.tabs?.addEventListener('click', e => {
      const btn = e.target.closest('[data-ts-tab]');
      if (btn) switchTab(btn.dataset.tsTab);
    });

    R.panel?.addEventListener('click', e => {
      if (e.target.closest('[data-ts-add]')) { addDest(); return; }
      if (e.target.closest('[data-ts-delete-btn]')) { deleteDest(); return; }
      if (e.target.closest('[data-ts-publish]')) { publish(); return; }
      if (e.target.closest('[data-ts-save]')) { saveChanges(); return; }
      if (e.target.closest('[data-ts-discard]')) { discardChanges(); return; }
      if (e.target.closest('[data-ts-refresh]')) { refreshPreview(); return; }
      if (e.target.closest('[data-ts-apply-json]')) { applyJson(); return; }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(panelEl) {
    R.panel = panelEl;
    R.list = panelEl.querySelector('[data-ts-list]');
    R.tabs = panelEl.querySelector('[data-ts-tabs]');
    R.panels = panelEl.querySelector('[data-ts-panels]');
    R.actions = panelEl.querySelector('[data-ts-actions]');
    R.hint = panelEl.querySelector('[data-ts-hint]');
    R.dirtyBadge = panelEl.querySelector('[data-ts-dirty]');
    R.status = panelEl.querySelector('[data-ts-status]');
    R.preview = panelEl.querySelector('[data-ts-preview]');

    if (R.preview) {
      R.preview.dataset.previewSrc = PREVIEW_SRC;
      R.preview.src = PREVIEW_SRC;
    }

    bindEvents();
    load();
  }

  const panelEl = document.querySelector("[data-site-studio-panel='travel']");
  if (panelEl) {
    let started = false;
    const start = () => { if (!started) { started = true; init(panelEl); } };
    if (!panelEl.hidden) { start(); return; }
    const obs = new MutationObserver(() => { if (!panelEl.hidden) { obs.disconnect(); start(); } });
    obs.observe(panelEl, { attributes: true, attributeFilter: ['hidden'] });
  }
})();
