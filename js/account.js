(() => {
  const app = document.querySelector("[data-account-app]");
  if (!app) return;

  const tokenStorageKey = "dmzCustomerAccessToken";
  const signedInStorageKey = "dmzCustomerSignedIn";
  const accountIntro = app.querySelector("[data-account-intro]");
  const authSection = app.querySelector("[data-account-auth]");
  const accountCreated = app.querySelector("[data-account-created]");
  const accountSignedIn = app.querySelector("[data-account-signed-in]");
  const dashboard = app.querySelector("[data-account-dashboard]");
  const systemStatus = app.querySelector("[data-account-system-status]");
  const dashboardStatus = app.querySelector("[data-dashboard-status]");
  const panels = Array.from(app.querySelectorAll("[data-account-panel]"));
  const tabs = Array.from(app.querySelectorAll("[data-account-tab]"));
  const accountViewControls = Array.from(app.querySelectorAll("[data-account-view]"));
  const accountViewPanels = Array.from(app.querySelectorAll("[data-account-view-panel]"));
  const accountNavButtons = Array.from(app.querySelectorAll(".account-nav-menu [data-account-view]"));
  let accessToken = "";
  let account = null;
  let pendingEmailChange = null;
  let activeAccountView = "home";
  let authEnabled = false;
  let turnstileSiteKey = "";
  const captchaTokens = { login: "", signup: "", recovery: "" };
  const captchaWidgetIds = {};
  const apiTimeoutMs = 20000;

  try {
    accessToken = window.sessionStorage.getItem(tokenStorageKey) || "";
  } catch (_error) {
    accessToken = "";
  }

  function storeAccessToken(token) {
    accessToken = String(token || "");
    try {
      if (accessToken) window.sessionStorage.setItem(tokenStorageKey, accessToken);
      else window.sessionStorage.removeItem(tokenStorageKey);
    } catch (_error) {
      // The in-memory session remains usable when browser storage is disabled.
    }
    try {
      if (accessToken) window.localStorage.setItem(signedInStorageKey, "1");
      else window.localStorage.removeItem(signedInStorageKey);
    } catch (_error) {
      // This is only a site-wide display hint; authentication still uses secure tokens.
    }
    document.querySelectorAll('a[href="/pages/account/"]').forEach((link) => {
      if (link.closest(".nav-links, .nav-drawer-links")) {
        link.textContent = accessToken ? "My Account" : "Account";
      }
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setMessage(element, message, isError = false) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-error", Boolean(isError));
  }

  function setFormBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll("button, input").forEach((control) => {
      if (control.type !== "hidden") control.disabled = Boolean(busy);
    });
  }

  function showPanel(name) {
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.accountPanel !== name;
    });
    tabs.forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.accountTab === name));
    });
    Object.keys(captchaWidgetIds).forEach((widgetName) => {
      if (widgetName !== name) removeTurnstile(widgetName);
    });
    if (["login", "signup", "recovery"].includes(name)) {
      window.setTimeout(() => renderTurnstile(name), 0);
    }
  }

  function showAccountView(name, focusHeading = false) {
    const requestedView = accountViewPanels.some((panel) => panel.dataset.accountViewPanel === name) ? name : "home";
    activeAccountView = requestedView;
    accountViewPanels.forEach((panel) => {
      panel.hidden = panel.dataset.accountViewPanel !== requestedView;
    });
    accountNavButtons.forEach((button) => {
      if (button.dataset.accountView === requestedView) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (focusHeading) {
      const activePanel = accountViewPanels.find((panel) => panel.dataset.accountViewPanel === requestedView);
      const heading = activePanel && activePanel.querySelector("h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
      }
    }
  }

  function showDashboard(view = activeAccountView) {
    accountIntro.hidden = true;
    authSection.hidden = true;
    accountCreated.hidden = true;
    accountSignedIn.hidden = true;
    dashboard.hidden = false;
    showAccountView(view);
    setMessage(systemStatus, "Your account session is secure and active.");
  }

  function showAccountCreated(linkedCount = 0) {
    accountIntro.hidden = true;
    authSection.hidden = true;
    dashboard.hidden = true;
    accountSignedIn.hidden = true;
    accountCreated.hidden = false;
    const linkedDetail = app.querySelector("[data-account-created-detail]");
    if (linkedDetail) {
      linkedDetail.textContent = linkedCount
        ? `${linkedCount} existing ${linkedCount === 1 ? "record" : "records"} connected`
        : "Existing records checked";
    }
    accountCreated.querySelector("[data-enter-account]")?.focus();
    setMessage(systemStatus, "Your email is verified and your account has been created.");
  }

  function showLoginSuccess() {
    accountIntro.hidden = true;
    authSection.hidden = true;
    accountCreated.hidden = true;
    dashboard.hidden = true;
    accountSignedIn.hidden = false;
    accountSignedIn.querySelector("[data-enter-account]")?.focus();
    setMessage(systemStatus, "You are securely signed in.");
  }

  function resetCaptcha(name) {
    captchaTokens[name] = "";
    if (window.turnstile && captchaWidgetIds[name] != null) {
      window.turnstile.reset(captchaWidgetIds[name]);
    }
  }

  function renewCaptcha(name) {
    resetCaptcha(name);
    if (captchaWidgetIds[name] == null) {
      window.setTimeout(() => renderTurnstile(name), 0);
    }
  }

  function getCaptchaStatus(name) {
    return app.querySelector(`[data-${name}-status]`);
  }

  function removeTurnstile(name, preserveToken = false) {
    if (!preserveToken) captchaTokens[name] = "";
    if (!window.turnstile || captchaWidgetIds[name] == null) return;
    window.turnstile.remove(captchaWidgetIds[name]);
    delete captchaWidgetIds[name];
  }

  function renderTurnstile(name) {
    if (!turnstileSiteKey || !window.turnstile || captchaWidgetIds[name] != null) return false;
    const container = app.querySelector(`[data-turnstile="${name}"]`);
    if (!container || container.closest("[data-account-panel]")?.hidden) return false;
    const status = getCaptchaStatus(name);
    captchaWidgetIds[name] = window.turnstile.render(container, {
      sitekey: turnstileSiteKey,
      theme: "dark",
      size: "normal",
      retry: "auto",
      "retry-interval": 3000,
      "refresh-expired": "auto",
      "refresh-timeout": "auto",
      callback: (token) => {
        captchaTokens[name] = String(token || "");
        if (captchaTokens[name]) {
          setMessage(status, "Security check complete.");
          window.setTimeout(() => removeTurnstile(name, true), 0);
        }
      },
      "expired-callback": () => {
        captchaTokens[name] = "";
        setMessage(status, "The security check expired and is refreshing. Please wait a moment.", true);
      },
      "timeout-callback": () => {
        captchaTokens[name] = "";
        setMessage(status, "The security check timed out and is refreshing. Please wait a moment.", true);
      },
      "unsupported-callback": () => {
        captchaTokens[name] = "";
        setMessage(status, "This browser cannot run the security check. Try an up-to-date version of Chrome, Edge, Firefox, or Safari.", true);
      },
      "error-callback": (errorCode) => {
        captchaTokens[name] = "";
        const code = String(errorCode || "").trim();
        setMessage(status, `The security check could not finish${code ? ` (${code})` : ""}. Refresh the page or try another browser.`, true);
        return true;
      },
    });
    return true;
  }

  async function initTurnstile(siteKey) {
    for (let attempt = 0; attempt < 40 && !window.turnstile; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    if (!window.turnstile) return false;
    turnstileSiteKey = String(siteKey || "").trim();
    return renderTurnstile("login");
  }

  async function parseResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || data.ok === false) {
      const error = new Error(String(data && data.error || "The request could not be completed."));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function reportAuthFailure(stage, error) {
    console.error("[DMZ Account] Authentication request failed", {
      stage,
      code: String(error && error.code || "REQUEST_FAILED"),
      status: Number(error && error.status || 0),
      message: String(error && error.message || "The request failed."),
    });
  }

  async function refreshSession() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), apiTimeoutMs);
    try {
      const response = await fetch("/api/account/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).catch(() => null);
      if (!response || !response.ok) {
        storeAccessToken("");
        return false;
      }
      const data = await response.json().catch(() => ({}));
      if (!data || !data.ok || !data.accessToken) {
        storeAccessToken("");
        return false;
      }
      storeAccessToken(data.accessToken);
      return true;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function apiRequest(path, options = {}, retry = true) {
    const headers = options.headers ? { ...options.headers } : {};
    headers.Accept = "application/json";
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeoutId = window.setTimeout(() => controller.abort(), apiTimeoutMs);
    console.info("[DMZ Account] API request started", { path });
    try {
      const response = await fetch(path, {
        ...options,
        headers,
        credentials: "same-origin",
        signal: controller.signal,
      });
      console.info("[DMZ Account] API response received", {
        path,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
      });
      if (response.status === 401 && retry && path !== "/api/account/auth/refresh") {
        const refreshed = await refreshSession();
        if (refreshed) return apiRequest(path, options, false);
      }
      return await parseResponse(response);
    } catch (error) {
      if (error && error.name === "AbortError") {
        const timeoutError = new Error("The account server took too long to respond. Please try again.");
        timeoutError.code = "ACCOUNT_REQUEST_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function formatDate(value) {
    const source = String(value || "").trim();
    if (!source) return "Date not provided";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(source) ? new Date(`${source}T12:00:00`) : new Date(source);
    if (Number.isNaN(date.getTime())) return source;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function renderCertifications(certifications) {
    const list = app.querySelector("[data-certification-list]");
    if (!list) return;
    if (!certifications.length) {
      list.innerHTML = '<p class="account-empty">No certifications have been added yet.</p>';
      return;
    }
    list.innerHTML = certifications.map((certification) => {
      const details = [
        certification.certificationNumber ? `#${certification.certificationNumber}` : "",
        certification.issuedOn ? `Issued ${formatDate(certification.issuedOn)}` : "",
        certification.expiresOn ? `Expires ${formatDate(certification.expiresOn)}` : "",
      ].filter(Boolean).join(" | ");
      return `
        <div class="account-record">
          <div>
            <strong>${escapeHtml(certification.agency)} ${escapeHtml(certification.certificationName)}</strong>
            <span>${escapeHtml(details || "No card number or date added")}</span>
          </div>
          <div>
            <span class="account-record-badge">${escapeHtml(certification.verificationStatus || "pending")}</span>
            <button class="account-record-delete" type="button" data-delete-certification="${escapeHtml(certification.id)}">Remove</button>
          </div>
        </div>`;
    }).join("");
  }

  function renderEventRegistrations(registrations) {
    const list = app.querySelector("[data-event-registration-list]");
    if (!list) return;
    if (!registrations.length) {
      list.innerHTML = '<p class="account-empty">No event registrations are connected yet.</p>';
      return;
    }
    list.innerHTML = registrations.map((registration) => `
      <div class="account-record">
        <div>
          <strong>${escapeHtml(registration.sourceId || "DMZ Scuba event")}</strong>
          <span>${escapeHtml(formatDate(registration.eventDate))} | Party of ${Math.max(1, Number(registration.partySize) || 1)}</span>
        </div>
        <span class="account-record-badge">${escapeHtml(registration.status || "pending")}</span>
      </div>`).join("");
  }

  function renderReservations(reservations) {
    const list = app.querySelector("[data-reservation-list]");
    if (!list) return;
    if (!reservations.length) {
      list.innerHTML = '<p class="account-empty">No classes, trips, or bookings are connected yet.</p>';
      return;
    }
    list.innerHTML = reservations.map((reservation) => `
      <div class="account-record">
        <div>
          <strong>${escapeHtml(reservation.type || "Booking")}</strong>
          <span>${escapeHtml(reservation.eventDate ? formatDate(reservation.eventDate) : reservation.sourceId || "DMZ Scuba")}</span>
        </div>
        <span class="account-record-badge">${escapeHtml(reservation.status || "pending")}</span>
      </div>`).join("");
  }

  function renderAccount(data) {
    account = data;
    const profile = data.profile || {};
    const certifications = Array.isArray(data.certifications) ? data.certifications : [];
    const eventRegistrations = Array.isArray(data.eventRegistrations) ? data.eventRegistrations : [];
    const reservations = Array.isArray(data.reservations) ? data.reservations : [];
    const profileForm = app.querySelector("[data-profile-form]");
    if (profileForm) {
      profileForm.elements.firstName.value = profile.firstName || "";
      profileForm.elements.lastName.value = profile.lastName || "";
      profileForm.elements.preferredName.value = profile.preferredName || "";
      profileForm.elements.phone.value = profile.phone || "";
      profileForm.elements.email.value = profile.email || "";
    }
    const greeting = app.querySelector("[data-dashboard-greeting]");
    const dashboardName = app.querySelector("[data-dashboard-name]");
    const email = app.querySelector("[data-dashboard-email]");
    const securityEmail = app.querySelector("[data-security-current-email]");
    const avatar = app.querySelector("[data-account-avatar]");
    const welcomeNames = app.querySelectorAll("[data-account-welcome-name]");
    const certificationCount = app.querySelector("[data-home-certification-count]");
    const activityCount = app.querySelector("[data-home-activity-count]");
    const profileStatus = app.querySelector("[data-home-profile-status]");
    const nextTitle = app.querySelector("[data-home-next-title]");
    const nextCopy = app.querySelector("[data-home-next-copy]");
    const nextAction = app.querySelector("[data-home-next-action]");
    const displayName = profile.preferredName || profile.firstName || "Diver";
    const initials = `${String(profile.firstName || "D").charAt(0)}${String(profile.lastName || "").charAt(0)}`.toUpperCase();
    const connectedActivityCount = eventRegistrations.length + reservations.length;
    if (greeting) greeting.textContent = `Welcome back, ${displayName}.`;
    if (dashboardName) dashboardName.textContent = displayName;
    if (email) email.textContent = profile.email || "";
    if (securityEmail) securityEmail.textContent = profile.email || "";
    if (avatar) avatar.textContent = initials || "D";
    welcomeNames.forEach((element) => { element.textContent = displayName; });
    if (certificationCount) certificationCount.textContent = `${certifications.length} ${certifications.length === 1 ? "certification" : "certifications"}`;
    if (activityCount) activityCount.textContent = `${connectedActivityCount} ${connectedActivityCount === 1 ? "record" : "records"}`;
    if (profileStatus) profileStatus.textContent = profile.phone ? "Ready to use" : "Add your phone";
    if (!profile.phone) {
      if (nextTitle) nextTitle.textContent = "Add a reliable way for us to reach you.";
      if (nextCopy) nextCopy.textContent = "Add your phone number so DMZ Scuba can contact you about classes, trips, and event details.";
      if (nextAction) {
        nextAction.textContent = "Review My Profile";
        nextAction.dataset.accountView = "profile";
      }
    } else if (!certifications.length) {
      if (nextTitle) nextTitle.textContent = "Bring your training history into your account.";
      if (nextCopy) nextCopy.textContent = "Add your certification details now so they are ready for future classes, trips, and events.";
      if (nextAction) {
        nextAction.textContent = "Add a Certification";
        nextAction.dataset.accountView = "certifications";
      }
    } else {
      if (nextTitle) nextTitle.textContent = "Your account essentials are in place.";
      if (nextCopy) nextCopy.textContent = "Review your connected activity or check for older DMZ Scuba records that use your verified email address.";
      if (nextAction) {
        nextAction.textContent = "View My Activity";
        nextAction.dataset.accountView = "activity";
      }
    }
    renderCertifications(certifications);
    renderEventRegistrations(eventRegistrations);
    renderReservations(reservations);
  }

  function showSignedOut() {
    account = null;
    pendingEmailChange = null;
    activeAccountView = "home";
    accountIntro.hidden = false;
    accountCreated.hidden = true;
    accountSignedIn.hidden = true;
    dashboard.hidden = true;
    authSection.hidden = false;
    showPanel("login");
  }

  async function loadAccount(options = {}) {
    if (!accessToken) return false;
    try {
      renderAccount(await apiRequest("/api/account", { method: "GET" }));
      if (options.created) showAccountCreated(Math.max(0, Number(options.linkedCount) || 0));
      else if (options.signedIn) showLoginSuccess();
      else showDashboard(options.view || activeAccountView);
      return true;
    } catch (error) {
      storeAccessToken("");
      showSignedOut();
      if (options.throwOnError) throw error;
      return false;
    }
  }

  accountViewControls.forEach((button) => {
    button.addEventListener("click", () => showAccountView(button.dataset.accountView || "home", true));
  });

  app.querySelectorAll("[data-enter-account]").forEach((button) => {
    button.addEventListener("click", () => {
      showDashboard("home");
      setMessage(dashboardStatus, "Your account is ready. Welcome to DMZ Scuba.");
    });
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.accountTab || "login"));
  });

  app.querySelectorAll("[data-back-to-login]").forEach((button) => {
    button.addEventListener("click", () => showPanel("login"));
  });

  app.querySelector("[data-show-recovery]")?.addEventListener("click", () => showPanel("recovery"));

  const loginForm = app.querySelector("[data-login-form]");
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-login-status]");
    if (!captchaTokens.login) {
      setMessage(status, "Complete the security check.", true);
      return;
    }
    const captchaToken = captchaTokens.login;
    removeTurnstile("login", true);
    setMessage(status, "Signing you in...");
    setFormBusy(loginForm, true);
    try {
      const data = await apiRequest("/api/account/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginForm.elements.email.value,
          password: loginForm.elements.password.value,
          captchaToken,
        }),
      }, false);
      storeAccessToken(data.accessToken);
      await loadAccount({ throwOnError: true, signedIn: true });
    } catch (error) {
      reportAuthFailure("login", error);
      setMessage(status, error.message, true);
    } finally {
      renewCaptcha("login");
      setFormBusy(loginForm, false);
    }
  });

  const signupForm = app.querySelector("[data-signup-form]");
  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-signup-status]");
    const password = signupForm.elements.password.value;
    if (password !== signupForm.elements.confirmPassword.value) {
      setMessage(status, "The passwords do not match.", true);
      return;
    }
    if (!captchaTokens.signup) {
      setMessage(status, "Complete the security check.", true);
      return;
    }
    const captchaToken = captchaTokens.signup;
    removeTurnstile("signup", true);
    setMessage(status, "Creating your account...");
    setFormBusy(signupForm, true);
    try {
      await apiRequest("/api/account/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          firstName: signupForm.elements.firstName.value,
          lastName: signupForm.elements.lastName.value,
          email: signupForm.elements.email.value,
          password,
          captchaToken,
        }),
      }, false);
      const verifyForm = app.querySelector("[data-verify-form]");
      verifyForm.elements.email.value = signupForm.elements.email.value;
      verifyForm.elements.type.value = "signup";
      app.querySelector("[data-verify-copy]").textContent = "Enter the six-digit code sent to your email address.";
      showPanel("verify");
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      renewCaptcha("signup");
      setFormBusy(signupForm, false);
    }
  });

  const recoveryForm = app.querySelector("[data-recovery-form]");
  recoveryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-recovery-status]");
    if (!captchaTokens.recovery) {
      setMessage(status, "Complete the security check.", true);
      return;
    }
    const captchaToken = captchaTokens.recovery;
    removeTurnstile("recovery", true);
    setMessage(status, "Requesting a recovery code...");
    setFormBusy(recoveryForm, true);
    try {
      const data = await apiRequest("/api/account/auth/recover", {
        method: "POST",
        body: JSON.stringify({ email: recoveryForm.elements.email.value, captchaToken }),
      }, false);
      const verifyForm = app.querySelector("[data-verify-form]");
      verifyForm.elements.email.value = recoveryForm.elements.email.value;
      verifyForm.elements.type.value = "recovery";
      app.querySelector("[data-verify-copy]").textContent = data.message || "Enter the recovery code sent to your email address.";
      showPanel("verify");
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      renewCaptcha("recovery");
      setFormBusy(recoveryForm, false);
    }
  });

  const verifyForm = app.querySelector("[data-verify-form]");
  verifyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-verify-status]");
    const type = verifyForm.elements.type.value === "recovery" ? "recovery" : "signup";
    setMessage(status, "Verifying your email...");
    setFormBusy(verifyForm, true);
    try {
      const data = await apiRequest("/api/account/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email: verifyForm.elements.email.value, token: verifyForm.elements.token.value, type }),
      }, false);
      storeAccessToken(data.accessToken);
      if (type === "recovery") {
        showPanel("new-password");
      } else {
        const linkedAccount = await apiRequest("/api/account/link-existing", { method: "POST" }).catch(() => ({}));
        const linked = linkedAccount.linked || {};
        const linkedCount = Math.max(0, Number(linked.registrations) || 0) + Math.max(0, Number(linked.records) || 0);
        await loadAccount({ created: true, linkedCount });
      }
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(verifyForm, false);
    }
  });

  const passwordForm = app.querySelector("[data-password-form]");
  passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-password-status]");
    const password = passwordForm.elements.password.value;
    if (password !== passwordForm.elements.confirmPassword.value) {
      setMessage(status, "The passwords do not match.", true);
      return;
    }
    setMessage(status, "Updating your password...");
    setFormBusy(passwordForm, true);
    try {
      const data = await apiRequest("/api/account/auth/password", { method: "PUT", body: JSON.stringify({ password }) });
      setMessage(status, data.message || "Your password has been updated.");
      await loadAccount({ view: "home" });
      setMessage(dashboardStatus, "Your password has been reset successfully.");
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(passwordForm, false);
    }
  });

  const changePasswordForm = app.querySelector("[data-change-password-form]");
  changePasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-change-password-status]");
    const password = changePasswordForm.elements.password.value;
    if (password !== changePasswordForm.elements.confirmPassword.value) {
      setMessage(status, "The new passwords do not match.", true);
      return;
    }
    setMessage(status, "Changing your password...");
    setFormBusy(changePasswordForm, true);
    try {
      const data = await apiRequest("/api/account/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: changePasswordForm.elements.currentPassword.value,
          password,
        }),
      });
      changePasswordForm.reset();
      setMessage(status, data.message || "Your password has been updated.");
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(changePasswordForm, false);
    }
  });

  const changeEmailForm = app.querySelector("[data-change-email-form]");
  const emailVerification = app.querySelector("[data-email-verification]");
  const currentEmailCodeForm = app.querySelector("[data-current-email-code-form]");
  const newEmailCodeForm = app.querySelector("[data-new-email-code-form]");

  changeEmailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-change-email-status]");
    const currentEmail = String(account && account.profile && account.profile.email || "").trim().toLowerCase();
    const newEmail = String(changeEmailForm.elements.email.value || "").trim().toLowerCase();
    if (newEmail === currentEmail) {
      setMessage(status, "Enter an email address different from your current one.", true);
      return;
    }
    setMessage(status, "Sending verification codes...");
    setFormBusy(changeEmailForm, true);
    try {
      const data = await apiRequest("/api/account/auth/email", {
        method: "PUT",
        body: JSON.stringify({ email: newEmail }),
      });
      pendingEmailChange = {
        currentEmail: String(data.currentEmail || currentEmail).toLowerCase(),
        newEmail: String(data.newEmail || newEmail).toLowerCase(),
      };
      currentEmailCodeForm.reset();
      newEmailCodeForm.reset();
      currentEmailCodeForm.hidden = false;
      newEmailCodeForm.hidden = true;
      app.querySelector("[data-current-email-code-label]").textContent = `Code sent to ${pendingEmailChange.currentEmail}`;
      app.querySelector("[data-new-email-code-label]").textContent = `Code sent to ${pendingEmailChange.newEmail}`;
      emailVerification.hidden = false;
      setMessage(status, data.message || "Check both email addresses for verification codes.");
      currentEmailCodeForm.elements.token.focus();
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(changeEmailForm, false);
    }
  });

  currentEmailCodeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-current-email-code-status]");
    if (!pendingEmailChange) {
      setMessage(status, "Start the email change again.", true);
      return;
    }
    setMessage(status, "Verifying your current email...");
    setFormBusy(currentEmailCodeForm, true);
    try {
      const data = await apiRequest("/api/account/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({
          email: pendingEmailChange.currentEmail,
          token: currentEmailCodeForm.elements.token.value,
          stage: "current",
        }),
      });
      setMessage(app.querySelector("[data-change-email-status]"), data.message);
      currentEmailCodeForm.hidden = true;
      newEmailCodeForm.hidden = false;
      newEmailCodeForm.elements.token.focus();
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(currentEmailCodeForm, false);
    }
  });

  newEmailCodeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-new-email-code-status]");
    if (!pendingEmailChange) {
      setMessage(status, "Start the email change again.", true);
      return;
    }
    setMessage(status, "Verifying your new email...");
    setFormBusy(newEmailCodeForm, true);
    try {
      const data = await apiRequest("/api/account/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({
          email: pendingEmailChange.newEmail,
          token: newEmailCodeForm.elements.token.value,
          stage: "new",
        }),
      });
      if (data.accessToken) storeAccessToken(data.accessToken);
      const sessionReady = Boolean(data.accessToken) || await refreshSession();
      if (!sessionReady) {
        const newEmail = pendingEmailChange.newEmail;
        storeAccessToken("");
        showSignedOut();
        loginForm.elements.email.value = newEmail;
        setMessage(systemStatus, "Your email was changed. Sign in again with your new email address.");
        return;
      }
      pendingEmailChange = null;
      emailVerification.hidden = true;
      changeEmailForm.reset();
      await loadAccount({ view: "security" });
      setMessage(dashboardStatus, data.message || "Your email address has been changed.");
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(newEmailCodeForm, false);
    }
  });

  const profileForm = app.querySelector("[data-profile-form]");
  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-profile-status]");
    setMessage(status, "Saving your profile...");
    setFormBusy(profileForm, true);
    try {
      const data = await apiRequest("/api/account", {
        method: "PUT",
        body: JSON.stringify({
          firstName: profileForm.elements.firstName.value,
          lastName: profileForm.elements.lastName.value,
          preferredName: profileForm.elements.preferredName.value,
          phone: profileForm.elements.phone.value,
        }),
      });
      renderAccount(data);
      setMessage(status, "Profile saved.");
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(profileForm, false);
    }
  });

  const certificationForm = app.querySelector("[data-certification-form]");
  certificationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = app.querySelector("[data-certification-status]");
    setMessage(status, "Adding your certification...");
    setFormBusy(certificationForm, true);
    try {
      const data = await apiRequest("/api/account/certifications", {
        method: "POST",
        body: JSON.stringify({
          agency: certificationForm.elements.agency.value,
          certificationName: certificationForm.elements.certificationName.value,
          certificationNumber: certificationForm.elements.certificationNumber.value,
          issuedOn: certificationForm.elements.issuedOn.value,
          expiresOn: certificationForm.elements.expiresOn.value,
        }),
      });
      certificationForm.reset();
      renderAccount(data);
      setMessage(status, "Certification added and awaiting verification.");
    } catch (error) {
      setMessage(status, error.message, true);
    } finally {
      setFormBusy(certificationForm, false);
    }
  });

  app.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-certification]");
    if (!deleteButton) return;
    const id = deleteButton.dataset.deleteCertification || "";
    if (!id || !window.confirm("Remove this certification from your account?")) return;
    deleteButton.disabled = true;
    try {
      renderAccount(await apiRequest(`/api/account/certifications/${encodeURIComponent(id)}`, { method: "DELETE" }));
    } catch (error) {
      setMessage(dashboardStatus, error.message, true);
    } finally {
      deleteButton.disabled = false;
    }
  });

  app.querySelector("[data-link-existing]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    setMessage(dashboardStatus, "Looking for records that use your verified email address...");
    try {
      const data = await apiRequest("/api/account/link-existing", { method: "POST" });
      renderAccount(data);
      const linked = data.linked || {};
      const total = Math.max(0, Number(linked.registrations) || 0) + Math.max(0, Number(linked.records) || 0);
      setMessage(dashboardStatus, total ? `${total} existing ${total === 1 ? "record was" : "records were"} connected.` : "No new matching records were found.");
    } catch (error) {
      setMessage(dashboardStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  app.querySelector("[data-logout]")?.addEventListener("click", async () => {
    await apiRequest("/api/account/auth/logout", { method: "POST" }, false).catch(() => null);
    storeAccessToken("");
    showSignedOut();
    setMessage(systemStatus, "You have signed out.");
  });

  async function init() {
    const response = await fetch("/api/account/auth/status", { headers: { Accept: "application/json" }, cache: "no-store" }).catch(() => null);
    const status = response ? await response.json().catch(() => ({})) : {};
    authEnabled = Boolean(response && response.ok && status && status.enabled);
    if (!authEnabled) {
      setMessage(systemStatus, "Customer accounts are being connected. Signup and login will open after secure email verification is configured.", true);
      authSection.querySelectorAll("button[type='submit']").forEach((button) => { button.disabled = true; });
      return;
    }
    setMessage(systemStatus, "Restoring your secure account session...");
    if (accessToken && await loadAccount()) return;
    if (await refreshSession() && await loadAccount()) return;
    const turnstileReady = await initTurnstile(String(status.turnstileSiteKey || ""));
    if (!turnstileReady) {
      authEnabled = false;
      setMessage(systemStatus, "The account security check could not load. Please refresh and try again.", true);
      authSection.querySelectorAll("button[type='submit']").forEach((button) => { button.disabled = true; });
      return;
    }
    setMessage(systemStatus, "Verified account access is available.");
  }

  init();
})();
