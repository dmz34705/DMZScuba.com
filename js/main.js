console.log("main.js loaded");

(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();


// =========================
// DMZ Scuba — main.js
// Unified helpers: toast, copy, form submit
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

  function getContactApiUrl() {
    const base = (document.body && document.body.dataset.contactApi) || "";
    return base ? `${base}/api/contact` : "/api/contact";
  }

  function collectFields(form) {
    const data = {};
    const formData = new FormData(form);
    formData.forEach((value, key) => {
      const clean = String(value || "").trim();
      if (!clean) return;
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(clean);
        } else {
          data[key] = [data[key], clean];
        }
      } else {
        data[key] = clean;
      }
    });
    return data;
  }

  function pickFieldValue(fields, matcher) {
    return Object.entries(fields).reduce((found, [key, value]) => {
      if (found) return found;
      if (matcher(key)) {
        return Array.isArray(value) ? value[0] : value;
      }
      return "";
    }, "");
  }

  async function submitDmzForm(form, options = {}) {
    if (!form || form.dataset.submitting === "true") return;
    if (!form.hasAttribute("novalidate") && !form.reportValidity()) {
      showToast("Please complete the required fields.");
      return;
    }

    const fields = collectFields(form);
    const honey = fields.company || "";
    if (honey) return;
    delete fields.company;

    const email = pickFieldValue(fields, (key) => key.toLowerCase().includes("email"));
    const name = pickFieldValue(fields, (key) => key.toLowerCase().includes("name"));
    const message =
      fields.message ||
      fields["contact-message"] ||
      fields.goals ||
      fields["contact-subject"] ||
      "";

    if (options.requireEmail && !email) {
      showToast("Add your email so we can reply.");
      return;
    }

    if (options.requireMessage && !message) {
      showToast("Add a quick message so we can help.");
      return;
    }

    const payload = {
      form: form.dataset.formName || form.id || "DMZ Form",
      subject: form.dataset.subject || "",
      fields,
      name,
      email,
      message,
      pageUrl: window.location.href,
      honey,
    };

    const submitButton = form.querySelector("button[type='submit']");
    const originalLabel = submitButton ? submitButton.textContent : "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }
    form.dataset.submitting = "true";

    try {
      const response = await fetch(getContactApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Send failed");
      }
      showToast("Message sent. We will reply soon.");
      if (submitButton) {
        submitButton.textContent = "Sent!";
        window.setTimeout(() => {
          submitButton.textContent = originalLabel;
          submitButton.disabled = false;
        }, 1400);
      }
      if (options.redirectUrl) {
        window.setTimeout(() => {
          window.location.href = options.redirectUrl;
        }, 700);
      }
    } catch (error) {
      showToast("Send failed. Please email info@dmzscuba.com.");
      if (submitButton) {
        submitButton.textContent = originalLabel;
        submitButton.disabled = false;
      }
    } finally {
      form.dataset.submitting = "false";
    }
  }

  window.DMZForms = {
    submit: submitDmzForm,
  };

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
    const thanksUrl = `${window.location.origin}/pages/thanks/index.html`;
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

    const header = document.querySelector(".site-header");
    if (header) {
      const mobileQuery = window.matchMedia("(max-width: 780px)");
      let lastScrollY = window.scrollY;
      let maxScrollY = window.scrollY;
      let scrollAccum = 0;
      let lastDirection = 0;
      let ticking = false;
      const shouldKeepHeaderVisible = () => {
        if (!document.body || !document.body.classList.contains("media-page")) return false;
        if (document.body.classList.contains("media-admin-open")) return true;
        if (document.body.classList.contains("media-edit-mode")) return true;
        if (document.querySelector(".media-edit-modal")) return true;
        if (document.querySelector(".media-video-modal[aria-hidden='false']")) return true;
        if (document.querySelector(".filter-panel.is-open")) return true;
        if (document.querySelector(".media-sort.is-open")) return true;
        return false;
      };

      const updateHeaderVisibility = () => {
        if (!mobileQuery.matches) {
          header.classList.remove("is-hidden");
          lastScrollY = window.scrollY;
          scrollAccum = 0;
          lastDirection = 0;
          return;
        }

        const currentY = window.scrollY;
        const delta = currentY - lastScrollY;
        const revealThreshold = 240;
        const hideThreshold = 32;
        const staticUntilY = 220;
        const minAfterStaticHide = 80;

        if (shouldKeepHeaderVisible()) {
          header.classList.remove("is-hidden");
          lastScrollY = currentY;
          maxScrollY = Math.max(maxScrollY, currentY);
          scrollAccum = 0;
          lastDirection = 0;
          return;
        }

        if (currentY <= 8) {
          header.classList.remove("is-hidden");
          lastScrollY = currentY;
          scrollAccum = 0;
          lastDirection = 0;
          return;
        }

        if (currentY < staticUntilY) {
          header.classList.remove("is-hidden");
          lastScrollY = currentY;
          scrollAccum = 0;
          lastDirection = 0;
          return;
        }

        if (Math.abs(delta) < 6) {
          return;
        }

        const direction = delta > 0 ? 1 : -1;
        if (direction !== lastDirection) {
          scrollAccum = 0;
          lastDirection = direction;
        }
        scrollAccum += Math.abs(delta);

        if (currentY > maxScrollY) {
          maxScrollY = currentY;
        }

        if (direction > 0) {
          if (currentY >= staticUntilY + minAfterStaticHide && scrollAccum >= hideThreshold) {
            header.classList.add("is-hidden");
          }
        } else {
          const distanceFromPeak = maxScrollY - currentY;
          if (distanceFromPeak >= revealThreshold) {
            header.classList.remove("is-hidden");
          }
        }

        lastScrollY = currentY;
      };

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          updateHeaderVisibility();
          ticking = false;
        });
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", () => updateHeaderVisibility());
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

    // 2) Quick contact + Dive Now forms -> API
    const form = document.getElementById("quickContactForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        submitDmzForm(form, { requireEmail: true, requireMessage: true, redirectUrl: thanksUrl });
      });
    }

    const diveNowFormSubmit = document.querySelector("#dive-now .dmz-form");
    if (diveNowFormSubmit) {
      diveNowFormSubmit.addEventListener("submit", (e) => {
        e.preventDefault();
        submitDmzForm(diveNowFormSubmit, { requireEmail: true, redirectUrl: thanksUrl });
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
