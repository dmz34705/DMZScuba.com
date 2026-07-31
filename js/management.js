(() => {
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const managementUrl = apiRoot ? `${apiRoot}/api/admin/management` : "/api/admin/management";
  const eventsUrl = apiRoot ? `${apiRoot}/api/v2/events` : "/api/v2/events";
  const adminEventsUrl = apiRoot ? `${apiRoot}/api/admin/v2/events` : "/api/admin/v2/events";
  const homeTickerUrl = apiRoot ? `${apiRoot}/api/v2/home-ticker` : "/api/v2/home-ticker";
  const adminHomeTickerUrl = apiRoot ? `${apiRoot}/api/admin/v2/home-ticker` : "/api/admin/v2/home-ticker";
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
  const floatingSaveButton = app.querySelector("[data-floating-save]");
  const recordList = app.querySelector("[data-record-list]");
  const searchInput = app.querySelector("[data-search-records]");
  const sortSelect = app.querySelector("[data-sort-records]");
  const loginStatus = app.querySelector("[data-login-status]");
  const recordStatus = app.querySelector("[data-record-status]");
  const editorTitle = app.querySelector("[data-editor-title]");
  const deleteButton = app.querySelector("[data-delete-record]");
  const cancelEditButton = app.querySelector("[data-cancel-edit]");
  const homeTickerModal = app.querySelector("[data-home-ticker-modal]");
  const homeTickerForm = app.querySelector("[data-home-ticker-form]");
  const homeTickerLinesInput = app.querySelector("[data-home-ticker-lines]");
  const homeTickerStatus = app.querySelector("[data-home-ticker-status]");
  const openHomeTickerButtons = Array.from(app.querySelectorAll("[data-open-home-ticker]"));
  const closeHomeTickerButtons = Array.from(app.querySelectorAll("[data-close-home-ticker]"));
  const filterButtons = Array.from(app.querySelectorAll("[data-filter-type]"));
  const calendarStatus = app.querySelector("[data-calendar-status]");
  const refreshCalendarButton = app.querySelector("[data-refresh-calendar]");
  const showPastCalendarToggle = app.querySelector("[data-show-past-calendar]");
  const openManagementCalendarButtons = app.querySelectorAll("[data-open-management-calendar]");
  const registrationManager = app.querySelector("[data-registration-manager]");
  const registrationSummary = app.querySelector("[data-registration-summary]");
  const registrationList = app.querySelector("[data-registration-list]");
  const refreshRegistrationsButton = app.querySelector("[data-refresh-registrations]");
  const classScheduleEl = app.querySelector("[data-class-schedule]");
  const classRosterEl = app.querySelector("[data-class-roster]");
  const classContactSelect = app.querySelector("[data-class-contact-select]");
  const classContactList = app.querySelector("[data-class-contact-list]");
  const contactClassesEl = app.querySelector("[data-contact-classes]");
  const contactClassSelect = app.querySelector("[data-contact-class-select]");
  const contactClassStatusSelect = app.querySelector("[data-contact-class-status]");
  const contactClassList = app.querySelector("[data-contact-class-list]");
  const inquiryContactsEl = app.querySelector("[data-inquiry-contacts]");
  const inquiryContactSearch = app.querySelector("[data-inquiry-contact-search]");
  const inquiryContactSelect = app.querySelector("[data-inquiry-contact-select]");
  const inquiryContactList = app.querySelector("[data-inquiry-contact-list]");
  const inquiryContactCount = app.querySelector("[data-inquiry-contact-count]");
  const classRegistrationSummary = app.querySelector("[data-class-registration-summary]");
  const classRegistrationList = app.querySelector("[data-class-registration-list]");
  const refreshClassRegistrationsButton = app.querySelector("[data-refresh-class-registrations]");
  const siteStudioTabs = Array.from(app.querySelectorAll("[data-site-studio-tab]"));
  const siteStudioOpenButtons = Array.from(app.querySelectorAll("[data-site-studio-open]"));
  const siteStudioPanels = Array.from(app.querySelectorAll("[data-site-studio-panel]"));
  const extraFieldsSection = app.querySelector(".management-extra-fields");
  const classSessionTypes = ["classroom", "pool", "openWater"];
  const classSessionLabels = {
    classroom: "Classroom",
    pool: "Pool",
    openWater: "Open Water",
  };
  const statusOptionsByType = {
    inquiry: [
      "new",
      "to_contact",
      "reached_out",
      "gathering_details",
      "planning",
      "payment",
      "timing",
      "complete",
      "dead_end",
      "not_fit",
      "archived",
    ],
    class: ["scheduled", "active", "complete", "archived"],
    trip: ["scheduled", "active", "complete", "archived"],
    default: ["new", "active", "waiting", "scheduled", "complete", "archived"],
  };
  const statusLabels = {
    new: "New / Untriaged",
    to_contact: "To Contact",
    reached_out: "Reached Out",
    gathering_details: "Gathering Details",
    planning: "Planning",
    payment: "Payment / Agreement",
    timing: "Timing / Scheduling",
    complete: "Completed",
    dead_end: "No Response / No-Show",
    not_fit: "Not a Good Fit",
    no_response: "No Response / No-Show",
    not_a_fit: "Not a Good Fit",
    completed: "Completed / Won",
  };
  const closedStatuses = new Set(["complete", "completed", "closed", "archived", "cancelled", "dead_end", "not_fit"]);
  const inquiryPipelineStages = [
    { keys: new Set(["new", "to_contact"]), label: "Lead" },
    { keys: new Set(["reached_out"]), label: "Contacted" },
    { keys: new Set(["gathering_details"]), label: "Gathering Info" },
    { keys: new Set(["planning", "timing"]), label: "Planning" },
    { keys: new Set(["payment"]), label: "Financial" },
    { keys: new Set(["complete", "dead_end", "not_fit", "archived"]), label: "Closed" },
  ];
  const priorityRank = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  const statusRank = {
    to_contact: 1,
    new: 2,
    reached_out: 3,
    gathering_details: 4,
    planning: 5,
    payment: 6,
    timing: 7,
    scheduled: 8,
    active: 9,
    waiting: 10,
    complete: 20,
    dead_end: 21,
    not_fit: 22,
    archived: 23,
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
        "emailAlerts",
        "contactClasses",
        "notes",
      ],
    },
    inquiry: {
      editor: "Inquiry",
      newTitle: "New Inquiry",
      titleLabel: "Inquiry / Outreach Summary",
      titlePlaceholder: "Pool partnership outreach, agency question, vendor follow-up...",
      statusLabel: "Progress",
      relatedLabel: "Organization, Partner, or Opportunity",
      contactLabel: "Primary Contact",
      dueLabel: "Next Follow-Up Date",
      stageLabel: "Legacy Stage",
      sourceLabel: "Channel / Source",
      startLabel: "Target Start Date",
      endLabel: "Target End Date",
      amountOwedLabel: "Estimated Cost / Owed",
      amountPaidLabel: "Amount Paid",
      nextStepLabel: "Next Action",
      notesLabel: "Activity Notes / Progress Log",
      notesPlaceholder: "Log each touchpoint here: date, who contacted whom, what changed, blocker, next decision, payment/timing details...",
      fields: [
        "recordType",
        "title",
        "status",
        "priority",
        "owner",
        "inquiryContacts",
        "dueDate",
        "relatedEvent",
        "inquiryDirection",
        "inquiryCategory",
        "source",
        "startDate",
        "endDate",
        "amountOwed",
        "amountPaid",
        "nextStep",
        "outcomeReason",
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
        "registrationClosed",
        "registrationEmailSubject",
        "registrationEmailUseTemplate",
        "registrationEmailTemplateId",
        "registrationEmailIsHtml",
        "registrationEmailContent",
        "registrationEmailUseFullHtml",
        "registrationEmailFullHtml",
        "classSchedule",
        "classRoster",
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
        "registrationClosed",
        "capacity",
        "registrationEmailSubject",
        "registrationEmailUseTemplate",
        "registrationEmailTemplateId",
        "registrationEmailIsHtml",
        "registrationEmailContent",
        "registrationEmailUseFullHtml",
        "registrationEmailFullHtml",
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
    registrationConvertingId: "",
    registrationApprovingId: "",
    registrationResendingId: "",
    allRegistrationSnapshots: [],
    allRegistrationsLoading: false,
    allRegistrationsLoaded: false,
    allRegistrationDeletingKey: "",
    allRegistrationConvertingKey: "",
    allRegistrationApprovingKey: "",
    allRegistrationResendingKey: "",
    eventAlertSendingKey: "",
    classRegistrationSnapshot: null,
    classRegistrationLoading: false,
    classConvertingRegistrationId: "",
    classApprovingRegistrationId: "",
    filterType: "all",
    focusScope: "",
    sortBy: "newest",
    search: "",
    loading: false,
  };

  function getToken() {
    return window.localStorage.getItem(tokenStorageKey) || "";
  }

  function setToken(token) {
    if (!token) {
      window.localStorage.removeItem(tokenStorageKey);
      return;
    }
    window.localStorage.setItem(tokenStorageKey, token);
  }

  function openSiteStudioPanel(panelName) {
    const key = String(panelName || "operations").trim() || "operations";
    const targetPanel = siteStudioPanels.find((panel) => panel.getAttribute("data-site-studio-panel") === key)
      || siteStudioPanels.find((panel) => panel.getAttribute("data-site-studio-panel") === "operations");
    if (!targetPanel) return;
    const activeKey = targetPanel.getAttribute("data-site-studio-panel") || "operations";

    siteStudioPanels.forEach((panel) => {
      panel.hidden = panel !== targetPanel;
    });
    siteStudioTabs.forEach((tab) => {
      const isActive = tab.getAttribute("data-site-studio-tab") === activeKey;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const frame = targetPanel.querySelector("[data-site-studio-frame]");
    if (frame && !frame.getAttribute("src")) {
      const src = frame.getAttribute("data-src") || "";
      if (src) frame.setAttribute("src", src);
    }
  }

  function showAuthed(authed) {
    if (loginSection) loginSection.hidden = authed;
    if (dashboard) dashboard.hidden = !authed;
    if (authed) openSiteStudioPanel("operations");
  }

  function openEditorModal() {
    app.classList.add("is-editor-open");
    document.body.classList.add("management-editor-open");
  }

  function closeEditorModal() {
    app.classList.remove("is-editor-open");
    document.body.classList.remove("management-editor-open");
    setStatus(recordStatus, "");
  }

  function getDefaultNewRecordType() {
    const type = normalizeSiteText(state.filterType);
    if (["contact", "inquiry", "class", "trip", "task"].includes(type)) return type;
    if (type === "registration") return "contact";
    return "contact";
  }

  function openEditor(record = null, defaultType = "") {
    fillForm(record, defaultType);
    openEditorModal();
  }

  function normalizeTickerLines(input) {
    return (Array.isArray(input) ? input : [])
      .map((line) => String(line || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 24)
      .map((line) => line.slice(0, 220));
  }

  function openHomeTickerModal() {
    if (!homeTickerModal) return;
    homeTickerModal.hidden = false;
    document.body.classList.add("management-editor-open");
    setStatus(homeTickerStatus, "Loading ticker...");
    loadHomeTicker();
  }

  function closeHomeTickerModal() {
    if (!homeTickerModal) return;
    homeTickerModal.hidden = true;
    if (!app.classList.contains("is-editor-open")) document.body.classList.remove("management-editor-open");
    setStatus(homeTickerStatus, "");
  }

  async function loadHomeTicker() {
    if (!homeTickerLinesInput) return;
    const resp = await fetch(`${homeTickerUrl}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    if (!resp) {
      setStatus(homeTickerStatus, "Could not reach the ticker API.", "error");
      homeTickerLinesInput.focus();
      return;
    }
    if (resp.status === 404) {
      homeTickerLinesInput.value = "";
      setStatus(homeTickerStatus, "No ticker content saved yet. Add lines below and save.");
      homeTickerLinesInput.focus();
      return;
    }
    if (!resp.ok) {
      setStatus(homeTickerStatus, "Could not load the home ticker.", "error");
      homeTickerLinesInput.focus();
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const lines = normalizeTickerLines(data.lines);
    homeTickerLinesInput.value = lines.join("\n");
    setStatus(homeTickerStatus, "Loaded.");
    homeTickerLinesInput.focus();
    homeTickerLinesInput.setSelectionRange(homeTickerLinesInput.value.length, homeTickerLinesInput.value.length);
  }

  async function saveHomeTicker(event) {
    event.preventDefault();
    const lines = normalizeTickerLines(String(homeTickerLinesInput ? homeTickerLinesInput.value : "").split(/\r?\n/));
    setStatus(homeTickerStatus, "Saving ticker...");
    const resp = await apiFetch(adminHomeTickerUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || resp.status === 401) {
      setToken("");
      showAuthed(false);
      closeHomeTickerModal();
      setStatus(loginStatus, "Please log in again.", "error");
      return;
    }
    if (!resp.ok || data.ok === false) {
      setStatus(homeTickerStatus, data.error || "Could not save the home ticker.", "error");
      return;
    }
    const savedLines = normalizeTickerLines(data && data.payload ? data.payload.lines : lines);
    if (homeTickerLinesInput) homeTickerLinesInput.value = savedLines.join("\n");
    setStatus(homeTickerStatus, "Ticker saved.", "success");
    window.setTimeout(closeHomeTickerModal, 500);
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
    const key = String(value || "");
    if (statusLabels[key]) return statusLabels[key];
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

  function isOverdue(record) {
    if (!record.dueDate || closedStatuses.has(normalizeSiteText(record.status))) return false;
    return record.dueDate < todayKey();
  }

  function isOpenRecord(record) {
    return record && !closedStatuses.has(normalizeSiteText(record.status));
  }

  function getEffectiveClassStatus(record) {
    if (!record || record.recordType !== "class") return normalizeSiteText(record && record.status) || "scheduled";
    const currentStatus = normalizeSiteText(record.status) || "scheduled";
    if (closedStatuses.has(currentStatus)) return currentStatus;
    const sessions = getOrderedClassSessions(record);
    const dates = sessions.map((session) => session.date).filter(Boolean).sort();
    if (!dates.length) return currentStatus;
    const currentTodayKey = todayKey();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    if (lastDate < currentTodayKey) return "complete";
    if (firstDate <= currentTodayKey && lastDate >= currentTodayKey) return "active";
    return currentStatus;
  }

  function getEffectiveRecordStatus(record) {
    return record && record.recordType === "class" ? getEffectiveClassStatus(record) : normalizeSiteText(record && record.status);
  }

  function isInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
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

  function updateCharacterCounter(fieldName) {
    if (!recordForm || !fieldName) return;
    const field = recordForm.elements[fieldName];
    const counter = app.querySelector(`[data-character-counter-for="${fieldName}"]`);
    if (!field || !counter) return;
    const maxLength = Math.max(0, Number(field.getAttribute("maxlength") || 0) || 0);
    if (!maxLength) {
      counter.textContent = "";
      counter.classList.remove("is-warning", "is-full");
      return;
    }
    const used = String(field.value || "").length;
    const remaining = Math.max(0, maxLength - used);
    counter.textContent = `${remaining.toLocaleString()} characters remaining`;
    counter.classList.toggle("is-warning", remaining <= Math.ceil(maxLength * 0.1) && remaining > 0);
    counter.classList.toggle("is-full", remaining === 0);
  }

  function updateRegistrationEmailCounters() {
    updateCharacterCounter("registrationEmailSubject");
    updateCharacterCounter("registrationEmailContent");
    updateCharacterCounter("registrationEmailFullHtml");
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

  function getStatusOptions(type) {
    return statusOptionsByType[type] || statusOptionsByType.default;
  }

  function syncStatusOptions(type) {
    const select = recordForm && recordForm.elements.status;
    if (!select) return;
    const current = select.value || "";
    const options = getStatusOptions(type);
    select.innerHTML = options
      .map((value) => `<option value="${value}">${formatLabel(value)}</option>`)
      .join("");
    const fallback = type === "inquiry" ? "new" : options[0];
    select.value = options.includes(current) ? current : fallback;
  }

  function openManagementCalendarList() {
    state.filterType = "trip";
    filterButtons.forEach((button) => {
      button.classList.toggle("is-active", (button.getAttribute("data-filter-type") || "all") === "trip");
    });
    renderRecords();
    if (recordList) recordList.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function getContactRecords() {
    return state.records.filter((record) => record.recordType === "contact");
  }

  function getContactDisplayName(contact) {
    return normalizeSiteText(contact && (contact.contactName || contact.title || contact.contactEmail)) || "Unnamed contact";
  }

  function getQuizRouteLabel(route) {
    const labels = {
      cert: "Open Water Certification",
      refresh: "Skill Refresh",
      travel: "Trip-Ready Coaching",
      contact: "Discovery Consult",
    };
    const key = normalizeSiteText(route);
    return labels[key] || formatLabel(key);
  }

  function getQuizDetailFromNotes(contact, label) {
    const noteText = normalizeSiteText(contact && contact.notes);
    if (!noteText || !label) return "";
    const escapedLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = noteText.match(new RegExp(`${escapedLabel}:\\s*([^\\n]+)`, "i"));
    return normalizeSiteText(match && match[1]);
  }

  function getContactQuizDetails(contact) {
    const extras = getExtras(contact);
    const recommendedStart =
      normalizeSiteText(extras.quizRecommendedStart) ||
      getQuizDetailFromNotes(contact, "Recommended start");
    const quizRoute = normalizeSiteText(extras.quizRoute) || getQuizDetailFromNotes(contact, "Recommended route");
    const quizMode = normalizeSiteText(extras.quizMode) || getQuizDetailFromNotes(contact, "Quiz mode");
    const quizPath = normalizeSiteText(extras.quizPath) || getQuizDetailFromNotes(contact, "Quiz path");
    const timeline = getQuizDetailFromNotes(contact, "Timeline");
    const executionPlan = getQuizDetailFromNotes(contact, "Execution plan");
    const goals = getQuizDetailFromNotes(contact, "Goals");
    const message = getQuizDetailFromNotes(contact, "Message");
    const answers = normalizeSiteText(extras.quizAnswers) || getQuizDetailFromNotes(contact, "Answers");
    return {
      recommendedStart,
      quizRoute,
      quizRouteLabel: getQuizRouteLabel(quizRoute),
      quizMode,
      quizPath,
      timeline,
      executionPlan,
      goals,
      message,
      answers,
    };
  }

  function isQuizLeadContact(contact) {
    if (!contact) return false;
    const extras = getExtras(contact);
    const notes = normalizeSiteText(contact.notes).toLowerCase();
    const source = normalizeSiteText(extras.source).toLowerCase();
    const hasQuizField =
      normalizeSiteText(extras.quizRecommendedStart) ||
      normalizeSiteText(extras.quizAnswers) ||
      normalizeSiteText(extras.quizPath) ||
      normalizeSiteText(extras.quizRoute);
    const hasQuizNote =
      notes.includes("dive quiz submitted") ||
      notes.includes("dive path quiz result") ||
      notes.includes("dive quiz contact") ||
      notes.includes("dive quiz lead") ||
      (notes.includes("recommended start:") && notes.includes("recommended route:")) ||
      (notes.includes("recommended start:") && notes.includes("execution plan:"));
    return Boolean(
      normalizeSiteText(extras.quizLead) === "1" ||
      hasQuizField ||
      hasQuizNote ||
      (source === "dive path quiz" && (hasQuizField || hasQuizNote))
    );
  }

  function buildInquiryTitleFromContact(contact) {
    if (!contact) return "";
    const name = getContactDisplayName(contact);
    const quiz = getContactQuizDetails(contact);
    if (isQuizLeadContact(contact)) {
      const quizResult = quiz.recommendedStart || quiz.quizRouteLabel || quiz.quizPath;
      return [name, ["Dive Path Quiz", quizResult].filter(Boolean).join(": ")].filter(Boolean).join(" - ");
    }
    const source = formatLabel(extras.source);
    return [name, source || "Inquiry"].filter(Boolean).join(" - ");
  }

  function setInquiryFieldIfEmpty(name, value) {
    const field = recordForm && recordForm.elements[name];
    const nextValue = normalizeSiteText(value);
    if (!field || field.disabled || !nextValue || normalizeSiteText(field.value)) return;
    field.value = nextValue;
  }

  function buildQuizInquiryNotes(contact) {
    const quiz = getContactQuizDetails(contact);
    const lines = [
      "Dive Path Quiz Result",
      "",
      `Contact: ${getContactDisplayName(contact)}`,
      contact.contactEmail ? `Email: ${contact.contactEmail}` : "",
      contact.contactPhone ? `Phone: ${contact.contactPhone}` : "",
      "",
      quiz.recommendedStart ? `Recommended start: ${quiz.recommendedStart}` : "",
      quiz.quizRoute ? `Recommended route: ${quiz.quizRoute}` : "",
      quiz.timeline ? `Timeline: ${quiz.timeline}` : "",
      quiz.executionPlan ? `Execution plan: ${quiz.executionPlan}` : "",
      quiz.quizMode ? `Quiz mode: ${quiz.quizMode}` : "",
      quiz.quizPath ? `Quiz path: ${quiz.quizPath}` : "",
      quiz.goals ? `Goals: ${quiz.goals}` : "",
      quiz.message ? `Message: ${quiz.message}` : "",
      quiz.answers ? `Answers: ${quiz.answers}` : "",
      "",
      "Original contact notes:",
      normalizeSiteText(contact.notes),
    ].filter((line) => line !== "");
    return lines.join("\n");
  }

  function fillInquiryFromSelectedContact() {
    if (!recordForm) return;
    const type = recordForm.elements.recordType ? normalizeSiteText(recordForm.elements.recordType.value) : "";
    if (type !== "inquiry") return;
    const firstContactId = getSelectedInquiryContactIds()[0] || "";
    if (!firstContactId) return;
    const contact = getContactRecords().find((item) => item.id === firstContactId);
    if (!contact) return;
    if (!isQuizLeadContact(contact)) return;
    const quiz = getContactQuizDetails(contact);
    setInquiryFieldIfEmpty("title", buildInquiryTitleFromContact(contact));
    setInquiryFieldIfEmpty("relatedEvent", quiz.recommendedStart || quiz.quizRouteLabel || quiz.quizPath);
    setInquiryFieldIfEmpty("source", "Dive Path Quiz");
    setInquiryFieldIfEmpty("inquiryDirection", "incoming");
    setInquiryFieldIfEmpty("inquiryCategory", "customer");
    setInquiryFieldIfEmpty("nextStep", "Follow up with a personalized dive plan.");
    setInquiryFieldIfEmpty("notes", buildQuizInquiryNotes(contact));
  }

  function getInquiryContactIds(record = null) {
    const extras = getExtras(record);
    if (Array.isArray(extras.inquiryContactIds)) {
      return extras.inquiryContactIds.map((id) => normalizeSiteText(id)).filter(Boolean);
    }
    const legacyEmail = normalizeSiteText(record && record.contactEmail).toLowerCase();
    if (!legacyEmail) return [];
    const legacyContact = getContactRecords().find((contact) => normalizeSiteText(contact.contactEmail).toLowerCase() === legacyEmail);
    return legacyContact && legacyContact.id ? [legacyContact.id] : [];
  }

  function getInquiryContacts(record = null) {
    const ids = new Set(getInquiryContactIds(record));
    return getContactRecords().filter((contact) => ids.has(contact.id));
  }

  function getSelectedInquiryContactIds() {
    return inquiryContactSelect
      ? Array.from(inquiryContactSelect.selectedOptions).map((option) => normalizeSiteText(option.value)).filter(Boolean)
      : [];
  }

  function syncInquiryContactSelectedList() {
    if (!inquiryContactList || !inquiryContactSelect) return;
    const ids = new Set(getSelectedInquiryContactIds());
    const contacts = getContactRecords().filter((contact) => ids.has(contact.id));
    fillInquiryFromSelectedContact();
    if (inquiryContactCount) {
      inquiryContactCount.textContent = `${contacts.length} selected`;
    }
    inquiryContactList.innerHTML = contacts.length
      ? contacts.map((contact) => `
          <div class="management-class-contact-item management-inquiry-contact-item" data-inquiry-contact-id="${escapeHtml(contact.id)}">
            <div>
              <strong>${escapeHtml(getContactDisplayName(contact))}</strong>
              <span>${escapeHtml([contact.contactEmail, contact.contactPhone].filter(Boolean).join(" | "))}</span>
            </div>
            <button type="button" data-remove-inquiry-contact="${escapeHtml(contact.id)}">Remove</button>
          </div>
        `).join("")
      : '<div class="management-empty">No contacts linked to this inquiry yet.</div>';
  }

  function renderInquiryContactManager(record = null) {
    if (!inquiryContactsEl) return;
    const isInquiry = record && record.recordType === "inquiry";
    const query = normalizeSiteText(inquiryContactSearch && inquiryContactSearch.value).toLowerCase();
    const selectedIds = new Set(getInquiryContactIds(record));
    const contacts = getContactRecords();
    const filteredContacts = contacts.filter((contact) => {
      if (selectedIds.has(contact.id)) return true;
      if (!query) return true;
      const extras = getExtras(contact);
      return [
        contact.contactName,
        contact.title,
        contact.contactEmail,
        contact.contactPhone,
        extras.firstName,
        extras.lastName,
      ].join(" ").toLowerCase().includes(query);
    });

    if (inquiryContactSelect) {
      inquiryContactSelect.innerHTML = filteredContacts.length
        ? filteredContacts.map((contact) => {
          const details = [contact.contactEmail, contact.contactPhone].filter(Boolean).join(" | ");
          const label = [getContactDisplayName(contact), details].filter(Boolean).join(" - ");
          return `<option value="${escapeHtml(contact.id)}" ${selectedIds.has(contact.id) ? "selected" : ""}>${escapeHtml(label)}</option>`;
        }).join("")
        : '<option value="">No matching contacts</option>';
      inquiryContactSelect.disabled = !isInquiry || !contacts.length;
    }
    if (inquiryContactSearch) inquiryContactSearch.disabled = !isInquiry || !contacts.length;
    syncInquiryContactSelectedList();
  }

  function getClassRecords() {
    return state.records.filter((record) => record.recordType === "class" && !isSiteBackedManagementRecord(record));
  }

  function getClassRecordId(record) {
    if (!record || record.recordType !== "class") return "";
    return slugify(getExtras(record).classId || record.id || record.title, "class");
  }

  function getContactClassEnrollments(contact) {
    const extras = getExtras(contact);
    return Array.isArray(extras.classEnrollments) ? extras.classEnrollments : [];
  }

  function getEnrollmentStatus(enrollment) {
    return normalizeSiteText(enrollment && enrollment.status) || "enrolled";
  }

  function getClassRosterContacts(record) {
    if (!record || record.recordType !== "class") return [];
    const classId = getClassRecordId(record);
    return getContactRecords().filter((contact) =>
      getContactClassEnrollments(contact).some((enrollment) => normalizeSiteText(enrollment && enrollment.classId) === classId)
    );
  }

  function getClassRosterEntry(contact, classId) {
    return getContactClassEnrollments(contact).find((enrollment) => normalizeSiteText(enrollment && enrollment.classId) === classId) || {};
  }

  function getClassRosterSnapshot(record, classId) {
    return getClassRosterContacts(record).map((contact) => {
      const extras = getExtras(contact);
      const enrollment = getClassRosterEntry(contact, classId);
      const contactName = normalizeSiteText(contact.contactName || contact.title);
      const nameParts = contactName.split(/\s+/).filter(Boolean);
      return {
        contactId: normalizeSiteText(contact.id),
        firstName: normalizeSiteText(extras.firstName) || nameParts[0] || "",
        lastName: normalizeSiteText(extras.lastName) || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""),
        name: contactName || normalizeSiteText(contact.contactEmail) || "Registered diver",
        email: normalizeSiteText(contact.contactEmail),
        phone: normalizeSiteText(contact.contactPhone),
        certificationLevel: normalizeSiteText(extras.certification),
        source: normalizeSiteText(enrollment.source) || "in_house",
        sourceRegistrationId: normalizeSiteText(enrollment.sourceRegistrationId),
        status: getEnrollmentStatus(enrollment),
      };
    });
  }

  function getClassScheduleLines(record) {
    if (!record || record.recordType !== "class") return [];
    const sessions = getOrderedClassSessions(record);
    return sessions.map((session) => {
      const timeText = [session.startTime, session.endTime].filter(Boolean).join(" - ");
      return [
        session.label,
        formatDate(session.date),
        timeText,
        session.location,
      ].filter(Boolean).join(" | ");
    });
  }

  function getClassSummaryDetails(record) {
    const extras = getExtras(record);
    const classId = slugify(extras.classId || record.id || record.title, "class");
    const rosterContacts = getClassRosterContacts(record);
    const rosterCount = rosterContacts.length;
    const capacity = Math.max(0, Math.trunc(Number(extras.capacity || 0) || 0));
    const remaining = capacity ? Math.max(0, capacity - rosterCount) : 0;
    return {
      classId,
      rosterContacts,
      rosterCount,
      capacity,
      remaining,
      rosterText: capacity ? `${rosterCount} / ${capacity}` : `${rosterCount}`,
      remainingText: capacity ? `${remaining} spot${remaining === 1 ? "" : "s"}` : "No cap set",
      scheduleLines: getClassScheduleLines(record),
    };
  }

  function isClassRegistrationAtCapacity(record) {
    if (!record || record.recordType !== "class") return false;
    const details = getClassSummaryDetails(record);
    return details.capacity > 0 && details.rosterCount >= details.capacity;
  }

  function isSnapshotRegistrationAtCapacity(snapshot) {
    if (!snapshot) return false;
    const capacity = Math.max(0, Number(snapshot.registrationCapacity || 0) || 0);
    const remaining = Math.max(0, Number(snapshot.remainingSpots || 0) || 0);
    return capacity > 0 && remaining <= 0;
  }

  function syncRegistrationClosedCheckbox(record = null, snapshot = null) {
    if (!recordForm || !recordForm.elements.registrationClosed || recordForm.elements.registrationClosed.disabled) return;
    const extras = getExtras(record);
    recordForm.elements.registrationClosed.checked = Boolean(extras.registrationClosed) ||
      isClassRegistrationAtCapacity(record) ||
      isSnapshotRegistrationAtCapacity(snapshot);
  }

  function getLoadedClassRegistrationSnapshot(record) {
    const context = getPrimaryClassRegistrationContext(record);
    if (!context) return null;
    return state.allRegistrationSnapshots.find((snapshot) => {
      const snapshotContext = snapshot && snapshot.context;
      return normalizeSiteText(snapshotContext && snapshotContext.sourceId) === normalizeSiteText(context.sourceId) &&
        normalizeSiteText(snapshotContext && snapshotContext.eventDate) === normalizeSiteText(context.eventDate);
    }) || null;
  }

  function renderClassRecordDetails(record) {
    if (!record || record.recordType !== "class") return "";
    const details = getClassSummaryDetails(record);
    const registrationSnapshot = getLoadedClassRegistrationSnapshot(record);
    const onlineRegistrants = Array.isArray(registrationSnapshot && registrationSnapshot.registrants)
      ? registrationSnapshot.registrants
      : [];
    const pendingRegistrants = onlineRegistrants.filter((item) => getRegistrationApprovalStatus(item) !== "approved");
    const rosterPreview = details.rosterContacts
      .slice(0, 6)
      .map((contact) => normalizeSiteText(contact.contactName || contact.title || contact.contactEmail))
      .filter(Boolean);
    const overflowCount = Math.max(0, details.rosterContacts.length - rosterPreview.length);
    const rosterText = rosterPreview.length
      ? `${rosterPreview.join(", ")}${overflowCount ? `, +${overflowCount} more` : ""}`
      : "";
    return `
      <div class="management-class-card-detail">
        <div class="management-class-detail-grid">
          <span><strong>Class ID</strong>${escapeHtml(details.classId)}</span>
          <span><strong>Enrolled</strong>${escapeHtml(details.rosterText)}</span>
          <span><strong>Remaining</strong>${escapeHtml(details.remainingText)}</span>
          <span><strong>Pending Self Registrations</strong>${escapeHtml(registrationSnapshot ? String(pendingRegistrants.length) : "Not loaded")}</span>
        </div>
        ${
          pendingRegistrants.length
            ? `<div class="management-class-detail-section">
                <strong>Pending Approval</strong>
                <p>${escapeHtml(pendingRegistrants.map((item) => normalizeSiteText(item && item.name) || "Unnamed registrant").join(", "))}</p>
              </div>`
            : ""
        }
        ${
          details.scheduleLines.length
            ? `<div class="management-class-detail-section">
                <strong>Class Dates</strong>
                ${details.scheduleLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
              </div>`
            : '<div class="management-empty management-empty-compact">No class dates added.</div>'
        }
        <div class="management-class-detail-section">
          <strong>Enrolled Students</strong>
          ${
            rosterPreview.length
              ? `<p>${escapeHtml(rosterText)}</p>`
              : "<p>No students enrolled yet.</p>"
          }
        </div>
      </div>
    `;
  }

  function renderContactCopyLine(label, value, type) {
    const text = normalizeSiteText(value);
    const emptyText = type === "email" ? "No email saved" : "No phone saved";
    const href = type === "email" ? `mailto:${text}` : `tel:${text.replace(/[^\d+]/g, "")}`;
    return `
      <div class="management-contact-copy-line ${text ? "" : "is-empty"}">
        <span>
          <strong>${escapeHtml(label)}</strong>
          ${
            text
              ? `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
              : `<em>${escapeHtml(emptyText)}</em>`
          }
        </span>
        <button type="button" data-copy-record="${escapeHtml(text)}" ${text ? "" : "disabled"}>Copy</button>
      </div>
    `;
  }

  function renderMobileCardDetails(label, content) {
    const body = String(content || "").trim();
    if (!body) return "";
    return `
      <details class="management-record-details management-card-expand">
        <summary>${escapeHtml(label || "Details")}</summary>
        <div class="management-card-expand-body">
          ${body}
        </div>
      </details>
    `;
  }

  function renderContactRecordDetails(record) {
    if (!record || record.recordType !== "contact") return "";
    const extras = getExtras(record);
    const contactName = normalizeSiteText(record.contactName || [extras.firstName, extras.lastName].filter(Boolean).join(" "));
    const detailRows = [
      ["Name", contactName || record.title],
      ["First Name", extras.firstName],
      ["Last Name", extras.lastName],
      ["Email", record.contactEmail],
      ["Phone", record.contactPhone],
      ["Source", extras.source],
      ["Certification", extras.certification],
      ["Event Alerts", extras.emailAlerts ? "Opted in" : ""],
      ["Priority", formatLabel(record.priority)],
      ["Notes", record.notes],
    ].filter((row) => normalizeSiteText(row[1]));
    const enrollments = getContactClassEnrollments(record)
      .map((enrollment) => {
        const classRecord = getEnrollmentClassRecord(enrollment);
        const title = normalizeSiteText((classRecord && classRecord.title) || (enrollment && (enrollment.classTitle || enrollment.classId)));
        return title ? `${title} (${formatLabel(getEnrollmentStatus(enrollment))})` : "";
      })
      .filter(Boolean);
    if (enrollments.length) detailRows.push(["Classes", enrollments.join(", ")]);
    if (!detailRows.length) return "";
    return `
      <details class="management-record-details management-contact-details">
        <summary>View full contact profile</summary>
        <div class="management-contact-detail-grid">
          ${detailRows
            .map(
              ([label, value]) => `
                <div>
                  <strong>${escapeHtml(label)}</strong>
                  <span>${escapeHtml(value)}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </details>
    `;
  }

  function renderInquiryPipelineBar(status) {
    const isDead = status === "dead_end" || status === "not_fit";
    let currentIndex = 0;
    inquiryPipelineStages.forEach((stage, i) => {
      if (stage.keys.has(status)) currentIndex = i;
    });
    const steps = inquiryPipelineStages
      .map((stage, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        let cls = "management-inquiry-stage";
        if (isPast) cls += " is-done";
        if (isCurrent) cls += " is-current";
        if (isCurrent && isDead) cls += " is-dead";
        return `<span class="${cls}">${escapeHtml(stage.label)}</span>`;
      })
      .join("");
    return `<div class="management-inquiry-pipeline">${steps}</div>`;
  }

  function renderInquiryCallout(record) {
    const extras = getExtras(record);
    const nextStep = normalizeSiteText(extras.nextStep);
    const dueDate = normalizeSiteText(record.dueDate);
    const linkedContacts = getInquiryContacts(record);
    const contactName = normalizeSiteText((linkedContacts[0] && getContactDisplayName(linkedContacts[0])) || record.contactName);
    const contactEmail = normalizeSiteText(record.contactEmail);
    const balance = getBalance(record);
    let dueSoonClass = "";
    if (dueDate) {
      const due = parseDateKey(dueDate);
      const today = parseDateKey(todayKey());
      if (due && today) {
        const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) dueSoonClass = " is-due-soon";
      }
    }
    const metaItems = [
      dueDate ? `<span class="management-inquiry-due${escapeHtml(dueSoonClass)}">${escapeHtml("Follow-up: " + formatDate(dueDate))}</span>` : "",
      contactName ? `<span>${escapeHtml(contactName)}</span>` : (contactEmail ? `<span>${escapeHtml(contactEmail)}</span>` : ""),
      extras.inquiryCategory ? `<span>${escapeHtml(formatLabel(extras.inquiryCategory))}</span>` : "",
      extras.inquiryDirection ? `<span>${escapeHtml(formatLabel(extras.inquiryDirection))}</span>` : "",
      record.owner ? `<span>${escapeHtml("Owner: " + record.owner)}</span>` : "",
      balance > 0 ? `<span class="management-inquiry-balance">${escapeHtml("Balance: " + formatMoney(balance))}</span>` : "",
    ].filter(Boolean);
    if (!nextStep && !metaItems.length) return "";
    return `
      <div class="management-inquiry-callout">
        ${nextStep ? `<span class="management-inquiry-next-step">${escapeHtml(nextStep)}</span>` : ""}
        ${metaItems.length ? `<div class="management-inquiry-callout-meta">${metaItems.join("")}</div>` : ""}
      </div>
    `;
  }

  function renderInquiryRecordDetails(record) {
    if (!record || record.recordType !== "inquiry") return "";
    const extras = getExtras(record);
    const balance = getBalance(record);
    const linkedContacts = getInquiryContacts(record);
    const contactSummary = linkedContacts.length
      ? linkedContacts.map((contact) => {
        const detail = [contact.contactEmail, contact.contactPhone].filter(Boolean).join(" | ");
        return [getContactDisplayName(contact), detail].filter(Boolean).join(" - ");
      }).join(", ")
      : "";
    const renderCell = ([label, value]) => normalizeSiteText(value)
      ? `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`
      : "";
    const sections = [
      {
        title: "Pipeline",
        rows: [
          ["Progress", formatLabel(record.status)],
          ["Direction", extras.inquiryDirection ? formatLabel(extras.inquiryDirection) : ""],
          ["Category", extras.inquiryCategory ? formatLabel(extras.inquiryCategory) : ""],
          ["Priority", formatLabel(record.priority)],
        ],
      },
      {
        title: "Contact",
        rows: [
          ["Linked Contacts", contactSummary],
          ["Primary Contact", linkedContacts.length ? "" : record.contactName],
          ["Email", linkedContacts.length ? "" : record.contactEmail],
          ["Phone", linkedContacts.length ? "" : record.contactPhone],
          ["Organization", record.relatedEvent],
          ["Source", extras.source],
          ["Owner", record.owner],
        ],
      },
      {
        title: "Planning",
        rows: [
          ["Next Follow-Up", record.dueDate ? formatDate(record.dueDate) : ""],
          ["Target Start", extras.startDate ? formatDate(extras.startDate) : ""],
          ["Target End", extras.endDate ? formatDate(extras.endDate) : ""],
          ["Next Action", extras.nextStep],
        ],
      },
      {
        title: "Money / Outcome",
        rows: [
          ["Estimated / Owed", Number(extras.amountOwed || 0) > 0 ? formatMoney(extras.amountOwed) : ""],
          ["Paid", Number(extras.amountPaid || 0) > 0 ? formatMoney(extras.amountPaid) : ""],
          ["Balance", balance > 0 ? formatMoney(balance) : ""],
          ["Close Reason", extras.outcomeReason ? formatLabel(extras.outcomeReason) : ""],
        ],
      },
    ]
      .map((section) => {
        const cells = section.rows.map(renderCell).filter(Boolean).join("");
        return cells ? `<section><h4>${escapeHtml(section.title)}</h4><div>${cells}</div></section>` : "";
      })
      .filter(Boolean)
      .join("");
    const notes = normalizeSiteText(record.notes)
      ? `<section class="management-inquiry-notes"><h4>Activity Notes</h4><p>${escapeHtml(record.notes)}</p></section>`
      : "";
    if (!sections && !notes) return "";
    return `
      <details class="management-record-details management-inquiry-details">
        <summary>View inquiry details</summary>
        <div class="management-inquiry-detail-grid">
          ${sections}
          ${notes}
        </div>
      </details>
    `;
  }

  function renderClassRoster(record = null) {
    if (!classRosterEl) return;
    const classId = record && record.recordType === "class" ? slugify(getExtras(record).classId || record.id || record.title, "class") : "";
    const rosterContacts = classId ? getClassRosterContacts(record) : [];
    const attachedIds = new Set(rosterContacts.map((item) => String(item && item.id || "")));
    const contacts = getContactRecords();
    if (classContactSelect) {
      const options = contacts
        .filter((contact) => !attachedIds.has(contact.id))
        .map((contact) => {
          const label = contact.contactName || contact.title || contact.contactEmail || "Unnamed contact";
          return `<option value="${escapeHtml(contact.id)}">${escapeHtml(label)}</option>`;
        });
      classContactSelect.innerHTML = options.length
        ? `<option value="">Select existing contact</option>${options.join("")}`
        : '<option value="">No available contacts</option>';
    }
    if (classContactList) {
      classContactList.innerHTML = rosterContacts.length
        ? rosterContacts.map((contact) => {
          const enrollment = getClassRosterEntry(contact, classId);
          const sourceLabel = enrollment.source === "self_registered" ? "Self Registered" : "In House Registered";
          const statusLabel = getEnrollmentStatus(enrollment) === "completed" ? "Completed" : "Enrolled";
          return `
          <div class="management-class-contact-item"
            data-class-contact-id="${escapeHtml(contact.id)}">
            <div>
              <strong>${escapeHtml(contact.contactName || contact.title || contact.contactEmail || "Unnamed contact")}</strong>
              <span>${escapeHtml([contact.contactEmail, contact.contactPhone, statusLabel, sourceLabel].filter(Boolean).join(" | "))}</span>
            </div>
            <button type="button" data-remove-class-contact="${escapeHtml(contact.id)}">Remove</button>
          </div>
        `;
        }).join("")
        : '<div class="management-empty">No contacts enrolled in this class yet.</div>';
    }
    syncRegistrationClosedCheckbox(record);
    renderClassRegistrationEscrow(record);
  }

  function getEnrollmentClassRecord(enrollment) {
    const classId = normalizeSiteText(enrollment && enrollment.classId);
    if (!classId) return null;
    return getClassRecords().find((record) => getClassRecordId(record) === classId) || null;
  }

  function renderContactClassManager(record = null) {
    if (!contactClassesEl) return;
    const isContact = record && record.recordType === "contact" && record.id;
    const enrollments = isContact ? getContactClassEnrollments(record) : [];
    const enrolledIds = new Set(enrollments.map((entry) => normalizeSiteText(entry && entry.classId)).filter(Boolean));
    const availableClasses = getClassRecords().filter((classRecord) => !enrolledIds.has(getClassRecordId(classRecord)));

    if (contactClassSelect) {
      contactClassSelect.innerHTML = availableClasses.length
        ? availableClasses
          .map((classRecord) => `<option value="${escapeHtml(getClassRecordId(classRecord))}">${escapeHtml(classRecord.title || getClassRecordId(classRecord))}</option>`)
          .join("")
        : '<option value="">No available classes</option>';
      contactClassSelect.disabled = !isContact || !availableClasses.length;
    }
    if (contactClassStatusSelect) contactClassStatusSelect.disabled = !isContact;

    if (contactClassList) {
      contactClassList.innerHTML = !isContact
        ? '<div class="management-empty">Save this contact before adding classes.</div>'
        : enrollments.length
          ? enrollments.map((enrollment) => {
            const classRecord = getEnrollmentClassRecord(enrollment);
            const classId = normalizeSiteText(enrollment && enrollment.classId);
            const title = classRecord ? classRecord.title : normalizeSiteText(enrollment && enrollment.classTitle) || classId || "Class";
            const status = getEnrollmentStatus(enrollment);
            const details = [
              status === "completed" ? "Completed" : "Enrolled",
              normalizeSiteText(enrollment && enrollment.source) === "self_registered" ? "Self Registered" : "In House Registered",
              normalizeSiteText(enrollment && enrollment.enrolledAt) ? `Added ${normalizeSiteText(enrollment && enrollment.enrolledAt).slice(0, 10)}` : "",
            ].filter(Boolean);
            return `
              <div class="management-class-contact-item" data-contact-class-id="${escapeHtml(classId)}">
                <div>
                  <strong>${escapeHtml(title)}</strong>
                  <span>${escapeHtml(details.join(" | "))}</span>
                </div>
                <div class="management-class-contact-actions">
                  <button type="button" data-toggle-contact-class="${escapeHtml(classId)}">${status === "completed" ? "Mark Enrolled" : "Mark Complete"}</button>
                  <button type="button" data-remove-contact-class="${escapeHtml(classId)}">Remove</button>
                </div>
              </div>
            `;
          }).join("")
          : '<div class="management-empty">No classes added to this contact yet.</div>';
    }
  }

  function getPrimaryClassRegistrationContext(record) {
    if (!record || record.recordType !== "class") return null;
    const extras = getExtras(record);
    const classId = slugify(extras.classId || record.id || record.title, "class");
    const syncedEvent = state.siteEvents.find((item) =>
      normalizeSiteText(item && item.managementClassId) === classId
        && Boolean(item && item.managementClassPrimary)
        && normalizeSiteText(item && (item.sourceId || item.id))
        && normalizeSiteText(item && item.date)
    );
    if (syncedEvent) {
      return {
        sourceId: normalizeSiteText(syncedEvent.sourceId || syncedEvent.id),
        eventDate: normalizeSiteText(syncedEvent.date),
      };
    }
    const primary = getOrderedClassSessions({ ...record, extras: { ...extras, classId } })[0];
    if (!primary || !primary.date) return null;
    return {
      sourceId: `${classId}-${primary.type}-${primary.index + 1}`,
      eventDate: primary.date,
    };
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
    setFieldLabel("status", config.statusLabel || "Status");
    setFieldLabel("contactName", config.contactLabel || "Contact Name");
    setFieldLabel("dueDate", config.dueLabel || "Due Date");
    setFieldLabel("relatedEvent", config.relatedLabel || "Related Class, Trip, or Event");
    setFieldLabel("stage", config.stageLabel || "Stage");
    setFieldLabel("source", config.sourceLabel || "Source");
    setFieldLabel("startDate", config.startLabel || "Start Date");
    setFieldLabel("endDate", config.endLabel || "End Date");
    setFieldLabel("capacity", config.capacityLabel || "Capacity / Roster Size");
    setFieldLabel("certification", config.certificationLabel || "Certification / Level");
    setFieldLabel("amountOwed", config.amountOwedLabel || "Total Owed");
    setFieldLabel("amountPaid", config.amountPaidLabel || "Amount Paid");
    setFieldLabel("nextStep", config.nextStepLabel || "Next Step");
    setFieldLabel("notes", config.notesLabel || "Notes / Progress");
    setFieldPlaceholder("title", config.titlePlaceholder || "");
    setFieldPlaceholder("notes", config.notesPlaceholder || "");
    syncPriorityOptions(type);
    syncStatusOptions(type);
    syncFormGridVisibility();
    if (editorTitle) editorTitle.textContent = editing ? `Edit ${config.editor}` : config.newTitle;
  }

  function resetRegistrationManager() {
    state.registrationSnapshot = null;
    state.registrationLoading = false;
    state.registrationDeletingId = "";
    state.registrationConvertingId = "";
    state.registrationApprovingId = "";
    state.registrationResendingId = "";
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

  function getRegistrationActionKey(context, registrationId) {
    return [
      context && context.sourceId,
      context && context.eventDate,
      registrationId,
    ].map((value) => normalizeSiteText(value)).join("|");
  }

  function isSiteBackedManagementRecord(record) {
    const extras = getExtras(record);
    return extras.siteSource === "events";
  }

  function getUniqueSiteEventId(title, dateValue) {
    const base = slugify([title, dateValue].filter(Boolean).join(" "), "calendar-event");
    const existingIds = new Set(
      [
        ...(Array.isArray(state.eventsPayload && state.eventsPayload.events) ? state.eventsPayload.events : []),
        ...(Array.isArray(state.eventsPayload && state.eventsPayload.templates) ? state.eventsPayload.templates : []),
      ]
        .map((item) => normalizeSiteText(item && item.id).toLowerCase())
        .filter(Boolean)
    );
    if (!existingIds.has(base)) return base;
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${base}-${index}`;
      if (!existingIds.has(candidate)) return candidate;
    }
    return `${base}-${Date.now().toString().slice(-5)}`;
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
        registrationClosed: item.registrationClosed ? "1" : "",
        registrationEmailSubject: normalizeSiteText(item.registrationEmailSubject),
        registrationEmailUseTemplate: item.registrationEmailUseTemplate ? "1" : "",
        registrationEmailTemplateId: normalizeSiteText(item.registrationEmailTemplateId),
        registrationEmailIsHtml: item.registrationEmailIsHtml ? "1" : "",
        registrationEmailContent: normalizeSiteText(item.registrationEmailContent),
        registrationEmailUseFullHtml: item.registrationEmailUseFullHtml ? "1" : "",
        registrationEmailFullHtml: normalizeSiteText(item.registrationEmailFullHtml),
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
      extras.inquiryDirection,
      extras.inquiryCategory,
      extras.outcomeReason,
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
      extras.registrationClosed,
      ...(Array.isArray(extras.inquiryContactIds) ? extras.inquiryContactIds : []),
      ...getInquiryContacts(record).flatMap((contact) => [contact.contactName, contact.title, contact.contactEmail, contact.contactPhone]),
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

  function getSiteEventRegistrationSnapshot(item) {
    const sourceId = normalizeSiteText(item && (item.sourceId || item.id));
    const eventDate = normalizeSiteText(item && item.date);
    if (!sourceId || !eventDate) return null;
    return state.allRegistrationSnapshots.find((snapshot) => {
      const context = snapshot && snapshot.context ? snapshot.context : {};
      return normalizeSiteText(context.sourceId) === sourceId && normalizeSiteText(context.eventDate) === eventDate;
    }) || null;
  }

  function getEventAlertEligibility(item, isPast) {
    if (!item) return { eligible: false, reason: "No calendar record selected." };
    if (isPast) return { eligible: false, reason: "Past events cannot be announced." };
    if (!item.registrationEnabled) return { eligible: false, reason: "Registration is not enabled for this event." };
    if (item.registrationClosed) return { eligible: false, reason: "Registration is closed for this event." };
    const snapshot = getSiteEventRegistrationSnapshot(item);
    if (snapshot && (snapshot.registrationClosed || isSnapshotRegistrationAtCapacity(snapshot))) {
      return { eligible: false, reason: "Registration is full or closed." };
    }
    return { eligible: true, reason: "Ready to alert subscribers." };
  }

  function getSiteEventAlertKey(item) {
    return [
      normalizeSiteText(item && (item.sourceId || item.id)),
      normalizeSiteText(item && item.date),
    ].filter(Boolean).join("|");
  }

  function renderSiteCalendarCard(item, sourceIndex, isPast) {
    const recordType = classifySiteEvent(item);
    const dateText = [formatDate(item.date), item.endDate && item.endDate !== item.date ? formatDate(item.endDate) : ""]
      .filter(Boolean)
      .join(" - ");
    const timeText = item.time ? (item.endTime ? `${item.time} - ${item.endTime}` : item.time) : "";
    const spotsText = item.registrationCapacity ? `${item.registrationCapacity} spots` : "No cap set";
    const registrationClosed = Boolean(item.registrationClosed || (item.registrationEnabled && isPast));
    const alertEligibility = getEventAlertEligibility(item, isPast);
    const alertKey = getSiteEventAlertKey(item);
    const sendingAlert = alertKey && alertKey === state.eventAlertSendingKey;
    const registrationText = registrationClosed
      ? "Registration closed"
      : item.registrationEnabled
        ? "Registration open"
        : "Registration off";
    const summary = normalizeSiteText(item.summary);
    const statItems = [
      ["Date", dateText || "No date"],
      ["Time", timeText || "No time set"],
      ["Location", item.location || "No location set"],
      ["Capacity", spotsText],
      ["Registration", registrationText],
    ];
    const calendarDetails = `
      <div class="management-calendar-stat-grid">
        ${statItems.map(([label, value]) => `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`).join("")}
      </div>
      ${summary ? `<p class="management-card-note">${escapeHtml(summary.length > 220 ? `${summary.slice(0, 220)}...` : summary)}</p>` : ""}
    `;
    const eventUrl = `/pages/events/index.html?event=${encodeURIComponent(item.id || item.sourceId || "")}&date=${encodeURIComponent(item.date || "")}`;
    return `
      <article class="management-calendar-item ${isPast ? "is-past" : ""}" data-calendar-index="${sourceIndex}">
        <div class="management-calendar-date-block">
          <strong>${escapeHtml(formatDate(item.date) || "No Date")}</strong>
          <span>${escapeHtml(timeText || "Time TBD")}</span>
        </div>
        <div class="management-calendar-main">
          <div class="management-record-badges">
            <span class="management-badge">${escapeHtml(formatLabel(recordType))}</span>
            ${item.type ? `<span class="management-badge is-waiting">${escapeHtml(item.type)}</span>` : ""}
            ${registrationClosed ? '<span class="management-badge is-waiting">Registration Closed</span>' : item.registrationEnabled ? '<span class="management-badge is-complete">Registration</span>' : ""}
            ${alertEligibility.eligible ? '<span class="management-badge is-alert-ready">Alert Ready</span>' : ""}
            ${isPast ? '<span class="management-badge is-waiting">Past</span>' : ""}
          </div>
          <h3>${escapeHtml(item.title || "Scheduled Event")}</h3>
          ${renderMobileCardDetails("Event details", calendarDetails)}
        </div>
        <div class="management-calendar-actions">
          <button type="button" data-event-alert-index="${escapeHtml(sourceIndex)}" ${alertEligibility.eligible && !sendingAlert ? "" : "disabled"} title="${escapeHtml(alertEligibility.reason)}">${sendingAlert ? "Sending..." : "Send Alert Email"}</button>
          <a href="${escapeHtml(eventUrl)}" target="_blank" rel="noopener">View Site Event</a>
        </div>
      </article>
    `;
  }

  function getRecordSortTitle(record) {
    const extras = getExtras(record);
    return normalizeSiteText(
      record.recordType === "contact"
        ? record.contactName || [extras.firstName, extras.lastName].filter(Boolean).join(" ") || record.title || record.contactEmail
        : record.title || record.relatedEvent || record.contactName
    ).toLowerCase();
  }

  function getTimeValue(value, fallback = 0) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : fallback;
  }

  function compareVisibleRecords(a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const sortBy = state.sortBy || "newest";
    const titleCompare = getRecordSortTitle(a).localeCompare(getRecordSortTitle(b));
    if (sortBy === "alpha") return titleCompare || getTimeValue(b.createdAt) - getTimeValue(a.createdAt);
    if (sortBy === "alpha_desc") return -titleCompare || getTimeValue(b.createdAt) - getTimeValue(a.createdAt);
    if (sortBy === "oldest") return getTimeValue(a.createdAt, Infinity) - getTimeValue(b.createdAt, Infinity) || titleCompare;
    if (sortBy === "updated") return getTimeValue(b.updatedAt) - getTimeValue(a.updatedAt) || titleCompare;
    if (sortBy === "priority") {
      return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        || getTimeValue(a.dueDate, Infinity) - getTimeValue(b.dueDate, Infinity)
        || titleCompare;
    }
    if (sortBy === "due") {
      return getTimeValue(a.dueDate, Infinity) - getTimeValue(b.dueDate, Infinity)
        || (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        || titleCompare;
    }
    if (sortBy === "progress") {
      return (statusRank[a.status] || 99) - (statusRank[b.status] || 99)
        || (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        || titleCompare;
    }
    if (sortBy === "balance") return getBalance(b) - getBalance(a) || titleCompare;
    return getTimeValue(b.createdAt) - getTimeValue(a.createdAt) || titleCompare;
  }

  function getVisibleRecords() {
    return state.records
      .filter((record) => !isSiteBackedManagementRecord(record))
      .filter((record) => {
        if (!state.focusScope) return true;
        if (record.recordType === "contact") return false;
        if (state.focusScope === "overdue") return isOpenRecord(record) && isOverdue(record);
        if (state.focusScope === "due_today") return isOpenRecord(record) && record.dueDate === todayKey();
        if (state.focusScope === "open_items") return isOpenRecord(record);
        if (state.focusScope === "open_balance") return isOpenRecord(record) && getBalance(record) > 0;
        return true;
      })
      .filter((record) => record.recordType === "contact"
        ? state.filterType === "contact"
        : state.filterType === "all" || record.recordType === state.filterType)
      .filter(recordMatchesSearch)
      .slice()
      .sort(compareVisibleRecords);
  }

  function getVisibleSiteEventsForRecords() {
    if (state.focusScope) return [];
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

  function getRegistrationContexts() {
    return state.allSiteEvents
      .filter((item) => item && item.registrationEnabled)
      .map((item) => ({
        sourceId: normalizeSiteText(item.sourceId || item.id),
        eventDate: normalizeSiteText(item.date),
        title: normalizeSiteText(item.title) || "DMZ Scuba Event",
        type: normalizeSiteText(item.type),
        location: normalizeSiteText(item.location),
        managementClassId: normalizeSiteText(item.managementClassId).toLowerCase(),
        registrationCapacity: Math.max(0, Number(item.registrationCapacity || 0) || 0),
        registrationClosed: Boolean(item.registrationClosed),
      }))
      .filter((item) => item.sourceId && item.eventDate);
  }

  function getRegistrationApprovalStatus(registrant) {
    const source = normalizeSiteText(registrant && registrant.source);
    if (source === "management_roster" || normalizeSiteText(registrant && registrant.contactId)) return "approved";
    return normalizeSiteText(registrant && registrant.approvalStatus) === "approved" ? "approved" : "pending";
  }

  function getClassRecordByClassId(classId) {
    const safeClassId = normalizeSiteText(classId).toLowerCase();
    if (!safeClassId) return null;
    return getClassRecords().find((record) => getClassRecordId(record) === safeClassId) || null;
  }

  function getRegistrationContextClassRecord(context) {
    if (!context) return null;
    const explicit = getClassRecordByClassId(context.managementClassId);
    if (explicit) return explicit;
    const eventItem = state.allSiteEvents.find((item) =>
      normalizeSiteText(item && (item.sourceId || item.id)) === normalizeSiteText(context.sourceId) &&
      normalizeSiteText(item && item.date) === normalizeSiteText(context.eventDate)
    );
    return eventItem ? getClassRecordByClassId(eventItem.managementClassId) : null;
  }

  function flattenRegistrationSnapshots() {
    const contactEmails = new Set(
      getContactRecords()
        .map((contact) => normalizeSiteText(contact.contactEmail).toLowerCase())
        .filter(Boolean)
    );
    return state.allRegistrationSnapshots.flatMap((snapshot) => {
      const context = snapshot && snapshot.context ? snapshot.context : {};
      const onlineRegistrants = Array.isArray(snapshot && snapshot.registrants) ? snapshot.registrants : [];
      const rosterRegistrants = Array.isArray(snapshot && snapshot.rosterRegistrants) ? snapshot.rosterRegistrants : [];
      const rosterRegistrationIds = new Set(rosterRegistrants.map((item) => normalizeSiteText(item && item.sourceRegistrationId)).filter(Boolean));
      const rosterEmails = new Set(rosterRegistrants.map((item) => normalizeSiteText(item && item.email).toLowerCase()).filter(Boolean));
      const registrants = [
        ...rosterRegistrants,
        ...onlineRegistrants.filter((item) => {
          const id = normalizeSiteText(item && item.id);
          const email = normalizeSiteText(item && item.email).toLowerCase();
          if (id && rosterRegistrationIds.has(id)) return false;
          if (email && rosterEmails.has(email)) return false;
          return true;
        }),
      ];
      return registrants.map((registrant) => {
        const registrantId = normalizeSiteText(registrant && registrant.id);
        const email = normalizeSiteText(registrant && registrant.email);
        const contactId = normalizeSiteText(registrant && registrant.contactId);
        const isRosterContact = normalizeSiteText(registrant && registrant.source) === "management_roster" || Boolean(contactId);
        const approvalStatus = getRegistrationApprovalStatus(registrant);
        return {
          context,
          registrant,
          actionKey: getRegistrationActionKey(context, registrantId),
          alreadyContact: isRosterContact || Boolean(email && contactEmails.has(email.toLowerCase())),
          canUnregister: !isRosterContact,
          approvalStatus,
          canApprove: !isRosterContact && approvalStatus !== "approved",
        };
      });
    });
  }

  function registrationMatchesSearch(entry) {
    const query = state.search.trim().toLowerCase();
    if (!query) return true;
    const context = entry && entry.context ? entry.context : {};
    const registrant = entry && entry.registrant ? entry.registrant : {};
    const fullName = [
      normalizeSiteText(registrant.firstName),
      normalizeSiteText(registrant.lastName),
    ].filter(Boolean).join(" ") || normalizeSiteText(registrant.name);
    return [
      fullName,
      registrant.email,
      registrant.phone,
      registrant.certificationLevel,
      context.title,
      context.eventDate,
      context.type,
      context.location,
    ].some((value) => normalizeSiteText(value).toLowerCase().includes(query));
  }

  function renderRegistrationCards() {
    if (state.allRegistrationsLoading && !state.allRegistrationSnapshots.length) {
      return '<div class="management-empty">Loading online registrations...</div>';
    }
    if (!state.allRegistrationsLoaded && !state.allRegistrationSnapshots.length) {
      return '<div class="management-empty">Open this tab to load online registrations.</div>';
    }
    const entries = flattenRegistrationSnapshots().filter(registrationMatchesSearch);
    if (!entries.length) {
      return '<div class="management-empty">No matching online registrations found.</div>';
    }
    return entries.map(({ context, registrant, actionKey, alreadyContact, canUnregister, approvalStatus, canApprove }) => {
      const registrantId = normalizeSiteText(registrant && registrant.id);
      const firstName = normalizeSiteText(registrant && registrant.firstName);
      const lastName = normalizeSiteText(registrant && registrant.lastName);
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || normalizeSiteText(registrant && registrant.name) || "Unnamed diver";
      const email = normalizeSiteText(registrant && registrant.email);
      const phone = normalizeSiteText(registrant && registrant.phone);
      const cert = normalizeSiteText(registrant && registrant.certificationLevel);
      const partySize = Math.max(1, Number((registrant && registrant.partySize) || 1) || 1);
      const additionalGuests = Math.max(0, Number((registrant && registrant.additionalGuests) || 0) || 0);
      const createdAt = normalizeSiteText(registrant && registrant.createdAt);
      const deleting = actionKey && actionKey === state.allRegistrationDeletingKey;
      const converting = actionKey && actionKey === state.allRegistrationConvertingKey;
      const approving = actionKey && actionKey === state.allRegistrationApprovingKey;
      const resending = actionKey && actionKey === state.allRegistrationResendingKey;
      const classRecord = getRegistrationContextClassRecord(context);
      const detailItems = [
        approvalStatus === "approved" ? "Approved" : "Pending approval",
        cert ? `Certification: ${cert}` : "",
        partySize > 1 ? `${partySize} divers total` : "Solo signup",
        additionalGuests > 0 ? `${additionalGuests} guest${additionalGuests === 1 ? "" : "s"}` : "",
        createdAt ? `Signed up ${createdAt.slice(0, 10)}` : "",
      ].filter(Boolean);
      const eventLine = [
        context.eventDate ? formatDate(context.eventDate) : "",
        context.location,
      ].filter(Boolean).join(" | ");
      const registrationCardDetails = `
        <div class="management-contact-card-lines">
          ${renderContactCopyLine("Email", email, "email")}
          ${renderContactCopyLine("Phone", phone, "phone")}
        </div>
        <div class="management-registration-card-event">
          <strong>${escapeHtml(context.title || "DMZ Scuba Event")}</strong>
          <span>${escapeHtml(eventLine)}</span>
        </div>
        <div class="management-record-meta">
          ${detailItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      `;
      const unregisterButton = canUnregister
        ? `<button type="button" data-unregister-card="${escapeHtml(actionKey)}" ${!registrantId || deleting || state.allRegistrationsLoading ? "disabled" : ""}>${deleting ? "Unregistering..." : "Unregister from Event"}</button>`
        : "";
      return `
        <article class="management-record management-registration-card is-registration" data-registration-card>
          <div>
            <div class="management-record-badges">
              <span class="management-badge is-registration">Registration</span>
              <span class="management-badge is-${approvalStatus === "approved" ? "complete" : "waiting"}">${approvalStatus === "approved" ? "Approved" : "Pending"}</span>
              ${context.type ? `<span class="management-badge is-trip">${escapeHtml(context.type)}</span>` : ""}
            </div>
            <h3>${escapeHtml(fullName)}</h3>
            ${renderMobileCardDetails("Signup details", registrationCardDetails)}
          </div>
          <div class="management-record-actions management-registration-card-actions">
            <button type="button" data-open-registration-target="${escapeHtml(actionKey)}">${classRecord ? "Open Roster" : "Open Event"}</button>
            <button type="button" data-approve-registration="${escapeHtml(actionKey)}" ${!registrantId || !canApprove || approving || state.allRegistrationsLoading ? "disabled" : ""}>${approvalStatus === "approved" ? "Approved" : approving ? "Approving..." : "Approve"}</button>
            <button type="button" data-add-registration-contact="${escapeHtml(actionKey)}" ${!registrantId || alreadyContact || converting || state.allRegistrationsLoading ? "disabled" : ""}>${alreadyContact ? "Added to Contacts" : converting ? "Adding..." : "Add to Contacts"}</button>
            <button type="button" data-resend-registration-email="${escapeHtml(actionKey)}" ${!registrantId || resending || state.allRegistrationsLoading ? "disabled" : ""}>${resending ? "Sending..." : "Resend Email"}</button>
            ${unregisterButton}
          </div>
        </article>
      `;
    }).join("");
  }

  function updateMetrics() {
    const openCount = state.records.filter(
      (record) =>
        !isSiteBackedManagementRecord(record) &&
        record.recordType !== "contact" &&
        !closedStatuses.has(record.status)
    ).length;
    const openBalance = state.records
      .filter(
        (record) =>
          !isSiteBackedManagementRecord(record) &&
          record.recordType !== "contact" &&
          !closedStatuses.has(record.status)
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

  function updateFilterCounts() {
    const typeCounts = { contact: 0, inquiry: 0, class: 0, trip: 0, task: 0 };
    state.records.forEach((record) => {
      if (!isSiteBackedManagementRecord(record) && typeCounts[record.recordType] !== undefined) {
        typeCounts[record.recordType]++;
      }
    });
    filterButtons.forEach((button) => {
      const type = button.getAttribute("data-filter-type");
      const countEl = button.querySelector("[data-filter-count]");
      if (!countEl) return;
      if (type === "all") {
        const total = Object.values(typeCounts).reduce((sum, n) => sum + n, 0);
        countEl.textContent = total ? ` (${total})` : "";
      } else if (type === "registration") {
        const total = flattenRegistrationSnapshots().length;
        countEl.textContent = total ? ` (${total})` : "";
      } else if (typeCounts[type] !== undefined) {
        countEl.textContent = typeCounts[type] ? ` (${typeCounts[type]})` : "";
      }
    });
  }

  function renderRecords() {
    if (!recordList) return;
    updateMetrics();
    updateFilterCounts();
    if (state.filterType === "registration") {
      recordList.innerHTML = renderRegistrationCards();
      return;
    }
    const visibleRecords = getVisibleRecords();
    const visibleSiteEvents = getVisibleSiteEventsForRecords();
    if (!visibleRecords.length && !visibleSiteEvents.length) {
      recordList.innerHTML = `<div class="management-empty">${state.focusScope ? "No matching dashboard items right now." : "No matching management items yet."}</div>`;
      return;
    }

    const recordMarkup = visibleRecords
      .map((record) => {
        const isContact = record.recordType === "contact";
        const displayStatus = getEffectiveRecordStatus(record) || record.status || "scheduled";
        const extras = getExtras(record);
        const balance = getBalance(record);
        const contactEnrollments = isContact ? getContactClassEnrollments(record) : [];
        const meta = isContact
          ? [
              extras.source ? `Source: ${extras.source}` : "",
              extras.certification ? `Certification: ${extras.certification}` : "",
              extras.emailAlerts ? "Event alerts" : "",
              contactEnrollments.length ? `${contactEnrollments.length} class${contactEnrollments.length === 1 ? "" : "es"}` : "",
            ].filter(Boolean)
          : record.recordType === "inquiry"
          ? []
          : [
              record.owner ? `Owner: ${record.owner}` : "",
              record.contactName || [extras.firstName, extras.lastName].filter(Boolean).join(" ") || record.contactEmail || "",
              extras.stage ? `Stage: ${formatLabel(extras.stage)}` : "",
              extras.startDate ? `Starts ${formatDate(extras.startDate)}` : "",
              record.dueDate ? `Due ${formatDate(record.dueDate)}` : "",
              extras.inquiryDirection ? formatLabel(extras.inquiryDirection) : "",
              extras.inquiryCategory ? formatLabel(extras.inquiryCategory) : "",
              extras.outcomeReason ? `Closed: ${formatLabel(extras.outcomeReason)}` : "",
              balance > 0 ? `Balance ${formatMoney(balance)}` : "",
              record.relatedEvent || "",
            ].filter(Boolean);
        const note = String(record.notes || "").trim();
        const summary = (record.recordType === "class" || record.recordType === "inquiry") ? "" : (note.length > 180 ? `${note.slice(0, 180)}...` : note);
        const classDetails = record.recordType === "class" ? renderClassRecordDetails(record) : "";
        const contactDetails = record.recordType === "contact" ? renderContactRecordDetails(record) : "";
        const inquiryDetails = record.recordType === "inquiry" ? renderInquiryRecordDetails(record) : "";
        const inquiryPipeline = record.recordType === "inquiry" ? renderInquiryPipelineBar(record.status) : "";
        const inquiryCallout = record.recordType === "inquiry" ? renderInquiryCallout(record) : "";
        const contactCopy =
          record.recordType === "contact"
            ? `<div class="management-contact-card-lines">
                ${renderContactCopyLine("Email", record.contactEmail, "email")}
                ${renderContactCopyLine("Phone", record.contactPhone, "phone")}
              </div>`
            : "";
        const cardDetailsLabel = record.recordType === "contact"
          ? "Contact details"
          : record.recordType === "inquiry"
            ? "Inquiry details"
            : record.recordType === "class"
              ? "Class details"
              : "Item details";
        const cardDetails = [
          summary ? `<p class="management-card-note">${escapeHtml(summary)}</p>` : "",
          contactCopy,
          meta.length ? `<div class="management-record-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : "",
          classDetails,
          contactDetails,
          inquiryDetails,
        ].filter(Boolean).join("");
        const overdueFlag = isOverdue(record) ? `<span class="management-badge is-overdue">Overdue</span>` : "";
        const pinnedFlag = record.pinned ? " is-pinned" : "";
        return `
          <article class="management-record is-${escapeHtml(record.recordType)}${pinnedFlag} ${record.id === state.selectedId ? "is-selected" : ""}" data-record-id="${escapeHtml(record.id)}" data-record-status="${escapeHtml(displayStatus)}">
            <div>
              <div class="management-record-badges">
                <span class="management-badge is-${escapeHtml(record.recordType)}">${escapeHtml(formatLabel(record.recordType))}</span>
                ${
                  record.recordType === "contact"
                    ? ""
                    : `<span class="management-badge is-${escapeHtml(displayStatus)}">${escapeHtml(formatLabel(displayStatus))}</span>`
                }
                <span class="management-badge is-${escapeHtml(record.priority)}">${escapeHtml(formatLabel(record.priority))}</span>
                ${overdueFlag}
              </div>
              <h3>${escapeHtml(record.title)}</h3>
              ${inquiryPipeline}
              ${inquiryCallout}
              ${renderMobileCardDetails(cardDetailsLabel, cardDetails)}
            </div>
            <div class="management-record-actions">
              <button class="management-pin-btn ${record.pinned ? "is-pinned" : ""}" type="button" data-pin-record="${escapeHtml(record.id)}" aria-label="${record.pinned ? "Unpin" : "Pin"} ${escapeHtml(record.title)}" title="${record.pinned ? "Unpin" : "Pin"}">${record.pinned ? "★" : "☆"}</button>
              ${
                record.recordType === "contact"
                  ? ""
                  : `<select data-status-change="${escapeHtml(record.id)}" aria-label="Change status for ${escapeHtml(record.title)}">
                ${getStatusOptions(record.recordType)
                  .map((status) => `<option value="${status}" ${displayStatus === status ? "selected" : ""}>${formatLabel(status)}</option>`)
                  .join("")}
              </select>`
              }
            </div>
          </article>
        `;
      })
      .join("");
    const currentTodayKey = todayKey();
    const siteMarkup = visibleSiteEvents
      .map(({ item, index }) => {
        const isPast = String(item.date || "") < currentTodayKey;
        return renderSiteCalendarCard(item, index, isPast);
      })
      .join("");
    recordList.innerHTML = `${recordMarkup}${siteMarkup}`;
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
      registrationClosed: Boolean(extras.registrationClosed),
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
    const registrationClosed = Boolean((snapshot && snapshot.registrationClosed) || context.registrationClosed || isSnapshotRegistrationAtCapacity(snapshot));
    syncRegistrationClosedCheckbox(state.activeSiteRecord, snapshot);
    if (registrationSummary) {
      registrationSummary.textContent = state.registrationLoading
        ? "Loading signups..."
        : snapshot
          ? `${usedSpots} of ${capacity} spots filled. ${remainingSpots} remaining. ${registrationClosed ? "Registration is closed." : "Registration is open."}`
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
    const contactEmails = new Set(
      getContactRecords()
        .map((contact) => normalizeSiteText(contact.contactEmail).toLowerCase())
        .filter(Boolean)
    );
    registrationList.innerHTML = registrants
      .map((registrant) => {
        const registrantId = normalizeSiteText(registrant && registrant.id);
        const registrantEmail = normalizeSiteText(registrant && registrant.email).toLowerCase();
        const additionalGuests = Math.max(0, Number((registrant && registrant.additionalGuests) || 0) || 0);
        const partySize = Math.max(1, Number((registrant && registrant.partySize) || 1) || 1);
        const details = [
          partySize > 1 ? `${partySize} divers total` : "Solo signup",
          normalizeSiteText(registrant && registrant.email),
          normalizeSiteText(registrant && registrant.phone),
          normalizeSiteText(registrant && registrant.certificationLevel),
          additionalGuests > 0 ? `${additionalGuests} guest${additionalGuests === 1 ? "" : "s"}` : "",
          normalizeSiteText(registrant && registrant.createdAt) ? `Signed up ${normalizeSiteText(registrant.createdAt).slice(0, 10)}` : "",
        ].filter(Boolean);
        const deleting = registrantId && registrantId === state.registrationDeletingId;
        const converting = registrantId && registrantId === state.registrationConvertingId;
        const approving = registrantId && registrantId === state.registrationApprovingId;
        const resending = registrantId && registrantId === state.registrationResendingId;
        const alreadyContact = registrantEmail && contactEmails.has(registrantEmail);
        const approvalStatus = getRegistrationApprovalStatus(registrant);
        return `
          <div class="management-registration-item">
            <div>
              <strong>${escapeHtml(normalizeSiteText(registrant && registrant.name) || "Unnamed registrant")}</strong>
              <span>${escapeHtml([approvalStatus === "approved" ? "Approved" : "Pending approval", ...details].join(" | "))}</span>
            </div>
            <div class="management-registration-actions">
              <button type="button" data-approve-event-registration="${escapeHtml(registrantId)}" ${!registrantId || approvalStatus === "approved" || approving || state.registrationLoading ? "disabled" : ""}>${approvalStatus === "approved" ? "Approved" : approving ? "Approving..." : "Approve"}</button>
              <button type="button" data-convert-event-registration="${escapeHtml(registrantId)}" ${!registrantId || alreadyContact || converting || state.registrationLoading ? "disabled" : ""}>${alreadyContact ? "Added" : converting ? "Adding..." : "Add Contact"}</button>
              <button type="button" data-resend-event-registration-email="${escapeHtml(registrantId)}" ${!registrantId || resending || state.registrationLoading ? "disabled" : ""}>${resending ? "Sending..." : "Resend Email"}</button>
              <button type="button" data-remove-registration="${escapeHtml(registrantId)}" ${!registrantId || deleting || state.registrationLoading ? "disabled" : ""}>${deleting ? "Removing..." : "Unregister"}</button>
            </div>
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
    syncActiveRegistrationStateFromSnapshot(data);
    setStatus(recordStatus, "Registration removed.", "success");
    renderRegistrationManager();
  }

  async function approveEventRegistration(registrationId) {
    const context = getActiveRegistrationContext();
    const safeId = normalizeSiteText(registrationId);
    if (!context || !safeId) return;
    state.registrationApprovingId = safeId;
    renderRegistrationManager();
    try {
      const data = await updateRegistrationApproval(context, safeId, "approved");
      state.registrationSnapshot = data;
      syncActiveRegistrationStateFromSnapshot(data);
      updateAllRegistrationSnapshot(context, data);
      setStatus(recordStatus, "Registration approved.", "success");
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not approve this registration.", "error");
    } finally {
      state.registrationApprovingId = "";
      renderRegistrationManager();
      renderRecords();
    }
  }

  async function resendRegistrationEmail(context, registrationId) {
    const safeId = normalizeSiteText(registrationId);
    if (!context || !context.sourceId || !context.eventDate || !safeId) return null;
    const url = `${adminEventsUrl}/${encodeURIComponent(context.sourceId)}/registrations/${encodeURIComponent(safeId)}/email?date=${encodeURIComponent(context.eventDate)}`;
    const resp = await apiFetch(url, { method: "POST" }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok || !data.ok) {
      throw new Error(data.error || "Could not resend registration email.");
    }
    return data;
  }

  async function resendActiveRegistrationEmail(registrationId) {
    const context = getActiveRegistrationContext();
    const safeId = normalizeSiteText(registrationId);
    if (!context || !safeId) return;
    state.registrationResendingId = safeId;
    renderRegistrationManager();
    try {
      await resendRegistrationEmail(context, safeId);
      setStatus(recordStatus, "Registration email resent.", "success");
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not resend registration email.", "error");
    } finally {
      state.registrationResendingId = "";
      renderRegistrationManager();
    }
  }

  function findAllRegistrationEntry(actionKey) {
    return flattenRegistrationSnapshots().find((entry) => entry.actionKey === normalizeSiteText(actionKey)) || null;
  }

  async function unregisterFromRegistrationCard(actionKey) {
    const entry = findAllRegistrationEntry(actionKey);
    const context = entry && entry.context;
    const registrantId = normalizeSiteText(entry && entry.registrant && entry.registrant.id);
    if (!context || !registrantId) return;
    if (!window.confirm("Unregister this person from the event?")) return;
    state.allRegistrationDeletingKey = normalizeSiteText(actionKey);
    renderRecords();
    const url = `${adminEventsUrl}/${encodeURIComponent(context.sourceId)}/registrations/${encodeURIComponent(registrantId)}?date=${encodeURIComponent(context.eventDate)}`;
    const resp = await apiFetch(url, { method: "DELETE" }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    state.allRegistrationDeletingKey = "";
    if (!resp || !resp.ok || !data.ok) {
      setStatus(recordStatus, data.error || "Could not unregister this person.", "error");
      renderRecords();
      return;
    }
    state.allRegistrationSnapshots = state.allRegistrationSnapshots.map((snapshot) => {
      const snapshotContext = snapshot && snapshot.context ? snapshot.context : {};
      if (
        normalizeSiteText(snapshotContext.sourceId) === normalizeSiteText(context.sourceId) &&
        normalizeSiteText(snapshotContext.eventDate) === normalizeSiteText(context.eventDate)
      ) {
        return { ...data, context };
      }
      return snapshot;
    });
    syncSiteEventRegistrationClosed(context, data);
    const activeContext = getActiveRegistrationContext();
    if (
      activeContext &&
      normalizeSiteText(activeContext.sourceId) === normalizeSiteText(context.sourceId) &&
      normalizeSiteText(activeContext.eventDate) === normalizeSiteText(context.eventDate)
    ) {
      state.registrationSnapshot = data;
      syncActiveRegistrationStateFromSnapshot(data);
    }
    setStatus(recordStatus, "Registration removed.", "success");
    renderRecords();
  }

  async function approveRegistrationCard(actionKey) {
    const entry = findAllRegistrationEntry(actionKey);
    if (!entry || !entry.registrant || !entry.context) return;
    state.allRegistrationApprovingKey = normalizeSiteText(actionKey);
    renderRecords();
    try {
      await approveRegistrationEntry(entry);
      setStatus(recordStatus, "Registration approved.", "success");
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not approve this registration.", "error");
    } finally {
      state.allRegistrationApprovingKey = "";
      renderRecords();
    }
  }

  async function resendRegistrationCardEmail(actionKey) {
    const entry = findAllRegistrationEntry(actionKey);
    const context = entry && entry.context;
    const registrantId = normalizeSiteText(entry && entry.registrant && entry.registrant.id);
    if (!context || !registrantId) return;
    state.allRegistrationResendingKey = normalizeSiteText(actionKey);
    renderRecords();
    try {
      await resendRegistrationEmail(context, registrantId);
      setStatus(recordStatus, "Registration email resent.", "success");
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not resend registration email.", "error");
    } finally {
      state.allRegistrationResendingKey = "";
      renderRecords();
    }
  }

  async function sendEventAlertForCalendarIndex(indexValue) {
    const index = Number(indexValue);
    const item = Number.isFinite(index) ? state.siteEvents[index] : null;
    const sourceId = normalizeSiteText(item && (item.sourceId || item.id));
    const eventDate = normalizeSiteText(item && item.date);
    const alertKey = getSiteEventAlertKey(item);
    const isPast = eventDate && eventDate < todayKey();
    const eligibility = getEventAlertEligibility(item, isPast);
    if (!item || !sourceId || !eventDate) {
      setStatus(recordStatus, "Could not find this calendar event.", "error");
      return;
    }
    if (!eligibility.eligible) {
      setStatus(recordStatus, eligibility.reason || "This event is not eligible for alert emails.", "error");
      return;
    }
    const name = normalizeSiteText(item.title) || "this event";
    if (!window.confirm(`Send an event alert email to all opted-in subscribers for "${name}"?`)) return;

    state.eventAlertSendingKey = alertKey;
    renderRecords();
    setStatus(recordStatus, "Sending event alert emails...");
    try {
      const url = `${adminEventsUrl}/${encodeURIComponent(sourceId)}/alerts?date=${encodeURIComponent(eventDate)}`;
      const resp = await apiFetch(url, { method: "POST" }).catch(() => null);
      const data = resp ? await resp.json().catch(() => ({})) : {};
      if (!resp || !resp.ok || (data.ok === false && data.sentCount === undefined && data.failedCount === undefined)) {
        throw new Error(data.error || "Could not send event alert emails.");
      }
      const sent = Math.max(0, Number(data.sentCount || 0) || 0);
      const failed = Math.max(0, Number(data.failedCount || 0) || 0);
      const total = Math.max(sent + failed, Number(data.subscriberCount || 0) || 0);
      setStatus(
        recordStatus,
        failed
          ? `Event alert sent to ${sent} of ${total} subscriber${total === 1 ? "" : "s"}. ${failed} failed.`
          : `Event alert sent to ${sent} subscriber${sent === 1 ? "" : "s"}.`,
        failed ? "error" : "success"
      );
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not send event alert emails.", "error");
    } finally {
      state.eventAlertSendingKey = "";
      renderRecords();
    }
  }

  async function saveRegistrantAsContact(registrant, notes = "Created from event registration escrow.") {
    const firstName = normalizeSiteText(registrant && registrant.firstName);
    const lastName = normalizeSiteText(registrant && registrant.lastName);
    const contactName = [firstName, lastName].filter(Boolean).join(" ") || normalizeSiteText(registrant && registrant.name);
    const existingContact = getContactRecords().find((contact) => {
      const email = normalizeSiteText(contact.contactEmail).toLowerCase();
      return email && email === normalizeSiteText(registrant && registrant.email).toLowerCase();
    });
    if (existingContact) {
      return updateContactRecord(existingContact, {
        registrationSource: "self_registered",
        certification: normalizeSiteText(registrant && registrant.certificationLevel) || getExtras(existingContact).certification,
      });
    }
    const saved = await saveRecordPayload({
      recordType: "contact",
      title: contactName,
      status: "active",
      priority: "normal",
      contactName,
      contactEmail: normalizeSiteText(registrant && registrant.email),
      contactPhone: normalizeSiteText(registrant && registrant.phone),
      notes,
      extras: {
        firstName,
        lastName,
        source: "Event registration",
        registrationSource: "self_registered",
        certification: normalizeSiteText(registrant && registrant.certificationLevel),
      },
    });
    state.records = [saved, ...state.records.filter((item) => item.id !== saved.id)];
    return saved;
  }

  async function convertEventRegistrationToContact(registrationId) {
    const registrants = Array.isArray(state.registrationSnapshot && state.registrationSnapshot.registrants)
      ? state.registrationSnapshot.registrants
      : [];
    const registrant = registrants.find((item) => normalizeSiteText(item && item.id) === normalizeSiteText(registrationId));
    if (!registrant) return;
    state.registrationConvertingId = normalizeSiteText(registrationId);
    renderRegistrationManager();
    await saveRegistrantAsContact(registrant);
    state.registrationConvertingId = "";
    renderRegistrationManager();
    renderRecords();
    setStatus(recordStatus, "Registration imported as a contact.", "success");
  }

  async function addRegistrationCardToContacts(actionKey) {
    const entry = findAllRegistrationEntry(actionKey);
    if (!entry || !entry.registrant) return;
    state.allRegistrationConvertingKey = normalizeSiteText(actionKey);
    renderRecords();
    const context = entry.context || {};
    const notes = [
      "Created from online event registration.",
      context.title ? `Event: ${context.title}` : "",
      context.eventDate ? `Event date: ${formatDate(context.eventDate)}` : "",
    ].filter(Boolean).join("\n");
    try {
      await saveRegistrantAsContact(entry.registrant, notes);
      setStatus(recordStatus, "Registration imported as a contact.", "success");
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not add this registration to contacts.", "error");
    } finally {
      state.allRegistrationConvertingKey = "";
      renderRecords();
    }
  }

  async function updateRegistrationApproval(context, registrationId, status = "approved") {
    const safeId = normalizeSiteText(registrationId);
    if (!context || !context.sourceId || !context.eventDate || !safeId) return null;
    const url = `${adminEventsUrl}/${encodeURIComponent(context.sourceId)}/registrations/${encodeURIComponent(safeId)}/approval?date=${encodeURIComponent(context.eventDate)}`;
    const resp = await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok || !data.ok) {
      throw new Error(data.error || "Could not update registration approval.");
    }
    return data;
  }

  function updateAllRegistrationSnapshot(context, data) {
    if (!context || !data) return;
    state.allRegistrationSnapshots = state.allRegistrationSnapshots.map((snapshot) => {
      const snapshotContext = snapshot && snapshot.context ? snapshot.context : {};
      if (
        normalizeSiteText(snapshotContext.sourceId) === normalizeSiteText(context.sourceId) &&
        normalizeSiteText(snapshotContext.eventDate) === normalizeSiteText(context.eventDate)
      ) {
        return { ...data, context: snapshotContext };
      }
      return snapshot;
    });
  }

  function syncActiveRegistrationStateFromSnapshot(snapshot) {
    if (!state.activeSiteRecord || !snapshot) return;
    const extras = getExtras(state.activeSiteRecord);
    const nextClosed = Boolean(snapshot.registrationClosed) ? "1" : "";
    syncSiteEventRegistrationClosed(
      {
        sourceId: extras.sourceId || extras.eventId,
        eventDate: extras.eventDate || extras.startDate,
      },
      snapshot
    );
    state.activeSiteRecord = {
      ...state.activeSiteRecord,
      extras: {
        ...extras,
        registrationClosed: nextClosed,
      },
    };
    if (recordForm && recordForm.elements.registrationClosed && !recordForm.elements.registrationClosed.disabled) {
      recordForm.elements.registrationClosed.checked = Boolean(nextClosed);
    }
  }

  function syncSiteEventRegistrationClosed(context, snapshot) {
    if (!context || !snapshot) return;
    const sourceId = normalizeSiteText(context.sourceId);
    const eventDate = normalizeSiteText(context.eventDate);
    const nextClosed = Boolean(snapshot.registrationClosed);
    if (!sourceId || !eventDate) return;
    [state.siteEvents, state.allSiteEvents].forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((item) => {
        if (
          normalizeSiteText(item && (item.sourceId || item.id)) === sourceId &&
          normalizeSiteText(item && item.date) === eventDate
        ) {
          item.registrationClosed = nextClosed;
        }
      });
    });
  }

  async function approveRegistrationEntry(entry, { renderScope = "records" } = {}) {
    if (!entry || !entry.registrant || !entry.context) return null;
    const registrantId = normalizeSiteText(entry.registrant.id);
    const classRecord = getRegistrationContextClassRecord(entry.context);
    if (classRecord) {
      const contact = await saveRegistrantAsContact(entry.registrant, `Approved from online registration.\nEvent: ${entry.context.title || classRecord.title}\nEvent date: ${formatDate(entry.context.eventDate)}`);
      await addContactToClassRecord(contact, classRecord, "self_registered", registrantId);
      await syncClassCalendarAfterRosterChange(classRecord, "Registration approved and added to roster.");
    }
    const data = await updateRegistrationApproval(entry.context, registrantId, "approved");
    updateAllRegistrationSnapshot(entry.context, data);
    if (state.classRegistrationSnapshot && normalizeSiteText((getPrimaryClassRegistrationContext(getActiveClassRecord()) || {}).sourceId) === normalizeSiteText(entry.context.sourceId)) {
      state.classRegistrationSnapshot = data;
    }
    if (renderScope === "class") renderClassRegistrationEscrow(getActiveClassRecord());
    else renderRecords();
    return data;
  }

  function renderClassRegistrationEscrow(record = null) {
    if (!classRegistrationList || !classRegistrationSummary) return;
    const classRecord = record || (state.selectedId ? state.records.find((item) => item.id === state.selectedId) : null);
    const context = getPrimaryClassRegistrationContext(classRecord);
    if (!context) {
      classRegistrationSummary.textContent = "Add and save a class date before registration escrow can load.";
      classRegistrationList.innerHTML = '<div class="management-empty">No class registration date is available yet.</div>';
      return;
    }
    if (state.classRegistrationLoading) {
      classRegistrationSummary.textContent = "Loading registration escrow...";
      classRegistrationList.innerHTML = '<div class="management-empty">Loading registrations...</div>';
      return;
    }
    const snapshot = state.classRegistrationSnapshot;
    syncRegistrationClosedCheckbox(classRecord, snapshot);
    const registrants = Array.isArray(snapshot && snapshot.registrants) ? snapshot.registrants : [];
    const pendingCount = registrants.filter((item) => getRegistrationApprovalStatus(item) !== "approved").length;
    const registrationClosed = isSnapshotRegistrationAtCapacity(snapshot) || Boolean(getExtras(classRecord).registrationClosed);
    classRegistrationSummary.textContent = snapshot
      ? `${pendingCount} registration${pendingCount === 1 ? "" : "s"} waiting for approval. ${registrants.length} online signup${registrants.length === 1 ? "" : "s"} total. ${registrationClosed ? "Registration is closed." : "Registration is open."}`
      : "Refresh registrations after the class has been saved to the calendar.";
    if (!snapshot) {
      classRegistrationList.innerHTML = '<div class="management-empty">No registration data loaded yet.</div>';
      return;
    }
    if (!registrants.length) {
      classRegistrationList.innerHTML = '<div class="management-empty">No registrations in escrow.</div>';
      return;
    }
    const classId = classRecord ? slugify(getExtras(classRecord).classId || classRecord.id || classRecord.title, "class") : "";
    const enrolledRegistrationIds = new Set(
      getClassRosterContacts(classRecord)
        .map((contact) => getClassRosterEntry(contact, classId).sourceRegistrationId)
        .filter(Boolean)
    );
    classRegistrationList.innerHTML = registrants.map((registrant) => {
      const id = normalizeSiteText(registrant && registrant.id);
      const approvalStatus = getRegistrationApprovalStatus(registrant);
      const alreadyAdded = enrolledRegistrationIds.has(id);
      const busy = id && id === state.classConvertingRegistrationId;
      const approving = id && id === state.classApprovingRegistrationId;
      const details = [
        approvalStatus === "approved" || alreadyAdded ? "Approved" : "Pending approval",
        normalizeSiteText(registrant && registrant.email),
        normalizeSiteText(registrant && registrant.phone),
        normalizeSiteText(registrant && registrant.certificationLevel),
      ].filter(Boolean);
      return `
        <div class="management-class-registration-item">
          <div>
            <strong>${escapeHtml(normalizeSiteText(registrant && registrant.name) || "Unnamed registrant")}</strong>
            <span>${escapeHtml(details.join(" | "))}</span>
          </div>
          <button type="button" data-convert-registration="${escapeHtml(id)}" ${alreadyAdded || approvalStatus === "approved" || busy || approving ? "disabled" : ""}>${alreadyAdded || approvalStatus === "approved" ? "Approved" : busy || approving ? "Approving..." : "Approve to Roster"}</button>
        </div>
      `;
    }).join("");
  }

  async function loadClassRegistrationEscrow() {
    const classRecord = state.selectedId ? state.records.find((item) => item.id === state.selectedId) : null;
    const context = getPrimaryClassRegistrationContext(classRecord);
    if (!context) {
      renderClassRegistrationEscrow(classRecord);
      return null;
    }
    state.classRegistrationLoading = true;
    renderClassRegistrationEscrow(classRecord);
    const url = `${eventsUrl}/${encodeURIComponent(context.sourceId)}/registrations?date=${encodeURIComponent(context.eventDate)}&t=${Date.now()}`;
    const resp = await fetch(url, { cache: "no-store" }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    state.classRegistrationLoading = false;
    if (!resp || !resp.ok || !data.ok) {
      state.classRegistrationSnapshot = null;
      if (classRegistrationSummary) classRegistrationSummary.textContent = data.error || "Registration escrow is unavailable.";
      renderClassRegistrationEscrow(classRecord);
      return null;
    }
    state.classRegistrationSnapshot = data;
    renderClassRegistrationEscrow(classRecord);
    return data;
  }

  function getActiveClassRecord() {
    return state.selectedId ? state.records.find((item) => item.id === state.selectedId && item.recordType === "class") : null;
  }

  async function updateContactRecord(contact, nextExtras) {
    const next = {
      ...contact,
      extras: {
        ...getExtras(contact),
        ...nextExtras,
      },
    };
    const saved = await saveRecordPayload(next);
    const index = state.records.findIndex((item) => item.id === saved.id);
    if (index >= 0) state.records[index] = saved;
    return saved;
  }

  async function addContactToClassRecord(contact, classRecord, source = "in_house", sourceRegistrationId = "") {
    if (!contact || !contact.id || !classRecord || classRecord.recordType !== "class") return null;
    const classId = getClassRecordId(classRecord);
    const existingEnrollments = getContactClassEnrollments(contact);
    if (existingEnrollments.some((entry) => normalizeSiteText(entry && entry.classId) === classId)) {
      return contact;
    }
    return updateContactRecord(contact, {
      registrationSource: source === "self_registered" ? "self_registered" : (getExtras(contact).registrationSource || "in_house"),
      classEnrollments: [
        ...existingEnrollments,
        {
          classId,
          classRecordId: classRecord.id,
          classTitle: classRecord.title,
          source,
          status: "enrolled",
          sourceRegistrationId,
          enrolledAt: new Date().toISOString(),
        },
      ],
    });
  }

  async function enrollContactInClass(contact, source = "in_house", sourceRegistrationId = "") {
    const current = state.selectedId ? state.records.find((item) => item.id === state.selectedId) : null;
    if (!current || current.recordType !== "class") {
      setStatus(recordStatus, "Save or open a class before adding contacts.", "error");
      return null;
    }
    if (!contact || !contact.id) return null;
    const classId = getClassRecordId(current);
    if (getContactClassEnrollments(contact).some((entry) => normalizeSiteText(entry && entry.classId) === classId)) {
      setStatus(recordStatus, "Contact is already enrolled in this class.", "error");
      return contact;
    }
    const saved = await addContactToClassRecord(contact, current, source, sourceRegistrationId);
    fillForm(current);
    return saved;
  }

  async function addClassesToContact() {
    const contact = state.selectedId ? state.records.find((record) => record.id === state.selectedId && record.recordType === "contact") : null;
    if (!contact || !contact.id) {
      setStatus(recordStatus, "Save or open a contact before adding classes.", "error");
      return;
    }
    const classIds = contactClassSelect
      ? Array.from(contactClassSelect.selectedOptions).map((option) => normalizeSiteText(option.value)).filter(Boolean)
      : [];
    if (!classIds.length) {
      setStatus(recordStatus, "Choose at least one class to add.", "error");
      return;
    }
    const existingEnrollments = getContactClassEnrollments(contact);
    const existingIds = new Set(existingEnrollments.map((entry) => normalizeSiteText(entry && entry.classId)));
    const status = contactClassStatusSelect && contactClassStatusSelect.value === "completed" ? "completed" : "enrolled";
    const nextEnrollments = [
      ...existingEnrollments,
      ...classIds
        .filter((classId) => !existingIds.has(classId))
        .map((classId) => {
          const classRecord = getClassRecords().find((record) => getClassRecordId(record) === classId);
          return {
            classId,
            classRecordId: classRecord ? classRecord.id : "",
            classTitle: classRecord ? classRecord.title : classId,
            source: "in_house",
            status,
            enrolledAt: new Date().toISOString(),
          };
        }),
    ];
    const saved = await updateContactRecord(contact, { classEnrollments: nextEnrollments });
    fillForm(saved);
    const syncResult = await syncClassCalendarsByIds(classIds);
    setStatus(
      recordStatus,
      syncResult.failed
        ? `${classIds.length} class${classIds.length === 1 ? "" : "es"} added to contact, but one or more calendars did not sync.`
        : `${classIds.length} class${classIds.length === 1 ? "" : "es"} added to contact.${syncResult.synced ? ` Synced ${syncResult.synced} calendar date${syncResult.synced === 1 ? "" : "s"}.` : ""}`,
      syncResult.failed ? "error" : "success"
    );
  }

  async function updateContactClassEnrollment(classId, updater) {
    const contact = state.selectedId ? state.records.find((record) => record.id === state.selectedId && record.recordType === "contact") : null;
    const safeClassId = normalizeSiteText(classId);
    if (!contact || !safeClassId) return;
    const nextEnrollments = getContactClassEnrollments(contact)
      .map((entry) => normalizeSiteText(entry && entry.classId) === safeClassId ? updater(entry) : entry)
      .filter(Boolean);
    const saved = await updateContactRecord(contact, { classEnrollments: nextEnrollments });
    fillForm(saved);
    return saved;
  }

  async function toggleContactClassStatus(classId) {
    await updateContactClassEnrollment(classId, (entry) => ({
      ...entry,
      status: getEnrollmentStatus(entry) === "completed" ? "enrolled" : "completed",
    }));
    setStatus(recordStatus, "Class status updated for this contact.", "success");
  }

  async function removeClassFromContact(classId) {
    await updateContactClassEnrollment(classId, () => null);
    const syncResult = await syncClassCalendarsByIds([classId]);
    setStatus(
      recordStatus,
      syncResult.failed
        ? "Class removed from this contact, but the calendar did not sync."
        : `Class removed from this contact.${syncResult.synced ? ` Synced ${syncResult.synced} calendar date${syncResult.synced === 1 ? "" : "s"}.` : ""}`,
      syncResult.failed ? "error" : "success"
    );
  }

  async function syncClassCalendarsByIds(classIds) {
    let syncedTotal = 0;
    let failed = false;
    const uniqueIds = Array.from(new Set((Array.isArray(classIds) ? classIds : []).map((id) => normalizeSiteText(id)).filter(Boolean)));
    for (const classId of uniqueIds) {
      const classRecord = getClassRecords().find((record) => getClassRecordId(record) === classId);
      if (!classRecord) continue;
      try {
        syncedTotal += await syncClassRecordToCalendar(classRecord);
      } catch (_error) {
        failed = true;
      }
    }
    return { synced: syncedTotal, failed };
  }

  async function removeContactEnrollmentFromClass(contactId) {
    const current = getActiveClassRecord();
    const contact = state.records.find((record) => record.id === contactId && record.recordType === "contact");
    if (!current || !contact) return;
    const classId = slugify(getExtras(current).classId || current.id || current.title, "class");
    await updateContactRecord(contact, {
      classEnrollments: getContactClassEnrollments(contact).filter((entry) => normalizeSiteText(entry && entry.classId) !== classId),
    });
    fillForm(current);
  }

  async function syncClassCalendarAfterRosterChange(classRecord, successMessage) {
    if (!classRecord || classRecord.recordType !== "class") return;
    try {
      const syncedCount = await syncClassRecordToCalendar(classRecord);
      fillForm(classRecord);
      setStatus(recordStatus, `${successMessage} Synced ${syncedCount} class date${syncedCount === 1 ? "" : "s"} to the site calendar.`, "success");
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Roster updated, but class dates did not sync.", "error");
    }
  }

  async function addSelectedContactToClass() {
    const classRecord = getActiveClassRecord();
    const contactId = classContactSelect ? classContactSelect.value : "";
    const contact = state.records.find((record) => record.id === contactId && record.recordType === "contact");
    if (!contact) {
      setStatus(recordStatus, "Choose a contact to add.", "error");
      return;
    }
    await enrollContactInClass(contact, "in_house");
    await syncClassCalendarAfterRosterChange(classRecord, "Contact enrolled in class.");
  }

  async function convertRegistrationToContact(registrationId) {
    const classRecord = getActiveClassRecord();
    const context = getPrimaryClassRegistrationContext(classRecord);
    const registrants = Array.isArray(state.classRegistrationSnapshot && state.classRegistrationSnapshot.registrants)
      ? state.classRegistrationSnapshot.registrants
      : [];
    const registrant = registrants.find((item) => normalizeSiteText(item && item.id) === normalizeSiteText(registrationId));
    if (!registrant || !classRecord || !context) return;
    state.classApprovingRegistrationId = normalizeSiteText(registrationId);
    state.classConvertingRegistrationId = normalizeSiteText(registrationId);
    renderClassRegistrationEscrow(classRecord);
    try {
      await approveRegistrationEntry({
        context: {
          ...context,
          title: classRecord.title,
          managementClassId: getClassRecordId(classRecord),
        },
        registrant,
        actionKey: getRegistrationActionKey(context, registrationId),
      }, { renderScope: "class" });
      setStatus(recordStatus, "Registration approved and enrolled in class.", "success");
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not approve this registration.", "error");
    } finally {
      state.classApprovingRegistrationId = "";
      state.classConvertingRegistrationId = "";
      renderClassRegistrationEscrow(classRecord);
    }
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
      inquiryDirection: textValue("inquiryDirection", existingExtras.inquiryDirection),
      inquiryCategory: textValue("inquiryCategory", existingExtras.inquiryCategory),
      outcomeReason: textValue("outcomeReason", existingExtras.outcomeReason),
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
      registrationClosed:
        recordForm.elements.registrationClosed && !recordForm.elements.registrationClosed.disabled
          ? (recordForm.elements.registrationClosed.checked ? "1" : "")
          : String(existingExtras.registrationClosed || ""),
      registrationEmailSubject: textValue("registrationEmailSubject", existingExtras.registrationEmailSubject),
      registrationEmailTemplateId: textValue("registrationEmailTemplateId", existingExtras.registrationEmailTemplateId),
      registrationEmailUseTemplate:
        recordForm.elements.registrationEmailUseTemplate && !recordForm.elements.registrationEmailUseTemplate.disabled
          ? (recordForm.elements.registrationEmailUseTemplate.checked || Boolean(textValue("registrationEmailTemplateId", existingExtras.registrationEmailTemplateId)) ? "1" : "")
          : String(existingExtras.registrationEmailUseTemplate || ""),
      registrationEmailIsHtml:
        recordForm.elements.registrationEmailIsHtml && !recordForm.elements.registrationEmailIsHtml.disabled
          ? (recordForm.elements.registrationEmailIsHtml.checked ? "1" : "")
          : String(existingExtras.registrationEmailIsHtml || ""),
      registrationEmailContent: textValue("registrationEmailContent", existingExtras.registrationEmailContent),
      registrationEmailUseFullHtml:
        recordForm.elements.registrationEmailUseFullHtml && !recordForm.elements.registrationEmailUseFullHtml.disabled
          ? (recordForm.elements.registrationEmailUseFullHtml.checked ? "1" : "")
          : String(existingExtras.registrationEmailUseFullHtml || ""),
      registrationEmailFullHtml: textValue("registrationEmailFullHtml", existingExtras.registrationEmailFullHtml),
      capacity: textValue("capacity", existingExtras.capacity),
      certification: textValue("certification", existingExtras.certification),
      emailAlerts:
        recordForm.elements.emailAlerts && !recordForm.elements.emailAlerts.disabled
          ? (recordForm.elements.emailAlerts.checked ? "1" : "")
          : String(existingExtras.emailAlerts || ""),
      amountOwed: textValue("amountOwed", existingExtras.amountOwed),
      amountPaid: textValue("amountPaid", existingExtras.amountPaid),
      nextStep: textValue("nextStep", existingExtras.nextStep),
    };
    const recordType = textValue("recordType", existing && existing.recordType) || "inquiry";
    if (recordType === "inquiry") {
      extras.inquiryContactIds = getSelectedInquiryContactIds();
    } else if (Array.isArray(existingExtras.inquiryContactIds)) {
      extras.inquiryContactIds = existingExtras.inquiryContactIds;
    }
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
    const primaryInquiryContact = recordType === "inquiry" && extras.inquiryContactIds.length
      ? getContactRecords().find((contact) => contact.id === extras.inquiryContactIds[0])
      : null;
    const contactName =
      recordType === "contact" ? contactFullName : primaryInquiryContact ? getContactDisplayName(primaryInquiryContact) : textValue("contactName", existing && existing.contactName);
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
            ? getEffectiveClassStatus({ ...(existing || {}), recordType, status: normalizeSiteText(existing && existing.status) || "scheduled", title, extras })
            : textValue("status", existing && existing.status) || "new",
      priority,
      owner: textValue("owner", existing && existing.owner),
      contactName,
      contactEmail: primaryInquiryContact ? normalizeSiteText(primaryInquiryContact.contactEmail) : textValue("contactEmail", existing && existing.contactEmail),
      contactPhone: primaryInquiryContact ? normalizeSiteText(primaryInquiryContact.contactPhone) : textValue("contactPhone", existing && existing.contactPhone),
      dueDate: textValue("dueDate", existing && existing.dueDate),
      relatedEvent: textValue("relatedEvent", existing && existing.relatedEvent),
      notes: textValue("notes", existing && existing.notes),
      extras,
      ...(existing && existing.pinned ? { pinned: true } : {}),
    };
  }

  function fillForm(record = null, defaultType = "") {
    if (!recordForm) return;
    recordForm.reset();
    syncTimeOptions();
    const requestedType = normalizeSiteText(defaultType);
    const newRecordType = typeConfigs[requestedType] ? requestedType : "contact";
    const item = record || {
      id: "",
      recordType: newRecordType,
      status: "new",
      priority: "normal",
      extras: {},
    };
    state.activeSiteRecord = isSiteBackedManagementRecord(item) ? item : null;
    state.selectedId = item.id || "";
    if (recordForm.elements.recordType) {
      recordForm.elements.recordType.value = item.recordType || "contact";
    }
    applyTypeConfig(item.recordType || "contact", Boolean(state.selectedId));
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
    state.classRegistrationSnapshot = null;
    state.classRegistrationLoading = false;
    state.classConvertingRegistrationId = "";
    renderClassSchedule(getExtras(item).classSessions || {});
    renderClassRoster(item);
    renderContactClassManager(item);
    if (inquiryContactSearch) inquiryContactSearch.value = "";
    renderInquiryContactManager(item);
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
    if (state.activeSiteRecord) {
      loadRegistrationSnapshot();
    } else {
      resetRegistrationManager();
      if (item.recordType === "class" && item.id) loadClassRegistrationEscrow();
    }
    updateRegistrationEmailCounters();
    if (deleteButton) deleteButton.hidden = !state.selectedId;
    const duplicateButton = app.querySelector("[data-duplicate-record]");
    if (duplicateButton) duplicateButton.hidden = !state.selectedId || Boolean(state.activeSiteRecord);
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

  async function loadSiteCalendar({ silent = false } = {}) {
    if (!silent && calendarStatus) calendarStatus.textContent = "Loading site calendar...";
    const resp = await fetch(`${eventsUrl}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    const data = resp ? await resp.json().catch(() => null) : null;
    if (!resp || !resp.ok || !data) {
      state.siteEvents = [];
      if (calendarStatus) calendarStatus.textContent = "Could not load site calendar data.";
      renderRecords();
      return false;
    }
    state.eventsPayload = data;
    state.allSiteEvents = expandSiteEventPayload(data).filter((item) => ["class", "trip"].includes(classifySiteEvent(item)));
    state.siteEvents = state.allSiteEvents;
    state.allRegistrationSnapshots = [];
    state.allRegistrationsLoaded = false;
    if (calendarStatus) {
      const upcomingCount = state.siteEvents.filter((item) => String(item.date || "") >= todayKey()).length;
      const pastCount = Math.max(0, state.siteEvents.length - upcomingCount);
      calendarStatus.textContent = state.siteEvents.length
        ? `${upcomingCount} upcoming site calendar records${pastCount ? `, ${pastCount} past hidden` : ""}.`
        : "No records are currently published in the site calendar.";
    }
    renderRecords();
    updateMetrics();
    loadAllRegistrationSnapshots();
    return true;
  }

  async function loadAllRegistrationSnapshots({ force = false } = {}) {
    if (state.allRegistrationsLoading) return;
    if (state.allRegistrationsLoaded && !force) return;
    if (!state.allSiteEvents.length) {
      await loadSiteCalendar({ silent: true });
    }
    const contexts = getRegistrationContexts();
    state.allRegistrationsLoading = true;
    renderRecords();
    const snapshots = await Promise.all(
      contexts.map(async (context) => {
        const url = `${eventsUrl}/${encodeURIComponent(context.sourceId)}/registrations?date=${encodeURIComponent(context.eventDate)}&t=${Date.now()}`;
        const resp = await fetch(url, { cache: "no-store" }).catch(() => null);
        const data = resp ? await resp.json().catch(() => ({})) : {};
        if (!resp || !resp.ok || !data.ok) return null;
        return { ...data, context };
      })
    );
    state.allRegistrationSnapshots = snapshots.filter(Boolean);
    state.allRegistrationsLoaded = true;
    state.allRegistrationsLoading = false;
    renderRecords();
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
    const registrationEmailSubject = String(extras.registrationEmailSubject || "").trim();
    const registrationEmailUseTemplate = Boolean(extras.registrationEmailUseTemplate);
    const registrationEmailTemplateId = String(extras.registrationEmailTemplateId || "").trim();
    const registrationEmailIsHtml = Boolean(extras.registrationEmailIsHtml);
    const registrationEmailContent = String(extras.registrationEmailContent || "").trim();
    const registrationEmailUseFullHtml = Boolean(extras.registrationEmailUseFullHtml);
    const registrationEmailFullHtml = String(extras.registrationEmailFullHtml || "").trim();
    const roster = getClassRosterSnapshot({ ...record, extras: { ...extras, classId } }, classId);
    const generated = sessions.map((session, index) => {
      const primary = index === 0;
      const registrationClosed = capacity > 0 && roster.length >= capacity;
      return {
        id: `${classId}-${session.type}-${session.index + 1}`,
        eventId: classId,
        title: `${record.title} - ${session.label}`,
        date: session.date,
        endDate: session.date,
        time: session.startTime,
        endTime: session.endTime,
        type: "Training",
        status: getEffectiveRecordStatus(record) || "scheduled",
        location: session.location,
        summary: description,
        registrationEnabled: primary && capacity > 0,
        registrationClosed: primary && (Boolean(extras.registrationClosed) || registrationClosed),
        registrationCapacity: primary ? capacity : 0,
        registrationEmailSubject: primary ? registrationEmailSubject : "",
        registrationEmailUseTemplate: primary && registrationEmailUseTemplate,
        registrationEmailTemplateId: primary ? registrationEmailTemplateId : "",
        registrationEmailIsHtml: primary && registrationEmailIsHtml,
        registrationEmailContent: primary ? registrationEmailContent : "",
        registrationEmailUseFullHtml: primary && registrationEmailUseFullHtml,
        registrationEmailFullHtml: primary ? registrationEmailFullHtml : "",
        ctaLabel: primary ? "Register For Class" : "",
        ctaHref: "",
        managementClassId: classId,
        managementClassSessionType: session.type,
        managementClassSessionIndex: session.index + 1,
        managementClassPrimary: primary,
        managementClassRoster: roster,
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
    renderRecords();
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
    if (record.recordType === "inquiry" && !getInquiryContactIds(record).length) {
      setStatus(recordStatus, "Choose at least one contact for this inquiry.", "error");
      return;
    }
    if (isSiteBackedManagementRecord(record)) {
      try {
        const saved = await saveSiteEventRecord(record);
        fillForm(saved);
        setStatus(recordStatus, "Saved to site calendar.", "success");
        renderRecords();
        closeEditorModal();
      } catch (error) {
        setStatus(recordStatus, error && error.message ? error.message : "Could not save site calendar record.", "error");
      }
      return;
    }
    if (record.recordType === "trip" && !record.id) {
      try {
        const saved = await createSiteEventRecord(record);
        fillForm(saved);
        setStatus(recordStatus, "Calendar item added to site calendar.", "success");
        renderRecords();
        closeEditorModal();
      } catch (error) {
        setStatus(recordStatus, error && error.message ? error.message : "Could not add site calendar record.", "error");
      }
      return;
    }
    if (record.recordType === "trip") {
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
        closeEditorModal();
        return;
      } catch (error) {
        fillForm(saved);
        setStatus(recordStatus, error && error.message ? error.message : "Saved, but class dates did not sync.", "error");
        return;
      }
    }
    fillForm(saved);
    setStatus(recordStatus, "Saved.", "success");
    closeEditorModal();
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

  function refreshSiteEventState(payload) {
    state.eventsPayload = payload || state.eventsPayload;
    state.allSiteEvents = expandSiteEventPayload(state.eventsPayload).filter((entry) =>
      ["class", "trip"].includes(classifySiteEvent(entry))
    );
    state.siteEvents = state.allSiteEvents;
    state.allRegistrationSnapshots = [];
    state.allRegistrationsLoaded = false;
    updateMetrics();
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

  async function publishSiteEventPayload(errorMessage) {
    if (state.eventsPayload) state.eventsPayload.updated = todayKey();
    const resp = await apiFetch(adminEventsUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: state.eventsPayload }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (!resp || !resp.ok) throw new Error(data.error || errorMessage || "Could not save site calendar.");
    refreshSiteEventState(data.payload || state.eventsPayload);
    return data.payload || state.eventsPayload;
  }

  async function createSiteEventRecord(record) {
    if (!state.eventsPayload) {
      await loadSiteCalendar({ silent: true });
    }
    if (!state.eventsPayload) throw new Error("Could not load site calendar.");
    if (!Array.isArray(state.eventsPayload.events)) state.eventsPayload.events = [];
    const extras = getExtras(record);
    const startDate = normalizeSiteText(extras.startDate);
    if (!startDate) throw new Error("Start date is required for new calendar items.");
    const endDate = normalizeSiteText(extras.endDate) || startDate;
    const id = getUniqueSiteEventId(record.title, startDate);
    const capacity = Math.max(0, Math.trunc(Number(extras.capacity || 0) || 0));
    const item = {
      id,
      eventId: slugify(record.title, id),
      title: record.title,
      date: startDate,
      endDate: endDate >= startDate ? endDate : startDate,
      time: normalizeSiteText(extras.startTime),
      endTime: normalizeSiteText(extras.endTime),
      type: normalizeSiteText(extras.eventTag) || "Training",
      status: normalizeSiteText(record.status) || "scheduled",
      location: normalizeSiteText(extras.eventLocation),
      summary: normalizeSiteText(record.notes),
      registrationEnabled: Boolean(extras.registrationEnabled),
      registrationClosed: Boolean(extras.registrationClosed),
      registrationCapacity: capacity,
      registrationEmailSubject: normalizeSiteText(extras.registrationEmailSubject),
      registrationEmailUseTemplate: Boolean(extras.registrationEmailUseTemplate),
      registrationEmailTemplateId: normalizeSiteText(extras.registrationEmailTemplateId),
      registrationEmailIsHtml: Boolean(extras.registrationEmailIsHtml),
      registrationEmailContent: normalizeSiteText(extras.registrationEmailContent),
      registrationEmailUseFullHtml: Boolean(extras.registrationEmailUseFullHtml),
      registrationEmailFullHtml: normalizeSiteText(extras.registrationEmailFullHtml),
      ctaLabel: extras.registrationEnabled ? "Register For Event" : "",
      ctaHref: "",
      managementPriority: normalizeSiteText(record.priority),
      managementOwner: normalizeSiteText(record.owner),
      managementContactName: normalizeSiteText(record.contactName),
      managementContactEmail: normalizeSiteText(record.contactEmail),
      managementContactPhone: normalizeSiteText(record.contactPhone),
      managementDueDate: normalizeSiteText(record.dueDate),
      managementAmountOwed: normalizeSiteText(extras.amountOwed),
      managementAmountPaid: normalizeSiteText(extras.amountPaid),
      managementNextStep: normalizeSiteText(extras.nextStep),
      managementNotes: normalizeSiteText(record.notes),
    };
    state.eventsPayload.events = [...state.eventsPayload.events, item]
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    await publishSiteEventPayload("Could not add site calendar record.");
    const refreshed = state.siteEvents.find((entry) => getSiteEventKey(entry) === [id, startDate].join("|"));
    return buildManagementRecordFromSiteEvent(refreshed || { ...item, sourceId: id, eventKind: "event" });
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
    item.registrationClosed = Boolean(extras.registrationClosed);
    item.registrationCapacity = Math.max(0, Math.trunc(Number(extras.capacity || item.registrationCapacity || 0) || 0));
    item.registrationEmailSubject = extras.registrationEmailSubject || "";
    item.registrationEmailUseTemplate = Boolean(extras.registrationEmailUseTemplate);
    item.registrationEmailTemplateId = extras.registrationEmailTemplateId || "";
    item.registrationEmailIsHtml = Boolean(extras.registrationEmailIsHtml);
    item.registrationEmailContent = extras.registrationEmailContent || "";
    item.registrationEmailUseFullHtml = Boolean(extras.registrationEmailUseFullHtml);
    item.registrationEmailFullHtml = extras.registrationEmailFullHtml || "";
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

    await publishSiteEventPayload("Could not save site calendar.");
    const updatedEventDate = match.listName === "events" ? item.date : (extras.eventDate || extras.startDate || item.startDate);
    const refreshed = state.siteEvents.find((entry) => getSiteEventKey(entry) === [extras.sourceId || "", updatedEventDate || ""].join("|"));
    return buildManagementRecordFromSiteEvent(refreshed || item);
  }

  async function deleteSiteEventRecord(record) {
    const match = findSiteEventPayloadItem(record);
    if (!match) throw new Error("Site calendar item was not found.");
    const extras = getExtras(record);
    const list = Array.isArray(state.eventsPayload && state.eventsPayload[match.listName])
      ? state.eventsPayload[match.listName]
      : [];
    if (match.listName === "templates" && extras.eventDate) {
      const excluded = Array.isArray(match.item.excludedDates) ? match.item.excludedDates : [];
      match.item.excludedDates = Array.from(new Set([...excluded, extras.eventDate])).sort();
      await publishSiteEventPayload("Could not delete site calendar record.");
      return;
    }
    state.eventsPayload[match.listName] = list.filter((entry) => {
      if (!entry || String(entry.id || "").trim() !== String(match.item.id || "").trim()) return true;
      if (match.listName === "templates") return false;
      return String(entry.date || "").trim() !== String(extras.eventDate || "").trim();
    });
    await publishSiteEventPayload("Could not delete site calendar record.");
  }

  async function openCalendarRecord(indexValue) {
    const index = Number(indexValue);
    const item = Number.isFinite(index) ? state.siteEvents[index] : null;
    if (!item) return;
    const classId = normalizeSiteText(item.managementClassId);
    if (classId) {
      const classRecord = getClassRecordByClassId(classId);
      if (classRecord) {
        openEditor(classRecord);
        setStatus(recordStatus, "Class record opened for this calendar date.", "success");
        return;
      }
    }
    openEditor(buildManagementRecordFromSiteEvent(item));
    setStatus(recordStatus, "Site calendar record opened.", "success");
  }

  function openRegistrationTarget(actionKey) {
    const entry = findAllRegistrationEntry(actionKey);
    const context = entry && entry.context;
    if (!context) return;
    const classRecord = getRegistrationContextClassRecord(context);
    if (classRecord) {
      openEditor(classRecord);
      if (classRosterEl) classRosterEl.open = true;
      setStatus(recordStatus, "Class roster opened for this registration.", "success");
      return;
    }
    const index = state.siteEvents.findIndex((item) =>
      normalizeSiteText(item && (item.sourceId || item.id)) === normalizeSiteText(context.sourceId) &&
      normalizeSiteText(item && item.date) === normalizeSiteText(context.eventDate)
    );
    if (index >= 0) {
      openCalendarRecord(String(index));
      return;
    }
    setStatus(recordStatus, "Could not find the matching event for this registration.", "error");
  }

  async function deleteSelectedRecord() {
    const id = state.selectedId;
    if (!id) return;
    const activeSiteRecord = state.activeSiteRecord && state.activeSiteRecord.id === id ? state.activeSiteRecord : null;
    if (activeSiteRecord) {
      const name = activeSiteRecord.title || "this calendar item";
      if (!window.confirm(`Delete calendar record "${name}" from the site calendar?`)) return;
      setStatus(recordStatus, "Deleting calendar record...");
      try {
        await deleteSiteEventRecord(activeSiteRecord);
        fillForm();
        closeEditorModal();
        renderRecords();
        setStatus(recordStatus, "Calendar record deleted.", "success");
      } catch (error) {
        setStatus(recordStatus, error && error.message ? error.message : "Could not delete site calendar record.", "error");
      }
      return;
    }
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
    closeEditorModal();
    setStatus(recordStatus, "Deleted.", "success");
  }

  async function updateRecordStatus(id, status) {
    const record = state.records.find((item) => item.id === id);
    if (!record || (record.status === status && getEffectiveRecordStatus(record) === status)) return;
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
    const redirectTo = new URLSearchParams(window.location.search).get("redirect");
    if (redirectTo && redirectTo.startsWith("/")) {
      window.location.href = redirectTo;
      return;
    }
    showAuthed(true);
    await loadRecords();
    await loadSiteCalendar();
  }

  async function copyTextValue(value, fallbackField = null) {
    const text = String(value || "").trim();
    if (!text) {
      setStatus(recordStatus, "Nothing to copy.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus(recordStatus, "Copied.", "success");
    } catch (_error) {
      const field = fallbackField || document.createElement("textarea");
      if (!fallbackField) {
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.left = "-9999px";
        document.body.appendChild(field);
      }
      field.focus();
      field.select();
      const copied = document.execCommand && document.execCommand("copy");
      if (!fallbackField) field.remove();
      setStatus(recordStatus, copied ? "Copied." : "Copy failed.", copied ? "success" : "error");
    }
  }

  async function copyFieldValue(fieldName) {
    const field = recordForm && recordForm.elements[fieldName];
    if (!field) return;
    const value = String(field.value || "").trim();
    if (!value) {
      setStatus(recordStatus, "Nothing to copy.", "error");
      return;
    }
    copyTextValue(value, field);
  }

  function duplicateRecord() {
    const id = state.selectedId;
    const record = id ? state.records.find((r) => r.id === id) : null;
    if (!record) return;
    const extras = getExtras(record);
    const copy = {
      ...record,
      id: "",
      title: record.recordType === "contact" ? record.title : `Copy of ${record.title}`,
      extras: {
        ...extras,
        firstName: record.recordType === "contact" ? extras.firstName : extras.firstName,
      },
      pinned: false,
    };
    fillForm(copy);
    if (editorTitle) editorTitle.textContent = `Duplicate: ${record.title}`;
  }

  async function quickAddTask(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector("[data-quick-task-input]");
    const title = input ? String(input.value || "").trim() : "";
    if (!title) return;
    const record = {
      id: "",
      recordType: "task",
      title,
      status: "new",
      priority: "normal",
      owner: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      dueDate: "",
      relatedEvent: "",
      notes: "",
      extras: {},
    };
    form.classList.add("is-loading");
    try {
      await saveRecordPayload(record);
      if (input) input.value = "";
      renderRecords();
    } catch (err) {
      setStatus(recordStatus, (err && err.message) || "Could not add task.", "error");
    } finally {
      form.classList.remove("is-loading");
    }
  }

  function insertTimestamp() {
    const notesField = recordForm && recordForm.elements.notes;
    if (!notesField) return;
    const stamp = `\n--- ${formatDate(todayKey())} ---\n`;
    const pos = notesField.selectionStart || notesField.value.length;
    notesField.value = notesField.value.slice(0, pos) + stamp + notesField.value.slice(pos);
    notesField.focus();
    notesField.selectionStart = notesField.selectionEnd = pos + stamp.length;
  }

  async function togglePin(id) {
    const record = state.records.find((r) => r.id === id);
    if (!record) return;
    const next = { ...record, pinned: !record.pinned };
    try {
      const saved = await saveRecordPayload(next);
      if (state.selectedId === id) {
        const duplicateButton = app.querySelector("[data-duplicate-record]");
        if (deleteButton) deleteButton.hidden = !saved.id;
        if (duplicateButton) duplicateButton.hidden = !saved.id || Boolean(state.activeSiteRecord);
      }
      renderRecords();
    } catch (err) {
      setStatus(recordStatus, (err && err.message) || "Could not update pin.", "error");
    }
  }

  function bindEvents() {
    if (loginForm) loginForm.addEventListener("submit", login);
    if (recordForm) recordForm.addEventListener("submit", saveRecord);
    if (recordForm) {
      recordForm.addEventListener("input", (event) => {
        const name = event.target && event.target.name;
        if (name === "registrationEmailSubject" || name === "registrationEmailContent") {
          updateCharacterCounter(name);
        }
      });
    }
    if (recordForm && recordForm.elements.recordType) {
      recordForm.elements.recordType.addEventListener("change", () => {
        applyTypeConfig(recordForm.elements.recordType.value || "contact", Boolean(state.selectedId));
        if (recordForm.elements.recordType.value === "class" && classScheduleEl) renderClassSchedule(readClassSessions());
        renderInquiryContactManager({ recordType: recordForm.elements.recordType.value || "contact", extras: { inquiryContactIds: getSelectedInquiryContactIds() } });
        updateRegistrationEmailCounters();
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
    const addClassContactButton = app.querySelector("[data-add-class-contact]");
    if (addClassContactButton) addClassContactButton.addEventListener("click", addSelectedContactToClass);
    const addContactClassesButton = app.querySelector("[data-add-contact-classes]");
    if (addContactClassesButton) addContactClassesButton.addEventListener("click", addClassesToContact);
    if (contactClassList) {
      contactClassList.addEventListener("click", async (event) => {
        const toggleButton = event.target.closest("[data-toggle-contact-class]");
        if (toggleButton) {
          await toggleContactClassStatus(toggleButton.getAttribute("data-toggle-contact-class") || "");
          return;
        }
        const removeButton = event.target.closest("[data-remove-contact-class]");
        if (removeButton) {
          await removeClassFromContact(removeButton.getAttribute("data-remove-contact-class") || "");
        }
      });
    }
    if (refreshClassRegistrationsButton) refreshClassRegistrationsButton.addEventListener("click", loadClassRegistrationEscrow);
    if (classContactList) {
      classContactList.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-remove-class-contact]");
        if (!button) return;
        const removeId = button.getAttribute("data-remove-class-contact") || "";
        const classRecord = getActiveClassRecord();
        await removeContactEnrollmentFromClass(removeId);
        await syncClassCalendarAfterRosterChange(classRecord, "Contact removed from this class.");
      });
    }
    if (inquiryContactSearch) {
      inquiryContactSearch.addEventListener("input", () => {
        renderInquiryContactManager({ recordType: "inquiry", extras: { inquiryContactIds: getSelectedInquiryContactIds() } });
      });
    }
    if (inquiryContactSelect) inquiryContactSelect.addEventListener("change", syncInquiryContactSelectedList);
    if (inquiryContactList) {
      inquiryContactList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-inquiry-contact]");
        if (!button || !inquiryContactSelect) return;
        const removeId = button.getAttribute("data-remove-inquiry-contact") || "";
        Array.from(inquiryContactSelect.options).forEach((option) => {
          if (option.value === removeId) option.selected = false;
        });
        syncInquiryContactSelectedList();
      });
    }
    if (classRegistrationList) {
      classRegistrationList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-convert-registration]");
        if (!button) return;
        convertRegistrationToContact(button.getAttribute("data-convert-registration") || "");
      });
    }
    app.querySelectorAll("[data-copy-field]").forEach((button) => {
      button.addEventListener("click", () => copyFieldValue(button.getAttribute("data-copy-field") || ""));
    });
    if (deleteButton) deleteButton.addEventListener("click", deleteSelectedRecord);
    const duplicateButton = app.querySelector("[data-duplicate-record]");
    if (duplicateButton) duplicateButton.addEventListener("click", duplicateRecord);
    const timestampButton = app.querySelector("[data-insert-timestamp]");
    if (timestampButton) timestampButton.addEventListener("click", insertTimestamp);
    const quickAddForm = app.querySelector("[data-quick-add-task]");
    if (quickAddForm) quickAddForm.addEventListener("submit", quickAddTask);
    if (refreshCalendarButton) refreshCalendarButton.addEventListener("click", () => loadSiteCalendar());
    if (showPastCalendarToggle) showPastCalendarToggle.addEventListener("change", renderRecords);
    openManagementCalendarButtons.forEach((button) => {
      button.addEventListener("click", openManagementCalendarList);
    });
    openHomeTickerButtons.forEach((button) => {
      button.addEventListener("click", openHomeTickerModal);
    });
    siteStudioTabs.forEach((button) => {
      button.addEventListener("click", () => {
        openSiteStudioPanel(button.getAttribute("data-site-studio-tab") || "operations");
      });
    });
    siteStudioOpenButtons.forEach((button) => {
      button.addEventListener("click", () => {
        openSiteStudioPanel(button.getAttribute("data-site-studio-open") || "operations");
      });
    });
    closeHomeTickerButtons.forEach((button) => {
      button.addEventListener("click", closeHomeTickerModal);
    });
    if (homeTickerModal) {
      homeTickerModal.addEventListener("click", (event) => {
        if (event.target === homeTickerModal) closeHomeTickerModal();
      });
    }
    if (homeTickerForm) homeTickerForm.addEventListener("submit", saveHomeTicker);
    if (refreshRegistrationsButton) refreshRegistrationsButton.addEventListener("click", () => loadRegistrationSnapshot());
    if (registrationList) {
      registrationList.addEventListener("click", (event) => {
        const resendButton = event.target.closest("[data-resend-event-registration-email]");
        if (resendButton) {
          resendActiveRegistrationEmail(resendButton.getAttribute("data-resend-event-registration-email") || "");
          return;
        }
        const approveButton = event.target.closest("[data-approve-event-registration]");
        if (approveButton) {
          approveEventRegistration(approveButton.getAttribute("data-approve-event-registration") || "");
          return;
        }
        const convertButton = event.target.closest("[data-convert-event-registration]");
        if (convertButton) {
          convertEventRegistrationToContact(convertButton.getAttribute("data-convert-event-registration") || "");
          return;
        }
        const removeButton = event.target.closest("[data-remove-registration]");
        if (!removeButton) return;
        removeRegistration(removeButton.getAttribute("data-remove-registration") || "");
      });
    }
    app.querySelectorAll("[data-new-record]").forEach((button) => {
      button.addEventListener("click", () => openEditor(null, getDefaultNewRecordType()));
    });
    if (cancelEditButton) cancelEditButton.addEventListener("click", closeEditorModal);
    if (floatingSaveButton) {
      floatingSaveButton.addEventListener("click", () => recordForm?.requestSubmit());
    }
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
        closeEditorModal();
        renderRecords();
        showAuthed(false);
      });
    }
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value || "";
        state.focusScope = "";
        renderRecords();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        state.sortBy = sortSelect.value || "newest";
        renderRecords();
      });
    }
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.filterType = button.getAttribute("data-filter-type") || "all";
        state.focusScope = "";
        filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
        renderRecords();
        if (state.filterType === "registration" || state.filterType === "class") loadAllRegistrationSnapshots();
      });
    });
    app.addEventListener("dmzManagementFocus", (event) => {
      const scope = String((event && event.detail && event.detail.scope) || "").trim();
      if (!scope) return;
      state.focusScope = scope;
      state.filterType = "all";
      state.search = "";
      if (searchInput) searchInput.value = "";
      if (scope === "open_balance") state.sortBy = "balance";
      else if (scope === "overdue" || scope === "due_today") state.sortBy = "due";
      if (sortSelect) sortSelect.value = state.sortBy;
      filterButtons.forEach((item) => {
        item.classList.toggle("is-active", (item.getAttribute("data-filter-type") || "") === "all");
      });
      openSiteStudioPanel("operations");
      renderRecords();
      if (recordList) recordList.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (recordList) {
      recordList.addEventListener("click", (event) => {
        const addRegistrationButton = event.target.closest("[data-add-registration-contact]");
        if (addRegistrationButton) {
          event.preventDefault();
          event.stopPropagation();
          addRegistrationCardToContacts(addRegistrationButton.getAttribute("data-add-registration-contact") || "");
          return;
        }
        const approveRegistrationButton = event.target.closest("[data-approve-registration]");
        if (approveRegistrationButton) {
          event.preventDefault();
          event.stopPropagation();
          approveRegistrationCard(approveRegistrationButton.getAttribute("data-approve-registration") || "");
          return;
        }
        const openRegistrationButton = event.target.closest("[data-open-registration-target]");
        if (openRegistrationButton) {
          event.preventDefault();
          event.stopPropagation();
          openRegistrationTarget(openRegistrationButton.getAttribute("data-open-registration-target") || "");
          return;
        }
        const unregisterButton = event.target.closest("[data-unregister-card]");
        if (unregisterButton) {
          event.preventDefault();
          event.stopPropagation();
          unregisterFromRegistrationCard(unregisterButton.getAttribute("data-unregister-card") || "");
          return;
        }
        const resendRegistrationButton = event.target.closest("[data-resend-registration-email]");
        if (resendRegistrationButton) {
          event.preventDefault();
          event.stopPropagation();
          resendRegistrationCardEmail(resendRegistrationButton.getAttribute("data-resend-registration-email") || "");
          return;
        }
        const eventAlertButton = event.target.closest("[data-event-alert-index]");
        if (eventAlertButton) {
          event.preventDefault();
          event.stopPropagation();
          sendEventAlertForCalendarIndex(eventAlertButton.getAttribute("data-event-alert-index") || "");
          return;
        }
        const pinButton = event.target.closest("[data-pin-record]");
        if (pinButton) {
          event.preventDefault();
          event.stopPropagation();
          togglePin(pinButton.getAttribute("data-pin-record") || "");
          return;
        }
        const copyButton = event.target.closest("[data-copy-record]");
        if (copyButton) {
          event.preventDefault();
          event.stopPropagation();
          copyTextValue(copyButton.getAttribute("data-copy-record") || "");
          return;
        }
        const statusSelect = event.target.closest("[data-status-change]");
        if (statusSelect) {
          event.stopPropagation();
          updateRecordStatus(statusSelect.getAttribute("data-status-change"), statusSelect.value);
          return;
        }
        const detailToggle = event.target.closest(".management-record-details");
        if (detailToggle) {
          event.stopPropagation();
          return;
        }
        const calendarAction = event.target.closest(".management-calendar-actions a");
        if (calendarAction) {
          event.stopPropagation();
          return;
        }
        const calendarCard = event.target.closest("[data-calendar-index]");
        if (calendarCard) {
          openCalendarRecord(calendarCard.getAttribute("data-calendar-index") || "");
          return;
        }
        const card = event.target.closest("[data-record-id]");
        if (!card) return;
        const id = card.getAttribute("data-record-id") || "";
        const record = state.records.find((item) => item.id === id);
        if (record) openEditor(record);
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (homeTickerModal && !homeTickerModal.hidden) {
          closeHomeTickerModal();
          return;
        }
        if (app.classList.contains("is-editor-open")) closeEditorModal();
        return;
      }
      if (isInputFocused()) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openEditor(null, getDefaultNewRecordType());
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        if (searchInput) { searchInput.focus(); searchInput.select(); }
        return;
      }
    });
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
