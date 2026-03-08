(() => {
  const adminRoot = document.querySelector("[data-events-admin-page]");
  if (!adminRoot) return;

  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const publicUrl = apiRoot ? `${apiRoot}/api/v2/events` : "/api/v2/events";
  const adminUrl = apiRoot ? `${apiRoot}/api/admin/v2/events` : "/api/admin/v2/events";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const fallbackUrl = adminRoot.getAttribute("data-events-fallback") || "/assets/data/events.json";
  const tokenStorageKey = "dmzMediaToken";
  const uiStateStorageKey = "dmzEventsAdminUiState";
  const TIME_OPTIONS = Array.from({ length: 48 }, (_unused, index) => {
    const hour24 = Math.floor(index / 2);
    const minute = index % 2 === 0 ? "00" : "30";
    const meridiem = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${minute} ${meridiem}`;
  });
  const EVENT_TAG_OPTIONS = ["Training", "Travel", "Local Dive", "Workshop", "Community"];

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
  const dateFocusedEl = document.getElementById("eventsAdminDateFocused");
  const dateFocusTitleEl = document.getElementById("eventsAdminDateFocusTitle");
  const dateTreeEl = document.getElementById("eventsAdminDateTree");
  const standardEditorEl = document.getElementById("eventsAdminStandardEditor");
  const addForDateBtn = document.getElementById("eventsAdminAddForDate");
  const addRepeatingForDateBtn = document.getElementById("eventsAdminAddRepeatingForDate");
  const contextActionsEl = document.getElementById("eventsAdminContextActions");
  const contextActionsNoteEl = document.getElementById("eventsAdminContextActionsNote");
  const makeOverrideBtn = document.getElementById("eventsAdminMakeOverride");
  const skipOccurrenceBtn = document.getElementById("eventsAdminSkipOccurrence");

  const logoutBtn = adminBar.querySelector(".events-admin-logout");
  const addTemplateBtn = adminBar.querySelector(".events-admin-add-template");
  const addEventBtn = adminBar.querySelector(".events-admin-add-event");
  const saveBtn = adminBar.querySelector(".events-admin-save");
  const refreshBtn = adminBar.querySelector(".events-admin-refresh");
  const clearLiveBtn = adminBar.querySelector(".events-admin-clear-live");
  const deleteBtn = panel.querySelector(".events-admin-delete");
  const searchInput = document.getElementById("eventsAdminSearch");
  const searchClearBtn = document.getElementById("eventsAdminSearchClear");
  const searchStatusEl = document.getElementById("eventsAdminSearchStatus");
  const selectEl = document.getElementById("eventsAdminSelect");
  const advancedDetails = document.getElementById("eventsAdminAdvanced");
  const libraryDetails = document.getElementById("eventsAdminLibrary");
  const pageDetails = document.getElementById("eventsAdminPageDetails");

  const fieldUpdated = document.getElementById("eventsConfigUpdated");
  const fieldTimezone = document.getElementById("eventsConfigTimezone");
  const fieldHorizon = document.getElementById("eventsConfigHorizon");
  const fieldPreview = document.getElementById("eventsConfigPreview");

  const fieldKind = document.getElementById("eventsFieldKind");
  const fieldDefinitionSelect = document.getElementById("eventsDefinitionSelect");
  const definitionHelpEl = document.getElementById("eventsDefinitionHelp");
  const fieldDefinitionEyebrow = document.getElementById("eventsDefinitionEyebrow");
  const fieldDefinitionTitle = document.getElementById("eventsDefinitionTitle");
  const fieldDefinitionSlug = document.getElementById("eventsDefinitionSlug");
  const fieldDefinitionHeroSummary = document.getElementById("eventsDefinitionHeroSummary");
  const fieldDefinitionNarrative = document.getElementById("eventsDefinitionNarrative");
  const fieldDefinitionExperience = document.getElementById("eventsDefinitionExperience");
  const fieldDefinitionScheduleNote = document.getElementById("eventsDefinitionScheduleNote");
  const fieldDefinitionWhatToExpect = document.getElementById("eventsDefinitionWhatToExpect");
  const fieldDefinitionIncluded = document.getElementById("eventsDefinitionIncluded");
  const fieldDefinitionCtaLabel = document.getElementById("eventsDefinitionCtaLabel");
  const fieldDefinitionCtaHref = document.getElementById("eventsDefinitionCtaHref");
  const fieldId = document.getElementById("eventsFieldId");
  const fieldTitle = document.getElementById("eventsFieldTitle");
  const fieldDate = document.getElementById("eventsFieldDate");
  const fieldTemplateAnchor = document.getElementById("eventsFieldTemplateAnchorDate");
  const fieldTime = document.getElementById("eventsFieldTime");
  const fieldEndTime = document.getElementById("eventsFieldEndTime");
  const fieldEndDate = document.getElementById("eventsFieldEndDate");
  const fieldType = document.getElementById("eventsFieldType");
  const fieldStatus = document.getElementById("eventsFieldStatus");
  const fieldLocation = document.getElementById("eventsFieldLocation");
  const fieldSummary = document.getElementById("eventsFieldSummary");
  const fieldRegistrationEnabled = document.getElementById("eventsFieldRegistrationEnabled");
  const fieldRegistrationCapacity = document.getElementById("eventsFieldRegistrationCapacity");
  const fieldCtaLabel = document.getElementById("eventsFieldCtaLabel");
  const fieldCtaHref = document.getElementById("eventsFieldCtaHref");
  const fieldInterval = document.getElementById("eventsFieldIntervalMonths");
  const fieldRepeatUnit = document.getElementById("eventsFieldRepeatUnit");
  const fieldExcludedDates = document.getElementById("eventsFieldExcludedDates");
  const fieldMonths = document.getElementById("eventsFieldMonths");
  const kindOnlyRows = panel.querySelectorAll("[data-events-kind-only]");

  let payload = null;
  let selectedKey = "";
  let editMode = false;
  let isDirty = false;
  let selectionContext = {
    requestedDate: "",
    openedFromDate: false,
    resolvedFromTemplate: false,
    candidateKeys: [],
  };
  const NEW_DEFINITION_OPTION = "__new__";

  function getStoredUiState() {
    try {
      const raw = window.sessionStorage.getItem(uiStateStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function persistUiState() {
    try {
      window.sessionStorage.setItem(
        uiStateStorageKey,
        JSON.stringify({
          editMode: Boolean(editMode),
          panelOpen: document.body.classList.contains("events-admin-open"),
          selectedKey: String(selectedKey || ""),
        })
      );
    } catch (_error) {
      // ignore storage errors
    }
  }

  function clearUiState() {
    window.sessionStorage.removeItem(uiStateStorageKey);
  }

  function getToken() {
    return window.sessionStorage.getItem(tokenStorageKey) || "";
  }

  function setToken(token) {
    if (!token) {
      window.sessionStorage.removeItem(tokenStorageKey);
      clearUiState();
      return;
    }
    window.sessionStorage.setItem(tokenStorageKey, token);
  }

  function isAuthed() {
    return Boolean(getToken());
  }

  async function validateStoredToken() {
    const token = getToken();
    if (!token) return false;
    const resp = await apiFetch(`${adminUrl}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
    }).catch(() => null);
    if (resp && resp.ok) return true;
    setToken("");
    return false;
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

  function setDefinitionHelp(text) {
    if (!definitionHelpEl) return;
    definitionHelpEl.textContent =
      text ||
      'Choose an existing page to reuse it, or pick "Create New Event Page" to make a fresh one for this event.';
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
    adminBar.hidden = !(isAuthed() && editMode);
    adminBar.style.display = adminBar.hidden ? "none" : "";
    if (!editMode) toggleOpen(false);
    syncAuthUi();
    persistUiState();
  }

  function toggleOpen(next) {
    const shouldOpen = Boolean(next) && isAuthed() && editMode;
    document.body.classList.toggle("events-admin-open", shouldOpen);
    panel.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    persistUiState();
  }

  function syncAuthUi() {
    const authed = isAuthed();
    document.body.classList.toggle("events-authenticated", authed);
    adminBar.hidden = !(authed && editMode);
    adminBar.style.display = adminBar.hidden ? "none" : "";
    if (!authed) {
      editMode = false;
      document.body.classList.remove("events-admin-enabled", "events-admin-open");
      panel.setAttribute("aria-hidden", "true");
      adminBar.hidden = true;
      adminBar.style.display = "none";
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
      updateOccurrenceActions(null);
    } else if (!editMode) {
      setFocus("Edit mode is ready. Use the footer button to turn it on.");
      updateOccurrenceActions(getSelectedEntry());
    } else {
      updateOccurrenceActions(getSelectedEntry());
    }
  }

  function clonePayload(input) {
    return {
      updated: String((input && input.updated) || "").trim(),
      timezone: String((input && input.timezone) || "America/Chicago").trim(),
      horizonMonths: Math.max(1, Number((input && input.horizonMonths) || 30) || 30),
      previewCount: Math.max(1, Number((input && input.previewCount) || 3) || 3),
      definitions: Array.isArray(input && input.definitions)
        ? input.definitions.map((item) => ({
            ...item,
            whatToExpect: Array.isArray(item && item.whatToExpect) ? [...item.whatToExpect] : [],
            included: Array.isArray(item && item.included) ? [...item.included] : [],
          }))
        : [],
      events: Array.isArray(input && input.events)
        ? input.events.map((item) => ({ ...item }))
        : [],
      templates: Array.isArray(input && input.templates)
        ? input.templates.map((item) => ({
            ...item,
            rule: item && item.rule ? { ...item.rule } : item.rule,
            months: Array.isArray(item && item.months) ? [...item.months] : item && item.months,
            excludedDates: Array.isArray(item && item.excludedDates)
              ? [...item.excludedDates]
              : item && item.excludedDates,
          }))
        : [],
    };
  }

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function listToLines(list) {
    return (Array.isArray(list) ? list : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  function linesToList(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function linesToDateList(value) {
    return Array.from(
      new Set(
        linesToList(value).filter((item) => Boolean(parseDateValue(item)))
      )
    ).sort();
  }

  function normalizeRepeatUnit(value) {
    const unit = String(value || "").trim().toLowerCase();
    return ["week", "month", "year"].includes(unit) ? unit : "month";
  }

  function normalizeEventType(value) {
    const raw = String(value || "").trim().toLowerCase();
    const match = EVENT_TAG_OPTIONS.find((option) => option.toLowerCase() === raw);
    return match || "Training";
  }

  function buildTimeOptionsMarkup(selectedValue, placeholder = "Select time") {
    const safeValue = String(selectedValue || "").trim();
    const options = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...TIME_OPTIONS.map(
        (value) =>
          `<option value="${value}"${value === safeValue ? " selected" : ""}>${value}</option>`
      ),
    ];
    return options.join("");
  }

  function populateTimeSelect(selectEl, selectedValue, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = buildTimeOptionsMarkup(selectedValue, placeholder);
    selectEl.value = TIME_OPTIONS.includes(String(selectedValue || "").trim())
      ? String(selectedValue || "").trim()
      : "";
  }

  function buildTypeOptionsMarkup(selectedValue) {
    const safeValue = normalizeEventType(selectedValue);
    return EVENT_TAG_OPTIONS.map(
      (value) => `<option value="${value}"${value === safeValue ? " selected" : ""}>${value}</option>`
    ).join("");
  }

  function getFormStartDateValue() {
    return String(
      (fieldDate && fieldDate.value) ||
      (fieldTemplateAnchor && fieldTemplateAnchor.value) ||
      ""
    ).trim();
  }

  function setFormStartDateValue(value) {
    const nextValue = String(value || "").trim();
    if (fieldDate) fieldDate.value = nextValue;
    if (fieldTemplateAnchor && fieldTemplateAnchor !== fieldDate) fieldTemplateAnchor.value = nextValue;
  }

  function addDays(date, count) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
  }

  function parseDateValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parsed = new Date(`${raw}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function buildSuggestedId(kind, titleValue, anchorValue) {
    const titleBase = normalizeId(titleValue);
    const dateChunk = String(anchorValue || "").replace(/[^0-9]/g, "").slice(0, 8);
    const prefix = kind === "template" ? "series" : kind;
    const base = titleBase || prefix;
    return normalizeId(`${base}${dateChunk ? `-${dateChunk}` : `-${Date.now().toString().slice(-5)}`}`);
  }

  function buildDefinitionId(titleValue, anchorValue) {
    const titleBase = normalizeId(titleValue);
    if (titleBase) return titleBase;
    return buildDraftId("eventdef", anchorValue || new Date().toISOString().slice(0, 10));
  }

  function nthWeekdayOfMonth(year, monthIndex, weekOfMonth, weekday) {
    const first = new Date(year, monthIndex, 1);
    const shift = (7 + weekday - first.getDay()) % 7;
    const dayNumber = 1 + shift + (weekOfMonth - 1) * 7;
    const candidate = new Date(year, monthIndex, dayNumber);
    if (candidate.getMonth() !== monthIndex) return null;
    return candidate;
  }

  function getLegacyTemplateAnchorDate(item) {
    if (!item || !item.startMonth || !item.rule) return "";
    const parts = String(item.startMonth).split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return "";
    const weekOfMonth = Number(item.rule.weekOfMonth);
    const weekday = Number(item.rule.weekday);
    const date = nthWeekdayOfMonth(year, month - 1, weekOfMonth, weekday);
    if (!date) return "";
    return date.toISOString().slice(0, 10);
  }

  function getTemplateAnchorDate(item) {
    return String((item && (item.startDate || getLegacyTemplateAnchorDate(item))) || "").trim();
  }

  function getTemplateOccurrenceEndDate(item) {
    const anchor = getTemplateAnchorDate(item);
    if (!anchor) return "";
    const explicitEnd = String((item && item.endDate) || "").trim();
    if (explicitEnd && explicitEnd >= anchor) return explicitEnd;
    const anchorDate = parseDateValue(anchor);
    const durationDays = Math.max(1, Number(item && item.durationDays) || 1);
    if (!anchorDate || durationDays <= 1) return anchor;
    return formatDateKey(addDays(anchorDate, durationDays - 1));
  }

  function getExcludedDates(item) {
    return Array.isArray(item && item.excludedDates)
      ? item.excludedDates
          .map((value) => String(value || "").trim())
          .filter((value) => Boolean(parseDateValue(value)))
          .sort()
      : [];
  }

  function setExcludedDates(item, values) {
    if (!item) return [];
    const next = Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => String(value || "").trim())
          .filter((value) => Boolean(parseDateValue(value)))
      )
    ).sort();
    if (next.length) item.excludedDates = next;
    else delete item.excludedDates;
    return next;
  }

  function addExcludedDate(item, value) {
    const next = getExcludedDates(item);
    const dateValue = String(value || "").trim();
    if (!parseDateValue(dateValue)) return next;
    if (!next.includes(dateValue)) next.push(dateValue);
    return setExcludedDates(item, next);
  }

  function removeExcludedDate(item, value) {
    const dateValue = String(value || "").trim();
    return setExcludedDates(
      item,
      getExcludedDates(item).filter((entry) => entry !== dateValue)
    );
  }

  function getEventLastDate(item) {
    if (!item) return "";
    return String(item.endDate || "").trim();
  }

  function itemCoversDate(item, dateValue) {
    if (!item || !item.date || !dateValue) return false;
    const start = String(item.date || "").trim();
    const end = String(item.endDate || start).trim() || start;
    return start <= dateValue && end >= dateValue;
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
      candidateKeys: [],
    };
  }

  function setSelectionContext(next = {}) {
    selectionContext = {
      requestedDate: String(next.requestedDate || "").trim(),
      openedFromDate: Boolean(next.openedFromDate),
      resolvedFromTemplate: Boolean(next.resolvedFromTemplate),
      candidateKeys: Array.isArray(next.candidateKeys)
        ? next.candidateKeys.map((value) => String(value || "").trim()).filter(Boolean)
        : [],
    };
  }

  function getDateCandidateLabel(entry, dateValue) {
    if (!entry) return "";
    const item = entry.item || {};
    const title = String(item.title || item.id || "Untitled").trim();
    if (entry.kind === "template") return `${title} | Repeats`;
    if (item.endDate && item.endDate > item.date && dateValue && dateValue !== item.date) {
      return `${title} | Multi-day`;
    }
    return `${title} | One-Time`;
  }

  function addRepeatInterval(date, interval, repeatUnit) {
    const safeDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (repeatUnit === "week") return addDays(safeDate, interval * 7);
    if (repeatUnit === "year") {
      safeDate.setFullYear(safeDate.getFullYear() + interval);
      return safeDate;
    }
    safeDate.setMonth(safeDate.getMonth() + interval);
    return safeDate;
  }

  function templateCoversDate(item, dateValue) {
    const targetDate = parseDateValue(dateValue);
    const anchorValue = getTemplateAnchorDate(item);
    const anchorDate = parseDateValue(anchorValue);
    if (!targetDate || !anchorDate || targetDate < anchorDate) return false;

    const repeatInterval = Math.max(1, Number(item && (item.repeatInterval || item.intervalMonths)) || 1);
    const repeatUnit = normalizeRepeatUnit(item && item.repeatUnit);
    const excludedDates = getExcludedDates(item);
    const monthList = Array.isArray(item && item.months) ? item.months.map((value) => Number(value)) : [];
    const templateEndValue = getTemplateOccurrenceEndDate(item) || anchorValue;
    const templateEndDate = parseDateValue(templateEndValue);
    const durationDays =
      templateEndDate && templateEndDate >= anchorDate
        ? Math.max(1, Math.round((templateEndDate.getTime() - anchorDate.getTime()) / 86400000) + 1)
        : 1;

    let occurrenceDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    let guard = 0;
    while (occurrenceDate <= targetDate && guard < 500) {
      const occurrenceKey = formatDateKey(occurrenceDate);
      const inAllowedMonth = !monthList.length || monthList.includes(occurrenceDate.getMonth() + 1);
      if (inAllowedMonth && !excludedDates.includes(occurrenceKey)) {
        const occurrenceEndKey = formatDateKey(addDays(occurrenceDate, durationDays - 1));
        if (occurrenceKey <= dateValue && occurrenceEndKey >= dateValue) return true;
      }
      occurrenceDate = addRepeatInterval(occurrenceDate, repeatInterval, repeatUnit);
      guard += 1;
    }

    return false;
  }

  function refreshDateSelectionCandidates(preferredKey = "") {
    if (!isDateFocusedMode() || !selectionContext.requestedDate) return;
    const candidateKeys = getDateCandidateKeys(selectionContext.requestedDate).filter((key) => {
      const entry = getEntryByKey(key);
      if (!entry) return false;
      if (entry.kind === "template") return templateCoversDate(entry.item, selectionContext.requestedDate);
      return itemCoversDate(entry.item, selectionContext.requestedDate);
    });
    const desiredKey =
      (preferredKey && candidateKeys.includes(preferredKey) && preferredKey) ||
      (selectedKey && candidateKeys.includes(selectedKey) && selectedKey) ||
      candidateKeys[0] ||
      "";
    const nextEntry = getEntryByKey(desiredKey);
    setSelectionContext({
      requestedDate: selectionContext.requestedDate,
      openedFromDate: true,
      resolvedFromTemplate: Boolean(nextEntry && nextEntry.kind === "template"),
      candidateKeys,
    });
    selectedKey = desiredKey;
  }

  function getDateCandidateKeys(dateValue, eventIds = []) {
    if (!payload || !dateValue) return [];
    const seen = new Set();
    const keys = [];
    const exactEvents = payload.events.filter((item) => String(item && item.date || "").trim() === dateValue);
    const rangedEvents = payload.events.filter(
      (item) => String(item && item.date || "").trim() !== dateValue && itemCoversDate(item, dateValue)
    );
    const templateKeys = payload.templates
      .filter((item) => {
        const templateId = String(item && item.id || "").trim();
        return eventIds.includes(templateId) || templateCoversDate(item, dateValue);
      })
      .map((item) => `template:${item.id}`);
    [...exactEvents.map((item) => `event:${item.id}`), ...rangedEvents.map((item) => `event:${item.id}`), ...templateKeys].forEach((key) => {
      if (!key || seen.has(key) || !getEntryByKey(key)) return;
      seen.add(key);
      keys.push(key);
    });
    return keys;
  }

  function getDateCandidateMeta(entry, dateValue) {
    if (!entry) return "";
    const item = entry.item || {};
    if (entry.kind === "template") {
      return describeTemplateRule(item);
    }
    if (item.date && item.endDate && item.endDate > item.date) {
      return `${formatDateLabel(item.date)} to ${formatDateLabel(item.endDate)}`;
    }
    if (item.date) return formatDateLabel(item.date);
    return dateValue ? formatDateLabel(dateValue) : "Date needed";
  }

  function updateDatePicker(entry) {
    const candidateKeys = Array.isArray(selectionContext.candidateKeys) ? selectionContext.candidateKeys : [];
    const hasSelectedDate = Boolean(selectionContext.openedFromDate && selectionContext.requestedDate);
    const selectedDateLabel = hasSelectedDate ? formatDateLabel(selectionContext.requestedDate) : "";
    const addLabel = hasSelectedDate
      ? `Add One-Time Event On ${selectedDateLabel}`
      : "Select A Date First";
    const addRepeatingLabel = hasSelectedDate
      ? `Add Repeating Event From ${selectedDateLabel}`
      : "Select A Date First";
    document.body.classList.toggle("events-admin-date-mode", hasSelectedDate);
    if (addForDateBtn) {
      addForDateBtn.textContent = addLabel;
      addForDateBtn.disabled = !hasSelectedDate;
    }
    if (addRepeatingForDateBtn) {
      addRepeatingForDateBtn.textContent = addRepeatingLabel;
      addRepeatingForDateBtn.disabled = !hasSelectedDate;
    }
    if (addEventBtn) {
      addEventBtn.textContent = hasSelectedDate ? `Add Event On ${selectedDateLabel}` : "Select A Date First";
      addEventBtn.disabled = !hasSelectedDate;
      addEventBtn.hidden = hasSelectedDate;
    }
    if (addTemplateBtn) addTemplateBtn.hidden = hasSelectedDate;
    if (dateFocusedEl) dateFocusedEl.hidden = !hasSelectedDate;
    if (standardEditorEl) standardEditorEl.hidden = hasSelectedDate;
    if (libraryDetails) libraryDetails.hidden = hasSelectedDate;
    if (advancedDetails) advancedDetails.hidden = hasSelectedDate;
    if (pageDetails) pageDetails.hidden = hasSelectedDate;
    if (dateFocusTitleEl) {
      dateFocusTitleEl.textContent = hasSelectedDate ? `Events On ${selectedDateLabel}` : "Events On This Date";
    }
    if (!dateFocusedEl || !dateTreeEl) return;
    if (!hasSelectedDate) {
      dateTreeEl.innerHTML = "";
      return;
    }
    if (!candidateKeys.length) {
      dateTreeEl.innerHTML = `<div class="events-admin-date-empty">No events are scheduled for ${selectedDateLabel}. Use the buttons below to add the first one.</div>`;
      return;
    }
    dateTreeEl.innerHTML = "";
    candidateKeys.forEach((key) => {
      const candidate = getEntryByKey(key);
      if (!candidate) return;
      const item = candidate.item || {};
      const details = document.createElement("details");
      details.className = "events-admin-date-item";
      details.setAttribute("data-events-date-key", key);
      details.open = key === selectedKey;
      const kindLabel = candidate.kind === "template" ? "Repeats" : "One-Time";
      const summaryText = getDateCandidateLabel(candidate, selectionContext.requestedDate);
      const metaText = getDateCandidateMeta(candidate, selectionContext.requestedDate);
      const titleValue = String(item.title || "").trim();
      const timeValue = String(item.time || "").trim();
      const endTimeValue = String(item.endTime || "").trim();
      const locationValue = String(item.location || "").trim();
      const summaryValue = String(item.summary || "").trim();
      const registrationEnabledValue = Boolean(item.registrationEnabled);
      const registrationCapacityValue = String(Math.max(0, Number(item.registrationCapacity) || 0));
      const startDateValue =
        candidate.kind === "template"
          ? getTemplateAnchorDate(item)
          : String(item.date || "").trim();
      const endDateValue =
        candidate.kind === "event" ? getEventLastDate(item) : getTemplateOccurrenceEndDate(item);
      const intervalValue = candidate.kind === "template" ? String(item.repeatInterval || item.intervalMonths || 1) : "";
      const repeatUnitValue = candidate.kind === "template" ? normalizeRepeatUnit(item.repeatUnit || "month") : "month";
      const typeValue = normalizeEventType(item.type || "Training");
      const occurrenceNote =
        candidate.kind === "template" && selectionContext.requestedDate
          ? `This repeating event is generating the selected date ${selectedDateLabel}.`
          : item.endDate && item.endDate > item.date && selectionContext.requestedDate && selectionContext.requestedDate !== item.date
            ? `This multi-day event spans across the selected date ${selectedDateLabel}.`
            : "This event is attached to the selected date.";
      const scheduleMeta =
        candidate.kind === "template"
          ? `Repeats every ${Math.max(1, Number(item.repeatInterval || item.intervalMonths) || 1)} ${repeatUnitValue}${Math.max(1, Number(item.repeatInterval || item.intervalMonths) || 1) === 1 ? "" : "s"}`
          : "Does not repeat";
      details.innerHTML = `
        <summary>
          <div class="events-admin-date-item-main">
            <span class="events-admin-date-item-title">${escapeHtml(summaryText)}</span>
            <span class="events-admin-date-item-meta">${escapeHtml(metaText)}</span>
          </div>
          <span class="events-admin-date-item-badge">${escapeHtml(kindLabel)}</span>
        </summary>
        <div class="events-admin-date-item-body">
          <div class="events-admin-date-dialog">
            <input
              class="events-admin-date-title-input"
              type="text"
              data-events-inline-field="title"
              data-events-inline-key="${key}"
              value="${escapeHtml(titleValue)}"
              placeholder="Add title"
            />
            <div class="events-admin-date-schedule">
              <div class="events-admin-date-schedule-grid">
                <label>
                  <span>Start Date</span>
                  <input
                    type="date"
                    data-events-inline-field="${candidate.kind === "template" ? "anchorDate" : "date"}"
                    data-events-inline-key="${key}"
                    value="${escapeHtml(startDateValue)}"
                  />
                </label>
                <label>
                  <span>End Date</span>
                  <input type="date" data-events-inline-field="endDate" data-events-inline-key="${key}" value="${escapeHtml(endDateValue)}" />
                </label>
                <label>
                  <span>Start Time</span>
                  <select data-events-inline-field="time" data-events-inline-key="${key}">
                    ${buildTimeOptionsMarkup(timeValue, "Select time")}
                  </select>
                </label>
                <label>
                  <span>End Time</span>
                  <select data-events-inline-field="endTime" data-events-inline-key="${key}">
                    ${buildTimeOptionsMarkup(endTimeValue, "Select time")}
                  </select>
                </label>
                <label>
                  <span>Tag</span>
                  <select data-events-inline-field="type" data-events-inline-key="${key}">
                    ${buildTypeOptionsMarkup(typeValue)}
                  </select>
                </label>
              </div>
              <p class="events-admin-date-item-note">${escapeHtml(scheduleMeta)}</p>
            </div>
            <input
              type="text"
              data-events-inline-field="location"
              data-events-inline-key="${key}"
              value="${escapeHtml(locationValue)}"
              placeholder="Add location"
            />
            <textarea
              rows="3"
              data-events-inline-field="summary"
              data-events-inline-key="${key}"
              placeholder="Add description"
            >${escapeHtml(summaryValue)}</textarea>
            <div class="events-admin-date-repeat-row">
              <label>
                <span>Enable Registration</span>
                <select data-events-inline-field="registrationEnabled" data-events-inline-key="${key}">
                  <option value="false" ${registrationEnabledValue ? "" : "selected"}>Off</option>
                  <option value="true" ${registrationEnabledValue ? "selected" : ""}>On</option>
                </select>
              </label>
              <label>
                <span>Spots Available</span>
                <input type="number" min="0" data-events-inline-field="registrationCapacity" data-events-inline-key="${key}" value="${escapeHtml(registrationCapacityValue)}" />
              </label>
            </div>
            ${candidate.kind === "template" ? `
            <div class="events-admin-date-repeat-row">
              <label>
                <span>Repeat Every</span>
                <input type="number" min="1" max="12" data-events-inline-field="intervalMonths" data-events-inline-key="${key}" value="${escapeHtml(intervalValue)}" />
              </label>
              <label>
                <span>Unit</span>
                <select data-events-inline-field="repeatUnit" data-events-inline-key="${key}">
                  <option value="week" ${repeatUnitValue === "week" ? "selected" : ""}>Week</option>
                  <option value="month" ${repeatUnitValue === "month" ? "selected" : ""}>Month</option>
                  <option value="year" ${repeatUnitValue === "year" ? "selected" : ""}>Year</option>
                </select>
              </label>
            </div>` : ""}
            <p class="events-admin-date-item-note">${escapeHtml(occurrenceNote)}</p>
          </div>
          <div class="events-admin-date-item-actions">
            <button class="btn primary" type="button" data-events-date-done="${key}">Done</button>
            <button class="btn secondary" type="button" data-events-date-delete="${key}">Delete This Event</button>
          </div>
        </div>
      `;
      dateTreeEl.appendChild(details);
    });
  }

  function hasTemplateOccurrenceContext(entry) {
    return Boolean(
      entry &&
      entry.kind === "template" &&
      selectionContext.resolvedFromTemplate &&
      selectionContext.requestedDate
    );
  }

  function isDateFocusedMode() {
    return Boolean(selectionContext.openedFromDate && selectionContext.requestedDate);
  }

  function updateOccurrenceActions(entry) {
    const showActions = hasTemplateOccurrenceContext(entry);
    if (contextActionsEl) contextActionsEl.hidden = !showActions;
    if (contextActionsNoteEl) contextActionsNoteEl.hidden = !showActions;
    if (makeOverrideBtn) makeOverrideBtn.disabled = !showActions;
    if (skipOccurrenceBtn) skipOccurrenceBtn.disabled = !showActions;
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
    const interval = Math.max(1, Number(item.repeatInterval || item.intervalMonths) || 1);
    const repeatUnit = normalizeRepeatUnit(item.repeatUnit || "month");
    const intervalPart = `every ${interval} ${repeatUnit}${interval === 1 ? "" : "s"}`;
    const startPart = getTemplateAnchorDate(item)
      ? `starting ${getTemplateAnchorDate(item)}`
      : "with no start date yet";
    const durationPart =
      (() => {
        const start = getTemplateAnchorDate(item);
        const end = getTemplateOccurrenceEndDate(item);
        if (start && end && end > start) return `running through ${end}`;
        return "single-day occurrence";
      })();
    const skippedDates = getExcludedDates(item);
    const skipPart = skippedDates.length
      ? `${skippedDates.length} skipped date${skippedDates.length === 1 ? "" : "s"}`
      : "no skipped dates";
    if (Array.isArray(item.months) && item.months.length) {
      return `${intervalPart}, ${durationPart}, limited to months ${item.months.join(", ")}, ${startPart}, ${skipPart}.`;
    }
    return `${intervalPart}, ${durationPart}, ${startPart}, ${skipPart}.`;
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
      if (libraryDetails) libraryDetails.hidden = false;
      if (advancedDetails) advancedDetails.hidden = false;
      if (pageDetails) pageDetails.hidden = false;
      updateDatePicker(null);
      updateOccurrenceActions(null);
      return;
    }

    const item = entry.item || {};
    const activeDate = selectionContext.requestedDate || item.date || "";
    const selectedDateLabel = activeDate ? formatDateLabel(activeDate) : "";
    const candidateCount = Array.isArray(selectionContext.candidateKeys) ? selectionContext.candidateKeys.length : 0;

    if (entry.kind === "event") {
      contextBadgeEl.textContent = selectionContext.openedFromDate ? "Date Selection" : "One-Time Event";
      contextTitleEl.textContent = activeDate
        ? `Editing the one-time event for ${formatDateLabel(activeDate)}.`
        : `Editing one-time event: ${item.title || item.id || "Untitled"}.`;
      contextMetaEl.textContent = selectionContext.openedFromDate && selectedDateLabel
        ? candidateCount > 1
          ? `${candidateCount} events are attached to ${selectedDateLabel}. Use the date event picker to switch between them.`
          : `Editing the only event attached to ${selectedDateLabel}.`
        : item.date
          ? `Fixed date: ${formatDateLabel(item.date)}`
          : "This draft still needs a saved date.";
      contextHintEl.textContent = "Changes apply only to this event date.";
      setFocus(`Editing ${item.date || activeDate || "new date draft"}`);
      setModalNote(activeDate ? `Editing the one-time event scheduled for ${formatDateLabel(activeDate)}.` : "Editing the selected one-time event.");
      updateDatePicker(entry);
      updateOccurrenceActions(entry);
      return;
    }

    contextBadgeEl.textContent = selectionContext.resolvedFromTemplate ? "Recurring Template" : "Template Editor";
    contextTitleEl.textContent = selectionContext.requestedDate
      ? `${formatDateLabel(selectionContext.requestedDate)} is generated by this recurring template.`
      : `Editing recurring template: ${item.title || item.id || "Untitled"}.`;
    contextMetaEl.textContent = selectionContext.requestedDate && candidateCount > 1
      ? `${candidateCount} events are attached to ${selectedDateLabel}. This entry is the repeating schedule behind one of them.`
      : describeTemplateRule(item);
    contextHintEl.textContent = selectionContext.requestedDate
      ? "Changes here affect future generated dates that use this template. Existing one-time overrides stay separate."
      : "Template edits shape future generated dates unless a one-time event overrides a specific day.";
    setFocus(`Editing recurring template: ${item.title || item.id || "untitled"}`);
    setModalNote(selectionContext.requestedDate
      ? `The selected date ${formatDateLabel(selectionContext.requestedDate)} maps to this recurring template.`
      : `Editing the recurring template "${item.title || item.id || "untitled"}".`);
    updateDatePicker(entry);
    updateOccurrenceActions(entry);
  }

  function updateKindFields(kind) {
    kindOnlyRows.forEach((row) => {
      const targetKind = row.getAttribute("data-events-kind-only");
      row.hidden = targetKind !== kind;
    });
  }

  function getDraftPreviewEntry() {
    const entry = getSelectedEntry();
    if (!entry) return null;

    const previewKind =
      String((fieldKind && fieldKind.value) || entry.kind).trim() === "template" ? "template" : "event";
    const currentItem = entry.item || {};
    const previewItem = {
      ...currentItem,
      id: normalizeId(fieldId ? fieldId.value : "") || currentItem.id || "",
      title: String((fieldTitle && fieldTitle.value) || "").trim() || currentItem.title || "",
      time: String((fieldTime && fieldTime.value) || "").trim(),
      endTime: String((fieldEndTime && fieldEndTime.value) || "").trim(),
      type: normalizeEventType((fieldType && fieldType.value) || "Training"),
      status: String((fieldStatus && fieldStatus.value) || "").trim(),
      location: String((fieldLocation && fieldLocation.value) || "").trim(),
      summary: String((fieldSummary && fieldSummary.value) || "").trim(),
      registrationEnabled: Boolean(fieldRegistrationEnabled && fieldRegistrationEnabled.checked),
      registrationCapacity: Math.max(0, Number((fieldRegistrationCapacity && fieldRegistrationCapacity.value) || 0) || 0),
      ctaLabel: String((fieldCtaLabel && fieldCtaLabel.value) || "").trim(),
      ctaHref: String((fieldCtaHref && fieldCtaHref.value) || "").trim(),
    };
    const formEndDate = String((fieldEndDate && fieldEndDate.value) || "").trim();

    if (previewKind === "event") {
      previewItem.date =
        getFormStartDateValue() ||
        (entry.kind === "event" ? String(currentItem.date || "").trim() : "") ||
        selectionContext.requestedDate;
      if (formEndDate && previewItem.date && formEndDate >= previewItem.date) previewItem.endDate = formEndDate;
      else if (previewItem.date) previewItem.endDate = previewItem.date;
      else delete previewItem.endDate;
      delete previewItem.startMonth;
      delete previewItem.startDate;
      delete previewItem.repeatInterval;
      delete previewItem.repeatUnit;
      delete previewItem.intervalMonths;
      delete previewItem.durationDays;
      delete previewItem.excludedDates;
      delete previewItem.months;
      delete previewItem.rule;
    } else {
      const anchorValue =
        getFormStartDateValue() ||
        (entry.kind === "template" ? getTemplateAnchorDate(currentItem) : "") ||
        selectionContext.requestedDate;
      previewItem.startDate = anchorValue;
      previewItem.repeatInterval = Math.max(
        1,
        Math.min(12, Number((fieldInterval && fieldInterval.value) || currentItem.repeatInterval || currentItem.intervalMonths || 1) || 1)
      );
      previewItem.repeatUnit = normalizeRepeatUnit(
        (fieldRepeatUnit && fieldRepeatUnit.value) || currentItem.repeatUnit || "month"
      );
      delete previewItem.startMonth;
      delete previewItem.intervalMonths;
      const months = csvToMonthList(fieldMonths ? fieldMonths.value : listToCsv(currentItem.months));
      if (months.length) previewItem.months = months;
      else delete previewItem.months;
      const excludedDates = linesToDateList(
        fieldExcludedDates ? fieldExcludedDates.value : listToLines(getExcludedDates(currentItem))
      );
      if (excludedDates.length) previewItem.excludedDates = excludedDates;
      else delete previewItem.excludedDates;
      if (formEndDate && anchorValue && formEndDate >= anchorValue) {
        previewItem.endDate = formEndDate;
      } else {
        previewItem.endDate = anchorValue;
      }
      delete previewItem.rule;
      delete previewItem.durationDays;
    }

    return {
      ...entry,
      kind: previewKind,
      item: previewItem,
    };
  }

  function refreshContextPanel() {
    updateContextPanel(getDraftPreviewEntry() || getSelectedEntry());
  }

  function fillConfig() {
    if (!payload) return;
    if (fieldUpdated) fieldUpdated.value = payload.updated || "";
    if (fieldTimezone) fieldTimezone.value = payload.timezone || "America/Chicago";
    if (fieldHorizon) fieldHorizon.value = String(payload.horizonMonths || 30);
    if (fieldPreview) fieldPreview.value = String(payload.previewCount || 3);
  }

  function clearForm(options = {}) {
    if (fieldKind) fieldKind.value = "event";
    if (fieldDefinitionSelect) fieldDefinitionSelect.innerHTML = "";
    setDefinitionHelp();
    if (fieldDefinitionEyebrow) fieldDefinitionEyebrow.value = "";
    if (fieldDefinitionTitle) fieldDefinitionTitle.value = "";
    if (fieldDefinitionSlug) fieldDefinitionSlug.value = "";
    if (fieldDefinitionHeroSummary) fieldDefinitionHeroSummary.value = "";
    if (fieldDefinitionNarrative) fieldDefinitionNarrative.value = "";
    if (fieldDefinitionExperience) fieldDefinitionExperience.value = "";
    if (fieldDefinitionScheduleNote) fieldDefinitionScheduleNote.value = "";
    if (fieldDefinitionWhatToExpect) fieldDefinitionWhatToExpect.value = "";
    if (fieldDefinitionIncluded) fieldDefinitionIncluded.value = "";
    if (fieldDefinitionCtaLabel) fieldDefinitionCtaLabel.value = "";
    if (fieldDefinitionCtaHref) fieldDefinitionCtaHref.value = "";
    if (fieldId) fieldId.value = "";
    if (fieldTitle) fieldTitle.value = "";
    setFormStartDateValue("");
    populateTimeSelect(fieldTime, "", "Select time");
    populateTimeSelect(fieldEndTime, "", "Select time");
    if (fieldEndDate) fieldEndDate.value = "";
    if (fieldType) fieldType.value = "Training";
    if (fieldStatus) fieldStatus.value = "Planned";
    if (fieldLocation) fieldLocation.value = "";
    if (fieldSummary) fieldSummary.value = "";
    if (fieldRegistrationEnabled) fieldRegistrationEnabled.checked = false;
    if (fieldRegistrationCapacity) fieldRegistrationCapacity.value = "0";
    if (fieldCtaLabel) fieldCtaLabel.value = "";
    if (fieldCtaHref) fieldCtaHref.value = "";
    if (fieldInterval) fieldInterval.value = "1";
    if (fieldRepeatUnit) fieldRepeatUnit.value = "month";
    if (fieldExcludedDates) fieldExcludedDates.value = "";
    if (fieldMonths) fieldMonths.value = "";
    updateKindFields("event");
    if (advancedDetails) advancedDetails.open = false;
    if (pageDetails) pageDetails.open = false;
    if (!options.preserveSelectionContext) resetSelectionContext();
  }

  function getDefinitionIdForEntry(entry) {
    if (!entry || !entry.item) return "";
    return String(entry.item.eventId || entry.item.id || "").trim();
  }

  function getEntryDisplayLabel(entry) {
    if (!entry) return "";
    const item = entry.item || {};
    const definition = getDefinitionById(getDefinitionIdForEntry(entry));
    const kindLabel = entry.kind === "template" ? "Repeats" : "One Date";
    const typeLabel = String(item.type || "Event").trim() || "Event";
    const titleLabel = String(item.title || item.id || "Untitled").trim();
    const whenLabel =
      entry.kind === "template"
        ? (() => {
            const anchor = getTemplateAnchorDate(item);
            return anchor ? `starts ${formatDateLabel(anchor)}` : "repeat schedule";
          })()
        : item.date
          ? item.endDate && item.endDate > item.date
            ? `${formatDateLabel(item.date)} to ${formatDateLabel(item.endDate)}`
            : formatDateLabel(item.date)
          : "date needed";
    const pageLabel =
      definition && definition.title && definition.title !== titleLabel
        ? ` | page: ${definition.title}`
        : "";
    return `${kindLabel} | ${titleLabel} | ${typeLabel} | ${whenLabel}${pageLabel}`;
  }

  function setSearchStatus(text) {
    if (!searchStatusEl) return;
    searchStatusEl.textContent = text || "Showing all saved items.";
  }

  function renderDefinitionOptions(selectedId) {
    if (!fieldDefinitionSelect) return;
    const definitions = Array.isArray(payload && payload.definitions) ? payload.definitions : [];
    const optionMarkup = definitions
      .slice()
      .sort((a, b) => {
        const aLabel = `${(a && a.title) || ""} ${(a && a.id) || ""}`;
        const bLabel = `${(b && b.title) || ""} ${(b && b.id) || ""}`;
        return aLabel.localeCompare(bLabel);
      })
      .map((item) => {
        const id = String((item && item.id) || "").trim();
        if (!id) return "";
        const label = String((item && item.title) || id).trim();
        return `<option value="${id}">${label}</option>`;
      })
      .filter(Boolean)
      .join("");
    fieldDefinitionSelect.innerHTML =
      `<option value="${NEW_DEFINITION_OPTION}">Create New Event Page</option>${optionMarkup}`;
    const hasMatch = selectedId && definitions.some((item) => item && item.id === selectedId);
    fieldDefinitionSelect.value = hasMatch ? selectedId : NEW_DEFINITION_OPTION;
    setDefinitionHelp(
      hasMatch
        ? "This schedule is using an existing event page. Changing the page fields updates every schedule linked to that page."
        : "You are creating a separate event page for this schedule. Keep the basics short, then open More Page Details only if needed."
    );
  }

  function getDefinitionById(definitionId) {
    if (!payload || !definitionId || !Array.isArray(payload.definitions)) return null;
    return payload.definitions.find((item) => item && item.id === definitionId) || null;
  }

  function ensureDefinitionForEntry(entry, options = {}) {
    if (!payload || !entry) return null;
    if (!Array.isArray(payload.definitions)) payload.definitions = [];
    const definitionId = String(options.definitionId || getDefinitionIdForEntry(entry)).trim();
    if (!definitionId) return null;

    let definition = getDefinitionById(definitionId);
    if (!definition) {
      const item = entry.item || {};
      definition = {
        id: definitionId,
        slug: definitionId,
        title: item.title || "Untitled Event",
        type: item.type || "Event",
        eyebrow: item.type || "Event",
        heroSummary: item.summary || "",
        narrative: "",
        experience: "",
        scheduleNote: "",
        whatToExpect: [],
        included: [],
        primaryCtaLabel: item.ctaLabel || "",
        primaryCtaHref: item.ctaHref || "",
      };
      payload.definitions.push(definition);
    }

    return definition;
  }

  function fillDefinitionForm(entry) {
    if (!entry) {
      if (fieldDefinitionSelect) fieldDefinitionSelect.innerHTML = "";
      if (fieldDefinitionEyebrow) fieldDefinitionEyebrow.value = "";
      if (fieldDefinitionTitle) fieldDefinitionTitle.value = "";
      if (fieldDefinitionSlug) fieldDefinitionSlug.value = "";
      if (fieldDefinitionHeroSummary) fieldDefinitionHeroSummary.value = "";
      if (fieldDefinitionNarrative) fieldDefinitionNarrative.value = "";
      if (fieldDefinitionExperience) fieldDefinitionExperience.value = "";
      if (fieldDefinitionScheduleNote) fieldDefinitionScheduleNote.value = "";
      if (fieldDefinitionWhatToExpect) fieldDefinitionWhatToExpect.value = "";
      if (fieldDefinitionIncluded) fieldDefinitionIncluded.value = "";
      if (fieldDefinitionCtaLabel) fieldDefinitionCtaLabel.value = "";
      if (fieldDefinitionCtaHref) fieldDefinitionCtaHref.value = "";
      return;
    }

    const definition = ensureDefinitionForEntry(entry);
    const item = entry.item || {};
    renderDefinitionOptions(definition ? definition.id : getDefinitionIdForEntry(entry));
    if (fieldDefinitionEyebrow) {
      fieldDefinitionEyebrow.value = (definition && definition.eyebrow) || item.type || "Event";
    }
    if (fieldDefinitionTitle) fieldDefinitionTitle.value = (definition && definition.title) || item.title || "";
    if (fieldDefinitionSlug) fieldDefinitionSlug.value = (definition && definition.slug) || "";
    if (fieldDefinitionHeroSummary) {
      fieldDefinitionHeroSummary.value = (definition && definition.heroSummary) || item.summary || "";
    }
    if (fieldDefinitionNarrative) fieldDefinitionNarrative.value = (definition && definition.narrative) || "";
    if (fieldDefinitionExperience) fieldDefinitionExperience.value = (definition && definition.experience) || "";
    if (fieldDefinitionScheduleNote) {
      fieldDefinitionScheduleNote.value = (definition && definition.scheduleNote) || "";
    }
    if (fieldDefinitionWhatToExpect) {
      fieldDefinitionWhatToExpect.value = listToLines(definition && definition.whatToExpect);
    }
    if (fieldDefinitionIncluded) {
      fieldDefinitionIncluded.value = listToLines(definition && definition.included);
    }
    if (fieldDefinitionCtaLabel) {
      fieldDefinitionCtaLabel.value = (definition && definition.primaryCtaLabel) || item.ctaLabel || "";
    }
    if (fieldDefinitionCtaHref) {
      fieldDefinitionCtaHref.value = (definition && definition.primaryCtaHref) || item.ctaHref || "";
    }
  }

  function fillDefinitionFormFromEntry(entry) {
    const item = entry && entry.item ? entry.item : {};
    if (fieldDefinitionSelect) fieldDefinitionSelect.value = NEW_DEFINITION_OPTION;
    setDefinitionHelp(
      "You are creating a separate event page for this schedule. Keep the basics short, then open More Page Details only if needed."
    );
    if (fieldDefinitionEyebrow) {
      fieldDefinitionEyebrow.value = String(item.type || "Event").trim() || "Event";
    }
    if (fieldDefinitionTitle) fieldDefinitionTitle.value = item.title || "";
    if (fieldDefinitionSlug) {
      fieldDefinitionSlug.value = buildDefinitionId(
        item.title || "event",
        item.date || getTemplateAnchorDate(item)
      );
    }
    if (fieldDefinitionHeroSummary) fieldDefinitionHeroSummary.value = item.summary || "";
    if (fieldDefinitionNarrative) fieldDefinitionNarrative.value = "";
    if (fieldDefinitionExperience) fieldDefinitionExperience.value = "";
    if (fieldDefinitionScheduleNote) fieldDefinitionScheduleNote.value = "";
    if (fieldDefinitionWhatToExpect) fieldDefinitionWhatToExpect.value = "";
    if (fieldDefinitionIncluded) fieldDefinitionIncluded.value = "";
    if (fieldDefinitionCtaLabel) fieldDefinitionCtaLabel.value = item.ctaLabel || "";
    if (fieldDefinitionCtaHref) fieldDefinitionCtaHref.value = item.ctaHref || "";
  }

  function commitDefinitionForm(options = {}) {
    if (!payload || !selectedKey) return;
    const entry = options.entry || getSelectedEntry();
    if (!entry) return;

    const selectedDefinitionId = String((fieldDefinitionSelect && fieldDefinitionSelect.value) || "").trim();
    const fallbackDefinitionId =
      getDefinitionIdForEntry(entry) ||
      buildDefinitionId(
        (fieldDefinitionTitle && fieldDefinitionTitle.value) || (entry.item && entry.item.title) || "",
        (entry.item && (entry.item.date || getTemplateAnchorDate(entry.item))) || selectionContext.requestedDate
      );
    const definitionId =
      !selectedDefinitionId || selectedDefinitionId === NEW_DEFINITION_OPTION
        ? fallbackDefinitionId
        : selectedDefinitionId;
    if (entry.item) entry.item.eventId = definitionId;

    const definition = ensureDefinitionForEntry(entry, { definitionId });
    if (!definition) return;

    definition.eyebrow =
      String((fieldDefinitionEyebrow && fieldDefinitionEyebrow.value) || "").trim() ||
      normalizeEventType((fieldType && fieldType.value) || (entry.item && entry.item.type) || "Training");
    definition.title =
      String((fieldDefinitionTitle && fieldDefinitionTitle.value) || "").trim() ||
      String((entry.item && entry.item.title) || "").trim() ||
      "Untitled Event";
    definition.slug =
      normalizeId(fieldDefinitionSlug ? fieldDefinitionSlug.value : "") ||
      definition.slug ||
      definition.id;
    definition.heroSummary = String((fieldDefinitionHeroSummary && fieldDefinitionHeroSummary.value) || "").trim();
    definition.narrative = String((fieldDefinitionNarrative && fieldDefinitionNarrative.value) || "").trim();
    definition.experience = String((fieldDefinitionExperience && fieldDefinitionExperience.value) || "").trim();
    definition.scheduleNote = String((fieldDefinitionScheduleNote && fieldDefinitionScheduleNote.value) || "").trim();
    definition.whatToExpect = linesToList(fieldDefinitionWhatToExpect ? fieldDefinitionWhatToExpect.value : "");
    definition.included = linesToList(fieldDefinitionIncluded ? fieldDefinitionIncluded.value : "");
    definition.primaryCtaLabel = String((fieldDefinitionCtaLabel && fieldDefinitionCtaLabel.value) || "").trim();
    definition.primaryCtaHref = String((fieldDefinitionCtaHref && fieldDefinitionCtaHref.value) || "").trim();
    definition.type =
      normalizeEventType((fieldType && fieldType.value) || (entry.item && entry.item.type) || definition.type || "Training");

    if (!options.skipDirty) setDirty(true);
  }

  function fillForm(entry) {
    if (!entry) {
      clearForm({ preserveSelectionContext: isDateFocusedMode() });
      updateContextPanel(null);
      return;
    }

    const item = entry.item || {};
    if (fieldKind) fieldKind.value = entry.kind;
    if (fieldId) fieldId.value = item.id || "";
    if (fieldTitle) fieldTitle.value = item.title || "";
    setFormStartDateValue(entry.kind === "template" ? getTemplateAnchorDate(item) : item.date || "");
    populateTimeSelect(fieldTime, item.time || "", "Select time");
    populateTimeSelect(fieldEndTime, item.endTime || "", "Select time");
    if (fieldEndDate) {
      fieldEndDate.value =
        entry.kind === "event"
          ? (getEventLastDate(item) || item.date || "")
          : (getTemplateOccurrenceEndDate(item) || getTemplateAnchorDate(item) || "");
    }
    if (fieldType) fieldType.value = normalizeEventType(item.type || "Training");
    if (fieldStatus) fieldStatus.value = item.status || "Planned";
    if (fieldLocation) fieldLocation.value = item.location || "";
    if (fieldSummary) fieldSummary.value = item.summary || "";
    if (fieldRegistrationEnabled) fieldRegistrationEnabled.checked = Boolean(item.registrationEnabled);
    if (fieldRegistrationCapacity) {
      fieldRegistrationCapacity.value = String(Math.max(0, Number(item.registrationCapacity) || 0));
    }
    if (fieldCtaLabel) fieldCtaLabel.value = item.ctaLabel || "";
    if (fieldCtaHref) fieldCtaHref.value = item.ctaHref || "";
    if (fieldInterval) fieldInterval.value = String(item.repeatInterval || item.intervalMonths || 1);
    if (fieldRepeatUnit) fieldRepeatUnit.value = normalizeRepeatUnit(item.repeatUnit || "month");
    if (fieldExcludedDates) fieldExcludedDates.value = listToLines(getExcludedDates(item));
    if (fieldMonths) fieldMonths.value = listToCsv(item.months);
    if (advancedDetails) advancedDetails.open = false;
    fillDefinitionForm(entry);
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
    const title = String((fieldTitle && fieldTitle.value) || "").trim();
    if (!title) throw new Error("A title is required.");

    const explicitId = normalizeId(fieldId ? fieldId.value : "");
    const entry = getSelectedEntry();
    const linkedDefinitionId =
      String((fieldDefinitionSelect && fieldDefinitionSelect.value) || "").trim() ||
      getDefinitionIdForEntry(entry) ||
      buildDefinitionId(
        (fieldDefinitionTitle && fieldDefinitionTitle.value) || title,
        getFormStartDateValue()
      );

    const next = {
      eventId: linkedDefinitionId,
      title,
      time: String((fieldTime && fieldTime.value) || "").trim(),
      endTime: String((fieldEndTime && fieldEndTime.value) || "").trim(),
      type: normalizeEventType((fieldType && fieldType.value) || "Training"),
      status: String((fieldStatus && fieldStatus.value) || "").trim(),
      location: String((fieldLocation && fieldLocation.value) || "").trim(),
      summary: String((fieldSummary && fieldSummary.value) || "").trim(),
      registrationEnabled: Boolean(fieldRegistrationEnabled && fieldRegistrationEnabled.checked),
      registrationCapacity: Math.max(0, Number((fieldRegistrationCapacity && fieldRegistrationCapacity.value) || 0) || 0),
      ctaLabel: String((fieldCtaLabel && fieldCtaLabel.value) || "").trim(),
      ctaHref: String((fieldCtaHref && fieldCtaHref.value) || "").trim(),
    };
    const lastDayValue = String((fieldEndDate && fieldEndDate.value) || "").trim();

    if (kind === "event") {
      const dateValue = getFormStartDateValue();
      if (!dateValue) throw new Error("A one-time event needs a date.");
      if (lastDayValue && lastDayValue < dateValue) {
        throw new Error("The end date cannot be before the start date.");
      }
      next.id = explicitId || buildSuggestedId("event-item", title, dateValue);
      next.date = dateValue;
      next.endDate = lastDayValue && lastDayValue >= dateValue ? lastDayValue : dateValue;
      return next;
    }

    const anchorValue = getFormStartDateValue();
    if (!anchorValue) throw new Error("A repeating event needs a start date.");
    if (lastDayValue && lastDayValue < anchorValue) {
      throw new Error("The end date cannot be before the start date.");
    }
    next.id = explicitId || buildSuggestedId("template-item", title, anchorValue);
    next.startDate = anchorValue;
    next.endDate = lastDayValue && lastDayValue >= anchorValue ? lastDayValue : anchorValue;
    next.repeatInterval = Math.max(1, Math.min(12, Number((fieldInterval && fieldInterval.value) || 1) || 1));
    next.repeatUnit = normalizeRepeatUnit(fieldRepeatUnit ? fieldRepeatUnit.value : "month");
    const excludedDates = linesToDateList(fieldExcludedDates ? fieldExcludedDates.value : "");
    if (excludedDates.length) next.excludedDates = excludedDates;
    const months = csvToMonthList(fieldMonths ? fieldMonths.value : "");
    if (months.length) next.months = months;
    return next;
  }

  function commitSelectedForm(options = {}) {
    if (!payload || !selectedKey) return;
    const entry = getSelectedEntry();
    if (!entry) return;
    const previousKey = entry.key;
    commitDefinitionForm({ skipDirty: true, entry });

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
    if (selectionContext.openedFromDate && Array.isArray(selectionContext.candidateKeys) && selectionContext.candidateKeys.length) {
      selectionContext.candidateKeys = selectionContext.candidateKeys.map((key) => key === previousKey ? selectedKey : key);
      selectionContext.candidateKeys = Array.from(new Set(selectionContext.candidateKeys.filter(Boolean)));
      selectionContext.resolvedFromTemplate = desiredKind === "template";
    }
    if (!options.skipDirty) setDirty(true);
  }

  function renderList(filterText = "") {
    if (!selectEl) return;
    const filter = String(filterText || "").trim().toLowerCase();
    const allEntries = getEntries()
      .sort((a, b) => {
        const aLabel = `${a.kind} ${a.item.title || a.item.id || ""}`;
        const bLabel = `${b.kind} ${b.item.title || b.item.id || ""}`;
        return aLabel.localeCompare(bLabel);
      });
    const entries = allEntries.filter((entry) => {
      if (!filter) return true;
      const definition = getDefinitionById(getDefinitionIdForEntry(entry));
      const hay = [
        entry.item.id || "",
        entry.item.eventId || "",
        entry.item.title || "",
        entry.item.type || "",
        entry.kind === "template" ? "repeats" : "one date",
        definition && definition.title ? definition.title : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(filter);
    });

    selectEl.innerHTML = "";
    const selectedVisible = entries.some((entry) => entry.key === selectedKey);
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.key;
      option.textContent = getEntryDisplayLabel(entry);
      if (entry.key === selectedKey && selectedVisible) option.selected = true;
      selectEl.appendChild(option);
    });

    if (searchClearBtn) searchClearBtn.hidden = !filter;

    if (!entries.length) {
      const option = document.createElement("option");
      option.disabled = true;
      option.textContent = filter ? "No saved schedules match this search." : "No saved schedules yet.";
      selectEl.appendChild(option);
      selectEl.selectedIndex = -1;
      setSearchStatus(
        filter
          ? "No matches. Your current editor stays where it is until you pick a different saved item."
          : "No saved schedules yet."
      );
      fillForm(getSelectedEntry());
      syncAuthUi();
      persistUiState();
      return;
    }

    if (!selectedVisible) {
      selectEl.selectedIndex = -1;
    } else if (selectEl.value !== selectedKey) {
      selectEl.value = selectedKey;
    }

    if (filter) {
      setSearchStatus(
        selectedVisible
          ? `Showing ${entries.length} match${entries.length === 1 ? "" : "es"}.`
          : `Showing ${entries.length} match${entries.length === 1 ? "" : "es"}. Pick one to switch the editor.`
      );
    } else {
      setSearchStatus(`Showing all ${entries.length} saved schedule${entries.length === 1 ? "" : "s"}.`);
    }

    fillForm(getSelectedEntry());
    syncAuthUi();
    persistUiState();
  }

  function reloadEmbed() {
    const frame = document.querySelector("[data-events-embed-frame]");
    if (!frame) return;
    const currentSrc = frame.getAttribute("src") || "";
    if (!currentSrc) return;
    const nextUrl = new URL(currentSrc, window.location.href);
    nextUrl.searchParams.set("t", String(Date.now()));
    frame.setAttribute("src", `${nextUrl.pathname}${nextUrl.search}`);
  }

  function syncEmbedPreview() {
    const frame = document.querySelector("[data-events-embed-frame]");
    if (!frame || !payload) return;
    try {
      const frameWindow = frame.contentWindow;
      if (!frameWindow) return;
      frameWindow.postMessage(
        {
          type: "dmzEventsPayloadPreview",
          payload: clonePayload(payload),
        },
        window.location.origin
      );
    } catch (_error) {
      // Ignore preview sync errors and leave the iframe on its last rendered state.
    }
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
    syncEmbedPreview();
    setDirty(false);
    setStatus(isAuthed() ? "Ready" : "Signed out", isAuthed() ? "ready" : "neutral");

    const storedUiState = getStoredUiState();
    if (storedUiState && isAuthed()) {
      if (storedUiState.selectedKey && getEntryByKey(storedUiState.selectedKey)) {
        selectedKey = storedUiState.selectedKey;
        renderList(searchInput ? searchInput.value : "");
      }
      if (storedUiState.editMode) {
        setEditMode(true);
      }
      if (storedUiState.panelOpen && storedUiState.editMode && getSelectedEntry()) {
        toggleOpen(true);
      }
    }
  }

  function buildDraftId(prefix, dateValue) {
    const stamp = Date.now().toString().slice(-5);
    const dateChunk = String(dateValue || "").replace(/[^0-9]/g, "").slice(0, 8);
    return normalizeId(`${prefix}-${dateChunk || stamp}-${stamp}`);
  }

  function buildEventDraft(dateValue) {
    const safeDate = String(dateValue || new Date().toISOString().slice(0, 10)).trim();
    const eventId = buildDefinitionId("New One-Time Event", safeDate);
    return {
      id: buildDraftId("eventitem", safeDate),
      eventId,
      title: "New One-Time Event",
      date: safeDate,
      endDate: safeDate,
      time: "",
      endTime: "",
      type: "Training",
      status: "Planned",
      location: "",
      summary: "",
      registrationEnabled: false,
      registrationCapacity: 0,
      ctaLabel: "",
      ctaHref: "",
    };
  }

  function buildTemplateDraft(dateValue) {
    const safeDate = String(dateValue || new Date().toISOString().slice(0, 10)).trim();
    const eventId = buildDefinitionId("New Repeating Event", safeDate);
    return {
      id: buildDraftId("templateitem", safeDate),
      eventId,
      title: "New Repeating Event",
      startDate: safeDate,
      endDate: safeDate,
      repeatInterval: 1,
      repeatUnit: "month",
      type: "Training",
      status: "Planned",
      location: "",
      summary: "",
      registrationEnabled: false,
      registrationCapacity: 0,
      ctaLabel: "",
      ctaHref: "",
    };
  }

  function syncCurrentDraftOrThrow() {
    if (!payload) payload = clonePayload({});
    if (!isDateFocusedMode()) {
      commitSelectedForm({ skipDirty: true });
    }
    commitConfig();
  }

  function buildOverrideFromTemplate(templateItem, dateValue) {
    const safeDate = String(dateValue || "").trim();
    const eventId = String((templateItem && templateItem.eventId) || (templateItem && templateItem.id) || "").trim();
    const override = {
      id: buildSuggestedId("event-item", (templateItem && templateItem.title) || "event", safeDate),
      eventId: eventId || buildDefinitionId((templateItem && templateItem.title) || "event", safeDate),
      title: String((templateItem && templateItem.title) || "One-Time Event").trim(),
      date: safeDate,
      time: String((templateItem && templateItem.time) || "").trim(),
      endTime: String((templateItem && templateItem.endTime) || "").trim(),
      type: normalizeEventType((templateItem && templateItem.type) || "Training"),
      status: String((templateItem && templateItem.status) || "").trim(),
      location: String((templateItem && templateItem.location) || "").trim(),
      summary: String((templateItem && templateItem.summary) || "").trim(),
      registrationEnabled: Boolean(templateItem && templateItem.registrationEnabled),
      registrationCapacity: Math.max(0, Number((templateItem && templateItem.registrationCapacity) || 0) || 0),
      ctaLabel: String((templateItem && templateItem.ctaLabel) || "").trim(),
      ctaHref: String((templateItem && templateItem.ctaHref) || "").trim(),
    };
    const templateStart = getTemplateAnchorDate(templateItem);
    const templateEnd = getTemplateOccurrenceEndDate(templateItem) || templateStart;
    const startDate = parseDateValue(safeDate);
    const baseStart = parseDateValue(templateStart);
    const baseEnd = parseDateValue(templateEnd);
    if (startDate && baseStart && baseEnd && baseEnd >= baseStart) {
      const durationDays = Math.max(1, Math.round((baseEnd.getTime() - baseStart.getTime()) / 86400000) + 1);
      override.endDate = formatDateKey(addDays(startDate, durationDays - 1));
    } else {
      override.endDate = safeDate;
    }
    return override;
  }

  function addEventForSelectedDate() {
    if (!selectionContext.requestedDate) {
      createEntry("event", { context: { openedFromDate: false, resolvedFromTemplate: false } });
      return;
    }
    createEntry("event", {
      date: selectionContext.requestedDate,
      item: buildEventDraft(selectionContext.requestedDate),
      context: {
        requestedDate: selectionContext.requestedDate,
        openedFromDate: true,
        resolvedFromTemplate: false,
        candidateKeys: selectionContext.candidateKeys,
      },
      message: `A new one-time draft was created for ${selectionContext.requestedDate}.`,
    });
  }

  function addRepeatingForSelectedDate() {
    if (!selectionContext.requestedDate) {
      createEntry("template", { context: { openedFromDate: false, resolvedFromTemplate: false } });
      return;
    }
    createEntry("template", {
      date: selectionContext.requestedDate,
      item: buildTemplateDraft(selectionContext.requestedDate),
      context: {
        requestedDate: selectionContext.requestedDate,
        openedFromDate: true,
        resolvedFromTemplate: false,
        candidateKeys: selectionContext.candidateKeys,
      },
      message: `A new repeating draft was created starting ${selectionContext.requestedDate}.`,
    });
  }

  function applyInlineFieldChange(key, field, rawValue) {
    const entry = getEntryByKey(key);
    if (!entry || !entry.item) return false;
    const item = entry.item;
    const value = String(rawValue || "").trim();

    if (field === "title") {
      item.title = value;
      return true;
    }
    if (field === "type") {
      item.type = normalizeEventType(value);
      return true;
    }
    if (field === "status") {
      item.status = value;
      return true;
    }
    if (field === "time") {
      item.time = value;
      return true;
    }
    if (field === "endTime") {
      item.endTime = value;
      return true;
    }
    if (field === "location") {
      item.location = value;
      return true;
    }
    if (field === "summary") {
      item.summary = value;
      return true;
    }
    if (field === "registrationEnabled") {
      item.registrationEnabled = value === "true" || value === "1";
      if (!item.registrationEnabled) item.registrationCapacity = 0;
      return true;
    }
    if (field === "registrationCapacity") {
      item.registrationCapacity = Math.max(0, Number(value || 0) || 0);
      if (item.registrationCapacity > 0) item.registrationEnabled = true;
      return true;
    }

    if (entry.kind === "event") {
      if (field === "date") {
        if (!parseDateValue(value)) return false;
        item.date = value;
        if (item.endDate && item.endDate < item.date) item.endDate = item.date;
        return true;
      }
      if (field === "endDate") {
        if (!value) {
          item.endDate = String(item.date || "").trim();
          return true;
        }
        if (!parseDateValue(value) || value < String(item.date || "").trim()) return false;
        item.endDate = value > String(item.date || "").trim() ? value : "";
        if (!item.endDate) item.endDate = String(item.date || "").trim();
        return true;
      }
      return false;
    }

    if (field === "anchorDate") {
      if (!parseDateValue(value)) return false;
      item.startDate = value;
      if (item.endDate && item.endDate < item.startDate) item.endDate = item.startDate;
      return true;
    }
    if (field === "intervalMonths") {
      item.repeatInterval = Math.max(1, Math.min(12, Number(value || 1) || 1));
      return true;
    }
    if (field === "repeatUnit") {
      item.repeatUnit = normalizeRepeatUnit(value);
      return true;
    }
    if (field === "endDate") {
      if (!value) {
        item.endDate = getTemplateAnchorDate(item);
        return true;
      }
      const anchorDate = getTemplateAnchorDate(item);
      if (!parseDateValue(value) || !anchorDate || value < anchorDate) return false;
      item.endDate = value;
      return true;
    }
    return false;
  }

  function openFullEditorForKey(key) {
    const entry = getEntryByKey(key);
    if (!entry) return;
    selectedKey = key;
    setSelectionContext({
      requestedDate: "",
      openedFromDate: false,
      resolvedFromTemplate: false,
      candidateKeys: [],
    });
    renderList(searchInput ? searchInput.value : "");
    toggleOpen(true);
    showValidation("");
    setStatus(isDirty ? "Draft" : "Ready", isDirty ? "neutral" : "ready");
  }

  function deleteDateTreeEntry(key) {
    const entry = getEntryByKey(key);
    if (!entry || !payload) return;
    if (!window.confirm(`Delete ${entry.item.title || entry.item.id}?`)) return;
    const targetList = entry.kind === "template" ? payload.templates : payload.events;
    targetList.splice(entry.index, 1);
    refreshDateSelectionCandidates(selectedKey === key ? "" : selectedKey);
    setDirty(true);
    renderList(searchInput ? searchInput.value : "");
    syncEmbedPreview();
    showValidation("Event removed from this date. Publish when you are ready.");
    setStatus("Draft", "neutral");
  }

  function finalizeDateTreeEntryEdits(key) {
    const entry = getEntryByKey(key);
    if (!entry) return;
    selectedKey = key;
    if (isDateFocusedMode()) {
      refreshDateSelectionCandidates(key);
    }
    renderList(searchInput ? searchInput.value : "");
    toggleOpen(true);
    syncEmbedPreview();
    setDirty(true);
    setStatus("Draft", "neutral");
    showValidation("Draft updates saved in the editor. Click Publish to make them live.");
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
      syncCurrentDraftOrThrow();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Current entry is invalid.", true);
      setStatus("Draft blocked", "error");
      return;
    }

    let nextItem;
    let nextKey;
    if (searchInput) searchInput.value = "";
    if (kind === "template") {
      nextItem = options.item || buildTemplateDraft(options.date);
      payload.templates.push(nextItem);
      nextKey = `template:${nextItem.id}`;
    } else {
      nextItem = options.item || buildEventDraft(options.date);
      payload.events.push(nextItem);
      nextKey = `event:${nextItem.id}`;
    }

    const nextContext = { ...(options.context || {}) };
    if (nextContext.openedFromDate && nextContext.requestedDate) {
      const baseKeys = Array.isArray(nextContext.candidateKeys)
        ? nextContext.candidateKeys
        : Array.isArray(selectionContext.candidateKeys)
          ? selectionContext.candidateKeys
          : [];
      nextContext.candidateKeys = [nextKey, ...baseKeys.filter((key) => key && key !== nextKey)];
    }
    setSelectionContext(nextContext);
    selectedKey = nextKey;
    refreshDateSelectionCandidates(nextKey);
    renderList(searchInput ? searchInput.value : "");
    setEditMode(true);
    toggleOpen(true);
    setDirty(true);
    syncEmbedPreview();
    setStatus("Draft", "neutral");
    showValidation(options.message || "New draft item added. Publish when you are ready.");
  }

  function skipSelectedOccurrence() {
    if (!isAuthed()) {
      buildLoginModal(skipSelectedOccurrence);
      return;
    }

    const dateValue = String(selectionContext.requestedDate || "").trim();
    const currentEntry = getSelectedEntry();
    if (!dateValue || !currentEntry || currentEntry.kind !== "template") return;

    try {
      syncCurrentDraftOrThrow();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Fix the current template before changing this date.", true);
      setStatus("Draft blocked", "error");
      return;
    }

    const entry = getSelectedEntry();
    if (!entry || entry.kind !== "template") return;
    addExcludedDate(entry.item, dateValue);
    const remainingKeys = (Array.isArray(selectionContext.candidateKeys) ? selectionContext.candidateKeys : [])
      .filter((key) => key && key !== entry.key);
    setSelectionContext({
      requestedDate: dateValue,
      openedFromDate: true,
      resolvedFromTemplate: false,
      candidateKeys: remainingKeys,
    });
    selectedKey = remainingKeys[0] || "";
    renderList(searchInput ? searchInput.value : "");
    if (!selectedKey) {
      fillForm(null);
    }
    toggleOpen(true);
    setDirty(true);
    syncEmbedPreview();
    setStatus("Draft", "neutral");
    showValidation(`The repeating date ${dateValue} was removed from this series. Publish when you are ready.`);
  }

  function makeSelectedOccurrenceOverride() {
    if (!isAuthed()) {
      buildLoginModal(makeSelectedOccurrenceOverride);
      return;
    }

    const dateValue = String(selectionContext.requestedDate || "").trim();
    const currentEntry = getSelectedEntry();
    if (!dateValue || !currentEntry || currentEntry.kind !== "template") return;

    try {
      syncCurrentDraftOrThrow();
    } catch (error) {
      showValidation(error && error.message ? error.message : "Fix the current template before creating a one-time override.", true);
      setStatus("Draft blocked", "error");
      return;
    }

    const entry = getSelectedEntry();
    if (!entry || entry.kind !== "template") return;

    removeExcludedDate(entry.item, dateValue);
    addExcludedDate(entry.item, dateValue);
    const overrideItem = buildOverrideFromTemplate(entry.item, dateValue);
    payload.events.push(overrideItem);

    if (searchInput) searchInput.value = "";
    const existingKeys = Array.isArray(selectionContext.candidateKeys) ? selectionContext.candidateKeys : [];
    setSelectionContext({
      requestedDate: dateValue,
      openedFromDate: true,
      resolvedFromTemplate: false,
      candidateKeys: [`event:${overrideItem.id}`, ...existingKeys.filter((key) => key && key !== `event:${overrideItem.id}`)],
    });
    selectedKey = `event:${overrideItem.id}`;
    renderList(searchInput ? searchInput.value : "");
    toggleOpen(true);
    setDirty(true);
    syncEmbedPreview();
    setStatus("Draft", "neutral");
    showValidation(`A one-time override draft was created for ${dateValue}. The repeating series will skip that date once you publish.`);
  }

  function findTemplateKeyForDate(dateValue, eventIds) {
    if (!payload || !dateValue || !Array.isArray(eventIds) || !eventIds.length) return "";
    const match = payload.templates.find((item) => eventIds.includes(item.id));
    return match ? `template:${match.id}` : "";
  }

  function openEditorForDate(dateValue, eventIds) {
    if (!isAuthed() || !editMode) return;
    if (!payload) payload = clonePayload({});

    let draftError = "";
    try {
      syncCurrentDraftOrThrow();
    } catch (error) {
      draftError = error && error.message ? error.message : "The current draft has validation issues.";
    }

    const candidateKeys = getDateCandidateKeys(dateValue, eventIds);
    const firstCandidateKey = candidateKeys[0] || "";
    if (firstCandidateKey) {
      const firstEntry = getEntryByKey(firstCandidateKey);
      if (searchInput) searchInput.value = "";
      setSelectionContext({
        requestedDate: dateValue,
        openedFromDate: true,
        resolvedFromTemplate: Boolean(firstEntry && firstEntry.kind === "template"),
        candidateKeys,
      });
      selectedKey = firstCandidateKey;
      renderList(searchInput ? searchInput.value : "");
      toggleOpen(true);
      showValidation(
        draftError
          ? `${draftError} You can still switch dates; publish remains blocked until fixed.`
          : ""
      );
      setStatus(isDirty ? "Draft" : "Ready", isDirty ? "neutral" : "ready");
      return;
    }

    setSelectionContext({
      requestedDate: dateValue,
      openedFromDate: true,
      resolvedFromTemplate: false,
      candidateKeys: [],
    });
    selectedKey = "";
    renderList(searchInput ? searchInput.value : "");
    toggleOpen(true);
    showValidation(
      draftError
        ? `${draftError} You can still switch dates; publish remains blocked until fixed.`
        : ""
    );
    setStatus(isDirty ? "Draft" : "Ready", isDirty ? "neutral" : "ready");
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
    if (isDateFocusedMode()) {
      refreshDateSelectionCandidates(selectedKey === entry.key ? "" : selectedKey);
    } else {
      selectedKey = "";
    }
    renderList(searchInput ? searchInput.value : "");
    setDirty(true);
    toggleOpen(isDateFocusedMode() || Boolean(getEntries().length));
    syncEmbedPreview();
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
      syncCurrentDraftOrThrow();
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
    refreshDateSelectionCandidates();
    renderList(searchInput ? searchInput.value : "");
    fillConfig();
    syncEmbedPreview();
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
    addEventBtn.addEventListener("click", addEventForSelectedDate);
  }

    if (addForDateBtn) {
      addForDateBtn.addEventListener("click", addEventForSelectedDate);
    }

  if (addRepeatingForDateBtn) {
    addRepeatingForDateBtn.addEventListener("click", addRepeatingForSelectedDate);
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
  if (makeOverrideBtn) makeOverrideBtn.addEventListener("click", makeSelectedOccurrenceOverride);
  if (skipOccurrenceBtn) skipOccurrenceBtn.addEventListener("click", skipSelectedOccurrence);

  if (selectEl) {
    selectEl.addEventListener("change", () => {
      const nextKey = selectEl.value;
      try {
        syncCurrentDraftOrThrow();
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

  if (dateTreeEl) {
    dateTreeEl.addEventListener("input", (event) => {
      const field = event.target.closest("[data-events-inline-field]");
      if (!field) return;
      const key = String(field.getAttribute("data-events-inline-key") || "").trim();
      const name = String(field.getAttribute("data-events-inline-field") || "").trim();
      if (!key || !name) return;
      if (!applyInlineFieldChange(key, name, field.value)) return;
      selectedKey = key;
      setDirty(true);
      setStatus("Draft", "neutral");
    });

    dateTreeEl.addEventListener("change", (event) => {
      const field = event.target.closest("[data-events-inline-field]");
      if (!field) return;
      const key = String(field.getAttribute("data-events-inline-key") || "").trim();
      const name = String(field.getAttribute("data-events-inline-field") || "").trim();
      if (!key || !name) return;
      if (!applyInlineFieldChange(key, name, field.value)) {
        showValidation("That date change is invalid.", true);
        return;
      }
      selectedKey = key;
      setDirty(true);
      setStatus("Draft", "neutral");
      showValidation("");
    });

    dateTreeEl.addEventListener("click", (event) => {
      const field = event.target.closest("[data-events-inline-field]");
      if (field) return;
      const summary = event.target.closest("summary");
      if (summary) {
        const details = summary.closest("[data-events-date-key]");
        const key = String(details && details.getAttribute("data-events-date-key") || "").trim();
        if (key) {
          selectedKey = key;
          const nextEntry = getSelectedEntry();
          setSelectionContext({
            requestedDate: selectionContext.requestedDate,
            openedFromDate: true,
            resolvedFromTemplate: Boolean(nextEntry && nextEntry.kind === "template"),
            candidateKeys: selectionContext.candidateKeys,
          });
          showValidation("");
        }
        return;
      }
      const editButton = event.target.closest("[data-events-date-edit]");
      if (editButton) {
        const nextKey = String(editButton.getAttribute("data-events-date-edit") || "").trim();
        if (!nextKey || nextKey === selectedKey) return;
        try {
          syncCurrentDraftOrThrow();
        } catch (error) {
          showValidation(error && error.message ? error.message : "Fix the current entry before switching events.", true);
          return;
        }
        selectedKey = nextKey;
        const nextEntry = getSelectedEntry();
        setSelectionContext({
          requestedDate: selectionContext.requestedDate,
          openedFromDate: true,
          resolvedFromTemplate: Boolean(nextEntry && nextEntry.kind === "template"),
          candidateKeys: selectionContext.candidateKeys,
        });
        updateDatePicker(nextEntry);
        renderList(searchInput ? searchInput.value : "");
        syncAuthUi();
        toggleOpen(true);
        showValidation("");
        setStatus(isDirty ? "Draft" : "Ready", isDirty ? "neutral" : "ready");
        return;
      }

      const deleteButton = event.target.closest("[data-events-date-delete]");
      if (deleteButton) {
        deleteDateTreeEntry(String(deleteButton.getAttribute("data-events-date-delete") || "").trim());
        return;
      }

      const doneButton = event.target.closest("[data-events-date-done]");
      if (doneButton) {
        finalizeDateTreeEntryEdits(String(doneButton.getAttribute("data-events-date-done") || "").trim());
        return;
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      renderList("");
      if (searchInput) searchInput.focus();
    });
  }

  if (fieldKind) {
    fieldKind.addEventListener("change", () => {
      if (!getFormStartDateValue()) {
        setFormStartDateValue(getFormStartDateValue() || new Date().toISOString().slice(0, 10));
      }
      updateKindFields(fieldKind.value);
      refreshContextPanel();
      setDirty(true);
    });
  }

  if (fieldDefinitionSelect) {
    fieldDefinitionSelect.addEventListener("change", () => {
      const entry = getSelectedEntry();
      if (!entry || !payload) return;
      const nextId = String(fieldDefinitionSelect.value || "").trim();
      if (nextId === NEW_DEFINITION_OPTION) {
        if (entry.item) delete entry.item.eventId;
        fillDefinitionFormFromEntry(entry);
        if (pageDetails) pageDetails.open = false;
        setDirty(true);
        setStatus("Draft", "neutral");
        return;
      }
      if (entry.item && nextId) entry.item.eventId = nextId;
      const definition = nextId ? getDefinitionById(nextId) : null;
      if (definition) {
        if (fieldDefinitionEyebrow) fieldDefinitionEyebrow.value = definition.eyebrow || definition.type || "Event";
        if (fieldDefinitionTitle) fieldDefinitionTitle.value = definition.title || "";
        if (fieldDefinitionSlug) fieldDefinitionSlug.value = definition.slug || "";
        if (fieldDefinitionHeroSummary) fieldDefinitionHeroSummary.value = definition.heroSummary || "";
        if (fieldDefinitionNarrative) fieldDefinitionNarrative.value = definition.narrative || "";
        if (fieldDefinitionExperience) fieldDefinitionExperience.value = definition.experience || "";
        if (fieldDefinitionScheduleNote) fieldDefinitionScheduleNote.value = definition.scheduleNote || "";
        if (fieldDefinitionWhatToExpect) fieldDefinitionWhatToExpect.value = listToLines(definition.whatToExpect);
        if (fieldDefinitionIncluded) fieldDefinitionIncluded.value = listToLines(definition.included);
        if (fieldDefinitionCtaLabel) fieldDefinitionCtaLabel.value = definition.primaryCtaLabel || "";
        if (fieldDefinitionCtaHref) fieldDefinitionCtaHref.value = definition.primaryCtaHref || "";
      }
      setDefinitionHelp(
        "This schedule is using an existing event page. Changing the page fields updates every schedule linked to that page."
      );
      setDirty(true);
      setStatus("Draft", "neutral");
    });
  }

  const trackedFields = [
    fieldUpdated,
    fieldTimezone,
    fieldHorizon,
    fieldPreview,
    fieldDefinitionSelect,
    fieldDefinitionEyebrow,
    fieldDefinitionTitle,
    fieldDefinitionSlug,
    fieldDefinitionHeroSummary,
    fieldDefinitionNarrative,
    fieldDefinitionExperience,
    fieldDefinitionScheduleNote,
    fieldDefinitionWhatToExpect,
    fieldDefinitionIncluded,
    fieldDefinitionCtaLabel,
    fieldDefinitionCtaHref,
    fieldId,
    fieldTitle,
    fieldDate,
    fieldTemplateAnchor,
    fieldTime,
    fieldEndTime,
    fieldEndDate,
    fieldType,
    fieldStatus,
    fieldLocation,
    fieldSummary,
    fieldRegistrationEnabled,
    fieldRegistrationCapacity,
    fieldCtaLabel,
    fieldCtaHref,
    fieldInterval,
    fieldRepeatUnit,
    fieldExcludedDates,
    fieldMonths,
  ].filter(Boolean);

  trackedFields.forEach((field) => {
    const markDirty = () => {
      refreshContextPanel();
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

  populateTimeSelect(fieldTime, "", "Select time");
  populateTimeSelect(fieldEndTime, "", "Select time");
  clearForm();
  setDirty(false);
  (async () => {
    await validateStoredToken();
    syncAuthUi();
    await loadPayload();
  })();
})();
