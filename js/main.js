console.log("main.js loaded");

(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();


// =========================
// DMZ Scuba — main.js
// Unified helpers: toast, copy, quick mailto (no backend)
// =========================

(() => {
  // Simple toast (visual confirmation)
  function ensureToast() {
    let toast = document.getElementById("dmz-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "dmz-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    return toast;
  }

  function showToast(message) {
    const toast = ensureToast();
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toast.classList.remove("show"), 1400);
  }

  // Copy helper (supports file:// via fallback)
  async function copyText(text) {
    if (!text) return false;

    // Preferred API (works best on https; may be blocked on file://)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    // Fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  const init = () => {
    const params = new URLSearchParams(window.location.search);
    const hasPrefill = params.has("interest") || params.has("location") || params.has("course");
    if (params.size) {
      const setField = (id, value) => {
        const el = document.getElementById(id);
        if (!el || value == null || value === "") return;
        el.value = value;
        if (hasPrefill) {
          el.classList.add("is-prefilled");
          const wrapper = el.closest(".field");
          if (wrapper) {
            wrapper.classList.add("is-prefilled");
          }
        }
        if (el.classList.contains("dropdown-input")) {
          const dropdown = el.closest("[data-dropdown]");
          const valueEl = dropdown?.querySelector(".dropdown-value");
          const options = dropdown?.querySelectorAll(".dropdown-option") || [];
          let label = value;
          options.forEach((option) => {
            if (option.getAttribute("data-value") === value) {
              label = option.textContent.trim();
            }
          });
          if (valueEl) valueEl.textContent = label || "Select one…";
        }
      };

      setField("interest", params.get("interest"));
      setField("location", params.get("location"));
      setField("dates", params.get("dates"));
      setField("group", params.get("group"));
      setField("experience", params.get("experience"));
      setField("cb-course", params.get("course"));
      setField("name", params.get("name"));
      setField("email", params.get("email"));
      setField("phone", params.get("phone"));
      setField("message", params.get("message"));
    }

    const dropdowns = document.querySelectorAll("[data-dropdown]");
    const closeDropdowns = () => {
      dropdowns.forEach((dropdown) => {
        dropdown.classList.remove("is-open");
        const toggle = dropdown.querySelector(".dropdown-toggle");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      });
    };

    dropdowns.forEach((dropdown) => {
      const toggle = dropdown.querySelector(".dropdown-toggle");
      const panel = dropdown.querySelector(".dropdown-panel");
      const input = dropdown.querySelector(".dropdown-input");
      const value = dropdown.querySelector(".dropdown-value");
      if (!toggle || !panel || !input || !value) return;

      toggle.addEventListener("click", () => {
        const isOpen = dropdown.classList.contains("is-open");
        closeDropdowns();
        dropdown.classList.toggle("is-open", !isOpen);
        toggle.setAttribute("aria-expanded", (!isOpen).toString());
      });

      panel.querySelectorAll(".dropdown-option").forEach((option) => {
        option.addEventListener("click", () => {
          const nextValue = option.getAttribute("data-value") || "";
          const nextLabel = option.textContent.trim();
          input.value = nextValue;
          value.textContent = nextLabel || "Select one…";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          closeDropdowns();
        });
      });
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-dropdown]")) {
        closeDropdowns();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdowns();
      }
    });

    const diveNowForm = document.querySelector("#dive-now .dmz-form");
    if (diveNowForm && hasPrefill) {
      const requiredFields = diveNowForm.querySelectorAll("input[required], select[required], textarea[required]");
      const promptFields = [
        ...requiredFields,
        document.getElementById("dates"),
        document.getElementById("group"),
        document.getElementById("message"),
      ].filter(Boolean);

      const updateFieldState = (field) => {
        const isEmpty = !String(field.value || "").trim();
        field.classList.toggle("needs-input", isEmpty);
        const wrapper = field.closest(".field");
        if (wrapper) {
          wrapper.classList.toggle("needs-input", isEmpty);
        }
      };

      promptFields.forEach((field) => updateFieldState(field));

      diveNowForm.addEventListener("input", (e) => {
        const field = e.target;
        if (field && (field.matches("input[required], select[required], textarea[required]") || field.id === "dates" || field.id === "group" || field.id === "message")) {
          updateFieldState(field);
        }
      });

      diveNowForm.addEventListener("change", (e) => {
        const field = e.target;
        if (field && (field.matches("input[required], select[required], textarea[required]") || field.id === "dates" || field.id === "group" || field.id === "message")) {
          updateFieldState(field);
        }
      });
    }

    const courseBuilderForm = document.getElementById("courseBuilderForm");
    if (courseBuilderForm) {
      const requiredFields = courseBuilderForm.querySelectorAll("input[required], select[required], textarea[required]");

      const updateFieldState = (field) => {
        const isEmpty = !String(field.value || "").trim();
        field.classList.toggle("needs-input", isEmpty);
        field.classList.toggle("is-prefilled", !isEmpty);
        const wrapper = field.closest(".field");
        if (wrapper) {
          wrapper.classList.toggle("needs-input", isEmpty);
          wrapper.classList.toggle("is-prefilled", !isEmpty);
        }
      };

      requiredFields.forEach((field) => updateFieldState(field));

      courseBuilderForm.addEventListener("input", (e) => {
        const field = e.target;
        if (field && field.matches("input[required], select[required], textarea[required]")) {
          updateFieldState(field);
        }
      });

      courseBuilderForm.addEventListener("change", (e) => {
        const field = e.target;
        if (field && field.matches("input[required], select[required], textarea[required]")) {
          updateFieldState(field);
        }
      });
    }

    // 1) Copy icon buttons
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-copy]");
      if (!btn) return;

      const text = (btn.getAttribute("data-copy") || "").trim();
      const ok = await copyText(text);

      // Visual confirmation
      btn.classList.add("is-copied");
      btn.setAttribute("aria-label", ok ? "Copied" : "Copy failed");
      showToast(ok ? "Copied to clipboard" : "Copy failed");

      window.setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.setAttribute("aria-label", "Copy to clipboard");
      }, 900);
    });

    // 2) Quick contact form -> mailto (no backend)
    const form = document.getElementById("quickContactForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("qm-name")?.value?.trim() || "";
        const email = document.getElementById("qm-email")?.value?.trim() || "";
        const subjectInput = document.getElementById("qm-subject")?.value?.trim() || "";
        const message = document.getElementById("qm-message")?.value?.trim() || "";

        const subject = encodeURIComponent(subjectInput || "DMZ Scuba — Contact Request");
        const body = encodeURIComponent(
          `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n`
        );

        const to = "info@dmzscuba.com";

// mailto attempt (best when user has a mail app configured)
const mailto = `mailto:${to}?subject=${subject}&body=${body}`;

// Gmail compose fallback (works reliably in Chrome)
const gmailCompose =
  `https://mail.google.com/mail/?view=cm&fs=1` +
  `&to=${encodeURIComponent(to)}` +
  `&su=${subject}` +
  `&body=${body}`;

showToast("Opening email…");

// Heuristic: if a mail handler opens, the browser often blurs/loses focus.
// If we never blur and stay visible, assume nothing launched -> open Gmail.
let blurred = false;
window.addEventListener("blur", () => { blurred = true; }, { once: true });

// Try mailto first
try {
  window.location.assign(mailto);
} catch (_) {}

// If nothing seems to happen, open Gmail compose
window.setTimeout(() => {
  if (!blurred && document.visibilityState === "visible") {
    window.open(gmailCompose, "_blank", "noopener,noreferrer");
    showToast("No mail app detected — opened Gmail compose.");
  }
}, 900);

      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
