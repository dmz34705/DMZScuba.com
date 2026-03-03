(() => {
  const adminRoot = document.querySelector("[data-events-admin-page]");
  if (!adminRoot) return;

  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const publicUrl = apiRoot ? `${apiRoot}/api/v2/events` : "/api/v2/events";
  const adminUrl = apiRoot ? `${apiRoot}/api/admin/v2/events` : "/api/admin/v2/events";
  const fallbackUrl = adminRoot.getAttribute("data-events-fallback") || "/assets/data/events.json";
  const tokenStorageKey = "dmzMediaToken";

  const panel = document.getElementById("eventsAdminPanel");
  if (!panel) return;

  const triggerBtn = document.querySelector(".events-admin-trigger");
  const closeBtn = panel.querySelector(".events-admin-close");
  const statusEl = document.getElementById("eventsAdminStatus");
  const validationEl = document.getElementById("eventsAdminValidation");
  const loginBtn = panel.querySelector(".events-admin-login");
  const logoutBtn = panel.querySelector(".events-admin-logout");
  const addTemplateBtn = panel.querySelector(".events-admin-add-template");
  const addEventBtn = panel.querySelector(".events-admin-add-event");
  const saveBtn = panel.querySelector(".events-admin-save");
  const refreshBtn = panel.querySelector(".events-admin-refresh");
  const clearLiveBtn = panel.querySelector(".events-admin-clear-live");
  const deleteBtn = panel.querySelector(".events-admin-delete");
  const searchInput = document.getElementById("eventsAdminSearch");
  const selectEl = document.getElementById("eventsAdminSelect");

  const fieldUpdated = document.getElementById("eventsConfigUpdated");
  const fieldTimezone = document.getElementById("eventsConfigTimezone");
  const fieldHorizon = document.getElementById("eventsConfigHorizon");
  const fieldPreview = document.getElementById("eventsConfigPreview");

  const fieldKind = document.getElementById("eventsFieldKind");
  const fieldId = document.getElementById("eventsFieldId");
  const fieldTitle = document.getElementById("eventsFieldTitle");
  const fieldDate = document.getElementById("eventsFieldDate");
  const fieldStartMonth = document.getElementById("eventsFieldStartMonth");
  const fieldTime = document.getElementById("eventsFieldTime");
  const fieldEndTime = document.getElementById("eventsFieldEndTime");
  const fieldType = document.getElementById("eventsFieldType");
  const fieldStatus = document.getElementById("eventsFieldStatus");
  const fieldLocation = document.getElementById("eventsFieldLocation");
  const fieldSummary = document.getElementById("eventsFieldSummary");
  const fieldCtaLabel = document.getElementById("eventsFieldCtaLabel");
  const fieldCtaHref = document.getElementById("eventsFieldCtaHref");
  const fieldInterval = document.getElementById("eventsFieldIntervalMonths");
  const fieldMonths = document.getElementById("eventsFieldMonths");
  const fieldWeek = document.getElementById("eventsFieldWeekOfMonth");
  const fieldWeekday = document.getElementById("eventsFieldWeekday");
  const kindOnlyRows = panel.querySelectorAll("[data-events-kind-only]");

  let payload = null;
  let selectedKey = "";

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

  function isAuthed() {
    return Boolean(getToken());
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  function setStatus(text, tone = "neutral") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("is-neutral", "is-ready", "is-saving", "is-saved", "is-error");
    statusEl.classList.add(`is-${tone}`);
  }

  function showValidation(message, isError = false) {
    if (!validationEl) return;
    validationEl.textContent = message || "";
    validationEl.classList.toggle("is-error", Boolean(isError));
  }

  function toggleOpen(next) {
    document.body.classList.toggle("events-admin-open", Boolean(next));
    if (triggerBtn) triggerBtn.setAttribute("aria-expanded", next ? "true" : "false");
  }

  function syncAuthUi() {
    const authed = isAuthed();
    document.body.classList.toggle("events-authenticated", authed);
    if (triggerBtn) triggerBtn.textContent = authed ? "Edit Calendar" : "DMZ Login";
    if (loginBtn) loginBtn.style.display = authed ? "none" : "";
    if (logoutBtn) logoutBtn.style.display = authed ? "" : "none";
    if (saveBtn) saveBtn.disabled = !authed;
    if (addTemplateBtn) addTemplateBtn.disabled = !authed;
    if (addEventBtn) addEventBtn.disabled = !authed;
    if (deleteBtn) deleteBtn.disabled = !authed || !selectedKey;
    if (clearLiveBtn) clearLiveBtn.disabled = !authed;
  }

  function clonePayload(input) {
    return {
      updated: String((input && input.updated) || "").trim(),
      timezone: String((input && input.timezone) || "America/Chicago").trim(),
      horizonMonths: Math.max(1, Number((input && input.horizonMonths) || 30) || 30),
      previewCount: Math.max(1, Number((input && input.previewCount) || 3) || 3),
      events: Array.isArray(input && input.events) ? input.events.map((item) => ({ ...item })) : [],
      templates: Array.isArray(input && input.templates) ? input.templates.map((item) => ({ ...item })) : [],
    };
  }

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function listToCsv(list) {
    return (Array.isArray(list) ? list : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  function csvToMonthList(value) {
    return String(value || "")
      .split(",")
      .map((part) => Math.trunc(Number(part.trim())))
      .filter((month) => Number.isFinite(month) && month >= 1 && month <= 12);
  }

  function getEntries() {
    if (!payload) return [];
    const templates = payload.templates.map((item, index) => ({
      key: `template:${item.id}`,
      kind: "template",
      index,
      item,
    }));
    const events = payload.events.map((item, index) => ({
      key: `event:${item.id}`,
      kind: "event",
      index,
      item,
    }));
    return [...templates, ...events];
  }

  function getEntryByKey(key) {
    return getEntries().find((entry) => entry.key === key) || null;
  }

  function getSelectedEntry() {
    return getEntryByKey(selectedKey);
  }

  function updateKindFields(kind) {
    kindOnlyRows.forEach((row) => {
      const targetKind = row.getAttribute("data-events-kind-only");
      row.hidden = targetKind !== kind;
    });
  }

  function fillConfig() {
    if (!payload) return;
    if (fieldUpdated) fieldUpdated.value = payload.updated || "";
    if (fieldTimezone) fieldTimezone.value = payload.timezone || "America/Chicago";
    if (fieldHorizon) fieldHorizon.value = String(payload.horizonMonths || 30);
    if (fieldPreview) fieldPreview.value = String(payload.previewCount || 3);
  }

  function clearForm() {
    if (fieldKind) fieldKind.value = "template";
    if (fieldId) fieldId.value = "";
    if (fieldTitle) fieldTitle.value = "";
    if (fieldDate) fieldDate.value = "";
    if (fieldStartMonth) fieldStartMonth.value = "";
    if (fieldTime) fieldTime.value = "";
    if (fieldEndTime) fieldEndTime.value = "";
    if (fieldType) fieldType.value = "Training";
    if (fieldStatus) fieldStatus.value = "Planned";
    if (fieldLocation) fieldLocation.value = "";
    if (fieldSummary) fieldSummary.value = "";
    if (fieldCtaLabel) fieldCtaLabel.value = "";
    if (fieldCtaHref) fieldCtaHref.value = "";
    if (fieldInterval) fieldInterval.value = "1";
    if (fieldMonths) fieldMonths.value = "";
    if (fieldWeek) fieldWeek.value = "1";
    if (fieldWeekday) fieldWeekday.value = "2";
    updateKindFields("template");
  }

  function fillForm(entry) {
    if (!entry) {
      clearForm();
      return;
    }
    const item = entry.item || {};
    if (fieldKind) fieldKind.value = entry.kind;
    if (fieldId) fieldId.value = item.id || "";
    if (fieldTitle) fieldTitle.value = item.title || "";
    if (fieldDate) fieldDate.value = entry.kind === "event" ? (item.date || "") : "";
    if (fieldStartMonth) fieldStartMonth.value = entry.kind === "template" ? (item.startMonth || "") : "";
    if (fieldTime) fieldTime.value = item.time || "";
    if (fieldEndTime) fieldEndTime.value = item.endTime || "";
    if (fieldType) fieldType.value = item.type || "Training";
    if (fieldStatus) fieldStatus.value = item.status || "Planned";
    if (fieldLocation) fieldLocation.value = item.location || "";
    if (fieldSummary) fieldSummary.value = item.summary || "";
    if (fieldCtaLabel) fieldCtaLabel.value = item.ctaLabel || "";
    if (fieldCtaHref) fieldCtaHref.value = item.ctaHref || "";
    if (fieldInterval) fieldInterval.value = String(item.intervalMonths || 1);
    if (fieldMonths) fieldMonths.value = listToCsv(item.months);
    if (fieldWeek) fieldWeek.value = String((item.rule && item.rule.weekOfMonth) || 1);
    if (fieldWeekday) fieldWeekday.value = String((item.rule && item.rule.weekday) || 2);
    updateKindFields(entry.kind);
  }

  function commitConfig() {
    if (!payload) return;
    payload.updated = String((fieldUpdated && fieldUpdated.value) || "").trim() || new Date().toISOString().slice(0, 10);
    payload.timezone = String((fieldTimezone && fieldTimezone.value) || "").trim() || "America/Chicago";
    payload.horizonMonths = Math.max(1, Math.min(60, Number((fieldHorizon && fieldHorizon.value) || 30) || 30));
    payload.previewCount = Math.max(1, Math.min(12, Number((fieldPreview && fieldPreview.value) || 3) || 3));
  }

  function readFormItem(kind) {
    const id = normalizeId(fieldId ? fieldId.value : "");
    const title = String((fieldTitle && fieldTitle.value) || "").trim();
    if (!id || !title) {
      throw new Error("ID and title are required.");
    }

    const next = {
      id,
      title,
      time: String((fieldTime && fieldTime.value) || "").trim(),
      endTime: String((fieldEndTime && fieldEndTime.value) || "").trim(),
      type: String((fieldType && fieldType.value) || "Event").trim() || "Event",
      status: String((fieldStatus && fieldStatus.value) || "").trim(),
      location: String((fieldLocation && fieldLocation.value) || "").trim(),
      summary: String((fieldSummary && fieldSummary.value) || "").trim(),
      ctaLabel: String((fieldCtaLabel && fieldCtaLabel.value) || "").trim(),
      ctaHref: String((fieldCtaHref && fieldCtaHref.value) || "").trim(),
    };

    if (kind === "event") {
      const dateValue = String((fieldDate && fieldDate.value) || "").trim();
      if (!dateValue) throw new Error("A one-time event needs a date.");
      next.date = dateValue;
      return next;
    }

    const startMonthValue = String((fieldStartMonth && fieldStartMonth.value) || "").trim();
    if (!startMonthValue) throw new Error("A recurring template needs a start month.");
    next.startMonth = startMonthValue;
    next.intervalMonths = Math.max(1, Math.min(12, Number((fieldInterval && fieldInterval.value) || 1) || 1));
    const months = csvToMonthList(fieldMonths ? fieldMonths.value : "");
    if (months.length) next.months = months;
    next.rule = {
      weekOfMonth: Math.max(1, Math.min(5, Number((fieldWeek && fieldWeek.value) || 1) || 1)),
      weekday: Math.max(0, Math.min(6, Number((fieldWeekday && fieldWeekday.value) || 0) || 0)),
    };
    return next;
  }

  function commitSelectedForm() {
    if (!payload || !selectedKey) return;
    const entry = getSelectedEntry();
    if (!entry) return;
    const desiredKind = String((fieldKind && fieldKind.value) || entry.kind).trim() === "event" ? "event" : "template";
    const nextItem = readFormItem(desiredKind);
    const currentList = entry.kind === "template" ? payload.templates : payload.events;
    currentList.splice(entry.index, 1);
    const nextList = desiredKind === "template" ? payload.templates : payload.events;
    nextList.push(nextItem);
    const nextKey = `${desiredKind}:${nextItem.id}`;
    if (selectedKey !== nextKey) selectedKey = nextKey;
  }

  function renderList(filterText = "") {
    if (!selectEl) return;
    const filter = String(filterText || "").trim().toLowerCase();
    const entries = getEntries()
      .filter((entry) => {
        if (!filter) return true;
        const hay = `${entry.item.id || ""} ${entry.item.title || ""} ${entry.item.type || ""}`.toLowerCase();
        return hay.includes(filter);
      })
      .sort((a, b) => {
        const aLabel = `${a.kind} ${a.item.title || a.item.id || ""}`;
        const bLabel = `${b.kind} ${b.item.title || b.item.id || ""}`;
        return aLabel.localeCompare(bLabel);
      });

    selectEl.innerHTML = "";
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.key;
      option.textContent = `${entry.kind === "template" ? "Recurring" : "One-Time"} | ${entry.item.title || entry.item.id}`;
      if (entry.key === selectedKey) option.selected = true;
      selectEl.appendChild(option);
    });

    if (!entries.some((entry) => entry.key === selectedKey)) {
      selectedKey = entries[0] ? entries[0].key : "";
    }
    if (selectEl.value !== selectedKey) selectEl.value = selectedKey;
    fillForm(getSelectedEntry());
    syncAuthUi();
  }

  function reloadEmbed() {
    const frame = document.querySelector("[data-events-embed-frame]");
    if (!frame) return;
    const src = frame.getAttribute("src") || "";
    frame.setAttribute("src", src);
  }

  async function loadPayload() {
    setStatus("Loading...", "saving");
    showValidation("");
    let data = null;
    try {
      const resp = await fetch(`${publicUrl}?t=${Date.now()}`, { cache: "no-store" });
      if (resp.ok) {
        data = await resp.json().catch(() => null);
      }
    } catch (_error) {
      data = null;
    }
    if (!data) {
      const fallbackResp = await fetch(`${fallbackUrl}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
      if (!fallbackResp || !fallbackResp.ok) {
        setStatus("Load failed", "error");
        showValidation("Could not load event data.", true);
        return;
      }
      data = await fallbackResp.json().catch(() => null);
    }
    payload = clonePayload(data || {});
    fillConfig();
    if (!selectedKey) {
      const first = getEntries()[0];
      selectedKey = first ? first.key : "";
    }
    renderList(searchInput ? searchInput.value : "");
    setStatus(isAuthed() ? "Ready" : "Signed out", isAuthed() ? "ready" : "neutral");
  }

  function createEntry(kind) {
    if (!isAuthed()) {
      buildLoginModal(() => createEntry(kind));
      return;
    }
    if (!payload) payload = clonePayload({});
    try {
      commitSelectedForm();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Current entry is invalid.", true);
      return;
    }
    commitConfig();
    const stamp = Date.now().toString().slice(-5);
    if (kind === "template") {
      payload.templates.push({
        id: `event-template-${stamp}`,
        title: "New Recurring Event",
        startMonth: new Date().toISOString().slice(0, 7),
        intervalMonths: 1,
        type: "Training",
        status: "Planned",
        location: "",
        summary: "",
        ctaLabel: "",
        ctaHref: "",
        rule: { weekOfMonth: 1, weekday: 2 },
      });
      selectedKey = `template:event-template-${stamp}`;
    } else {
      payload.events.push({
        id: `event-${stamp}`,
        title: "New One-Time Event",
        date: new Date().toISOString().slice(0, 10),
        time: "",
        endTime: "",
        type: "Event",
        status: "Planned",
        location: "",
        summary: "",
        ctaLabel: "",
        ctaHref: "",
      });
      selectedKey = `event:event-${stamp}`;
    }
    renderList(searchInput ? searchInput.value : "");
    showValidation("New draft item added. Save changes to publish it.");
    setStatus("Draft", "neutral");
  }

  function deleteSelected() {
    if (!isAuthed()) {
      buildLoginModal(deleteSelected);
      return;
    }
    const entry = getSelectedEntry();
    if (!entry) return;
    if (!window.confirm(`Delete ${entry.item.title || entry.item.id}?`)) return;
    const targetList = entry.kind === "template" ? payload.templates : payload.events;
    targetList.splice(entry.index, 1);
    selectedKey = "";
    renderList(searchInput ? searchInput.value : "");
    showValidation("Item removed from draft. Save changes to publish.");
    setStatus("Draft", "neutral");
  }

  async function saveAll() {
    if (!isAuthed()) {
      buildLoginModal(saveAll);
      return;
    }
    if (!payload) return;
    try {
      commitSelectedForm();
      commitConfig();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Fix the selected item before saving.", true);
      setStatus("Save blocked", "error");
      return;
    }

    payload.updated = new Date().toISOString().slice(0, 10);
    fillConfig();
    setStatus("Saving...", "saving");
    showValidation("");

    const resp = await apiFetch(adminUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    }).catch(() => null);

    if (!resp || !resp.ok) {
      const errorData = resp ? await resp.json().catch(() => ({})) : {};
      setStatus("Save failed", "error");
      showValidation(errorData.error || "Save failed.", true);
      return;
    }

    const json = await resp.json().catch(() => ({}));
    payload = clonePayload(json && json.payload ? json.payload : payload);
    renderList(searchInput ? searchInput.value : "");
    fillConfig();
    reloadEmbed();
    setStatus("Saved", "saved");
    showValidation("Calendar saved and the embedded view was reloaded.");
  }

  async function clearLiveData() {
    if (!isAuthed()) {
      buildLoginModal(clearLiveData);
      return;
    }
    if (!window.confirm("Clear the Worker-backed calendar and fall back to the static JSON file?")) return;
    setStatus("Resetting...", "saving");
    const resp = await apiFetch(adminUrl, { method: "DELETE" }).catch(() => null);
    if (!resp || !resp.ok) {
      setStatus("Reset failed", "error");
      showValidation("Could not clear the live event payload.", true);
      return;
    }
    await loadPayload();
    reloadEmbed();
    showValidation("Worker-backed calendar cleared. Static file fallback is active again.");
  }

  function buildLoginModal(onSuccess) {
    if (document.querySelector(".events-auth-modal")) return;
    const overlay = document.createElement("div");
    overlay.className = "events-auth-modal";
    overlay.innerHTML = `
      <div class="events-auth-card">
        <h3>DMZ Admin</h3>
        <p>Sign in to edit the event calendar.</p>
        <form class="events-auth-form">
          <label>Username<input type="text" autocomplete="username" required /></label>
          <label>Password<input type="password" autocomplete="current-password" required /></label>
          <p class="events-auth-error" data-error></p>
          <div class="events-auth-actions">
            <button type="button" class="btn secondary events-auth-cancel">Cancel</button>
            <button type="submit" class="btn primary">Sign In</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const inputs = form ? form.querySelectorAll("input") : [];
    const errorEl = overlay.querySelector("[data-error]");
    const cancel = overlay.querySelector(".events-auth-cancel");

    const close = () => overlay.remove();
    if (cancel) cancel.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (errorEl) errorEl.textContent = "";
        const user = inputs[0] ? inputs[0].value.trim() : "";
        const pass = inputs[1] ? inputs[1].value : "";
        const resp = await fetch(apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user, pass }),
        }).catch(() => null);
        if (!resp || !resp.ok) {
          if (errorEl) errorEl.textContent = "Login failed.";
          return;
        }
        const json = await resp.json().catch(() => ({}));
        if (!json.token) {
          if (errorEl) errorEl.textContent = "Login failed.";
          return;
        }
        setToken(json.token);
        syncAuthUi();
        setStatus("Ready", "ready");
        close();
        if (typeof onSuccess === "function") onSuccess();
      });
    }
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      if (!isAuthed()) {
        buildLoginModal(() => toggleOpen(true));
        return;
      }
      toggleOpen(!document.body.classList.contains("events-admin-open"));
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", () => toggleOpen(false));
  }
  if (loginBtn) {
    loginBtn.addEventListener("click", () => buildLoginModal(() => toggleOpen(true)));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      setToken("");
      syncAuthUi();
      setStatus("Signed out", "neutral");
      showValidation("Logged out.");
    });
  }
  if (addTemplateBtn) addTemplateBtn.addEventListener("click", () => createEntry("template"));
  if (addEventBtn) addEventBtn.addEventListener("click", () => createEntry("event"));
  if (saveBtn) saveBtn.addEventListener("click", saveAll);
  if (refreshBtn) refreshBtn.addEventListener("click", loadPayload);
  if (clearLiveBtn) clearLiveBtn.addEventListener("click", clearLiveData);
  if (deleteBtn) deleteBtn.addEventListener("click", deleteSelected);

  if (selectEl) {
    selectEl.addEventListener("change", () => {
      try {
        commitSelectedForm();
      } catch (_error) {
        // Keep the previous draft value even if invalid until the user fixes it.
      }
      selectedKey = selectEl.value;
      fillForm(getSelectedEntry());
      syncAuthUi();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
    });
  }

  if (fieldKind) {
    fieldKind.addEventListener("change", () => {
      updateKindFields(fieldKind.value);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleOpen(false);
  });

  clearForm();
  syncAuthUi();
  setStatus(isAuthed() ? "Ready" : "Signed out", isAuthed() ? "ready" : "neutral");
  loadPayload();
})();
