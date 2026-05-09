(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const toggle = app.querySelector("[data-more-toggle]");
  const panel = app.querySelector("[data-more-panel]");
  if (!toggle || !panel) return;

  function isOpen() {
    return !panel.hidden;
  }

  function syncActiveState() {
    const anyMoreTargetActive = Array.from(
      app.querySelectorAll(".mgmt-nav-secondary, [data-site-studio-tab='media'], [data-site-studio-tab='travel']")
    ).some((button) => button.classList.contains("is-active"));
    toggle.classList.toggle("is-active", anyMoreTargetActive || isOpen());
    toggle.setAttribute("aria-expanded", isOpen() ? "true" : "false");
  }

  function open() {
    panel.hidden = false;
    syncActiveState();
  }

  function close() {
    panel.hidden = true;
    syncActiveState();
  }

  function findNavButtonByFilter(filterType) {
    return Array.from(app.querySelectorAll("[data-filter-type]"))
      .find((button) => button.getAttribute("data-filter-type") === filterType);
  }

  function findNavButtonByTab(tabName) {
    return Array.from(app.querySelectorAll("[data-site-studio-tab]"))
      .find((button) => button.getAttribute("data-site-studio-tab") === tabName);
  }

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    isOpen() ? close() : open();
  });

  panel.querySelectorAll("[data-more-filter], [data-more-tab]").forEach((item) => {
    item.addEventListener("click", () => {
      const filterType = item.getAttribute("data-more-filter") || "";
      const tabName = item.getAttribute("data-more-tab") || "";
      const original = filterType ? findNavButtonByFilter(filterType) : findNavButtonByTab(tabName);
      if (original) original.click();
      close();
    });
  });

  document.addEventListener("click", (event) => {
    if (isOpen() && !panel.contains(event.target) && event.target !== toggle && !toggle.contains(event.target)) {
      close();
    }
  });

  app.querySelectorAll(".mgmt-nav-item:not([data-more-toggle])").forEach((button) => {
    button.addEventListener("click", close);
  });

  function syncBadge(filterType) {
    const original = app.querySelector(`.mgmt-nav-secondary[data-filter-type="${filterType}"] [data-filter-count]`);
    const copy = panel.querySelector(`[data-more-badge="${filterType}"]`);
    if (original && copy) copy.textContent = original.textContent;
  }

  function syncAllBadges() {
    syncBadge("inquiry");
    syncBadge("task");
    syncBadge("registration");
  }

  ["inquiry", "task", "registration"].forEach((type) => {
    const originalBadge = app.querySelector(`.mgmt-nav-secondary[data-filter-type="${type}"] [data-filter-count]`);
    if (originalBadge) {
      new MutationObserver(syncAllBadges).observe(originalBadge, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  });

  app.querySelectorAll(".mgmt-nav-secondary, [data-site-studio-tab='media'], [data-site-studio-tab='travel']")
    .forEach((button) => {
      new MutationObserver(syncActiveState).observe(button, { attributes: true, attributeFilter: ["class"] });
    });

  syncAllBadges();
  syncActiveState();
})();
