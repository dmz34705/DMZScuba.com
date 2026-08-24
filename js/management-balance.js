(() => {
  "use strict";

  const TOKEN_KEY = "dmzMediaToken";
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const recordList = app.querySelector("[data-record-list]");
  if (!recordList) return;

  const apiRoot      = (document.body?.dataset.adminApi || document.body?.dataset.mediaApi) || "";
  const managementUrl = apiRoot + "/api/admin/management";

  let timer = null;

  // Debounce: management.js replaces the whole list in one innerHTML assignment,
  // so the MutationObserver may fire multiple times. Wait for it to settle.
  function scheduleSync() {
    clearTimeout(timer);
    timer = setTimeout(sync, 100);
  }

  function getOutstanding(rec) {
    let e = rec.extras || {};
    if (typeof e === "string") { try { e = JSON.parse(e); } catch { e = {}; } }
    const owed = Math.max(0, Number(e.amountOwed || 0) || 0);
    const paid = Math.max(0, Number(e.amountPaid || 0) || 0);
    return Math.max(0, owed - paid);
  }

  function fmt(amount) {
    return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
  }

  async function sync() {
    const token = sessionStorage.getItem("dmzCustomerAccessToken") || localStorage.getItem(TOKEN_KEY) || "";
    if (!token) return;

    // Skip if nothing to badge
    if (!recordList.querySelector("[data-record-id]")) return;

    let records = [];
    try {
      const r = await fetch(`${managementUrl}?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      records = Array.isArray(data.items) ? data.items : [];
    } catch { return; }

    // Build id → outstanding balance map
    const balMap = new Map();
    for (const rec of records) {
      const outstanding = getOutstanding(rec);
      if (outstanding > 0) balMap.set(rec.id, outstanding);
    }

    recordList.querySelectorAll("[data-record-id]").forEach(card => {
      if (card.querySelector("[data-bal-badge]")) return;

      const outstanding = balMap.get(card.getAttribute("data-record-id"));
      if (!outstanding) return;

      const badge = document.createElement("span");
      badge.className = "management-badge mgmt-bal-badge";
      badge.setAttribute("data-bal-badge", "");
      badge.textContent = `${fmt(outstanding)} owed`;

      card.querySelector(".management-record-badges")?.appendChild(badge);
    });
  }

  new MutationObserver(scheduleSync).observe(recordList, { childList: true });
})();
