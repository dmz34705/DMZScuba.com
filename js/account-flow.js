(() => {
  const app = document.querySelector("[data-account-flow-app]");
  if (!app) return;

  const flow = String(app.dataset.accountFlow || "");
  const tokenStorageKey = "dmzCustomerAccessToken";
  const signedInStorageKey = "dmzCustomerSignedIn";
  const pendingFlowStorageKey = "dmzAccountPendingFlow";
  const entryStateStorageKey = "dmzAccountEntryState";
  const signupPrefillStorageKey = "dmzBookingSignupPrefill";
  const apiTimeoutMs = 20000;
  const returnToBooking = new URLSearchParams(window.location.search).get("return") === "booking";
  const form = app.querySelector("[data-account-flow-form]");
  const status = app.querySelector("[data-account-flow-status]");
  const submitButton = form?.querySelector('button[type="submit"]');
  let accessToken = "";
  let turnstileSiteKey = "";
  let captchaToken = "";
  let captchaWidgetId = null;

  try {
    accessToken = window.sessionStorage.getItem(tokenStorageKey) || "";
  } catch (_error) {
    accessToken = "";
  }

  function setMessage(message, isError = false) {
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function setBusy(busy) {
    form?.querySelectorAll("button, input").forEach((control) => {
      if (control.type !== "hidden") control.disabled = Boolean(busy);
    });
  }

  function storeAccessToken(token) {
    accessToken = String(token || "");
    try {
      if (accessToken) window.sessionStorage.setItem(tokenStorageKey, accessToken);
      else window.sessionStorage.removeItem(tokenStorageKey);
    } catch (_error) {
      // Keep the current page session in memory when storage is unavailable.
    }
    try {
      if (accessToken) window.localStorage.setItem(signedInStorageKey, "1");
      else window.localStorage.removeItem(signedInStorageKey);
    } catch (_error) {
      // This value only controls the site-wide account label.
    }
  }

  function writeSessionValue(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function readSessionValue(key) {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function removeSessionValue(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (_error) {
      // Nothing else is required when storage is unavailable.
    }
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

  async function apiRequest(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    headers.Accept = "application/json";
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), apiTimeoutMs);
    try {
      const response = await fetch(path, {
        ...options,
        headers,
        credentials: "same-origin",
        signal: controller.signal,
      });
      return await parseResponse(response);
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("The account server took too long to respond. Please try again.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function removeTurnstile() {
    captchaToken = "";
    if (!window.turnstile || captchaWidgetId == null) return;
    window.turnstile.remove(captchaWidgetId);
    captchaWidgetId = null;
  }

  function renderTurnstile() {
    const container = app.querySelector("[data-account-flow-turnstile]");
    if (!container || !turnstileSiteKey || !window.turnstile || captchaWidgetId != null) return false;
    captchaWidgetId = window.turnstile.render(container, {
      sitekey: turnstileSiteKey,
      theme: "dark",
      size: "normal",
      retry: "auto",
      "retry-interval": 3000,
      "refresh-expired": "auto",
      "refresh-timeout": "auto",
      callback: (token) => {
        captchaToken = String(token || "");
        if (captchaToken) setMessage("Security check complete.");
      },
      "expired-callback": () => {
        captchaToken = "";
        setMessage("The security check expired and is refreshing. Please wait a moment.", true);
      },
      "timeout-callback": () => {
        captchaToken = "";
        setMessage("The security check timed out and is refreshing. Please wait a moment.", true);
      },
      "unsupported-callback": () => {
        captchaToken = "";
        setMessage("This browser cannot run the security check. Try an up-to-date version of Chrome, Edge, Firefox, or Safari.", true);
      },
      "error-callback": (errorCode) => {
        captchaToken = "";
        const code = String(errorCode || "").trim();
        setMessage(`The security check could not finish${code ? ` (${code})` : ""}. Refresh the page or try another browser.`, true);
        return true;
      },
    });
    return true;
  }

  async function initTurnstile() {
    for (let attempt = 0; attempt < 40 && !window.turnstile; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    if (!window.turnstile || !renderTurnstile()) {
      setMessage("The account security check could not load. Refresh the page and try again.", true);
      if (submitButton) submitButton.disabled = true;
      return false;
    }
    return true;
  }

  function consumeCaptcha() {
    const token = captchaToken;
    removeTurnstile();
    return token;
  }

  function renewCaptcha() {
    removeTurnstile();
    window.setTimeout(() => renderTurnstile(), 0);
  }

  function redirect(path) {
    const target = new URL(path, window.location.origin);
    if (returnToBooking) target.searchParams.set("return", "booking");
    window.location.assign(`${target.pathname}${target.search}${target.hash}`);
  }

  async function handleSignup(event) {
    event.preventDefault();
    const password = form.elements.password.value;
    if (password !== form.elements.confirmPassword.value) {
      setMessage("The passwords do not match.", true);
      return;
    }
    if (!captchaToken) {
      setMessage("Complete the security check.", true);
      return;
    }
    const email = String(form.elements.email.value || "").trim().toLowerCase();
    const token = consumeCaptcha();
    setMessage("Creating your account...");
    setBusy(true);
    try {
      await apiRequest("/api/account/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.elements.firstName.value,
          lastName: form.elements.lastName.value,
          email,
          password,
          captchaToken: token,
        }),
      });
      writeSessionValue(pendingFlowStorageKey, { email, type: "signup", createdAt: Date.now() });
      redirect("/pages/account/verify/");
    } catch (error) {
      setMessage(error.message, true);
      renewCaptcha();
      setBusy(false);
    }
  }

  async function handleRecovery(event) {
    event.preventDefault();
    if (!captchaToken) {
      setMessage("Complete the security check.", true);
      return;
    }
    const email = String(form.elements.email.value || "").trim().toLowerCase();
    const token = consumeCaptcha();
    setMessage("Sending your recovery code...");
    setBusy(true);
    try {
      await apiRequest("/api/account/auth/recover", {
        method: "POST",
        body: JSON.stringify({ email, captchaToken: token }),
      });
      writeSessionValue(pendingFlowStorageKey, { email, type: "recovery", createdAt: Date.now() });
      redirect("/pages/account/verify/");
    } catch (error) {
      setMessage(error.message, true);
      renewCaptcha();
      setBusy(false);
    }
  }

  async function handleVerification(event) {
    event.preventDefault();
    const pending = readSessionValue(pendingFlowStorageKey);
    if (!pending || !pending.email || !["signup", "recovery"].includes(pending.type)) {
      setMessage("Start from the account creation or forgot-password page to request a new code.", true);
      return;
    }
    setMessage(pending.type === "recovery" ? "Verifying your recovery code..." : "Verifying your email...");
    setBusy(true);
    try {
      const data = await apiRequest("/api/account/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          email: pending.email,
          token: form.elements.token.value,
          type: pending.type,
        }),
      });
      storeAccessToken(data.accessToken);
      removeSessionValue(pendingFlowStorageKey);
      if (pending.type === "recovery") {
        redirect("/pages/account/reset-password/");
        return;
      }
      const linkedAccount = await apiRequest("/api/account/link-existing", { method: "POST" }).catch(() => ({}));
      const linked = linkedAccount.linked || {};
      const linkedCount = Math.max(0, Number(linked.registrations) || 0) + Math.max(0, Number(linked.records) || 0);
      writeSessionValue(entryStateStorageKey, { mode: "created", linkedCount });
      redirect("/pages/account/");
    } catch (error) {
      setMessage(error.message, true);
      setBusy(false);
    }
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    const password = form.elements.password.value;
    if (password !== form.elements.confirmPassword.value) {
      setMessage("The passwords do not match.", true);
      return;
    }
    if (!accessToken) {
      setMessage("Verify a new recovery code before choosing a password.", true);
      return;
    }
    setMessage("Updating your password...");
    setBusy(true);
    try {
      await apiRequest("/api/account/auth/password", {
        method: "PUT",
        body: JSON.stringify({ password }),
      });
      writeSessionValue(entryStateStorageKey, { mode: "password-reset" });
      redirect("/pages/account/");
    } catch (error) {
      setMessage(error.message, true);
      setBusy(false);
    }
  }

  async function init() {
    const response = await fetch("/api/account/auth/status", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }).catch(() => null);
    const authStatus = response ? await response.json().catch(() => ({})) : {};
    if (!response || !response.ok || !authStatus.enabled) {
      setMessage("Customer accounts are temporarily unavailable. Please try again later.", true);
      if (submitButton) submitButton.disabled = true;
      return;
    }

    if (flow === "signup" || flow === "recovery") {
      if (flow === "signup") {
        const prefill = readSessionValue(signupPrefillStorageKey);
        if (prefill) {
          ["firstName", "lastName", "email"].forEach((name) => {
            if (form?.elements[name] && prefill[name]) form.elements[name].value = prefill[name];
          });
          removeSessionValue(signupPrefillStorageKey);
        }
      }
      turnstileSiteKey = String(authStatus.turnstileSiteKey || "").trim();
      await initTurnstile();
    } else if (flow === "verify") {
      const pending = readSessionValue(pendingFlowStorageKey);
      const emailInput = form?.elements.email;
      const step = app.querySelector("[data-account-flow-step]");
      const heading = app.querySelector("[data-account-flow-heading]");
      const copy = app.querySelector("[data-account-flow-copy]");
      const backLink = app.querySelector("[data-account-flow-back]");
      if (!pending || !pending.email || !["signup", "recovery"].includes(pending.type)) {
        setMessage("No verification request was found. Request a new code to continue.", true);
        if (submitButton) submitButton.disabled = true;
        return;
      }
      if (emailInput) emailInput.value = pending.email;
      if (pending.type === "recovery") {
        if (step) step.textContent = "Password recovery · Step 2 of 3";
        if (heading) heading.textContent = "Verify your email";
        if (copy) copy.textContent = "Enter the recovery code sent to your email address.";
        if (backLink) backLink.href = "/pages/account/forgot-password/";
      }
    } else if (flow === "reset" && !accessToken) {
      setMessage("Your recovery verification is missing or expired. Request a new recovery code.", true);
      if (submitButton) submitButton.disabled = true;
      return;
    }

  }

  if (flow === "signup") form?.addEventListener("submit", handleSignup);
  if (flow === "recovery") form?.addEventListener("submit", handleRecovery);
  if (flow === "verify") form?.addEventListener("submit", handleVerification);
  if (flow === "reset") form?.addEventListener("submit", handlePasswordReset);
  init();
})();
