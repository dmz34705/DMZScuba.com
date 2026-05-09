(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const checkbox = app.querySelector("input[data-show-past-calendar]");
  if (!checkbox) return;

  // Keep the checkbox in the DOM (management.js holds a reference to it),
  // but hide its label so only our button is visible.
  const label = checkbox.closest("label");
  if (label) label.hidden = true;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mgmt-btn-sm";
  btn.setAttribute("data-past-cal-toggle", "");

  function update() {
    if (checkbox.checked) {
      btn.textContent = "Hide Past";
      btn.classList.remove("is-active");
    } else {
      btn.textContent = "Show Past";
      btn.classList.add("is-active");
    }
  }

  btn.addEventListener("click", () => {
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    update();
  });

  // Insert button in place of the hidden label
  const calRow = checkbox.closest(".mgmt-cal-row");
  if (calRow) calRow.insertBefore(btn, calRow.firstChild);

  update();
})();
