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
  const adminFab = document.querySelector(".dest-admin-fab");
  const adminClose = document.querySelector(".dest-admin-close");
  const adminStatus = document.getElementById("destAdminStatus");
  const loginButtons = document.querySelectorAll(".dest-admin-login");
  const toggleButtons = document.querySelectorAll(".dest-admin-toggle");
  const collapseButton = document.querySelector(".dest-admin-collapse");
  const addButton = document.querySelector(".dest-admin-add");
  const publishButton = document.querySelector(".dest-admin-publish");
  const resetButton = document.querySelector(".dest-admin-reset");
  const refreshButton = document.querySelector(".dest-admin-refresh");
  const deleteButton = document.getElementById("destDelete");
  const listEl = document.getElementById("destAdminSelect");
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
  const validationEl = document.getElementById("destAdminValidation");
  const heroUploadInput = document.getElementById("destHeroUpload");
  const heroUploadButton = document.getElementById("destHeroUploadBtn");
  const heroUploadStatus = document.getElementById("destHeroUploadStatus");
  const isoUploadInput = document.getElementById("destIsoUpload");
  const isoUploadButton = document.getElementById("destIsoUploadBtn");
  const isoUploadStatus = document.getElementById("destIsoUploadStatus");

  let isDirty = false;
  let bannerTimer = null;
  let lastDraftAt = 0;

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

  async function requestImagesDirectUpload(variant) {
    if (!getToken()) {
      return new Promise((resolve) => {
        buildLoginModal(() => resolve(requestImagesDirectUpload(variant)));
      });
    }
    const resp = await apiFetch("/api/admin/images-direct-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant }),
    });
    if (!resp.ok) {
      throw new Error("Images direct upload failed.");
    }
    return resp.json();
  }

  async function uploadImageFile(file, statusEl, variant) {
    if (!file) return null;
    if (statusEl) statusEl.textContent = "Requesting upload...";
    const data = await requestImagesDirectUpload(variant);
    const uploadURL = data?.uploadURL;
    const deliveryUrl = data?.deliveryUrl || "";
    if (!uploadURL) throw new Error("Missing upload URL.");

    if (statusEl) statusEl.textContent = "Uploading...";
    await new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadURL, true);
      xhr.upload.addEventListener("progress", (event) => {
        if (!statusEl || !event.lengthComputable) return;
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        statusEl.textContent = `Uploading... ${percent}%`;
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    });

    if (statusEl) {
      statusEl.textContent = deliveryUrl ? "Upload complete." : "Upload complete. Add URL manually.";
    }
    return deliveryUrl;
  }

  function isCloudflareImageUrl(value) {
    if (!value) return false;
    return String(value).includes("imagedelivery.net/");
  }

  async function deleteImageByUrl(url) {
    if (!url || !isCloudflareImageUrl(url)) return;
    try {
      await apiFetch("/api/admin/images-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch (error) {
      // ignore delete failures
    }
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
      const updatedAt = Date.now();
      const payload = {
        baseItems: state.baseItems,
        expandedItems: state.expandedItems,
        selectedId: state.selectedId,
        updatedAt,
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      lastDraftAt = updatedAt;
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
      if (parsed.updatedAt) {
        lastDraftAt = Math.max(lastDraftAt, Number(parsed.updatedAt) || 0);
      }
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

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a destination...";
    listEl.appendChild(placeholder);

    const matches = [];
    const selectedItem = state.selectedId
      ? items.find((item) => item && item.id === state.selectedId)
      : null;

    items.forEach((item) => {
      if (!item || !item.id) return;
      if (term) {
        const hay = `${item.name || ""} ${item.subtitle || ""} ${item.id}`.toLowerCase();
        if (!hay.includes(term)) return;
      }
      matches.push(item);
    });

    if (selectedItem && !matches.some((item) => item.id === selectedItem.id)) {
      matches.unshift(selectedItem);
    }

    matches.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name || item.id || "Destination";
      listEl.appendChild(option);
    });

    listEl.value = state.selectedId || "";
  }

  function setFormValue(el, value) {
    if (!el) return;
    el.value = value == null ? "" : String(value);
  }

  function setInvalid(el, isInvalid) {
    if (!el) return;
    el.classList.toggle("is-invalid", Boolean(isInvalid));
  }

  function validateCurrent() {
    if (!validationEl) return;
    if (!state.selectedId) {
      validationEl.textContent = "";
      validationEl.classList.remove("is-error");
      return;
    }

    const issues = [];
    const idValue = fieldId ? fieldId.value.trim() : "";
    const nameValue = fieldName ? fieldName.value.trim() : "";
    const latValue = fieldLat ? Number(fieldLat.value) : NaN;
    const lonValue = fieldLon ? Number(fieldLon.value) : NaN;
    const heroValue = fieldHeroImage ? fieldHeroImage.value.trim() : "";
    const isoValue = fieldIsoImage ? fieldIsoImage.value.trim() : "";
    const summaryValue = fieldSummary ? fieldSummary.value.trim() : "";

    setInvalid(fieldId, !idValue);
    setInvalid(fieldName, !nameValue);
    setInvalid(fieldLat, !Number.isFinite(latValue) || latValue < -90 || latValue > 90);
    setInvalid(fieldLon, !Number.isFinite(lonValue) || lonValue < -180 || lonValue > 180);
    setInvalid(fieldHeroImage, !heroValue);
    setInvalid(fieldIsoImage, !isoValue);
    setInvalid(fieldSummary, !summaryValue);

    if (!idValue) issues.push("ID");
    if (!nameValue) issues.push("Name");
    if (!Number.isFinite(latValue) || latValue < -90 || latValue > 90) {
      issues.push("Latitude (-90 to 90)");
    }
    if (!Number.isFinite(lonValue) || lonValue < -180 || lonValue > 180) {
      issues.push("Longitude (-180 to 180)");
    }
    if (!heroValue) issues.push("Hero image");
    if (!isoValue) issues.push("Isometric image");
    if (!summaryValue) issues.push("Summary");

    if (issues.length) {
      validationEl.textContent = `Missing or invalid: ${issues.join(", ")}`;
      validationEl.classList.add("is-error");
    } else {
      validationEl.textContent = "All required fields look good.";
      validationEl.classList.remove("is-error");
    }
  }

  function fillEditor() {
    const base = getBaseById(state.selectedId);
    const expanded = getExpandedById(state.selectedId);
    const merged = mergeDestination(base, expanded);

    const hasSelection = Boolean(merged && merged.id);
    if (emptyState) emptyState.style.display = hasSelection ? "none" : "block";
    if (form) form.style.display = hasSelection ? "block" : "none";

    if (!hasSelection) {
      validateCurrent();
      return;
    }

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
    validateCurrent();
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
      validateCurrent();
    });

    bindField(fieldTags, () => {
      if (!state.selectedId) return;
      const tags = parseList(fieldTags.value);
      updateBase(state.selectedId, { tags });
      markDirty();
      validateCurrent();
    });

    bindField(fieldLat, () => {
      if (!state.selectedId) return;
      const lat = Number(fieldLat.value);
      updateBase(state.selectedId, { lat: Number.isFinite(lat) ? lat : 0 });
      markDirty();
      validateCurrent();
    });

    bindField(fieldLon, () => {
      if (!state.selectedId) return;
      const lon = Number(fieldLon.value);
      updateBase(state.selectedId, { lon: Number.isFinite(lon) ? lon : 0 });
      markDirty();
      validateCurrent();
    });

    bindField(fieldHeroImage, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { heroImage: fieldHeroImage.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldIsoImage, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { isoImage: fieldIsoImage.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldIsoTitle, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { isoTitle: fieldIsoTitle.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldIsoDesc, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { isoDesc: fieldIsoDesc.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldSummary, () => {
      if (!state.selectedId) return;
      updateBase(state.selectedId, { summary: fieldSummary.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldBullets, () => {
      if (!state.selectedId) return;
      const bullets = parseList(fieldBullets.value);
      updateBase(state.selectedId, { bullets });
      markDirty();
      validateCurrent();
    });

    bindField(fieldNarrative, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { narrative: fieldNarrative.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldDayToDay, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { dayToDay: fieldDayToDay.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldResortDetails, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { resortDetails: fieldResortDetails.value.trim() });
      markDirty();
      validateCurrent();
    });

    bindField(fieldLogisticsDetails, () => {
      if (!state.selectedId) return;
      ensureExpandedItem(state.selectedId);
      updateExpanded(state.selectedId, { logisticsDetails: fieldLogisticsDetails.value.trim() });
      markDirty();
      validateCurrent();
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
          validateCurrent();
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
        validateCurrent();
      });
    }
  }

  function setupImageUploads() {
    if (heroUploadButton && heroUploadInput) {
      heroUploadButton.addEventListener("click", () => {
        heroUploadInput.click();
      });
      heroUploadInput.addEventListener("change", async () => {
        const file = heroUploadInput.files ? heroUploadInput.files[0] : null;
        if (!file) return;
        const previousUrl = fieldHeroImage ? fieldHeroImage.value.trim() : "";
        try {
          const url = await uploadImageFile(file, heroUploadStatus, "travelhero");
          if (url && fieldHeroImage) {
            fieldHeroImage.value = url;
            if (state.selectedId) {
              updateBase(state.selectedId, { heroImage: url });
              markDirty();
              validateCurrent();
            }
          }
          if (previousUrl && previousUrl !== url) {
            deleteImageByUrl(previousUrl);
          }
        } catch (error) {
          if (heroUploadStatus) heroUploadStatus.textContent = "Upload failed.";
        } finally {
          heroUploadInput.value = "";
        }
      });
    }

    if (isoUploadButton && isoUploadInput) {
      isoUploadButton.addEventListener("click", () => {
        isoUploadInput.click();
      });
      isoUploadInput.addEventListener("change", async () => {
        const file = isoUploadInput.files ? isoUploadInput.files[0] : null;
        if (!file) return;
        const previousUrl = fieldIsoImage ? fieldIsoImage.value.trim() : "";
        try {
          const url = await uploadImageFile(file, isoUploadStatus, "traveliso");
          if (url && fieldIsoImage) {
            fieldIsoImage.value = url;
            if (state.selectedId) {
              updateBase(state.selectedId, { isoImage: url });
              markDirty();
              validateCurrent();
            }
          }
          if (previousUrl && previousUrl !== url) {
            deleteImageByUrl(previousUrl);
          }
        } catch (error) {
          if (isoUploadStatus) isoUploadStatus.textContent = "Upload failed.";
        } finally {
          isoUploadInput.value = "";
        }
      });
    }
  }
  function setupTabs() {
    const tabs = document.querySelectorAll(".dest-admin-tab");
    const panels = document.querySelectorAll(".dest-admin-tab-panel");
    if (!tabs.length || !panels.length) return;

    const activate = (key) => {
      tabs.forEach((tab) => {
        const isActive = tab.dataset.tab === key;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      panels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tab === key);
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activate(tab.dataset.tab);
      });
    });

    const current = document.querySelector(".dest-admin-tab.is-active") || tabs[0];
    if (current) {
      activate(current.dataset.tab);
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
    const lastKnownDraftAt = lastDraftAt;
    const draft = loadDraft();
    const draftAt = Number(draft && draft.updatedAt ? draft.updatedAt : 0) || 0;
    if (draft && draftAt > lastKnownDraftAt) {
      state.baseItems = Array.isArray(draft.baseItems) ? draft.baseItems : [];
      state.expandedItems = Array.isArray(draft.expandedItems) ? draft.expandedItems : [];
      state.selectedId = draft.selectedId || state.selectedId;
      rebuildMerged();
      setDirty(true);
    } else if (!isDirty) {
      openModal({
        title: "Nothing to publish",
        message: "No local travel edits were found. Destination page saves are already live.",
        confirmLabel: "Close",
        showCancel: false,
      });
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
    if (!adminPanel || !toggleButtons.length) return;

    updateAuthState();

    const setPanelOpen = (next) => {
      document.body.classList.toggle("dest-admin-open", next);
      if (adminFab) adminFab.setAttribute("aria-expanded", next ? "true" : "false");
    };

    const setEditMode = (next) => {
      document.body.classList.toggle("dest-edit-mode", next);
      toggleButtons.forEach((button) => {
        button.setAttribute("aria-pressed", next ? "true" : "false");
      });
      if (next) {
        setPanelOpen(true);
      }
    };

    const toggleEditMode = () => {
      if (!getToken()) {
        buildLoginModal(() => toggleEditMode());
        return;
      }
      const isActive = !document.body.classList.contains("dest-edit-mode");
      setEditMode(isActive);
    };

    if (loginButtons.length) {
      loginButtons.forEach((button) => {
        button.addEventListener("click", () => {
          buildLoginModal(() => {
            updateAuthState();
            setPanelOpen(true);
          });
        });
      });
    }

    toggleButtons.forEach((button) => {
      button.addEventListener("click", toggleEditMode);
    });

    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        setEditMode(false);
        setPanelOpen(false);
      });
    }

    if (adminFab) {
      adminFab.addEventListener("click", () => setPanelOpen(true));
    }

    if (adminClose) {
      adminClose.addEventListener("click", () => setPanelOpen(false));
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setPanelOpen(false);
    });


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

    if (listEl) {
      listEl.addEventListener("change", () => {
        const nextId = listEl.value;
        if (!nextId) return;
        selectId(nextId);
      });
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
    setupTabs();
    setupImageUploads();
    validateCurrent();
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
