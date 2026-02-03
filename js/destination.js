(() => {
  const apiBase =
    (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const apiBaseUrl = apiBase ? `${apiBase}/api/destinations` : "/api/destinations";
  const apiExpandedUrl = apiBase ? `${apiBase}/api/destinations-expanded` : "/api/destinations-expanded";
  const apiAdminBulkUrl = apiBase ? `${apiBase}/api/admin/destinations-bulk` : "/api/admin/destinations-bulk";
  const tokenStorageKey = "dmzMediaToken";
  const nameEl = document.getElementById("destName");
  const subtitleEl = document.getElementById("destSubtitle");
  const bulletsEl = document.getElementById("destBullets");
  const isoTitleEl = document.getElementById("isoTitle");
  const isoDescEl = document.getElementById("isoDesc");
  const isoBox = document.getElementById("isoBox");
  const isoImg = document.getElementById("isoImage");
  const isoLabel = document.getElementById("isoLabel");
  const narrativeEl = document.getElementById("destNarrative");
  const summaryEl = document.getElementById("destSummary");
  const resortNameEl = document.getElementById("resortName");
  const resortDescEl = document.getElementById("resortDesc");
  const diveSitesEl = document.getElementById("diveSitesList");
  const conditionsEl = document.getElementById("conditionsList");
  const seasonalityEl = document.getElementById("seasonalityText");
  const logisticsEl = document.getElementById("logisticsText");
  const experienceEl = document.getElementById("experienceText");
  const nonDivingEl = document.getElementById("nonDivingList");
  const heroEl = document.querySelector(".destination-hero");
  const heroRoot = document.documentElement;
  const dayToDayEl = document.getElementById("dayToDayText");
  const resortDetailsEl = document.getElementById("resortDetailsText");
  const logisticsDetailsEl = document.getElementById("logisticsDetailsText");
  const logisticsTipsEl = document.getElementById("logisticsTipsList");
  const diveSiteHighlightsEl = document.getElementById("diveSiteHighlights");
  const dayToDayTitleEl = document.getElementById("dayToDayTitle");
  const resortNotesTitleEl = document.getElementById("resortNotesTitle");
  const travelLogisticsTitleEl = document.getElementById("travelLogisticsTitle");
  const diveHighlightsTitleEl = document.getElementById("diveHighlightsTitle");
  const overviewTitleEl = document.getElementById("overviewTitle");
  const tripSummaryTitleEl = document.getElementById("tripSummaryTitle");
  const seasonalityTitleEl = document.getElementById("seasonalityTitle");
  const overviewLogisticsTitleEl = document.getElementById("overviewLogisticsTitle");
  const experienceTitleEl = document.getElementById("experienceTitle");
  const resortOpsTitleEl = document.getElementById("resortOpsTitle");
  const conditionsTitleEl = document.getElementById("conditionsTitle");
  const diveSitesTitleEl = document.getElementById("diveSitesTitle");
  const nonDivingTitleEl = document.getElementById("nonDivingTitle");
  const tripSnapshotTitleEl = document.getElementById("tripSnapshotTitle");
  const diveNowLinks = document.querySelectorAll(".dive-now-link");
  const metaDescriptionEl = document.querySelector('meta[name="description"]');
  const adminPanel = document.getElementById("destPageAdminPanel");
  const adminFab = document.querySelector(".dest-page-admin-fab");
  const adminClose = document.querySelector(".dest-page-admin-close");
  const adminStatus = document.getElementById("destPageAdminStatus");
  const loginButton = document.querySelector(".dest-page-login-button");
  const editToggle = document.querySelector(".dest-page-edit-toggle");
  const saveButton = document.querySelector(".dest-page-save");
  const cancelButton = document.querySelector(".dest-page-cancel");
  const logoutButton = document.querySelector(".dest-page-logout");
  const heroInput = document.getElementById("destEditHeroImage");
  const isoInput = document.getElementById("destEditIsoImage");
  const heroUploadInput = document.getElementById("destHeroUpload");
  const heroUploadButton = document.getElementById("destHeroUploadBtn");
  const heroUploadStatus = document.getElementById("destHeroUploadStatus");
  const isoUploadInput = document.getElementById("destIsoUpload");
  const isoUploadButton = document.getElementById("destIsoUploadBtn");
  const isoUploadStatus = document.getElementById("destIsoUploadStatus");
  const addButtons = document.querySelectorAll(".dest-page-add");

  let currentBase = null;
  let currentExpanded = null;
  let currentId = "";
  let isDirty = false;

  function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}…`;
  }

  function setMetaDescription(text) {
    if (!metaDescriptionEl) return;
    metaDescriptionEl.setAttribute("content", text);
  }

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

  async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(path, { ...options, headers });
  }

  async function requestImagesDirectUpload(variant) {
    if (!getToken()) {
      return new Promise((resolve) => {
        buildLoginModal(() => resolve(requestImagesDirectUpload(variant)));
      });
    }
    const resp = await apiFetch(`${apiBase || ""}/api/admin/images-direct-upload`, {
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
      await apiFetch(`${apiBase || ""}/api/admin/images-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch (error) {
      // ignore delete failures
    }
  }

  function updateAuthState() {
    const authed = Boolean(getToken());
    document.body.classList.toggle("dest-page-authenticated", authed);
    if (adminStatus) {
      adminStatus.textContent = authed ? "Signed in" : "Signed out";
    }
    updateEditButtonLabels();
  }

  function updateEditButtonLabels() {
    const authed = Boolean(getToken());
    const editing = document.body.classList.contains("dest-page-editing");
    const label = !authed ? "DMZ Login" : editing ? "Close Editor" : "Edit Page";
    if (editToggle) editToggle.textContent = label;
    if (logoutButton) logoutButton.style.display = authed ? "inline-flex" : "none";
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
    hint.textContent = "Sign in to edit destination content.";

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
        const resp = await apiFetch(`${apiBase || ""}/api/admin/login`, {
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
        updateAuthState();
        close();
        if (typeof onSuccess === "function") onSuccess();
      } catch (err) {
        console.error("Destination login failed.", err);
        error.textContent = "Login failed. Check the console for details.";
      }
    });
  }

  function mergeDestination(base, extra) {
    if (!base) return base;
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

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function renderBullets(bullets) {
    if (!bulletsEl) return;
    bulletsEl.innerHTML = "";
    (bullets || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      bulletsEl.appendChild(li);
    });
  }

  function renderList(el, items) {
    if (!el) return;
    el.innerHTML = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      el.appendChild(li);
    });
  }

  function renderConditions(conditions) {
    if (!conditionsEl) return;
    conditionsEl.innerHTML = "";
    if (!conditions) return;

    const entries = [
      ["Visibility", conditions.visibility],
      ["Temperature", conditions.temperature],
      ["Currents", conditions.currents],
    ];

    entries.forEach(([label, value]) => {
      if (!value) return;
      const li = document.createElement("li");
      li.textContent = `${label}: ${value}`;
      conditionsEl.appendChild(li);
    });
  }

  function renderHighlights(items) {
    if (!diveSiteHighlightsEl) return;
    diveSiteHighlightsEl.innerHTML = "";
    (items || []).forEach((item) => {
      const card = document.createElement("article");
      card.className = "site-highlight-card";

      const title = document.createElement("h3");
      title.textContent = item?.name || item?.title || "Dive Site";

      const desc = document.createElement("p");
      desc.textContent = item?.details || item?.description || "";

      card.append(title, desc);
      diveSiteHighlightsEl.appendChild(card);
    });
  }

  function renderIso(dest) {
    if (!isoBox || !isoImg || !isoLabel) return;

    if (dest.isoImage) {
      isoImg.src = dest.isoImage;
      isoImg.alt = `Isometric view of ${dest.name}`;
      isoBox.classList.add("is-loaded");
      isoLabel.textContent = " ";
    } else {
      isoImg.removeAttribute("src");
      isoImg.alt = "";
      isoBox.classList.remove("is-loaded");
      isoLabel.textContent = "Image coming soon.";
    }
  }

  function setHeroImage(url) {
    if (!heroRoot) return;
    if (url) {
      heroRoot.style.setProperty("--destination-hero-image", `url("${url}")`);
      return;
    }
    heroRoot.style.removeProperty("--destination-hero-image");
  }

  function setEditable(el, active) {
    if (!el) return;
    if (active) {
      el.setAttribute("contenteditable", "true");
    } else {
      el.removeAttribute("contenteditable");
    }
  }

  function markDirty() {
    isDirty = true;
  }

  function bindEditableListeners() {
    const editableEls = [
      nameEl,
      subtitleEl,
      isoTitleEl,
      isoDescEl,
      narrativeEl,
      summaryEl,
      resortNameEl,
      resortDescEl,
      seasonalityEl,
      logisticsEl,
      experienceEl,
      dayToDayEl,
      resortDetailsEl,
      logisticsDetailsEl,
      dayToDayTitleEl,
      resortNotesTitleEl,
      travelLogisticsTitleEl,
      diveHighlightsTitleEl,
      overviewTitleEl,
      tripSummaryTitleEl,
      seasonalityTitleEl,
      overviewLogisticsTitleEl,
      experienceTitleEl,
      resortOpsTitleEl,
      conditionsTitleEl,
      diveSitesTitleEl,
      nonDivingTitleEl,
      tripSnapshotTitleEl,
    ];
    editableEls.forEach((el) => {
      if (!el) return;
      el.addEventListener("input", markDirty);
    });
  }

  function setListEditable(el, active) {
    if (!el) return;
    [...el.querySelectorAll("li")].forEach((li) => {
      if (active) {
        li.setAttribute("contenteditable", "true");
        li.addEventListener("input", markDirty);
      } else {
        li.removeAttribute("contenteditable");
      }
    });
  }

  function setHighlightsEditable(active) {
    if (!diveSiteHighlightsEl) return;
    diveSiteHighlightsEl.querySelectorAll(".site-highlight-card").forEach((card) => {
      const title = card.querySelector("h3");
      const desc = card.querySelector("p");
      if (active) {
        if (title) title.setAttribute("contenteditable", "true");
        if (desc) desc.setAttribute("contenteditable", "true");
        if (title) title.addEventListener("input", markDirty);
        if (desc) desc.addEventListener("input", markDirty);
      } else {
        if (title) title.removeAttribute("contenteditable");
        if (desc) desc.removeAttribute("contenteditable");
      }
    });
  }

  function setEditMode(active) {
    document.body.classList.toggle("dest-page-editing", active);
    if (editToggle) editToggle.setAttribute("aria-pressed", active ? "true" : "false");
    updateEditButtonLabels();

    const editableEls = [
      nameEl,
      subtitleEl,
      isoTitleEl,
      isoDescEl,
      narrativeEl,
      summaryEl,
      resortNameEl,
      resortDescEl,
      seasonalityEl,
      logisticsEl,
      experienceEl,
      dayToDayEl,
      resortDetailsEl,
      logisticsDetailsEl,
      dayToDayTitleEl,
      resortNotesTitleEl,
      travelLogisticsTitleEl,
      diveHighlightsTitleEl,
      overviewTitleEl,
      tripSummaryTitleEl,
      seasonalityTitleEl,
      overviewLogisticsTitleEl,
      experienceTitleEl,
      resortOpsTitleEl,
      conditionsTitleEl,
      diveSitesTitleEl,
      nonDivingTitleEl,
      tripSnapshotTitleEl,
    ];

    editableEls.forEach((el) => setEditable(el, active));
    setListEditable(bulletsEl, active);
    setListEditable(diveSitesEl, active);
    setListEditable(nonDivingEl, active);
    setListEditable(logisticsTipsEl, active);
    setListEditable(conditionsEl, active);
    setHighlightsEditable(active);

    if (heroInput) {
      heroInput.disabled = !active;
    }
    if (isoInput) {
      isoInput.disabled = !active;
    }
  }

  function setDiveNowLinks(dest) {
    if (!diveNowLinks.length) return;

    const params = new URLSearchParams();
    params.set("interest", "travel");

    if (dest?.name) {
      params.set("location", dest.name);
    }

    const href = `../contact/index.html?${params.toString()}#dive-now`;
    diveNowLinks.forEach((link) => {
      link.setAttribute("href", href);
    });
  }

  function renderDestination(dest) {
    if (!dest) {
      setText(nameEl, "Destination Not Found");
      setText(subtitleEl, "Return to the travel page to pick a destination.");
      renderBullets([]);
      renderList(diveSitesEl, []);
      renderList(nonDivingEl, []);
      renderConditions(null);
      setText(narrativeEl, "We could not find that destination.");
      setText(summaryEl, "Summary unavailable.");
      setText(resortNameEl, "Resort name unavailable.");
      setText(resortDescEl, "Resort details unavailable.");
      setText(seasonalityEl, "Seasonality unavailable.");
      setText(logisticsEl, "Logistics unavailable.");
      setText(experienceEl, "Experience info unavailable.");
      setText(dayToDayEl, "Day-to-day details unavailable.");
      setText(resortDetailsEl, "Resort details unavailable.");
      setText(logisticsDetailsEl, "Logistics details unavailable.");
      renderList(logisticsTipsEl, []);
      renderHighlights([]);
      setText(dayToDayTitleEl, "Day-to-Day Diving");
      setText(resortNotesTitleEl, "Resort Notes");
      setText(travelLogisticsTitleEl, "Travel Logistics");
      setText(diveHighlightsTitleEl, "Dive Site Highlights");
      setText(overviewTitleEl, "Overview");
      setText(tripSummaryTitleEl, "Trip Summary");
      setText(seasonalityTitleEl, "Seasonality");
      setText(overviewLogisticsTitleEl, "Logistics");
      setText(experienceTitleEl, "Experience");
      setText(resortOpsTitleEl, "Resort and Dive Ops");
      setText(conditionsTitleEl, "Conditions");
      setText(diveSitesTitleEl, "Dive Sites");
      setText(nonDivingTitleEl, "Non-Diving");
      setText(tripSnapshotTitleEl, "Trip Snapshot");
      if (isoTitleEl) isoTitleEl.textContent = "Resort View (Isometric)";
      if (isoDescEl) isoDescEl.textContent = "Select a destination to load the resort view.";
      if (isoLabel) isoLabel.textContent = "Image coming soon.";
      setHeroImage(null);
      setDiveNowLinks(null);
      setMetaDescription("Explore a DMZ Scuba destination and plan a dive trip on your terms.");
      return;
    }

    setText(nameEl, dest.name || "Destination");
    setText(subtitleEl, dest.subtitle || "Explore this destination with DMZ Scuba.");
    renderBullets(dest.bullets);
    renderList(diveSitesEl, dest.diveSites);
    renderList(nonDivingEl, dest.nonDiving);
    renderConditions(dest.conditions);
    setText(narrativeEl, dest.narrative || "Explore this destination with DMZ Scuba.");
    setText(summaryEl, dest.summary || "Trip summary coming soon.");
    setText(resortNameEl, dest.resort?.name || "Resort details");
    setText(resortDescEl, dest.resort?.description || "Resort details coming soon.");
    setText(seasonalityEl, dest.seasonality || "Seasonality details coming soon.");
    setText(logisticsEl, dest.logistics || "Logistics details coming soon.");
    setText(experienceEl, dest.experience || "Experience details coming soon.");
    setText(dayToDayEl, dest.dayToDay || "Day-to-day details coming soon.");
    setText(resortDetailsEl, dest.resortDetails || dest.resort?.description || "Resort details coming soon.");
    setText(logisticsDetailsEl, dest.logisticsDetails || dest.logistics || "Logistics details coming soon.");
    renderList(logisticsTipsEl, dest.logisticsTips);
    renderHighlights(dest.diveSiteHighlights);
    setText(dayToDayTitleEl, dest.dayToDayTitle || "Day-to-Day Diving");
    setText(resortNotesTitleEl, dest.resortNotesTitle || "Resort Notes");
    setText(travelLogisticsTitleEl, dest.travelLogisticsTitle || "Travel Logistics");
    setText(diveHighlightsTitleEl, dest.diveHighlightsTitle || "Dive Site Highlights");
    setText(overviewTitleEl, dest.overviewTitle || "Overview");
    setText(tripSummaryTitleEl, dest.tripSummaryTitle || "Trip Summary");
    setText(seasonalityTitleEl, dest.seasonalityTitle || "Seasonality");
    setText(overviewLogisticsTitleEl, dest.overviewLogisticsTitle || "Logistics");
    setText(experienceTitleEl, dest.experienceTitle || "Experience");
    setText(resortOpsTitleEl, dest.resortOpsTitle || "Resort and Dive Ops");
    setText(conditionsTitleEl, dest.conditionsTitle || "Conditions");
    setText(diveSitesTitleEl, dest.diveSitesTitle || "Dive Sites");
    setText(nonDivingTitleEl, dest.nonDivingTitle || "Non-Diving");
    setText(tripSnapshotTitleEl, dest.tripSnapshotTitle || "Trip Snapshot");
    if (isoTitleEl) isoTitleEl.textContent = dest.isoTitle || "Resort View (Isometric)";
    if (isoDescEl) isoDescEl.textContent = dest.isoDesc || "Resort details coming soon.";
    renderIso(dest);
    setHeroImage(dest.heroImage);
    setDiveNowLinks(dest);

    if (dest.name) {
      document.title = `DMZ Scuba | ${dest.name}`;
    }

    if (dest.name) {
      const base = `Explore ${dest.name} with DMZ Scuba.`;
      const details = dest.summary || dest.subtitle || dest.narrative || "";
      const combined = `${base} ${details}`.trim();
      setMetaDescription(truncateText(combined, 150));
    }

    if (document.body.classList.contains("dest-page-editing")) {
      setListEditable(bulletsEl, true);
      setListEditable(diveSitesEl, true);
      setListEditable(nonDivingEl, true);
      setListEditable(logisticsTipsEl, true);
      setListEditable(conditionsEl, true);
      setHighlightsEditable(true);
    }
  }

  async function loadDestination() {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("id") || "").trim();
    currentId = id;

    try {
      let baseData = [];
      let expandedData = [];

      const [apiRes, apiExpandedRes] = await Promise.all([
        fetch(apiBaseUrl, { cache: "no-store" }).catch(() => null),
        fetch(apiExpandedUrl, { cache: "no-store" }).catch(() => null),
      ]);

      if (apiRes && apiRes.ok) {
        const apiJson = await apiRes.json();
        baseData = Array.isArray(apiJson.items) ? apiJson.items : [];
      }

      if (apiExpandedRes && apiExpandedRes.ok) {
        const apiJson = await apiExpandedRes.json();
        expandedData = Array.isArray(apiJson.items) ? apiJson.items : [];
      }

      if (!baseData.length) {
        const baseRes = await fetch("/assets/data/destinations.json", { cache: "no-store" });
        if (!baseRes.ok) throw new Error("Failed to load destinations");
        baseData = await baseRes.json();
      }

      if (!expandedData.length) {
        const expandedRes = await fetch("/assets/data/destinations-expanded.json", {
          cache: "no-store",
        }).catch(() => null);
        expandedData = expandedRes && expandedRes.ok ? await expandedRes.json() : [];
      }

      const baseDest = (baseData || []).find((item) => item.id === id);
      const extraDest = (expandedData || []).find((item) => item.id === id);
      const dest = mergeDestination(baseDest, extraDest);
      currentBase = baseDest || null;
      currentExpanded = extraDest || null;
      if (heroInput) heroInput.value = dest?.heroImage || "";
      if (isoInput) isoInput.value = dest?.isoImage || "";

      renderDestination(dest);
    } catch (err) {
      console.error("Failed to load destination:", err);
      renderDestination(null);
    }
  }

  function readList(el) {
    if (!el) return [];
    return [...el.querySelectorAll("li")]
      .map((li) => li.textContent.trim())
      .filter(Boolean);
  }

  function readConditions() {
    const entries = readList(conditionsEl);
    const parsed = {};
    entries.forEach((line) => {
      const [label, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (!label || !value) return;
      const key = label.trim().toLowerCase();
      if (key.includes("visibility")) parsed.visibility = value;
      if (key.includes("temperature")) parsed.temperature = value;
      if (key.includes("current")) parsed.currents = value;
    });
    return parsed;
  }

  function readHighlights() {
    if (!diveSiteHighlightsEl) return [];
    return [...diveSiteHighlightsEl.querySelectorAll(".site-highlight-card")].map((card) => {
      const title = card.querySelector("h3");
      const desc = card.querySelector("p");
      return {
        name: title ? title.textContent.trim() : "",
        details: desc ? desc.textContent.trim() : "",
      };
    }).filter((item) => item.name || item.details);
  }

  async function saveDestination() {
    if (!currentId) return;
    if (!getToken()) {
      buildLoginModal(() => saveDestination());
      return;
    }
    const base = {
      ...(currentBase || {}),
      id: currentId,
      name: nameEl ? nameEl.textContent.trim() : "",
      subtitle: subtitleEl ? subtitleEl.textContent.trim() : "",
      heroImage: heroInput ? heroInput.value.trim() : currentBase?.heroImage || "",
      isoImage: isoInput ? isoInput.value.trim() : currentBase?.isoImage || "",
      isoTitle: isoTitleEl ? isoTitleEl.textContent.trim() : "",
      isoDesc: isoDescEl ? isoDescEl.textContent.trim() : "",
      summary: summaryEl ? summaryEl.textContent.trim() : "",
      bullets: readList(bulletsEl),
      diveSites: readList(diveSitesEl),
      nonDiving: readList(nonDivingEl),
      seasonality: seasonalityEl ? seasonalityEl.textContent.trim() : "",
      logistics: logisticsEl ? logisticsEl.textContent.trim() : "",
      experience: experienceEl ? experienceEl.textContent.trim() : "",
      resort: {
        ...(currentBase?.resort || {}),
        name: resortNameEl ? resortNameEl.textContent.trim() : "",
        description: resortDescEl ? resortDescEl.textContent.trim() : "",
      },
      conditions: {
        ...(currentBase?.conditions || {}),
        ...readConditions(),
      },
    };

    const expanded = {
      ...(currentExpanded || {}),
      id: currentId,
      narrative: narrativeEl ? narrativeEl.textContent.trim() : "",
      dayToDay: dayToDayEl ? dayToDayEl.textContent.trim() : "",
      resortDetails: resortDetailsEl ? resortDetailsEl.textContent.trim() : "",
      logisticsDetails: logisticsDetailsEl ? logisticsDetailsEl.textContent.trim() : "",
      logisticsTips: readList(logisticsTipsEl),
      diveSiteHighlights: readHighlights(),
      dayToDayTitle: dayToDayTitleEl ? dayToDayTitleEl.textContent.trim() : "",
      resortNotesTitle: resortNotesTitleEl ? resortNotesTitleEl.textContent.trim() : "",
      travelLogisticsTitle: travelLogisticsTitleEl ? travelLogisticsTitleEl.textContent.trim() : "",
      diveHighlightsTitle: diveHighlightsTitleEl ? diveHighlightsTitleEl.textContent.trim() : "",
      overviewTitle: overviewTitleEl ? overviewTitleEl.textContent.trim() : "",
      tripSummaryTitle: tripSummaryTitleEl ? tripSummaryTitleEl.textContent.trim() : "",
      seasonalityTitle: seasonalityTitleEl ? seasonalityTitleEl.textContent.trim() : "",
      overviewLogisticsTitle: overviewLogisticsTitleEl ? overviewLogisticsTitleEl.textContent.trim() : "",
      experienceTitle: experienceTitleEl ? experienceTitleEl.textContent.trim() : "",
      resortOpsTitle: resortOpsTitleEl ? resortOpsTitleEl.textContent.trim() : "",
      conditionsTitle: conditionsTitleEl ? conditionsTitleEl.textContent.trim() : "",
      diveSitesTitle: diveSitesTitleEl ? diveSitesTitleEl.textContent.trim() : "",
      nonDivingTitle: nonDivingTitleEl ? nonDivingTitleEl.textContent.trim() : "",
      tripSnapshotTitle: tripSnapshotTitleEl ? tripSnapshotTitleEl.textContent.trim() : "",
    };

    const resp = await apiFetch(apiAdminBulkUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseItems: [base],
        expandedItems: [expanded],
        deleteIds: [],
      }),
    });
    if (!resp.ok) {
      window.alert("Save failed. Check your login or API.");
      return;
    }
    isDirty = false;
    currentBase = base;
    currentExpanded = expanded;
    setEditMode(false);
  }

  function addListItem(targetId) {
    const list = document.getElementById(targetId);
    if (!list) return;
    const li = document.createElement("li");
    li.textContent = "New item";
    li.setAttribute("contenteditable", "true");
    list.appendChild(li);
    li.focus();
    markDirty();
  }

  function setupAdminControls() {
    if (!adminPanel) return;
    updateAuthState();
    bindEditableListeners();

    const setPanelOpen = (next) => {
      document.body.classList.toggle("dest-page-admin-open", next);
      if (adminFab) adminFab.setAttribute("aria-expanded", next ? "true" : "false");
    };

    const toggleEditMode = () => {
      if (!getToken()) {
        buildLoginModal(() => {
          updateAuthState();
          setPanelOpen(true);
          toggleEditMode();
        });
        return;
      }
      const next = !document.body.classList.contains("dest-page-editing");
      setEditMode(next);
    };

    if (loginButton) {
      loginButton.addEventListener("click", () => {
        buildLoginModal(() => {
          updateAuthState();
          setPanelOpen(true);
        });
      });
    }

    if (editToggle) {
      editToggle.addEventListener("click", toggleEditMode);
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

    if (adminPanel) {
      adminPanel.addEventListener("click", (event) => {
        const target = event.target;
        if (target && target.closest(".dest-page-admin-card")) return;
        setPanelOpen(false);
      });
    }

    if (saveButton) {
      saveButton.addEventListener("click", saveDestination);
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        if (isDirty && !window.confirm("Discard edits and reload this destination?")) return;
        window.location.reload();
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        setToken("");
        updateAuthState();
        setEditMode(false);
        setPanelOpen(false);
      });
    }

    if (heroInput) heroInput.addEventListener("input", markDirty);
    if (isoInput) isoInput.addEventListener("input", markDirty);

    addButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-list");
        if (target) addListItem(target);
      });
    });

    if (heroUploadButton && heroUploadInput) {
      heroUploadButton.addEventListener("click", () => {
        heroUploadInput.click();
      });
      heroUploadInput.addEventListener("change", async () => {
        const file = heroUploadInput.files ? heroUploadInput.files[0] : null;
        if (!file) return;
        const previousUrl = heroInput ? heroInput.value.trim() : "";
        try {
          const url = await uploadImageFile(file, heroUploadStatus, "travelhero");
          if (url && heroInput) {
            heroInput.value = url;
            setHeroImage(url);
            markDirty();
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
        const previousUrl = isoInput ? isoInput.value.trim() : "";
        try {
          const url = await uploadImageFile(file, isoUploadStatus, "traveliso");
          if (url && isoInput) {
            isoInput.value = url;
            renderIso({ ...(currentBase || {}), ...(currentExpanded || {}), isoImage: url, name: nameEl?.textContent || "" });
            markDirty();
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

  loadDestination();
  setupAdminControls();
})();
