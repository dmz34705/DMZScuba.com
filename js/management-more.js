(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const toggle = app.querySelector("[data-more-toggle]");
  const panel  = app.querySelector("[data-more-panel]");
  if (!toggle || !panel) return;

  // ── Open / close ───────────────────────────────────────────────────────────

  function isOpen()  { return !panel.hidden; }

  function open() {
    panel.hidden = false;
    toggle.classList.add("is-active");
    toggle.setAttribute("aria-expanded", "true");
  }

  function close() {
    panel.hidden = true;
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    isOpen() ? close() : open();
  });

  // ── More panel item clicks — delegate to the hidden original nav buttons ───

  panel.querySelectorAll("[data-more-item]").forEach(item => {
    item.addEventListener("click", () => {
      const filterType = item.getAttribute("data-more-item");
      const orig = app.querySelector(`.mgmt-nav-secondary[data-filter-type="${CSS.escape(filterType)}"]`);
      if (orig) orig.click();
      close();
    });
  });

  // ── Dismiss on backdrop tap ────────────────────────────────────────────────

  document.addEventListener("click", (e) => {
    if (isOpen() && !panel.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
      close();
    }
  });

  // Close when any primary nav tab is clicked (switching away)
  app.querySelectorAll(".mgmt-nav-primary").forEach(btn => {
    btn.addEventListener("click", close);
  });

  // ── Mirror badge counts from the hidden original secondary buttons ─────────

  function syncBadge(filterType) {
    const orig  = app.querySelector(`.mgmt-nav-secondary[data-filter-type="${filterType}"] [data-filter-count]`);
    const copy  = panel.querySelector(`[data-more-badge="${filterType}"]`);
    if (orig && copy) copy.textContent = orig.textContent;
  }

  function syncAllBadges() {
    syncBadge("task");
    syncBadge("registration");
  }

  // Observe each original badge for text changes
  ["task", "registration"].forEach(type => {
    const origBadge = app.querySelector(`.mgmt-nav-secondary[data-filter-type="${type}"] [data-filter-count]`);
    if (origBadge) {
      new MutationObserver(syncAllBadges).observe(origBadge, { childList: true, characterData: true, subtree: true });
    }
  });

  syncAllBadges();

  // ── Reflect active state: light up More toggle when Tasks/Signups is active ─

  function syncActiveState() {
    const anyActive = Array.from(app.querySelectorAll(".mgmt-nav-secondary"))
      .some(b => b.classList.contains("is-active"));
    toggle.classList.toggle("is-active", anyActive || isOpen());
  }

  app.querySelectorAll(".mgmt-nav-secondary").forEach(btn => {
    new MutationObserver(syncActiveState).observe(btn, { attributes: true, attributeFilter: ["class"] });
  });
})();
