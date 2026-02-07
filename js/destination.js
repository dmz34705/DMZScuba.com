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
  const logisticsTipsEl = document.getElementById("logisticsTipsList");
  const perfectForEl = document.getElementById("destPerfectFor");
  const howItWorksEl = document.getElementById("destHowItWorks");
  const highlightsEl = document.getElementById("diveSiteHighlights");

  const heroInput = document.getElementById("destEditHeroImage");
  const isoInput = document.getElementById("destEditIsoImage");

  const adminFab = document.querySelector(".dest-page-admin-fab");
  const adminPanel = document.getElementById("destPageAdminPanel");
  const adminClose = document.querySelector(".dest-page-admin-close");
  const adminStatus = document.getElementById("destPageAdminStatus");
  const loginButton = document.querySelector(".dest-page-login-button");
  const editToggle = document.querySelector(".dest-page-edit-toggle");
  const saveButton = document.querySelector(".dest-page-save");
  const cancelButton = document.querySelector(".dest-page-cancel");
  const logoutButton = document.querySelector(".dest-page-logout");
  const addButtons = document.querySelectorAll(".dest-page-add");

  const errorPanel = document.getElementById("destErrorPanel");
  const errorMessageEl = document.getElementById("destErrorMessage");
  const retryButton = document.getElementById("destRetryButton");

  const heroRoot = document.documentElement;
  const diveNowLinks = document.querySelectorAll(".dive-now-link");
  const mediaLink = document.getElementById("destMediaLink");
  const mediaApiUrl = apiRoot ? `${apiRoot}/api/media` : "/api/media";
  const mediaDataUrl = "/assets/data/media.json";

  let currentId = "";
  let currentItem = null;
  let isDirty = false;
  let mediaRequestId = 0;

  function setText(el, value) {
    if (el) el.textContent = String(value || "");
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
    return el ? String(el.textContent || "").trim() : "";
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
    return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(String(url || ""));
  }

  function isVideoUrl(url) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || ""));
  }

  function getYouTubeId(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "");
      }
      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.searchParams.get("v")) return parsed.searchParams.get("v") || "";
        const parts = parsed.pathname.split("/").filter(Boolean);
        const idx = parts.indexOf("embed");
        if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function getStreamIdFromUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, window.location.href);
      if (
        parsed.hostname.includes("videodelivery.net") ||
        parsed.hostname.includes("cloudflarestream.com") ||
        parsed.hostname.includes("iframe.videodelivery.net")
      ) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts[0]) return parts[0];
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function buildYouTubeThumb(id) {
    return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : "";
  }

  function buildStreamThumb(id) {
    return id ? `https://videodelivery.net/${id}/thumbnails/thumbnail.jpg?time=1s` : "";
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

  function createMediaCard(item, dest) {
    const card = document.createElement("article");
    card.className = "media-card";

    const mediaUrl = resolveUrl(item.url || "");
    const youtubeId = getYouTubeId(mediaUrl);
    const streamId = item.streamId || getStreamIdFromUrl(mediaUrl);
    const thumbUrl = getMediaThumbUrl(item, mediaUrl, youtubeId, streamId);

    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "media-thumb media-link";
    thumb.setAttribute("aria-label", item.title || "Open trip media");
    thumb.addEventListener("click", () => {
      if (mediaUrl) window.open(mediaUrl, "_blank", "noopener");
    });

    if (thumbUrl && isImageUrl(thumbUrl)) {
      const img = document.createElement("img");
      img.className = "media-thumb-img";
      img.src = thumbUrl;
      img.alt = item.title ? `${item.title} thumbnail` : "Trip media thumbnail";
      img.loading = "lazy";
      img.decoding = "async";
      thumb.appendChild(img);
      thumb.classList.add("has-thumb");
    } else {
      const faux = document.createElement("div");
      faux.className = "media-thumb-faux";
      faux.textContent = item.title || "Trip media";
      thumb.appendChild(faux);
    }

    const body = document.createElement("div");
    body.className = "media-body";
    const h3 = document.createElement("h3");
    h3.textContent = item.title || "Trip Media";
    const p = document.createElement("p");
    p.textContent = item.description || `Media from ${dest?.name || "this destination"}.`;
    body.append(h3, p);

    card.append(thumb, body);
    return card;
  }

  async function fetchMediaData() {
    const apiResp = await fetch(mediaApiUrl, { cache: "no-store" }).catch(() => null);
    if (apiResp && apiResp.ok) {
      return apiResp.json();
    }
    const fileResp = await fetch(`${mediaDataUrl}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    if (fileResp && fileResp.ok) {
      return fileResp.json();
    }
    throw new Error("Failed to load media data.");
  }

  async function loadDestinationMedia(dest) {
    if (!mediaGrid) return;
    const requestId = ++mediaRequestId;
    mediaGrid.innerHTML = "";
    if (mediaStatusEl) mediaStatusEl.textContent = "Loading trip clips...";
    if (mediaDots) mediaDots.hidden = true;
    if (mediaPrev) mediaPrev.hidden = true;
    if (mediaNext) mediaNext.hidden = true;

    try {
      const data = await fetchMediaData();
      if (requestId !== mediaRequestId) return;
      const mediaItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
      const photoItems = Array.isArray(data.photoItems) ? data.photoItems : [];
      const allItems = [...mediaItems, ...photoItems];
      const matches = filterDestinationMedia(allItems, dest).slice(0, 12);
      if (!matches.length) {
        if (mediaStatusEl) {
          mediaStatusEl.textContent =
            dest?.mediaStatus || "Trip clips coming soon. Follow DMZ or join the interest list to get first access.";
        }
        return;
      }
      matches.forEach((item) => {
        mediaGrid.appendChild(createMediaCard(item, dest));
      });
      if (mediaStatusEl) {
        mediaStatusEl.textContent = `Latest trip clips from ${dest?.name || "this destination"}.`;
      }
    } catch (error) {
      if (requestId !== mediaRequestId) return;
      if (mediaStatusEl) {
        mediaStatusEl.textContent =
          dest?.mediaStatus || "Trip clips unavailable right now. Check back soon.";
      }
    }
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
    setText(logisticsDetailsEl, item.logisticsDetails || item.logistics || "Logistics details loading.");

    setText(vibeTextEl, item.vibe || (item.whyItWorks && item.whyItWorks.vibe) || "The vibe details are loading.");
    setText(mediaStatusEl, item.mediaStatus || `Latest trip clips from ${item.name || "this destination"}.`);

    setList(bulletsEl, item.bullets || []);
    setList(diveSitesEl, item.diveSites || []);
    setList(nonDivingEl, item.nonDiving || []);
    setList(logisticsTipsEl, item.logisticsTips || []);
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
    return String(window.location.hostname || "").toLowerCase().endsWith(".pages.dev");
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

  function bindListDeleteButtons() {
    document.querySelectorAll(".dest-page-delete").forEach((btn) => btn.remove());
    if (!document.body.classList.contains("dest-page-editing")) return;
    const lists = [bulletsEl, diveSitesEl, nonDivingEl, conditionsEl, logisticsTipsEl, perfectForEl, howItWorksEl];
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
      dayToDayEl, resortNameEl, resortDescEl, resortDetailsEl, logisticsDetailsEl,
      vibeTextEl, mediaStatusEl,
    ];
    editables.forEach((el) => {
      if (!el) return;
      if (active) el.setAttribute("contenteditable", "true");
      else el.removeAttribute("contenteditable");
    });

    [bulletsEl, diveSitesEl, nonDivingEl, conditionsEl, logisticsTipsEl, perfectForEl, howItWorksEl].forEach((list) => {
      setListEditable(list, active);
    });

    addButtons.forEach((btn) => {
      btn.style.display = active ? "inline-flex" : "none";
    });

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
      logisticsDetails: readText(logisticsDetailsEl),
      vibe: readText(vibeTextEl),
      mediaStatus: readText(mediaStatusEl),
      bullets: readList(bulletsEl),
      diveSites: readList(diveSitesEl),
      nonDiving: readList(nonDivingEl),
      logisticsTips: readList(logisticsTipsEl),
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

    const trackDirty = [
      nameEl, subtitleEl, heroWhyEl, narrativeEl, summaryEl, experienceEl, seasonalityEl,
      logisticsEl, isoTitleEl, isoDescEl, dayToDayEl, resortNameEl, resortDescEl,
      resortDetailsEl, logisticsDetailsEl, vibeTextEl, mediaStatusEl,
      bulletsEl, diveSitesEl, nonDivingEl, conditionsEl, logisticsTipsEl, perfectForEl, howItWorksEl,
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
