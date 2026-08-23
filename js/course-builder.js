(() => {
  const form = document.getElementById("courseBuilderForm");
  if (!form) return;
  const courseInput = document.getElementById("cb-course");
  const openWaterFormatRow = document.getElementById("cb-open-water-format-row");
  const openWaterFormatInput = document.getElementById("cb-open-water-format");

  const OPEN_WATER_COURSES = new Set(["sdi-open-water", "sdi-youth-open-water"]);

  function syncOpenWaterFormatVisibility() {
    if (!courseInput || !openWaterFormatRow || !openWaterFormatInput) return;
    const isOpenWaterCourse = OPEN_WATER_COURSES.has(String(courseInput.value || "").trim());
    openWaterFormatRow.hidden = !isOpenWaterCourse;
    openWaterFormatInput.required = isOpenWaterCourse;
    if (!isOpenWaterCourse) {
      openWaterFormatInput.value = "";
      const dropdown = openWaterFormatInput.closest("[data-dropdown]");
      const valueEl = dropdown ? dropdown.querySelector(".dropdown-value") : null;
      if (valueEl) valueEl.textContent = "Select Open Water format...";
      openWaterFormatInput.classList.remove("needs-input", "is-prefilled");
      const wrapper = openWaterFormatInput.closest(".field");
      if (wrapper) {
        wrapper.classList.remove("needs-input", "is-prefilled");
      }
    }
  }

  syncOpenWaterFormatVisibility();
  if (courseInput) {
    courseInput.addEventListener("input", syncOpenWaterFormatVisibility);
    courseInput.addEventListener("change", syncOpenWaterFormatVisibility);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (window.DMZTelemetry && typeof window.DMZTelemetry.report === "function") {
      window.DMZTelemetry.report("training_inquiry_submit_attempt", {
        course: String((courseInput && courseInput.value) || "unspecified"),
        sourcePage: window.DMZTelemetry.sourcePage(
          new URLSearchParams(window.location.search).get("source_page") || document.referrer
        ),
      });
    }
    if (window.DMZForms && typeof window.DMZForms.submit === "function") {
      const thanksUrl = `${window.location.origin}/pages/thanks/index.html`;
      window.DMZForms.submit(form, { requireEmail: true, redirectUrl: thanksUrl });
      return;
    }
    if (!form.reportValidity()) return;
  });
})();
