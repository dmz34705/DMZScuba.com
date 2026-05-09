(() => {
  "use strict";

  const STORAGE_KEY = "mgmt_hide_complete";
  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const recordList = app.querySelector("[data-record-list]");
  const opsPanel   = app.querySelector('[data-site-studio-panel="operations"]');
  if (!recordList || !opsPanel) return;

  // Default: hide complete/archived items (true = hiding)
  let hiding = localStorage.getItem(STORAGE_KEY) !== "0";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mgmt-btn-sm mgmt-hide-done-btn";
  btn.setAttribute("data-hide-done-toggle", "");

  const topbarRight = opsPanel.querySelector(".mgmt-topbar-right");
  const bulkBtn = topbarRight?.querySelector("[data-bulk-toggle]");
  if (bulkBtn) topbarRight.insertBefore(btn, bulkBtn);
  else topbarRight?.appendChild(btn);

  function apply() {
    if (hiding) {
      recordList.classList.add("is-hiding-complete");
      btn.textContent = "Show Done";
      btn.classList.add("is-active");
    } else {
      recordList.classList.remove("is-hiding-complete");
      btn.textContent = "Hide Done";
      btn.classList.remove("is-active");
    }
  }

  btn.addEventListener("click", () => {
    hiding = !hiding;
    localStorage.setItem(STORAGE_KEY, hiding ? "1" : "0");
    apply();
  });

  apply();
})();
