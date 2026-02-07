(() => {
  const apiRoot = (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const apiByIdUrl = apiRoot ? `${apiRoot}/api/v2/destinations/` : "/api/v2/destinations/";
  const apiAdminByIdUrl = apiRoot ? `${apiRoot}/api/admin/v2/destinations/` : "/api/admin/v2/destinations/";
  const tokenStorageKey = "dmzMediaToken";

  const nameEl = document.getElementById("destName");
  const subtitleEl = document.getElementById("destSubtitle");
  const heroWhyEl = document.getElementById("destHeroWhy");
  const heroBadgesEl = document.getElementById("destHeroBadges");

  const narrativeEl = document.getElementById("destNarrative");
  const summaryEl = document.getElementById("destSummary");
  const experienceEl = document.getElementById("experienceText");
  const seasonalityEl = document.getElementById("seasonalityText");
  const logisticsEl = document.getElementById("logisticsText");

  const isoTitleEl = document.getElementById("isoTitle");
  const isoDescEl = document.getElementById("isoDesc");
  const isoBox = document.getElementById("isoBox");
  const isoImg = document.getElementById("isoImage");
  const isoLabel = document.getElementById("isoLabel");

  const dayToDayEl = document.getElementById("dayToDayText");
  const resortNameEl = document.getElementById("resortName");
  const resortDescEl = document.getElementById("resortDesc");
  const resortDetailsEl = document.getElementById("resortDetailsText");
  const logisticsDetailsEl = document.getElementById("logisticsDetailsText");
  const logisticsTipsEl = document.getElementById("logisticsTipsList");
  const travelLogisticsTitleEl = document.getElementById("travelLogisticsTitle");

  const vibeTextEl = document.getElementById("destVibeText");
  const mediaStatusEl = document.getElementById("destMediaStatus");
  const mediaGrid = document.getElementById("destMediaGrid");
  const mediaDots = document.getElementById("destMediaDots");
  const mediaPrev = document.getElementById("destMediaPrev");
  const mediaNext = document.getElementById("destMediaNext");

  const bulletsEl = document.getElementById("destBullets");
  const diveSitesEl = document.getElementById("diveSitesList");
  const nonDivingEl = document.getElementById("nonDivingList");
  const conditionsEl = document.getElementById("conditionsList");
  const perfectForEl = document.getElementById("destPerfectFor");
  const howItWorksEl = document.getElementById("destHowItWorks");
  const highlightsEl = document.getElementById("diveSiteHighlights");
  const diveSiteHighlightsEl = highlightsEl;

  const heroInput = document.getElementById("destEditHeroImage");
  const isoInput = document.getElementById("destEditIsoImage");

  const adminFab = document.querySelector(".dest-page-admin-fab");
  const adminPanel = document.getElementById("destPageAdminPanel");
  const adminClose = document.querySelector(".dest-page-admin-close");
  const adminStatus = document.getElementById("destPageAdminStatus");
  const loginButton = document.querySelector(".dest-page-login-button");
  const editToggle = document.querySelector(".dest-page-edit-toggle");
  const importButton = document.getElementById("destPageImport");
  const saveButton = document.querySelector(".dest-page-save");
  const cancelButton = document.querySelector(".dest-page-cancel");
  const logoutButton = document.querySelector(".dest-page-logout");
  const addHighlightButton = document.getElementById("destPageAddHighlight");
  const addButtons = document.querySelectorAll(".dest-page-add");

  const errorPanel = document.getElementById("destErrorPanel");
  const errorMessageEl = document.getElementById("destErrorMessage");
  const retryButton = document.getElementById("destRetryButton");

  const heroRoot = document.documentElement;
  const diveNowLinks = document.querySelectorAll(".dive-now-link");
  const mediaLink = document.getElementById("destMediaLink");
  const mediaApiUrl = apiRoot ? `${apiRoot}/api/media` : "/api/media";
  const mediaWorkerFallbackUrl = "https://dmz-media-api.zacharylisowski55.workers.dev/api/media";
  const mediaDataUrl = "/assets/data/media.json";

  let currentId = "";
  let currentItem = null;
  let isDirty = false;
  let mediaRequestId = 0;
  let mediaScrollHandler = null;
  let mediaResizeHandler = null;
  let mediaAutoScrollTimer = null;
  let mediaAutoDirection = 1;
  let mediaUserInteracted = false;
  let mediaHeightSyncTimer = null;
  const isDev =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
    window.location.hostname.endsWith(".local");

  function setText(el, value) {
    if (el) el.textContent = String(value || "");
  }

  function isEditing() {
    return document.body.classList.contains("dest-page-editing");
  }

  function setList(el, items = [], ordered = false) {
    if (!el) return;
    el.innerHTML = "";
    (Array.isArray(items) ? items : []).forEach((entry) => {
      const text = typeof entry === "string" ? entry.trim() : "";
      if (!text) return;
      const li = document.createElement("li");
      li.textContent = text;
      el.appendChild(li);
    });
    if (ordered) el.setAttribute("data-ordered", "true");
  }

  function readText(el) {
    if (!el) return "";
    const raw = typeof el.innerText === "string" ? el.innerText : String(el.textContent || "");
    return raw
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function readList(el) {
    if (!el) return [];
    return [...el.querySelectorAll("li")]
      .map((li) => {
        const clone = li.cloneNode(true);
        clone.querySelectorAll(".dest-page-delete").forEach((btn) => btn.remove());
        return String(clone.textContent || "").trim();
      })
      .filter(Boolean);
  }

  function readHighlights() {
    if (!diveSiteHighlightsEl) return [];
    return [...diveSiteHighlightsEl.querySelectorAll(".site-highlight-card")]
      .map((card) => {
        const title = String(card.querySelector("h3")?.textContent || "").trim();
        const details = String(card.querySelector("p")?.textContent || "").trim();
        if (!title && !details) return null;
        return {
          name: title || "Dive Site",
          details,
        };
      })
      .filter(Boolean);
  }

  function formatDestinationName(value) {
    const raw = String(value || "").trim();
    if (!raw) return "this destination";
    if (raw === raw.toUpperCase()) {
      return raw
        .toLowerCase()
        .replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
    }
    return raw;
  }

  function normalizeImageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("imagedelivery.net/")) return `https://${raw}`;
    return raw;
  }

  function setHeroImage(url) {
    const finalUrl = normalizeImageUrl(url);
    if (!heroRoot) return;
    if (!finalUrl) {
      heroRoot.style.removeProperty("--destination-hero-image");
      return;
    }
    heroRoot.style.setProperty("--destination-hero-image", `url("${finalUrl}")`);
  }

  function renderIso(item) {
    if (!isoBox || !isoImg || !isoLabel) return;
    const url = normalizeImageUrl(item && item.isoImage);
    if (!url) {
      isoImg.removeAttribute("src");
      isoImg.alt = "";
      isoBox.classList.remove("is-loaded");
      isoLabel.textContent = "Image coming soon.";
      return;
    }
    isoImg.src = url;
    isoImg.alt = `Isometric view of ${item.name || "destination"}`;
    isoBox.classList.add("is-loaded");
    isoLabel.textContent = " ";
  }

  function renderBadges(tags) {
    if (!heroBadgesEl) return;
    heroBadgesEl.innerHTML = "";
    (Array.isArray(tags) ? tags : []).forEach((tag) => {
      const value = String(tag || "").trim();
      if (!value) return;
      const span = document.createElement("span");
      span.className = "hero-badge";
      span.textContent = value;
      heroBadgesEl.appendChild(span);
    });
  }

  function renderHighlights(items) {
    if (!highlightsEl) return;
    highlightsEl.innerHTML = "";
    (Array.isArray(items) ? items : []).forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const name = String(entry.name || entry.title || "").trim();
      const details = String(entry.details || entry.description || "").trim();
      if (!name && !details) return;
      const card = document.createElement("article");
      card.className = "site-highlight-card";
      const h3 = document.createElement("h3");
      h3.textContent = name || "Dive Site";
      const p = document.createElement("p");
      p.textContent = details;
      card.append(h3, p);
      highlightsEl.appendChild(card);
    });
  }

  function renderConditions(conditions) {
    const rows = [];
    if (conditions && typeof conditions === "object") {
      if (conditions.visibility) rows.push(`Visibility: ${conditions.visibility}`);
      if (conditions.temperature) rows.push(`Temperature: ${conditions.temperature}`);
      if (conditions.currents) rows.push(`Currents: ${conditions.currents}`);
    }
    setList(conditionsEl, rows);
  }

  function parseConditionsFromList() {
    const lines = readList(conditionsEl);
    const next = {};
    lines.forEach((line) => {
      const [label, ...rest] = String(line || "").split(":");
      const key = String(label || "").trim().toLowerCase();
      const value = rest.join(":").trim();
      if (!value) return;
      if (key.includes("visibility")) next.visibility = value;
      if (key.includes("temperature")) next.temperature = value;
      if (key.includes("current")) next.currents = value;
    });
    return next;
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
    const normalized = String(url).replace(/\\/g, "/");
    if (normalized.startsWith("assets/")) return `/${normalized}`;
    if (normalized.startsWith("./assets/")) return `/${normalized.slice(2)}`;
    if (/^(?:[a-z]+:)?\/\//i.test(normalized) || normalized.startsWith("data:") || normalized.startsWith("blob:")) {
      return normalized;
    }
    if (normalized.startsWith("/")) return normalized;
    try {
      return new URL(normalized, window.location.href).href;
    } catch (error) {
      return normalized;
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

  function mountInlineEmbed(target, options) {
    if (!target || !options || !options.src) return;
    if (target.dataset.videoLoaded === "true") return;
    target.dataset.videoLoaded = "true";
    target.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.className = "media-thumb-embed";
    iframe.src = options.src;
    iframe.title = options.title || "Video";
    iframe.allow =
      options.allow ||
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    target.appendChild(iframe);
    scheduleMediaHeightSync();
  }

  function mountInlineVideo(target, src, title) {
    if (!target || !src) return;
    if (target.dataset.videoLoaded === "true") return;
    target.dataset.videoLoaded = "true";
    target.innerHTML = "";
    const video = document.createElement("video");
    video.className = "media-thumb-video";
    video.controls = true;
    video.preload = "auto";
    video.playsInline = true;
    video.autoplay = true;
    video.title = title || "Video";
    const source = document.createElement("source");
    source.src = src;
    source.type = "video/mp4";
    video.appendChild(source);
    video.addEventListener("loadedmetadata", () => {
      applyThumbAspect(target, video.videoWidth, video.videoHeight);
      scheduleMediaHeightSync();
    });
    target.appendChild(video);
    video.load();
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
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

  function syncMediaCardHeights() {
    if (!mediaGrid) return;
    const primaryCards = [...mediaGrid.querySelectorAll(".media-card:not(.is-compact)")];
    const fallbackCards = [...mediaGrid.querySelectorAll(".media-card")];
    const cards = primaryCards.length ? primaryCards : fallbackCards;
    if (!cards.length) return;
    const heights = cards.map((card) => card.getBoundingClientRect().height).filter((h) => h > 0);
    if (!heights.length) return;
    const maxHeight = Math.max(...heights);
    mediaGrid.style.setProperty("--media-card-height", `${Math.round(maxHeight)}px`);
  }

  function scheduleMediaHeightSync() {
    if (mediaHeightSyncTimer) clearTimeout(mediaHeightSyncTimer);
    mediaHeightSyncTimer = setTimeout(() => {
      syncMediaCardHeights();
      mediaHeightSyncTimer = null;
    }, 80);
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

  function getItemKey(item, index) {
    return item && item.id ? item.id : `idx-${index}`;
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
      const existingDelete = card.querySelector(".dest-highlight-delete");
      if (active) {
        if (title) {
          title.setAttribute("contenteditable", "true");
          title.addEventListener("input", markDirty);
        }
        if (desc) {
          desc.setAttribute("contenteditable", "true");
          desc.addEventListener("input", markDirty);
        }
        if (!existingDelete) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "dest-highlight-delete";
          removeBtn.textContent = "Remove Card";
          removeBtn.addEventListener("click", () => {
            if (!window.confirm("Remove this highlight card?")) return;
            card.remove();
            markDirty();
          });
          card.appendChild(removeBtn);
        }
      } else {
        if (title) title.removeAttribute("contenteditable");
        if (desc) desc.removeAttribute("contenteditable");
        if (existingDelete) existingDelete.remove();
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

  function createDestinationMediaCard(item, dest, compact = false) {
    const card = document.createElement("article");
    card.className = compact ? "media-card is-compact" : "media-card";

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
        scheduleMediaHeightSync();
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
        mountInlineEmbed(thumb, {
          src: `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`,
          title: item.title || "YouTube video",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        });
        return;
      }
      if (streamId) {
        mountInlineEmbed(thumb, {
          src: `https://iframe.videodelivery.net/${streamId}?autoplay=true`,
          title: item.title || "Cloudflare Stream video",
        });
        return;
      }
      if (mediaUrl && isVideoUrl(mediaUrl)) {
        mountInlineVideo(thumb, mediaUrl, item.title || "Video");
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
    return card;
  }

  function buildMediaBlocks(items, orientationMap) {
    const blocks = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const key = getItemKey(item, i);
      const orientation = orientationMap.get(key) || "unknown";
      if (orientation === "horizontal" && i + 1 < items.length) {
        const next = items[i + 1];
        const nextKey = getItemKey(next, i + 1);
        const nextOrientation = orientationMap.get(nextKey) || "unknown";
        if (nextOrientation === "horizontal") {
          blocks.push({ type: "stack", items: [item, next] });
          i += 1;
          continue;
        }
      }
      blocks.push({ type: "single", item });
    }
    return blocks;
  }

  function renderDestinationMedia(items, dest, orientationMap) {
    if (!mediaGrid) return;
    mediaGrid.innerHTML = "";
    const subset = (items || []).slice(0, 6);
    const map = orientationMap || new Map();
    const blocks = buildMediaBlocks(subset, map);

    blocks.forEach((block) => {
      if (block.type === "stack") {
        const stack = document.createElement("div");
        stack.className = "media-stack";
        block.items.forEach((item) => {
          stack.appendChild(createDestinationMediaCard(item, dest, true));
        });
        mediaGrid.appendChild(stack);
      } else {
        mediaGrid.appendChild(createDestinationMediaCard(block.item, dest));
      }
    });

    // Safety fallback: if advanced block rendering yields no DOM nodes,
    // render direct cards so media never disappears on destination pages.
    if (!mediaGrid.children.length && subset.length) {
      subset.forEach((item) => {
        mediaGrid.appendChild(createDestinationMediaCard(item, dest));
      });
    }

    if (mediaStatusEl) {
      mediaStatusEl.textContent = subset.length
        ? `Latest trip clips from ${formatDestinationName(dest?.name)}.`
        : dest?.mediaStatus ||
          "Trip clips coming soon. Follow DMZ or join the interest list to get first access.";
    }

    initMediaCarousel(blocks.length);
    requestAnimationFrame(() => {
      syncMediaCardHeights();
    });
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

  function hasHorizontalHint(item) {
    const fields = [
      ...(item.meta || []),
      ...(item.tags || []),
      item.badge,
      item.title,
      item.description,
    ];
    return fields.some((value) => /horizontal|landscape/i.test(String(value || "")));
  }

  async function getMediaOrientations(items) {
    const list = Array.isArray(items) ? items : [];
    const entries = await Promise.all(
      list.map(async (item, index) => {
        const key = getItemKey(item, index);
        if (!item) return [key, "unknown"];
        if (hasVerticalHint(item)) return [key, "vertical"];
        if (hasHorizontalHint(item)) return [key, "horizontal"];
        const mediaUrl = resolveUrl(item.url || "");
        const youtubeId = getYouTubeId(mediaUrl);
        const streamId = item.streamId || getStreamIdFromUrl(mediaUrl);
        const thumbUrl = getMediaThumbUrl(item, mediaUrl, youtubeId, streamId);
        const aspect = await getImageAspect(thumbUrl);
        if (!aspect || !aspect.width || !aspect.height) return [key, "unknown"];
        const ratio = aspect.height / aspect.width;
        if (ratio >= 1.15) return [key, "vertical"];
        if (ratio <= 0.85) return [key, "horizontal"];
        return [key, "square"];
      })
    );
    return new Map(entries);
  }

  function prioritizeVerticalMedia(items, orientationMap) {
    const list = Array.isArray(items) ? [...items] : [];
    const entries = list.map((item, index) => {
      const key = getItemKey(item, index);
      const orientation = orientationMap.get(key) || "unknown";
      return { item, index, isVertical: orientation === "vertical" };
    });
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
    const cardsPerPage = window.matchMedia("(max-width: 980px)").matches ? 1 : 3;
    const getBlocks = () =>
      [...mediaGrid.children].filter((el) =>
        el.classList.contains("media-card") || el.classList.contains("media-stack")
      );
    const blockCount = getBlocks().length;

    if (blockCount <= cardsPerPage) {
      mediaGrid.classList.remove("is-scroll");
      mediaDots.hidden = true;
      if (mediaPrev) mediaPrev.hidden = true;
      if (mediaNext) mediaNext.hidden = true;
      if (mediaAutoScrollTimer) {
        clearInterval(mediaAutoScrollTimer);
        mediaAutoScrollTimer = null;
      }
      mediaUserInteracted = false;
      return;
    }

    const pageCount = Math.ceil(blockCount / cardsPerPage);
    mediaGrid.classList.add("is-scroll");
    mediaDots.hidden = false;
    if (mediaPrev) mediaPrev.hidden = false;
    if (mediaNext) mediaNext.hidden = false;

    const getClosestBlockIndex = () => {
      const blocks = getBlocks();
      if (!blocks.length) return 0;
      const left = mediaGrid.scrollLeft;
      let closest = 0;
      let minDelta = Infinity;
      blocks.forEach((block, index) => {
        const delta = Math.abs(block.offsetLeft - left);
        if (delta < minDelta) {
          minDelta = delta;
          closest = index;
        }
      });
      return closest;
    };

    const getPageIndex = () => {
      const closest = getClosestBlockIndex();
      return Math.floor(closest / cardsPerPage);
    };

    const setActiveDot = (pageIndex) => {
      mediaDots.querySelectorAll(".media-dot").forEach((dot, i) => {
        dot.classList.toggle("is-active", i === pageIndex);
      });
    };

    const updateArrowState = () => {
      const left = mediaGrid.scrollLeft;
      const maxLeft = Math.max(0, mediaGrid.scrollWidth - mediaGrid.clientWidth);
      const atStart = left <= 2;
      const atEnd = left >= maxLeft - 2;
      if (mediaPrev) mediaPrev.disabled = atStart;
      if (mediaNext) mediaNext.disabled = atEnd;
    };

    const refreshControls = () => {
      setActiveDot(Math.min(pageCount - 1, Math.max(0, getPageIndex())));
      updateArrowState();
    };

    const scrollToBlock = (blockIndex) => {
      const blocks = getBlocks();
      const targetIndex = Math.min(blocks.length - 1, Math.max(0, blockIndex));
      const target = blocks[targetIndex];
      if (!target) return;
      mediaGrid.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
      requestAnimationFrame(refreshControls);
    };

    const scrollToPage = (pageIndex) => {
      const blockIndex = Math.max(0, pageIndex * cardsPerPage);
      scrollToBlock(blockIndex);
    };

    const stopAutoScroll = () => {
      mediaUserInteracted = true;
      if (mediaAutoScrollTimer) {
        clearInterval(mediaAutoScrollTimer);
        mediaAutoScrollTimer = null;
      }
    };

    for (let i = 0; i < pageCount; i += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "media-dot";
      dot.setAttribute(
        "aria-label",
        `Show clips ${i * cardsPerPage + 1} to ${Math.min(blockCount, (i + 1) * cardsPerPage)}`
      );
      dot.addEventListener("click", () => scrollToPage(i));
      mediaDots.appendChild(dot);
    }

    refreshControls();

    if (mediaScrollHandler) {
      mediaGrid.removeEventListener("scroll", mediaScrollHandler);
    }
    mediaScrollHandler = () => {
      refreshControls();
    };
    mediaGrid.addEventListener("scroll", mediaScrollHandler, { passive: true });
    mediaGrid.addEventListener("pointerdown", stopAutoScroll, { passive: true });
    mediaGrid.addEventListener("wheel", stopAutoScroll, { passive: true });
    mediaGrid.addEventListener("touchstart", stopAutoScroll, { passive: true });

    if (mediaResizeHandler) {
      window.removeEventListener("resize", mediaResizeHandler);
    }
    mediaResizeHandler = () => {
      mediaGrid.scrollTo({ left: 0 });
      refreshControls();
      scheduleMediaHeightSync();
    };
    window.addEventListener("resize", mediaResizeHandler);

    if (mediaPrev) {
      mediaPrev.onclick = () => {
        stopAutoScroll();
        const index = getClosestBlockIndex();
        scrollToBlock(index - 1);
      };
    }
    if (mediaNext) {
      mediaNext.onclick = () => {
        stopAutoScroll();
        const index = getClosestBlockIndex();
        scrollToBlock(index + 1);
      };
    }

    if (mediaAutoScrollTimer) {
      clearInterval(mediaAutoScrollTimer);
    }
    mediaAutoDirection = 1;
    mediaUserInteracted = false;
    mediaAutoScrollTimer = setInterval(() => {
      if (mediaUserInteracted) return;
      const index = getClosestBlockIndex();
      let nextIndex = index + mediaAutoDirection;
      if (nextIndex >= blockCount) {
        mediaAutoDirection = -1;
        nextIndex = blockCount - 2 >= 0 ? blockCount - 2 : 0;
      } else if (nextIndex < 0) {
        mediaAutoDirection = 1;
        nextIndex = 1 < blockCount ? 1 : 0;
      }
      scrollToBlock(nextIndex);
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
    const candidateApiUrls = [...new Set([mediaApiUrl, "/api/media", mediaWorkerFallbackUrl])];
    for (const url of candidateApiUrls) {
      const apiRes = await safeFetch(url, { cache: "no-store" }, "API");
      if (!apiRes || !apiRes.ok) continue;
      const json = await apiRes.json().catch(() => ({}));
      const mediaItems = Array.isArray(json.mediaItems) ? json.mediaItems : [];
      const photoItems = Array.isArray(json.photoItems) ? json.photoItems : [];
      if (mediaItems.length || photoItems.length) {
        return json;
      }
    }

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
      const mediaItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
      const photoItems = Array.isArray(data.photoItems) ? data.photoItems : [];
      const items = [...mediaItems, ...photoItems];
      const matches = filterDestinationMedia(items, dest);
      const orientationMap = await getMediaOrientations(matches);
      const ordered = prioritizeVerticalMedia(matches, orientationMap);
      if (requestId !== mediaRequestId) return;
      renderDestinationMedia(ordered, dest, orientationMap);
      if (!mediaGrid.children.length && ordered.length) {
        ordered.slice(0, 6).forEach((item) => {
          mediaGrid.appendChild(createDestinationMediaCard(item, dest));
        });
        if (mediaStatusEl) {
          mediaStatusEl.textContent = `Latest trip clips from ${formatDestinationName(dest?.name)}.`;
        }
      }
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

  function render(item) {
    if (!item) return;

    setText(nameEl, item.name || "Destination");
    setText(subtitleEl, item.subtitle || "Destination details are loading.");
    setText(heroWhyEl, item.heroWhy || item.summary || "Summary loading.");
    renderBadges(item.tags || []);

    setText(narrativeEl, item.narrative || "Destination details are loading.");
    setText(summaryEl, item.summary || "Summary loading.");
    setText(experienceEl, item.experience || "Experience loading.");
    setText(seasonalityEl, item.seasonality || "Seasonality loading.");
    setText(logisticsEl, item.logistics || item.logisticsDetails || "Logistics loading.");

    setText(isoTitleEl, item.isoTitle || "Resort View (Isometric)");
    setText(isoDescEl, item.isoDesc || "Select a destination to load the resort view.");
    renderIso(item);
    setHeroImage(item.heroImage || "");

    setText(dayToDayEl, item.dayToDay || "Day-to-day details are loading.");
    setText(resortNameEl, (item.resort && item.resort.name) || "Resort name loading.");
    setText(resortDescEl, (item.resort && item.resort.description) || "Resort details loading.");
    setText(resortDetailsEl, item.resortDetails || (item.resort && item.resort.description) || "Resort details loading.");

    setText(vibeTextEl, item.vibe || (item.whyItWorks && item.whyItWorks.vibe) || "The vibe details are loading.");
    setText(mediaStatusEl, item.mediaStatus || `Latest trip clips from ${formatDestinationName(item.name)}.`);

    setList(bulletsEl, item.bullets || []);
    setList(diveSitesEl, item.diveSites || []);
    setList(nonDivingEl, item.nonDiving || []);
    setList(perfectForEl, item.perfectFor || item.tags || []);
    setList(howItWorksEl, item.howItWorks || []);
    renderHighlights(item.diveSiteHighlights || []);
    renderConditions(item.conditions || {});

    if (heroInput) heroInput.value = item.heroImage || "";
    if (isoInput) isoInput.value = item.isoImage || "";

    const detailUrl = `../travel/destination.html?id=${encodeURIComponent(item.id || "")}`;
    diveNowLinks.forEach((link) => {
      if (!link) return;
      const base = "../contact/index.html#dive-now";
      link.href = item.id ? `${base}&destination=${encodeURIComponent(item.id)}` : base;
    });
    if (mediaLink) {
      mediaLink.href = item.id ? `../media/index.html?location=${encodeURIComponent(item.id)}` : "../media/index.html";
    }
    loadDestinationMedia(item);

    document.title = `DMZ Scuba | ${item.name || "Destination"}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute("content", `${item.summary || item.subtitle || "Explore this destination with DMZ Scuba."}`);
    }

    isDirty = false;
  }

  function showError(message) {
    if (errorPanel) errorPanel.hidden = false;
    setText(errorMessageEl, message || "We could not load this destination.");
  }

  function hideError() {
    if (errorPanel) errorPanel.hidden = true;
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

  function canWriteWithoutLogin() {
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  function updateAuthState() {
    const authed = Boolean(getToken()) || canWriteWithoutLogin();
    setAdminStatus(authed ? "Ready" : "Signed out", authed ? "ready" : "neutral");
    if (logoutButton) logoutButton.style.display = getToken() ? "inline-flex" : "none";
    if (editToggle) {
      const editing = document.body.classList.contains("dest-page-editing");
      editToggle.textContent = editing ? "Close Editor" : "Edit Page";
    }
  }

  function setAdminStatus(text, tone = "neutral") {
    if (!adminStatus) return;
    adminStatus.textContent = text;
    adminStatus.classList.remove("is-neutral", "is-ready", "is-saving", "is-saved", "is-error");
    adminStatus.classList.add(`is-${tone}`);
  }

  function buildLoginModal(onSuccess) {
    if (document.querySelector(".media-auth-modal")) return;
    const overlay = document.createElement("div");
    overlay.className = "media-edit-modal media-auth-modal";
    overlay.innerHTML = `
      <div class="media-edit-modal-card">
        <h3>DMZ Admin</h3>
        <p class="media-edit-modal-hint">Sign in to edit destination content.</p>
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
          const resp = await fetch(`${apiRoot}/api/admin/login`, {
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
          updateAuthState();
          close();
          if (typeof onSuccess === "function") onSuccess();
        } catch (error) {
          if (errorEl) errorEl.textContent = "Login request failed.";
        }
      });
    }
  }

  function normalizeImportedDestination(rawItem) {
    const imported = rawItem && typeof rawItem === "object" ? rawItem : {};
    const base = currentItem && typeof currentItem === "object" ? currentItem : {};
    const next = {
      ...base,
      ...imported,
      id: currentId || imported.id || base.id || "",
      lat: Number(imported.lat ?? base.lat ?? 0),
      lon: Number(imported.lon ?? base.lon ?? 0),
      tags: Array.isArray(imported.tags) ? imported.tags : (Array.isArray(base.tags) ? base.tags : []),
      bullets: Array.isArray(imported.bullets) ? imported.bullets : (Array.isArray(base.bullets) ? base.bullets : []),
      diveSites: Array.isArray(imported.diveSites) ? imported.diveSites : (Array.isArray(base.diveSites) ? base.diveSites : []),
      nonDiving: Array.isArray(imported.nonDiving) ? imported.nonDiving : (Array.isArray(base.nonDiving) ? base.nonDiving : []),
      perfectFor: Array.isArray(imported.perfectFor)
        ? imported.perfectFor
        : (Array.isArray(base.perfectFor) ? base.perfectFor : []),
      howItWorks: Array.isArray(imported.howItWorks)
        ? imported.howItWorks
        : (Array.isArray(base.howItWorks) ? base.howItWorks : []),
      diveSiteHighlights: Array.isArray(imported.diveSiteHighlights)
        ? imported.diveSiteHighlights
        : (Array.isArray(base.diveSiteHighlights) ? base.diveSiteHighlights : []),
      logisticsTips: Array.isArray(imported.logisticsTips)
        ? imported.logisticsTips
        : (Array.isArray(base.logisticsTips) ? base.logisticsTips : []),
      resort: {
        ...(base.resort || {}),
        ...(imported.resort || {}),
      },
      conditions:
        imported.conditions && typeof imported.conditions === "object"
          ? imported.conditions
          : (base.conditions && typeof base.conditions === "object" ? base.conditions : {}),
    };
    return next;
  }

  function applyImportedDestination(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Import JSON must be an object.");
    }
    const candidate = payload.item && typeof payload.item === "object" ? payload.item : payload;
    const imported = normalizeImportedDestination(candidate);
    currentItem = imported;
    render(imported);
    setEditMode(true);
    markDirty();
    setAdminStatus("Imported (unsaved)", "ready");
  }

  function buildImportModal(onApply) {
    if (document.querySelector(".media-import-modal")) return;
    const overlay = document.createElement("div");
    overlay.className = "media-edit-modal media-import-modal";
    overlay.innerHTML = `
      <div class="media-edit-modal-card">
        <h3>Import Destination JSON</h3>
        <p class="media-edit-modal-hint">Paste JSON or load a file, then apply and save.</p>
        <form class="media-edit-form">
          <label>JSON
            <textarea rows="12" placeholder='Paste {"item": {...}} or {...}' required></textarea>
          </label>
          <input type="file" accept=".json,application/json" />
          <p class="media-edit-modal-hint" data-error style="color: rgba(226, 27, 35, 0.85)"></p>
          <div class="media-edit-modal-actions">
            <button type="button" class="media-edit-cancel">Cancel</button>
            <button type="submit" class="media-edit-save">Apply Import</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const textarea = overlay.querySelector("textarea");
    const fileInput = overlay.querySelector('input[type="file"]');
    const errorEl = overlay.querySelector("[data-error]");
    const cancelBtn = overlay.querySelector(".media-edit-cancel");

    const close = () => overlay.remove();
    if (cancelBtn) cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    if (fileInput && textarea) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          textarea.value = text;
          if (errorEl) errorEl.textContent = "";
        } catch (error) {
          if (errorEl) errorEl.textContent = "Could not read selected file.";
        }
      });
    }

    if (form && textarea) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (errorEl) errorEl.textContent = "";
        const raw = textarea.value.trim();
        if (!raw) {
          if (errorEl) errorEl.textContent = "Paste JSON first.";
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          if (typeof onApply === "function") onApply(parsed);
          close();
        } catch (error) {
          if (errorEl) errorEl.textContent = "Invalid JSON format.";
        }
      });
    }
  }

  function markDirty() {
    isDirty = true;
  }

  function setListEditable(listEl, active) {
    if (!listEl) return;
    [...listEl.querySelectorAll("li")].forEach((li) => {
      if (active) li.setAttribute("contenteditable", "true");
      else li.removeAttribute("contenteditable");
    });
  }

  function setHighlightsEditable(active) {
    if (!diveSiteHighlightsEl) return;
    diveSiteHighlightsEl.querySelectorAll(".site-highlight-card").forEach((card) => {
      const title = card.querySelector("h3");
      const desc = card.querySelector("p");
      const existingDelete = card.querySelector(".dest-highlight-delete");
      if (active) {
        if (title) {
          title.setAttribute("contenteditable", "true");
          title.addEventListener("input", markDirty);
        }
        if (desc) {
          desc.setAttribute("contenteditable", "true");
          desc.addEventListener("input", markDirty);
        }
        if (!existingDelete) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "dest-highlight-delete";
          removeBtn.textContent = "Remove Card";
          removeBtn.addEventListener("click", () => {
            if (!window.confirm("Remove this highlight card?")) return;
            card.remove();
            markDirty();
          });
          card.appendChild(removeBtn);
        }
      } else {
        if (title) title.removeAttribute("contenteditable");
        if (desc) desc.removeAttribute("contenteditable");
        if (existingDelete) existingDelete.remove();
      }
    });
  }

  function bindListDeleteButtons() {
    document.querySelectorAll(".dest-page-delete").forEach((btn) => btn.remove());
    if (!document.body.classList.contains("dest-page-editing")) return;
    const lists = [bulletsEl, diveSitesEl, nonDivingEl, conditionsEl, perfectForEl, howItWorksEl];
    lists.forEach((list) => {
      if (!list) return;
      [...list.querySelectorAll("li")].forEach((li) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dest-page-delete";
        btn.textContent = "Remove";
        btn.addEventListener("click", () => {
          const text = String(li.textContent || "").trim();
          if (text && !window.confirm("Remove this item?")) return;
          li.remove();
          markDirty();
        });
        li.appendChild(btn);
      });
    });
  }

  function setEditMode(active) {
    document.body.classList.toggle("dest-page-editing", Boolean(active));
    const editables = [
      nameEl, subtitleEl, heroWhyEl,
      narrativeEl, summaryEl, experienceEl, seasonalityEl, logisticsEl,
      isoTitleEl, isoDescEl,
      dayToDayEl, resortNameEl, resortDescEl, resortDetailsEl,
      vibeTextEl, mediaStatusEl,
    ];
    editables.forEach((el) => {
      if (!el) return;
      if (active) el.setAttribute("contenteditable", "true");
      else el.removeAttribute("contenteditable");
    });

    [bulletsEl, diveSitesEl, nonDivingEl, conditionsEl, perfectForEl, howItWorksEl].forEach((list) => {
      setListEditable(list, active);
    });
    setHighlightsEditable(active);

    addButtons.forEach((btn) => {
      btn.style.display = active ? "inline-flex" : "none";
    });
    if (addHighlightButton) {
      addHighlightButton.style.display = active ? "inline-flex" : "none";
    }

    bindListDeleteButtons();
    updateAuthState();
  }

  function addListItem(targetId) {
    const list = document.getElementById(targetId);
    if (!list) return;
    const li = document.createElement("li");
    li.textContent = "New item";
    li.setAttribute("contenteditable", "true");
    list.appendChild(li);
    bindListDeleteButtons();
    markDirty();
  }

  async function saveDestination() {
    if (!currentItem || !currentId) return;
    if (!getToken() && !canWriteWithoutLogin()) {
      buildLoginModal(() => saveDestination());
      return;
    }

    const conditions = parseConditionsFromList();
    const next = {
      ...currentItem,
      id: currentId,
      name: readText(nameEl),
      subtitle: readText(subtitleEl),
      heroWhy: readText(heroWhyEl),
      narrative: readText(narrativeEl),
      summary: readText(summaryEl),
      experience: readText(experienceEl),
      seasonality: readText(seasonalityEl),
      logistics: readText(logisticsEl),
      heroImage: normalizeImageUrl(heroInput ? heroInput.value : currentItem.heroImage),
      isoImage: normalizeImageUrl(isoInput ? isoInput.value : currentItem.isoImage),
      isoTitle: readText(isoTitleEl),
      isoDesc: readText(isoDescEl),
      dayToDay: readText(dayToDayEl),
      resort: {
        ...(currentItem.resort || {}),
        name: readText(resortNameEl),
        description: readText(resortDescEl),
      },
      resortDetails: readText(resortDetailsEl),
      vibe: readText(vibeTextEl),
      mediaStatus: readText(mediaStatusEl),
      bullets: readList(bulletsEl),
      diveSites: readList(diveSitesEl),
      nonDiving: readList(nonDivingEl),
      diveSiteHighlights: readHighlights(),
      perfectFor: readList(perfectForEl),
      howItWorks: readList(howItWorksEl),
      tags: readList(perfectForEl),
      conditions,
      lat: Number(currentItem.lat || 0),
      lon: Number(currentItem.lon || 0),
    };

    setAdminStatus("Saving...", "saving");
    const putResp = await apiFetch(`${apiAdminByIdUrl}${encodeURIComponent(currentId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: next }),
    });

    if (!putResp.ok) {
      const err = await putResp.json().catch(() => ({}));
      setAdminStatus(`Save failed (${putResp.status})`, "error");
      window.alert(`Save failed (${putResp.status}). ${err.details || err.error || "Unknown error"}`);
      return;
    }

    const verifyResp = await fetch(`${apiByIdUrl}${encodeURIComponent(currentId)}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    }).catch(() => null);
    if (!verifyResp || !verifyResp.ok) {
      setAdminStatus("Saved, verify failed", "error");
      window.alert("Saved, but verify read failed. Refresh and check content.");
      return;
    }

    const verifyJson = await verifyResp.json().catch(() => ({}));
    if (!verifyJson || !verifyJson.item || verifyJson.item.id !== currentId) {
      setAdminStatus("Saved, verify failed", "error");
      window.alert("Saved, but verify payload was invalid.");
      return;
    }

    currentItem = verifyJson.item;
    render(currentItem);
    setAdminStatus("Saved", "saved");
    setEditMode(false);
  }

  async function loadDestination() {
    const params = new URLSearchParams(window.location.search);
    currentId = String(params.get("id") || params.get("destination") || "").trim().toLowerCase();

    if (!currentId) {
      showError("Pick a destination to see full trip details.");
      return;
    }

    hideError();
    const resp = await fetch(`${apiByIdUrl}${encodeURIComponent(currentId)}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    }).catch(() => null);

    if (!resp || !resp.ok) {
      const status = resp ? resp.status : "network";
      showError(`Destination API load failed (id=${currentId}, status=${status}). URL: ${apiByIdUrl}${currentId}`);
      return;
    }

    const json = await resp.json().catch(() => ({}));
    const item = json && json.item ? json.item : null;
    if (!item || !item.id) {
      showError(`Destination API returned no item for id=${currentId}.`);
      return;
    }

    currentItem = item;
    render(item);
  }

  function setupAdminControls() {
    updateAuthState();
    setEditMode(false);

    if (adminFab) {
      adminFab.addEventListener("click", () => {
        document.body.classList.add("dest-page-admin-open");
        if (getToken() || canWriteWithoutLogin()) {
          setEditMode(true);
        }
      });
    }
    if (adminClose) {
      adminClose.addEventListener("click", () => {
        document.body.classList.remove("dest-page-admin-open");
      });
    }

    if (editToggle) {
      editToggle.addEventListener("click", () => {
        if (!getToken() && !canWriteWithoutLogin()) {
          buildLoginModal(() => {
            document.body.classList.add("dest-page-admin-open");
            setEditMode(true);
          });
          return;
        }
        const next = !document.body.classList.contains("dest-page-editing");
        setEditMode(next);
      });
    }

    if (importButton) {
      importButton.addEventListener("click", () => {
        if (!getToken() && !canWriteWithoutLogin()) {
          buildLoginModal(() => {
            document.body.classList.add("dest-page-admin-open");
            setEditMode(true);
            buildImportModal(applyImportedDestination);
          });
          return;
        }
        setEditMode(true);
        buildImportModal(applyImportedDestination);
      });
    }

    if (saveButton) saveButton.addEventListener("click", saveDestination);
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        if (isDirty && !window.confirm("Discard changes and reload?")) return;
        window.location.reload();
      });
    }
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        setToken("");
        updateAuthState();
      });
    }
    if (loginButton) {
      loginButton.addEventListener("click", () => {
        buildLoginModal(() => {
          document.body.classList.add("dest-page-admin-open");
          setEditMode(true);
          updateAuthState();
        });
      });
    }

    if (heroInput) {
      heroInput.addEventListener("input", () => {
        setHeroImage(heroInput.value);
        markDirty();
      });
    }
    if (isoInput) {
      isoInput.addEventListener("input", () => {
        renderIso({ ...(currentItem || {}), isoImage: isoInput.value, name: readText(nameEl) });
        markDirty();
      });
    }

    addButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-list");
        if (target) addListItem(target);
      });
    });

    if (addHighlightButton) {
      addHighlightButton.addEventListener("click", () => {
        if (!document.body.classList.contains("dest-page-editing")) return;
        if (!diveSiteHighlightsEl) return;
        const card = document.createElement("article");
        card.className = "site-highlight-card";
        const title = document.createElement("h3");
        title.textContent = "New Dive Site";
        const desc = document.createElement("p");
        desc.textContent = "Add highlight summary.";
        card.append(title, desc);
        diveSiteHighlightsEl.appendChild(card);
        setHighlightsEditable(true);
        markDirty();
      });
    }

    const trackDirty = [
      nameEl, subtitleEl, heroWhyEl, narrativeEl, summaryEl, experienceEl, seasonalityEl,
      logisticsEl, isoTitleEl, isoDescEl, dayToDayEl, resortNameEl, resortDescEl,
      resortDetailsEl, vibeTextEl, mediaStatusEl,
      bulletsEl, diveSitesEl, nonDivingEl, conditionsEl, perfectForEl, howItWorksEl,
    ];
    trackDirty.forEach((el) => {
      if (!el) return;
      el.addEventListener("input", markDirty);
    });

    if (retryButton) retryButton.addEventListener("click", () => loadDestination());
  }

  setupAdminControls();
  loadDestination();
})();
