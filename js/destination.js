(() => {
  const apiBase =
    (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const apiBaseUrl = apiBase ? `${apiBase}/api/destinations` : "/api/destinations";
  const apiExpandedUrl = apiBase ? `${apiBase}/api/destinations-expanded` : "/api/destinations-expanded";
  const apiAdminBulkUrl = apiBase ? `${apiBase}/api/admin/destinations-bulk` : "/api/admin/destinations-bulk";
  const mediaApiUrl = apiBase ? `${apiBase}/api/media` : "/api/media";
  const mediaDataUrl = "/assets/data/media.json";
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
  const heroWhyEl = document.getElementById("destHeroWhy");
  const heroBadgesEl = document.getElementById("destHeroBadges");
  const interestToggle = document.getElementById("destInterestToggle");
  const interestForm = document.getElementById("destInterestForm");
  const interestLocationInput = document.getElementById("destInterestLocation");
  const interestIdInput = document.getElementById("destInterestId");
  const errorPanel = document.getElementById("destErrorPanel");
  const errorMessageEl = document.getElementById("destErrorMessage");
  const retryButton = document.getElementById("destRetryButton");
  const vibeTextEl = document.getElementById("destVibeText");
  const perfectForEl = document.getElementById("destPerfectFor");
  const howItWorksEl = document.getElementById("destHowItWorks");
  const mediaStatusEl = document.getElementById("destMediaStatus");
  const mediaGrid = document.getElementById("destMediaGrid");
  const mediaLink = document.getElementById("destMediaLink");
  const mediaDots = document.getElementById("destMediaDots");
  const mediaPrev = document.getElementById("destMediaPrev");
  const mediaNext = document.getElementById("destMediaNext");
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
  let mediaRequestId = 0;
  let mediaScrollHandler = null;
  let mediaResizeHandler = null;
  let mediaAutoScrollTimer = null;
  const isDev =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
    window.location.hostname.endsWith(".local");

  function isEditing() {
    return document.body.classList.contains("dest-page-editing");
  }

  function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}…`;
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function matchesLocationKey(locationKey, targetKey) {
    if (!locationKey || !targetKey) return false;
    return locationKey === targetKey || locationKey.includes(targetKey) || targetKey.includes(locationKey);
  }

  function resolveUrl(url) {
    if (!url) return "";
    const normalized = url.replace(/\\/g, "/");
    if (normalized.startsWith("assets/")) {
      return `/${normalized}`;
    }
    if (normalized.startsWith("./assets/")) {
      return `/${normalized.slice(2)}`;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
      return url;
    }
    if (url.startsWith("/")) return url;
    try {
      return new URL(url, window.location.href).href;
    } catch (error) {
      return url;
    }
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(url);
  }

  function isVideoUrl(url) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  }

  function getStreamIdFromUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, window.location.href);
      const host = parsed.hostname;
      if (host.includes("videodelivery.net") || host.includes("cloudflarestream.com") || host.includes("iframe.videodelivery.net")) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts[0]) return parts[0];
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function buildStreamThumb(id) {
    if (!id) return "";
    return `https://videodelivery.net/${id}/thumbnails/thumbnail.jpg?time=1s`;
  }

  function getYouTubeId(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "");
      }
      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.searchParams.get("v")) {
          return parsed.searchParams.get("v") || "";
        }
        const parts = parsed.pathname.split("/").filter(Boolean);
        const embedIndex = parts.indexOf("embed");
        if (embedIndex !== -1 && parts[embedIndex + 1]) {
          return parts[embedIndex + 1];
        }
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function buildYouTubeThumb(id) {
    if (!id) return "";
    return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  }

  function ensureMediaModal() {
    let modal = document.querySelector(".media-video-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "media-video-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="media-video-modal-card" role="dialog" aria-modal="true">
        <button class="media-video-close" type="button" aria-label="Close video">x</button>
        <div class="media-video-frame" role="presentation"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      const frame = modal.querySelector(".media-video-frame");
      if (frame) frame.innerHTML = "";
    };

    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });

    const closeBtn = modal.querySelector(".media-video-close");
    if (closeBtn) closeBtn.addEventListener("click", close);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
        close();
      }
    });

    return modal;
  }

  function openYoutubeModal(id, title) {
    const modal = ensureMediaModal();
    const frame = modal.querySelector(".media-video-frame");
    if (!frame) return;
    frame.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    iframe.title = title || "YouTube video";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    modal.setAttribute("aria-hidden", "false");
  }

  function openStreamModal(id, title) {
    const modal = ensureMediaModal();
    const frame = modal.querySelector(".media-video-frame");
    if (!frame) return;
    frame.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.src = `https://iframe.videodelivery.net/${id}?autoplay=true`;
    iframe.title = title || "Cloudflare Stream video";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    modal.setAttribute("aria-hidden", "false");
  }

  function openVideoModal(url, title) {
    const modal = ensureMediaModal();
    const frame = modal.querySelector(".media-video-frame");
    if (!frame) return;
    frame.innerHTML = "";
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.autoplay = true;
    video.title = title || "Video";
    frame.appendChild(video);
    modal.setAttribute("aria-hidden", "false");
  }

  function addPlayOverlay(target) {
    if (!target || target.querySelector(".media-thumb-play")) return;
    const overlay = document.createElement("span");
    overlay.className = "media-thumb-play";
    overlay.setAttribute("aria-hidden", "true");
    target.appendChild(overlay);
  }

  function applyThumbAspect(thumb, width, height) {
    if (!thumb || !width || !height) return;
    thumb.style.setProperty("--media-ratio", `${width} / ${height}`);
    const ratio = width / height;
    if (ratio >= 1.1) {
      thumb.classList.add("is-horizontal");
    } else {
      thumb.classList.remove("is-horizontal");
    }
  }

  function renderMeta(metaItems, location, target) {
    const items = Array.isArray(metaItems) ? [...metaItems] : [];
    if (location && !items.some((entry) => String(entry || "").toLowerCase() === location.toLowerCase())) {
      items.push(location);
    }
    if (items.length === 0) return;
    items.forEach((item, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.textContent = "/";
        target.appendChild(sep);
      }
      const span = document.createElement("span");
      span.textContent = item;
      target.appendChild(span);
    });
  }

  function debugLog(...args) {
    if (!isDev) return;
    console.log(...args);
  }

  function setMetaDescription(text) {
    if (!metaDescriptionEl) return;
    metaDescriptionEl.setAttribute("content", text);
  }

  function showErrorPanel(message) {
    if (errorMessageEl) {
      errorMessageEl.textContent = message || "Try refreshing or pick another destination.";
    }
    if (errorPanel) {
      errorPanel.hidden = false;
    }
  }

  function hideErrorPanel() {
    if (errorPanel) {
      errorPanel.hidden = true;
    }
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

  function cleanListText(text) {
    return String(text || "")
      .replace(/🗑️?/g, "")
      .trim();
  }

  function renderBullets(bullets) {
    if (!bulletsEl) return;
    bulletsEl.innerHTML = "";
    (bullets || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = cleanListText(item);
      addDeleteButton(li);
      bulletsEl.appendChild(li);
    });
  }

  function renderList(el, items) {
    if (!el) return;
    el.innerHTML = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = cleanListText(item);
      addDeleteButton(li);
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
      li.textContent = cleanListText(`${label}: ${value}`);
      addDeleteButton(li);
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
      mediaStatusEl,
      heroWhyEl,
      vibeTextEl,
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

  function addDeleteButton(li, force = false) {
    if (!li || li.querySelector(".dest-page-delete")) return;
    if (!force && !isEditing()) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dest-page-delete";
    btn.setAttribute("aria-label", "Delete item");
    btn.innerHTML = "&#128465;";
    li.appendChild(btn);
  }

  function syncDeleteButtons(active) {
    const lists = [bulletsEl, diveSitesEl, nonDivingEl, logisticsTipsEl, conditionsEl];
    lists.forEach((list) => {
      if (!list) return;
      if (active) {
        list.querySelectorAll("li").forEach((li) => addDeleteButton(li, true));
      } else {
        list.querySelectorAll(".dest-page-delete").forEach((btn) => btn.remove());
      }
    });
  }

  function bindDeleteHandlers() {
    const lists = [bulletsEl, diveSitesEl, nonDivingEl, logisticsTipsEl, conditionsEl];
    lists.forEach((list) => {
      if (!list) return;
      list.addEventListener("click", (event) => {
        const button = event.target.closest(".dest-page-delete");
        if (!button) return;
        const li = button.closest("li");
        if (!li) return;
        const ok = window.confirm("Delete this item?");
        if (!ok) return;
        li.remove();
        markDirty();
      });
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
      mediaStatusEl,
      heroWhyEl,
      vibeTextEl,
    ];

    editableEls.forEach((el) => setEditable(el, active));
    setListEditable(bulletsEl, active);
    setListEditable(diveSitesEl, active);
    setListEditable(nonDivingEl, active);
    setListEditable(logisticsTipsEl, active);
    setListEditable(conditionsEl, active);
    setListEditable(perfectForEl, active);
    setListEditable(howItWorksEl, active);
    setHighlightsEditable(active);
    syncDeleteButtons(active);

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

    if (dest?.heroTitle || dest?.name) {
      params.set("location", dest.heroTitle || dest.name);
    }
    if (dest?.id) {
      params.set("destination", dest.id);
    }

    const href = `../contact/index.html?${params.toString()}#dive-now`;
    diveNowLinks.forEach((link) => {
      link.setAttribute("href", href);
    });
  }

  function renderHeroBadges(items) {
    if (!heroBadgesEl) return;
    heroBadgesEl.innerHTML = "";
    (items || []).forEach((item) => {
      if (!item) return;
      const badge = document.createElement("span");
      badge.className = "hero-badge";
      badge.textContent = item;
      heroBadgesEl.appendChild(badge);
    });
  }

  function renderVibe(dest) {
    if (!vibeTextEl) return;
    const vibe =
      dest?.vibe ||
      dest?.whyItWorks?.vibe ||
      dest?.summary ||
      "A relaxed dive rhythm with enough drama to keep every drop cinematic.";
    vibeTextEl.textContent = vibe;
  }

  function renderPerfectFor(items, fallback = []) {
    if (!perfectForEl) return;
    perfectForEl.innerHTML = "";
    const list = items?.length ? items : fallback?.length ? fallback : ["Trip fit details coming soon."];
    (list || []).forEach((item) => {
      if (!item) return;
      const li = document.createElement("li");
      li.textContent = item;
      perfectForEl.appendChild(li);
    });
  }

  function renderHowItWorks(items) {
    if (!howItWorksEl) return;
    howItWorksEl.innerHTML = "";
    (items || []).forEach((item) => {
      if (!item) return;
      const li = document.createElement("li");
      li.textContent = item;
      howItWorksEl.appendChild(li);
    });
  }

  function setMediaLink(dest) {
    if (!mediaLink) return;
    if (!dest) {
      mediaLink.href = "../media/index.html";
      return;
    }
    const param = dest.id || dest.name || "";
    mediaLink.href = param
      ? `../media/index.html?location=${encodeURIComponent(param)}`
      : "../media/index.html";
  }

  function buildDestinationKeys(dest) {
    const keys = new Set();
    [dest?.id, dest?.name, dest?.heroTitle, dest?.subtitle].forEach((value) => {
      const key = normalizeKey(value);
      if (key) keys.add(key);
    });
    return [...keys];
  }

  function filterDestinationMedia(items, dest) {
    const keys = buildDestinationKeys(dest);
    if (!keys.length) return [];
    return (items || []).filter((item) => {
      if (!item) return false;
      const locationKey = normalizeKey(item.location);
      const tagKeys = Array.isArray(item.tags) ? item.tags.map(normalizeKey) : [];
      return keys.some(
        (key) =>
          matchesLocationKey(locationKey, key) ||
          tagKeys.some((tag) => matchesLocationKey(tag, key))
      );
    });
  }

  function renderDestinationMedia(items, dest) {
    if (!mediaGrid) return;
    mediaGrid.innerHTML = "";
    const subset = (items || []).slice(0, 6);
    subset.forEach((item) => {
      const card = document.createElement("article");
      card.className = "media-card";

      const mediaUrl = resolveUrl(item.url || "");
      const youtubeId = getYouTubeId(mediaUrl);
      const streamId = item.streamId || getStreamIdFromUrl(mediaUrl);
      const isVideo = item.type === "video" || Boolean(youtubeId || streamId || isVideoUrl(mediaUrl));

      const thumbUrl = getMediaThumbUrl(item, mediaUrl, youtubeId, streamId);

      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "media-thumb media-link";
      thumb.setAttribute("aria-label", item.title || "Open trip clip");

      if (thumbUrl && isImageUrl(thumbUrl)) {
        const img = document.createElement("img");
        img.className = "media-thumb-img";
        img.src = thumbUrl;
        img.alt = item.title ? `${item.title} thumbnail` : "Trip clip thumbnail";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("load", () => {
          applyThumbAspect(thumb, img.naturalWidth, img.naturalHeight);
        });
        thumb.appendChild(img);
        thumb.classList.add("has-thumb");
      } else {
        const faux = document.createElement("div");
        faux.className = "media-thumb-faux";
        faux.textContent = item.title || "Trip clip";
        thumb.appendChild(faux);
        applyThumbAspect(thumb, 16, 9);
      }

      if (isVideo) addPlayOverlay(thumb);
      if (youtubeId) thumb.classList.add("is-youtube");
      if (isVideo) thumb.classList.add("is-video");

      thumb.addEventListener("click", () => {
        if (youtubeId) {
          openYoutubeModal(youtubeId, item.title);
          return;
        }
        if (streamId) {
          openStreamModal(streamId, item.title);
          return;
        }
        if (mediaUrl && isVideoUrl(mediaUrl)) {
          openVideoModal(mediaUrl, item.title);
          return;
        }
        if (mediaUrl) {
          window.open(mediaUrl, "_blank", "noopener");
        }
      });

      const badge = document.createElement("span");
      badge.className = "media-badge";
      badge.textContent = item.badge || (item.type ? item.type.toUpperCase() : "MEDIA");

      const body = document.createElement("div");
      body.className = "media-body";

      const badgeRow = document.createElement("div");
      badgeRow.className = "media-badge-row";
      badgeRow.appendChild(badge);

      const title = document.createElement("h3");
      title.textContent = item.title || "Trip Clip";

      const description = document.createElement("p");
      description.textContent =
        item.description || `Watch a clip from ${dest?.name || "this destination"}.`;
      if (!item.description) {
        description.classList.add("media-desc-empty");
      }

      const meta = document.createElement("div");
      meta.className = "media-meta";
      renderMeta(item.meta, item.location, meta);

      body.appendChild(badgeRow);
      body.appendChild(title);
      body.appendChild(description);
      if ((item.meta && item.meta.length) || item.location) {
        body.appendChild(meta);
      }

      card.appendChild(thumb);
      card.appendChild(body);
      mediaGrid.appendChild(card);
    });

    if (mediaStatusEl) {
      mediaStatusEl.textContent = subset.length
        ? `Latest trip clips from ${dest?.name || "this destination"}.`
        : dest?.mediaStatus ||
          "Trip clips coming soon. Follow DMZ or join the interest list to get first access.";
    }

    initMediaCarousel(subset.length);
  }

  function getMediaThumbUrl(item, mediaUrl, youtubeId, streamId) {
    let thumbUrl = resolveUrl(item.thumbUrl || "");
    if (!thumbUrl) {
      if (youtubeId) thumbUrl = buildYouTubeThumb(youtubeId);
      else if (streamId) thumbUrl = buildStreamThumb(streamId);
      else if (item.type === "photo" && isImageUrl(mediaUrl)) thumbUrl = mediaUrl;
    }
    return thumbUrl;
  }

  async function getImageAspect(url) {
    if (!url) return null;
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        resolve(result);
      };
      const timer = setTimeout(() => finish(null), 1200);
      img.onload = () => {
        clearTimeout(timer);
        finish({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };
      img.src = url;
    });
  }

  function hasVerticalHint(item) {
    const fields = [
      ...(item.meta || []),
      ...(item.tags || []),
      item.badge,
      item.title,
      item.description,
    ];
    return fields.some((value) => /vertical|portrait/i.test(String(value || "")));
  }

  async function prioritizeVerticalMedia(items) {
    const list = Array.isArray(items) ? [...items] : [];
    const entries = await Promise.all(
      list.map(async (item, index) => {
        if (!item) return { item, index, isVertical: false };
        if (hasVerticalHint(item)) return { item, index, isVertical: true };
        const mediaUrl = resolveUrl(item.url || "");
        const youtubeId = getYouTubeId(mediaUrl);
        const streamId = item.streamId || getStreamIdFromUrl(mediaUrl);
        const thumbUrl = getMediaThumbUrl(item, mediaUrl, youtubeId, streamId);
        const aspect = await getImageAspect(thumbUrl);
        if (!aspect || !aspect.width || !aspect.height) {
          return { item, index, isVertical: false };
        }
        const ratio = aspect.height / aspect.width;
        return { item, index, isVertical: ratio >= 1.15 };
      })
    );
    return entries
      .sort((a, b) => {
        if (a.isVertical !== b.isVertical) return a.isVertical ? -1 : 1;
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }

  function initMediaCarousel(total) {
    if (!mediaGrid || !mediaDots) return;
    mediaDots.innerHTML = "";
    if (total <= 3) {
      mediaGrid.classList.remove("is-scroll");
      mediaDots.hidden = true;
      if (mediaPrev) mediaPrev.hidden = true;
      if (mediaNext) mediaNext.hidden = true;
      if (mediaAutoScrollTimer) {
        clearInterval(mediaAutoScrollTimer);
        mediaAutoScrollTimer = null;
      }
      return;
    }

    const pageCount = Math.ceil(total / 3);
    mediaGrid.classList.add("is-scroll");
    mediaDots.hidden = false;
    if (mediaPrev) mediaPrev.hidden = false;
    if (mediaNext) mediaNext.hidden = false;

    const setActiveDot = (index) => {
      mediaDots.querySelectorAll(".media-dot").forEach((dot, i) => {
        dot.classList.toggle("is-active", i === index);
      });
      if (mediaPrev) mediaPrev.disabled = index === 0;
      if (mediaNext) mediaNext.disabled = index === pageCount - 1;
    };

    const scrollToPage = (index) => {
      const width = mediaGrid.getBoundingClientRect().width || 1;
      mediaGrid.scrollTo({ left: width * index, behavior: "smooth" });
      setActiveDot(index);
    };

    for (let i = 0; i < pageCount; i += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "media-dot";
      dot.setAttribute("aria-label", `Show clips ${i * 3 + 1} to ${Math.min(total, (i + 1) * 3)}`);
      dot.addEventListener("click", () => scrollToPage(i));
      mediaDots.appendChild(dot);
    }

    setActiveDot(0);

    if (mediaScrollHandler) {
      mediaGrid.removeEventListener("scroll", mediaScrollHandler);
    }
    mediaScrollHandler = () => {
      const width = mediaGrid.getBoundingClientRect().width || 1;
      const index = Math.round(mediaGrid.scrollLeft / width);
      setActiveDot(Math.min(pageCount - 1, Math.max(0, index)));
    };
    mediaGrid.addEventListener("scroll", mediaScrollHandler, { passive: true });

    if (mediaResizeHandler) {
      window.removeEventListener("resize", mediaResizeHandler);
    }
    mediaResizeHandler = () => {
      mediaGrid.scrollTo({ left: 0 });
      setActiveDot(0);
    };
    window.addEventListener("resize", mediaResizeHandler);

    if (mediaPrev) {
      mediaPrev.onclick = () => {
        const width = mediaGrid.getBoundingClientRect().width || 1;
        mediaGrid.scrollBy({ left: -width, behavior: "smooth" });
      };
    }
    if (mediaNext) {
      mediaNext.onclick = () => {
        const width = mediaGrid.getBoundingClientRect().width || 1;
        mediaGrid.scrollBy({ left: width, behavior: "smooth" });
      };
    }

    if (mediaAutoScrollTimer) {
      clearInterval(mediaAutoScrollTimer);
    }
    mediaAutoScrollTimer = setInterval(() => {
      const width = mediaGrid.getBoundingClientRect().width || 1;
      const index = Math.round(mediaGrid.scrollLeft / width);
      const nextIndex = index + 1 >= pageCount ? 0 : index + 1;
      scrollToPage(nextIndex);
    }, 15000);
  }

  async function fetchMediaData() {
    const cacheBuster = isDev ? `?v=${Date.now()}` : "";
    const safeFetch = async (url, options, label) => {
      try {
        const res = await fetch(url, options);
        debugLog(`[Destination Media] ${label}:`, url, res.status);
        return res;
      } catch (error) {
        debugLog(`[Destination Media] ${label} failed:`, url, error);
        return null;
      }
    };

    const apiRes = await safeFetch(mediaApiUrl, { cache: "no-store" }, "API");
    if (apiRes && apiRes.ok) return apiRes.json();

    const fileRes = await safeFetch(`${mediaDataUrl}${cacheBuster}`, { cache: "no-store" }, "JSON");
    if (!fileRes || !fileRes.ok) {
      throw new Error("Failed to load media data.");
    }
    return fileRes.json();
  }

  async function loadDestinationMedia(dest) {
    setMediaLink(dest);
    if (!mediaGrid) return;
    const requestId = ++mediaRequestId;
    mediaGrid.innerHTML = "";
    if (mediaStatusEl) mediaStatusEl.textContent = "Loading trip clips...";

    try {
      const data = await fetchMediaData();
      if (requestId !== mediaRequestId) return;
      const items = Array.isArray(data.mediaItems) ? data.mediaItems : [];
      const matches = filterDestinationMedia(items, dest);
      const ordered = await prioritizeVerticalMedia(matches);
      if (requestId !== mediaRequestId) return;
      renderDestinationMedia(ordered, dest);
    } catch (error) {
      console.error("Failed to load destination media:", error);
      if (requestId !== mediaRequestId) return;
      if (mediaStatusEl) {
        mediaStatusEl.textContent =
          dest?.mediaStatus || "Trip clips unavailable right now. Check back soon.";
      }
    }
  }

  function clearDestinationMedia(message) {
    if (mediaGrid) mediaGrid.innerHTML = "";
    if (mediaStatusEl) {
      mediaStatusEl.textContent =
        message ||
        "Trip clips coming soon. Follow DMZ or join the interest list to get first access.";
    }
    setMediaLink(null);
  }

  function renderDestination(dest) {
    if (!dest) {
      setText(nameEl, "Destination Not Found");
      setText(subtitleEl, "Return to the travel page to pick a destination.");
      setText(heroWhyEl, "We could not load this destination.");
      renderHeroBadges([]);
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
      if (vibeTextEl) vibeTextEl.textContent = "Trip vibe unavailable.";
      renderPerfectFor([], []);
      renderHowItWorks([]);
      clearDestinationMedia("Trip clips coming soon.");
      return;
    }

    const displayName = dest.heroTitle || dest.name || "Destination";
    setText(nameEl, displayName);
    setText(subtitleEl, dest.subtitle || "Explore this destination with DMZ Scuba.");
    setText(heroWhyEl, dest.heroWhy || dest.summary || "Plan a dive trip that matches your goals.");
    renderHeroBadges(dest.heroHighlights || dest.highlights || dest.tags || []);
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
    renderVibe(dest);
    renderPerfectFor(dest.perfectFor, dest.tags);
    renderHowItWorks(
      dest.howItWorks || [
        "Reserve your spot with a deposit.",
        "We help with flights, packing, and timing.",
        "DMZ handles dive logistics and schedules.",
        "You show up and dive."
      ],
    );
    loadDestinationMedia(dest);

    if (interestLocationInput) interestLocationInput.value = displayName || "";
    if (interestIdInput) interestIdInput.value = dest.id || "";
    if (interestForm && displayName) {
      interestForm.dataset.subject = `Travel interest: ${displayName}`;
    }

    if (displayName) {
      document.title = `DMZ Scuba | ${displayName}`;
    }

    if (displayName) {
      const base = `Explore ${displayName} with DMZ Scuba.`;
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
    const id = (params.get("id") || params.get("destination") || "").trim().toLowerCase();
    currentId = id;
    hideErrorPanel();
    debugLog("[Destination] resolved id:", id);

    if (!id) {
      showErrorPanel("Pick a destination to see the full trip details.");
      renderDestination(null);
      return;
    }

    try {
      let baseData = [];
      let expandedData = [];
      const cacheBuster = isDev ? `?v=${Date.now()}` : "";

      const safeFetch = async (url, options, label) => {
        try {
          const res = await fetch(url, options);
          debugLog(`[Destination] ${label}:`, url, res.status);
          return res;
        } catch (error) {
          debugLog(`[Destination] ${label} failed:`, url, error);
          return null;
        }
      };

      const [apiRes, apiExpandedRes] = await Promise.all([
        safeFetch(apiBaseUrl, { cache: "no-store" }, "API base"),
        safeFetch(apiExpandedUrl, { cache: "no-store" }, "API expanded"),
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
        const baseRes = await safeFetch(
          `/assets/data/destinations.json${cacheBuster}`,
          { cache: "no-store" },
          "JSON base",
        );
        if (!baseRes || !baseRes.ok) throw new Error("Failed to load destinations");
        baseData = await baseRes.json();
      }

      if (!expandedData.length) {
        const expandedRes = await safeFetch(
          `/assets/data/destinations-expanded.json${cacheBuster}`,
          { cache: "no-store" },
          "JSON expanded",
        );
        expandedData = expandedRes && expandedRes.ok ? await expandedRes.json() : [];
      }

      const baseDest = (baseData || []).find((item) => item.id === id);
      const extraDest = (expandedData || []).find((item) => item.id === id);
      const dest = mergeDestination(baseDest, extraDest);
      currentBase = baseDest || null;
      currentExpanded = extraDest || null;
      if (heroInput) heroInput.value = dest?.heroImage || "";
      if (isoInput) isoInput.value = dest?.isoImage || "";

      if (!dest) {
        showErrorPanel("We could not find that destination. Try another destination.");
        renderDestination(null);
        return;
      }

      renderDestination(dest);
    } catch (err) {
      console.error("Failed to load destination:", err);
      showErrorPanel("We couldn't load this destination. Try refreshing or pick another destination.");
      renderDestination(null);
    }
  }

  function readList(el) {
    if (!el) return [];
    return [...el.querySelectorAll("li")]
      .map((li) => {
        const clone = li.cloneNode(true);
        clone.querySelectorAll(".dest-page-delete").forEach((btn) => btn.remove());
        return cleanListText(clone.textContent);
      })
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
      mediaStatus: mediaStatusEl ? mediaStatusEl.textContent.trim() : "",
      heroWhy: heroWhyEl ? heroWhyEl.textContent.trim() : "",
      vibe: vibeTextEl ? vibeTextEl.textContent.trim() : "",
      perfectFor: readList(perfectForEl),
      howItWorks: readList(howItWorksEl),
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
    addDeleteButton(li, true);
    list.appendChild(li);
    li.focus();
    markDirty();
  }

  function setupAdminControls() {
    if (!adminPanel) return;
    updateAuthState();
    bindEditableListeners();
    bindDeleteHandlers();

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

  function setupPageControls() {
    if (retryButton) {
      retryButton.addEventListener("click", () => loadDestination());
    }

    const toggleInterestForm = () => {
      if (!interestForm) return;
      const nextOpen = interestForm.hasAttribute("hidden");
      interestForm.toggleAttribute("hidden", !nextOpen);
      if (interestToggle) {
        interestToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      }
      if (nextOpen) {
        interestForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    document.querySelectorAll(".dest-interest-toggle").forEach((button) => {
      button.addEventListener("click", () => toggleInterestForm());
    });

    if (interestForm) {
      interestForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (window.DMZForms && typeof window.DMZForms.submit === "function") {
          window.DMZForms.submit(interestForm, { requireEmail: true });
        }
      });
    }
  }

  loadDestination();
  setupAdminControls();
  setupPageControls();
})();
