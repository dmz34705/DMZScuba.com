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
  const tokenKey = "dmzCustomerAccessToken";
  let accessToken = sessionStorage.getItem(tokenKey) || "";
  let offerings = [];
  let activeCategory = "class";
  let selected = null;
  let profile = {};

  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const money = (cents, currency = "usd") => cents > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100) : "No online payment required";
  const date = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Schedule with DMZ Scuba";

  async function parse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "The booking request could not be completed.");
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
      try { await refresh(); return api(path, options, false); } catch (_error) { /* show gate below */ }
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
    catalog.innerHTML = items.map((item) => `
      <article class="booking-card">
        <div><span class="booking-card-type">${escapeHtml(item.category === "class" ? "Class" : item.category === "trip" ? "Dive Trip" : "Local Event")}</span><h3>${escapeHtml(item.title)}</h3></div>
        <p>${escapeHtml(item.description || "Open this booking to share your details and preferences with DMZ Scuba.")}</p>
        <dl><div><dt>Date</dt><dd>${escapeHtml(date(item.startsOn))}</dd></div>${item.location ? `<div><dt>Location</dt><dd>${escapeHtml(item.location)}</dd></div>` : ""}<div><dt>Due now</dt><dd>${escapeHtml(money(item.depositCents || item.priceCents, item.currency))}</dd></div></dl>
        ${item.remaining !== null ? `<small>${item.remaining} spot${item.remaining === 1 ? "" : "s"} currently available</small>` : ""}
        <button class="btn primary" type="button" data-select-offering="${escapeHtml(item.id)}" ${item.remaining === 0 ? "disabled" : ""}>${item.remaining === 0 ? "Currently Full" : "Choose This Option"}</button>
      </article>`).join("");
  }

  function selectOffering(id) {
    selected = offerings.find((item) => item.id === id) || null;
    if (!selected) return;
    catalog.hidden = true;
    formShell.hidden = false;
    form.elements.offeringId.value = selected.id;
    form.elements.firstName.value = profile.firstName || "";
    form.elements.lastName.value = profile.lastName || "";
    form.elements.email.value = profile.email || "";
    form.elements.phone.value = profile.phone || "";
    app.querySelector("[data-booking-selected]").innerHTML = `<span>${escapeHtml(selected.category === "class" ? "Class" : selected.category === "trip" ? "Dive Trip" : "Local Event")}</span><h3>${escapeHtml(selected.title)}</h3><p>${escapeHtml(date(selected.startsOn))}${selected.location ? ` · ${escapeHtml(selected.location)}` : ""}</p>`;
    app.querySelector("[data-class-fields]").hidden = selected.category !== "class";
    app.querySelector("[data-dive-fields]").hidden = selected.category === "class";
    const due = selected.depositCents || selected.priceCents;
    app.querySelector("[data-booking-review]").innerHTML = `<strong>${due > 0 ? `${escapeHtml(money(due, selected.currency))} due to continue` : "No payment required right now"}</strong><span>DMZ Scuba will review availability before the booking is final.</span>`;
    formShell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function init() {
    sessionStorage.setItem("dmzAccountReturnPath", "/pages/book/");
    try {
      const data = await api("/api/bookings/catalog");
      offerings = Array.isArray(data.offerings) ? data.offerings : [];
      profile = data.profile || {};
      gate.hidden = true;
      workspace.hidden = false;
      renderCatalog();
      setMessage(status, "Choose an option to begin.");
    } catch (_error) {
      gate.hidden = false;
      workspace.hidden = true;
    }
  }

  app.querySelector("[data-booking-signin]")?.addEventListener("click", () => sessionStorage.setItem("dmzAccountReturnPath", "/pages/book/"));
  app.querySelectorAll("[data-booking-category]").forEach((button) => button.addEventListener("click", () => {
    activeCategory = button.dataset.bookingCategory;
    app.querySelectorAll("[data-booking-category]").forEach((item) => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-selected", String(active)); });
    formShell.hidden = true;
    catalog.hidden = false;
    renderCatalog();
  }));
  catalog.addEventListener("click", (event) => { const button = event.target.closest("[data-select-offering]"); if (button) selectOffering(button.dataset.selectOffering); });
  app.querySelector("[data-booking-back]")?.addEventListener("click", () => { formShell.hidden = true; catalog.hidden = false; selected = null; });
  app.querySelector("[data-book-another]")?.addEventListener("click", () => { success.hidden = true; workspace.hidden = false; form.reset(); renderCatalog(); });
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
    button.disabled = true;
    setMessage(formStatus, "Submitting your booking...");
    try {
      const data = await api("/api/bookings", { method: "POST", body: JSON.stringify(body) });
      workspace.hidden = true;
      success.hidden = false;
      app.querySelector("[data-booking-success-copy]").textContent = data.paymentRequired
        ? "Your request is saved. Online payment will open after DMZ Scuba confirms availability and pricing."
        : "DMZ Scuba will review your details and confirm the schedule by email.";
      success.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setMessage(formStatus, error.message, true);
    } finally { button.disabled = false; }
  });
  init();
})();
