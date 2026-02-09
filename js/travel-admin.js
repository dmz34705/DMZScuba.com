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
  const logoutButtons = document.querySelectorAll(".dest-admin-logout");
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
  const previewTitleEl = document.getElementById("destTitle");
  const previewSubEl = document.getElementById("destSub");
  const previewIsoTitleEl = document.getElementById("isoTitle");
  const previewIsoDescEl = document.getElementById("isoDesc");
  const previewBulletsEl = document.getElementById("destBullets");
  const previewAddBulletBtn = document.getElementById("travelAddBullet");

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
  const bulletsEditor = document.getElementById("destBulletsEditor");
  const bulletsAddButton = document.getElementById("destBulletsAdd");
  const fieldExperience = document.getElementById("destFieldExperience");
  const fieldLogistics = document.getElementById("destFieldLogistics");
  const fieldNarrative = document.getElementById("destFieldNarrative");
  const fieldDayToDay = document.getElementById("destFieldDayToDay");
  const fieldResortDetails = document.getElementById("destFieldResortDetails");
  const fieldLogisticsDetails = document.getElementById("destFieldLogisticsDetails");
  const fieldDiveSites = document.getElementById("destFieldDiveSites");
  const fieldNonDiving = document.getElementById("destFieldNonDiving");
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
  let advancedJsonDirty = false;
  let suppressJsonDirty = false;

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

  function syncAuthUi() {
    const token = Boolean(getToken());
    const authed = isAuthed();
    document.body.classList.toggle("dest-authenticated", authed);
    loginButtons.forEach((btn) => {
      btn.style.display = token ? "none" : "";
    });
    logoutButtons.forEach((btn) => {
      btn.style.display = authed ? "" : "none";
    });
    syncActionUi();
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  function setStatus(text, tone = "neutral") {
    if (adminStatus) adminStatus.textContent = text;
    if (adminStatus) {
      adminStatus.classList.remove("is-neutral", "is-ready", "is-saving", "is-saved", "is-error");
      adminStatus.classList.add(`is-${tone}`);
    }
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

  function readPreviewBullets() {
    if (!previewBulletsEl) return [];
    return [...previewBulletsEl.querySelectorAll("li")]
      .map((li) => {
        const clone = li.cloneNode(true);
        clone.querySelectorAll(".travel-inline-delete").forEach((btn) => btn.remove());
        return String(clone.textContent || "").trim();
      })
      .filter(Boolean);
  }

  function bindPreviewBulletDeleteButtons() {
    if (!previewBulletsEl) return;
    previewBulletsEl.querySelectorAll(".travel-inline-delete").forEach((btn) => btn.remove());
    if (!isEditMode()) return;
    [...previewBulletsEl.querySelectorAll("li")].forEach((li) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "travel-inline-delete";
      btn.textContent = "Remove";
      btn.addEventListener("click", () => {
        const value = String(li.textContent || "").trim();
        if (value && !window.confirm("Remove this bullet?")) return;
        li.remove();
      });
      li.appendChild(btn);
    });
  }

  function renderPreviewBullets(list) {
    if (!previewBulletsEl) return;
    previewBulletsEl.innerHTML = "";
    (Array.isArray(list) ? list : []).forEach((line) => {
      const text = String(line || "").trim();
      if (!text) return;
      const li = document.createElement("li");
      li.textContent = text;
      previewBulletsEl.appendChild(li);
    });
    bindPreviewBulletDeleteButtons();
  }

  function syncPreviewFromItem(item) {
    if (!item) return;
    if (previewTitleEl) previewTitleEl.textContent = item.name || "Destination";
    if (previewSubEl) previewSubEl.textContent = item.subtitle || "";
    if (previewIsoTitleEl) previewIsoTitleEl.textContent = item.isoTitle || "Destination Overview";
    if (previewIsoDescEl) previewIsoDescEl.textContent = item.isoDesc || "Select a destination to load the resort view.";
    renderPreviewBullets(item.bullets || []);
  }

  function setInlineEditable(active) {
    const editables = [previewTitleEl, previewSubEl, previewIsoTitleEl, previewIsoDescEl];
    editables.forEach((el) => {
      if (!el) return;
      if (active) el.setAttribute("contenteditable", "true");
      else el.removeAttribute("contenteditable");
    });
    if (previewBulletsEl) {
      [...previewBulletsEl.querySelectorAll("li")].forEach((li) => {
        if (active) li.setAttribute("contenteditable", "true");
        else li.removeAttribute("contenteditable");
      });
    }
    bindPreviewBulletDeleteButtons();
  }

  function renderBulletsEditor(list) {
    if (!bulletsEditor) return;
    const items = Array.isArray(list) ? list : [];
    bulletsEditor.innerHTML = "";
    const values = items.length ? items : [""];
    values.forEach((value) => addBulletRow(value));
    if (fieldBullets) fieldBullets.value = listToLines(items);
  }

  function addBulletRow(value = "") {
    if (!bulletsEditor) return;
    const row = document.createElement("div");
    row.className = "dest-admin-list-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = String(value || "");
    input.placeholder = "Bullet point";
    input.addEventListener("input", () => {
      if (fieldBullets) fieldBullets.value = listToLines(readBulletsEditor());
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      row.remove();
      if (!bulletsEditor.querySelector(".dest-admin-list-row")) addBulletRow("");
      if (fieldBullets) fieldBullets.value = listToLines(readBulletsEditor());
    });

    row.append(input, removeBtn);
    bulletsEditor.appendChild(row);
  }

  function readBulletsEditor() {
    if (!bulletsEditor) return linesToList(fieldBullets ? fieldBullets.value : "");
    return [...bulletsEditor.querySelectorAll("input")]
      .map((input) => String(input.value || "").trim())
      .filter(Boolean);
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
    setInlineEditable(Boolean(next));
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
    syncActionUi();
  }

  function clearForm() {
    const textFields = [
      fieldId,
      fieldName,
      fieldSubtitle,
      fieldTags,
      fieldHeroImage,
      fieldIsoImage,
      fieldIsoTitle,
      fieldIsoDesc,
      fieldSummary,
      fieldExperience,
      fieldLogistics,
      fieldNarrative,
      fieldDayToDay,
      fieldResortDetails,
      fieldLogisticsDetails,
      fieldDiveSites,
      fieldNonDiving,
      fieldExpandedJson,
    ];
    textFields.forEach((field) => {
      if (field) field.value = "";
    });
    if (fieldLat) fieldLat.value = "0";
    if (fieldLon) fieldLon.value = "0";
    renderBulletsEditor([]);
  }

  function syncActionUi() {
    const authed = isAuthed();
    const hasSelection = Boolean(getSelected());
    if (addButton) addButton.disabled = !authed;
    if (publishButton) publishButton.disabled = !authed || !hasSelection;
    if (deleteButton) deleteButton.disabled = !authed || !hasSelection;
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
    renderBulletsEditor(item.bullets);
    if (fieldExperience) fieldExperience.value = item.experience || "";
    if (fieldLogistics) fieldLogistics.value = item.logistics || "";
    fieldNarrative.value = item.narrative || "";
    fieldDayToDay.value = item.dayToDay || "";
    fieldResortDetails.value = item.resortDetails || "";
    fieldLogisticsDetails.value = item.logisticsDetails || "";
    if (fieldDiveSites) fieldDiveSites.value = listToLines(item.diveSites);
    if (fieldNonDiving) fieldNonDiving.value = listToLines(item.nonDiving);

    const pretty = JSON.stringify(item, null, 2);
    suppressJsonDirty = true;
    if (fieldExpandedJson) fieldExpandedJson.value = pretty;
    suppressJsonDirty = false;
    advancedJsonDirty = false;
    syncPreviewFromItem(item);
  }

  function parseAdvancedJsonFields() {
    const rawExpanded = fieldExpandedJson ? fieldExpandedJson.value.trim() : "";
    const raw = rawExpanded;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Advanced JSON must be an object.");
    }
    return parsed;
  }

  function applyParsedJsonToDraft(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    const nextId = normalizeId(parsed.id || selectedId || fieldId.value);
    if (!nextId) {
      throw new Error("JSON must include a valid id.");
    }
    const currentIndex = items.findIndex((entry) => entry && entry.id === selectedId);
    const current = currentIndex >= 0 ? items[currentIndex] : (getSelected() || {});
    const next = { ...(current || {}), ...(parsed || {}), id: nextId };
    if (currentIndex >= 0) {
      items[currentIndex] = next;
    } else {
      items.push(next);
    }
    selectedId = nextId;
    renderList(searchInput ? searchInput.value : "");
    if (listEl) listEl.value = nextId;
    setFormVisible(true);
    fillForm(next);
    return next;
  }

  function collectForm() {
    const existing = getSelected() || {};
    const id = normalizeId(fieldId.value);
    const inlineBullets = readPreviewBullets();
    const useInline = isEditMode();
    return {
      ...existing,
      id,
      name: useInline && previewTitleEl ? previewTitleEl.textContent.trim() : fieldName.value.trim(),
      subtitle: useInline && previewSubEl ? previewSubEl.textContent.trim() : fieldSubtitle.value.trim(),
      tags: fieldTags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
      lat: Number(fieldLat.value || 0),
      lon: Number(fieldLon.value || 0),
      heroImage: normalizeImageUrl(fieldHeroImage.value),
      isoImage: normalizeImageUrl(fieldIsoImage.value),
      isoTitle: useInline && previewIsoTitleEl ? previewIsoTitleEl.textContent.trim() : fieldIsoTitle.value.trim(),
      isoDesc: useInline && previewIsoDescEl ? previewIsoDescEl.textContent.trim() : fieldIsoDesc.value.trim(),
      summary: fieldSummary.value.trim(),
      bullets: useInline ? inlineBullets : readBulletsEditor(),
      experience: fieldExperience ? fieldExperience.value.trim() : "",
      logistics: fieldLogistics ? fieldLogistics.value.trim() : "",
      narrative: fieldNarrative.value.trim(),
      dayToDay: fieldDayToDay.value.trim(),
      resortDetails: fieldResortDetails.value.trim(),
      logisticsDetails: fieldLogisticsDetails.value.trim(),
      nonDiving: fieldNonDiving ? linesToList(fieldNonDiving.value) : (Array.isArray(existing.nonDiving) ? existing.nonDiving : []),
      diveSites: fieldDiveSites ? linesToList(fieldDiveSites.value) : (Array.isArray(existing.diveSites) ? existing.diveSites : []),
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

    const active = getSelected();
    setFormVisible(Boolean(active));
    if (active) fillForm(active);
    else clearForm();
    syncActionUi();
  }

  async function loadItems(selectId = "") {
    const resp = await fetch(`${listUrl}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    }).catch(() => null);
    if (!resp || !resp.ok) {
      setStatus("Load failed", "error");
      showValidation("Failed to load destinations from API.", true);
      return;
    }
    const json = await resp.json().catch(() => ({}));
    items = Array.isArray(json.items) ? json.items : [];
    if (selectId) selectedId = selectId;
    if (!items.some((item) => item && item.id === selectedId)) {
      selectedId = "";
    }
    renderList(searchInput ? searchInput.value : "");
    setStatus(isAuthed() ? "Ready" : "Signed out", isAuthed() ? "ready" : "neutral");
    notifySubscribers();
  }

  async function saveSelected() {
    if (!isAuthed()) {
      buildLoginModal(() => saveSelected());
      return;
    }

    if (advancedJsonDirty) {
      try {
        const parsed = parseAdvancedJsonFields();
        if (parsed) {
          applyParsedJsonToDraft(parsed);
        }
      } catch (error) {
        showValidation(error && error.message ? error.message : "Invalid advanced JSON.", true);
        setStatus("Save blocked", "error");
        return;
      }
    }

    const item = collectForm();
    const active = getSelected();
    if (!active || !selectedId) {
      showValidation("Select a destination or click Add Destination first.", true);
      setStatus("Save blocked", "error");
      return;
    }
    if (!item.id || !item.name) {
      showValidation("ID and Name are required.", true);
      return;
    }

    setStatus("Saving...", "saving");
    showValidation("");
    const resp = await apiFetch(`${adminByIdUrl}${encodeURIComponent(item.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setStatus(`Save failed (${resp.status})`, "error");
      showValidation(err.details || err.error || "Save failed.", true);
      return;
    }

    setStatus("Saved", "saved");
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

    setStatus("Deleting...", "saving");
    const resp = await apiFetch(`${adminByIdUrl}${encodeURIComponent(active.id)}`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setStatus(`Delete failed (${resp.status})`, "error");
      showValidation(err.details || err.error || "Delete failed.", true);
      return;
    }

    setStatus("Deleted", "saved");
    showValidation("Destination deleted.");
    selectedId = "";
    await loadItems();
    window.dispatchEvent(new CustomEvent("dmz:destinations-updated", { detail: { id: null } }));
  }

  function createNewDestination() {
    if (!isAuthed()) {
      buildLoginModal(() => createNewDestination());
      return;
    }
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
      experience: "",
      logistics: "",
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
    setStatus("Draft", "neutral");
    notifySubscribers();
    syncActionUi();
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
    if (selectedId !== id) {
      selectedId = id;
      renderList(searchInput ? searchInput.value : "");
      if (listEl) listEl.value = id;
      setFormVisible(Boolean(getSelected()));
    }
    items[idx] = { ...items[idx], lat: Number(lat), lon: Number(lon) };
    fieldLat.value = Number(lat);
    fieldLon.value = Number(lon);
    showValidation(`Pin moved: ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}. Click Publish to save.`);
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
    const raw = (fieldExpandedJson && fieldExpandedJson.value.trim()) || "";
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      applyParsedJsonToDraft(parsed);
      advancedJsonDirty = false;
      showValidation("JSON applied.");
    } catch (error) {
      showValidation("Invalid JSON.", true);
    }
  }

  function formatJson() {
    try {
      const parsed = collectForm();
      const pretty = JSON.stringify(parsed, null, 2);
      suppressJsonDirty = true;
      if (fieldExpandedJson) fieldExpandedJson.value = pretty;
      suppressJsonDirty = false;
      advancedJsonDirty = false;
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
          syncAuthUi();
          close();
          setStatus("Ready", "ready");
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

  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setToken("");
      toggleEditMode(false);
      syncAuthUi();
      setStatus("Signed out", "neutral");
      showValidation("Logged out.");
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
      syncActionUi();
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
  if (fieldExpandedJson) {
    fieldExpandedJson.addEventListener("input", () => {
      if (!suppressJsonDirty) advancedJsonDirty = true;
    });
  }
  if (bulletsAddButton) {
    bulletsAddButton.addEventListener("click", () => {
      addBulletRow("");
    });
  }
  if (previewAddBulletBtn) {
    previewAddBulletBtn.addEventListener("click", () => {
      const li = document.createElement("li");
      li.textContent = "New bullet";
      if (isEditMode()) li.setAttribute("contenteditable", "true");
      if (previewBulletsEl) previewBulletsEl.appendChild(li);
      bindPreviewBulletDeleteButtons();
    });
  }

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

  setStatus(isAuthed() ? "Ready" : "Signed out", isAuthed() ? "ready" : "neutral");
  syncAuthUi();
  setActiveTab("core");
  toggleEditMode(false);
  toggleAdminOpen(false);
  loadItems();
})();
