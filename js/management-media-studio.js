// management-media-studio.js — Native media editor for the management studio
(() => {
  'use strict';

  const TOKEN_KEY = 'dmzMediaToken';
  const PREVIEW_SRC = '/pages/media/';

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

  function genId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── State ────────────────────────────────────────────────────────────────
  const st = {
    items: [],
    selected: null,
    edits: {},
    deleting: new Set(),
    filter: '',
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
    const base = st.items.find(i => i.id === id);
    if (!base) return null;
    return st.edits[id] ? { ...base, ...st.edits[id] } : base;
  }

  function getSelected() { return st.selected ? getMerged(st.selected) : null; }

  // ── Load ─────────────────────────────────────────────────────────────────
  async function load() {
    setStatus('Loading…');
    try {
      const raw = await apiFetch('/api/media');
      const arr = Array.isArray(raw) ? raw : (raw?.items ?? []);
      st.items = arr.map((item, i) => ({ sortOrder: i, ...item }));
      st.edits = {};
      st.deleting.clear();
      syncDirtyBadge();
      renderList();
      renderForm();
      setStatus('');
    } catch (err) {
      setStatus(`Load failed: ${err.message}`, 'error');
    }
  }

  // ── List ─────────────────────────────────────────────────────────────────
  function filteredItems() {
    const q = st.filter.toLowerCase();
    return st.items.filter(base => {
      if (st.deleting.has(base.id)) return false;
      if (!q) return true;
      const m = getMerged(base.id);
      return [m.title, m.description, m.location, ...(m.tags || [])].join(' ').toLowerCase().includes(q);
    });
  }

  function thumbSrc(item) {
    if (item.thumbUrl) return item.thumbUrl;
    if (item.streamId) return `https://videodelivery.net/${item.streamId}/thumbnails/thumbnail.jpg?time=1s`;
    return '';
  }

  function renderList() {
    if (!R.list) return;
    const items = filteredItems();
    if (R.count) R.count.textContent = String(items.length);

    if (!items.length) {
      R.list.innerHTML = `<p class="mstudio-empty">${st.filter ? 'No matches found.' : 'No media items yet. Click Add Item to start.'}</p>`;
      return;
    }

    R.list.innerHTML = items.map(base => {
      const item = getMerged(base.id);
      const sel = item.id === st.selected;
      const dirty = Boolean(st.edits[item.id]);
      const thumb = thumbSrc(item);
      const isPhoto = item.type === 'photo';
      return `<div class="mstudio-list-item${sel ? ' is-selected' : ''}" data-id="${esc(item.id)}" role="option" aria-selected="${sel}" tabindex="0">
        <div class="mstudio-list-thumb">
          ${thumb
            ? `<img src="${esc(thumb)}" alt="" loading="lazy" />`
            : `<div class="mstudio-thumb-ph">${isPhoto ? '&#128247;' : '&#9654;'}</div>`}
        </div>
        <div class="mstudio-list-meta">
          <span class="mstudio-list-title">${esc(item.title || '(untitled)')}</span>
          <div class="mstudio-chips">
            <span class="mstudio-chip mstudio-chip-type">${isPhoto ? 'PHOTO' : 'VIDEO'}</span>
            ${item.location ? `<span class="mstudio-chip">${esc(item.location)}</span>` : ''}
            ${dirty ? '<span class="mstudio-chip mstudio-chip-dirty">edited</span>' : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  function renderForm() {
    if (!R.form || !R.hint) return;
    const item = getSelected();
    if (!item) {
      R.hint.hidden = false;
      R.form.hidden = true;
      return;
    }
    R.hint.hidden = true;
    R.form.hidden = false;

    const extraTags = (item.tags || []).filter(t => t !== 'video' && t !== 'photo').join(', ');

    R.form.innerHTML = `
      <div class="mstudio-form-header">
        <span class="mstudio-form-eyebrow">Edit Item</span>
        <button class="mstudio-delete-btn" type="button" data-ms-del title="Delete this item">Delete</button>
      </div>

      <label class="mstudio-label"><span>Title</span>
        <input class="mstudio-input" name="title" value="${esc(item.title || '')}" maxlength="120" placeholder="Dive title…" />
      </label>

      <div class="mstudio-row-2">
        <label class="mstudio-label"><span>Type</span>
          <select class="mstudio-input" name="type">
            <option value="video"${item.type === 'video' ? ' selected' : ''}>Video</option>
            <option value="photo"${item.type === 'photo' ? ' selected' : ''}>Photo</option>
          </select>
        </label>
        <label class="mstudio-label"><span>Location</span>
          <input class="mstudio-input" name="location" value="${esc(item.location || '')}" maxlength="100" placeholder="Great Lakes, IL" />
        </label>
      </div>

      <label class="mstudio-label"><span>Tags <em>(comma-separated)</em></span>
        <input class="mstudio-input" name="tags" value="${esc(extraTags)}" placeholder="wreck, great-lakes, cold-water" />
      </label>

      <label class="mstudio-label"><span>Description</span>
        <textarea class="mstudio-input mstudio-textarea" name="description" rows="3" maxlength="500"
          placeholder="Brief description for the gallery card…">${esc(item.description || '')}</textarea>
      </label>

      <label class="mstudio-label"><span>Media URL</span>
        <input class="mstudio-input" name="url" value="${esc(item.url || '')}" placeholder="/assets/media/video.mp4 or https://…" />
      </label>

      <label class="mstudio-label"><span>Thumbnail URL</span>
        <input class="mstudio-input" name="thumbUrl" value="${esc(item.thumbUrl || '')}" placeholder="/assets/media/thumbnails/thumb.jpg" />
      </label>

      ${item.streamId ? `<div class="mstudio-meta-row"><span>Stream ID</span><code class="mstudio-code">${esc(item.streamId)}</code></div>` : ''}

      <div class="mstudio-form-actions">
        <button class="mstudio-btn mstudio-btn-primary" type="button" data-ms-save>Save Changes</button>
        <button class="mstudio-btn" type="button" data-ms-discard>Discard</button>
      </div>`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function select(id) {
    st.selected = id;
    renderList();
    renderForm();
  }

  function readFormFields() {
    if (!R.form) return null;
    const f = R.form;
    const type = f.querySelector('[name=type]')?.value || 'video';
    const extraTags = (f.querySelector('[name=tags]')?.value || '')
      .split(',').map(s => s.trim()).filter(s => s && s !== 'video' && s !== 'photo');
    return {
      title: f.querySelector('[name=title]')?.value.trim() || '',
      type,
      location: f.querySelector('[name=location]')?.value.trim() || '',
      description: f.querySelector('[name=description]')?.value.trim() || '',
      url: f.querySelector('[name=url]')?.value.trim() || '',
      thumbUrl: f.querySelector('[name=thumbUrl]')?.value.trim() || '',
      tags: [type, ...extraTags],
    };
  }

  function saveEdit() {
    if (!st.selected) return;
    const updates = readFormFields();
    if (!updates) return;
    st.edits[st.selected] = { ...(st.edits[st.selected] || {}), ...updates };
    syncDirtyBadge();
    renderList();
    renderForm();
    setStatus('Saved locally — publish to push live.');
  }

  function discardEdit() {
    if (!st.selected) return;
    delete st.edits[st.selected];
    syncDirtyBadge();
    renderList();
    renderForm();
    setStatus('Changes discarded.');
  }

  function addItem() {
    const id = genId();
    st.items.unshift({
      id, type: 'video', title: 'New Item', description: '',
      tags: ['video'], location: '', url: '', thumbUrl: '', streamId: '',
      createdAt: new Date().toISOString(), sortOrder: 0,
    });
    st.edits[id] = {};
    syncDirtyBadge();
    select(id);
    setStatus('New item added. Fill in details and publish.');
  }

  function deleteItem() {
    const item = getSelected();
    if (!item) return;
    if (!confirm(`Delete "${item.title || 'this item'}"?\n\nThis takes effect when you publish.`)) return;
    st.deleting.add(item.id);
    delete st.edits[item.id];
    st.selected = null;
    syncDirtyBadge();
    renderList();
    renderForm();
    setStatus('Marked for deletion — publish to remove.');
  }

  async function publish() {
    if (!getToken()) { setStatus('Not authenticated — log in first.', 'error'); return; }
    const deleteIds = [...st.deleting];
    const deleteStreamIds = st.items
      .filter(i => st.deleting.has(i.id) && i.streamId)
      .map(i => i.streamId);
    const items = st.items
      .filter(i => !st.deleting.has(i.id))
      .map((base, idx) => ({ ...base, ...(st.edits[base.id] || {}), sortOrder: idx }));

    setStatus('Publishing…');
    try {
      await apiFetch('/api/admin/media-bulk', {
        method: 'PUT',
        body: JSON.stringify({ items, deleteIds, deleteStreamIds }),
      });
      st.items = items;
      st.edits = {};
      st.deleting.clear();
      syncDirtyBadge();
      renderList();
      renderForm();
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

  function exportJSON() {
    const data = st.items
      .filter(i => !st.deleting.has(i.id))
      .map(base => ({ ...base, ...(st.edits[base.id] || {}) }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `dmz-media-${Date.now()}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function syncStream() {
    if (!getToken()) { setStatus('Not authenticated.', 'error'); return; }
    setStatus('Syncing Stream dates…');
    try {
      await apiFetch('/api/admin/stream-date-sync', { method: 'POST', body: '{}' });
      setStatus('Stream sync complete — reload to see updated dates.', 'success');
    } catch (err) {
      setStatus(`Sync failed: ${err.message}`, 'error');
    }
  }

  // Upload modal
  function openUpload() { if (R.uploadOverlay) R.uploadOverlay.hidden = false; }
  function closeUpload() {
    if (!R.uploadOverlay) return;
    R.uploadOverlay.hidden = true;
    R.uploadForm?.reset();
  }

  function submitUpload(e) {
    e.preventDefault();
    const f = R.uploadForm;
    if (!f) return;
    const type = f.querySelector('[name=type]')?.value || 'video';
    const id = genId();
    const newItem = {
      id, type,
      title: f.querySelector('[name=title]')?.value.trim() || 'New Item',
      location: f.querySelector('[name=location]')?.value.trim() || '',
      url: f.querySelector('[name=url]')?.value.trim() || '',
      thumbUrl: f.querySelector('[name=thumbUrl]')?.value.trim() || '',
      description: '',
      tags: [type],
      streamId: '',
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    };
    st.items.unshift(newItem);
    st.edits[id] = {};
    syncDirtyBadge();
    closeUpload();
    select(id);
    setStatus('Item added. Fill in details and publish.');
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function bindEvents() {
    // List
    R.list?.addEventListener('click', e => {
      const row = e.target.closest('[data-id]');
      if (row) select(row.dataset.id);
    });
    R.list?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const row = e.target.closest('[data-id]');
        if (row) { e.preventDefault(); select(row.dataset.id); }
      }
    });

    // Form delegation (parent is edit-pane)
    R.editPane?.addEventListener('click', e => {
      if (e.target.closest('[data-ms-save]')) { saveEdit(); return; }
      if (e.target.closest('[data-ms-discard]')) { discardEdit(); return; }
      if (e.target.closest('[data-ms-del]')) { deleteItem(); return; }
    });

    // Toolbar
    R.panel?.addEventListener('click', e => {
      if (e.target.closest('[data-ms-add]')) { addItem(); return; }
      if (e.target.closest('[data-ms-upload]')) { openUpload(); return; }
      if (e.target.closest('[data-ms-sync]')) { syncStream(); return; }
      if (e.target.closest('[data-ms-export]')) { exportJSON(); return; }
      if (e.target.closest('[data-ms-publish]')) { publish(); return; }
      if (e.target.closest('[data-ms-refresh]')) { refreshPreview(); return; }
      if (e.target.closest('[data-ms-upload-close]')) { closeUpload(); return; }
    });

    // Search
    R.search?.addEventListener('input', () => {
      st.filter = R.search.value.trim();
      renderList();
    });

    // Upload form & overlay
    R.uploadForm?.addEventListener('submit', submitUpload);
    R.uploadOverlay?.addEventListener('click', e => {
      if (e.target === R.uploadOverlay) closeUpload();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(panelEl) {
    R.panel = panelEl;
    R.list = panelEl.querySelector('[data-ms-list]');
    R.editPane = panelEl.querySelector('[data-ms-edit-pane]');
    R.form = panelEl.querySelector('[data-ms-form]');
    R.hint = panelEl.querySelector('[data-ms-hint]');
    R.count = panelEl.querySelector('[data-ms-count]');
    R.dirtyBadge = panelEl.querySelector('[data-ms-dirty]');
    R.status = panelEl.querySelector('[data-ms-status]');
    R.search = panelEl.querySelector('[data-ms-search]');
    R.preview = panelEl.querySelector('[data-ms-preview]');
    R.uploadOverlay = panelEl.querySelector('[data-ms-upload-overlay]');
    R.uploadForm = panelEl.querySelector('[data-ms-upload-form]');

    if (R.preview) {
      R.preview.dataset.previewSrc = PREVIEW_SRC;
      R.preview.src = PREVIEW_SRC;
    }

    bindEvents();
    load();
  }

  // Auto-init when studio panel becomes visible
  const panelEl = document.querySelector("[data-site-studio-panel='media']");
  if (panelEl) {
    let started = false;
    const start = () => { if (!started) { started = true; init(panelEl); } };
    if (!panelEl.hidden) { start(); return; }
    const obs = new MutationObserver(() => { if (!panelEl.hidden) { obs.disconnect(); start(); } });
    obs.observe(panelEl, { attributes: true, attributeFilter: ['hidden'] });
  }
})();
