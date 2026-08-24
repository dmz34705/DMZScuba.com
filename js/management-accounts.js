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
  const modeButtons = Array.from(app.querySelectorAll("[data-account-mode]"));
  if (!nav || !panel || !list || !detail) return;

  const apiRoot = (document.body.dataset.adminApi || document.body.dataset.mediaApi) || "";
  const accountsEndpoint = `${apiRoot}/api/admin/accounts`;
  const archivesEndpoint = `${apiRoot}/api/admin/account-archives`;
  let accounts = [];
  let archives = [];
  let currentUserId = "";
  let selectedUserId = "";
  let selectedArchiveId = "";
  let archiveDetail = null;
  let deletionConfigured = false;
  let viewMode = "current";
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

  async function requestAt(endpoint, path = "", options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    const accessToken = token();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(`${endpoint}${path}`, { ...options, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "The account update could not be completed.");
    return data;
  }

  const request = (path = "", options = {}) => requestAt(accountsEndpoint, path, options);
  const archiveRequest = (path = "", options = {}) => requestAt(archivesEndpoint, path, options);

  function displayName(account) {
    const name = `${account.firstName || ""} ${account.lastName || ""}`.trim();
    return account.preferredName || name || "Unnamed account";
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
  }

  function renderSummary(data = {}) {
    if (!summary) return;
    const values = viewMode === "archived"
      ? [[archives.length, "Archived accounts"], ["Protected", "Stored separately"], ["TXT / JSON", "Available downloads"], ["Admin only", "Restricted access"]]
      : [[data.total, "Registered accounts"], [data.active, "Active"], [data.employees, "Employees and admins"], [data.inactive, "Inactive or merged"]];
    summary.innerHTML = values.map(([value, label]) => `<article><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`).join("");
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

  function visibleArchives() {
    const query = String(search?.value || "").trim().toLowerCase();
    return archives.filter((archive) => `${displayName(archive)} ${archive.email} ${archive.reason || ""}`.toLowerCase().includes(query));
  }

  function renderList() {
    if (viewMode === "archived") {
      const visible = visibleArchives();
      if (!visible.length) {
        list.innerHTML = `<div class="mgmt-account-empty">${archives.length ? "No archived accounts match this search." : "There are no archived accounts."}</div>`;
        return;
      }
      list.innerHTML = visible.map((archive) => `
        <button class="mgmt-account-card${archive.id === selectedArchiveId ? " is-selected" : ""}" type="button" data-archive-id="${escapeHtml(archive.id)}">
          <span class="mgmt-account-card-head"><span><strong>${escapeHtml(displayName(archive))}</strong><small>${escapeHtml(archive.email)}</small></span><small>${escapeHtml(formatDate(archive.archivedAt))}</small></span>
          <span class="mgmt-account-pills"><span class="mgmt-account-pill is-inactive">Archived</span></span>
        </button>`).join("");
      return;
    }

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

  function archiveSection(account) {
    if (account.status === "active" || account.userId === currentUserId) return "";
    const blockedByRole = account.roles.includes("admin");
    const unavailable = !deletionConfigured || blockedByRole;
    let notice = "This permanently deletes the website and app login plus operational records. A protected snapshot remains under Archived Accounts.";
    if (!deletionConfigured) notice = "Server setup is required before permanent deletion is available. Add the Supabase service-role key to the Worker secrets.";
    if (blockedByRole) notice = "Reactivate this account, remove Administrator access, and deactivate it again before archiving.";
    return `<section class="mgmt-account-archive-section">
      <h3>Archive and delete account</h3>
      <p>${escapeHtml(notice)}</p>
      <form class="mgmt-account-merge-grid" data-archive-form>
        <label><span>Reason (optional)</span><input name="reason" maxlength="500" placeholder="For example: customer requested account deletion" ${unavailable ? "disabled" : ""} /></label>
        <label><span>Type the account email</span><input name="confirmation" type="email" required placeholder="${escapeHtml(account.email)}" autocomplete="off" ${unavailable ? "disabled" : ""} /></label>
        <label><span>Type ARCHIVE to confirm</span><input name="phrase" required autocomplete="off" ${unavailable ? "disabled" : ""} /></label>
        <button class="btn secondary mgmt-account-danger" type="submit" ${unavailable ? "disabled" : ""}>Archive and Delete</button>
      </form>
    </section>`;
  }

  function renderCurrentDetail() {
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
        <p>${active ? "Deactivation immediately blocks sign-in on the website and mobile app. The account and its history are retained." : account.status === "deactivated" ? "Reactivation restores website and app sign-in without losing history." : "This duplicate can no longer sign in. Its connected history belongs to the surviving account."}</p>
        <div class="mgmt-account-actions">
          ${active ? `<button class="btn secondary mgmt-account-danger" type="button" data-deactivate ${account.userId === currentUserId ? "disabled" : ""}>Deactivate Account</button>` : account.status === "deactivated" ? '<button class="btn secondary" type="button" data-reactivate>Reactivate Account</button>' : ""}
        </div>
      </section>
      ${active && account.userId !== currentUserId && !account.roles.includes("admin") ? `<section>
        <h3>Merge duplicate account</h3>
        <p>Choose the account to keep. Bookings, certifications, app settings, documents, registrations, and linked internal records will move to it.</p>
        <form class="mgmt-account-merge-grid" data-merge-form>
          <label><span>Account to keep</span><select name="targetUserId" required><option value="">Choose the surviving account</option>${mergeTargets.map((target) => `<option value="${escapeHtml(target.userId)}">${escapeHtml(displayName(target))} — ${escapeHtml(target.email)}</option>`).join("")}</select></label>
          <label><span>Type the duplicate email to confirm</span><input name="confirmation" type="email" required placeholder="${escapeHtml(account.email)}" autocomplete="off" /></label>
          <button class="btn secondary mgmt-account-danger" type="submit">Merge This Duplicate</button>
        </form>
      </section>` : ""}
      ${archiveSection(account)}`;
  }

  function archiveTotals(snapshot = {}) {
    return {
      certifications: Array.isArray(snapshot.certifications) ? snapshot.certifications.length : 0,
      activity: (Array.isArray(snapshot.eventRegistrations) ? snapshot.eventRegistrations.length : 0) + (Array.isArray(snapshot.reservations) ? snapshot.reservations.length : 0),
      internal: Array.isArray(snapshot.managementRecords) ? snapshot.managementRecords.length : 0,
    };
  }

  function renderArchiveDetail() {
    if (!selectedArchiveId) {
      detail.innerHTML = '<div class="mgmt-account-empty">Select an archived account to review or download its protected record.</div>';
      return;
    }
    if (!archiveDetail || archiveDetail.id !== selectedArchiveId) {
      detail.innerHTML = '<div class="mgmt-account-empty">Loading archived account...</div>';
      return;
    }
    const archive = archiveDetail;
    const snapshot = archive.snapshot || {};
    const totals = archiveTotals(snapshot);
    detail.innerHTML = `
      <header><p class="management-kicker">Archived account</p><h2>${escapeHtml(displayName(archive))}</h2><p class="mgmt-account-detail-email">${escapeHtml(archive.email)}</p></header>
      <div class="mgmt-account-archive-meta"><span>Archived ${escapeHtml(formatDate(archive.archivedAt))}</span>${archive.reason ? `<span>Reason: ${escapeHtml(archive.reason)}</span>` : ""}</div>
      <div class="mgmt-account-totals">
        <div><strong>${totals.certifications}</strong><span>Certifications</span></div>
        <div><strong>${totals.activity}</strong><span>Activity</span></div>
        <div><strong>${totals.internal}</strong><span>Internal records</span></div>
      </div>
      <section>
        <h3>Protected archive</h3>
        <p>The website and app login no longer exist. This read-only snapshot is restricted to administrators.</p>
        <div class="mgmt-account-actions">
          <button class="btn secondary" type="button" data-archive-download="txt">Download TXT</button>
          <button class="btn secondary" type="button" data-archive-download="json">Download JSON</button>
        </div>
        <details class="mgmt-account-snapshot"><summary>View complete archived snapshot</summary><pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre></details>
      </section>
      <section class="mgmt-account-archive-section">
        <h3>Permanently purge archive</h3>
        <p>This removes the last stored copy of the customer’s personal data. It cannot be recovered.</p>
        <form class="mgmt-account-merge-grid" data-purge-form>
          <label><span>Type the archived email</span><input name="confirmation" type="email" required placeholder="${escapeHtml(archive.email)}" autocomplete="off" /></label>
          <label><span>Type PERMANENTLY DELETE</span><input name="phrase" required autocomplete="off" /></label>
          <button class="btn secondary mgmt-account-danger" type="submit">Permanently Purge Archive</button>
        </form>
      </section>`;
  }

  function renderDetail() {
    if (viewMode === "archived") renderArchiveDetail();
    else renderCurrentDetail();
  }

  function updateModeControls() {
    modeButtons.forEach((button) => {
      const active = button.dataset.accountMode === viewMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (filter) filter.hidden = viewMode === "archived";
    if (search) {
      search.value = "";
      search.placeholder = viewMode === "archived" ? "Search archived accounts" : "Search name or email";
      search.setAttribute("aria-label", viewMode === "archived" ? "Search archived accounts" : "Search accounts");
    }
  }

  async function loadAccounts(options = {}) {
    setStatus("Loading accounts...");
    try {
      const data = await request();
      accounts = Array.isArray(data.accounts) ? data.accounts : [];
      currentUserId = String(data.currentUserId || "");
      deletionConfigured = Boolean(data.accountArchiveDeletionConfigured);
      if (selectedUserId && !accounts.some((account) => account.userId === selectedUserId)) selectedUserId = "";
      renderSummary(data.summary || {});
      renderList();
      renderDetail();
      loaded = true;
      setStatus(options.message || "", options.message ? "success" : "");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function loadArchives(options = {}) {
    setStatus("Loading archived accounts...");
    try {
      const data = await archiveRequest();
      archives = Array.isArray(data.archives) ? data.archives : [];
      if (selectedArchiveId && !archives.some((archive) => archive.id === selectedArchiveId)) {
        selectedArchiveId = "";
        archiveDetail = null;
      }
      renderSummary();
      renderList();
      renderDetail();
      loaded = true;
      setStatus(options.message || "", options.message ? "success" : "");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function loadArchiveDetail(archiveId) {
    setStatus("Loading archived account...");
    try {
      const data = await archiveRequest(`/${encodeURIComponent(archiveId)}`);
      if (selectedArchiveId !== archiveId) return;
      archiveDetail = data.archive || null;
      renderDetail();
      setStatus("");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function mutate(action, successMessage) {
    setStatus("Saving account changes...");
    try {
      await action();
      await loadAccounts({ message: successMessage });
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function setMode(nextMode) {
    if (!['current', 'archived'].includes(nextMode) || nextMode === viewMode) return;
    viewMode = nextMode;
    updateModeControls();
    if (viewMode === "archived") await loadArchives();
    else await loadAccounts();
  }

  async function downloadArchive(format) {
    const accessToken = token();
    const response = await fetch(`${archivesEndpoint}/${encodeURIComponent(selectedArchiveId)}/download?format=${encodeURIComponent(format)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: format === "json" ? "application/json" : "text/plain" },
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "The archive download could not be created.");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i);
    const filename = match ? match[1] : `dmz-account-archive.${format}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  list.addEventListener("click", (event) => {
    const archiveCard = event.target.closest("[data-archive-id]");
    if (archiveCard) {
      selectedArchiveId = archiveCard.getAttribute("data-archive-id") || "";
      archiveDetail = null;
      renderList();
      renderDetail();
      loadArchiveDetail(selectedArchiveId);
      return;
    }
    const card = event.target.closest("[data-account-id]");
    if (!card) return;
    selectedUserId = card.getAttribute("data-account-id") || "";
    renderList();
    renderDetail();
  });

  detail.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.matches("[data-purge-form]")) {
      if (!archiveDetail || !window.confirm("Permanently purge this archive? No customer data will remain, and this cannot be undone.")) return;
      const formData = new FormData(event.target);
      setStatus("Permanently purging archive...");
      try {
        await archiveRequest(`/${encodeURIComponent(archiveDetail.id)}`, { method: "DELETE", body: JSON.stringify({ confirmation: formData.get("confirmation"), phrase: formData.get("phrase") }) });
        selectedArchiveId = "";
        archiveDetail = null;
        await loadArchives({ message: "Archived personal data permanently purged." });
      } catch (error) {
        setStatus(error.message, "error");
      }
      return;
    }

    const account = accounts.find((item) => item.userId === selectedUserId);
    if (!account) return;
    if (event.target.matches("[data-role-form]")) {
      const roles = Array.from(event.target.querySelectorAll('input[name="roles"]:checked')).map((input) => input.value);
      mutate(() => request(`/${encodeURIComponent(account.userId)}/roles`, { method: "PUT", body: JSON.stringify({ roles }) }), "Account types updated.");
    } else if (event.target.matches("[data-merge-form]")) {
      const formData = new FormData(event.target);
      if (!window.confirm("Merge this duplicate account? Its connected history and app settings will move to the selected account, and this login will stop working.")) return;
      mutate(() => request("/merge", { method: "POST", body: JSON.stringify({ sourceUserId: account.userId, targetUserId: formData.get("targetUserId"), confirmation: formData.get("confirmation") }) }), "Duplicate account merged.");
    } else if (event.target.matches("[data-archive-form]")) {
      if (!window.confirm("Archive and delete this account? Its website and app login will be permanently deleted. A protected snapshot will remain in Archived Accounts.")) return;
      const formData = new FormData(event.target);
      setStatus("Archiving account and deleting its login...");
      try {
        const data = await request(`/${encodeURIComponent(account.userId)}/archive`, { method: "POST", body: JSON.stringify({ reason: formData.get("reason"), confirmation: formData.get("confirmation"), phrase: formData.get("phrase") }) });
        selectedArchiveId = String(data.archiveId || "");
        archiveDetail = null;
        viewMode = "archived";
        updateModeControls();
        await loadArchives({ message: "Account archived; its website and app login were deleted." });
        if (selectedArchiveId) await loadArchiveDetail(selectedArchiveId);
      } catch (error) {
        setStatus(error.message, "error");
      }
    }
  });

  detail.addEventListener("click", async (event) => {
    const download = event.target.closest("[data-archive-download]");
    if (download && selectedArchiveId) {
      setStatus("Preparing archive download...");
      try {
        await downloadArchive(download.dataset.archiveDownload || "txt");
        setStatus("Archive download ready.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      }
      return;
    }
    const account = accounts.find((item) => item.userId === selectedUserId);
    if (!account) return;
    if (event.target.closest("[data-deactivate]")) {
      if (!window.confirm(`Deactivate ${account.email}? They will no longer be able to sign in on the website or mobile app.`)) return;
      mutate(() => request(`/${encodeURIComponent(account.userId)}/deactivate`, { method: "POST" }), "Account deactivated.");
    }
    if (event.target.closest("[data-reactivate]")) {
      mutate(() => request(`/${encodeURIComponent(account.userId)}/reactivate`, { method: "POST" }), "Account reactivated.");
    }
  });

  search?.addEventListener("input", renderList);
  filter?.addEventListener("change", renderList);
  refresh?.addEventListener("click", () => viewMode === "archived" ? loadArchives() : loadAccounts());
  modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.accountMode || "current")));
  nav.addEventListener("click", () => { if (!loaded) loadAccounts(); });

  async function enableForAdministrator(access) {
    if (!access || !access.isAdministrator) return;
    deletionConfigured = Boolean(access.accountArchiveDeletionConfigured);
    nav.hidden = false;
    app.querySelectorAll("[data-accounts-shortcut], [data-accounts-more]").forEach((shortcut) => { shortcut.hidden = false; });
  }

  window.addEventListener("dmz:management-access", (event) => enableForAdministrator(event.detail));
  const accessToken = token();
  if (accessToken) {
    fetch(`${apiRoot}/api/admin/access`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then(enableForAdministrator)
      .catch(() => null);
  }
})();
