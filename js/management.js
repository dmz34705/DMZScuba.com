(() => {
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const managementUrl = apiRoot ? `${apiRoot}/api/admin/management` : "/api/admin/management";
  const eventsUrl = apiRoot ? `${apiRoot}/api/v2/events` : "/api/v2/events";
  const adminEventsUrl = apiRoot ? `${apiRoot}/api/admin/v2/events` : "/api/admin/v2/events";
  const tokenStorageKey = "dmzMediaToken";
  const timeOptions = Array.from({ length: 48 }, (_unused, index) => {
    const hour24 = Math.floor(index / 2);
    const minute = index % 2 === 0 ? "00" : "30";
    const meridiem = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${minute} ${meridiem}`;
  });

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
  const calendarItemsEl = app.querySelector("[data-calendar-items]");
  const calendarStatus = app.querySelector("[data-calendar-status]");
  const refreshCalendarButton = app.querySelector("[data-refresh-calendar]");
  const showPastCalendarToggle = app.querySelector("[data-show-past-calendar]");
  const registrationManager = app.querySelector("[data-registration-manager]");
  const registrationSummary = app.querySelector("[data-registration-summary]");
  const registrationList = app.querySelector("[data-registration-list]");
  const refreshRegistrationsButton = app.querySelector("[data-refresh-registrations]");
  const classScheduleEl = app.querySelector("[data-class-schedule]");
  const extraFieldsSection = app.querySelector(".management-extra-fields");
  const classSessionTypes = ["classroom", "pool", "openWater"];
  const classSessionLabels = {
    classroom: "Classroom",
    pool: "Pool",
    openWater: "Open Water",
  };
  const typeConfigs = {
    contact: {
      editor: "Contact Profile",
      newTitle: "New Contact Profile",
      notesLabel: "Profile Notes",
      notesPlaceholder: "Preferences, certification history, gear notes, family members, general relationship notes...",
      fields: [
        "recordType",
        "priority",
        "firstName",
        "lastName",
        "contactEmail",
        "contactPhone",
        "source",
        "certification",
        "notes",
      ],
    },
    inquiry: {
      editor: "Inquiry",
      newTitle: "New Inquiry",
      titleLabel: "Inquiry Summary",
      titlePlaceholder: "Open Water class question",
      relatedLabel: "Interested Class, Trip, or Service",
      notesLabel: "Inquiry Notes / Progress",
      notesPlaceholder: "What they asked about, latest contact, objections, follow-up timing, quote details...",
      fields: [
        "recordType",
        "title",
        "status",
        "priority",
        "owner",
        "contactName",
        "contactEmail",
        "contactPhone",
        "dueDate",
        "relatedEvent",
        "stage",
        "source",
        "amountOwed",
        "amountPaid",
        "nextStep",
        "notes",
      ],
    },
    class: {
      editor: "Scheduled Class",
      newTitle: "New Scheduled Class",
      titleLabel: "Class Name",
      titlePlaceholder: "Open Water - May Weekend",
      relatedLabel: "Related Event Page or Calendar Item",
      capacityLabel: "Class Capacity",
      notesLabel: "Class Description",
      notesPlaceholder: "Public-facing class description plus any important class context...",
      fields: [
        "recordType",
        "title",
        "classId",
        "capacity",
        "classSchedule",
        "notes",
      ],
    },
    trip: {
      editor: "Calendar Event",
      newTitle: "New Calendar Event",
      titleLabel: "Trip Name / Event Name",
      titlePlaceholder: "Open Water Weekend",
      relatedLabel: "Site Calendar Record",
      capacityLabel: "Spots Available",
      notesLabel: "Event Description",
      notesPlaceholder: "Short description shown on the public calendar and event detail view...",
      fields: [
        "recordType",
        "title",
        "startDate",
        "endDate",
        "startTime",
        "endTime",
        "eventTag",
        "eventLocation",
        "registrationEnabled",
        "capacity",
        "notes",
      ],
    },
    task: {
      editor: "Business Task",
      newTitle: "New Business Task",
      titleLabel: "Task",
      titlePlaceholder: "Renew insurance policy",
      notesLabel: "Task Notes",
      notesPlaceholder: "Context, checklist, links, blockers, completion notes...",
      fields: ["recordType", "title", "status", "priority", "owner", "dueDate", "nextStep", "notes"],
    },
  };
  const priorityOptionsByType = {
    contact: ["normal", "high"],
    default: ["normal", "high", "urgent", "low"],
  };
  const metricEls = {
    open: app.querySelector('[data-metric="open"]'),
    contact: app.querySelector('[data-metric="contact"]'),
    inquiry: app.querySelector('[data-metric="inquiry"]'),
    class: app.querySelector('[data-metric="class"]'),
    trip: app.querySelector('[data-metric="trip"]'),
    owed: app.querySelector('[data-metric="owed"]'),
  };

  const state = {
    records: [],
    eventsPayload: null,
    allSiteEvents: [],
    siteEvents: [],
    selectedId: "",
    activeSiteRecord: null,
    registrationSnapshot: null,
    registrationLoading: false,
    registrationDeletingId: "",
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

  function parseDateKey(value) {
    const parts = String(value || "").split("-").map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
      return null;
    }
    return date;
  }

  function dateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function slugify(value, fallback = "record") {
    const slug = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return slug || fallback;
  }

  function addDateDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function addMonths(date, months) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  function addYears(date, years) {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }

  function todayKey() {
    const now = new Date();
    return dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  function formatMoney(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return "$0";
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    });
  }

  function getTypeConfig(type) {
    return typeConfigs[type] || typeConfigs.contact;
  }

  function setFieldLabel(fieldName, labelText) {
    const field = recordForm && recordForm.elements[fieldName];
    if (!field) return;
    const label = field.closest("label");
    if (!label) return;
    const firstTextNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    if (firstTextNode) {
      firstTextNode.textContent = `\n              ${labelText}\n              `;
    }
  }

  function setFieldPlaceholder(fieldName, placeholder) {
    const field = recordForm && recordForm.elements[fieldName];
    if (field && "placeholder" in field) field.placeholder = placeholder || "";
  }

  function syncPriorityOptions(type) {
    const select = recordForm && recordForm.elements.priority;
    if (!select) return;
    const current = select.value || "normal";
    const options = priorityOptionsByType[type] || priorityOptionsByType.default;
    select.innerHTML = options
      .map((value) => `<option value="${value}">${formatLabel(value)}</option>`)
      .join("");
    select.value = options.includes(current) ? current : "normal";
  }

  function syncTimeOptions() {
    if (!recordForm) return;
    recordForm.querySelectorAll("[data-time-select]").forEach((select) => {
      const current = String(select.value || "").trim();
      select.innerHTML = [
        '<option value="">Select time</option>',
        ...timeOptions.map((value) => `<option value="${value}">${value}</option>`),
      ].join("");
      select.value = timeOptions.includes(current) ? current : "";
    });
  }

  function classSessionTemplate(type, session = {}) {
    const options = [
      '<option value="">Select time</option>',
      ...timeOptions.map((value) => `<option value="${value}" ${String(session.startTime || "") === value ? "selected" : ""}>${value}</option>`),
    ].join("");
    const endOptions = [
      '<option value="">Select time</option>',
      ...timeOptions.map((value) => `<option value="${value}" ${String(session.endTime || "") === value ? "selected" : ""}>${value}</option>`),
    ].join("");
    return `
      <div class="management-class-session-row" data-class-session="${escapeHtml(type)}">
        <label>
          <span>Date</span>
          <input type="date" data-class-session-date value="${escapeHtml(session.date || "")}" aria-label="${escapeHtml(classSessionLabels[type])} date" />
        </label>
        <label>
          <span>Start</span>
          <select data-class-session-start aria-label="${escapeHtml(classSessionLabels[type])} start time">${options}</select>
        </label>
        <label>
          <span>End</span>
          <select data-class-session-end aria-label="${escapeHtml(classSessionLabels[type])} end time">${endOptions}</select>
        </label>
        <label class="management-class-session-location">
          <span>Location</span>
          <input type="text" data-class-session-location value="${escapeHtml(session.location || "")}" maxlength="180" placeholder="${escapeHtml(classSessionLabels[type])} location" />
        </label>
        <button type="button" data-remove-class-session>Remove</button>
      </div>
    `;
  }

  function renderClassSchedule(sessions = {}) {
    if (!classScheduleEl) return;
    classSessionTypes.forEach((type) => {
      const list = classScheduleEl.querySelector(`[data-class-session-list="${type}"]`);
      if (!list) return;
      const rows = Array.isArray(sessions[type]) ? sessions[type] : [];
      list.innerHTML = rows.length
        ? rows.map((session) => classSessionTemplate(type, session)).join("")
        : '<div class="management-empty">No dates added yet.</div>';
    });
  }

  function addClassSession(type, session = {}) {
    if (!classSessionTypes.includes(type) || !classScheduleEl) return;
    const list = classScheduleEl.querySelector(`[data-class-session-list="${type}"]`);
    if (!list) return;
    if (list.querySelector(".management-empty")) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", classSessionTemplate(type, session));
  }

  function readClassSessions() {
    const sessions = {};
    if (!classScheduleEl) return sessions;
    classSessionTypes.forEach((type) => {
      sessions[type] = Array.from(classScheduleEl.querySelectorAll(`[data-class-session="${type}"]`))
        .map((row) => ({
          date: String((row.querySelector("[data-class-session-date]") || {}).value || "").trim(),
          startTime: String((row.querySelector("[data-class-session-start]") || {}).value || "").trim(),
          endTime: String((row.querySelector("[data-class-session-end]") || {}).value || "").trim(),
          location: String((row.querySelector("[data-class-session-location]") || {}).value || "").trim(),
        }))
        .filter((session) => session.date);
    });
    return sessions;
  }

  function syncFormGridVisibility() {
    if (!recordForm) return;
    recordForm.querySelectorAll(".management-form-grid").forEach((grid) => {
      const visibleFields = Array.from(grid.querySelectorAll("[data-field]")).filter(
        (field) => !field.classList.contains("management-field-hidden")
      );
      grid.classList.toggle("management-field-hidden", visibleFields.length === 0);
    });
    if (extraFieldsSection) {
      const visibleExtras = Array.from(extraFieldsSection.querySelectorAll("[data-field]")).filter(
        (field) => !field.classList.contains("management-field-hidden")
      );
      extraFieldsSection.classList.toggle("management-field-hidden", visibleExtras.length === 0);
    }
  }

  function applyTypeConfig(type, editing = false) {
    if (!recordForm) return;
    const config = getTypeConfig(type);
    const visibleFields = new Set(config.fields);
    recordForm.querySelectorAll("[data-field]").forEach((fieldWrap) => {
      const fieldName = fieldWrap.getAttribute("data-field") || "";
      const isVisible = visibleFields.has(fieldName);
      fieldWrap.classList.toggle("management-field-hidden", !isVisible);
      fieldWrap.querySelectorAll("input, select, textarea").forEach((field) => {
        field.disabled = !isVisible;
      });
    });
    setFieldLabel("title", config.titleLabel || "Title");
    setFieldLabel("relatedEvent", config.relatedLabel || "Related Class, Trip, or Event");
    setFieldLabel("capacity", config.capacityLabel || "Capacity / Roster Size");
    setFieldLabel("certification", config.certificationLabel || "Certification / Level");
    setFieldLabel("notes", config.notesLabel || "Notes / Progress");
    setFieldPlaceholder("title", config.titlePlaceholder || "");
    setFieldPlaceholder("notes", config.notesPlaceholder || "");
    syncPriorityOptions(type);
    syncFormGridVisibility();
    if (editorTitle) editorTitle.textContent = editing ? `Edit ${config.editor}` : config.newTitle;
  }

  function resetRegistrationManager() {
    state.registrationSnapshot = null;
    state.registrationLoading = false;
    state.registrationDeletingId = "";
    renderRegistrationManager();
  }

  function getExtras(record) {
    return record && record.extras && typeof record.extras === "object" ? record.extras : {};
  }

  function getBalance(record) {
    const extras = getExtras(record);
    const owed = Math.max(0, Number(extras.amountOwed || 0) || 0);
    const paid = Math.max(0, Number(extras.amountPaid || 0) || 0);
    return Math.max(0, owed - paid);
  }

  function normalizeSiteText(value) {
    return String(value || "").trim();
  }

  function classifySiteEvent(item) {
    const type = normalizeSiteText(item && item.type).toLowerCase();
    return type === "training" ? "class" : "trip";
  }

  function getSiteEventKey(item) {
    return [item.sourceId || item.id || "", item.date || item.startDate || ""].join("|");
  }

  function isSiteBackedManagementRecord(record) {
    const extras = getExtras(record);
    return extras.siteSource === "events";
  }

  function getUpcomingSiteEventCounts() {
    const counts = { class: 0, trip: 0, open: 0 };
    const currentTodayKey = todayKey();
    state.siteEvents.forEach((item) => {
      if (String(item.date || "") < currentTodayKey) return;
      const type = classifySiteEvent(item);
      if (type !== "class" && type !== "trip") return;
      if (type === "class") counts.class += 1;
      counts.trip += 1;
      counts.open += 1;
    });
    return counts;
  }

  function expandSiteEventPayload(payload) {
    const now = new Date();
    const pastStart = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -18);
    const horizonMonths = Math.max(1, Math.min(60, Math.trunc(Number(payload && payload.horizonMonths) || 12)));
    const horizonEnd = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), horizonMonths);
    const explicit = Array.isArray(payload && payload.events) ? payload.events : [];
    const templates = Array.isArray(payload && payload.templates) ? payload.templates : [];
    const results = [];

    explicit.forEach((eventItem) => {
      if (!eventItem || !eventItem.date) return;
      const eventDate = parseDateKey(eventItem.date);
      if (!eventDate || eventDate < pastStart) return;
      results.push({
        ...eventItem,
        sourceId: eventItem.id || "",
        eventKind: "event",
      });
    });

    templates.forEach((template) => {
      const start = parseDateKey(template && template.startDate);
      if (!start) return;
      const repeatUnit = ["week", "month", "year"].includes(template.repeatUnit) ? template.repeatUnit : "month";
      const repeatInterval = Math.max(1, Math.trunc(Number(template.repeatInterval || 1) || 1));
      const endDate = parseDateKey(template.endDate);
      const excluded = new Set(Array.isArray(template.excludedDates) ? template.excludedDates : []);
      const durationDays = Math.max(1, Math.trunc(Number(template.durationDays || 1) || 1));
      const monthFilter = Array.isArray(template.months)
        ? new Set(template.months.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
        : null;
      for (let cursor = new Date(start); cursor <= horizonEnd; ) {
        const key = dateKey(cursor);
        if ((!endDate || cursor <= endDate) && !excluded.has(key) && (!monthFilter || monthFilter.has(cursor.getMonth() + 1))) {
          results.push({
            ...template,
            date: key,
            endDate: durationDays > 1 ? dateKey(addDateDays(cursor, durationDays - 1)) : template.endDate || "",
            sourceId: template.id || "",
            eventKind: "template",
          });
        }
        if (repeatUnit === "week") cursor = addDateDays(cursor, repeatInterval * 7);
        else if (repeatUnit === "year") cursor = addYears(cursor, repeatInterval);
        else cursor = addMonths(cursor, repeatInterval);
      }
    });

    return results
      .filter((item) => item && item.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 36);
  }

  function buildManagementRecordFromSiteEvent(item, existing = null) {
    const recordType = "trip";
    const title = normalizeSiteText(item.title) || "Scheduled Event";
    const capacity = Math.max(0, Number(item.registrationCapacity || 0) || 0);
    const existingExtras = getExtras(existing);
    return {
      id: `site-events:${normalizeSiteText(item.eventKind || "event")}:${normalizeSiteText(item.sourceId || item.id)}:${normalizeSiteText(item.date)}`,
      recordType,
      title,
      status: normalizeSiteText(item.status) || "scheduled",
      priority: normalizeSiteText(item.managementPriority) || "normal",
      owner: normalizeSiteText(item.managementOwner),
      contactName: normalizeSiteText(item.managementContactName),
      contactEmail: normalizeSiteText(item.managementContactEmail),
      contactPhone: normalizeSiteText(item.managementContactPhone),
      dueDate: normalizeSiteText(item.managementDueDate) || normalizeSiteText(item.date),
      relatedEvent: title,
      notes: normalizeSiteText(item.managementNotes) || normalizeSiteText(item.summary),
      extras: {
        ...existingExtras,
        siteSource: "events",
        sourceId: normalizeSiteText(item.sourceId || item.id),
        eventId: normalizeSiteText(item.eventId || item.id),
        eventDate: normalizeSiteText(item.date),
        eventKind: normalizeSiteText(item.eventKind),
        startDate: normalizeSiteText(item.date),
        endDate: normalizeSiteText(item.endDate),
        startTime: normalizeSiteText(item.time),
        endTime: normalizeSiteText(item.endTime),
        eventTag: normalizeSiteText(item.type) || "Training",
        eventLocation: normalizeSiteText(item.location),
        registrationEnabled: item.registrationEnabled ? "1" : "",
        capacity: capacity ? String(capacity) : existingExtras.capacity || "",
        certification: existingExtras.certification || "",
        source: "Site calendar",
        amountOwed: normalizeSiteText(item.managementAmountOwed),
        amountPaid: normalizeSiteText(item.managementAmountPaid),
        nextStep: normalizeSiteText(item.managementNextStep),
      },
    };
  }

  function recordMatchesSearch(record) {
    const query = state.search.trim().toLowerCase();
    if (!query) return true;
    const extras = getExtras(record);
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
      extras.firstName,
      extras.lastName,
      extras.stage,
      extras.source,
      extras.startDate,
      extras.endDate,
      extras.startTime,
      extras.endTime,
      extras.eventTag,
      extras.eventLocation,
      extras.certification,
      extras.nextStep,
      extras.amountOwed,
      extras.amountPaid,
      extras.capacity,
      extras.siteSource,
      extras.sourceId,
      extras.eventDate,
      extras.classId,
      JSON.stringify(extras.classSessions || {}),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  function siteEventMatchesSearch(item) {
    const query = state.search.trim().toLowerCase();
    if (!query) return true;
    const haystack = [
      item.title,
      item.type,
      item.summary,
      item.location,
      item.time,
      item.endTime,
      item.date,
      item.endDate,
      item.type,
      classifySiteEvent(item),
      item.registrationCapacity,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  function getVisibleRecords() {
    return state.records
      .filter((record) => !isSiteBackedManagementRecord(record))
      .filter((record) => state.filterType === "all" || record.recordType === state.filterType)
      .filter(recordMatchesSearch);
  }

  function getVisibleSiteEventsForRecords() {
    if (!["all", "class", "trip"].includes(state.filterType)) return [];
    if (state.filterType === "class") return [];
    const currentTodayKey = todayKey();
    const showPast = Boolean(showPastCalendarToggle && showPastCalendarToggle.checked);
    return state.siteEvents
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const type = classifySiteEvent(item);
        if (state.filterType === "trip") {
          // The Calendar tab intentionally shows every site calendar record, not only travel trips.
        } else if (state.filterType !== "all" && type !== state.filterType) return false;
        if (!showPast && String(item.date || "") < currentTodayKey) return false;
        return siteEventMatchesSearch(item);
      });
  }

  function updateMetrics() {
    const openCount = state.records.filter(
      (record) =>
        !isSiteBackedManagementRecord(record) &&
        record.recordType !== "contact" &&
        !["complete", "archived"].includes(record.status)
    ).length;
    const openBalance = state.records
      .filter(
        (record) =>
          !isSiteBackedManagementRecord(record) &&
          record.recordType !== "contact" &&
          !["complete", "archived"].includes(record.status)
      )
      .reduce((sum, record) => sum + getBalance(record), 0);
    const byType = state.records.reduce((counts, record) => {
      if (isSiteBackedManagementRecord(record)) return counts;
      counts[record.recordType] = (counts[record.recordType] || 0) + 1;
      return counts;
    }, {});
    const siteCounts = getUpcomingSiteEventCounts();
    if (metricEls.open) metricEls.open.textContent = String(openCount + siteCounts.open);
    if (metricEls.contact) metricEls.contact.textContent = String(byType.contact || 0);
    if (metricEls.inquiry) metricEls.inquiry.textContent = String(byType.inquiry || 0);
    if (metricEls.class) metricEls.class.textContent = String(byType.class || 0);
    if (metricEls.trip) metricEls.trip.textContent = String((byType.trip || 0) + siteCounts.trip);
    if (metricEls.owed) metricEls.owed.textContent = formatMoney(openBalance);
  }

  function renderRecords() {
    if (!recordList) return;
    updateMetrics();
    const visibleRecords = getVisibleRecords();
    const visibleSiteEvents = getVisibleSiteEventsForRecords();
    if (!visibleRecords.length && !visibleSiteEvents.length) {
      recordList.innerHTML = '<div class="management-empty">No matching management items yet.</div>';
      return;
    }

    const recordMarkup = visibleRecords
      .map((record) => {
        const extras = getExtras(record);
        const balance = getBalance(record);
        const meta = [
          record.owner ? `Owner: ${record.owner}` : "",
          record.contactName || [extras.firstName, extras.lastName].filter(Boolean).join(" ") || record.contactEmail || "",
          extras.stage ? `Stage: ${formatLabel(extras.stage)}` : "",
          extras.startDate ? `Starts ${formatDate(extras.startDate)}` : "",
          record.dueDate ? `Due ${formatDate(record.dueDate)}` : "",
          balance > 0 ? `Balance ${formatMoney(balance)}` : "",
          record.relatedEvent || "",
        ].filter(Boolean);
        const note = String(record.notes || "").trim();
        const summary = note.length > 180 ? `${note.slice(0, 180)}...` : note;
        return `
          <article class="management-record ${record.id === state.selectedId ? "is-selected" : ""}" data-record-id="${escapeHtml(record.id)}">
            <div>
              <div class="management-record-badges">
                <span class="management-badge">${escapeHtml(formatLabel(record.recordType))}</span>
                ${
                  record.recordType === "contact"
                    ? ""
                    : `<span class="management-badge is-${escapeHtml(record.status)}">${escapeHtml(formatLabel(record.status))}</span>`
                }
                <span class="management-badge is-${escapeHtml(record.priority)}">${escapeHtml(formatLabel(record.priority))}</span>
              </div>
              <h3>${escapeHtml(record.title)}</h3>
              ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
              ${meta.length ? `<div class="management-record-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
            </div>
            ${
              record.recordType === "contact"
                ? ""
                : `<div class="management-record-actions">
              <select data-status-change="${escapeHtml(record.id)}" aria-label="Change status for ${escapeHtml(record.title)}">
                ${["new", "active", "waiting", "scheduled", "complete", "archived"]
                  .map((status) => `<option value="${status}" ${record.status === status ? "selected" : ""}>${formatLabel(status)}</option>`)
                  .join("")}
              </select>
            </div>`
            }
          </article>
        `;
      })
      .join("");
    const currentTodayKey = todayKey();
    const siteMarkup = visibleSiteEvents
      .map(({ item, index }) => {
        const recordType = classifySiteEvent(item);
        const isPast = String(item.date || "") < currentTodayKey;
        const dateText = [formatDate(item.date), item.endDate && item.endDate !== item.date ? formatDate(item.endDate) : ""]
          .filter(Boolean)
          .join(" - ");
        const meta = [
          "Site calendar",
          item.type || "",
          dateText,
          item.time ? (item.endTime ? `${item.time} - ${item.endTime}` : item.time) : "",
          item.location || "",
          item.registrationCapacity ? `${item.registrationCapacity} spots` : "",
        ].filter(Boolean);
        const summary = String(item.summary || "").trim();
        const eventUrl = `/pages/events/index.html?event=${encodeURIComponent(item.id || item.sourceId || "")}&date=${encodeURIComponent(item.date || "")}`;
        return `
          <article class="management-record management-record-site" data-calendar-index="${index}">
            <div>
              <div class="management-record-badges">
                <span class="management-badge">${escapeHtml(formatLabel(recordType))}</span>
                <span class="management-badge is-waiting">Site Calendar</span>
                ${isPast ? '<span class="management-badge is-waiting">Past</span>' : ""}
              </div>
              <h3>${escapeHtml(item.title || "Scheduled Event")}</h3>
              ${summary ? `<p>${escapeHtml(summary.length > 180 ? `${summary.slice(0, 180)}...` : summary)}</p>` : ""}
              <div class="management-record-meta">${meta.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
            </div>
            <div class="management-calendar-actions">
              <button type="button" data-calendar-open="${index}">Open Record</button>
              <a href="${escapeHtml(eventUrl)}" target="_blank" rel="noopener">View Site Event</a>
            </div>
          </article>
        `;
      })
      .join("");
    recordList.innerHTML = `${recordMarkup}${siteMarkup}`;
  }

  function renderCalendarItems() {
    if (!calendarItemsEl) return;
    const showPast = Boolean(showPastCalendarToggle && showPastCalendarToggle.checked);
    const currentTodayKey = todayKey();
    const visibleEvents = state.siteEvents.filter((item) => showPast || String(item.date || "") >= currentTodayKey);
    if (!visibleEvents.length) {
      calendarItemsEl.innerHTML = showPast
        ? '<div class="management-empty">No site calendar records found.</div>'
        : '<div class="management-empty">No upcoming site calendar records found. Turn on past items to review older events.</div>';
      return;
    }
    calendarItemsEl.innerHTML = visibleEvents
      .map((item, index) => {
        const sourceIndex = state.siteEvents.indexOf(item);
        const recordType = classifySiteEvent(item);
        const isPast = String(item.date || "") < currentTodayKey;
        const dateText = [formatDate(item.date), item.endDate && item.endDate !== item.date ? formatDate(item.endDate) : ""]
          .filter(Boolean)
          .join(" - ");
        const meta = [
          formatLabel(recordType),
          item.type || "",
          dateText,
          item.time ? (item.endTime ? `${item.time} - ${item.endTime}` : item.time) : "",
          item.location || "",
          item.registrationCapacity ? `${item.registrationCapacity} spots` : "",
        ].filter(Boolean);
        const eventUrl = `/pages/events/index.html?event=${encodeURIComponent(item.id || item.sourceId || "")}&date=${encodeURIComponent(item.date || "")}`;
        return `
          <article class="management-calendar-item ${isPast ? "is-past" : ""}" data-calendar-index="${sourceIndex}">
            <div>
              <div class="management-record-badges">
                <span class="management-badge">${escapeHtml(formatLabel(recordType))}</span>
                ${isPast ? '<span class="management-badge is-waiting">Past</span>' : ""}
              </div>
              <h3>${escapeHtml(item.title || "Scheduled Event")}</h3>
              <p>${escapeHtml(meta.join(" | "))}</p>
            </div>
            <div class="management-calendar-actions">
              <button type="button" data-calendar-open="${sourceIndex}">Open Record</button>
              <a href="${escapeHtml(eventUrl)}" target="_blank" rel="noopener">View Site Event</a>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function getActiveRegistrationContext() {
    const record = state.activeSiteRecord;
    const extras = getExtras(record);
    const sourceId = normalizeSiteText(extras.sourceId || extras.eventId);
    const eventDate = normalizeSiteText(extras.eventDate || extras.startDate);
    if (!record || !sourceId || !eventDate) return null;
    return {
      sourceId,
      eventDate,
      registrationEnabled: Boolean(extras.registrationEnabled),
      registrationCapacity: Math.max(0, Number(extras.capacity || 0) || 0),
    };
  }

  function renderRegistrationManager() {
    if (!registrationManager) return;
    const context = getActiveRegistrationContext();
    registrationManager.hidden = !context;
    if (!context) return;
    const snapshot = state.registrationSnapshot;
    const registrants = Array.isArray(snapshot && snapshot.registrants) ? snapshot.registrants : [];
    const capacity = Math.max(0, Number((snapshot && snapshot.registrationCapacity) || context.registrationCapacity || 0) || 0);
    const usedSpots = Math.max(0, Number((snapshot && snapshot.usedSpots) || 0) || 0);
    const remainingSpots = Math.max(0, Number((snapshot && snapshot.remainingSpots) || 0) || 0);
    if (registrationSummary) {
      registrationSummary.textContent = state.registrationLoading
        ? "Loading signups..."
        : snapshot
          ? `${usedSpots} of ${capacity} spots filled. ${remainingSpots} remaining.`
          : "Load current signups to manage this event's registration list.";
    }
    if (refreshRegistrationsButton) {
      refreshRegistrationsButton.disabled = state.registrationLoading;
      refreshRegistrationsButton.textContent = state.registrationLoading ? "Loading..." : "Refresh Signups";
    }
    if (!registrationList) return;
    if (state.registrationLoading && !snapshot) {
      registrationList.innerHTML = '<div class="management-empty">Loading registered divers...</div>';
      return;
    }
    if (!snapshot) {
      registrationList.innerHTML = '<div class="management-empty">No signup data loaded yet.</div>';
      return;
    }
    if (!registrants.length) {
      registrationList.innerHTML = '<div class="management-empty">Nobody is registered for this date yet.</div>';
      return;
    }
    registrationList.innerHTML = registrants
      .map((registrant) => {
        const registrantId = normalizeSiteText(registrant && registrant.id);
        const additionalGuests = Math.max(0, Number((registrant && registrant.additionalGuests) || 0) || 0);
        const partySize = Math.max(1, Number((registrant && registrant.partySize) || 1) || 1);
        const details = [
          partySize > 1 ? `${partySize} divers total` : "Solo signup",
          additionalGuests > 0 ? `${additionalGuests} guest${additionalGuests === 1 ? "" : "s"}` : "",
          normalizeSiteText(registrant && registrant.createdAt) ? `Signed up ${normalizeSiteText(registrant.createdAt).slice(0, 10)}` : "",
        ].filter(Boolean);
        const deleting = registrantId && registrantId === state.registrationDeletingId;
        return `
          <div class="management-registration-item">
            <div>
              <strong>${escapeHtml(normalizeSiteText(registrant && registrant.name) || "Unnamed registrant")}</strong>
              <span>${escapeHtml(details.join(" | "))}</span>
            </div>
            <button type="button" data-remove-registration="${escapeHtml(registrantId)}" ${!registrantId || deleting || state.registrationLoading ? "disabled" : ""}>${deleting ? "Removing..." : "Unregister"}</button>
          </div>
        `;
      })
      .join("");
  }

  async function loadRegistrationSnapshot() {
    const context = getActiveRegistrationContext();
    if (!context) {
      resetRegistrationManager();
      return null;
    }
    state.registrationLoading = true;
    renderRegistrationManager();
    const url = `${eventsUrl}/${encodeURIComponent(context.sourceId)}/registrations?date=${encodeURIComponent(context.eventDate)}&t=${Date.now()}`;
    const resp = await fetch(url, { cache: "no-store" }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    state.registrationLoading = false;
    if (!resp || !resp.ok || !data.ok) {
      state.registrationSnapshot = null;
      if (registrationSummary) registrationSummary.textContent = data.error || "Registration status is unavailable.";
      renderRegistrationManager();
      return null;
    }
    state.registrationSnapshot = data;
    renderRegistrationManager();
    return data;
  }

  async function removeRegistration(registrationId) {
    const context = getActiveRegistrationContext();
    const safeId = normalizeSiteText(registrationId);
    if (!context || !safeId) return;
    if (!window.confirm("Unregister this person from the event?")) return;
    state.registrationDeletingId = safeId;
    renderRegistrationManager();
    const url = `${adminEventsUrl}/${encodeURIComponent(context.sourceId)}/registrations/${encodeURIComponent(safeId)}?date=${encodeURIComponent(context.eventDate)}`;
    const resp = await apiFetch(url, { method: "DELETE" }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    state.registrationDeletingId = "";
    if (!resp || !resp.ok || !data.ok) {
      setStatus(recordStatus, data.error || "Could not unregister this person.", "error");
      renderRegistrationManager();
      return;
    }
    state.registrationSnapshot = data;
    setStatus(recordStatus, "Registration removed.", "success");
    renderRegistrationManager();
  }

  function readFormRecord() {
    const formData = new FormData(recordForm);
    const id = String(formData.get("id") || "").trim();
    const existing =
      id && state.activeSiteRecord && state.activeSiteRecord.id === id
        ? state.activeSiteRecord
        : id
          ? state.records.find((item) => item.id === id)
          : null;
    const existingExtras = getExtras(existing);
    const textValue = (name, fallback = "") =>
      recordForm.elements[name] && !recordForm.elements[name].disabled
        ? String(formData.get(name) || "").trim()
        : String(fallback || "").trim();
    const extras = {
      ...existingExtras,
      firstName: textValue("firstName", existingExtras.firstName),
      lastName: textValue("lastName", existingExtras.lastName),
      stage: textValue("stage", existingExtras.stage),
      source: textValue("source", existingExtras.source),
      startDate: textValue("startDate", existingExtras.startDate),
      endDate: textValue("endDate", existingExtras.endDate),
      startTime: textValue("startTime", existingExtras.startTime),
      endTime: textValue("endTime", existingExtras.endTime),
      eventTag: textValue("eventTag", existingExtras.eventTag || "Training"),
      eventLocation: textValue("eventLocation", existingExtras.eventLocation),
      classId: textValue("classId", existingExtras.classId),
      classSessions: recordForm.elements.recordType && String(formData.get("recordType") || existing && existing.recordType || "") === "class"
        ? readClassSessions()
        : existingExtras.classSessions,
      registrationEnabled:
        recordForm.elements.registrationEnabled && !recordForm.elements.registrationEnabled.disabled
          ? (recordForm.elements.registrationEnabled.checked ? "1" : "")
          : String(existingExtras.registrationEnabled || ""),
      capacity: textValue("capacity", existingExtras.capacity),
      certification: textValue("certification", existingExtras.certification),
      amountOwed: textValue("amountOwed", existingExtras.amountOwed),
      amountPaid: textValue("amountPaid", existingExtras.amountPaid),
      nextStep: textValue("nextStep", existingExtras.nextStep),
    };
    const recordType = textValue("recordType", existing && existing.recordType) || "inquiry";
    const contactFullName = [extras.firstName, extras.lastName].filter(Boolean).join(" ").trim();
    const title = recordType === "contact" ? contactFullName : textValue("title", existing && existing.title);
    if (recordType === "class" && !extras.classId) {
      const firstSessionDate =
        classSessionTypes
          .flatMap((type) => (Array.isArray(extras.classSessions && extras.classSessions[type]) ? extras.classSessions[type] : []))
          .map((session) => session.date)
          .filter(Boolean)
          .sort()[0] || "";
      extras.classId = slugify(`${title || "class"} ${firstSessionDate}`, "class");
    }
    const contactName =
      recordType === "contact" ? contactFullName : textValue("contactName", existing && existing.contactName);
    const rawPriority = textValue("priority", existing && existing.priority) || "normal";
    const priority = recordType === "contact" && rawPriority !== "high" ? "normal" : rawPriority;
    return {
      id,
      recordType,
      title,
      status:
        recordType === "contact"
          ? "active"
          : recordType === "class"
            ? "scheduled"
            : textValue("status", existing && existing.status) || "new",
      priority,
      owner: textValue("owner", existing && existing.owner),
      contactName,
      contactEmail: textValue("contactEmail", existing && existing.contactEmail),
      contactPhone: textValue("contactPhone", existing && existing.contactPhone),
      dueDate: textValue("dueDate", existing && existing.dueDate),
      relatedEvent: textValue("relatedEvent", existing && existing.relatedEvent),
      notes: textValue("notes", existing && existing.notes),
      extras,
    };
  }

  function fillForm(record = null) {
    if (!recordForm) return;
    recordForm.reset();
    syncTimeOptions();
    const item = record || {
      id: "",
      recordType: "contact",
      status: "new",
      priority: "normal",
      extras: {},
    };
    state.activeSiteRecord = isSiteBackedManagementRecord(item) ? item : null;
    Object.entries(item).forEach(([key, value]) => {
      const field = recordForm.elements[key];
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value == null ? "" : String(value);
    });
    Object.entries(getExtras(item)).forEach(([key, value]) => {
      const field = recordForm.elements[key];
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value == null ? "" : String(value);
    });
    renderClassSchedule(getExtras(item).classSessions || {});
    if (item.recordType === "contact") {
      const extras = getExtras(item);
      const nameParts = String(item.contactName || item.title || "").trim().split(/\s+/);
      if (recordForm.elements.firstName && !recordForm.elements.firstName.value) {
        recordForm.elements.firstName.value = extras.firstName || nameParts.shift() || "";
      }
      if (recordForm.elements.lastName && !recordForm.elements.lastName.value) {
        recordForm.elements.lastName.value = extras.lastName || nameParts.join(" ") || "";
      }
    }
    state.selectedId = item.id || "";
    applyTypeConfig(item.recordType || "contact", Boolean(state.selectedId));
    if (state.activeSiteRecord) {
      loadRegistrationSnapshot();
    } else {
      resetRegistrationManager();
    }
    if (deleteButton) deleteButton.hidden = !state.selectedId || Boolean(state.activeSiteRecord);
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
    renderCalendarItems();
    return true;
  }

  async function loadSiteCalendar({ silent = false } = {}) {
    if (!silent && calendarStatus) calendarStatus.textContent = "Loading site calendar...";
    const resp = await fetch(`${eventsUrl}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    const data = resp ? await resp.json().catch(() => null) : null;
    if (!resp || !resp.ok || !data) {
      state.siteEvents = [];
      if (calendarStatus) calendarStatus.textContent = "Could not load site calendar data.";
      renderCalendarItems();
      return false;
    }
    state.eventsPayload = data;
    state.allSiteEvents = expandSiteEventPayload(data).filter((item) => ["class", "trip"].includes(classifySiteEvent(item)));
    state.siteEvents = state.allSiteEvents;
    if (calendarStatus) {
      const upcomingCount = state.siteEvents.filter((item) => String(item.date || "") >= todayKey()).length;
      const pastCount = Math.max(0, state.siteEvents.length - upcomingCount);
      calendarStatus.textContent = state.siteEvents.length
        ? `${upcomingCount} upcoming site calendar records${pastCount ? `, ${pastCount} past hidden` : ""}.`
        : "No records are currently published in the site calendar.";
    }
    renderCalendarItems();
    updateMetrics();
    return true;
  }

  function getOrderedClassSessions(record) {
    const extras = getExtras(record);
    const sessions = extras.classSessions && typeof extras.classSessions === "object" ? extras.classSessions : {};
    const ordered = [];
    classSessionTypes.forEach((type) => {
      (Array.isArray(sessions[type]) ? sessions[type] : []).forEach((session, index) => {
        if (!session || !session.date) return;
        ordered.push({
          type,
          label: classSessionLabels[type],
          index,
          date: String(session.date || "").trim(),
          startTime: String(session.startTime || "").trim(),
          endTime: String(session.endTime || "").trim(),
          location: String(session.location || "").trim(),
        });
      });
    });
    return ordered.sort((a, b) => a.date.localeCompare(b.date) || classSessionTypes.indexOf(a.type) - classSessionTypes.indexOf(b.type));
  }

  async function syncClassRecordToCalendar(record) {
    if (!state.eventsPayload) {
      await loadSiteCalendar({ silent: true });
    }
    if (!state.eventsPayload) throw new Error("Could not load site calendar for class sync.");
    const extras = getExtras(record);
    const classId = slugify(extras.classId || record.id || record.title, "class");
    const sessions = getOrderedClassSessions({ ...record, extras: { ...extras, classId } });
    const events = Array.isArray(state.eventsPayload.events) ? state.eventsPayload.events : [];
    const remaining = events.filter((item) => String(item && item.managementClassId || "").trim().toLowerCase() !== classId);
    const capacity = Math.max(0, Math.trunc(Number(extras.capacity || 0) || 0));
    const description = String(record.notes || "").trim();
    const generated = sessions.map((session, index) => {
      const primary = index === 0;
      return {
        id: `${classId}-${session.type}-${session.index + 1}`,
        eventId: classId,
        title: `${record.title} - ${session.label}`,
        date: session.date,
        endDate: session.date,
        time: session.startTime,
        endTime: session.endTime,
        type: "Training",
        status: record.status || "scheduled",
        location: session.location,
        summary: description,
        registrationEnabled: primary && capacity > 0,
        registrationCapacity: primary ? capacity : 0,
        ctaLabel: primary ? "Register For Class" : "",
        ctaHref: "",
        managementClassId: classId,
        managementClassSessionType: session.type,
        managementClassSessionIndex: session.index + 1,
        managementClassPrimary: primary,
      };
    });
    state.eventsPayload.events = [...remaining, ...generated].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const resp = await apiFetch(adminEventsUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: state.eventsPayload }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok) throw new Error(data.error || "Could not sync class dates to site calendar.");
    state.eventsPayload = data.payload || state.eventsPayload;
    state.allSiteEvents = expandSiteEventPayload(state.eventsPayload).filter((entry) =>
      ["class", "trip"].includes(classifySiteEvent(entry))
    );
    state.siteEvents = state.allSiteEvents;
    renderCalendarItems();
    updateMetrics();
    return generated.length;
  }

  async function saveRecord(event) {
    event.preventDefault();
    const record = readFormRecord();
    if (!record.title) {
      setStatus(
        recordStatus,
        record.recordType === "contact" ? "First name or last name is required." : "Title is required.",
        "error"
      );
      return;
    }
    if (isSiteBackedManagementRecord(record)) {
      try {
        const saved = await saveSiteEventRecord(record);
        fillForm(saved);
        setStatus(recordStatus, "Saved to site calendar.", "success");
        renderRecords();
        renderCalendarItems();
      } catch (error) {
        setStatus(recordStatus, error && error.message ? error.message : "Could not save site calendar record.", "error");
      }
      return;
    }
    if (record.recordType === "class" || record.recordType === "trip") {
      setStatus(recordStatus, "Open a calendar record from the Site Calendar list before editing calendar items.", "error");
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
    if (saved.recordType === "class") {
      try {
        const syncedCount = await syncClassRecordToCalendar(saved);
        fillForm(saved);
        setStatus(recordStatus, `Saved. Synced ${syncedCount} class date${syncedCount === 1 ? "" : "s"} to the site calendar.`, "success");
        return;
      } catch (error) {
        fillForm(saved);
        setStatus(recordStatus, error && error.message ? error.message : "Saved, but class dates did not sync.", "error");
        return;
      }
    }
    fillForm(saved);
    setStatus(recordStatus, "Saved.", "success");
  }

  async function saveRecordPayload(record) {
    const isUpdate = Boolean(record.id);
    const url = isUpdate ? `${managementUrl}/${encodeURIComponent(record.id)}` : managementUrl;
    const resp = await apiFetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok || !data.ok) {
      throw new Error(data.error || "Could not save item.");
    }
    const saved = data.item;
    const index = state.records.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      state.records[index] = saved;
    } else {
      state.records.unshift(saved);
    }
    return saved;
  }

  function findSiteEventPayloadItem(record) {
    const extras = getExtras(record);
    if (!state.eventsPayload) return null;
    const listName = extras.eventKind === "template" ? "templates" : "events";
    const list = Array.isArray(state.eventsPayload[listName]) ? state.eventsPayload[listName] : [];
    const sourceId = String(extras.sourceId || extras.eventId || "").trim();
    const eventDate = String(extras.eventDate || "").trim();
    const item = list.find((entry) => {
      if (!entry || String(entry.id || "").trim() !== sourceId) return false;
      if (listName === "templates") return true;
      return String(entry.date || "").trim() === eventDate;
    });
    return item ? { item, listName } : null;
  }

  async function saveSiteEventRecord(record) {
    const match = findSiteEventPayloadItem(record);
    if (!match) throw new Error("Site calendar item was not found.");
    const extras = getExtras(record);
    const item = match.item;
    item.title = record.title;
    item.status = record.status;
    item.summary = record.notes || item.summary || "";
    item.time = extras.startTime || "";
    item.endTime = extras.endTime || "";
    item.type = extras.eventTag || item.type || "Training";
    item.location = extras.eventLocation || "";
    item.registrationEnabled = Boolean(extras.registrationEnabled);
    item.registrationCapacity = Math.max(0, Math.trunc(Number(extras.capacity || item.registrationCapacity || 0) || 0));
    item.managementPriority = record.priority || "";
    item.managementOwner = record.owner || "";
    item.managementContactName = record.contactName || "";
    item.managementContactEmail = record.contactEmail || "";
    item.managementContactPhone = record.contactPhone || "";
    item.managementDueDate = record.dueDate || "";
    item.managementAmountOwed = extras.amountOwed || "";
    item.managementAmountPaid = extras.amountPaid || "";
    item.managementNextStep = extras.nextStep || "";
    item.managementNotes = record.notes || "";
    if (match.listName === "events") {
      item.date = extras.startDate || extras.eventDate || item.date;
      item.endDate = extras.endDate || item.date;
    } else {
      item.startDate = extras.startDate || item.startDate;
      item.endDate = extras.endDate || item.startDate;
    }

    const resp = await apiFetch(adminEventsUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: state.eventsPayload }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok) throw new Error(data.error || "Could not save site calendar.");
    state.eventsPayload = data.payload || state.eventsPayload;
    state.allSiteEvents = expandSiteEventPayload(state.eventsPayload).filter((entry) =>
      ["class", "trip"].includes(classifySiteEvent(entry))
    );
    state.siteEvents = state.allSiteEvents;
    const updatedEventDate = match.listName === "events" ? item.date : (extras.eventDate || extras.startDate || item.startDate);
    const refreshed = state.siteEvents.find((entry) => getSiteEventKey(entry) === [extras.sourceId || "", updatedEventDate || ""].join("|"));
    return buildManagementRecordFromSiteEvent(refreshed || item);
  }

  async function openCalendarRecord(indexValue) {
    const index = Number(indexValue);
    const item = Number.isFinite(index) ? state.siteEvents[index] : null;
    if (!item) return;
    const classId = normalizeSiteText(item.managementClassId);
    if (classId) {
      const classRecord = state.records.find((record) => record.recordType === "class" && normalizeSiteText(getExtras(record).classId) === classId);
      if (classRecord) {
        fillForm(classRecord);
        setStatus(recordStatus, "Class record opened for this calendar date.", "success");
        return;
      }
    }
    fillForm(buildManagementRecordFromSiteEvent(item));
    setStatus(recordStatus, "Site calendar record opened.", "success");
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
    await loadSiteCalendar();
  }

  async function copyFieldValue(fieldName) {
    const field = recordForm && recordForm.elements[fieldName];
    if (!field) return;
    const value = String(field.value || "").trim();
    if (!value) {
      setStatus(recordStatus, "Nothing to copy.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setStatus(recordStatus, "Copied.", "success");
    } catch (_error) {
      field.focus();
      field.select();
      const copied = document.execCommand && document.execCommand("copy");
      setStatus(recordStatus, copied ? "Copied." : "Copy failed.", copied ? "success" : "error");
    }
  }

  function bindEvents() {
    if (loginForm) loginForm.addEventListener("submit", login);
    if (recordForm) recordForm.addEventListener("submit", saveRecord);
    if (recordForm && recordForm.elements.recordType) {
      recordForm.elements.recordType.addEventListener("change", () => {
        applyTypeConfig(recordForm.elements.recordType.value || "contact", Boolean(state.selectedId));
        if (recordForm.elements.recordType.value === "class" && classScheduleEl) renderClassSchedule(readClassSessions());
      });
    }
    if (classScheduleEl) {
      classScheduleEl.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-add-class-session]");
        if (addButton) {
          addClassSession(addButton.getAttribute("data-add-class-session") || "");
          return;
        }
        const removeButton = event.target.closest("[data-remove-class-session]");
        if (removeButton) {
          const row = removeButton.closest("[data-class-session]");
          if (row) row.remove();
          classSessionTypes.forEach((type) => {
            const list = classScheduleEl.querySelector(`[data-class-session-list="${type}"]`);
            if (list && !list.querySelector("[data-class-session]")) {
              list.innerHTML = '<div class="management-empty">No dates added yet.</div>';
            }
          });
        }
      });
    }
    app.querySelectorAll("[data-copy-field]").forEach((button) => {
      button.addEventListener("click", () => copyFieldValue(button.getAttribute("data-copy-field") || ""));
    });
    if (deleteButton) deleteButton.addEventListener("click", deleteSelectedRecord);
    if (refreshCalendarButton) refreshCalendarButton.addEventListener("click", () => loadSiteCalendar());
    if (showPastCalendarToggle) showPastCalendarToggle.addEventListener("change", renderCalendarItems);
    if (refreshRegistrationsButton) refreshRegistrationsButton.addEventListener("click", () => loadRegistrationSnapshot());
    if (registrationList) {
      registrationList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-registration]");
        if (!button) return;
        removeRegistration(button.getAttribute("data-remove-registration") || "");
      });
    }
    if (calendarItemsEl) {
      calendarItemsEl.addEventListener("click", (event) => {
        const openButton = event.target.closest("[data-calendar-open]");
        if (openButton) {
          openCalendarRecord(openButton.getAttribute("data-calendar-open"));
          return;
        }
        const editButton = event.target.closest("[data-calendar-edit-record]");
        if (editButton) {
          const id = editButton.getAttribute("data-calendar-edit-record") || "";
          const record = state.records.find((item) => item.id === id);
          if (record) fillForm(record);
        }
      });
    }
    const newButton = app.querySelector("[data-new-record]");
    if (newButton) newButton.addEventListener("click", () => fillForm());
    const refreshButton = app.querySelector("[data-refresh-records]");
    if (refreshButton) refreshButton.addEventListener("click", () => loadRecords());
    const logoutButton = app.querySelector("[data-logout]");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        setToken("");
        state.records = [];
        state.allSiteEvents = [];
        state.siteEvents = [];
        fillForm();
        renderCalendarItems();
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
        const openButton = event.target.closest("[data-calendar-open]");
        if (openButton) {
          event.stopPropagation();
          openCalendarRecord(openButton.getAttribute("data-calendar-open"));
          return;
        }
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
    await loadSiteCalendar({ silent: true });
  }

  init();
})();
