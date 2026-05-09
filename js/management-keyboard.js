// Keyboard shortcuts — supplements management.js (which already owns Esc, N, /)
//
//   1  →  Dashboard
//   2  →  Agenda
//   3  →  Contacts
//   4  →  Inquiries
//   5  →  Classes
//   6  →  Calendar
//   Cmd/Ctrl+F  →  focus record search (ops panel only)

(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const dashboard   = app.querySelector("[data-management-dashboard]");
  const searchInput = app.querySelector("[data-search-records]");
  const opsPanel    = app.querySelector('[data-site-studio-panel="operations"]');

  // Primary nav buttons in tab-key order
  const TAB_SELECTORS = [
    '[data-site-studio-tab="home"]',                  // 1 — Dashboard
    '[data-filter-type="all"][data-site-studio-tab]', // 2 — Agenda
    '[data-filter-type="contact"]',                   // 3 — Contacts
    '[data-filter-type="inquiry"]',                   // 4 — Inquiries
    '[data-filter-type="class"]',                     // 5 — Classes
    '[data-filter-type="trip"]',                      // 6 — Calendar
  ];

  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const t = el.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el.isContentEditable;
  }

  document.addEventListener("keydown", (e) => {
    if (!dashboard || dashboard.hidden) return; // only active when logged in

    // Cmd+F / Ctrl+F → focus record search (suppresses browser find on ops panel)
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      if (opsPanel && !opsPanel.hidden && searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Remaining shortcuts require: no input focused, no modifiers, editor closed
    if (isInputFocused() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.classList.contains("is-editor-open")) return;

    // 1–6 → switch to the corresponding primary tab
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= TAB_SELECTORS.length) {
      e.preventDefault();
      const btn = app.querySelector(TAB_SELECTORS[n - 1]);
      if (btn) btn.click();
    }
  });
})();
