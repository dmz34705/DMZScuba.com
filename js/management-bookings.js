(() => {
  "use strict";
  const app = document.querySelector("[data-management-app]");
  const panel = app?.querySelector('[data-site-studio-panel="bookings"]');
  if (!panel) return;

  const bookingList = panel.querySelector("[data-admin-booking-list]");
  const offeringList = panel.querySelector("[data-admin-offering-list]");
  const requestColumn = panel.querySelector("[data-booking-request-column]");
  const offeringColumn = panel.querySelector("[data-booking-offering-column]");
  const editor = panel.querySelector("[data-admin-booking-editor]");
  const status = panel.querySelector("[data-booking-admin-status]");
  const summary = panel.querySelector("[data-booking-summary]");
  const panelTitle = panel.querySelector("[data-booking-panel-title]");
  const panelSubtitle = panel.querySelector("[data-booking-panel-subtitle]");
  const listTitle = panel.querySelector("[data-booking-list-title]");
  const modeFilter = panel.querySelector("[data-booking-mode-filter]");
  const newButton = panel.querySelector("[data-booking-new]");
  const importButton = panel.querySelector("[data-booking-import]");
  const requestTitle = panel.querySelector("[data-booking-request-title]");
  const requestSubtitle = panel.querySelector("[data-booking-request-subtitle]");
  const requestSwitches = Array.from(panel.querySelectorAll("[data-booking-request-view]"));
  const apiRoot = document.body.dataset.adminApi || document.body.dataset.mediaApi || "";
  let bookings = [];
  let offerings = [];
  let currentView = "requests";
  let selectedId = "";
  let loaded = false;
  let permissions = { administrator: false, professionalClassCreator: false };
  let requestView = "active";

  const categoryNames = { class: "Classes", trip: "Dive Trips", event: "Local Events" };
  const categorySingular = { class: "Class", trip: "Dive Trip", event: "Local Event" };
  const token = () => sessionStorage.getItem("dmzCustomerAccessToken") || localStorage.getItem("dmzMediaToken") || "";
  const esc = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(value) || 0) / 100);
  const date = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Dates chosen with customer";
  const modeName = (mode) => mode === "scheduled" ? "Scheduled listing" : "On-demand offering";
  const setStatus = (message, error = false) => {
    status.textContent = message || "";
    status.classList.toggle("is-error", error);
    status.classList.toggle("is-success", Boolean(message) && !error);
  };

  async function request(path = "", options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${apiRoot}${path}`, { ...options, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "The booking update could not be completed.");
    return data;
  }

  function summaryCard(value, label) {
    return `<article><strong>${value}</strong><span>${label}</span></article>`;
  }

  function renderSummary() {
    if (currentView === "requests") {
      const visibleRequests = bookings.filter((item) => requestView === "previous" ? ["cancelled", "completed"].includes(item.status) : !["cancelled", "completed"].includes(item.status));
      summary.innerHTML = [
        summaryCard(visibleRequests.length, requestView === "previous" ? "Previous requests" : "Active requests"),
        summaryCard(visibleRequests.filter((item) => ["pending", "reviewing"].includes(item.status)).length, "Needs attention"),
        summaryCard(visibleRequests.filter((item) => item.status === "confirmed").length, "Confirmed"),
        summaryCard(visibleRequests.filter((item) => item.status === "completed").length, "Completed"),
      ].join("");
      return;
    }
    const categoryItems = offerings.filter((item) => item.category === currentView);
    summary.innerHTML = [
      summaryCard(categoryItems.length, `Total ${categoryNames[currentView].toLowerCase()}`),
      summaryCard(categoryItems.filter((item) => item.active).length, "Visible to customers"),
      summaryCard(categoryItems.filter((item) => item.bookingMode === "on_demand").length, "On demand"),
      summaryCard(categoryItems.filter((item) => item.bookingMode === "scheduled").length, "Scheduled"),
    ].join("");
  }

  function renderRequests() {
    const visible = bookings.filter((item) => requestView === "previous" ? ["cancelled", "completed"].includes(item.status) : !["cancelled", "completed"].includes(item.status));
    bookingList.innerHTML = visible.length ? visible.map((item) => `
      <button class="${item.id === selectedId ? "is-selected" : ""}" type="button" data-admin-booking="${esc(item.id)}">
        <span><strong>${esc(item.offering?.title || "Booking")}</strong><small>${esc(item.firstName)} ${esc(item.lastName)} &middot; ${esc(categorySingular[item.category] || "Booking")}</small></span>
        <span class="mgmt-booking-badge">${esc(item.status)}</span>
      </button>`).join("") : `<div class="management-empty">No ${requestView === "previous" ? "previous" : "active"} booking requests.</div>`;
  }

  function visibleOfferings() {
    const filter = modeFilter.value;
    return offerings.filter((item) => {
      if (item.category !== currentView) return false;
      if (filter === "hidden") return !item.active;
      if (filter === "on_demand" || filter === "scheduled") return item.bookingMode === filter;
      return true;
    });
  }

  function renderOfferings() {
    const items = visibleOfferings();
    offeringList.innerHTML = items.length ? items.map((item) => `
      <button class="${item.id === selectedId ? "is-selected" : ""}" type="button" data-admin-offering="${esc(item.id)}">
        <span><strong>${esc(item.title)}</strong><small>${esc(modeName(item.bookingMode))} &middot; ${esc(date(item.startsOn))}</small></span>
        <span class="mgmt-booking-badge${item.active ? "" : " is-muted"}">${item.active ? `${item.bookedCount} booked` : "Hidden"}</span>
      </button>`).join("") : `<div class="management-empty">No ${esc(categoryNames[currentView].toLowerCase())} match this view. Create an on-demand offering or scheduled listing to get started.</div>`;
  }

  function render() {
    renderSummary();
    renderRequests();
    renderOfferings();
  }

  function emptyEditor(message) {
    selectedId = "";
    editor.innerHTML = `<div class="management-empty">${esc(message)}</div>`;
    render();
  }

  function setView(view) {
    if (permissions.professionalClassCreator && !["requests", "class"].includes(view)) view = "class";
    currentView = ["requests", "class", "trip", "event"].includes(view) ? view : "requests";
    const requestsView = currentView === "requests";
    requestColumn.hidden = !requestsView;
    offeringColumn.hidden = requestsView;
    newButton.hidden = requestsView;
    importButton.hidden = requestsView;
    panelTitle.textContent = requestsView ? "Booking Requests" : categoryNames[currentView];
    panelSubtitle.textContent = requestsView
      ? "Review customer requests and move each booking toward confirmation."
      : `Create ${categoryNames[currentView].toLowerCase()} customers can start on demand or book for a specific DMZ Scuba date.`;
    requestTitle.textContent = requestView === "previous" ? "Previous Requests" : "Active Requests";
    requestSubtitle.textContent = requestView === "previous" ? "Cancelled and completed requests remain available here for reference." : "Review current customer requests and move each booking toward confirmation.";
    requestSwitches.forEach((button) => { const active = button.dataset.bookingRequestView === requestView; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); });
    listTitle.textContent = `${categorySingular[currentView] || "Booking"} Offerings`;
    newButton.textContent = `Create ${categorySingular[currentView] || "Offering"}`;
    newButton.disabled = permissions.professionalClassCreator && currentView !== "class";
    panel.querySelectorAll("[data-booking-admin-view]").forEach((button) => {
      const active = button.dataset.bookingAdminView === currentView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    app.querySelectorAll("[data-booking-open]").forEach((button) => {
      const active = button.dataset.bookingOpen === currentView;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    selectedId = "";
    editor.innerHTML = `<div class="management-empty">${requestsView ? "Select a customer request to review its details." : `Select a ${categorySingular[currentView].toLowerCase()} or create a new one.`}</div>`;
    render();
    if (!loaded) load();
  }

  function bookingEditor(item) {
    selectedId = item.id;
    const details = item.details || {};
    editor.innerHTML = `<p class="management-kicker">Customer request</p><h2>${esc(item.offering?.title || "Booking")}</h2><dl class="mgmt-booking-details"><div><dt>Category</dt><dd>${esc(categorySingular[item.category] || "Booking")}</dd></div><div><dt>Registrant</dt><dd>${esc(item.firstName)} ${esc(item.lastName)}${item.isMinor ? " (minor)" : ""}</dd></div><div><dt>Contact</dt><dd>${esc(item.email)}<br>${esc(item.phone)}</dd></div><div><dt>Birthdate</dt><dd>${esc(item.birthdate)}</dd></div><div><dt>Pricing record</dt><dd>${money(item.amountDueCents)} planned &middot; ${money(item.amountPaidCents)} collected</dd></div><div><dt>Preferred dates</dt><dd>${(details.preferredDates || []).map(date).join(", ") || "Uses the published schedule"}</dd></div><div><dt>Class format</dt><dd>${esc(details.classFormat || "Not applicable")}</dd></div><div><dt>Certification</dt><dd>${esc(details.certificationLevel || "Not provided")}</dd></div><div><dt>Last dive</dt><dd>${esc(details.lastDiveDate || "Not provided")}</dd></div><div><dt>Needs</dt><dd>${details.needsGear ? "Gear " : ""}${details.needsClasses ? "Training" : ""}${!details.needsGear && !details.needsClasses ? "None noted" : ""}</dd></div><div><dt>Notes</dt><dd>${esc(details.notes || "None")}</dd></div></dl><p class="mgmt-booking-mode-note">Online payments are not enabled yet. Pricing is stored so checkout can be connected later.</p><form data-admin-booking-status data-id="${esc(item.id)}"><label><span>Booking Status</span><select name="status">${["pending", "reviewing", "confirmed", "waitlisted", "cancelled", "completed"].map((value) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${value[0].toUpperCase()}${value.slice(1)}</option>`).join("")}</select></label><button class="btn primary" type="submit">Save Status</button></form>`;
    if (item.status !== "cancelled") {
      editor.querySelector("[data-admin-booking-status]")?.insertAdjacentHTML("beforeend", '<button class="btn danger" type="button" data-booking-remove>Remove customer from this booking</button>');
    }
    render();
  }

  function offeringEditor(item = {}) {
    selectedId = item.id || "";
    const category = ["class", "trip", "event"].includes(item.category) ? item.category : (currentView === "requests" ? "class" : currentView);
    const bookingMode = item.bookingMode === "scheduled" ? "scheduled" : "on_demand";
    const roster = Array.isArray(item.registrants) ? item.registrants : [];
    const days = item.durationDays ? `${item.durationDays} day${item.durationDays === 1 ? "" : "s"}` : "Customer schedule";
    const capacity = item.capacity > 0 ? `${item.remaining} spot${item.remaining === 1 ? "" : "s"} remaining` : "Unlimited capacity";
    editor.innerHTML = `<p class="management-kicker">${item.id ? modeName(bookingMode) : `New ${categorySingular[category].toLowerCase()}`}</p><h2>${item.id ? esc(item.title) : `Create a ${categorySingular[category].toLowerCase()}`}</h2><form class="mgmt-booking-offering-form" data-admin-offering-form data-id="${esc(item.id)}"><label><span>Customer-facing title</span><input name="title" required value="${esc(item.title)}" placeholder="For example: Cozumel Dive Trip" /></label><label><span>Category</span><select name="category">${[["class", "Class"], ["trip", "Dive Trip"], ["event", "Local Event"]].map(([value, label]) => `<option value="${value}" ${category === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Availability Type</span><select name="bookingMode" data-offering-mode><option value="on_demand" ${bookingMode === "on_demand" ? "selected" : ""}>On demand — customer proposes dates</option><option value="scheduled" ${bookingMode === "scheduled" ? "selected" : ""}>Scheduled — DMZ Scuba sets the dates</option></select></label><p class="mgmt-booking-mode-note" data-offering-mode-note>${bookingMode === "scheduled" ? "Use this for a specific class session, trip departure, or local event." : "Use this for something DMZ Scuba can arrange when a customer is ready."}</p><label><span>Description</span><textarea name="description" rows="4" placeholder="Explain what is included and who this is for.">${esc(item.description)}</textarea></label><div data-offering-schedule ${bookingMode === "scheduled" ? "" : "hidden"}><div class="mgmt-booking-form-row"><label><span>Start date</span><input name="startsOn" type="date" value="${esc(item.startsOn)}" /></label><label><span>End date</span><input name="endsOn" type="date" value="${esc(item.endsOn)}" /></label></div></div><label><span>Location</span><input name="location" value="${esc(item.location)}" placeholder="DMZ Scuba HQ, Cozumel, local dive site..." /></label><div class="mgmt-booking-form-row"><label><span>Capacity (0 = unlimited)</span><input name="capacity" type="number" min="0" value="${Number(item.capacity) || 0}" /></label><label><span>Planned full price</span><input name="price" type="number" min="0" step="0.01" value="${((Number(item.priceCents) || 0) / 100).toFixed(2)}" /></label><label><span>Planned deposit</span><input name="deposit" type="number" min="0" step="0.01" value="${((Number(item.depositCents) || 0) / 100).toFixed(2)}" /></label></div><p class="mgmt-booking-mode-note">Prices are displayed for planning only. The site will not collect payment until checkout is enabled later.</p><label class="mgmt-booking-check"><input name="active" type="checkbox" ${item.active !== false ? "checked" : ""} /><span>Visible to customers</span></label><button class="btn primary" type="submit">Save ${categorySingular[category]}</button>${item.id ? `<button class="btn secondary" type="button" data-booking-duplicate="${esc(item.id)}">Create ${bookingMode === "scheduled" ? "On-Demand" : "Scheduled"} Copy</button>` : ""}</form>`;
    if (permissions.professionalClassCreator) {
      const form = editor.querySelector("[data-admin-offering-form]");
      const categorySelect = form?.elements.category;
      const modeSelect = form?.elements.bookingMode;
      if (categorySelect) { categorySelect.value = "class"; categorySelect.disabled = true; }
      if (modeSelect) { modeSelect.value = "scheduled"; modeSelect.disabled = true; }
      form?.insertAdjacentHTML("beforeend", '<input type="hidden" name="category" value="class" /><input type="hidden" name="bookingMode" value="scheduled" />');
    }
    if (item.id) {
      const insight = `<div class="mgmt-booking-insight-grid"><article><strong>${roster.length}</strong><span>Signed up</span></article><article><strong>${esc(capacity)}</strong><span>Capacity</span></article><article><strong>${esc(days)}</strong><span>Schedule</span></article></div><section class="mgmt-booking-roster-panel"><h3>Customer roster</h3>${roster.length ? `<ul class="mgmt-booking-roster">${roster.map((person) => `<li><strong>${esc(person.name || "Registrant")}</strong><span>${esc(person.email)}${person.phone ? ` · ${esc(person.phone)}` : ""}</span><small>${esc(person.status)}</small></li>`).join("")}</ul>` : '<p class="management-empty management-empty-compact">No customers are signed up yet.</p>'}</section>`;
      editor.insertAdjacentHTML("afterbegin", insight);
      if (permissions.administrator) editor.querySelector("[data-admin-offering-form]")?.insertAdjacentHTML("beforeend", `<button class="btn danger" type="button" data-booking-delete="${esc(item.id)}">Delete booking item</button>`);
    }
    render();
  }

  function updateModeFields(select) {
    const formElement = select.closest("form");
    const scheduled = select.value === "scheduled";
    const schedule = formElement.querySelector("[data-offering-schedule]");
    const note = formElement.querySelector("[data-offering-mode-note]");
    schedule.hidden = !scheduled;
    formElement.elements.startsOn.required = scheduled;
    note.textContent = scheduled
      ? "Use this for a specific class session, trip departure, or local event."
      : "Use this for something DMZ Scuba can arrange when a customer is ready.";
  }

  async function load(message = "") {
    setStatus("Loading bookings...");
    try {
      const data = await request("/api/admin/bookings");
      bookings = data.bookings || [];
      offerings = data.offerings || [];
      permissions = { ...permissions, ...(data.permissions || {}) };
      if (permissions.professionalClassCreator && !["requests", "class"].includes(currentView)) setView("class");
      loaded = true;
      render();
      setStatus(message);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  panel.addEventListener("click", (event) => {
    const requestViewButton = event.target.closest("[data-booking-request-view]");
    if (requestViewButton) { requestView = requestViewButton.dataset.bookingRequestView === "previous" ? "previous" : "active"; selectedId = ""; editor.innerHTML = '<div class="management-empty">Select a request to review its details.</div>'; render(); return; }
    const viewButton = event.target.closest("[data-booking-admin-view]");
    if (viewButton) setView(viewButton.dataset.bookingAdminView);
    const bookingButton = event.target.closest("[data-admin-booking]");
    if (bookingButton) bookingEditor(bookings.find((item) => item.id === bookingButton.dataset.adminBooking));
    const offeringButton = event.target.closest("[data-admin-offering]");
    if (offeringButton) offeringEditor(offerings.find((item) => item.id === offeringButton.dataset.adminOffering));
    const duplicateButton = event.target.closest("[data-booking-duplicate]");
    if (duplicateButton) {
      const source = offerings.find((item) => item.id === duplicateButton.dataset.bookingDuplicate);
      if (source) offeringEditor({ ...source, id: "", sourceId: "", sourceDate: "", bookingMode: source.bookingMode === "scheduled" ? "on_demand" : "scheduled", startsOn: "", endsOn: "", active: false });
    }
    const deleteButton = event.target.closest("[data-booking-delete]");
    if (deleteButton) {
      const item = offerings.find((entry) => entry.id === deleteButton.dataset.bookingDelete);
      if (!item || !permissions.administrator) return;
      if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
      setStatus(`Deleting ${item.title}...`);
      request(`/api/admin/booking-offerings/${encodeURIComponent(item.id)}`, { method: "DELETE" })
        .then(() => {
          selectedId = "";
          editor.innerHTML = '<div class="management-empty">Select an offering to edit it.</div>';
          return load("Booking item deleted.");
        })
        .catch((error) => setStatus(error.message || "The booking item could not be deleted.", true));
    }
    const removeCustomerButton = event.target.closest("[data-booking-remove]");
    if (removeCustomerButton) {
      const form = editor.querySelector("[data-admin-booking-status]");
      const id = form?.dataset.id || "";
      if (!id || !window.confirm("Remove this customer from the booking? Their record will be kept as cancelled in their profile.")) return;
      setStatus("Removing customer from booking...");
      request(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled", reason: "Removed from booking by DMZ Scuba" }) })
        .then(() => load("Customer removed; their cancelled booking history was preserved."))
        .catch((error) => setStatus(error.message || "The customer could not be removed.", true));
    }
  });
  panel.addEventListener("change", (event) => {
    if (event.target.matches("[data-offering-mode]")) updateModeFields(event.target);
  });
  editor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.target);
    try {
      if (event.target.matches("[data-admin-booking-status]")) {
        const id = event.target.dataset.id;
        await request(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: values.get("status") }) });
        await load("Booking status updated.");
        const saved = bookings.find((item) => item.id === id);
        if (saved) bookingEditor(saved);
      }
      if (event.target.matches("[data-admin-offering-form]")) {
        const id = event.target.dataset.id;
        const offering = Object.fromEntries(values.entries());
        offering.active = values.has("active");
        const data = await request(id ? `/api/admin/booking-offerings/${encodeURIComponent(id)}` : "/api/admin/booking-offerings", { method: id ? "PUT" : "POST", body: JSON.stringify({ offering }) });
        currentView = offering.category;
        await load(`${categorySingular[offering.category]} saved and ${offering.active ? "visible to customers" : "kept hidden"}.`);
        setView(offering.category);
        const saved = offerings.find((item) => item.id === data.offering?.id);
        if (saved) offeringEditor(saved);
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  newButton.addEventListener("click", () => offeringEditor({ active: true, category: currentView, bookingMode: permissions.professionalClassCreator ? "scheduled" : "on_demand" }));
  panel.querySelector("[data-booking-refresh]").addEventListener("click", () => load());
  importButton.addEventListener("click", async () => {
    try {
      const data = await request("/api/admin/booking-offerings/import-events", { method: "POST" });
      await load(`${data.imported} upcoming calendar item${data.imported === 1 ? "" : "s"} checked for import as scheduled listings.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  modeFilter.addEventListener("change", () => {
    selectedId = "";
    editor.innerHTML = `<div class="management-empty">Select an offering to edit it.</div>`;
    render();
  });
  app.querySelectorAll("[data-booking-open]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.bookingOpen)));
  app.querySelector('[data-site-studio-tab="bookings"]')?.addEventListener("click", () => {
    if (!loaded) load();
  });

  setView("requests");
})();
