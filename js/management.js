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
  const sortSelect = app.querySelector("[data-sort-records]");
  const loginStatus = app.querySelector("[data-login-status]");
  const recordStatus = app.querySelector("[data-record-status]");
  const editorTitle = app.querySelector("[data-editor-title]");
  const deleteButton = app.querySelector("[data-delete-record]");
  const cancelEditButton = app.querySelector("[data-cancel-edit]");
  const filterButtons = Array.from(app.querySelectorAll("[data-filter-type]"));
  const calendarStatus = app.querySelector("[data-calendar-status]");
  const refreshCalendarButton = app.querySelector("[data-refresh-calendar]");
  const showPastCalendarToggle = app.querySelector("[data-show-past-calendar]");
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
  const classRegistrationSummary = app.querySelector("[data-class-registration-summary]");
  const classRegistrationList = app.querySelector("[data-class-registration-list]");
  const refreshClassRegistrationsButton = app.querySelector("[data-refresh-class-registrations]");
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
  const closedStatuses = new Set(["complete", "archived", "dead_end", "not_fit"]);
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
        "contactName",
        "contactEmail",
        "contactPhone",
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
    registrationConvertingId: "",
    classRegistrationSnapshot: null,
    classRegistrationLoading: false,
    classConvertingRegistrationId: "",
    filterType: "all",
    sortBy: "newest",
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

  function openEditorModal() {
    app.classList.add("is-editor-open");
    document.body.classList.add("management-editor-open");
  }

  function closeEditorModal() {
    app.classList.remove("is-editor-open");
    document.body.classList.remove("management-editor-open");
    setStatus(recordStatus, "");
  }

  function openEditor(record = null) {
    fillForm(record);
    openEditorModal();
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

  function renderClassRecordDetails(record) {
    if (!record || record.recordType !== "class") return "";
    const details = getClassSummaryDetails(record);
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
        </div>
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

  function renderInquiryRecordDetails(record) {
    if (!record || record.recordType !== "inquiry") return "";
    const extras = getExtras(record);
    const balance = getBalance(record);
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
          ["Primary Contact", record.contactName],
          ["Email", record.contactEmail],
          ["Phone", record.contactPhone],
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

  function renderSiteCalendarCard(item, sourceIndex, isPast) {
    const recordType = classifySiteEvent(item);
    const dateText = [formatDate(item.date), item.endDate && item.endDate !== item.date ? formatDate(item.endDate) : ""]
      .filter(Boolean)
      .join(" - ");
    const timeText = item.time ? (item.endTime ? `${item.time} - ${item.endTime}` : item.time) : "";
    const spotsText = item.registrationCapacity ? `${item.registrationCapacity} spots` : "No cap set";
    const registrationText = item.registrationEnabled ? "Registration open" : "Registration off";
    const summary = normalizeSiteText(item.summary);
    const statItems = [
      ["Date", dateText || "No date"],
      ["Time", timeText || "No time set"],
      ["Location", item.location || "No location set"],
      ["Capacity", spotsText],
      ["Registration", registrationText],
    ];
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
            ${item.registrationEnabled ? '<span class="management-badge is-complete">Registration</span>' : ""}
            ${isPast ? '<span class="management-badge is-waiting">Past</span>' : ""}
          </div>
          <h3>${escapeHtml(item.title || "Scheduled Event")}</h3>
          <div class="management-calendar-stat-grid">
            ${statItems.map(([label, value]) => `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`).join("")}
          </div>
          ${summary ? `<p>${escapeHtml(summary.length > 220 ? `${summary.slice(0, 220)}...` : summary)}</p>` : ""}
        </div>
        <div class="management-calendar-actions">
          <button type="button" data-calendar-open="${sourceIndex}">Open Record</button>
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
      .filter((record) => state.filterType === "all" || record.recordType === state.filterType)
      .filter(recordMatchesSearch)
      .slice()
      .sort(compareVisibleRecords);
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
        const isContact = record.recordType === "contact";
        const extras = getExtras(record);
        const balance = getBalance(record);
        const contactEnrollments = isContact ? getContactClassEnrollments(record) : [];
        const meta = isContact
          ? [
              extras.source ? `Source: ${extras.source}` : "",
              extras.certification ? `Certification: ${extras.certification}` : "",
              contactEnrollments.length ? `${contactEnrollments.length} class${contactEnrollments.length === 1 ? "" : "es"}` : "",
            ].filter(Boolean)
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
        const summary = record.recordType === "class" ? "" : (note.length > 180 ? `${note.slice(0, 180)}...` : note);
        const classDetails = record.recordType === "class" ? renderClassRecordDetails(record) : "";
        const contactDetails = record.recordType === "contact" ? renderContactRecordDetails(record) : "";
        const inquiryDetails = record.recordType === "inquiry" ? renderInquiryRecordDetails(record) : "";
        const contactCopy =
          record.recordType === "contact"
            ? `<div class="management-contact-card-lines">
                ${renderContactCopyLine("Email", record.contactEmail, "email")}
                ${renderContactCopyLine("Phone", record.contactPhone, "phone")}
              </div>`
            : "";
        return `
          <article class="management-record ${isContact ? "is-contact" : ""} ${record.recordType === "class" ? "is-class" : ""} ${record.id === state.selectedId ? "is-selected" : ""}" data-record-id="${escapeHtml(record.id)}">
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
              ${contactCopy}
              ${meta.length ? `<div class="management-record-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
              ${classDetails}
              ${contactDetails}
              ${inquiryDetails}
            </div>
            ${
              record.recordType === "contact"
                ? ""
                : `<div class="management-record-actions">
              <select data-status-change="${escapeHtml(record.id)}" aria-label="Change status for ${escapeHtml(record.title)}">
                ${getStatusOptions(record.recordType)
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
        const alreadyContact = registrantEmail && contactEmails.has(registrantEmail);
        return `
          <div class="management-registration-item">
            <div>
              <strong>${escapeHtml(normalizeSiteText(registrant && registrant.name) || "Unnamed registrant")}</strong>
              <span>${escapeHtml(details.join(" | "))}</span>
            </div>
            <div class="management-registration-actions">
              <button type="button" data-convert-event-registration="${escapeHtml(registrantId)}" ${!registrantId || alreadyContact || converting || state.registrationLoading ? "disabled" : ""}>${alreadyContact ? "Added" : converting ? "Adding..." : "Add Contact"}</button>
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
    setStatus(recordStatus, "Registration removed.", "success");
    renderRegistrationManager();
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
    const registrants = Array.isArray(snapshot && snapshot.registrants) ? snapshot.registrants : [];
    classRegistrationSummary.textContent = snapshot
      ? `${registrants.length} registration${registrants.length === 1 ? "" : "s"} waiting for review.`
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
      const alreadyAdded = enrolledRegistrationIds.has(id);
      const busy = id && id === state.classConvertingRegistrationId;
      const details = [
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
          <button type="button" data-convert-registration="${escapeHtml(id)}" ${alreadyAdded || busy ? "disabled" : ""}>${alreadyAdded ? "Added" : busy ? "Adding..." : "Add Contact"}</button>
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

  async function enrollContactInClass(contact, source = "in_house", sourceRegistrationId = "") {
    const current = state.selectedId ? state.records.find((item) => item.id === state.selectedId) : null;
    if (!current || current.recordType !== "class") {
      setStatus(recordStatus, "Save or open a class before adding contacts.", "error");
      return null;
    }
    if (!contact || !contact.id) return null;
    const classId = slugify(getExtras(current).classId || current.id || current.title, "class");
    const existingEnrollments = getContactClassEnrollments(contact);
    if (existingEnrollments.some((entry) => normalizeSiteText(entry && entry.classId) === classId)) {
      setStatus(recordStatus, "Contact is already enrolled in this class.", "error");
      return contact;
    }
    const saved = await updateContactRecord(contact, {
      registrationSource: source === "self_registered" ? "self_registered" : (getExtras(contact).registrationSource || "in_house"),
      classEnrollments: [
        ...existingEnrollments,
        {
          classId,
          classRecordId: current.id,
          classTitle: current.title,
          source,
          status: "enrolled",
          sourceRegistrationId,
          enrolledAt: new Date().toISOString(),
        },
      ],
    });
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
    setStatus(recordStatus, `${classIds.length} class${classIds.length === 1 ? "" : "es"} added to contact.`, "success");
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
    setStatus(recordStatus, "Class removed from this contact.", "success");
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

  async function addSelectedContactToClass() {
    const contactId = classContactSelect ? classContactSelect.value : "";
    const contact = state.records.find((record) => record.id === contactId && record.recordType === "contact");
    if (!contact) {
      setStatus(recordStatus, "Choose a contact to add.", "error");
      return;
    }
    await enrollContactInClass(contact, "in_house");
    setStatus(recordStatus, "Contact enrolled in class.", "success");
  }

  async function convertRegistrationToContact(registrationId) {
    const classRecord = getActiveClassRecord();
    const registrants = Array.isArray(state.classRegistrationSnapshot && state.classRegistrationSnapshot.registrants)
      ? state.classRegistrationSnapshot.registrants
      : [];
    const registrant = registrants.find((item) => normalizeSiteText(item && item.id) === normalizeSiteText(registrationId));
    if (!registrant || !classRecord) return;
    state.classConvertingRegistrationId = normalizeSiteText(registrationId);
    renderClassRegistrationEscrow(classRecord);
    const contact = await saveRegistrantAsContact(registrant, "Created from class registration escrow.");
    state.classConvertingRegistrationId = "";
    await enrollContactInClass(contact, "self_registered", normalizeSiteText(registrationId));
    setStatus(recordStatus, "Registration imported as a contact and enrolled in class.", "success");
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
    if (calendarStatus) {
      const upcomingCount = state.siteEvents.filter((item) => String(item.date || "") >= todayKey()).length;
      const pastCount = Math.max(0, state.siteEvents.length - upcomingCount);
      calendarStatus.textContent = state.siteEvents.length
        ? `${upcomingCount} upcoming site calendar records${pastCount ? `, ${pastCount} past hidden` : ""}.`
        : "No records are currently published in the site calendar.";
    }
    renderRecords();
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
        openEditor(classRecord);
        setStatus(recordStatus, "Class record opened for this calendar date.", "success");
        return;
      }
    }
    openEditor(buildManagementRecordFromSiteEvent(item));
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
    closeEditorModal();
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
        await removeContactEnrollmentFromClass(removeId);
        setStatus(recordStatus, "Contact removed from this class.", "success");
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
    if (refreshCalendarButton) refreshCalendarButton.addEventListener("click", () => loadSiteCalendar());
    if (showPastCalendarToggle) showPastCalendarToggle.addEventListener("change", renderRecords);
    if (refreshRegistrationsButton) refreshRegistrationsButton.addEventListener("click", () => loadRegistrationSnapshot());
    if (registrationList) {
      registrationList.addEventListener("click", (event) => {
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
      button.addEventListener("click", () => openEditor());
    });
    if (cancelEditButton) cancelEditButton.addEventListener("click", closeEditorModal);
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
        filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
        renderRecords();
      });
    });
    if (recordList) {
      recordList.addEventListener("click", (event) => {
        const copyButton = event.target.closest("[data-copy-record]");
        if (copyButton) {
          event.preventDefault();
          event.stopPropagation();
          copyTextValue(copyButton.getAttribute("data-copy-record") || "");
          return;
        }
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
        const detailToggle = event.target.closest(".management-record-details");
        if (detailToggle) {
          event.stopPropagation();
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
      if (event.key === "Escape" && app.classList.contains("is-editor-open")) {
        closeEditorModal();
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
