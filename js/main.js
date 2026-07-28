console.log("main.js loaded");

(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll(".site-footer small").forEach((footerText) => {
    if (footerText.querySelector('a[href="/pages/privacy/"]')) return;
    footerText.insertAdjacentHTML(
      "beforeend",
      ' <span class="footer-separator" aria-hidden="true">|</span> <a href="/pages/privacy/">Privacy Policy</a>'
    );
  });
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

  function getEventAlertSubscribeApiUrl() {
    const base = (document.body && document.body.dataset.contactApi) || "";
    return base ? `${base}/api/event-alert-subscribe` : "/api/event-alert-subscribe";
  }

  function getTelemetryApiUrl() {
    const base =
      (document.body &&
        (document.body.dataset.telemetryApi ||
          document.body.dataset.contactApi ||
          document.body.dataset.adminApi ||
          document.body.dataset.mediaApi)) ||
      "";
    return base ? `${base}/api/client-telemetry` : "/api/client-telemetry";
  }

  function sendTelemetry(eventType, details = {}) {
    if (!eventType) return;
    const payload = {
      eventType: String(eventType),
      details: details && typeof details === "object" ? details : {},
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      sentAt: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const url = getTelemetryApiUrl();
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      }
    } catch (error) {
      // Fall back to fetch.
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
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
        throw new Error(`Send failed (${response.status})`);
      }
      if (form.id === "courseBuilderForm") {
        form.dataset.telemetryCompleted = "true";
        sendTelemetry("training_inquiry_completed", {
          course: String(fields.course || "unspecified"),
          experience: String(fields.experience || "unspecified"),
          group: String(fields.group || "unspecified"),
          sourcePage: new URLSearchParams(window.location.search).get("source_page") || document.referrer || "direct",
        });
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
      sendTelemetry("contact_submit_failed", {
        form: payload.form,
        hasEmail: Boolean(email),
        hasMessage: Boolean(message),
        reason: String((error && error.message) || "unknown"),
      });
      showToast("Send failed. Please email info@dmzscuba.com.");
      if (submitButton) {
        submitButton.textContent = originalLabel;
        submitButton.disabled = false;
      }
    } finally {
      form.dataset.submitting = "false";
    }
  }

  async function submitEventAlertSubscribeForm(form) {
    if (!form || form.dataset.submitting === "true") return;
    if (!form.hasAttribute("novalidate") && !form.reportValidity()) {
      showToast("Add your email to subscribe.");
      return;
    }

    const fields = collectFields(form);
    const honey = fields.company || "";
    if (honey) return;
    delete fields.company;

    const email = pickFieldValue(fields, (key) => key.toLowerCase().includes("email"));
    const name = pickFieldValue(fields, (key) => key.toLowerCase().includes("name"));
    const phone = pickFieldValue(fields, (key) => key.toLowerCase().includes("phone"));
    if (!email) {
      showToast("Add your email to subscribe.");
      return;
    }

    const payload = {
      form: form.dataset.formName || "Event Alert Subscribe",
      fields,
      name,
      email,
      phone,
      pageUrl: window.location.href,
      honey,
    };
    const submitButton = form.querySelector("button[type='submit']");
    const statusEl = form.querySelector("[data-subscribe-status]");
    const originalLabel = submitButton ? submitButton.textContent : "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Subscribing...";
    }
    if (statusEl) statusEl.textContent = "";
    form.dataset.submitting = "true";

    try {
      const response = await fetch(getEventAlertSubscribeApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Subscribe failed (${response.status})`);
      }
      showToast("You are subscribed to event alerts.");
      if (statusEl) statusEl.textContent = "You are subscribed to DMZ Scuba event alerts.";
      form.reset();
      if (submitButton) {
        submitButton.textContent = "Subscribed";
        window.setTimeout(() => {
          submitButton.textContent = originalLabel;
          submitButton.disabled = false;
        }, 1400);
      }
    } catch (error) {
      sendTelemetry("event_alert_subscribe_failed", {
        form: payload.form,
        hasEmail: Boolean(email),
        reason: String((error && error.message) || "unknown"),
      });
      showToast("Subscribe failed. Please email info@dmzscuba.com.");
      if (statusEl) statusEl.textContent = "Subscribe failed. Please email info@dmzscuba.com.";
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
    subscribeToEventAlerts: submitEventAlertSubscribeForm,
  };
  window.DMZTelemetry = {
    report: sendTelemetry,
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

  function initSharedNav() {
    const headers = document.querySelectorAll("header[data-site-nav]");
    if (!headers.length) return;

    const path = window.location.pathname;

    function isActive(prefix) {
      if (prefix === "/") return path === "/" || path === "/index.html";
      return path === prefix || path.startsWith(prefix);
    }

    const navLinks = [
      { href: "/", label: "Home" },
      { href: "/pages/training/", label: "Classes" },
      { href: "/pages/travel/", label: "Travel" },
      { href: "/pages/media/", label: "Media" },
      { href: "/pages/events/", label: "Events" },
      { href: "/pages/contact/", label: "Contact" },
      { href: "/pages/about/", label: "About" },
    ];

    const linksHtml = navLinks
      .map(({ href, label }) => {
        const active = isActive(href);
        const attrs = active ? ' class="is-active" aria-current="page"' : "";
        return `<a${attrs} href="${href}">${label}</a>`;
      })
      .join("");

    const navHtml =
      `<div class="nav-container">` +
      `<a class="site-brand" href="/" aria-label="DMZ Scuba Home">` +
      `<span class="logo" aria-hidden="true">` +
      `<img src="/assets/images/logos/dmz-scuba-logo-mobile.webp" alt="" width="56" height="56" /></span>` +
      `<span class="site-name">DMZ Scuba</span></a>` +
      `<div class="mobile-nav-actions">` +
      `<a class="mobile-nav-quick-cta" href="/pages/contact/?interest=training#dive-now">Dive Now</a>` +
      `<button class="nav-menu-toggle" type="button" aria-controls="mobile-navigation" aria-expanded="false" aria-label="Open menu">` +
      `<span></span><span></span><span></span></button></div>` +
      `<nav class="main-nav desktop-primary-nav" id="desktop-primary-navigation" aria-label="Primary">` +
      `<div class="nav-links">${linksHtml}</div>` +
      `<div class="nav-drawer-actions">` +
      `<a class="nav-cta" href="/pages/contact/?interest=training#dive-now">Start Diving</a>` +
      `</div></nav>` +
      `</div>`;

    const mobileLayerHtml =
      `<div class="mobile-nav-layer" id="mobile-nav-layer">` +
      `<button class="nav-backdrop" type="button" tabindex="-1" aria-hidden="true" aria-label="Close menu"></button>` +
      `<nav class="mobile-nav-drawer" id="mobile-navigation" aria-label="Mobile primary navigation" aria-hidden="true" inert>` +
      `<div class="nav-drawer-head"><span>Explore DMZ Scuba</span>` +
      `<button class="nav-menu-close" type="button" aria-label="Close menu"><span aria-hidden="true">&times;</span></button></div>` +
      `<div class="nav-drawer-links">${linksHtml}</div>` +
      `<div class="nav-drawer-actions">` +
      `<a class="nav-cta" href="/pages/contact/?interest=training#dive-now">Start Diving</a>` +
      `<a href="tel:+16306604536">Call 630-660-4536</a>` +
      `<a href="sms:+16306604536">Text DMZ Scuba</a></div></nav>` +
      `</div>`;

    headers.forEach((header) => {
      header.innerHTML = navHtml;
    });

    document.getElementById("mobile-nav-layer")?.remove();
    document.body.insertAdjacentHTML("beforeend", mobileLayerHtml);
  }

  function initMobileNav() {
    const header = document.querySelector(".site-header");
    const layer = document.getElementById("mobile-nav-layer");
    const drawer = document.getElementById("mobile-navigation");
    const toggle = document.querySelector(".nav-menu-toggle");
    const closeButton = document.querySelector(".nav-menu-close");
    const backdrop = document.querySelector(".nav-backdrop");
    if (!header || !layer || !drawer || !toggle || !closeButton || !backdrop) return;

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let restoreFocus = null;

    const setOpen = (isOpen) => {
      header.classList.toggle("nav-is-open", isOpen);
      layer.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("mobile-nav-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");

      if (isOpen) {
        drawer.removeAttribute("aria-hidden");
        drawer.inert = false;
        restoreFocus = document.activeElement;
        window.requestAnimationFrame(() => closeButton.focus());
      } else {
        drawer.setAttribute("aria-hidden", "true");
        drawer.inert = true;
        if (restoreFocus && typeof restoreFocus.focus === "function") {
          restoreFocus.focus();
          restoreFocus = null;
        }
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    closeButton.addEventListener("click", () => setOpen(false));
    backdrop.addEventListener("click", () => setOpen(false));
    drawer.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    let drawerTouchStartX = null;
    drawer.addEventListener("touchstart", (event) => {
      drawerTouchStartX = event.touches[0]?.clientX ?? null;
    }, { passive: true });
    drawer.addEventListener("touchend", (event) => {
      if (drawerTouchStartX == null) return;
      const endX = event.changedTouches[0]?.clientX ?? drawerTouchStartX;
      if (endX - drawerTouchStartX > 64) setOpen(false);
      drawerTouchStartX = null;
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      if (!header.classList.contains("nav-is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...drawer.querySelectorAll(focusableSelector)].filter((element) => !element.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    const mobileQuery = window.matchMedia("(max-width: 780px)");
    const syncMode = () => {
      if (!mobileQuery.matches) {
        header.classList.remove("nav-is-open");
        layer.classList.remove("is-open");
        document.body.classList.remove("mobile-nav-open");
        toggle.setAttribute("aria-expanded", "false");
        drawer.setAttribute("aria-hidden", "true");
        drawer.inert = true;
      } else if (!header.classList.contains("nav-is-open")) {
        drawer.setAttribute("aria-hidden", "true");
        drawer.inert = true;
      } else {
        drawer.removeAttribute("aria-hidden");
        drawer.inert = false;
      }
    };
    mobileQuery.addEventListener?.("change", syncMode);
    syncMode();
  }

  function buildMobileSectionToggle(label, controlsId, expanded) {
    const toggle = document.createElement("button");
    toggle.className = "mobile-section-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-controls", controlsId);
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    const iconSpan = document.createElement("span");
    iconSpan.className = "mobile-section-toggle-icon";
    iconSpan.setAttribute("aria-hidden", "true");
    toggle.appendChild(labelSpan);
    toggle.appendChild(iconSpan);
    return toggle;
  }

  function initMobileTrainingStructure(trainingCourse) {
    if (!trainingCourse) return;
    const hero = document.querySelector(".page-hero-copy");
    const firstMetrics = document.querySelector(".page-main .conversion-metrics");
    const heroActions = hero?.querySelector(".page-hero-actions");
    if (hero && firstMetrics && heroActions && !hero.querySelector(".mobile-hero-metrics")) {
      const mobileMetrics = firstMetrics.cloneNode(true);
      mobileMetrics.classList.add("mobile-hero-metrics");
      mobileMetrics.setAttribute("aria-label", "Course essentials");
      const proofList = hero.querySelector(".hero-proof-list");
      if (proofList) proofList.before(mobileMetrics);
      else heroActions.before(mobileMetrics);
    }

    const isCoursePage = trainingCourse !== "training-landing" && trainingCourse !== "course-builder";
    const candidates = [...document.querySelectorAll(".page-main > .content-section")].filter((section) => {
      if (!section.querySelector(":scope > h2")) return false;
      if (section.id === "request-dates" || section.classList.contains("ad-decision")) return false;
      return true;
    });

    candidates.forEach((section, index) => {
      const keepOpen = index === 0 && !isCoursePage;
      const heading = section.querySelector(":scope > h2");
      if (!heading || heading.querySelector(".mobile-section-toggle")) return;

      const content = document.createElement("div");
      content.className = "mobile-collapse-content";
      content.id = `${section.id || `mobile-section-${index + 1}`}-content`;
      while (heading.nextSibling) content.appendChild(heading.nextSibling);

      const label = heading.textContent.trim();
      const toggle = buildMobileSectionToggle(label, content.id, keepOpen);
      heading.textContent = "";
      heading.appendChild(toggle);
      heading.after(content);
      section.classList.add("mobile-collapsible");
      section.classList.toggle("is-collapsed", !keepOpen);

      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        section.classList.toggle("is-collapsed", expanded);
      });
    });

    const openHashTarget = (hash) => {
      if (!hash || hash === "#") return;
      let target;
      try {
        target = document.querySelector(hash);
      } catch (error) {
        return;
      }
      const section = target?.closest(".mobile-collapsible");
      const toggle = section?.querySelector(".mobile-section-toggle");
      if (!section || !toggle) return;
      section.classList.remove("is-collapsed");
      toggle.setAttribute("aria-expanded", "true");
    };

    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (link) openHashTarget(link.getAttribute("href"));
    });
    openHashTarget(window.location.hash);
  }

  function initMobileDestinationStructure() {
    if (!document.body.classList.contains("destination-page")) return;
    const sections = [...document.querySelectorAll(".destination-page .page-main > .content-section")].filter((section) => {
      return !section.classList.contains("destination-error") &&
        !section.classList.contains("destination-overview");
    });

    sections.forEach((section, index) => {
      if (section.classList.contains("mobile-collapsible")) return;
      const heading = section.querySelector("h2, h3");
      if (!heading) return;
      const content = document.createElement("div");
      content.className = "mobile-collapse-content";
      content.id = `${section.id || `destination-section-${index + 1}`}-content`;
      while (section.firstChild) content.appendChild(section.firstChild);

      const toggle = buildMobileSectionToggle(heading.textContent.trim(), content.id, false);
      section.appendChild(toggle);
      section.appendChild(content);
      section.classList.add("mobile-collapsible", "is-collapsed");

      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        section.classList.toggle("is-collapsed", expanded);
      });
    });
  }

  const init = () => {
    initSharedNav();
    initMobileNav();
    initMobileDestinationStructure();
    const thanksUrl = `${window.location.origin}/pages/thanks/index.html`;
    const params = new URLSearchParams(window.location.search);
    let trainingPath = window.location.pathname.replace(/\/index\.html$/, "/");
    if (trainingPath.startsWith("/pages/training/") && !trainingPath.endsWith("/") && !/\.[a-z0-9]+$/i.test(trainingPath)) {
      trainingPath += "/";
    }
    const trainingCourseMap = {
      "/pages/training/": "training-landing",
      "/pages/training/open-water/": "open-water",
      "/pages/training/open-water-referral/": "open-water-referral",
      "/pages/training/discover-scuba/": "scuba-discovery",
      "/pages/training/advanced-specialty/": "advanced-adventure",
      "/pages/training/skill-refresh/": "skill-refresh",
      "/pages/training/specialty/": "specialty-hub",
      "/pages/training/specialty/nitrox/": "nitrox",
      "/pages/training/specialty/drysuit/": "dry-suit",
      "/pages/training/specialty/wreck/": "wreck",
      "/pages/training/specialty/full-face-mask/": "full-face-mask",
      "/pages/training/course-builder/": "course-builder",
    };
    const trainingCourse = trainingCourseMap[trainingPath] || "";
    initMobileTrainingStructure(trainingCourse);
    if (trainingCourse) {
      sendTelemetry("training_course_view", {
        course: trainingCourse,
        device: window.matchMedia("(max-width: 780px)").matches ? "mobile" : "desktop",
        source: params.get("utm_source") || "direct-or-referral",
        campaign: params.get("utm_campaign") || "",
      });

      const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
      document.querySelectorAll('a[href*="/training/"], a[href^="../"], a[href^="./"]').forEach((link) => {
        let destination;
        try {
          destination = new URL(link.href, window.location.href);
        } catch (error) {
          return;
        }
        if (!destination.pathname.startsWith("/pages/training/")) return;
        campaignKeys.forEach((key) => {
          if (params.has(key) && !destination.searchParams.has(key)) {
            destination.searchParams.set(key, params.get(key));
          }
        });
        if (!destination.searchParams.has("source_page")) {
          destination.searchParams.set("source_page", trainingPath);
        }
        link.href = `${destination.pathname}${destination.search}${destination.hash}`;
      });

      document.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (!link) return;
        const isButton = link.classList.contains("btn");
        let destination;
        try {
          destination = new URL(link.href, window.location.href);
        } catch (error) {
          return;
        }
        if (!isButton && destination.pathname.startsWith("/pages/training/") && destination.pathname !== trainingPath) {
          sendTelemetry("training_internal_progression_click", {
            course: trainingCourse,
            label: String(link.textContent || "").trim(),
            destination: destination.pathname,
          });
          return;
        }
        if (!isButton) return;
        const isSticky = link.classList.contains("mobile-sticky-cta-link");
        const section = link.closest("section");
        sendTelemetry(isSticky ? "training_sticky_cta_click" : "training_cta_click", {
          course: trainingCourse,
          label: String(link.textContent || "").trim(),
          destination: link.getAttribute("href") || "",
          ctaType: link.classList.contains("primary") ? "primary" : "secondary",
          placement: section ? section.id || section.className || "section" : "global",
        });
      });
    }
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
      let trainingFormStarted = false;
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
        if (!trainingFormStarted) {
          trainingFormStarted = true;
          sendTelemetry("training_inquiry_form_start", {
            course: String((document.getElementById("cb-course") || {}).value || "unspecified"),
            sourcePage: params.get("source_page") || document.referrer || "direct",
          });
        }
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

      window.addEventListener("pagehide", () => {
        if (!trainingFormStarted || courseBuilderForm.dataset.telemetryCompleted === "true") return;
        sendTelemetry("training_inquiry_form_abandoned", {
          course: String((document.getElementById("cb-course") || {}).value || "unspecified"),
          sourcePage: params.get("source_page") || document.referrer || "direct",
        });
      });
    }

    const header = document.querySelector(".site-header");
    if (header) {
      if (document.body && document.body.classList.contains("media-page")) {
        header.classList.remove("is-hidden");
        return;
      }
      const mobileQuery = window.matchMedia("(max-width: 780px)");
      let lastScrollY = window.scrollY;
      let maxScrollY = window.scrollY;
      let scrollAccum = 0;
      let lastDirection = 0;
      let ticking = false;
      const shouldKeepHeaderVisible = () => {
        if (header.classList.contains("nav-is-open")) return true;
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
        const isMediaPage = Boolean(document.body && document.body.classList.contains("media-page"));
        const revealThreshold = isMediaPage ? 96 : 240;
        const hideThreshold = isMediaPage ? 44 : 32;
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

    const stickyCta = document.getElementById("mobile-sticky-cta");
    if (stickyCta) {
      document.body.classList.add("has-training-sticky-cta");
      const stickyDismissKey = stickyCta.dataset.dismissStorageKey || "dmz-mobile-sticky-cta-dismissed";
      const dismissed = (() => {
        try {
          return window.sessionStorage.getItem(stickyDismissKey) === "1";
        } catch (error) {
          return false;
        }
      })();
      if (dismissed) {
        stickyCta.classList.add("is-hidden");
      }

      const stickyLink = stickyCta.querySelector(".mobile-sticky-cta-link");
      if (stickyLink && "IntersectionObserver" in window) {
        let stickyDestination;
        try {
          stickyDestination = new URL(stickyLink.href, window.location.href);
        } catch (error) {
          stickyDestination = null;
        }
        if (stickyDestination) {
          const matchingActions = [...document.querySelectorAll("a.btn[href]")].filter((link) => {
            if (link === stickyLink || link.closest("#mobile-sticky-cta")) return false;
            try {
              const destination = new URL(link.href, window.location.href);
              return destination.pathname === stickyDestination.pathname &&
                destination.search === stickyDestination.search;
            } catch (error) {
              return false;
            }
          });
          if (matchingActions.length) {
            const visibleActions = new Set();
            const stickyObserver = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) visibleActions.add(entry.target);
                else visibleActions.delete(entry.target);
              });
              stickyCta.classList.toggle("is-suppressed", visibleActions.size > 0);
            }, { threshold: 0.5 });
            matchingActions.forEach((action) => stickyObserver.observe(action));
          }
        }
      }
    }

    document.addEventListener("click", (event) => {
      const closeBtn = event.target.closest("[data-dismiss-target]");
      if (!closeBtn) return;
      const targetSelector = closeBtn.getAttribute("data-dismiss-target");
      if (!targetSelector) return;
      const target = document.querySelector(targetSelector);
      if (!target) return;
      target.classList.add("is-hidden");
      if (target.classList.contains("mobile-sticky-cta")) {
        sendTelemetry("training_sticky_cta_dismiss", {
          course: trainingCourse || "training",
        });
      }
      try {
        const dismissKey = target.dataset.dismissStorageKey || "dmz-mobile-sticky-cta-dismissed";
        window.sessionStorage.setItem(dismissKey, "1");
      } catch (error) {
        // Ignore storage failures and keep dismiss behavior for current view.
      }
    });

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

    document.querySelectorAll("[data-event-alert-subscribe]").forEach((subscribeForm) => {
      subscribeForm.addEventListener("submit", (e) => {
        e.preventDefault();
        submitEventAlertSubscribeForm(subscribeForm);
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
