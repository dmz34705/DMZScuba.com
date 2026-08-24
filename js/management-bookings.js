(() => {
  "use strict";
  const app = document.querySelector("[data-management-app]");
  const panel = app?.querySelector('[data-site-studio-panel="bookings"]');
  if (!panel) return;
  const bookingList = panel.querySelector("[data-admin-booking-list]");
  const offeringList = panel.querySelector("[data-admin-offering-list]");
  const editor = panel.querySelector("[data-admin-booking-editor]");
  const status = panel.querySelector("[data-booking-admin-status]");
  const summary = panel.querySelector("[data-booking-summary]");
  const apiRoot = document.body.dataset.adminApi || document.body.dataset.mediaApi || "";
  let bookings = [];
  let offerings = [];
  let loaded = false;

  const token = () => sessionStorage.getItem("dmzCustomerAccessToken") || localStorage.getItem("dmzMediaToken") || "";
  const esc = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(value) || 0) / 100);
  const date = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Flexible schedule";
  const setStatus = (message, error = false) => { status.textContent = message || ""; status.classList.toggle("is-error", error); status.classList.toggle("is-success", Boolean(message) && !error); };

  async function request(path = "", options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${apiRoot}${path}`, { ...options, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "The booking update could not be completed.");
    return data;
  }

  function render() {
    summary.innerHTML = [[bookings.length, "Total requests"], [bookings.filter((item) => item.status === "pending").length, "Needs review"], [bookings.filter((item) => item.status === "confirmed").length, "Confirmed"], [offerings.filter((item) => item.active).length, "Visible options"]].map(([value, label]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join("");
    bookingList.innerHTML = bookings.length ? bookings.map((item) => `<button type="button" data-admin-booking="${esc(item.id)}"><span><strong>${esc(item.offering?.title || "Booking")}</strong><small>${esc(item.firstName)} ${esc(item.lastName)} · ${esc(item.email)}</small></span><span class="mgmt-booking-badge">${esc(item.status)}</span></button>`).join("") : '<div class="management-empty">No customer booking requests yet.</div>';
    offeringList.innerHTML = offerings.length ? offerings.map((item) => `<button type="button" data-admin-offering="${esc(item.id)}"><span><strong>${esc(item.title)}</strong><small>${esc(item.category)} · ${esc(date(item.startsOn))} · ${money(item.depositCents || item.priceCents)}</small></span><span class="mgmt-booking-badge${item.active ? "" : " is-muted"}">${item.active ? `${item.bookedCount} booked` : "Hidden"}</span></button>`).join("") : '<div class="management-empty">Import upcoming calendar items or create a booking option.</div>';
  }

  function bookingEditor(item) {
    const details = item.details || {};
    editor.innerHTML = `<p class="management-kicker">Customer request</p><h2>${esc(item.offering?.title || "Booking")}</h2><dl class="mgmt-booking-details"><div><dt>Registrant</dt><dd>${esc(item.firstName)} ${esc(item.lastName)}${item.isMinor ? " (minor)" : ""}</dd></div><div><dt>Contact</dt><dd>${esc(item.email)}<br>${esc(item.phone)}</dd></div><div><dt>Birthdate</dt><dd>${esc(item.birthdate)}</dd></div><div><dt>Payment</dt><dd>${esc(item.paymentStatus)} · ${money(item.amountPaidCents)} of ${money(item.amountDueCents)}</dd></div><div><dt>Preferred dates</dt><dd>${(details.preferredDates || []).map(date).join(", ") || "Not provided"}</dd></div><div><dt>Class format</dt><dd>${esc(details.classFormat || "Not applicable")}</dd></div><div><dt>Certification</dt><dd>${esc(details.certificationLevel || "Not provided")}</dd></div><div><dt>Last dive</dt><dd>${esc(details.lastDiveDate || "Not provided")}</dd></div><div><dt>Needs</dt><dd>${details.needsGear ? "Gear " : ""}${details.needsClasses ? "Training" : ""}${!details.needsGear && !details.needsClasses ? "None noted" : ""}</dd></div><div><dt>Notes</dt><dd>${esc(details.notes || "None")}</dd></div></dl><form data-admin-booking-status data-id="${esc(item.id)}"><label><span>Booking Status</span><select name="status">${["pending", "reviewing", "confirmed", "waitlisted", "cancelled", "completed"].map((value) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${value[0].toUpperCase()}${value.slice(1)}</option>`).join("")}</select></label><button class="btn primary" type="submit">Save Status</button></form>`;
  }

  function offeringEditor(item = {}) {
    editor.innerHTML = `<p class="management-kicker">${item.id ? "Bookable option" : "New booking option"}</p><h2>${item.id ? esc(item.title) : "Create an option"}</h2><form class="mgmt-booking-offering-form" data-admin-offering-form data-id="${esc(item.id)}"><label><span>Customer-facing title</span><input name="title" required value="${esc(item.title)}" /></label><label><span>Category</span><select name="category">${[["class","Class"],["trip","Dive Trip"],["event","Local Event"]].map(([value,label]) => `<option value="${value}" ${item.category === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Description</span><textarea name="description" rows="4">${esc(item.description)}</textarea></label><div class="mgmt-booking-form-row"><label><span>Start date</span><input name="startsOn" type="date" value="${esc(item.startsOn)}" /></label><label><span>End date</span><input name="endsOn" type="date" value="${esc(item.endsOn)}" /></label></div><label><span>Location</span><input name="location" value="${esc(item.location)}" /></label><div class="mgmt-booking-form-row"><label><span>Capacity (0 = unlimited)</span><input name="capacity" type="number" min="0" value="${Number(item.capacity) || 0}" /></label><label><span>Full price</span><input name="price" type="number" min="0" step="0.01" value="${((Number(item.priceCents) || 0) / 100).toFixed(2)}" /></label><label><span>Deposit due</span><input name="deposit" type="number" min="0" step="0.01" value="${((Number(item.depositCents) || 0) / 100).toFixed(2)}" /></label></div><label class="mgmt-booking-check"><input name="active" type="checkbox" ${item.active !== false ? "checked" : ""} /><span>Visible to customers</span></label><button class="btn primary" type="submit">Save Booking Option</button></form>`;
  }

  async function load(message = "") {
    setStatus("Loading bookings...");
    try { const data = await request("/api/admin/bookings"); bookings = data.bookings || []; offerings = data.offerings || []; render(); loaded = true; setStatus(message); }
    catch (error) { setStatus(error.message, true); }
  }

  panel.addEventListener("click", (event) => {
    const bookingButton = event.target.closest("[data-admin-booking]"); if (bookingButton) bookingEditor(bookings.find((item) => item.id === bookingButton.dataset.adminBooking));
    const offeringButton = event.target.closest("[data-admin-offering]"); if (offeringButton) offeringEditor(offerings.find((item) => item.id === offeringButton.dataset.adminOffering));
  });
  editor.addEventListener("submit", async (event) => {
    event.preventDefault(); const values = new FormData(event.target);
    try {
      if (event.target.matches("[data-admin-booking-status]")) { const id = event.target.dataset.id; await request(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: values.get("status") }) }); await load("Booking status updated."); }
      if (event.target.matches("[data-admin-offering-form]")) { const id = event.target.dataset.id; const offering = Object.fromEntries(values.entries()); offering.active = values.has("active"); await request(id ? `/api/admin/booking-offerings/${encodeURIComponent(id)}` : "/api/admin/booking-offerings", { method: id ? "PUT" : "POST", body: JSON.stringify({ offering }) }); await load("Booking option saved."); }
    } catch (error) { setStatus(error.message, true); }
  });
  panel.querySelector("[data-booking-new]").addEventListener("click", () => offeringEditor({ active: true, category: "class" }));
  panel.querySelector("[data-booking-refresh]").addEventListener("click", () => load());
  panel.querySelector("[data-booking-import]").addEventListener("click", async () => { try { const data = await request("/api/admin/booking-offerings/import-events", { method: "POST" }); await load(`${data.imported} upcoming calendar item${data.imported === 1 ? "" : "s"} checked for import.`); } catch (error) { setStatus(error.message, true); } });
  app.querySelector('[data-site-studio-tab="bookings"]')?.addEventListener("click", () => { if (!loaded) load(); });
})();
