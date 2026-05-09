(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const recordForm  = app.querySelector("[data-record-form]");
  const loggerEl    = app.querySelector("[data-note-logger]");
  const logInput    = app.querySelector("[data-note-logger-input]");
  const logBtn      = app.querySelector("[data-note-logger-submit]");

  if (!recordForm || !loggerEl || !logInput || !logBtn) return;

  // Show the appender only for record types where notes is a running activity log
  const LOG_TYPES = new Set(["inquiry", "task", "contact"]);

  function updateVisibility() {
    const typeEl = recordForm.elements.recordType;
    loggerEl.hidden = !LOG_TYPES.has(typeEl ? typeEl.value : "");
  }

  function fmtToday() {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function appendEntry() {
    const text = logInput.value.trim();
    if (!text) { logInput.focus(); return; }

    const notesField = recordForm.elements.notes;
    if (!notesField || notesField.disabled) return;

    const stamp = `[${fmtToday()}] ${text}`;
    notesField.value = notesField.value
      ? `${stamp}\n\n${notesField.value}`
      : stamp;

    notesField.scrollTop = 0; // show the new entry at the top

    logInput.value = "";
    logInput.focus();
  }

  logBtn.addEventListener("click", appendEntry);
  logInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); appendEntry(); }
  });

  // Re-evaluate visibility when the record type selector changes
  const typeEl = recordForm.elements.recordType;
  if (typeEl) typeEl.addEventListener("change", updateVisibility);

  // Re-evaluate whenever the editor opens/closes (is-editor-open class on app)
  new MutationObserver(updateVisibility)
    .observe(app, { attributes: true, attributeFilter: ["class"] });

  updateVisibility();
})();
