(() => {
  "use strict";

  const TOKEN_KEY = "dmzMediaToken";
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const recordList = app.querySelector("[data-record-list]");
  const opsPanel   = app.querySelector('[data-site-studio-panel="operations"]');
  if (!recordList || !opsPanel) return;

  const apiRoot      = (document.body?.dataset.adminApi || document.body?.dataset.mediaApi) || "";
  const managementUrl = apiRoot + "/api/admin/management";

  let bulkMode = false;
  const selected = new Set();

  // ── Injected UI refs ───────────────────────────────────────────────────────

  let selectBtn, bulkBar, bulkCount, bulkStatusSelect, bulkApplyBtn, bulkCancelBtn, selectAllBtn;

  function buildUI() {
    // "Select" button — inserted into the operations topbar before "+ New"
    selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "mgmt-btn-sm";
    selectBtn.setAttribute("data-bulk-toggle", "");
    selectBtn.textContent = "Select";
    selectBtn.addEventListener("click", () => bulkMode ? exitBulkMode() : enterBulkMode());

    const topbarRight = opsPanel.querySelector(".mgmt-topbar-right");
    const newBtn = topbarRight?.querySelector("[data-new-record]");
    if (newBtn) topbarRight.insertBefore(selectBtn, newBtn);
    else topbarRight?.appendChild(selectBtn);

    // Bulk action bar — inserted between topbar and ops-body
    bulkBar = document.createElement("div");
    bulkBar.className = "mgmt-bulk-bar";
    bulkBar.setAttribute("data-bulk-bar", "");
    bulkBar.hidden = true;
    bulkBar.innerHTML = `
      <div class="mgmt-bulk-bar-left">
        <span class="mgmt-bulk-count" data-bulk-count>0 selected</span>
        <button class="mgmt-bulk-sel-all" type="button" data-bulk-select-all>Select All</button>
      </div>
      <div class="mgmt-bulk-bar-right">
        <label class="mgmt-bulk-status-wrap">
          <span>Status:</span>
          <select data-bulk-status>
            <option value="new">New</option>
            <option value="active">Active</option>
            <option value="waiting">Waiting</option>
            <option value="scheduled">Scheduled</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button class="mgmt-bulk-apply" type="button" data-bulk-apply disabled>Apply</button>
        <button class="mgmt-bulk-cancel" type="button" data-bulk-cancel>✕</button>
      </div>
    `;

    opsPanel.querySelector(".mgmt-topbar")?.insertAdjacentElement("afterend", bulkBar);

    bulkCount        = bulkBar.querySelector("[data-bulk-count]");
    bulkStatusSelect = bulkBar.querySelector("[data-bulk-status]");
    bulkApplyBtn     = bulkBar.querySelector("[data-bulk-apply]");
    bulkCancelBtn    = bulkBar.querySelector("[data-bulk-cancel]");
    selectAllBtn     = bulkBar.querySelector("[data-bulk-select-all]");

    bulkCancelBtn.addEventListener("click", exitBulkMode);
    bulkApplyBtn.addEventListener("click", applyBulk);
    selectAllBtn.addEventListener("click", toggleSelectAll);
  }

  // ── Enter / exit bulk mode ─────────────────────────────────────────────────

  function enterBulkMode() {
    bulkMode = true;
    selected.clear();
    recordList.classList.add("is-bulk-mode");
    bulkBar.hidden = false;
    selectBtn.classList.add("is-active");
    selectBtn.textContent = "Cancel";
    injectAllCheckboxes();
    updateCount();
  }

  function exitBulkMode() {
    bulkMode = false;
    selected.clear();
    recordList.classList.remove("is-bulk-mode");
    recordList.querySelectorAll("[data-bulk-check]").forEach(el => el.remove());
    recordList.querySelectorAll(".is-bulk-checked").forEach(c => c.classList.remove("is-bulk-checked"));
    bulkBar.hidden = true;
    selectBtn.classList.remove("is-active");
    selectBtn.textContent = "Select";
  }

  // ── Checkbox injection ─────────────────────────────────────────────────────

  function injectCheckbox(card) {
    if (!card.hasAttribute("data-record-id")) return;
    if (card.querySelector("[data-bulk-check]")) return;

    const id  = card.getAttribute("data-record-id");
    const btn = document.createElement("button");
    btn.type      = "button";
    btn.className = "mgmt-bulk-check";
    btn.setAttribute("data-bulk-check", id);
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Select record");

    if (selected.has(id)) {
      btn.classList.add("is-checked");
      btn.setAttribute("aria-pressed", "true");
      card.classList.add("is-bulk-checked");
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (selected.has(id)) {
        selected.delete(id);
        btn.classList.remove("is-checked");
        btn.setAttribute("aria-pressed", "false");
        card.classList.remove("is-bulk-checked");
      } else {
        selected.add(id);
        btn.classList.add("is-checked");
        btn.setAttribute("aria-pressed", "true");
        card.classList.add("is-bulk-checked");
      }
      updateCount();
    });

    // Absolute-positioned, so DOM order inside card doesn't affect layout
    card.appendChild(btn);
  }

  function injectAllCheckboxes() {
    recordList.querySelectorAll("[data-record-id]").forEach(injectCheckbox);
  }

  // ── Select / deselect all ──────────────────────────────────────────────────

  function toggleSelectAll() {
    const cards = [...recordList.querySelectorAll("[data-record-id]")];
    const allSelected = cards.length > 0 && cards.every(c => selected.has(c.getAttribute("data-record-id")));

    cards.forEach(card => {
      const id = card.getAttribute("data-record-id");
      const cb = card.querySelector("[data-bulk-check]");
      if (allSelected) {
        selected.delete(id);
        card.classList.remove("is-bulk-checked");
        cb?.classList.remove("is-checked");
        cb?.setAttribute("aria-pressed", "false");
      } else {
        selected.add(id);
        card.classList.add("is-bulk-checked");
        cb?.classList.add("is-checked");
        cb?.setAttribute("aria-pressed", "true");
      }
    });
    updateCount();
  }

  // ── Count / button state ───────────────────────────────────────────────────

  function updateCount() {
    const n = selected.size;
    bulkCount.textContent = n === 1 ? "1 selected" : `${n} selected`;
    bulkApplyBtn.disabled = n === 0;
    bulkApplyBtn.textContent = n > 0 ? `Apply to ${n}` : "Apply";

    const cards = [...recordList.querySelectorAll("[data-record-id]")];
    const allSel = cards.length > 0 && cards.every(c => selected.has(c.getAttribute("data-record-id")));
    selectAllBtn.textContent = allSel ? "Deselect All" : "Select All";
  }

  // ── Apply bulk status change ───────────────────────────────────────────────

  async function applyBulk() {
    if (selected.size === 0) return;
    const newStatus = bulkStatusSelect.value;
    const ids = [...selected];

    bulkApplyBtn.disabled  = true;
    bulkApplyBtn.textContent = "Saving…";
    bulkCancelBtn.disabled = true;

    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) { resetBar(); return; }

    // Fetch all records once so we can spread individual records for PUT
    let allRecords = [];
    try {
      const r = await fetch(`${managementUrl}?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        allRecords = Array.isArray(data.items) ? data.items : [];
      }
    } catch { resetBar(); return; }

    await Promise.all(ids.map(async (id) => {
      const record = allRecords.find(x => x.id === id);
      if (!record) return;
      try {
        await fetch(`${managementUrl}/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ record: { ...record, status: newStatus } }),
          cache: "no-store",
        });
      } catch { /* individual failures don't abort the batch */ }
    }));

    exitBulkMode();
    app.querySelector("[data-refresh-records]")?.click();
  }

  function resetBar() {
    const n = selected.size;
    bulkApplyBtn.disabled    = n === 0;
    bulkApplyBtn.textContent = n > 0 ? `Apply to ${n}` : "Apply";
    bulkCancelBtn.disabled   = false;
  }

  // ── Observers ─────────────────────────────────────────────────────────────

  // Management.js replaces the entire record list on refresh — exit bulk mode when that happens
  new MutationObserver(() => {
    if (bulkMode) exitBulkMode();
  }).observe(recordList, { childList: true });

  // Editor opening while in bulk mode — exit gracefully
  new MutationObserver(() => {
    if (bulkMode && app.classList.contains("is-editor-open")) exitBulkMode();
  }).observe(app, { attributes: true, attributeFilter: ["class"] });

  buildUI();
})();
