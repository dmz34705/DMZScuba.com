(() => {
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const managementUrl = apiRoot ? `${apiRoot}/api/admin/management` : "/api/admin/management";
  const eventsUrl = apiRoot ? `${apiRoot}/api/v2/events` : "/api/v2/events";
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
  const calendarItemsEl = app.querySelector("[data-calendar-items]");
  const calendarStatus = app.querySelector("[data-calendar-status]");
  const refreshCalendarButton = app.querySelector("[data-refresh-calendar]");
  const extraFieldsSection = app.querySelector(".management-extra-fields");
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
      certificationLabel: "Course / Certification",
      notesLabel: "Class Roster / Progress Notes",
      notesPlaceholder: "Students, forms, eLearning status, pool/open-water dates, payments owed, gear needs...",
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
        "startDate",
        "endDate",
        "capacity",
        "certification",
        "amountOwed",
        "amountPaid",
        "nextStep",
        "notes",
      ],
    },
    trip: {
      editor: "Scheduled Trip",
      newTitle: "New Scheduled Trip",
      titleLabel: "Trip Name",
      titlePlaceholder: "Cozumel 2026",
      relatedLabel: "Destination or Trip Page",
      capacityLabel: "Trip Capacity",
      certificationLabel: "Recommended Level",
      notesLabel: "Trip Roster / Logistics Notes",
      notesPlaceholder: "Roster, deposits, rooming, flights, dive operator details, documents, balances owed...",
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
        "startDate",
        "endDate",
        "capacity",
        "certification",
        "amountOwed",
        "amountPaid",
        "nextStep",
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
    siteEvents: [],
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
    const title = normalizeSiteText(item && item.title).toLowerCase();
    const combined = `${type} ${title}`;
    if (combined.includes("travel") || combined.includes("trip") || combined.includes("local dive")) return "trip";
    return "class";
  }

  function getSiteEventKey(item) {
    return [item.sourceId || item.id || "", item.date || item.startDate || ""].join("|");
  }

  function getLinkedRecordForSiteEvent(item) {
    const key = getSiteEventKey(item);
    return state.records.find((record) => {
      const extras = getExtras(record);
      return extras.siteSource === "events" && [extras.sourceId || "", extras.eventDate || ""].join("|") === key;
    });
  }

  function expandSiteEventPayload(payload) {
    const now = new Date();
    const horizonMonths = Math.max(1, Math.min(60, Math.trunc(Number(payload && payload.horizonMonths) || 12)));
    const horizonEnd = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), horizonMonths);
    const explicit = Array.isArray(payload && payload.events) ? payload.events : [];
    const templates = Array.isArray(payload && payload.templates) ? payload.templates : [];
    const results = [];

    explicit.forEach((eventItem) => {
      if (!eventItem || !eventItem.date) return;
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
    const recordType = classifySiteEvent(item);
    const title = normalizeSiteText(item.title) || "Scheduled Event";
    const capacity = Math.max(0, Number(item.registrationCapacity || 0) || 0);
    const existingExtras = getExtras(existing);
    return {
      id: existing && existing.id ? existing.id : "",
      recordType,
      title,
      status: (existing && existing.status) || "scheduled",
      priority: (existing && existing.priority) || "normal",
      owner: (existing && existing.owner) || "",
      contactName: (existing && existing.contactName) || "",
      contactEmail: (existing && existing.contactEmail) || "",
      contactPhone: (existing && existing.contactPhone) || "",
      dueDate: (existing && existing.dueDate) || normalizeSiteText(item.date),
      relatedEvent: title,
      notes: (existing && existing.notes) || normalizeSiteText(item.summary),
      extras: {
        ...existingExtras,
        siteSource: "events",
        sourceId: normalizeSiteText(item.sourceId || item.id),
        eventId: normalizeSiteText(item.eventId || item.id),
        eventDate: normalizeSiteText(item.date),
        eventKind: normalizeSiteText(item.eventKind),
        startDate: normalizeSiteText(item.date),
        endDate: normalizeSiteText(item.endDate),
        capacity: capacity ? String(capacity) : existingExtras.capacity || "",
        certification: recordType === "class" ? title : existingExtras.certification || "",
        source: "Site calendar",
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
      extras.certification,
      extras.nextStep,
      extras.amountOwed,
      extras.amountPaid,
      extras.capacity,
      extras.siteSource,
      extras.sourceId,
      extras.eventDate,
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
    const openCount = state.records.filter(
      (record) => record.recordType !== "contact" && !["complete", "archived"].includes(record.status)
    ).length;
    const openBalance = state.records
      .filter((record) => record.recordType !== "contact" && !["complete", "archived"].includes(record.status))
      .reduce((sum, record) => sum + getBalance(record), 0);
    const byType = state.records.reduce((counts, record) => {
      counts[record.recordType] = (counts[record.recordType] || 0) + 1;
      return counts;
    }, {});
    if (metricEls.open) metricEls.open.textContent = String(openCount);
    if (metricEls.contact) metricEls.contact.textContent = String(byType.contact || 0);
    if (metricEls.inquiry) metricEls.inquiry.textContent = String(byType.inquiry || 0);
    if (metricEls.class) metricEls.class.textContent = String(byType.class || 0);
    if (metricEls.trip) metricEls.trip.textContent = String(byType.trip || 0);
    if (metricEls.owed) metricEls.owed.textContent = formatMoney(openBalance);
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
  }

  function renderCalendarItems() {
    if (!calendarItemsEl) return;
    if (!state.siteEvents.length) {
      calendarItemsEl.innerHTML = '<div class="management-empty">No upcoming site calendar classes or trips found.</div>';
      return;
    }
    calendarItemsEl.innerHTML = state.siteEvents
      .map((item, index) => {
        const recordType = classifySiteEvent(item);
        const linked = getLinkedRecordForSiteEvent(item);
        const dateText = [formatDate(item.date), item.endDate && item.endDate !== item.date ? formatDate(item.endDate) : ""]
          .filter(Boolean)
          .join(" - ");
        const meta = [
          formatLabel(recordType),
          item.type || "",
          dateText,
          item.registrationCapacity ? `${item.registrationCapacity} spots` : "",
          linked ? "Linked to management" : "",
        ].filter(Boolean);
        const eventUrl = `/pages/events/index.html?event=${encodeURIComponent(item.id || item.sourceId || "")}&date=${encodeURIComponent(item.date || "")}`;
        return `
          <article class="management-calendar-item" data-calendar-index="${index}">
            <div>
              <div class="management-record-badges">
                <span class="management-badge">${escapeHtml(formatLabel(recordType))}</span>
                ${linked ? '<span class="management-badge is-complete">Linked</span>' : ""}
              </div>
              <h3>${escapeHtml(item.title || "Scheduled Event")}</h3>
              <p>${escapeHtml(meta.join(" | "))}</p>
            </div>
            <div class="management-calendar-actions">
              <button type="button" data-calendar-sync="${index}">${linked ? "Sync Record" : "Create Record"}</button>
              ${linked ? `<button type="button" data-calendar-edit-record="${escapeHtml(linked.id)}">Open Record</button>` : ""}
              <a href="${escapeHtml(eventUrl)}" target="_blank" rel="noopener">View Site Event</a>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function readFormRecord() {
    const formData = new FormData(recordForm);
    const id = String(formData.get("id") || "").trim();
    const existing = id ? state.records.find((item) => item.id === id) : null;
    const existingExtras = getExtras(existing);
    const extras = {
      ...existingExtras,
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      stage: String(formData.get("stage") || "").trim(),
      source: String(formData.get("source") || "").trim(),
      startDate: String(formData.get("startDate") || "").trim(),
      endDate: String(formData.get("endDate") || "").trim(),
      capacity: String(formData.get("capacity") || "").trim(),
      certification: String(formData.get("certification") || "").trim(),
      amountOwed: String(formData.get("amountOwed") || "").trim(),
      amountPaid: String(formData.get("amountPaid") || "").trim(),
      nextStep: String(formData.get("nextStep") || "").trim(),
    };
    const recordType = String(formData.get("recordType") || "inquiry");
    const contactFullName = [extras.firstName, extras.lastName].filter(Boolean).join(" ").trim();
    const title = recordType === "contact" ? contactFullName : String(formData.get("title") || "").trim();
    const contactName =
      recordType === "contact" ? contactFullName : String(formData.get("contactName") || "").trim();
    const rawPriority = String(formData.get("priority") || "normal");
    const priority = recordType === "contact" && rawPriority !== "high" ? "normal" : rawPriority;
    return {
      id,
      recordType,
      title,
      status: recordType === "contact" ? "active" : String(formData.get("status") || "new"),
      priority,
      owner: String(formData.get("owner") || "").trim(),
      contactName,
      contactEmail: String(formData.get("contactEmail") || "").trim(),
      contactPhone: String(formData.get("contactPhone") || "").trim(),
      dueDate: String(formData.get("dueDate") || "").trim(),
      relatedEvent: String(formData.get("relatedEvent") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      extras,
    };
  }

  function fillForm(record = null) {
    if (!recordForm) return;
    recordForm.reset();
    const item = record || {
      id: "",
      recordType: "contact",
      status: "new",
      priority: "normal",
      extras: {},
    };
    Object.entries(item).forEach(([key, value]) => {
      const field = recordForm.elements[key];
      if (field) field.value = value == null ? "" : String(value);
    });
    Object.entries(getExtras(item)).forEach(([key, value]) => {
      const field = recordForm.elements[key];
      if (field) field.value = value == null ? "" : String(value);
    });
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
    state.siteEvents = expandSiteEventPayload(data).filter((item) => ["class", "trip"].includes(classifySiteEvent(item)));
    if (calendarStatus) {
      calendarStatus.textContent = state.siteEvents.length
        ? `${state.siteEvents.length} upcoming site-side class/trip items available to link.`
        : "No upcoming class or trip items are currently published in the site calendar.";
    }
    renderCalendarItems();
    return true;
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

  async function syncCalendarRecord(indexValue) {
    const index = Number(indexValue);
    const item = Number.isFinite(index) ? state.siteEvents[index] : null;
    if (!item) return;
    const linked = getLinkedRecordForSiteEvent(item);
    setStatus(recordStatus, linked ? "Syncing site calendar record..." : "Creating management record...");
    try {
      const saved = await saveRecordPayload(buildManagementRecordFromSiteEvent(item, linked || null));
      fillForm(saved);
      setStatus(recordStatus, linked ? "Synced from site calendar." : "Created from site calendar.", "success");
      renderRecords();
      renderCalendarItems();
    } catch (error) {
      setStatus(recordStatus, error && error.message ? error.message : "Could not sync calendar item.", "error");
    }
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
      });
    }
    app.querySelectorAll("[data-copy-field]").forEach((button) => {
      button.addEventListener("click", () => copyFieldValue(button.getAttribute("data-copy-field") || ""));
    });
    if (deleteButton) deleteButton.addEventListener("click", deleteSelectedRecord);
    if (refreshCalendarButton) refreshCalendarButton.addEventListener("click", () => loadSiteCalendar());
    if (calendarItemsEl) {
      calendarItemsEl.addEventListener("click", (event) => {
        const syncButton = event.target.closest("[data-calendar-sync]");
        if (syncButton) {
          syncCalendarRecord(syncButton.getAttribute("data-calendar-sync"));
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
