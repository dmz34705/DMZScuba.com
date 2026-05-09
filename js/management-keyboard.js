// Keyboard shortcuts — supplements management.js (which already owns Esc, N, /)
//
//   1  →  Dashboard          ?  →  Shortcuts help
//   2  →  Agenda             N  →  New record      (management.js)
//   3  →  Contacts           Esc →  Close drawer   (management.js)
//   4  →  Inquiries          /  →  Search          (management.js)
//   5  →  Classes
//   6  →  Calendar
//   Cmd/Ctrl+F  →  focus record search (ops panel only)

(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const dashboard    = app.querySelector("[data-management-dashboard]");
  const searchInput  = app.querySelector("[data-search-records]");
  const opsPanel     = app.querySelector('[data-site-studio-panel="operations"]');
  const overlay      = document.querySelector("[data-shortcuts-overlay]");
  const closeBtn     = document.querySelector("[data-shortcuts-close]");
  const openBtn      = document.querySelector("[data-open-shortcuts]");

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

  function openOverlay()  { if (overlay) overlay.hidden = false; }
  function closeOverlay() { if (overlay) overlay.hidden = true;  }
  function overlayOpen()  { return overlay && !overlay.hidden;   }

  // Sidebar "Shortcuts" button
  if (openBtn) openBtn.addEventListener("click", openOverlay);

  // Close button inside card
  if (closeBtn) closeBtn.addEventListener("click", closeOverlay);

  // Click outside the card to dismiss
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  document.addEventListener("keydown", (e) => {
    // Close shortcuts overlay (takes priority — fires before editor Esc logic)
    if (e.key === "Escape" && overlayOpen()) {
      closeOverlay();
      return;
    }

    if (!dashboard || dashboard.hidden) return; // only active when logged in

    // Cmd+F / Ctrl+F → focus record search
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      if (opsPanel && !opsPanel.hidden && searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Remaining shortcuts: skip if input focused, modifier held, or editor open
    if (isInputFocused() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.classList.contains("is-editor-open")) return;

    // ? → toggle shortcuts overlay
    if (e.key === "?") {
      e.preventDefault();
      overlayOpen() ? closeOverlay() : openOverlay();
      return;
    }

    if (overlayOpen()) return; // swallow other keys while overlay is visible

    // 1–6 → switch to the corresponding primary tab
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= TAB_SELECTORS.length) {
      e.preventDefault();
      const btn = app.querySelector(TAB_SELECTORS[n - 1]);
      if (btn) btn.click();
    }
  });
})();
