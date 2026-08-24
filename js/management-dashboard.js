(() => {
  "use strict";

  const TOKEN_KEY = "dmzMediaToken";
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const dashPanel = app.querySelector('[data-site-studio-panel="home"]');
  const dashEl = dashPanel ? dashPanel.querySelector("[data-mgmt-dashboard]") : null;
  const recordList = app.querySelector("[data-record-list]");
  if (!dashEl) return;

  const apiRoot = (document.body?.dataset.adminApi || document.body?.dataset.mediaApi) || "";
  const managementUrl = apiRoot + "/api/admin/management";

  const CLOSED = new Set(["complete", "completed", "archived", "cancelled", "dead_end", "not_fit"]);

  // ── Utilities ──────────────────────────────────────────────────────────────

  function pad(n) { return String(n).padStart(2, "0"); }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function addDays(key, n) {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fmtDate(key) {
    if (!key) return "";
    const [y, m, da] = key.split("-").map(Number);
    return new Date(y, m - 1, da).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function fmtMoney(n) {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 0,
    }).format(n || 0);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getExtras(r) {
    try { return JSON.parse(r.extras || "{}"); } catch { return {}; }
  }

  function getBalance(r) {
    const x = getExtras(r);
    const owed = parseFloat(x.amountOwed || r.amountOwed || 0) || 0;
    const paid = parseFloat(x.amountPaid || r.amountPaid || 0) || 0;
    return Math.max(0, owed - paid);
  }

  function isOpen(r) { return !CLOSED.has(r.status); }

  function isOverdue(r) {
    if (!r.dueDate || CLOSED.has(r.status)) return false;
    return r.dueDate < todayKey();
  }

  const TYPE_LABEL = {
    contact: "Contact", inquiry: "Inquiry", class: "Class",
    trip: "Trip", task: "Task", registration: "Signup",
  };

  function fmtStatus(s) {
    return (s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async function loadRecords() {
    const token = sessionStorage.getItem("dmzCustomerAccessToken") || localStorage.getItem(TOKEN_KEY) || "";
    if (!token) return null;
    try {
      const resp = await fetch(`${managementUrl}?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => ({}));
      return Array.isArray(data.items) ? data.items : null;
    } catch { return null; }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function rowHtml(r, meta) {
    const overdueCls = isOverdue(r) ? " is-overdue" : (r.dueDate === todayKey() ? " is-today" : "");
    return `
      <li class="mgmt-dash-row${overdueCls}" data-dash-record="${esc(r.id)}"
          role="button" tabindex="0" title="Open ${esc(r.title)}">
        <span class="mgmt-dash-row-type mgmt-dash-type-${esc(r.recordType)}">${esc(TYPE_LABEL[r.recordType] || r.recordType)}</span>
        <span class="mgmt-dash-row-title">${esc(r.title)}</span>
        <span class="mgmt-dash-row-meta">${esc(meta || "")}</span>
      </li>`;
  }

  function section(title, bodyHtml) {
    return `
      <section class="mgmt-dash-section">
        <h3 class="mgmt-dash-section-hd">${esc(title)}</h3>
        ${bodyHtml}
      </section>`;
  }

  function render(records) {
    if (!records) {
      dashEl.innerHTML = '<p class="mgmt-dash-msg">Could not load dashboard data. Try refreshing.</p>';
      return;
    }

    const today = todayKey();
    const weekEnd = addDays(today, 7);

    // ── Compute stats ────────────────────────────────────────────────────────
    const workItems = records.filter(r => r.recordType !== "contact" && isOpen(r));
    const overdue   = workItems.filter(isOverdue);
    const dueToday  = workItems.filter(r => r.dueDate === today);
    const balance   = workItems.reduce((s, r) => s + getBalance(r), 0);

    // Needs attention: overdue first, then due today (no duplicates)
    const attentionSet = new Set(overdue.map(r => r.id));
    const attention = [...overdue, ...dueToday.filter(r => !attentionSet.has(r.id))];

    // Open inquiries (up to 6)
    const inquiries = records
      .filter(r => r.recordType === "inquiry" && isOpen(r))
      .slice(0, 6);

    // Open tasks (up to 6, sorted by due date)
    const tasks = records
      .filter(r => r.recordType === "task" && isOpen(r))
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate > b.dueDate ? 1 : -1;
      })
      .slice(0, 6);

    // This week: trips and classes with startDate in next 7 days
    const thisWeek = records
      .filter(r => {
        if (!["class", "trip"].includes(r.recordType)) return false;
        const start = getExtras(r).startDate;
        return start && start >= today && start <= weekEnd;
      })
      .sort((a, b) => {
        const ad = getExtras(a).startDate, bd = getExtras(b).startDate;
        return ad > bd ? 1 : -1;
      })
      .slice(0, 6);

    // ── Build HTML ────────────────────────────────────────────────────────────

    const statCard = (val, lbl, mod, scope) => `
      <div class="mgmt-dash-stat${mod ? " " + mod : ""}" data-dash-scope="${esc(scope)}"
           role="button" tabindex="0" title="Show ${esc(lbl)}">
        <span class="mgmt-dash-stat-val">${esc(String(val))}</span>
        <span class="mgmt-dash-stat-lbl">${esc(lbl)}</span>
      </div>`;

    const statsHtml = `
      <div class="mgmt-dash-stats">
        ${statCard(overdue.length,      "Overdue",      overdue.length  ? "is-urgent" : "is-ok", "overdue")}
        ${statCard(dueToday.length,     "Due Today",    dueToday.length ? "is-warn"   : "is-ok", "due_today")}
        ${statCard(workItems.length,    "Open Items",   "", "open_items")}
        ${statCard(fmtMoney(balance),   "Open Balance", balance > 0     ? "is-balance" : "", "open_balance")}
      </div>`;

    const attentionHtml = attention.length
      ? `<ul class="mgmt-dash-list">${attention.map(r => {
          const meta = isOverdue(r)
            ? `Overdue · was due ${fmtDate(r.dueDate)}`
            : "Due today";
          return rowHtml(r, meta);
        }).join("")}</ul>`
      : `<p class="mgmt-dash-msg is-good">Nothing overdue or due today — you're clear. 🎉</p>`;

    const inquiryHtml = inquiries.length
      ? `<ul class="mgmt-dash-list">${inquiries.map(r => {
          const x = getExtras(r);
          const contact = r.contactName || x.contactName || "";
          const meta = [fmtStatus(r.status), contact].filter(Boolean).join(" · ");
          return rowHtml(r, meta);
        }).join("")}</ul>`
      : `<p class="mgmt-dash-msg">No active inquiries.</p>`;

    const taskHtml = tasks.length
      ? `<ul class="mgmt-dash-list">${tasks.map(r => {
          const meta = r.dueDate
            ? (isOverdue(r) ? `Overdue · ${fmtDate(r.dueDate)}` : `Due ${fmtDate(r.dueDate)}`)
            : (r.owner ? `Owner: ${r.owner}` : "");
          return rowHtml(r, meta);
        }).join("")}</ul>`
      : `<p class="mgmt-dash-msg">No open tasks.</p>`;

    const weekHtml = thisWeek.length
      ? `<ul class="mgmt-dash-list">${thisWeek.map(r => {
          const start = getExtras(r).startDate;
          return rowHtml(r, start ? fmtDate(start) : "");
        }).join("")}</ul>`
      : `<p class="mgmt-dash-msg">Nothing scheduled this week.</p>`;

    dashEl.innerHTML = `
      ${statsHtml}
      <div class="mgmt-dash-grid">
        ${section("Needs Attention", attentionHtml)}
        ${section("Active Inquiries", inquiryHtml)}
        ${section("Open Tasks", taskHtml)}
        ${section("This Week", weekHtml)}
      </div>`;

    // ── Wire up row clicks → open record in Operations ────────────────────────
    dashEl.querySelectorAll("[data-dash-record]").forEach(el => {
      const open = () => {
        const id = el.getAttribute("data-dash-record");
        // Switch to Operations / Agenda
        const agendaBtn = app.querySelector('[data-filter-type="all"][data-site-studio-tab]');
        if (agendaBtn) agendaBtn.click();
        // Give management.js time to re-render the record list, then open the card
        setTimeout(() => {
          const card = app.querySelector(`[data-record-id="${CSS.escape(id)}"]`);
          if (card) {
            card.scrollIntoView({ block: "center", behavior: "smooth" });
            card.click();
          }
        }, 150);
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });

    dashEl.querySelectorAll("[data-dash-scope]").forEach(el => {
      const openScope = () => {
        app.dispatchEvent(new CustomEvent("dmzManagementFocus", {
          detail: { scope: el.getAttribute("data-dash-scope") || "" },
        }));
      };
      el.addEventListener("click", openScope);
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openScope(); }
      });
    });
  }

  // ── Init & refresh ────────────────────────────────────────────────────────

  let busy = false;

  async function refresh() {
    if (busy) return;
    busy = true;
    dashEl.innerHTML = '<p class="mgmt-dash-msg">Loading dashboard…</p>';
    const records = await loadRecords();
    busy = false;
    render(records);
  }

  // Watch for home panel becoming visible → refresh data
  let prevHidden = true;
  new MutationObserver(() => {
    const nowHidden = dashPanel.hidden;
    if (prevHidden && !nowHidden) refresh();
    prevHidden = nowHidden;
  }).observe(dashPanel, { attributes: true, attributeFilter: ["hidden"] });

  // Re-render when management.js saves/loads records (record list updates)
  if (recordList) {
    new MutationObserver(() => {
      if (!dashPanel.hidden) refresh();
    }).observe(recordList, { childList: true });
  }

  // Refresh button
  const refreshBtn = dashPanel ? dashPanel.querySelector("[data-dashboard-refresh]") : null;
  if (refreshBtn) refreshBtn.addEventListener("click", refresh);

  // Auto-navigate to Dashboard on login.
  // management.js calls openSiteStudioPanel("operations") synchronously inside
  // showAuthed(), so we wait one tick (setTimeout 0) to override it after.
  const dashboardSection = app.querySelector("[data-management-dashboard]");
  if (dashboardSection) {
    let wasHiddenAtLogin = dashboardSection.hidden;
    new MutationObserver(() => {
      const isNowVisible = !dashboardSection.hidden;
      if (wasHiddenAtLogin && isNowVisible) {
        setTimeout(() => {
          const homeTab = app.querySelector('[data-site-studio-tab="home"]');
          if (homeTab) homeTab.click();
        }, 0);
      }
      wasHiddenAtLogin = dashboardSection.hidden;
    }).observe(dashboardSection, { attributes: true, attributeFilter: ["hidden"] });
  }
})();
