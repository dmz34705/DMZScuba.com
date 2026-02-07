(() => {
  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const listUrl = apiRoot ? `${apiRoot}/api/v2/destinations` : "/api/v2/destinations";
  const byIdUrl = apiRoot ? `${apiRoot}/api/v2/destinations/` : "/api/v2/destinations/";
  const adminByIdUrl = apiRoot ? `${apiRoot}/api/admin/v2/destinations/` : "/api/admin/v2/destinations/";
  const loginUrl = apiRoot ? `${apiRoot}/api/admin/login` : "/api/admin/login";
  const imagesDirectUploadUrl = apiRoot ? `${apiRoot}/api/admin/images-direct-upload` : "/api/admin/images-direct-upload";
  const imagesDeleteUrl = apiRoot ? `${apiRoot}/api/admin/images-delete` : "/api/admin/images-delete";
  const tokenStorageKey = "dmzMediaToken";

  const adminPanel = document.getElementById("destAdminPanel");
  if (!adminPanel) return;

  const adminFab = document.querySelector(".dest-admin-fab");
  const adminClose = document.querySelector(".dest-admin-close");
  const adminStatus = document.getElementById("destAdminStatus");
  const loginButtons = document.querySelectorAll(".dest-admin-login");
  const toggleButtons = document.querySelectorAll(".dest-admin-toggle");
  const addButton = document.querySelector(".dest-admin-add");
  const publishButton = document.querySelector(".dest-admin-publish");
  const resetButton = document.querySelector(".dest-admin-reset");
  const refreshButton = document.querySelector(".dest-admin-refresh");
  const deleteButton = document.getElementById("destDelete");

  const listEl = document.getElementById("destAdminSelect");
  const searchInput = document.getElementById("destAdminSearch");
  const emptyState = adminPanel.querySelector(".dest-admin-empty");
  const formEl = document.getElementById("destAdminForm");
  const validationEl = document.getElementById("destAdminValidation");

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
  const heroUploadInput = document.getElementById("destHeroUpload");
  const heroUploadButton = document.getElementById("destHeroUploadBtn");
  const heroUploadStatus = document.getElementById("destHeroUploadStatus");
  const isoUploadInput = document.getElementById("destIsoUpload");
  const isoUploadButton = document.getElementById("destIsoUploadBtn");
  const isoUploadStatus = document.getElementById("destIsoUploadStatus");

  const tabs = adminPanel.querySelectorAll(".dest-admin-tab");
  const panels = adminPanel.querySelectorAll(".dest-admin-tab-panel");
  const subscribers = new Set();

  let items = [];
  let selectedId = "";

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
    return String(window.location.hostname || "").toLowerCase().endsWith(".pages.dev");
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

  function setStatus(text) {
    if (adminStatus) adminStatus.textContent = text;
  }

  function isEditMode() {
    return document.body.classList.contains("dest-edit-mode");
  }

  function showValidation(message, isError = false) {
    if (!validationEl) return;
    validationEl.textContent = message || "";
    validationEl.style.color = isError ? "rgba(226, 27, 35, 0.9)" : "rgba(174, 255, 210, 0.95)";
  }

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function linesToList(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function listToLines(list) {
    return (Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter(Boolean).join("\n");
  }

  function normalizeImageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("imagedelivery.net/")) return `https://${raw}`;
    return raw;
  }

  function getSelected() {
    return items.find((item) => item && item.id === selectedId) || null;
  }

  function notifySubscribers() {
    const snapshot = items.map((item) => ({ ...item }));
    subscribers.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (error) {
        // ignore subscriber errors
      }
    });
  }

  function toggleAdminOpen(next) {
    document.body.classList.toggle("dest-admin-open", Boolean(next));
    if (adminFab) adminFab.setAttribute("aria-expanded", next ? "true" : "false");
  }

  function toggleEditMode(next) {
    document.body.classList.toggle("dest-edit-mode", Boolean(next));
    toggleButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      btn.textContent = next ? "Close Editor" : "Edit Destinations";
    });
    if (next) {
      showValidation("Edit mode enabled. Drag pins on the globe to move locations, then click Publish.");
    }
  }

  function setFormVisible(visible) {
    if (emptyState) emptyState.style.display = visible ? "none" : "block";
    if (formEl) formEl.style.display = visible ? "flex" : "none";
  }

  function setActiveTab(tab) {
    tabs.forEach((btn) => {
      const on = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.getAttribute("data-tab") === tab);
    });
  }

  function fillForm(item) {
    if (!item) return;
    fieldId.value = item.id || "";
    fieldName.value = item.name || "";
    fieldSubtitle.value = item.subtitle || "";
    fieldTags.value = (item.tags || []).join(", ");
    fieldLat.value = Number(item.lat || 0);
    fieldLon.value = Number(item.lon || 0);
    fieldHeroImage.value = item.heroImage || "";
    fieldIsoImage.value = item.isoImage || "";
    fieldIsoTitle.value = item.isoTitle || "";
    fieldIsoDesc.value = item.isoDesc || "";
    fieldSummary.value = item.summary || "";
    fieldBullets.value = listToLines(item.bullets);
    fieldNarrative.value = item.narrative || "";
    fieldDayToDay.value = item.dayToDay || "";
    fieldResortDetails.value = item.resortDetails || "";
    fieldLogisticsDetails.value = item.logisticsDetails || "";

    const pretty = JSON.stringify(item, null, 2);
    fieldBaseJson.value = pretty;
    fieldExpandedJson.value = pretty;
  }

  function collectForm() {
    const existing = getSelected() || {};
    const id = normalizeId(fieldId.value);
    return {
      ...existing,
      id,
      name: fieldName.value.trim(),
      subtitle: fieldSubtitle.value.trim(),
      tags: fieldTags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
      lat: Number(fieldLat.value || 0),
      lon: Number(fieldLon.value || 0),
      heroImage: normalizeImageUrl(fieldHeroImage.value),
      isoImage: normalizeImageUrl(fieldIsoImage.value),
      isoTitle: fieldIsoTitle.value.trim(),
      isoDesc: fieldIsoDesc.value.trim(),
      summary: fieldSummary.value.trim(),
      bullets: linesToList(fieldBullets.value),
      narrative: fieldNarrative.value.trim(),
      dayToDay: fieldDayToDay.value.trim(),
      resortDetails: fieldResortDetails.value.trim(),
      logisticsDetails: fieldLogisticsDetails.value.trim(),
      logistics: existing.logistics || "",
      experience: existing.experience || "",
      nonDiving: Array.isArray(existing.nonDiving) ? existing.nonDiving : [],
      diveSites: Array.isArray(existing.diveSites) ? existing.diveSites : [],
      conditions: existing.conditions && typeof existing.conditions === "object" ? existing.conditions : {},
      resort: existing.resort && typeof existing.resort === "object" ? existing.resort : {},
    };
  }

  function renderList(filterText = "") {
    if (!listEl) return;
    const filter = String(filterText || "").trim().toLowerCase();
    const view = filter
      ? items.filter((item) => {
          const hay = `${item.id || ""} ${item.name || ""} ${item.subtitle || ""}`.toLowerCase();
          return hay.includes(filter);
        })
      : items;

    listEl.innerHTML = "";
    view
      .slice()
      .sort((a, b) => String(a.name || a.id || "").localeCompare(String(b.name || b.id || "")))
      .forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = `${item.name || item.id} (${item.id})`;
        if (item.id === selectedId) opt.selected = true;
        listEl.appendChild(opt);
      });

    if (!selectedId && view.length) {
      selectedId = view[0].id;
    }

    const active = getSelected();
    setFormVisible(Boolean(active));
    if (active) fillForm(active);
  }

  async function loadItems(selectId = "") {
    const resp = await fetch(`${listUrl}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    }).catch(() => null);
    if (!resp || !resp.ok) {
      setStatus("Load failed");
      showValidation("Failed to load destinations from API.", true);
      return;
    }
    const json = await resp.json().catch(() => ({}));
    items = Array.isArray(json.items) ? json.items : [];
    if (selectId) selectedId = selectId;
    if (!items.some((item) => item && item.id === selectedId)) {
      selectedId = items.length ? items[0].id : "";
    }
    renderList(searchInput ? searchInput.value : "");
    setStatus(isAuthed() ? "Ready" : "Signed out");
    notifySubscribers();
  }

  async function saveSelected() {
    if (!isAuthed()) {
      buildLoginModal(() => saveSelected());
      return;
    }

    const item = collectForm();
    if (!item.id || !item.name) {
      showValidation("ID and Name are required.", true);
      return;
    }

    setStatus("Saving...");
    showValidation("");
    const resp = await apiFetch(`${adminByIdUrl}${encodeURIComponent(item.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setStatus(`Save failed (${resp.status})`);
      showValidation(err.details || err.error || "Save failed.", true);
      return;
    }

    setStatus("Saved");
    showValidation("Saved.");
    await loadItems(item.id);
    window.dispatchEvent(new CustomEvent("dmz:destinations-updated", { detail: { id: item.id } }));
  }

  async function deleteSelected() {
    const active = getSelected();
    if (!active) return;
    if (!isAuthed()) {
      buildLoginModal(() => deleteSelected());
      return;
    }
    if (!window.confirm(`Delete destination ${active.name || active.id}?`)) return;

    setStatus("Deleting...");
    const resp = await apiFetch(`${adminByIdUrl}${encodeURIComponent(active.id)}`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setStatus(`Delete failed (${resp.status})`);
      showValidation(err.details || err.error || "Delete failed.", true);
      return;
    }

    setStatus("Deleted");
    showValidation("Destination deleted.");
    selectedId = "";
    await loadItems();
    window.dispatchEvent(new CustomEvent("dmz:destinations-updated", { detail: { id: null } }));
  }

  function createNewDestination() {
    const seed = `destination-${Date.now().toString().slice(-5)}`;
    const template = {
      id: seed,
      name: "New Destination",
      subtitle: "Destination overview",
      lat: 0,
      lon: 0,
      tags: [],
      heroImage: "",
      isoImage: "",
      isoTitle: "Resort View (Isometric)",
      isoDesc: "Resort details",
      summary: "",
      bullets: [],
      narrative: "",
      dayToDay: "",
      resortDetails: "",
      logisticsDetails: "",
      resort: {},
      conditions: {},
      diveSites: [],
      nonDiving: [],
    };
    items.push(template);
    selectedId = template.id;
    renderList(searchInput ? searchInput.value : "");
    setFormVisible(true);
    showValidation("New draft created. Click Publish to save.");
    setStatus("Draft");
    notifySubscribers();
  }

  async function requestImagesDirectUpload(variant) {
    if (!getToken()) {
      return new Promise((resolve) => {
        buildLoginModal(() => resolve(requestImagesDirectUpload(variant)));
      });
    }
    const resp = await apiFetch(imagesDirectUploadUrl, {
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
    if (!file) return "";
    if (statusEl) statusEl.textContent = "Requesting upload...";
    const data = await requestImagesDirectUpload(variant);
    const uploadURL = data?.uploadURL;
    const deliveryUrl = normalizeImageUrl(data?.deliveryUrl || "");
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
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error("Upload failed"));
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    });

    if (statusEl) statusEl.textContent = deliveryUrl ? "Upload complete." : "Upload complete. Add URL manually.";
    return deliveryUrl;
  }

  function isCloudflareImageUrl(value) {
    return String(value || "").includes("imagedelivery.net/");
  }

  async function deleteImageByUrl(url) {
    if (!url || !isCloudflareImageUrl(url)) return;
    if (!getToken()) return;
    try {
      await apiFetch(imagesDeleteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch (error) {
      // ignore delete errors
    }
  }

  function setPinPosition(id, lat, lon) {
    const idx = items.findIndex((item) => item && item.id === id);
    if (idx < 0) return;
    items[idx] = { ...items[idx], lat: Number(lat), lon: Number(lon) };
    if (selectedId === id) {
      fieldLat.value = Number(lat);
      fieldLon.value = Number(lon);
      showValidation(`Pin moved: ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}. Click Publish to save.`);
    }
    notifySubscribers();
  }

  function selectId(id) {
    const nextId = String(id || "").trim().toLowerCase();
    if (!nextId) return;
    selectedId = nextId;
    renderList(searchInput ? searchInput.value : "");
    if (listEl) listEl.value = nextId;
    setFormVisible(Boolean(getSelected()));
  }

  function applyJson() {
    const raw = (fieldExpandedJson && fieldExpandedJson.value.trim()) || (fieldBaseJson && fieldBaseJson.value.trim()) || "";
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      fillForm(parsed);
      showValidation("JSON applied.");
    } catch (error) {
      showValidation("Invalid JSON.", true);
    }
  }

  function formatJson() {
    try {
      const parsed = collectForm();
      const pretty = JSON.stringify(parsed, null, 2);
      if (fieldBaseJson) fieldBaseJson.value = pretty;
      if (fieldExpandedJson) fieldExpandedJson.value = pretty;
      showValidation("JSON formatted.");
    } catch (error) {
      showValidation("Could not format JSON.", true);
    }
  }

  function buildLoginModal(onSuccess) {
    if (document.querySelector(".media-auth-modal")) return;
    const overlay = document.createElement("div");
    overlay.className = "media-edit-modal media-auth-modal";
    overlay.innerHTML = `
      <div class="media-edit-modal-card">
        <h3>DMZ Admin</h3>
        <p class="media-edit-modal-hint">Sign in to edit destinations.</p>
        <form class="media-edit-form">
          <label>Username<input type="text" autocomplete="username" required /></label>
          <label>Password<input type="password" autocomplete="current-password" required /></label>
          <p class="media-edit-modal-hint" data-error style="color: rgba(226, 27, 35, 0.85)"></p>
          <div class="media-edit-modal-actions">
            <button type="button" class="media-edit-cancel">Cancel</button>
            <button type="submit" class="media-edit-save">Sign In</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const inputs = form ? form.querySelectorAll("input") : [];
    const errorEl = overlay.querySelector("[data-error]");
    const cancelBtn = overlay.querySelector(".media-edit-cancel");

    const close = () => overlay.remove();
    if (cancelBtn) cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (errorEl) errorEl.textContent = "";
        const user = inputs[0] ? inputs[0].value.trim() : "";
        const pass = inputs[1] ? inputs[1].value : "";
        try {
          const resp = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user, pass }),
          });
          if (!resp.ok) {
            if (errorEl) errorEl.textContent = "Login failed.";
            return;
          }
          const json = await resp.json().catch(() => ({}));
          if (!json.token) {
            if (errorEl) errorEl.textContent = "Login failed.";
            return;
          }
          setToken(json.token);
          close();
          setStatus("Ready");
          if (typeof onSuccess === "function") onSuccess();
        } catch (error) {
          if (errorEl) errorEl.textContent = "Login request failed.";
        }
      });
    }
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) setActiveTab(tab);
    });
  });

  if (adminFab) {
    adminFab.addEventListener("click", () => {
      toggleAdminOpen(true);
      if (isAuthed()) toggleEditMode(true);
    });
  }
  if (adminClose) {
    adminClose.addEventListener("click", () => toggleAdminOpen(false));
  }

  loginButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buildLoginModal(() => {
        toggleAdminOpen(true);
        toggleEditMode(true);
      });
    });
  });

  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isAuthed()) {
        buildLoginModal(() => {
          toggleAdminOpen(true);
          toggleEditMode(true);
        });
        return;
      }
      const next = !isEditMode();
      toggleEditMode(next);
      toggleAdminOpen(true);
    });
  });

  if (listEl) {
    listEl.addEventListener("change", () => {
      selectedId = listEl.value;
      const active = getSelected();
      setFormVisible(Boolean(active));
      if (active) fillForm(active);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
    });
  }

  if (addButton) addButton.addEventListener("click", createNewDestination);
  if (publishButton) publishButton.addEventListener("click", saveSelected);

  if (resetButton) {
    resetButton.addEventListener("click", async () => {
      const active = getSelected();
      if (!active) return;
      const resp = await fetch(`${byIdUrl}${encodeURIComponent(active.id)}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
      if (!resp || !resp.ok) {
        showValidation("Failed to refresh destination from API.", true);
        return;
      }
      const json = await resp.json().catch(() => ({}));
      if (!json.item) return;
      const idx = items.findIndex((item) => item && item.id === active.id);
      if (idx >= 0) items[idx] = json.item;
      fillForm(json.item);
      showValidation("Form reset from API.");
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadItems(selectedId);
      showValidation("Refreshed from API.");
    });
  }

  if (deleteButton) deleteButton.addEventListener("click", deleteSelected);
  if (applyJsonButton) applyJsonButton.addEventListener("click", applyJson);
  if (formatJsonButton) formatJsonButton.addEventListener("click", formatJson);

  if (heroUploadButton && heroUploadInput) {
    heroUploadButton.addEventListener("click", () => heroUploadInput.click());
    heroUploadInput.addEventListener("change", async () => {
      const file = heroUploadInput.files ? heroUploadInput.files[0] : null;
      if (!file) return;
      const previous = normalizeImageUrl(fieldHeroImage.value);
      try {
        const url = await uploadImageFile(file, heroUploadStatus, "travelhero");
        if (url) fieldHeroImage.value = url;
        showValidation("Hero image uploaded. Click Publish to save.");
      } catch (error) {
        if (heroUploadStatus) heroUploadStatus.textContent = "Upload failed.";
        showValidation("Hero image upload failed.", true);
      } finally {
        heroUploadInput.value = "";
      }
      const nextUrl = normalizeImageUrl(fieldHeroImage.value);
      if (previous && previous !== nextUrl) {
        deleteImageByUrl(previous);
      }
    });
  }

  if (isoUploadButton && isoUploadInput) {
    isoUploadButton.addEventListener("click", () => isoUploadInput.click());
    isoUploadInput.addEventListener("change", async () => {
      const file = isoUploadInput.files ? isoUploadInput.files[0] : null;
      if (!file) return;
      const previous = normalizeImageUrl(fieldIsoImage.value);
      try {
        const url = await uploadImageFile(file, isoUploadStatus, "traveliso");
        if (url) fieldIsoImage.value = url;
        showValidation("Isometric image uploaded. Click Publish to save.");
      } catch (error) {
        if (isoUploadStatus) isoUploadStatus.textContent = "Upload failed.";
        showValidation("Isometric image upload failed.", true);
      } finally {
        isoUploadInput.value = "";
      }
      const nextUrl = normalizeImageUrl(fieldIsoImage.value);
      if (previous && previous !== nextUrl) {
        deleteImageByUrl(previous);
      }
    });
  }

  window.DMZDestinations = {
    ready: async () => true,
    getBaseItems: () => items.map((item) => ({ ...item })),
    subscribe: (cb) => {
      if (typeof cb !== "function") return () => {};
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    isEditMode,
    setPinPosition,
    selectId,
  };

  setStatus(isAuthed() ? "Ready" : "Signed out");
  setActiveTab("core");
  toggleEditMode(false);
  toggleAdminOpen(false);
  loadItems();
})();
