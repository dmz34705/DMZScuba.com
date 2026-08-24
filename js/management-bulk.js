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

  let selectBtn, bulkBar, bulkCount, bulkActionSelect, bulkStatusSelect, bulkFollowUpInput,
    bulkPrioritySelect, bulkApplyBtn, bulkCancelBtn, selectAllBtn;

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
          <span>Action:</span>
          <select data-bulk-action>
            <option value="complete">Mark as complete</option>
            <option value="follow-up">Set follow-up date</option>
            <option value="status">Change status</option>
            <option value="priority">Change priority</option>
            <option value="archive">Archive</option>
            <option value="delete">Delete permanently</option>
          </select>
        </label>
        <label class="mgmt-bulk-status-wrap" data-bulk-status-wrap hidden>
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
        <label class="mgmt-bulk-status-wrap" data-bulk-follow-up-wrap hidden>
          <span>Follow-up:</span>
          <input type="date" data-bulk-follow-up aria-label="New follow-up date" />
        </label>
        <label class="mgmt-bulk-status-wrap" data-bulk-priority-wrap hidden>
          <span>Priority:</span>
          <select data-bulk-priority>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal" selected>Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
        <button class="mgmt-bulk-apply" type="button" data-bulk-apply disabled>Apply</button>
        <button class="mgmt-bulk-cancel" type="button" data-bulk-cancel>✕</button>
      </div>
    `;

    opsPanel.querySelector(".mgmt-topbar")?.insertAdjacentElement("afterend", bulkBar);

    bulkCount        = bulkBar.querySelector("[data-bulk-count]");
    bulkActionSelect  = bulkBar.querySelector("[data-bulk-action]");
    bulkStatusSelect = bulkBar.querySelector("[data-bulk-status]");
    bulkFollowUpInput = bulkBar.querySelector("[data-bulk-follow-up]");
    bulkPrioritySelect = bulkBar.querySelector("[data-bulk-priority]");
    bulkApplyBtn     = bulkBar.querySelector("[data-bulk-apply]");
    bulkCancelBtn    = bulkBar.querySelector("[data-bulk-cancel]");
    selectAllBtn     = bulkBar.querySelector("[data-bulk-select-all]");

    bulkCancelBtn.addEventListener("click", exitBulkMode);
    bulkApplyBtn.addEventListener("click", applyBulk);
    selectAllBtn.addEventListener("click", toggleSelectAll);
    bulkActionSelect.addEventListener("change", updateActionControls);
    updateActionControls();
  }

  function updateActionControls() {
    const action = bulkActionSelect?.value || "complete";
    bulkBar.querySelector("[data-bulk-status-wrap]").hidden = action !== "status";
    bulkBar.querySelector("[data-bulk-follow-up-wrap]").hidden = action !== "follow-up";
    bulkBar.querySelector("[data-bulk-priority-wrap]").hidden = action !== "priority";
    if (bulkApplyBtn) {
      const labels = {
        complete: "Complete", "follow-up": "Set Date", status: "Update Status",
        priority: "Update Priority", archive: "Archive", delete: "Delete",
      };
      bulkApplyBtn.dataset.actionLabel = labels[action] || "Apply";
      updateCount();
    }
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
    const actionLabel = bulkApplyBtn.dataset.actionLabel || "Apply";
    bulkApplyBtn.textContent = n > 0 ? `${actionLabel} ${n}` : actionLabel;

    const cards = [...recordList.querySelectorAll("[data-record-id]")];
    const allSel = cards.length > 0 && cards.every(c => selected.has(c.getAttribute("data-record-id")));
    selectAllBtn.textContent = allSel ? "Deselect All" : "Select All";
  }

  // ── Apply bulk status change ───────────────────────────────────────────────

  async function applyBulk() {
    if (selected.size === 0) return;
    const action = bulkActionSelect.value;
    const ids = [...selected];
    const followUpDate = bulkFollowUpInput.value;

    if (action === "follow-up" && !followUpDate) {
      bulkFollowUpInput.focus();
      return;
    }
    if (action === "delete" && !confirm(`Delete ${ids.length} selected record${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }

    bulkApplyBtn.disabled  = true;
    bulkApplyBtn.textContent = "Saving…";
    bulkCancelBtn.disabled = true;

    const token = sessionStorage.getItem("dmzCustomerAccessToken") || localStorage.getItem(TOKEN_KEY) || "";
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
        if (action === "delete") {
          await fetch(`${managementUrl}/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          return;
        }
        const patch = (() => {
          if (action === "complete") return { status: "complete", dueDate: "" };
          if (action === "archive") return { status: "archived", dueDate: "" };
          if (action === "follow-up") return { dueDate: followUpDate };
          if (action === "priority") return { priority: bulkPrioritySelect.value };
          return { status: bulkStatusSelect.value };
        })();
        await fetch(`${managementUrl}/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ record: { ...record, ...patch } }),
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
    const actionLabel = bulkApplyBtn.dataset.actionLabel || "Apply";
    bulkApplyBtn.textContent = n > 0 ? `${actionLabel} ${n}` : actionLabel;
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
