(() => {
  const adminRoot = document.querySelector("[data-events-admin-page]");
  if (!adminRoot) return;

  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const publicUrl = apiRoot ? `${apiRoot}/api/v2/events` : "/api/v2/events";
  const adminUrl = apiRoot ? `${apiRoot}/api/admin/v2/events` : "/api/admin/v2/events";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const fallbackUrl = adminRoot.getAttribute("data-events-fallback") || "/assets/data/events.json";
  const tokenStorageKey = "dmzMediaToken";

  const adminBar = document.getElementById("eventsAdminBar");
  const panel = document.getElementById("eventsAdminPanel");
  if (!adminBar || !panel) return;

  const triggerBtn = document.querySelector(".events-admin-trigger");
  const closeBtn = panel.querySelector(".events-admin-close");
  const statusEl = document.getElementById("eventsAdminStatus");
  const focusEl = document.getElementById("eventsAdminFocus");
  const warningEl = document.getElementById("eventsAdminWarning");
  const validationEl = document.getElementById("eventsAdminValidation");
  const modalNoteEl = document.getElementById("eventsAdminModalNote");
  const contextBadgeEl = document.getElementById("eventsAdminContextBadge");
  const contextTitleEl = document.getElementById("eventsAdminContextTitle");
  const contextMetaEl = document.getElementById("eventsAdminContextMeta");
  const contextHintEl = document.getElementById("eventsAdminContextHint");

  const logoutBtn = adminBar.querySelector(".events-admin-logout");
  const addTemplateBtn = adminBar.querySelector(".events-admin-add-template");
  const addEventBtn = adminBar.querySelector(".events-admin-add-event");
  const saveBtn = adminBar.querySelector(".events-admin-save");
  const refreshBtn = adminBar.querySelector(".events-admin-refresh");
  const clearLiveBtn = adminBar.querySelector(".events-admin-clear-live");
  const deleteBtn = panel.querySelector(".events-admin-delete");
  const searchInput = document.getElementById("eventsAdminSearch");
  const selectEl = document.getElementById("eventsAdminSelect");
  const advancedDetails = document.getElementById("eventsAdminAdvanced");

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
  let editMode = false;
  let isDirty = false;
  let selectionContext = {
    requestedDate: "",
    openedFromDate: false,
    resolvedFromTemplate: false,
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

  function setFocus(text) {
    if (!focusEl) return;
    focusEl.textContent = text || "Select a date in the calendar to edit it.";
  }

  function setModalNote(text) {
    if (!modalNoteEl) return;
    modalNoteEl.textContent = text || "Pick a date in the calendar while edit mode is active to jump straight into that event.";
  }

  function setDirty(next, customMessage) {
    isDirty = Boolean(next);
    if (!warningEl) return;
    warningEl.textContent =
      customMessage ||
      (isDirty
        ? "Unpublished changes are in draft. Publish when you are ready."
        : "No unpublished changes yet.");
    warningEl.classList.toggle("is-dirty", isDirty);
    warningEl.classList.toggle("is-clean", !isDirty);
  }

  function showValidation(message, isError = false) {
    if (!validationEl) return;
    validationEl.textContent = message || "";
    validationEl.classList.toggle("is-error", Boolean(isError));
  }

  function setEditMode(next) {
    editMode = Boolean(next) && isAuthed();
    document.body.classList.toggle("events-admin-enabled", editMode);
    adminBar.hidden = !editMode;
    if (!editMode) toggleOpen(false);
    syncAuthUi();
  }

  function toggleOpen(next) {
    const shouldOpen = Boolean(next) && isAuthed() && editMode;
    document.body.classList.toggle("events-admin-open", shouldOpen);
    panel.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  }

  function syncAuthUi() {
    const authed = isAuthed();
    document.body.classList.toggle("events-authenticated", authed);
    if (!authed) {
      editMode = false;
      adminBar.hidden = true;
      document.body.classList.remove("events-admin-enabled", "events-admin-open");
      panel.setAttribute("aria-hidden", "true");
    }

    if (triggerBtn) {
      triggerBtn.textContent = authed ? "Edit Calendar" : "DMZ Login";
      triggerBtn.setAttribute("aria-expanded", editMode ? "true" : "false");
    }

    const disableWrite = !authed;
    if (saveBtn) saveBtn.disabled = disableWrite;
    if (addTemplateBtn) addTemplateBtn.disabled = disableWrite;
    if (addEventBtn) addEventBtn.disabled = disableWrite;
    if (deleteBtn) deleteBtn.disabled = disableWrite || !selectedKey;
    if (clearLiveBtn) clearLiveBtn.disabled = disableWrite;
    if (refreshBtn) refreshBtn.disabled = false;
    if (logoutBtn) logoutBtn.disabled = !authed;

    if (!authed) {
      setFocus("Sign in to enable calendar editing.");
      setModalNote();
      setStatus("Signed out", "neutral");
    } else if (!editMode) {
      setFocus("Edit mode is ready. Use the footer button to turn it on.");
    }
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

  function resetSelectionContext() {
    selectionContext = {
      requestedDate: "",
      openedFromDate: false,
      resolvedFromTemplate: false,
    };
  }

  function setSelectionContext(next = {}) {
    selectionContext = {
      requestedDate: String(next.requestedDate || "").trim(),
      openedFromDate: Boolean(next.openedFromDate),
      resolvedFromTemplate: Boolean(next.resolvedFromTemplate),
    };
  }

  function formatDateLabel(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const stamp = `${raw}T12:00:00`;
    const parsed = new Date(stamp);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getWeekdayName(value) {
    const index = Math.max(0, Math.min(6, Number(value) || 0));
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index];
  }

  function ordinal(value) {
    const num = Math.max(1, Number(value) || 1);
    if (num % 100 >= 11 && num % 100 <= 13) return `${num}th`;
    if (num % 10 === 1) return `${num}st`;
    if (num % 10 === 2) return `${num}nd`;
    if (num % 10 === 3) return `${num}rd`;
    return `${num}th`;
  }

  function describeTemplateRule(item) {
    if (!item) return "Recurring schedule";
    const rule = item.rule || {};
    const weekPart = `${ordinal(rule.weekOfMonth)} ${getWeekdayName(rule.weekday)}`;
    const interval = Math.max(1, Number(item.intervalMonths) || 1);
    const intervalPart = interval === 1 ? "every month" : `every ${interval} months`;
    const startPart = item.startMonth ? `starting ${item.startMonth}` : "with no start month yet";
    if (Array.isArray(item.months) && item.months.length) {
      return `${weekPart}, ${intervalPart}, limited to months ${item.months.join(", ")}, ${startPart}.`;
    }
    return `${weekPart}, ${intervalPart}, ${startPart}.`;
  }

  function updateContextPanel(entry) {
    if (!contextBadgeEl || !contextTitleEl || !contextMetaEl || !contextHintEl) return;

    if (!entry) {
      contextBadgeEl.textContent = "No Selection";
      contextTitleEl.textContent = "Select an event to start editing.";
      contextMetaEl.textContent = "Choose a saved entry or click a date in edit mode.";
      contextHintEl.textContent = "Date-picked recurring items will call out that changes affect future generated dates.";
      setFocus(editMode ? "Select a date in the calendar to edit it." : "Sign in to enable calendar editing.");
      setModalNote();
      return;
    }

    const item = entry.item || {};
    const activeDate = selectionContext.requestedDate || item.date || "";

    if (entry.kind === "event") {
      contextBadgeEl.textContent = selectionContext.openedFromDate ? "Date Selection" : "One-Time Event";
      contextTitleEl.textContent = activeDate
        ? `Editing the one-time event for ${formatDateLabel(activeDate)}.`
        : `Editing one-time event: ${item.title || item.id || "Untitled"}.`;
      contextMetaEl.textContent = item.date
        ? `Fixed date: ${formatDateLabel(item.date)}`
        : "This draft still needs a saved date.";
      contextHintEl.textContent = "Changes apply only to this event date.";
      setFocus(`Editing ${item.date || activeDate || "new date draft"}`);
      setModalNote(activeDate ? `Editing the one-time event scheduled for ${formatDateLabel(activeDate)}.` : "Editing the selected one-time event.");
      return;
    }

    contextBadgeEl.textContent = selectionContext.resolvedFromTemplate ? "Recurring Template" : "Template Editor";
    contextTitleEl.textContent = selectionContext.requestedDate
      ? `${formatDateLabel(selectionContext.requestedDate)} is generated by this recurring template.`
      : `Editing recurring template: ${item.title || item.id || "Untitled"}.`;
    contextMetaEl.textContent = describeTemplateRule(item);
    contextHintEl.textContent = selectionContext.requestedDate
      ? "Changes here affect future generated dates that use this template. Existing one-time overrides stay separate."
      : "Template edits shape future generated dates unless a one-time event overrides a specific day.";
    setFocus(`Editing recurring template: ${item.title || item.id || "untitled"}`);
    setModalNote(selectionContext.requestedDate
      ? `The selected date ${formatDateLabel(selectionContext.requestedDate)} maps to this recurring template.`
      : `Editing the recurring template "${item.title || item.id || "untitled"}".`);
  }

  function updateKindFields(kind) {
    kindOnlyRows.forEach((row) => {
      const targetKind = row.getAttribute("data-events-kind-only");
      row.hidden = targetKind !== kind;
    });
    if (advancedDetails) {
      advancedDetails.open = kind === "template";
    }
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
    if (advancedDetails) advancedDetails.open = false;
    resetSelectionContext();
  }

  function fillForm(entry) {
    if (!entry) {
      clearForm();
      updateContextPanel(null);
      return;
    }

    const item = entry.item || {};
    if (fieldKind) fieldKind.value = entry.kind;
    if (fieldId) fieldId.value = item.id || "";
    if (fieldTitle) fieldTitle.value = item.title || "";
    if (fieldDate) fieldDate.value = entry.kind === "event" ? item.date || "" : "";
    if (fieldStartMonth) fieldStartMonth.value = entry.kind === "template" ? item.startMonth || "" : "";
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
    updateContextPanel(entry);
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

  function commitSelectedForm(options = {}) {
    if (!payload || !selectedKey) return;
    const entry = getSelectedEntry();
    if (!entry) return;

    const desiredKind =
      String((fieldKind && fieldKind.value) || entry.kind).trim() === "event" ? "event" : "template";
    const nextItem = readFormItem(desiredKind);

    if (entry.kind === desiredKind) {
      const targetList = desiredKind === "template" ? payload.templates : payload.events;
      targetList[entry.index] = nextItem;
    } else {
      const currentList = entry.kind === "template" ? payload.templates : payload.events;
      currentList.splice(entry.index, 1);
      const nextList = desiredKind === "template" ? payload.templates : payload.events;
      nextList.push(nextItem);
    }

    selectedKey = `${desiredKind}:${nextItem.id}`;
    if (!options.skipDirty) setDirty(true);
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
      setSelectionContext();
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

  async function loadPayload(options = {}) {
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

    if (!options.preserveSelection || !getEntryByKey(selectedKey)) {
      const first = getEntries()[0];
      selectedKey = first ? first.key : "";
    }

    renderList(searchInput ? searchInput.value : "");
    setDirty(false);
    setStatus(isAuthed() ? "Ready" : "Signed out", isAuthed() ? "ready" : "neutral");
  }

  function buildDraftId(prefix, dateValue) {
    const stamp = Date.now().toString().slice(-5);
    const dateChunk = String(dateValue || "").replace(/[^0-9]/g, "").slice(0, 8);
    return normalizeId(`${prefix}-${dateChunk || stamp}-${stamp}`);
  }

  function buildEventDraft(dateValue) {
    const safeDate = String(dateValue || new Date().toISOString().slice(0, 10)).trim();
    return {
      id: buildDraftId("event", safeDate),
      title: "New One-Time Event",
      date: safeDate,
      time: "",
      endTime: "",
      type: "Event",
      status: "Planned",
      location: "",
      summary: "",
      ctaLabel: "",
      ctaHref: "",
    };
  }

  function createEntry(kind, options = {}) {
    if (!isAuthed()) {
      buildLoginModal(() => {
        setEditMode(true);
        createEntry(kind, options);
      });
      return;
    }

    if (!payload) payload = clonePayload({});

    try {
      commitSelectedForm({ skipDirty: true });
      commitConfig();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Current entry is invalid.", true);
      setStatus("Draft blocked", "error");
      return;
    }

    let nextItem;
    let nextKey;
    if (searchInput) searchInput.value = "";
    if (kind === "template") {
      const seedId = buildDraftId("event-template", new Date().toISOString().slice(0, 7));
      nextItem = {
        id: seedId,
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
      };
      payload.templates.push(nextItem);
      nextKey = `template:${seedId}`;
    } else {
      nextItem = options.item || buildEventDraft(options.date);
      payload.events.push(nextItem);
      nextKey = `event:${nextItem.id}`;
    }

    setSelectionContext(options.context || {});
    selectedKey = nextKey;
    renderList(searchInput ? searchInput.value : "");
    setEditMode(true);
    toggleOpen(true);
    setDirty(true);
    setStatus("Draft", "neutral");
    showValidation(options.message || "New draft item added. Publish when you are ready.");
  }

  function findTemplateKeyForDate(dateValue, eventIds) {
    if (!payload || !dateValue || !Array.isArray(eventIds) || !eventIds.length) return "";
    const match = payload.templates.find((item) => eventIds.includes(`${item.id}-${dateValue}`));
    return match ? `template:${match.id}` : "";
  }

  function openEditorForDate(dateValue, eventIds) {
    if (!isAuthed() || !editMode) return;
    if (!payload) payload = clonePayload({});

    try {
      commitSelectedForm({ skipDirty: true });
      commitConfig();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Fix the current draft before changing dates.", true);
      setStatus("Draft blocked", "error");
      return;
    }

    const oneTimeEvent = payload.events.find((item) => item.date === dateValue);
    if (oneTimeEvent) {
      if (searchInput) searchInput.value = "";
      setSelectionContext({
        requestedDate: dateValue,
        openedFromDate: true,
        resolvedFromTemplate: false,
      });
      selectedKey = `event:${oneTimeEvent.id}`;
      renderList(searchInput ? searchInput.value : "");
      toggleOpen(true);
      showValidation("");
      setStatus(isDirty ? "Draft" : "Ready", isDirty ? "neutral" : "ready");
      return;
    }

    const templateKey = findTemplateKeyForDate(dateValue, eventIds);
    if (templateKey) {
      if (searchInput) searchInput.value = "";
      setSelectionContext({
        requestedDate: dateValue,
        openedFromDate: true,
        resolvedFromTemplate: true,
      });
      selectedKey = templateKey;
      renderList(searchInput ? searchInput.value : "");
      toggleOpen(true);
      showValidation("");
      setStatus(isDirty ? "Draft" : "Ready", isDirty ? "neutral" : "ready");
      return;
    }

    createEntry("event", {
      date: dateValue,
      item: buildEventDraft(dateValue),
      context: {
        requestedDate: dateValue,
        openedFromDate: true,
        resolvedFromTemplate: false,
      },
      message: `No saved event matched ${dateValue}. A new one-time draft was created for that date.`,
    });
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
    setDirty(true);
    toggleOpen(Boolean(getEntries().length));
    showValidation("Item removed from draft. Publish when you are ready.");
    setStatus("Draft", "neutral");
  }

  async function saveAll() {
    if (!isAuthed()) {
      buildLoginModal(saveAll);
      return;
    }
    if (!payload) return;

    try {
      commitSelectedForm({ skipDirty: true });
      commitConfig();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Fix the selected item before publishing.", true);
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
    setDirty(false, "Published changes are live.");
    setStatus("Saved", "saved");
    showValidation("Calendar published and the embedded view was reloaded.");
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
    toggleOpen(false);
    setDirty(false, "Live Worker data was cleared. Static file fallback is active.");
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
        const resp = await fetch(loginUrl, {
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
        setEditMode(true);
        setStatus("Ready", "ready");
        close();
        if (typeof onSuccess === "function") onSuccess();
      });
    }
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      if (!isAuthed()) {
        buildLoginModal(() => setEditMode(true));
        return;
      }
      setEditMode(!editMode);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => toggleOpen(false));
  }

  panel.addEventListener("click", (event) => {
    if (event.target === panel) toggleOpen(false);
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      setToken("");
      setDirty(false, "Signed out. Draft tools are closed.");
      showValidation("Logged out.");
      syncAuthUi();
    });
  }

  if (addTemplateBtn) {
    addTemplateBtn.addEventListener("click", () => createEntry("template", { context: { openedFromDate: false, resolvedFromTemplate: false } }));
  }

  if (addEventBtn) {
    addEventBtn.addEventListener("click", () => createEntry("event", { context: { openedFromDate: false, resolvedFromTemplate: false } }));
  }

  if (saveBtn) saveBtn.addEventListener("click", saveAll);

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      if (isDirty && !window.confirm("Discard unpublished changes and reload the current saved calendar?")) {
        return;
      }
      await loadPayload();
      showValidation("Editor reloaded from the latest saved calendar data.");
    });
  }

  if (clearLiveBtn) clearLiveBtn.addEventListener("click", clearLiveData);
  if (deleteBtn) deleteBtn.addEventListener("click", deleteSelected);

  if (selectEl) {
    selectEl.addEventListener("change", () => {
      const nextKey = selectEl.value;
      try {
        commitSelectedForm({ skipDirty: true });
      } catch (error) {
        showValidation(error && error.message ? error.message : "Fix the current entry before switching.", true);
        selectEl.value = selectedKey;
        return;
      }
      setSelectionContext();
      selectedKey = nextKey;
      fillForm(getSelectedEntry());
      syncAuthUi();
      toggleOpen(true);
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
      setDirty(true);
    });
  }

  const trackedFields = [
    fieldUpdated,
    fieldTimezone,
    fieldHorizon,
    fieldPreview,
    fieldId,
    fieldTitle,
    fieldDate,
    fieldStartMonth,
    fieldTime,
    fieldEndTime,
    fieldType,
    fieldStatus,
    fieldLocation,
    fieldSummary,
    fieldCtaLabel,
    fieldCtaHref,
    fieldInterval,
    fieldMonths,
    fieldWeek,
    fieldWeekday,
  ].filter(Boolean);

  trackedFields.forEach((field) => {
    const markDirty = () => {
      setDirty(true);
      setStatus("Draft", "neutral");
    };
    field.addEventListener("input", markDirty);
    field.addEventListener("change", markDirty);
  });

  window.addEventListener("message", (event) => {
    const data = event && event.data;
    if (!data || data.type !== "dmzEventsDateSelected" || !data.date) return;
    openEditorForDate(data.date, Array.isArray(data.eventIds) ? data.eventIds : []);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("events-admin-open")) {
      toggleOpen(false);
    }
  });

  clearForm();
  setDirty(false);
  syncAuthUi();
  loadPayload();
})();
