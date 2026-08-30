(() => {
  "use strict";
  const app = document.querySelector("[data-booking-app]");
  if (!app) return;

  const gate = app.querySelector("[data-booking-gate]");
  const workspace = app.querySelector("[data-booking-workspace]");
  const catalog = app.querySelector("[data-booking-catalog]");
  const status = app.querySelector("[data-booking-status]");
  const formShell = app.querySelector("[data-booking-form-shell]");
  const form = app.querySelector("[data-booking-form]");
  const success = app.querySelector("[data-booking-success]");
  const startModal = app.querySelector("[data-booking-start-modal]");
  const startForm = app.querySelector("[data-booking-start-form]");
  const tokenKey = "dmzCustomerAccessToken";
  const returnPathKey = "dmzAccountReturnPath";
  const pendingOfferingKey = "dmzBookingPendingOffering";
  const signupPrefillKey = "dmzBookingSignupPrefill";
  let accessToken = sessionStorage.getItem(tokenKey) || "";
  let offerings = [];
  let activeCategory = "class";
  let selected = null;
  let profile = {};
  let certifications = [];

  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const money = (cents, currency = "usd") => cents > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100)
    : "Confirmed after review";
  const date = (value) => value
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))
    : "Plan dates with DMZ Scuba";
  const categoryLabel = (category) => category === "class" ? "Class" : category === "trip" ? "Dive Trip" : "Local Event";
  const modeLabel = (item) => item.bookingMode === "scheduled" ? "Scheduled by DMZ Scuba" : "Available on demand";
  const priceLabel = (item) => {
    const fullPrice = Number(item.priceCents) || 0;
    const deposit = Number(item.depositCents) || 0;
    return `<div><dt>Full price</dt><dd>${escapeHtml(money(fullPrice, item.currency))}</dd></div>${deposit > 0 ? `<div><dt>Deposit to reserve</dt><dd>${escapeHtml(money(deposit, item.currency))}</dd></div>` : ""}`;
  };

  async function parse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || "The booking request could not be completed.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function refresh() {
    const response = await fetch("/api/account/auth/refresh", { method: "POST", credentials: "include", headers: { Accept: "application/json" } });
    const data = await parse(response);
    accessToken = String(data.accessToken || "");
    sessionStorage.setItem(tokenKey, accessToken);
  }

  async function api(path, options = {}, retry = true) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(path, { ...options, headers, credentials: "include", cache: "no-store" });
    if (response.status === 401 && retry) {
      try {
        await refresh();
        return api(path, options, false);
      } catch (_error) {
        // The sign-in gate is shown below when refresh is unavailable.
      }
    }
    return parse(response);
  }

  function setMessage(element, message, error = false) {
    element.textContent = message || "";
    element.classList.toggle("is-error", error);
  }

  function renderCatalog() {
    const items = offerings.filter((item) => item.category === activeCategory);
    if (!items.length) {
      catalog.innerHTML = `<div class="booking-empty"><h3>No ${activeCategory === "class" ? "classes" : activeCategory === "trip" ? "trips" : "local events"} are open for direct booking yet.</h3><p>DMZ Scuba is adding availability now. Check back soon or contact us for help planning.</p></div>`;
      return;
    }

    catalog.innerHTML = ["on_demand", "scheduled"].map((mode) => {
      const group = items.filter((item) => item.bookingMode === mode);
      if (!group.length) return "";
      const heading = mode === "on_demand" ? "Book on your schedule" : "Scheduled by DMZ Scuba";
      const copy = mode === "on_demand"
        ? "Choose an offering and tell us which dates work for you."
        : "Choose a published date and request your place.";
      return `<section class="booking-catalog-group">
        <header><h3>${heading}</h3><p>${copy}</p></header>
        <div class="booking-catalog-grid">${group.map((item) => `
          <article class="booking-card">
            <div><span class="booking-card-type">${escapeHtml(categoryLabel(item.category))} &middot; ${escapeHtml(modeLabel(item))}</span><h3>${escapeHtml(item.title)}</h3></div>
            <p>${escapeHtml(item.description || "Open this booking to share your details and preferences with DMZ Scuba.")}</p>
            <dl><div><dt>${item.bookingMode === "scheduled" ? "Date" : "Schedule"}</dt><dd>${escapeHtml(date(item.startsOn))}</dd></div>${item.location ? `<div><dt>Location</dt><dd>${escapeHtml(item.location)}</dd></div>` : ""}${priceLabel(item)}</dl>
            ${item.remaining !== null ? `<small>${item.remaining} spot${item.remaining === 1 ? "" : "s"} currently available</small>` : ""}
            <button class="btn primary" type="button" data-select-offering="${escapeHtml(item.id)}" ${item.remaining === 0 ? "disabled" : ""}>${item.remaining === 0 ? "Currently Full" : item.bookingMode === "scheduled" ? "Request This Spot" : "Start Planning"}</button>
          </article>`).join("")}</div>
      </section>`;
    }).join("");
  }

  function selectOffering(id) {
    selected = offerings.find((item) => item.id === id) || null;
    if (!selected) return;
    if (!accessToken) {
      startModal.hidden = false;
      startForm?.elements.firstName.focus();
      return;
    }
    catalog.hidden = true;
    formShell.hidden = false;
    form.elements.offeringId.value = selected.id;
    form.elements.firstName.value = profile.firstName || "";
    form.elements.lastName.value = profile.lastName || "";
    form.elements.email.value = profile.email || "";
    form.elements.phone.value = profile.phone || "";
    form.elements.birthdate.value = profile.birthdate || "";
    const address = profile.address || {};
    form.elements.houseCallAddressLine1.value = address.line1 || "";
    form.elements.houseCallAddressLine2.value = address.line2 || "";
    form.elements.houseCallAddressCity.value = address.city || "";
    form.elements.houseCallAddressRegion.value = address.region || "";
    form.elements.houseCallAddressPostalCode.value = address.postalCode || "";
    form.elements.houseCallAddressCountryCode.value = address.countryCode || "US";
    form.elements.certificationLevel.value = certifications[0]?.certificationName || "";
    app.querySelector("[data-booking-selected]").innerHTML = `<span>${escapeHtml(categoryLabel(selected.category))} &middot; ${escapeHtml(modeLabel(selected))}</span><h3>${escapeHtml(selected.title)}</h3><p>${escapeHtml(date(selected.startsOn))}${selected.location ? ` &middot; ${escapeHtml(selected.location)}` : ""}</p>`;

    const scheduleFields = app.querySelector("[data-schedule-fields]");
    const classFields = app.querySelector("[data-class-fields]");
    const diveFields = app.querySelector("[data-dive-fields]");
    const asksForDates = selected.bookingMode !== "scheduled";
    scheduleFields.hidden = !asksForDates;
    scheduleFields.disabled = !asksForDates;
    form.elements.preferredDate1.required = asksForDates;
    classFields.hidden = selected.category !== "class";
    classFields.disabled = selected.category !== "class";
    diveFields.hidden = selected.category === "class";
    diveFields.disabled = selected.category === "class";
    syncHouseCallAddress();

    const due = Number(selected.depositCents) || 0;
    const fullPrice = Number(selected.priceCents) || 0;
    app.querySelector("[data-booking-review]").innerHTML = `<strong>${fullPrice > 0 ? `Full price: ${escapeHtml(money(fullPrice, selected.currency))}${due > 0 ? ` · Deposit: ${escapeHtml(money(due, selected.currency))}` : ""}` : "Pricing confirmed after review"}</strong><span>No payment will be collected today. DMZ Scuba will confirm availability, details, and pricing first.</span>`;
    formShell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function syncHouseCallAddress() {
    const fields = app.querySelector("[data-house-call-address]");
    if (!fields) return;
    const visible = Boolean(selected && selected.category === "class" && form.elements.classFormat.value === "house_call");
    fields.hidden = !visible;
    fields.disabled = !visible;
    ["houseCallAddressLine1", "houseCallAddressCity", "houseCallAddressRegion", "houseCallAddressPostalCode"]
      .forEach((name) => { form.elements[name].required = visible; });
  }

  async function init() {
    try {
      const data = await api("/api/bookings/catalog");
      offerings = Array.isArray(data.offerings) ? data.offerings : [];
      profile = data.profile || {};
      certifications = Array.isArray(data.certifications) ? data.certifications : [];
      const authenticated = Boolean(accessToken && data.profile);
      if (!authenticated && accessToken) {
        accessToken = "";
        sessionStorage.removeItem(tokenKey);
      }
      if (authenticated) sessionStorage.removeItem(returnPathKey);
      gate.hidden = authenticated;
      workspace.hidden = false;
      renderCatalog();
      setMessage(status, authenticated ? "Choose an option to begin." : "Browse the options below. Sign in only when you are ready to start a booking.");
      let pendingOffering = "";
      try { pendingOffering = sessionStorage.getItem(pendingOfferingKey) || ""; } catch (_error) { /* optional */ }
      if (!pendingOffering) pendingOffering = new URLSearchParams(window.location.search).get("offering") || "";
      if (authenticated && pendingOffering) {
        try { sessionStorage.removeItem(pendingOfferingKey); } catch (_error) { /* optional */ }
        selectOffering(pendingOffering);
      }
    } catch (error) {
      const signedOut = Number(error && error.status) === 401;
      if (signedOut) sessionStorage.setItem(returnPathKey, "/pages/book/");
      gate.hidden = false;
      workspace.hidden = false;
      if (!signedOut) {
        catalog.innerHTML = "";
        setMessage(status, error.message || "Bookings could not load. Please refresh and try again.", true);
      } else {
        setMessage(status, "Browse the options below. Sign in only when you are ready to start a booking.");
      }
    }
  }

  app.querySelectorAll("[data-booking-auth-link]").forEach((link) => link.addEventListener("click", () => sessionStorage.setItem(returnPathKey, "/pages/book/")));
  app.querySelector("[data-booking-start-close]")?.addEventListener("click", () => { startModal.hidden = true; });
  startModal?.addEventListener("click", (event) => { if (event.target === startModal) startModal.hidden = true; });
  startForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selected) return;
    const values = new FormData(startForm);
    try {
      sessionStorage.setItem(pendingOfferingKey, selected.id);
      sessionStorage.setItem(signupPrefillKey, JSON.stringify({ firstName: values.get("firstName") || "", lastName: values.get("lastName") || "", email: values.get("email") || "" }));
      sessionStorage.setItem(returnPathKey, "/pages/book/");
    } catch (_error) { /* account setup still works without prefill */ }
    window.location.assign("/pages/account/create/?return=booking");
  });
  app.querySelectorAll("[data-booking-account-link]").forEach((link) => link.addEventListener("click", () => sessionStorage.removeItem(returnPathKey)));
  app.querySelectorAll("[data-booking-category]").forEach((button) => button.addEventListener("click", () => {
    activeCategory = button.dataset.bookingCategory;
    app.querySelectorAll("[data-booking-category]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    formShell.hidden = true;
    catalog.hidden = false;
    renderCatalog();
  }));
  form.querySelectorAll('input[name="classFormat"]').forEach((input) => input.addEventListener("change", syncHouseCallAddress));
  catalog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-offering]");
    if (button) selectOffering(button.dataset.selectOffering);
  });
  app.querySelector("[data-booking-back]")?.addEventListener("click", () => {
    formShell.hidden = true;
    catalog.hidden = false;
    selected = null;
  });
  app.querySelector("[data-book-another]")?.addEventListener("click", () => {
    success.hidden = true;
    workspace.hidden = false;
    form.reset();
    renderCatalog();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selected) return;
    const button = form.querySelector('button[type="submit"]');
    const formStatus = app.querySelector("[data-booking-form-status]");
    const values = new FormData(form);
    const body = Object.fromEntries(values.entries());
    body.isMinor = values.has("isMinor");
    body.veteranPublicSafetyDiscount = values.has("veteranPublicSafetyDiscount");
    body.needsGear = values.has("needsGear");
    body.needsClasses = values.has("needsClasses");
    body.preferredDates = [values.get("preferredDate1"), values.get("preferredDate2"), values.get("preferredDate3")].filter(Boolean);
    body.houseCallAddress = {
      line1: values.get("houseCallAddressLine1") || "",
      line2: values.get("houseCallAddressLine2") || "",
      city: values.get("houseCallAddressCity") || "",
      region: values.get("houseCallAddressRegion") || "",
      postalCode: values.get("houseCallAddressPostalCode") || "",
      countryCode: values.get("houseCallAddressCountryCode") || "US",
    };
    button.disabled = true;
    setMessage(formStatus, "Submitting your booking...");
    try {
      await api("/api/bookings", { method: "POST", body: JSON.stringify(body) });
      workspace.hidden = true;
      success.hidden = false;
      app.querySelector("[data-booking-success-copy]").textContent = "DMZ Scuba will review your details, confirm availability and pricing, and contact you by email. No payment was collected today.";
      success.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setMessage(formStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  init();
})();
