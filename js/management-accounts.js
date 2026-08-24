(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;
  const nav = app.querySelector("[data-accounts-nav]");
  const panel = app.querySelector('[data-site-studio-panel="accounts"]');
  const list = app.querySelector("[data-account-list]");
  const detail = app.querySelector("[data-account-detail]");
  const summary = app.querySelector("[data-account-summary]");
  const status = app.querySelector("[data-account-admin-status]");
  const search = app.querySelector("[data-account-search]");
  const filter = app.querySelector("[data-account-status-filter]");
  const refresh = app.querySelector("[data-account-refresh]");
  if (!nav || !panel || !list || !detail) return;

  const apiRoot = (document.body.dataset.adminApi || document.body.dataset.mediaApi) || "";
  const endpoint = `${apiRoot}/api/admin/accounts`;
  let accounts = [];
  let currentUserId = "";
  let selectedUserId = "";
  let loaded = false;

  function token() {
    return sessionStorage.getItem("dmzCustomerAccessToken") || localStorage.getItem("dmzMediaToken") || "";
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function setStatus(message, tone = "") {
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", tone === "error");
    status.classList.toggle("is-success", tone === "success");
  }

  async function request(path = "", options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    const accessToken = token();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(`${endpoint}${path}`, { ...options, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "The account update could not be completed.");
    return data;
  }

  function displayName(account) {
    const name = `${account.firstName || ""} ${account.lastName || ""}`.trim();
    return account.preferredName || name || "Unnamed account";
  }

  function renderSummary(data) {
    if (!summary) return;
    const values = [
      [data.total, "Registered accounts"],
      [data.active, "Active"],
      [data.employees, "Employees and admins"],
      [data.inactive, "Inactive or merged"],
    ];
    summary.innerHTML = values.map(([value, label]) => `<article><strong>${Number(value) || 0}</strong><span>${escapeHtml(label)}</span></article>`).join("");
  }

  function visibleAccounts() {
    const query = String(search?.value || "").trim().toLowerCase();
    const mode = String(filter?.value || "all");
    return accounts.filter((account) => {
      const haystack = `${displayName(account)} ${account.email}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (mode === "active" && account.status !== "active") return false;
      if (mode === "employee" && !(account.status === "active" && account.roles.some((role) => role === "staff" || role === "admin"))) return false;
      if (mode === "inactive" && account.status === "active") return false;
      return true;
    });
  }

  function renderList() {
    const visible = visibleAccounts();
    if (!visible.length) {
      list.innerHTML = '<div class="mgmt-account-empty">No accounts match this search.</div>';
      return;
    }
    list.innerHTML = visible.map((account) => `
      <button class="mgmt-account-card${account.userId === selectedUserId ? " is-selected" : ""}" type="button" data-account-id="${escapeHtml(account.userId)}">
        <span class="mgmt-account-card-head"><span><strong>${escapeHtml(displayName(account))}</strong><small>${escapeHtml(account.email)}</small></span><small>${account.userId === currentUserId ? "You" : ""}</small></span>
        <span class="mgmt-account-pills">
          ${account.roleLabels.map((label) => `<span class="mgmt-account-pill">${escapeHtml(label)}</span>`).join("")}
          ${account.status !== "active" ? `<span class="mgmt-account-pill is-inactive">${escapeHtml(account.status === "merged" ? "Merged" : "Inactive")}</span>` : ""}
        </span>
      </button>`).join("");
  }

  const roleDescriptions = {
    customer: "Standard access to personal details, certifications, and connected activity.",
    instructor: "Identifies a dive professional. This does not automatically grant console access.",
    staff: "Grants access to daily management tools, records, classes, trips, and site content.",
    admin: "Grants Employee access plus account roles, deactivation, and account merging.",
  };

  function renderDetail() {
    const account = accounts.find((item) => item.userId === selectedUserId);
    if (!account) {
      detail.innerHTML = '<div class="mgmt-account-empty">Select an account to review its access and connected history.</div>';
      return;
    }
    const active = account.status === "active";
    const mergeTargets = accounts.filter((candidate) => candidate.userId !== account.userId && candidate.status === "active");
    const totals = account.totals || {};
    detail.innerHTML = `
      <header><p class="management-kicker">${account.userId === currentUserId ? "Your account" : "Registered account"}</p><h2>${escapeHtml(displayName(account))}</h2><p class="mgmt-account-detail-email">${escapeHtml(account.email)}</p></header>
      <div class="mgmt-account-totals">
        <div><strong>${Number(totals.certifications) || 0}</strong><span>Certifications</span></div>
        <div><strong>${(Number(totals.registrations) || 0) + (Number(totals.reservations) || 0)}</strong><span>Activity</span></div>
        <div><strong>${Number(totals.managementRecords) || 0}</strong><span>Internal records</span></div>
      </div>
      <section>
        <h3>Account types and access</h3>
        <p>An account can have more than one type. Professional describes the diver; Employee controls console access.</p>
        <form data-role-form>
          <div class="mgmt-account-role-list">
            ${["customer", "instructor", "staff", "admin"].map((role) => `<label><input type="checkbox" name="roles" value="${role}" ${account.roles.includes(role) ? "checked" : ""} ${role === "customer" || !active ? "disabled" : ""} /><span><strong>${escapeHtml({ customer: "Diver / Customer", instructor: "Professional", staff: "Employee", admin: "Administrator" }[role])}</strong><small>${escapeHtml(roleDescriptions[role])}</small></span></label>`).join("")}
          </div>
          <div class="mgmt-account-actions"><button class="btn secondary" type="submit" ${!active ? "disabled" : ""}>Save Account Types</button></div>
        </form>
      </section>
      <section>
        <h3>${active ? "Deactivate account" : account.status === "deactivated" ? "Reactivate account" : "Merged account"}</h3>
        <p>${active ? "Deactivation immediately blocks sign-in and access to account data. The account and its history are retained." : account.status === "deactivated" ? "Reactivation restores sign-in and access without losing history." : "This duplicate can no longer sign in. Its connected history belongs to the surviving account."}</p>
        <div class="mgmt-account-actions">
          ${active ? `<button class="btn secondary mgmt-account-danger" type="button" data-deactivate ${account.userId === currentUserId ? "disabled" : ""}>Deactivate Account</button>` : account.status === "deactivated" ? '<button class="btn secondary" type="button" data-reactivate>Reactivate Account</button>' : ""}
        </div>
      </section>
      ${active && account.userId !== currentUserId && !account.roles.includes("admin") ? `<section>
        <h3>Merge duplicate account</h3>
        <p>Choose the account to keep. Bookings, certifications, documents, registrations, and linked internal records will move to it.</p>
        <form class="mgmt-account-merge-grid" data-merge-form>
          <label><span>Account to keep</span><select name="targetUserId" required><option value="">Choose the surviving account</option>${mergeTargets.map((target) => `<option value="${escapeHtml(target.userId)}">${escapeHtml(displayName(target))} — ${escapeHtml(target.email)}</option>`).join("")}</select></label>
          <label><span>Type the duplicate email to confirm</span><input name="confirmation" type="email" required placeholder="${escapeHtml(account.email)}" autocomplete="off" /></label>
          <button class="btn secondary mgmt-account-danger" type="submit">Merge This Duplicate</button>
        </form>
      </section>` : ""}`;
  }

  async function loadAccounts(options = {}) {
    setStatus("Loading accounts...");
    try {
      const data = await request();
      accounts = Array.isArray(data.accounts) ? data.accounts : [];
      currentUserId = String(data.currentUserId || "");
      if (selectedUserId && !accounts.some((account) => account.userId === selectedUserId)) selectedUserId = "";
      renderSummary(data.summary || {});
      renderList();
      renderDetail();
      loaded = true;
      setStatus(options.message || "");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function mutate(action, successMessage) {
    setStatus("Saving account changes...");
    try {
      await action();
      await loadAccounts({ message: successMessage });
      setStatus(successMessage, "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  list.addEventListener("click", (event) => {
    const card = event.target.closest("[data-account-id]");
    if (!card) return;
    selectedUserId = card.getAttribute("data-account-id") || "";
    renderList();
    renderDetail();
  });

  detail.addEventListener("submit", (event) => {
    event.preventDefault();
    const account = accounts.find((item) => item.userId === selectedUserId);
    if (!account) return;
    if (event.target.matches("[data-role-form]")) {
      const roles = Array.from(event.target.querySelectorAll('input[name="roles"]:checked')).map((input) => input.value);
      mutate(() => request(`/${encodeURIComponent(account.userId)}/roles`, { method: "PUT", body: JSON.stringify({ roles }) }), "Account types updated.");
    } else if (event.target.matches("[data-merge-form]")) {
      const formData = new FormData(event.target);
      const targetUserId = String(formData.get("targetUserId") || "");
      const confirmation = String(formData.get("confirmation") || "");
      if (!window.confirm("Merge this duplicate account? Its connected history will move to the selected account, and this login will stop working.")) return;
      mutate(() => request("/merge", { method: "POST", body: JSON.stringify({ sourceUserId: account.userId, targetUserId, confirmation }) }), "Duplicate account merged.");
    }
  });

  detail.addEventListener("click", (event) => {
    const account = accounts.find((item) => item.userId === selectedUserId);
    if (!account) return;
    if (event.target.closest("[data-deactivate]")) {
      if (!window.confirm(`Deactivate ${account.email}? They will no longer be able to sign in.`)) return;
      mutate(() => request(`/${encodeURIComponent(account.userId)}/deactivate`, { method: "POST" }), "Account deactivated.");
    }
    if (event.target.closest("[data-reactivate]")) {
      mutate(() => request(`/${encodeURIComponent(account.userId)}/reactivate`, { method: "POST" }), "Account reactivated.");
    }
  });

  search?.addEventListener("input", renderList);
  filter?.addEventListener("change", renderList);
  refresh?.addEventListener("click", () => loadAccounts());
  nav.addEventListener("click", () => { if (!loaded) loadAccounts(); });

  async function enableForAdministrator(access) {
    if (!access || !access.isAdministrator) return;
    nav.hidden = false;
  }

  window.addEventListener("dmz:management-access", (event) => enableForAdministrator(event.detail));
  const customerToken = sessionStorage.getItem("dmzCustomerAccessToken") || "";
  if (customerToken) {
    fetch(`${apiRoot}/api/admin/access`, { headers: { Authorization: `Bearer ${customerToken}`, Accept: "application/json" }, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then(enableForAdministrator)
      .catch(() => null);
  }
})();
