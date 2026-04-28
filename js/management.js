(() => {
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const managementUrl = apiRoot ? `${apiRoot}/api/admin/management` : "/api/admin/management";
  const tokenStorageKey = "dmzMediaToken";

  const loginSection = app.querySelector("[data-management-login]");
  const dashboard = app.querySelector("[data-management-dashboard]");
  const loginForm = app.querySelector("[data-login-form]");
  const recordForm = app.querySelector("[data-record-form]");
  const recordList = app.querySelector("[data-record-list]");
  const searchInput = app.querySelector("[data-search-records]");
  const loginStatus = app.querySelector("[data-login-status]");
  const recordStatus = app.querySelector("[data-record-status]");
  const editorTitle = app.querySelector("[data-editor-title]");
  const deleteButton = app.querySelector("[data-delete-record]");
  const filterButtons = Array.from(app.querySelectorAll("[data-filter-type]"));
  const metricEls = {
    open: app.querySelector('[data-metric="open"]'),
    inquiry: app.querySelector('[data-metric="inquiry"]'),
    class: app.querySelector('[data-metric="class"]'),
    trip: app.querySelector('[data-metric="trip"]'),
  };

  const state = {
    records: [],
    selectedId: "",
    filterType: "all",
    search: "",
    loading: false,
  };

  function getToken() {
    return window.sessionStorage.getItem(tokenStorageKey) || "";
  }

  function setToken(token) {
    if (!token) {
      window.sessionStorage.removeItem(tokenStorageKey);
      return;
    }
    window.sessionStorage.setItem(tokenStorageKey, token);
  }

  function showAuthed(authed) {
    if (loginSection) loginSection.hidden = authed;
    if (dashboard) dashboard.hidden = !authed;
  }

  function setStatus(node, message, tone = "") {
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", tone === "error");
    node.classList.toggle("is-success", tone === "success");
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatLabel(value) {
    return String(value || "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return "";
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }

  function recordMatchesSearch(record) {
    const query = state.search.trim().toLowerCase();
    if (!query) return true;
    const haystack = [
      record.title,
      record.recordType,
      record.status,
      record.priority,
      record.owner,
      record.contactName,
      record.contactEmail,
      record.contactPhone,
      record.relatedEvent,
      record.notes,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  function getVisibleRecords() {
    return state.records
      .filter((record) => state.filterType === "all" || record.recordType === state.filterType)
      .filter(recordMatchesSearch);
  }

  function updateMetrics() {
    const openCount = state.records.filter((record) => !["complete", "archived"].includes(record.status)).length;
    const byType = state.records.reduce((counts, record) => {
      counts[record.recordType] = (counts[record.recordType] || 0) + 1;
      return counts;
    }, {});
    if (metricEls.open) metricEls.open.textContent = String(openCount);
    if (metricEls.inquiry) metricEls.inquiry.textContent = String(byType.inquiry || 0);
    if (metricEls.class) metricEls.class.textContent = String(byType.class || 0);
    if (metricEls.trip) metricEls.trip.textContent = String(byType.trip || 0);
  }

  function renderRecords() {
    if (!recordList) return;
    updateMetrics();
    const visible = getVisibleRecords();
    if (!visible.length) {
      recordList.innerHTML = '<div class="management-empty">No matching management items yet.</div>';
      return;
    }

    recordList.innerHTML = visible
      .map((record) => {
        const meta = [
          record.owner ? `Owner: ${record.owner}` : "",
          record.contactName || record.contactEmail || "",
          record.dueDate ? `Due ${formatDate(record.dueDate)}` : "",
          record.relatedEvent || "",
        ].filter(Boolean);
        const note = String(record.notes || "").trim();
        const summary = note.length > 180 ? `${note.slice(0, 180)}...` : note;
        return `
          <article class="management-record ${record.id === state.selectedId ? "is-selected" : ""}" data-record-id="${escapeHtml(record.id)}">
            <div>
              <div class="management-record-badges">
                <span class="management-badge">${escapeHtml(formatLabel(record.recordType))}</span>
                <span class="management-badge is-${escapeHtml(record.status)}">${escapeHtml(formatLabel(record.status))}</span>
                <span class="management-badge is-${escapeHtml(record.priority)}">${escapeHtml(formatLabel(record.priority))}</span>
              </div>
              <h3>${escapeHtml(record.title)}</h3>
              ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
              ${meta.length ? `<div class="management-record-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
            </div>
            <div class="management-record-actions">
              <select data-status-change="${escapeHtml(record.id)}" aria-label="Change status for ${escapeHtml(record.title)}">
                ${["new", "active", "waiting", "scheduled", "complete", "archived"]
                  .map((status) => `<option value="${status}" ${record.status === status ? "selected" : ""}>${formatLabel(status)}</option>`)
                  .join("")}
              </select>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function readFormRecord() {
    const formData = new FormData(recordForm);
    return {
      id: String(formData.get("id") || "").trim(),
      recordType: String(formData.get("recordType") || "inquiry"),
      title: String(formData.get("title") || "").trim(),
      status: String(formData.get("status") || "new"),
      priority: String(formData.get("priority") || "normal"),
      owner: String(formData.get("owner") || "").trim(),
      contactName: String(formData.get("contactName") || "").trim(),
      contactEmail: String(formData.get("contactEmail") || "").trim(),
      contactPhone: String(formData.get("contactPhone") || "").trim(),
      dueDate: String(formData.get("dueDate") || "").trim(),
      relatedEvent: String(formData.get("relatedEvent") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
    };
  }

  function fillForm(record = null) {
    if (!recordForm) return;
    recordForm.reset();
    const item = record || {
      id: "",
      recordType: "inquiry",
      status: "new",
      priority: "normal",
    };
    Object.entries(item).forEach(([key, value]) => {
      const field = recordForm.elements[key];
      if (field) field.value = value == null ? "" : String(value);
    });
    state.selectedId = item.id || "";
    if (editorTitle) editorTitle.textContent = state.selectedId ? "Edit Item" : "New Item";
    if (deleteButton) deleteButton.hidden = !state.selectedId;
    setStatus(recordStatus, "");
    renderRecords();
  }

  async function loadRecords({ silent = false } = {}) {
    state.loading = true;
    if (!silent) setStatus(recordStatus, "Loading...");
    const resp = await apiFetch(`${managementUrl}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
    }).catch(() => null);
    state.loading = false;
    if (!resp || resp.status === 401) {
      setToken("");
      showAuthed(false);
      setStatus(loginStatus, "Please log in.", "error");
      return false;
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      setStatus(recordStatus, data.error || "Could not load management records.", "error");
      return false;
    }
    state.records = Array.isArray(data.items) ? data.items : [];
    setStatus(recordStatus, silent ? "" : "Loaded.", "success");
    renderRecords();
    return true;
  }

  async function saveRecord(event) {
    event.preventDefault();
    const record = readFormRecord();
    if (!record.title) {
      setStatus(recordStatus, "Title is required.", "error");
      return;
    }
    const isUpdate = Boolean(record.id);
    const url = isUpdate ? `${managementUrl}/${encodeURIComponent(record.id)}` : managementUrl;
    setStatus(recordStatus, "Saving...");
    const resp = await apiFetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok || !data.ok) {
      setStatus(recordStatus, data.error || "Could not save item.", "error");
      return;
    }
    const saved = data.item;
    const index = state.records.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      state.records[index] = saved;
    } else {
      state.records.unshift(saved);
    }
    fillForm(saved);
    setStatus(recordStatus, "Saved.", "success");
  }

  async function deleteSelectedRecord() {
    const id = state.selectedId;
    if (!id) return;
    const record = state.records.find((item) => item.id === id);
    const name = record ? record.title : "this item";
    if (!window.confirm(`Delete "${name}"?`)) return;
    setStatus(recordStatus, "Deleting...");
    const resp = await apiFetch(`${managementUrl}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok || !data.ok) {
      setStatus(recordStatus, data.error || "Could not delete item.", "error");
      return;
    }
    state.records = state.records.filter((item) => item.id !== id);
    fillForm();
    setStatus(recordStatus, "Deleted.", "success");
  }

  async function updateRecordStatus(id, status) {
    const record = state.records.find((item) => item.id === id);
    if (!record || record.status === status) return;
    const next = { ...record, status };
    const resp = await apiFetch(`${managementUrl}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record: next }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok || !data.ok) {
      setStatus(recordStatus, data.error || "Could not update status.", "error");
      renderRecords();
      return;
    }
    const index = state.records.findIndex((item) => item.id === id);
    if (index >= 0) state.records[index] = data.item;
    if (state.selectedId === id) fillForm(data.item);
    setStatus(recordStatus, "Status updated.", "success");
    renderRecords();
  }

  async function login(event) {
    event.preventDefault();
    const formData = new FormData(loginForm);
    setStatus(loginStatus, "Signing in...");
    const resp = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: String(formData.get("user") || ""),
        pass: String(formData.get("pass") || ""),
      }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok || !data.ok || !data.token) {
      setStatus(loginStatus, data.error || "Login failed.", "error");
      return;
    }
    setToken(data.token);
    setStatus(loginStatus, "");
    showAuthed(true);
    await loadRecords();
  }

  function bindEvents() {
    if (loginForm) loginForm.addEventListener("submit", login);
    if (recordForm) recordForm.addEventListener("submit", saveRecord);
    if (deleteButton) deleteButton.addEventListener("click", deleteSelectedRecord);
    const newButton = app.querySelector("[data-new-record]");
    if (newButton) newButton.addEventListener("click", () => fillForm());
    const refreshButton = app.querySelector("[data-refresh-records]");
    if (refreshButton) refreshButton.addEventListener("click", () => loadRecords());
    const logoutButton = app.querySelector("[data-logout]");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        setToken("");
        state.records = [];
        fillForm();
        showAuthed(false);
      });
    }
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value || "";
        renderRecords();
      });
    }
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.filterType = button.getAttribute("data-filter-type") || "all";
        filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
        renderRecords();
      });
    });
    if (recordList) {
      recordList.addEventListener("click", (event) => {
        const statusSelect = event.target.closest("[data-status-change]");
        if (statusSelect) {
          event.stopPropagation();
          updateRecordStatus(statusSelect.getAttribute("data-status-change"), statusSelect.value);
          return;
        }
        const card = event.target.closest("[data-record-id]");
        if (!card) return;
        const id = card.getAttribute("data-record-id") || "";
        const record = state.records.find((item) => item.id === id);
        if (record) fillForm(record);
      });
    }
  }

  async function init() {
    bindEvents();
    fillForm();
    if (!getToken()) {
      showAuthed(false);
      return;
    }
    showAuthed(true);
    await loadRecords({ silent: true });
  }

  init();
})();
