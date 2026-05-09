(() => {
  "use strict";

  const TOKEN_KEY = "dmzMediaToken";
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const recordList = app.querySelector("[data-record-list]");
  if (!recordList) return;

  const apiRoot = (document.body?.dataset.adminApi || document.body?.dataset.mediaApi) || "";
  const managementUrl = apiRoot + "/api/admin/management";

  // currentStatus → [nextStatus, buttonLabel, isDone]
  const NEXT = {
    inquiry: {
      new:               ["to_contact",       "→ Contact",   false],
      to_contact:        ["reached_out",       "→ Contacted", false],
      reached_out:       ["gathering_details", "→ Details",   false],
      gathering_details: ["planning",          "→ Planning",  false],
      planning:          ["payment",           "→ Financial", false],
      payment:           ["timing",            "→ Timing",    false],
      timing:            ["complete",          "✓ Close",     true],
    },
    class:   { scheduled: ["active", "→ Active", false], active: ["complete", "✓ Done", true] },
    trip:    { scheduled: ["active", "→ Active", false], active: ["complete", "✓ Done", true] },
    task:    { new: ["active", "→ Active", false], scheduled: ["active", "→ Active", false],
               waiting: ["complete", "✓ Done", true], active: ["complete", "✓ Done", true] },
  };

  const RECORD_TYPES = new Set(["inquiry", "class", "trip", "task"]);

  function getType(card) {
    for (const cls of card.classList) {
      const t = cls.startsWith("is-") ? cls.slice(3) : null;
      if (t && RECORD_TYPES.has(t)) return t;
    }
    return null;
  }

  function injectButton(card) {
    if (!card.hasAttribute("data-record-id")) return;
    if (card.querySelector("[data-qa-btn]")) return;

    const type = getType(card);
    if (!type) return;

    const id = card.getAttribute("data-record-id");
    const statusSelect = card.querySelector("[data-status-change]");
    const currentStatus = statusSelect?.value;
    if (!currentStatus) return;

    const map = NEXT[type];
    const entry = map?.[currentStatus];
    if (!entry) return;

    const [nextStatus, label, isDone] = entry;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mgmt-qa-btn" + (isDone ? " is-done" : "");
    btn.setAttribute("data-qa-btn", id);
    btn.textContent = label;
    btn.title = `Advance to: ${nextStatus.replace(/_/g, " ")}`;

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = "…";

      const token = localStorage.getItem(TOKEN_KEY) || "";
      if (!token) { restore(); return; }

      // Fetch current full record so we can spread it (API requires full payload)
      let record = null;
      try {
        const r = await fetch(`${managementUrl}?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          record = (Array.isArray(data.items) ? data.items : []).find(x => x.id === id) ?? null;
        }
      } catch { /* ignore */ }

      if (!record) { restore(); return; }

      try {
        const r = await fetch(`${managementUrl}/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ record: { ...record, status: nextStatus } }),
          cache: "no-store",
        });
        if (r.ok) {
          const refreshBtn = app.querySelector("[data-refresh-records]");
          if (refreshBtn) refreshBtn.click();
        } else {
          restore();
        }
      } catch { restore(); }

      function restore() {
        btn.disabled = false;
        btn.textContent = label;
      }
    });

    const actions = card.querySelector(".management-record-actions");
    if (actions) actions.appendChild(btn);
  }

  function injectAll() {
    recordList.querySelectorAll("[data-record-id]").forEach(injectButton);
  }

  new MutationObserver(injectAll).observe(recordList, { childList: true });
})();
