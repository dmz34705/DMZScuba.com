(() => {
  const apiBase =
    (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const apiRoot = apiBase || "";
  const apiUrl = apiBase ? `${apiBase}/api/destinations` : "/api/destinations";
  const apiExpandedUrl = apiBase
    ? `${apiBase}/api/destinations-expanded`
    : "/api/destinations-expanded";
  const tokenStorageKey = "dmzMediaToken";
  const draftStorageKey = "dmzDestinationsDraft";

  const adminBar = document.getElementById("destAdminBar");
  const adminPanel = document.getElementById("destAdminPanel");
  const adminStatus = document.getElementById("destAdminStatus");
  const loginButtons = document.querySelectorAll(".dest-admin-login");
  const toggleButtons = document.querySelectorAll(".dest-admin-toggle");
  const collapseButton = document.querySelector(".dest-admin-collapse");
  const addButton = document.querySelector(".dest-admin-add");
  const publishButton = document.querySelector(".dest-admin-publish");
  const resetButton = document.querySelector(".dest-admin-reset");
  const refreshButton = document.querySelector(".dest-admin-refresh");
  const deleteButton = document.getElementById("destDelete");
  const listEl = document.getElementById("destAdminList");
  const searchInput = document.getElementById("destAdminSearch");

  const emptyState = adminPanel ? adminPanel.querySelector(".dest-admin-empty") : null;
  const form = document.getElementById("destAdminForm");

  const fieldId = document.getElementById("destFieldId");
  const fieldName = document.getElementById("destFieldName");
  const fieldSubtitle = document.getElementById("destFieldSubtitle");
  const fieldTags = document.getElementById("destFieldTags");
  const fieldLat = document.getElementById("destFieldLat");
  const fieldLon = document.getElementById("destFieldLon");
  const fieldHeroImage = document.getElementById("destFieldHeroImage");
  const fieldIsoImage = document.getElementById("destFieldIsoImage");
  const fieldIsoTitle = document.getElementById("destFieldIsoTitle");
  const fieldIsoDesc = document.getElementById("destFieldIsoDesc");
  const fieldSummary = document.getElementById("destFieldSummary");
  const fieldBullets = document.getElementById("destFieldBullets");
  const fieldNarrative = document.getElementById("destFieldNarrative");
  const fieldDayToDay = document.getElementById("destFieldDayToDay");
  const fieldResortDetails = document.getElementById("destFieldResortDetails");
  const fieldLogisticsDetails = document.getElementById("destFieldLogisticsDetails");
  const fieldBaseJson = document.getElementById("destFieldBaseJson");
  const fieldExpandedJson = document.getElementById("destFieldExpandedJson");
  const applyJsonButton = document.getElementById("destApplyJson");
  const formatJsonButton = document.getElementById("destFormatJson");

  let isDirty = false;
  let bannerTimer = null;

  const state = {
    baseItems: [],
    expandedItems: [],
    mergedItems: [],
    selectedId: "",
  };

  const listeners = new Set();

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

  function showPublishBanner(message, stateValue = "warning", autoHideMs = null) {
    const banner = document.getElementById("destPublishBanner");
    if (!banner) return;
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
    banner.textContent = message;
    banner.classList.add("is-visible");
    if (stateValue === "success") {
      banner.classList.add("is-success");
    } else {
      banner.classList.remove("is-success");
    }
    if (autoHideMs) {
      bannerTimer = window.setTimeout(() => {
        banner.classList.remove("is-visible");
      }, autoHideMs);
    }
  }

  function hidePublishBanner() {
    const banner = document.getElementById("destPublishBanner");
    if (!banner) return;
    banner.classList.remove("is-visible");
  }

  function setDirty(next) {
    isDirty = Boolean(next);
    document.body.classList.toggle("dest-has-unsaved", isDirty);
    if (isDirty) {
      showPublishBanner("Destinations not published. Please publish to save.");
    } else {
      hidePublishBanner();
    }
  }

  function markDirty() {
    setDirty(true);
  }

  async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${apiRoot}${path}`, { ...options, headers });
  }

  function mergeDestination(base, extra) {
    if (!base) return extra || base;
    if (!extra) return base;

    const merged = { ...base, ...extra };

    const mergeArray = (primary, addon) => {
      if (!Array.isArray(primary) && !Array.isArray(addon)) return null;
      const seen = new Set();
      const result = [];
      [...(primary || []), ...(addon || [])].forEach((item) => {
        if (!item || seen.has(item)) return;
        seen.add(item);
        result.push(item);
      });
      return result;
    };

    const mergedTags = mergeArray(base.tags, extra.tags);
    if (mergedTags) merged.tags = mergedTags;

    const mergedBullets = mergeArray(base.bullets, extra.bullets);
    if (mergedBullets) merged.bullets = mergedBullets;

    const mergedDiveSites = mergeArray(base.diveSites, extra.diveSites);
    if (mergedDiveSites) merged.diveSites = mergedDiveSites;

    const mergedNonDiving = mergeArray(base.nonDiving, extra.nonDiving);
    if (mergedNonDiving) merged.nonDiving = mergedNonDiving;

    if (base.resort || extra.resort) {
      merged.resort = { ...(base.resort || {}), ...(extra.resort || {}) };
    }

    if (base.conditions || extra.conditions) {
      merged.conditions = { ...(base.conditions || {}), ...(extra.conditions || {}) };
    }

    return merged;
  }

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function getBaseById(id) {
    return state.baseItems.find((item) => item && item.id === id) || null;
  }

  function getExpandedById(id) {
    return state.expandedItems.find((item) => item && item.id === id) || null;
  }

  function setItems(baseItems, expandedItems) {
    state.baseItems = Array.isArray(baseItems) ? baseItems : [];
    state.expandedItems = Array.isArray(expandedItems) ? expandedItems : [];
    rebuildMerged();
    saveDraft();
    notify();
  }

  function rebuildMerged() {
    const expandedMap = new Map();
    state.expandedItems.forEach((item) => {
      if (item && item.id) expandedMap.set(item.id, item);
    });

    const merged = [];
    state.baseItems.forEach((item) => {
      if (!item || !item.id) return;
      const extra = expandedMap.get(item.id);
      merged.push(mergeDestination(item, extra));
    });

    state.expandedItems.forEach((item) => {
      if (!item || !item.id) return;
      if (!state.baseItems.some((base) => base && base.id === item.id)) {
        merged.push({ ...item });
      }
    });

    state.mergedItems = merged;
  }

  function notify() {
    listeners.forEach((cb) => cb(state.baseItems));
  }

  function subscribe(cb) {
    if (typeof cb === "function") listeners.add(cb);
  }

  function saveDraft() {
    try {
      const payload = {
        baseItems: state.baseItems,
        expandedItems: state.expandedItems,
        selectedId: state.selectedId,
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn("Destination draft save failed.", error);
    }
  }

  function loadDraft() {
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (error) {
      console.warn("Destination draft load failed.", error);
      return null;
    }
  }

  async function fetchDestinationsData() {
    let baseItems = [];
    let expandedItems = [];

    try {
      const apiRes = await fetch(apiUrl, { cache: "no-store" });
      if (apiRes.ok) {
        const data = await apiRes.json();
        baseItems = Array.isArray(data.items) ? data.items : [];
      }
    } catch (error) {
      // ignore
    }

    if (!baseItems.length) {
      const fallbackRes = await fetch("/assets/data/destinations.json", { cache: "no-store" });
      if (fallbackRes.ok) {
        baseItems = await fallbackRes.json();
      }
    }

    try {
      const apiRes = await fetch(apiExpandedUrl, { cache: "no-store" });
      if (apiRes.ok) {
        const data = await apiRes.json();
        expandedItems = Array.isArray(data.items) ? data.items : [];
      }
    } catch (error) {
      // ignore
    }

    if (!expandedItems.length) {
      try {
        const fallbackRes = await fetch("/assets/data/destinations-expanded.json", { cache: "no-store" });
        if (fallbackRes.ok) {
          expandedItems = await fallbackRes.json();
        }
      } catch (error) {
        expandedItems = [];
      }
    }

    return { baseItems, expandedItems };
  }

  function updateAuthState() {
    const authed = Boolean(getToken());
    document.body.classList.toggle("dest-authenticated", authed);
    if (adminStatus) {
      adminStatus.textContent = authed ? "Signed in" : "Signed out";
    }
    if (loginButtons.length) {
      loginButtons.forEach((button) => {
        button.textContent = authed ? "Re-auth" : "DMZ Login";
      });
    }
  }

  function buildLoginModal(onSuccess) {
    if (document.querySelector(".media-auth-modal")) return;
    const overlay = document.createElement("div");
    overlay.className = "media-edit-modal media-auth-modal";
    const card = document.createElement("div");
    card.className = "media-edit-modal-card";

    const heading = document.createElement("h3");
    heading.textContent = "DMZ Admin";
    const hint = document.createElement("p");
    hint.className = "media-edit-modal-hint";
    hint.textContent = "Sign in to manage destinations.";

    const formEl = document.createElement("form");
    formEl.className = "media-edit-form";

    const userLabel = document.createElement("label");
    userLabel.textContent = "Username";
    const userInput = document.createElement("input");
    userInput.type = "text";
    userInput.autocomplete = "username";

    const passLabel = document.createElement("label");
    passLabel.textContent = "Password";
    const passInput = document.createElement("input");
    passInput.type = "password";
    passInput.autocomplete = "current-password";

    const error = document.createElement("p");
    error.className = "media-edit-modal-hint";
    error.style.color = "rgba(226, 27, 35, 0.85)";

    const actions = document.createElement("div");
    actions.className = "media-edit-modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "media-edit-cancel";
    cancelBtn.textContent = "Cancel";
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "media-edit-save";
    saveBtn.textContent = "Sign In";
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    formEl.appendChild(userLabel);
    formEl.appendChild(userInput);
    formEl.appendChild(passLabel);
    formEl.appendChild(passInput);
    formEl.appendChild(error);
    formEl.appendChild(actions);

    card.appendChild(heading);
    card.appendChild(hint);
    card.appendChild(formEl);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }

    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      try {
        const resp = await apiFetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: userInput.value.trim(), pass: passInput.value }),
        });
        if (!resp.ok) {
          error.textContent = "Login failed. Check credentials.";
          return;
        }
        const data = await resp.json();
        if (!data.token) {
          error.textContent = "Login failed. Try again.";
          return;
        }
        setToken(data.token);
        close();
        if (typeof onSuccess === "function") onSuccess();
      } catch (err) {
        console.error("Destination login failed.", err);
        error.textContent = "Login failed. Check the console for details.";
      }
    });
  }

  function closeExistingModal() {
    const modal = document.querySelector(".media-edit-modal");
    if (modal) modal.remove();
  }

  function openModal({
    title = "DMZ Admin",
    message = "",
    fields = [],
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    showCancel = true,
    danger = false,
  }) {
    closeExistingModal();
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "media-edit-modal";
      const card = document.createElement("div");
      card.className = "media-edit-modal-card";

      const heading = document.createElement("h3");
      heading.textContent = title;
      const hint = document.createElement("p");
      hint.className = "media-edit-modal-hint";
      hint.textContent = message;

      const formEl = document.createElement("form");
      formEl.className = "media-edit-form";

      const inputs = {};
      fields.forEach((field) => {
        const label = document.createElement("label");
        label.textContent = field.label || "Field";
        const input = document.createElement("input");
        input.type = field.type || "text";
        input.name = field.name || "value";
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.value) input.value = field.value;
        if (field.required) input.required = true;
        inputs[input.name] = input;
        formEl.appendChild(label);
        formEl.appendChild(input);
      });

      const actions = document.createElement("div");
      actions.className = "media-edit-modal-actions";
      let cancelBtn = null;
      if (showCancel) {
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "media-edit-cancel";
        cancelBtn.textContent = cancelLabel;
        actions.appendChild(cancelBtn);
      }
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "submit";
      confirmBtn.className = "media-edit-save";
      confirmBtn.textContent = confirmLabel;
      if (danger) {
        confirmBtn.style.borderColor = "rgba(226, 27, 35, 0.6)";
        confirmBtn.style.color = "rgba(226, 27, 35, 0.95)";
      }
      actions.appendChild(confirmBtn);

      card.appendChild(heading);
      if (message) card.appendChild(hint);
      if (fields.length) card.appendChild(formEl);
      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      const close = (result) => {
        overlay.remove();
        resolve(result);
      };

      if (cancelBtn) cancelBtn.addEventListener("click", () => close({ ok: false }));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close({ ok: false });
      });

      formEl.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = {};
        Object.keys(inputs).forEach((key) => {
          values[key] = inputs[key].value;
        });
        close({ ok: true, values });
      });

      if (!fields.length) {
        confirmBtn.addEventListener("click", (event) => {
          event.preventDefault();
          close({ ok: true });
        });
      }
    });
  }

  function renderList() {
    if (!listEl) return;
    const term = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const items = [...state.baseItems].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

    listEl.innerHTML = "";
    items.forEach((item) => {
      if (!item || !item.id) return;
      if (term) {
        const hay = `${item.name || ""} ${item.subtitle || ""} ${item.id}`.toLowerCase();
        if (!hay.includes(term)) return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dest-admin-item";
      button.dataset.id = item.id;
      if (item.id === state.selectedId) {
        button.classList.add("is-active");
      }

      const title = document.createElement("span");
      title.className = "dest-admin-item-title";
      title.textContent = item.name || item.id || "Destination";

      const sub = document.createElement("span");
      sub.className = "dest-admin-item-sub";
      sub.textContent = item.subtitle || "No subtitle";

      button.appendChild(title);
      button.appendChild(sub);
      button.addEventListener("click", () => {
        selectId(item.id);
      });
      listEl.appendChild(button);
    });
  }

  function setFormValue(el, value) {
    if (!el) return;
    el.value = value == null ? "" : String(value);
  }

  function fillEditor() {
    const base = getBaseById(state.selectedId);
    const expanded = getExpandedById(state.selectedId);
    const merged = mergeDestination(base, expanded);

    const hasSelection = Boolean(merged && merged.id);
    if (emptyState) emptyState.style.display = hasSelection ? "none" : "block";
    if (form) form.style.display = hasSelection ? "block" : "none";

    if (!hasSelection) return;

    setFormValue(fieldId, merged.id || "");
    setFormValue(fieldName, merged.name || "");
    setFormValue(fieldSubtitle, merged.subtitle || "");
    setFormValue(fieldTags, Array.isArray(merged.tags) ? merged.tags.join(", ") : "");
    setFormValue(fieldLat, merged.lat ?? "");
    setFormValue(fieldLon, merged.lon ?? "");
    setFormValue(fieldHeroImage, merged.heroImage || "");
    setFormValue(fieldIsoImage, merged.isoImage || "");
    setFormValue(fieldIsoTitle, merged.isoTitle || "");
    setFormValue(fieldIsoDesc, merged.isoDesc || "");
    setFormValue(fieldSummary, merged.summary || "");
    setFormValue(fieldBullets, Array.isArray(merged.bullets) ? merged.bullets.join("\n") : "");
    setFormValue(fieldNarrative, merged.narrative || "");
    setFormValue(fieldDayToDay, merged.dayToDay || "");
    setFormValue(fieldResortDetails, merged.resortDetails || merged.resort?.description || "");
    setFormValue(fieldLogisticsDetails, merged.logisticsDetails || merged.logistics || "");

    if (fieldBaseJson) {
      const baseSource = base || merged || { id: state.selectedId };
      fieldBaseJson.value = JSON.stringify(baseSource, null, 2);
    }
    if (fieldExpandedJson) {
      const expSource = expanded || (merged ? { id: merged.id } : { id: state.selectedId });
      fieldExpandedJson.value = JSON.stringify(expSource, null, 2);
    }
  }

  function selectId(id) {
    state.selectedId = id || "";
    saveDraft();
    renderList();
    fillEditor();
  }

  function updateBase(id, patch) {
    const item = getBaseById(id);
    if (!item) return;
    Object.assign(item, patch);
    rebuildMerged();
    saveDraft();
    renderList();
    notify();
  }

  function updateExpanded(id, patch) {
    const item = getExpandedById(id);
    if (!item) return;
    Object.assign(item, patch);
    rebuildMerged();
    saveDraft();
    notify();
  }

  function ensureBaseItem(id) {
    let item = getBaseById(id);
    if (item) return item;
    item = { id, name: id, subtitle: "", lat: 0, lon: 0, tags: [] };
    state.baseItems.push(item);
    return item;
  }

  function ensureExpandedItem(id) {
    let item = getExpandedById(id);
    if (item) return item;
    item = { id };
    state.expandedItems.push(item);
    return item;
  }

  function renameId(oldId, nextId) {
    const normalized = normalizeId(nextId);
    if (!normalized) return false;
    if (oldId === normalized) return true;
    const exists = state.baseItems.some((item) => item && item.id === normalized);
    if (exists) {
      openModal({
        title: "ID already in use",
        message: "That destination ID is already in use. Choose a different ID.",
        confirmLabel: "Close",
        showCancel: false,
      });
      return false;
    }

    const base = getBaseById(oldId);
    const expanded = getExpandedById(oldId);
    if (base) base.id = normalized;
    if (expanded) expanded.id = normalized;
    state.selectedId = normalized;
    rebuildMerged();
    saveDraft();
    renderList();
    fillEditor();
    notify();
    return true;
  }

  function parseList(value) {
    return String(value || "")
      .split(/\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function bindField(el, handler) {
    if (!el) return;
    el.addEventListener("input", handler);
  }

  function bindEditor() {
    if (fieldId) {
      fieldId.addEventListener("change", () => {
        const nextId = fieldId.value.trim();
        if (!state.selectedId) return;
        const ok = renameId(state.selectedId, nextId);
        if (ok) markDirty();
      });
    }

    bindField(fieldName, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { name: fieldName.value.trim() });
      markDirty();
      fillEditor();
    });

    bindField(fieldSubtitle, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { subtitle: fieldSubtitle.value.trim() });
      markDirty();
      renderList();
    });

    bindField(fieldTags, () => {
      if (!state.selectedId) return;
      const tags = parseList(fieldTags.value);
      updateBase(state.selectedId, { tags });
      markDirty();
    });

    bindField(fieldLat, () => {
      if (!state.selectedId) return;
      const lat = Number(fieldLat.value);
      updateBase(state.selectedId, { lat: Number.isFinite(lat) ? lat : 0 });
      markDirty();
    });

    bindField(fieldLon, () => {
      if (!state.selectedId) return;
      const lon = Number(fieldLon.value);
      updateBase(state.selectedId, { lon: Number.isFinite(lon) ? lon : 0 });
      markDirty();
    });

    bindField(fieldHeroImage, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { heroImage: fieldHeroImage.value.trim() });
      markDirty();
    });

    bindField(fieldIsoImage, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { isoImage: fieldIsoImage.value.trim() });
      markDirty();
    });

    bindField(fieldIsoTitle, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { isoTitle: fieldIsoTitle.value.trim() });
      markDirty();
    });

    bindField(fieldIsoDesc, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { isoDesc: fieldIsoDesc.value.trim() });
      markDirty();
    });

    bindField(fieldSummary, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { summary: fieldSummary.value.trim() });
      markDirty();
    });

    bindField(fieldBullets, () => {
      if (!state.selectedId) return;
      const bullets = parseList(fieldBullets.value);
      updateBase(state.selectedId, { bullets });
      markDirty();
    });

    bindField(fieldNarrative, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { narrative: fieldNarrative.value.trim() });
      markDirty();
    });

    bindField(fieldDayToDay, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { dayToDay: fieldDayToDay.value.trim() });
      markDirty();
    });

    bindField(fieldResortDetails, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { resortDetails: fieldResortDetails.value.trim() });
      markDirty();
    });

    bindField(fieldLogisticsDetails, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { logisticsDetails: fieldLogisticsDetails.value.trim() });
      markDirty();
    });

    if (applyJsonButton) {
      applyJsonButton.addEventListener("click", () => {
        if (!state.selectedId) return;
        try {
          if (fieldBaseJson && fieldBaseJson.value.trim()) {
            const parsed = JSON.parse(fieldBaseJson.value);
            if (parsed && parsed.id) {
              const targetId = String(parsed.id);
              if (targetId !== state.selectedId) {
                renameId(state.selectedId, targetId);
              }
              const baseItem = ensureBaseItem(targetId);
              Object.assign(baseItem, parsed);
            }
          }
          if (fieldExpandedJson && fieldExpandedJson.value.trim()) {
            const parsed = JSON.parse(fieldExpandedJson.value);
            if (parsed && parsed.id) {
              const targetId = String(parsed.id);
              if (targetId !== state.selectedId) {
                renameId(state.selectedId, targetId);
              }
              const expItem = ensureExpandedItem(targetId);
              Object.assign(expItem, parsed);
            }
          }
          rebuildMerged();
          saveDraft();
          renderList();
          fillEditor();
          markDirty();
        } catch (error) {
          openModal({
            title: "Invalid JSON",
            message: "JSON parse failed. Please check formatting.",
            confirmLabel: "Close",
            showCancel: false,
          });
        }
      });
    }

    if (formatJsonButton) {
      formatJsonButton.addEventListener("click", () => {
        if (!state.selectedId) return;
        const base = getBaseById(state.selectedId);
        const expanded = getExpandedById(state.selectedId);
        if (fieldBaseJson) {
          const source = base || { id: state.selectedId };
          fieldBaseJson.value = JSON.stringify(source, null, 2);
        }
        if (fieldExpandedJson) {
          const source = expanded || { id: state.selectedId };
          fieldExpandedJson.value = JSON.stringify(source, null, 2);
        }
      });
    }
  }

  function addDestination() {
    openModal({
      title: "Add Destination",
      message: "Enter a destination name to create the new record.",
      fields: [
        {
          label: "Destination name",
          name: "name",
          placeholder: "Cozumel",
          required: true,
        },
      ],
      confirmLabel: "Create",
    }).then((result) => {
      if (!result.ok) return;
      const name = String(result.values?.name || "").trim();
      if (!name) return;
      const id = normalizeId(name);
      if (!id) return;
      if (state.baseItems.some((item) => item && item.id === id)) {
        openModal({
          title: "Already exists",
          message: "That destination ID already exists. Pick a different name.",
          confirmLabel: "Close",
          showCancel: false,
        });
        return;
      }
      const baseItem = {
        id,
        name,
        subtitle: "",
        lat: 0,
        lon: 0,
        tags: [],
        heroImage: "",
        isoImage: "",
        isoTitle: "",
        isoDesc: "",
        summary: "",
        bullets: [],
      };
      state.baseItems.push(baseItem);
      state.expandedItems.push({ id });
      rebuildMerged();
      saveDraft();
      selectId(id);
      markDirty();
      notify();
    });
  }

  function deleteDestination() {
    if (!state.selectedId) return;
    openModal({
      title: "Delete destination?",
      message: "This destination will be removed on publish. You can still undo by resetting the draft.",
      confirmLabel: "Delete",
      danger: true,
    }).then((result) => {
      if (!result.ok) return;
      const id = state.selectedId;
      state.baseItems = state.baseItems.filter((item) => item && item.id !== id);
      state.expandedItems = state.expandedItems.filter((item) => item && item.id !== id);
      state.selectedId = "";
      rebuildMerged();
      saveDraft();
      renderList();
      fillEditor();
      markDirty();
      notify();
    });
  }

  async function publishDestinations() {
    if (!getToken()) {
      buildLoginModal(() => publishDestinations());
      return;
    }
    let deleteIds = [];
    try {
      const resp = await fetch(apiUrl, { cache: "no-store" });
      if (resp.ok) {
        const data = await resp.json();
        const serverItems = Array.isArray(data.items) ? data.items : [];
        const currentIds = new Set(state.baseItems.map((item) => item && item.id).filter(Boolean));
        deleteIds = serverItems
          .map((item) => item && item.id)
          .filter((id) => id && !currentIds.has(id));
      }
    } catch (error) {
      // ignore delete sync errors
    }
    try {
      const resp = await apiFetch("/api/admin/destinations-bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseItems: state.baseItems,
          expandedItems: state.expandedItems,
          deleteIds,
        }),
      });
      if (!resp.ok) {
        openModal({
          title: "Publish failed",
          message: "Check your login or API connection and try again.",
          confirmLabel: "Close",
          showCancel: false,
        });
        return;
      }
      openModal({
        title: "Published",
        message: "Destinations published to DMZ.",
        confirmLabel: "Close",
        showCancel: false,
      });
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch (error) {
        // ignore
      }
      setDirty(false);
      showPublishBanner("Destinations published.", "success", 2000);
    } catch (error) {
      openModal({
        title: "Publish failed",
        message: "Check your login or API connection and try again.",
        confirmLabel: "Close",
        showCancel: false,
      });
    }
  }

  async function refreshFromServer() {
    if (isDirty) {
      const result = await openModal({
        title: "Master refresh?",
        message: "Unsaved changes will be lost. Continue with master refresh?",
        confirmLabel: "Refresh",
      });
      if (!result.ok) return;
    }
    setDirty(false);
    hidePublishBanner();
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch (error) {
      // ignore
    }
    const data = await fetchDestinationsData();
    setItems(data.baseItems, data.expandedItems);
  }

  function clearDraft() {
    openModal({
      title: "Reset draft?",
      message: "Discard local edits and reload from live data?",
      confirmLabel: "Reset",
      danger: true,
    }).then((result) => {
      if (!result.ok) return;
      setDirty(false);
      hidePublishBanner();
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch (error) {
        // ignore
      }
      window.location.reload();
    });
    return;
  }

  function setupAdminControls() {
    if (!adminBar || !adminPanel || !toggleButtons.length) return;

    updateAuthState();

    const toggleEditMode = () => {
      if (!getToken()) {
        buildLoginModal(() => toggleEditMode());
        return;
      }
      const isActive = document.body.classList.toggle("dest-edit-mode");
      toggleButtons.forEach((button) => {
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      adminPanel.classList.toggle("is-visible", isActive);
    };

    if (loginButtons.length) {
      loginButtons.forEach((button) => {
        button.addEventListener("click", () => {
          buildLoginModal(() => {
            updateAuthState();
          });
        });
      });
    }

    toggleButtons.forEach((button) => {
      button.addEventListener("click", toggleEditMode);
    });

    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        if (!document.body.classList.contains("dest-edit-mode")) return;
        document.body.classList.remove("dest-edit-mode");
        adminPanel.classList.remove("is-visible");
        toggleButtons.forEach((button) => {
          button.setAttribute("aria-pressed", "false");
        });
      });
    }


    if (addButton) {
      addButton.addEventListener("click", addDestination);
    }

    if (publishButton) {
      publishButton.addEventListener("click", publishDestinations);
    }

    if (resetButton) {
      resetButton.addEventListener("click", clearDraft);
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", refreshFromServer);
    }

    if (deleteButton) {
      deleteButton.addEventListener("click", deleteDestination);
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => renderList());
    }
  }

  function setPinPosition(id, lat, lon) {
    const base = getBaseById(id);
    if (!base) return;
    base.lat = lat;
    base.lon = lon;
    rebuildMerged();
    saveDraft();
    markDirty();
    if (state.selectedId === id) {
      fillEditor();
    }
  }

  async function init() {
    const data = await fetchDestinationsData();
    const draft = loadDraft();

    if (draft && Array.isArray(draft.baseItems)) {
      state.baseItems = draft.baseItems;
      state.expandedItems = Array.isArray(draft.expandedItems) ? draft.expandedItems : [];
      state.selectedId = draft.selectedId || "";
      setDirty(true);
    } else {
      state.baseItems = data.baseItems;
      state.expandedItems = data.expandedItems;
      state.selectedId = "";
    }

    rebuildMerged();
    renderList();
    fillEditor();
    setupAdminControls();
    bindEditor();
  }

  window.DMZDestinations = {
    ready() {
      return initPromise;
    },
    getBaseItems() {
      return state.baseItems;
    },
    getExpandedItems() {
      return state.expandedItems;
    },
    getMergedItems() {
      return state.mergedItems;
    },
    subscribe,
    isEditMode() {
      return document.body.classList.contains("dest-edit-mode");
    },
    selectId,
    setPinPosition,
    updateBaseItem(id, patch) {
      updateBase(id, patch);
      markDirty();
    },
  };

  const initPromise = init();
})();
