(() => {
  const apiRoot =
    (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const tickerUrl = apiRoot ? `${apiRoot}/api/v2/home-ticker` : "/api/v2/home-ticker";
  const tickerAdminUrl = apiRoot ? `${apiRoot}/api/admin/v2/home-ticker` : "/api/admin/v2/home-ticker";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const fallbackUrl = "/assets/data/home-ticker.json";
  const tokenStorageKey = "dmzMediaToken";
  const rotationMs = 5600;

  const tickerRoot = document.querySelector("[data-home-ticker]");
  const tickerLine = document.querySelector("[data-home-ticker-line]");
  const loginButton = document.querySelector(".home-login-button");
  const editFab = document.querySelector(".home-edit-fab");

  if (!tickerRoot || !tickerLine) return;

  const state = {
    lines: [],
    activeIndex: 0,
    intervalId: 0,
  };

  function getToken() {
    return window.sessionStorage.getItem(tokenStorageKey) || "";
  }

  function setToken(token) {
    if (!token) {
      window.sessionStorage.removeItem(tokenStorageKey);
      return;
    }
    window.sessionStorage.setItem(tokenStorageKey, token);
  }

  function canWriteWithoutLogin() {
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  }

  function isAuthed() {
    return Boolean(getToken()) || canWriteWithoutLogin();
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  function normalizeLines(input) {
    return (Array.isArray(input) ? input : [])
      .map((entry) => String(entry || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 24);
  }

  function syncAuthUi() {
    document.body.classList.toggle("home-authenticated", isAuthed());
  }

  function stopTickerRotation() {
    if (!state.intervalId) return;
    window.clearInterval(state.intervalId);
    state.intervalId = 0;
  }

  function renderTickerLine(index) {
    if (!state.lines.length) {
      tickerRoot.hidden = true;
      tickerLine.textContent = "";
      return;
    }
    const safeIndex = ((index % state.lines.length) + state.lines.length) % state.lines.length;
    state.activeIndex = safeIndex;
    tickerRoot.hidden = false;
    tickerLine.classList.remove("is-visible");
    window.requestAnimationFrame(() => {
      tickerLine.textContent = state.lines[safeIndex];
      tickerLine.classList.add("is-visible");
    });
  }

  function startTickerRotation() {
    stopTickerRotation();
    if (state.lines.length <= 1) return;
    state.intervalId = window.setInterval(() => {
      renderTickerLine(state.activeIndex + 1);
    }, rotationMs);
  }

  function applyTickerLines(lines) {
    state.lines = normalizeLines(lines);
    renderTickerLine(0);
    startTickerRotation();
  }

  async function loadTickerLines() {
    const tryUrls = [tickerUrl, fallbackUrl];
    for (const url of tryUrls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json().catch(() => ({}));
        const lines = normalizeLines(payload && payload.lines);
        if (lines.length) {
          applyTickerLines(lines);
          return;
        }
      } catch (error) {
        // Try next source.
      }
    }
    applyTickerLines([]);
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.remove();
    document.body.classList.remove("home-editor-open");
  }

  function openLoginModal(onSuccess) {
    if (document.querySelector(".home-admin-modal.home-auth-modal")) return;
    document.body.classList.add("home-editor-open");
    const overlay = document.createElement("div");
    overlay.className = "home-admin-modal home-auth-modal";
    overlay.innerHTML = `
      <div class="home-admin-modal-card" role="dialog" aria-modal="true" aria-label="DMZ admin login">
        <h3>DMZ Admin</h3>
        <p class="home-admin-modal-hint">Sign in to edit the home page ticker.</p>
        <form class="home-admin-form">
          <label>Username<input type="text" autocomplete="username" required /></label>
          <label>Password<input type="password" autocomplete="current-password" required /></label>
          <p class="home-admin-feedback is-error" data-error></p>
          <div class="home-admin-actions">
            <button type="button" class="home-admin-button is-secondary" data-cancel>Cancel</button>
            <button type="submit" class="home-admin-button">Sign In</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const errorEl = overlay.querySelector("[data-error]");
    const cancelBtn = overlay.querySelector("[data-cancel]");

    const cleanup = () => closeModal(overlay);
    if (cancelBtn) cancelBtn.addEventListener("click", cleanup);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) cleanup();
    });

    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (errorEl) errorEl.textContent = "";
      const inputs = form.querySelectorAll("input");
      const user = inputs[0] ? inputs[0].value.trim() : "";
      const pass = inputs[1] ? inputs[1].value : "";
      try {
        const response = await fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user, pass }),
        });
        if (!response.ok) {
          if (errorEl) errorEl.textContent = "Login failed.";
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!payload.token) {
          if (errorEl) errorEl.textContent = "Login failed.";
          return;
        }
        setToken(payload.token);
        syncAuthUi();
        cleanup();
        if (typeof onSuccess === "function") onSuccess();
      } catch (error) {
        if (errorEl) errorEl.textContent = "Login request failed.";
      }
    });
  }

  function openEditorModal() {
    if (!isAuthed()) {
      openLoginModal(openEditorModal);
      return;
    }
    if (document.querySelector(".home-admin-modal:not(.home-auth-modal)")) return;
    document.body.classList.add("home-editor-open");
    const overlay = document.createElement("div");
    overlay.className = "home-admin-modal";
    overlay.innerHTML = `
      <div class="home-admin-modal-card" role="dialog" aria-modal="true" aria-label="Edit home ticker">
        <h3>Home Page Ticker</h3>
        <p class="home-admin-modal-hint">Add one update per line. The home page rotates through them in order.</p>
        <form class="home-admin-form">
          <label>
            Ticker lines
            <textarea rows="9" data-lines-input placeholder="Class spots are limited this month.&#10;April pool sessions are filling now.&#10;Reach out early for first pick on travel briefings."></textarea>
          </label>
          <p class="home-admin-feedback" data-feedback></p>
          <div class="home-admin-actions">
            <button type="button" class="home-admin-button is-secondary" data-logout>Log Out</button>
            <button type="button" class="home-admin-button is-secondary" data-cancel>Cancel</button>
            <button type="submit" class="home-admin-button">Save Ticker</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const textarea = overlay.querySelector("[data-lines-input]");
    const feedback = overlay.querySelector("[data-feedback]");
    const cancelBtn = overlay.querySelector("[data-cancel]");
    const logoutBtn = overlay.querySelector("[data-logout]");

    if (textarea) {
      textarea.value = state.lines.join("\n");
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    const cleanup = () => closeModal(overlay);
    if (cancelBtn) cancelBtn.addEventListener("click", cleanup);
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        setToken("");
        syncAuthUi();
        cleanup();
      });
    }
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) cleanup();
    });

    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const lines = normalizeLines(
        String(textarea ? textarea.value : "")
          .split(/\r?\n/)
          .map((line) => line.trim())
      );
      if (feedback) {
        feedback.textContent = "";
        feedback.classList.remove("is-error", "is-success");
      }
      try {
        const response = await apiFetch(tickerAdminUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (feedback) {
            feedback.textContent = payload.error || "Save failed.";
            feedback.classList.add("is-error");
          }
          return;
        }
        applyTickerLines(payload && payload.payload ? payload.payload.lines : lines);
        if (feedback) {
          feedback.textContent = "Ticker saved.";
          feedback.classList.add("is-success");
        }
        window.setTimeout(cleanup, 500);
      } catch (error) {
        if (feedback) {
          feedback.textContent = "Save request failed.";
          feedback.classList.add("is-error");
        }
      }
    });
  }

  if (loginButton) {
    loginButton.addEventListener("click", () => {
      if (isAuthed()) {
        openEditorModal();
        return;
      }
      openLoginModal();
    });
  }

  if (editFab) {
    editFab.addEventListener("click", openEditorModal);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopTickerRotation();
      return;
    }
    renderTickerLine(state.activeIndex);
    startTickerRotation();
  });

  syncAuthUi();
  loadTickerLines();
})();
