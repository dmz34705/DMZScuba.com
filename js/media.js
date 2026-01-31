(() => {
  const dataUrl = "../../assets/data/media.json";
  const apiBase = (document.body && document.body.dataset.mediaApi) || "";
  const apiUrl = apiBase ? `${apiBase}/api/media` : "/api/media";
  const mediaGrid = document.getElementById("mediaGrid");
  const photoGrid = document.getElementById("photoGrid");
  const mediaSection = mediaGrid ? mediaGrid.closest(".section.media-wide") : null;
  const chips = document.querySelectorAll(".chip[data-filter]");
  const searchInput = document.getElementById("mediaSearch");
  const tagFilter = document.querySelector("[data-role='tag-filter']");
  const tagToggle = tagFilter ? tagFilter.querySelector(".filter-toggle") : null;
  const tagPanel = tagFilter ? tagFilter.querySelector(".filter-panel") : null;
  const tagList = tagFilter ? tagFilter.querySelector(".filter-list") : null;
  const tagClear = tagFilter ? tagFilter.querySelector(".filter-clear") : null;
  const tagCount = tagFilter ? tagFilter.querySelector(".filter-count") : null;
  const locationFilter = document.querySelector("[data-role='location-filter']");
  const locationToggle = locationFilter ? locationFilter.querySelector(".filter-toggle") : null;
  const locationPanel = locationFilter ? locationFilter.querySelector(".filter-panel") : null;
  const locationList = locationFilter ? locationFilter.querySelector(".filter-list") : null;
  const locationClear = locationFilter ? locationFilter.querySelector(".filter-clear") : null;
  const locationSelection = locationFilter ? locationFilter.querySelector(".filter-selection") : null;
  const resultsCount = document.getElementById("mediaResultsCount");
  const clearFiltersButton = document.getElementById("mediaClearFilters");
  const emptyState = document.getElementById("mediaEmpty");
  const cardSizeInput = document.getElementById("mediaCardSize");
  const cardSizeValue = document.getElementById("mediaCardSizeValue");
  const sortField = document.querySelector(".media-sort");
  const sortToggle = sortField ? sortField.querySelector(".dropdown-toggle") : null;
  const sortValue = document.getElementById("mediaSortValue");
  const sortPanel = sortField ? sortField.querySelector(".dropdown-panel") : null;
  const sortOptions = sortField ? sortField.querySelectorAll(".dropdown-option") : null;
  const storageKey = "dmzMediaDraft";
  const cardSizeStorageKey = "dmzMediaCardSize";
  const selectedTags = new Set();
  const urlParams = new URLSearchParams(window.location.search);
  const locationParamRaw = urlParams.get("location") || "";
  const locationParamNormalized = normalizeKey(locationParamRaw);
  let selectedLocationId = "";
  let searchQuery = "";
  let locationNameById = new Map();
  let locationKeys = new Set();
  let currentSort = "manual";
  let shuffleOrder = null;
  const state = {
    mediaItems: [],
    photoItems: [],
    destinations: [],
  };

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

  function ensureYoutubeModal() {
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
    const modal = ensureYoutubeModal();
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
    const modal = ensureYoutubeModal();
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
    iframe.allow = options.allow || "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    target.appendChild(iframe);
    queueMasonryUpdate();
  }

  function setAspectRatio(el, width, height) {
    if (!el || !width || !height) return;
    const ratio = width / height;
    const aspectValue = `${width} / ${height}`;
    el.style.setProperty("--media-ratio", aspectValue);
    el.style.aspectRatio = aspectValue;
    el.dataset.aspect = String(height / width);
    if (ratio < 0.9) {
      el.classList.add("is-vertical");
      el.classList.remove("is-horizontal");
    } else {
      el.classList.remove("is-vertical");
      el.classList.add("is-horizontal");
    }
  }

  function updateThumbHeights() {
    if (!mediaGrid) return;
    mediaGrid.querySelectorAll(".media-thumb[data-aspect]").forEach((thumb) => {
      const aspect = parseFloat(thumb.dataset.aspect || "");
      if (!aspect) return;
      const width = thumb.getBoundingClientRect().width;
      if (!width) return;
      const height = `${Math.round(width * aspect)}px`;
      thumb.style.setProperty("--media-height", height);
      thumb.style.setProperty("height", height, "important");
    });
  }

  function hydrateVideoAspects() {
    if (!mediaGrid) return;
    mediaGrid.querySelectorAll(".media-thumb-video").forEach((video) => {
      const thumb = video.closest(".media-thumb");
      if (!thumb || thumb.dataset.aspect) return;
      if (!video.videoWidth || !video.videoHeight) return;
      setAspectRatio(thumb, video.videoWidth, video.videoHeight);
      updateThumbHeights();
    });
  }

  function applyVideoAspect(video, target) {
    if (!video || !target) return;
    if (!video.videoWidth || !video.videoHeight) return;
    setAspectRatio(target, video.videoWidth, video.videoHeight);
    const width = target.getBoundingClientRect().width;
    if (width) {
      const height = `${Math.round(width * (video.videoHeight / video.videoWidth))}px`;
      target.style.setProperty("--media-height", height);
      target.style.setProperty("height", height, "important");
    }
    updateThumbHeights();
    queueMasonryUpdate();
  }

  function captureVideoPoster(video, target) {
    if (!video || video.poster || video.dataset.posterCaptured === "true") return;
    if (!video.videoWidth || !video.videoHeight) return;
    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        video.poster = dataUrl;
        setAspectRatio(target, canvas.width, canvas.height);
        queueMasonryUpdate();
        video.dataset.posterCaptured = "true";
      } catch (error) {
        console.warn("Video poster capture failed.", error);
      }
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    try {
      const seekTime = Math.min(0.1, Math.max(0, (video.duration || 1) - 0.01));
      video.currentTime = seekTime;
    } catch (error) {
      // Ignore seek errors; video might not be ready yet.
    }
  }

  let masonryRafId = 0;

  function queueMasonryUpdate() {
    if (!mediaGrid) return;
    if (masonryRafId) {
      cancelAnimationFrame(masonryRafId);
    }
    masonryRafId = requestAnimationFrame(() => {
      masonryRafId = 0;
      updateMasonry();
    });
  }

  function updateMasonry() {
    if (!mediaGrid) return;
    const styles = window.getComputedStyle(mediaGrid);
    const rowHeight = parseFloat(styles.getPropertyValue("grid-auto-rows"));
    const rowGap = parseFloat(styles.getPropertyValue("row-gap")) || 0;
    if (!rowHeight) return;
    hydrateVideoAspects();
    updateThumbHeights();
    mediaGrid.querySelectorAll(".media-card").forEach((card) => {
      if (card.style.display === "none") return;
      card.style.gridRowEnd = "span 1";
      const cardHeight = card.scrollHeight;
      if (!cardHeight) return;
      const span = Math.max(1, Math.ceil((cardHeight + rowGap) / (rowHeight + rowGap)));
      card.style.gridRowEnd = `span ${span}`;
    });
    updateMediaGridWidth();
    updateMediaControlsWidth();
  }

  function updateMediaGridWidth() {
    if (!mediaGrid || !mediaSection) return;
    const cards = [...mediaGrid.querySelectorAll(".media-card")].filter(
      (card) => card.style.display !== "none"
    );
    if (!cards.length) {
      mediaSection.style.removeProperty("--media-grid-width");
      return;
    }
    const rects = cards.map((card) => card.getBoundingClientRect());
    const minTop = Math.min(...rects.map((rect) => rect.top));
    const rowRects = rects.filter((rect) => Math.abs(rect.top - minTop) < 2);
    if (!rowRects.length) return;
    const minLeft = Math.min(...rowRects.map((rect) => rect.left));
    const maxRight = Math.max(...rowRects.map((rect) => rect.right));
    const width = Math.round(maxRight - minLeft);
    if (width > 0) {
      mediaSection.style.setProperty("--media-grid-width", `${width}px`);
    }
  }

  function updateMediaControlsWidth() {
    if (!mediaGrid || !mediaSection) return;
    const styles = window.getComputedStyle(mediaGrid);
    const gap = parseFloat(styles.getPropertyValue("column-gap") || styles.getPropertyValue("gap")) || 0;
    const gridWidth = mediaGrid.getBoundingClientRect().width;
    if (!gridWidth) return;
    const maxSize = Number(cardSizeInput && cardSizeInput.max) || 380;
    const columns = Math.max(1, Math.floor((gridWidth + gap) / (maxSize + gap)));
    const width = Math.round(columns * maxSize + Math.max(0, columns - 1) * gap);
    if (width > 0) {
      mediaSection.style.setProperty("--media-controls-width", `${width}px`);
    }
  }

  let videoThumbObserver = null;

  function setupVideoThumbObserver() {
    if (!mediaGrid || !("IntersectionObserver" in window)) return;
    if (videoThumbObserver) {
      videoThumbObserver.disconnect();
    }
    videoThumbObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const thumb = entry.target;
          videoThumbObserver.unobserve(thumb);
          prefetchVideoThumb(thumb);
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.1 }
    );
    mediaGrid
      .querySelectorAll(".media-thumb.is-video[data-video-src]:not([data-thumb-loaded])")
      .forEach((thumb) => videoThumbObserver.observe(thumb));
  }

  function prefetchVideoThumb(thumb) {
    if (!thumb || thumb.dataset.thumbLoading === "true" || thumb.dataset.thumbLoaded === "true") return;
    const src = thumb.dataset.videoSrc;
    if (!src) return;
    thumb.dataset.thumbLoading = "true";

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const source = document.createElement("source");
    source.src = src;
    source.type = "video/mp4";
    video.appendChild(source);

    const cleanup = () => {
      try {
        video.pause();
      } catch (error) {
        // Ignore cleanup errors.
      }
      video.removeAttribute("src");
      while (video.firstChild) {
        video.removeChild(video.firstChild);
      }
      video.load();
    };

    const capture = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      setAspectRatio(thumb, video.videoWidth, video.videoHeight);
      const onSeeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          thumb.querySelectorAll(".media-thumb-faux, .media-thumb-img").forEach((el) => el.remove());
          const img = document.createElement("img");
          img.className = "media-thumb-img";
          img.src = dataUrl;
          img.alt = thumb.dataset.videoTitle ? `${thumb.dataset.videoTitle} thumbnail` : "Video thumbnail";
          img.loading = "lazy";
          img.decoding = "async";
          thumb.appendChild(img);
          thumb.classList.add("has-thumb");
          updateThumbHeights();
          queueMasonryUpdate();
          thumb.dataset.thumbLoaded = "true";
          thumb.dataset.thumbLoading = "false";
          cleanup();
        } catch (error) {
          thumb.dataset.thumbLoading = "false";
          cleanup();
        }
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      try {
        const seekTime = Math.min(0.1, Math.max(0, (video.duration || 1) - 0.01));
        video.currentTime = seekTime;
      } catch (error) {
        thumb.dataset.thumbLoading = "false";
        cleanup();
      }
    };

    video.addEventListener("loadedmetadata", capture, { once: true });
    video.addEventListener(
      "error",
      () => {
        thumb.dataset.thumbLoading = "false";
        cleanup();
      },
      { once: true }
    );
    video.load();
  }

  function renderMeta(metaItems, location, target) {
    const items = Array.isArray(metaItems) ? [...metaItems] : [];
    if (location && !items.some((entry) => entry.toLowerCase() === location.toLowerCase())) {
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

  function buildSearchText(item) {
    const parts = [
      item.title,
      item.description,
      item.location,
      item.badge,
      item.type,
      ...(item.tags || []),
      ...(item.meta || []),
    ];
    return parts
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function parseDateValue(item) {
    const raw = item && (item.createdAt || item.uploadedAt || item.date || item.uploadDate);
    if (!raw) return null;
    const timestamp = Date.parse(raw);
    if (Number.isFinite(timestamp)) return timestamp;
    return null;
  }

  function parseDurationValue(item) {
    const raw = item && (item.duration || item.length || item.durationSeconds);
    if (raw == null) return null;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const text = String(raw).trim();
    if (!text) return null;
    if (/^\d+$/.test(text)) return Number(text);
    const parts = text.split(":").map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  function parseViewsValue(item) {
    const raw = item && (item.views || item.viewCount);
    if (raw == null) return null;
    const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9]/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  function shuffleArray(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function buildIndexLookup(items) {
    const map = new Map();
    (items || []).forEach((item, index) => {
      if (!item || !item.id) return;
      map.set(item.id, index);
    });
    return map;
  }

  function applySort(items) {
    const list = Array.isArray(items) ? [...items] : [];
    if (currentSort === "manual") return list;
    if (currentSort === "shuffle") {
      const keys = list.map((item, index) => item.id || `__idx-${index}`);
      if (!shuffleOrder || shuffleOrder.length !== keys.length) {
        shuffleOrder = shuffleArray(keys);
      }
      const orderMap = new Map(shuffleOrder.map((key, index) => [key, index]));
      return list.sort((a, b) => {
        const aKey = a.id || "";
        const bKey = b.id || "";
        return (orderMap.get(aKey) ?? 0) - (orderMap.get(bKey) ?? 0);
      });
    }
    if (currentSort === "recent" || currentSort === "oldest") {
      return list.sort((a, b) => {
        const aVal = parseDateValue(a);
        const bVal = parseDateValue(b);
        const aScore = aVal == null ? -Infinity : aVal;
        const bScore = bVal == null ? -Infinity : bVal;
        return currentSort === "recent" ? bScore - aScore : aScore - bScore;
      });
    }
    if (currentSort === "views") {
      return list.sort((a, b) => {
        const aVal = parseViewsValue(a) ?? -Infinity;
        const bVal = parseViewsValue(b) ?? -Infinity;
        return bVal - aVal;
      });
    }
    if (currentSort === "duration") {
      return list.sort((a, b) => {
        const aVal = parseDurationValue(a) ?? -Infinity;
        const bVal = parseDurationValue(b) ?? -Infinity;
        return bVal - aVal;
      });
    }
    return list;
  }

  function renderMediaWithSort() {
    const indexLookup = buildIndexLookup(state.mediaItems);
    const displayItems = applySort(state.mediaItems);
    renderMedia(displayItems, indexLookup);
  }

  function renderMedia(items, indexLookup) {
    if (!mediaGrid) return;
    mediaGrid.innerHTML = "";

    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "media-card";
      card.setAttribute("data-tags", (item.tags || []).join(" "));
      card.setAttribute("data-location", normalizeKey(item.location || ""));
      const mappedIndex =
        indexLookup && item && item.id && indexLookup.has(item.id)
          ? indexLookup.get(item.id)
          : index;
      card.setAttribute("data-index", String(mappedIndex));
      card.setAttribute("data-search", buildSearchText(item));

      const mediaUrl = resolveUrl(item.url || "#");
      const youtubeId = getYouTubeId(mediaUrl);
      const streamId = item.streamId || getStreamIdFromUrl(mediaUrl);
      const isStream = item.type === "video" && !!streamId;
      const isYouTube = item.type === "video" && youtubeId;
      const isVideo = item.type === "video" && isVideoUrl(mediaUrl);
      const link = document.createElement(isVideo || isYouTube || isStream ? "div" : "a");
      link.className = "media-thumb media-link";
      if (!isVideo && !isYouTube && !isStream) {
        link.href = mediaUrl;
        link.target = "_blank";
        link.rel = "noopener";
      }

      if (isYouTube) {
        const thumbUrl = buildYouTubeThumb(youtubeId);
        const img = document.createElement("img");
        img.className = "media-thumb-img";
        img.src = thumbUrl;
        img.alt = item.title ? `${item.title} thumbnail` : "YouTube thumbnail";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("load", () => {
          setAspectRatio(link, img.naturalWidth, img.naturalHeight);
          updateThumbHeights();
          queueMasonryUpdate();
        });
        link.appendChild(img);
        link.classList.add("has-thumb", "is-youtube");
        addPlayOverlay(link);
        link.addEventListener("click", () => {
          mountInlineEmbed(link, {
            src: `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`,
            title: item.title || "YouTube video",
            allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          });
        });
      } else if (isStream) {
        const thumbUrl = item.thumbUrl ? resolveUrl(item.thumbUrl) : buildStreamThumb(streamId);
        if (thumbUrl) {
          const img = document.createElement("img");
          img.className = "media-thumb-img";
          img.src = thumbUrl;
          img.alt = item.title ? `${item.title} thumbnail` : "Video thumbnail";
          img.loading = "lazy";
          img.decoding = "async";
          img.addEventListener("load", () => {
            setAspectRatio(link, img.naturalWidth, img.naturalHeight);
            updateThumbHeights();
            queueMasonryUpdate();
          });
          link.appendChild(img);
          link.classList.add("has-thumb");
        } else {
          const faux = document.createElement("div");
          faux.className = "media-thumb-faux";
          faux.textContent = item.thumbText || "Video";
          link.appendChild(faux);
          setAspectRatio(link, 16, 9);
        }
        link.classList.add("is-video");
        addPlayOverlay(link);
        link.addEventListener("click", () => {
          mountInlineEmbed(link, {
            src: `https://iframe.videodelivery.net/${streamId}?autoplay=true`,
            title: item.title || "Cloudflare Stream video",
          });
        });
      } else if (isVideo) {
        const thumbUrl = item.thumbUrl ? resolveUrl(item.thumbUrl) : "";
        if (thumbUrl) {
          const img = document.createElement("img");
          img.className = "media-thumb-img";
          img.src = thumbUrl;
          img.alt = item.title ? `${item.title} thumbnail` : "Video thumbnail";
          img.loading = "lazy";
          img.decoding = "async";
          img.addEventListener("load", () => {
            setAspectRatio(link, img.naturalWidth, img.naturalHeight);
            updateThumbHeights();
            queueMasonryUpdate();
          });
          link.appendChild(img);
          link.classList.add("has-thumb");
        } else {
          const faux = document.createElement("div");
          faux.className = "media-thumb-faux";
          faux.textContent = item.thumbText || "Video";
          link.appendChild(faux);
          setAspectRatio(link, 16, 9);
          link.dataset.videoSrc = mediaUrl;
          link.dataset.videoTitle = item.title || "";
        }

        link.classList.add("is-video");
        addPlayOverlay(link);
        link.addEventListener("click", () => {
          if (link.dataset.videoLoaded === "true") return;
          link.dataset.videoLoaded = "true";
          link.innerHTML = "";
          const video = document.createElement("video");
          video.className = "media-thumb-video";
          video.controls = true;
          video.preload = "auto";
          video.playsInline = true;
          const source = document.createElement("source");
          source.src = mediaUrl;
          source.type = "video/mp4";
          video.appendChild(source);
          video.addEventListener("loadedmetadata", () => applyVideoAspect(video, link));
          video.addEventListener("loadeddata", () => applyVideoAspect(video, link));
          video.addEventListener("canplay", () => applyVideoAspect(video, link));
          if (!item.thumbUrl) {
            video.addEventListener("loadeddata", () => captureVideoPoster(video, link));
            video.addEventListener("canplay", () => captureVideoPoster(video, link));
          }
          link.appendChild(video);
          video.load();
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
          }
          queueMasonryUpdate();
        });
      } else if (item.thumbUrl) {
        const thumbUrl = resolveUrl(item.thumbUrl);
        const img = document.createElement("img");
        img.className = "media-thumb-img";
        img.src = thumbUrl;
        img.alt = item.title ? `${item.title} thumbnail` : "Media thumbnail";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("load", () => {
          setAspectRatio(link, img.naturalWidth, img.naturalHeight);
          updateThumbHeights();
          queueMasonryUpdate();
        });
        link.appendChild(img);
        link.classList.add("has-thumb");
      } else if (item.type === "photo" && isImageUrl(mediaUrl)) {
        const img = document.createElement("img");
        img.className = "media-thumb-img";
        img.src = mediaUrl;
        img.alt = item.title || "Photo";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("load", () => {
          setAspectRatio(link, img.naturalWidth, img.naturalHeight);
          updateThumbHeights();
          queueMasonryUpdate();
        });
        link.appendChild(img);
        link.classList.add("has-thumb");
      } else {
        const faux = document.createElement("div");
        faux.className = "media-thumb-faux";
        faux.textContent = item.thumbText || "Thumbnail";
        link.appendChild(faux);
      }

      const badge = document.createElement("span");
      badge.className = "media-badge";
      badge.textContent = item.badge || (item.type ? item.type.toUpperCase() : "MEDIA");

      const body = document.createElement("div");
      body.className = "media-body";

      const badgeRow = document.createElement("div");
      badgeRow.className = "media-badge-row";
      badgeRow.appendChild(badge);

      const title = document.createElement("h3");
      title.textContent = item.title || "Untitled";

      const description = document.createElement("p");
      description.textContent = item.description || "";
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

      card.appendChild(link);
      card.appendChild(body);
    mediaGrid.appendChild(card);
  });
    queueMasonryUpdate();
    setupVideoThumbObserver();
  }

  function scheduleVideoAspectRetry(attempts = 6) {
    if (attempts <= 0) return;
    setTimeout(() => {
      hydrateVideoAspects();
      updateMasonry();
      scheduleVideoAspectRetry(attempts - 1);
    }, 400);
  }

  function renderPhotos(items) {
    if (!photoGrid) return;
    photoGrid.innerHTML = "";

    items.forEach((item, index) => {
      const link = document.createElement("a");
      link.className = "photo";
      const photoUrl = resolveUrl(item.url || "#");
      link.href = photoUrl;
      link.target = "_blank";
      link.rel = "noopener";

      if (photoUrl !== "#" && isImageUrl(photoUrl)) {
        const img = document.createElement("img");
        img.className = "photo-img";
        img.src = photoUrl;
        img.alt = item.label || `Photo ${index + 1}`;
        img.loading = "lazy";
        img.decoding = "async";
        link.appendChild(img);
      } else {
        const faux = document.createElement("div");
        faux.className = "photo-faux";
        faux.textContent = item.label || `Photo ${index + 1}`;
        link.appendChild(faux);
      }
      photoGrid.appendChild(link);
    });
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function formatTagLabel(tag) {
    return tag
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function normalizeTag(tag) {
    return String(tag || "").trim().toLowerCase();
  }

  function updateTagCount() {
    if (!tagCount) return;
    const count = selectedTags.size;
    tagCount.textContent = String(count);
    tagCount.classList.toggle("is-hidden", count === 0);
  }

  function updateResultsCount() {
    if (!resultsCount && !emptyState) return;
    const cards = [...document.querySelectorAll("#mediaGrid .media-card:not(.media-edit-add)")];
    const visible = cards.filter((card) => card.style.display !== "none");
    if (resultsCount) {
      resultsCount.textContent = `${visible.length} of ${cards.length}`;
    }
    if (emptyState) {
      emptyState.classList.toggle("is-visible", visible.length === 0);
    }
  }

  function setCardSize(value) {
    if (!mediaGrid) return;
    const size = Math.max(200, Number(value) || 260);
    mediaGrid.style.setProperty("--media-card-min", `${size}px`);
    mediaGrid.style.setProperty("--media-card-max", `${size}px`);
    if (cardSizeValue) {
      cardSizeValue.textContent = `${size}px`;
    }
    if (cardSizeInput && String(cardSizeInput.value) !== String(size)) {
      cardSizeInput.value = String(size);
    }
    try {
      window.localStorage.setItem(cardSizeStorageKey, String(size));
    } catch (error) {
      // Ignore storage errors.
    }
    queueMasonryUpdate();
  }

  function loadCardSize() {
    const fallback = cardSizeInput ? Number(cardSizeInput.value) || 260 : 260;
    try {
      const stored = window.localStorage.getItem(cardSizeStorageKey);
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    } catch (error) {
      // Ignore storage errors.
    }
    return fallback;
  }

  function setTagPanelOpen(isOpen) {
    if (!tagPanel || !tagToggle) return;
    tagPanel.classList.toggle("is-open", isOpen);
    tagToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function isLocationTag(tagKey) {
    return locationKeys.has(tagKey);
  }

  function renderTagFilters(items) {
    if (!tagList) return;
    const tagMap = new Map();
    items.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (!normalized) return;
        if (isLocationTag(normalizeKey(tag))) return;
        if (!tagMap.has(normalized)) {
          tagMap.set(normalized, formatTagLabel(String(tag)));
        }
      });
    });

    const availableTags = new Set(tagMap.keys());
    selectedTags.forEach((tag) => {
      if (!availableTags.has(tag)) {
        selectedTags.delete(tag);
      }
    });

    tagList.innerHTML = "";
    const tags = [...tagMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    tags.forEach(([tag, label]) => {
      const item = document.createElement("label");
      item.className = "filter-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = tag;
      input.checked = selectedTags.has(tag);
      input.addEventListener("change", () => {
        if (input.checked) {
          selectedTags.add(tag);
        } else {
          selectedTags.delete(tag);
        }
        updateTagCount();
        applyActiveFilter();
      });
      const text = document.createElement("span");
      text.textContent = label;
      item.appendChild(input);
      item.appendChild(text);
      tagList.appendChild(item);
    });

    updateTagCount();
  }

  function updateLocationSelectionLabel() {
    if (!locationSelection) return;
    if (!selectedLocationId) {
      locationSelection.textContent = "All";
      return;
    }
    locationSelection.textContent = locationNameById.get(selectedLocationId) || "All";
  }

  function matchesLocationKey(locationKey, targetKey) {
    if (!locationKey || !targetKey) return false;
    return locationKey === targetKey || locationKey.includes(targetKey) || targetKey.includes(locationKey);
  }

  function renderLocationFilters(destinations) {
    if (!locationList) return;
    const map = new Map();
    (destinations || []).forEach((dest) => {
      if (!dest || !dest.name) return;
      const key = normalizeKey(dest.id || dest.name);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, String(dest.name).trim());
      }
    });
    locationNameById = new Map(map);
    locationKeys = new Set();
    locationNameById.forEach((name, key) => {
      locationKeys.add(normalizeKey(name));
      locationKeys.add(key);
    });

    const entries = [...locationNameById.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    if (!selectedLocationId && locationParamNormalized) {
      const match = entries.find(([key, label]) => {
        return normalizeKey(key) === locationParamNormalized || normalizeKey(label) === locationParamNormalized;
      });
      if (match) {
        selectedLocationId = match[0];
      }
    }

    locationList.innerHTML = "";
    entries.forEach(([key, label]) => {
      const item = document.createElement("label");
      item.className = "filter-item";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "locationFilter";
      input.value = key;
      input.checked = key === selectedLocationId;
      input.addEventListener("change", () => {
        if (input.checked) {
          selectedLocationId = key;
          updateLocationSelectionLabel();
          applyActiveFilter();
        }
      });
      const text = document.createElement("span");
      text.textContent = label;
      item.appendChild(input);
      item.appendChild(text);
      locationList.appendChild(item);
    });

    updateLocationSelectionLabel();
  }

  function matchesFilter(el, filter) {
    if (filter === "all") return true;
    const tags = (el.getAttribute("data-tags") || "").toLowerCase();
    return tags.includes(filter.toLowerCase());
  }

  function matchesSelectedTags(el) {
    if (!selectedTags.size) return true;
    const tags = (el.getAttribute("data-tags") || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return [...selectedTags].every((tag) => tags.includes(tag));
  }

  function matchesSelectedLocation(el) {
    if (!selectedLocationId) return true;
    const locationKey = normalizeKey(el.getAttribute("data-location") || "");
    const destName = locationNameById.get(selectedLocationId) || "";
    const destKey = normalizeKey(destName);
    return matchesLocationKey(locationKey, destKey);
  }

  function matchesSearch(el) {
    if (!searchQuery) return true;
    const haystack = (el.getAttribute("data-search") || "").toLowerCase();
    if (!haystack) return false;
    return searchQuery
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => haystack.includes(term));
  }

  function applyActiveFilter() {
    const active = document.querySelector(".chip.is-active");
    const filter = active ? active.getAttribute("data-filter") || "all" : "all";
    const items = document.querySelectorAll("#mediaGrid .media-card");
    items.forEach((card) => {
      const chipMatch = matchesFilter(card, filter);
      const tagMatch = matchesSelectedTags(card);
      const locationMatch = matchesSelectedLocation(card);
      const searchMatch = matchesSearch(card);
      card.style.display = chipMatch && tagMatch && locationMatch && searchMatch ? "" : "none";
    });
    updateResultsCount();
    updateMasonry();
    setupVideoThumbObserver();
  }

  function clearAllFilters() {
    selectedTags.clear();
    selectedLocationId = "";
    searchQuery = "";
    if (searchInput) {
      searchInput.value = "";
    }
    chips.forEach((chip) => {
      chip.classList.toggle("is-active", chip.getAttribute("data-filter") === "all");
    });
    if (tagList) {
      tagList.querySelectorAll("input[type='checkbox']").forEach((input) => {
        input.checked = false;
      });
    }
    if (locationList) {
      locationList.querySelectorAll("input[type='radio']").forEach((input) => {
        input.checked = false;
      });
    }
    updateTagCount();
    updateLocationSelectionLabel();
    setTagPanelOpen(false);
    if (locationPanel && locationToggle) {
      locationPanel.classList.remove("is-open");
      locationToggle.setAttribute("aria-expanded", "false");
    }
    applyActiveFilter();
  }

  function bindFilters() {
    if (chips.length) {
      chips.forEach((chip) => {
        chip.addEventListener("click", () => {
          chips.forEach((c) => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          applyActiveFilter();
        });
      });
    }

    if (tagToggle && tagPanel) {
      tagToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = tagPanel.classList.contains("is-open");
        setTagPanelOpen(!isOpen);
        if (locationPanel && locationToggle) {
          locationPanel.classList.remove("is-open");
          locationToggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    if (tagClear) {
      tagClear.addEventListener("click", () => {
        selectedTags.clear();
        if (tagList) {
          tagList.querySelectorAll("input[type='checkbox']").forEach((input) => {
            input.checked = false;
          });
        }
        updateTagCount();
        applyActiveFilter();
      });
    }

    if (locationToggle && locationPanel) {
      locationToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = locationPanel.classList.contains("is-open");
        locationPanel.classList.toggle("is-open", !isOpen);
        locationToggle.setAttribute("aria-expanded", !isOpen ? "true" : "false");
        setTagPanelOpen(false);
      });
    }

    if (locationClear) {
      locationClear.addEventListener("click", () => {
        selectedLocationId = "";
        if (locationList) {
          locationList.querySelectorAll("input[type='radio']").forEach((input) => {
            input.checked = false;
          });
        }
        updateLocationSelectionLabel();
        applyActiveFilter();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        applyActiveFilter();
      });
    }

    if (cardSizeInput) {
      cardSizeInput.addEventListener("input", () => {
        setCardSize(cardSizeInput.value);
      });
    }

    if (sortToggle && sortField) {
      sortToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = sortField.classList.contains("is-open");
        sortField.classList.toggle("is-open", !isOpen);
        sortToggle.setAttribute("aria-expanded", !isOpen ? "true" : "false");
      });
    }

    if (sortOptions && sortOptions.length) {
      sortOptions.forEach((option) => {
        option.addEventListener("click", () => {
          currentSort = option.getAttribute("data-sort") || "manual";
          shuffleOrder = null;
          if (sortValue) {
            sortValue.textContent = option.textContent || "Manual";
          }
          if (sortField && sortToggle) {
            sortField.classList.remove("is-open");
            sortToggle.setAttribute("aria-expanded", "false");
          }
          renderMediaWithSort();
          applyActiveFilter();
        });
      });
    }

    if (clearFiltersButton) {
      clearFiltersButton.addEventListener("click", () => {
        clearAllFilters();
      });
    }

    document.addEventListener("click", (event) => {
      if (tagFilter && !tagFilter.contains(event.target)) {
        setTagPanelOpen(false);
      }
      if (locationFilter && !locationFilter.contains(event.target)) {
        if (locationPanel) locationPanel.classList.remove("is-open");
        if (locationToggle) locationToggle.setAttribute("aria-expanded", "false");
      }
      if (sortField && !sortField.contains(event.target)) {
        sortField.classList.remove("is-open");
        if (sortToggle) sortToggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setTagPanelOpen(false);
        if (locationPanel) locationPanel.classList.remove("is-open");
        if (locationToggle) locationToggle.setAttribute("aria-expanded", "false");
        if (sortField) sortField.classList.remove("is-open");
        if (sortToggle) sortToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function loadDraft() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (error) {
      console.warn("Media draft load failed.", error);
      return null;
    }
  }

  async function fetchMediaData() {
    const [apiRes, fileRes, destRes] = await Promise.all([
      fetch(apiUrl, { cache: "no-store" }),
      fetch(dataUrl, { cache: "no-store" }),
      fetch("/assets/data/destinations.json", { cache: "no-store" }),
    ]);
    const mediaRes = apiRes.ok ? apiRes : fileRes;
    if (!mediaRes.ok) {
      throw new Error(`Failed to load media data (${mediaRes.status})`);
    }
    const data = await mediaRes.json();
    const destinations = destRes.ok ? await destRes.json() : [];
    return { data, destinations };
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Media draft save failed.", error);
    }
  }

  async function init() {
    try {
      const { data, destinations } = await fetchMediaData();
      const draft = loadDraft();
      state.mediaItems = (draft && draft.mediaItems) || data.mediaItems || [];
      state.mediaItems = state.mediaItems.map((item) => ensureItemId(item));
      state.photoItems = (draft && draft.photoItems) || data.photoItems || [];
      state.destinations = Array.isArray(destinations) ? destinations : [];
      renderMediaWithSort();
      renderLocationFilters(state.destinations);
      renderTagFilters(state.mediaItems);
      renderPhotos(state.photoItems);
      setCardSize(loadCardSize());
      bindFilters();
      applyActiveFilter();
      updateMasonry();
      scheduleVideoAspectRetry();
    } catch (error) {
      console.error("Media data load failed.", error);
    }
  }

  function ensureItemId(item) {
    if (!item) return item;
    if (item.id) return item;
    const id =
      (crypto && typeof crypto.randomUUID === "function" && crypto.randomUUID()) ||
      `media-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    item.id = id;
    return item;
  }

  window.DMZMedia = {
    getMediaItems() {
      return state.mediaItems;
    },
    getPhotoItems() {
      return state.photoItems;
    },
    setMediaItems(items) {
      state.mediaItems = Array.isArray(items) ? items : [];
      saveDraft();
      renderMediaWithSort();
      renderLocationFilters(state.destinations);
      renderTagFilters(state.mediaItems);
      applyActiveFilter();
    },
    addMediaItem(item) {
      const next = ensureItemId({ ...(item || {}) });
      state.mediaItems.push(next);
      saveDraft();
      renderMediaWithSort();
      renderLocationFilters(state.destinations);
      renderTagFilters(state.mediaItems);
      applyActiveFilter();
    },
    updateMediaItem(index, patch) {
      const item = state.mediaItems[index];
      if (!item) return;
      Object.assign(item, patch);
      saveDraft();
      const card = mediaGrid
        ? mediaGrid.querySelector(`.media-card[data-index="${index}"]`)
        : null;
      if (card) {
        card.setAttribute("data-search", buildSearchText(item));
      }
    },
    removeMediaItem(index) {
      state.mediaItems.splice(index, 1);
      saveDraft();
      renderMediaWithSort();
      renderLocationFilters(state.destinations);
      renderTagFilters(state.mediaItems);
      applyActiveFilter();
    },
    syncFromDom() {
      if (!mediaGrid) return;
      const cards = mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)");
      cards.forEach((card) => {
        const index = Number(card.getAttribute("data-index"));
        const item = state.mediaItems[index];
        if (!item) return;
        const title = card.querySelector(".media-body h3");
        const description = card.querySelector(".media-body p");
        if (title) {
          item.title = title.textContent.trim();
        }
        if (description) {
          item.description = description.textContent.trim();
        }
        const tags = (card.getAttribute("data-tags") || "")
          .split(" ")
          .map((tag) => tag.trim())
          .filter(Boolean);
        if (tags.length) {
          item.tags = tags;
        }
        card.setAttribute("data-search", buildSearchText(item));
      });
      saveDraft();
    },
    clearDraft() {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn("Media draft clear failed.", error);
      }
      window.location.reload();
    },
    applyActiveFilter,
    updateMasonry,
    resetHeights() {
      if (!mediaGrid) return;
      mediaGrid.querySelectorAll(".media-card").forEach((card) => {
        card.style.removeProperty("grid-row-end");
      });
      mediaGrid.querySelectorAll(".media-thumb").forEach((thumb) => {
        thumb.style.removeProperty("--media-height");
        thumb.style.removeProperty("height");
        thumb.dataset.aspect = "";
      });
      queueMasonryUpdate();
    },
    refresh() {
      renderMediaWithSort();
      renderLocationFilters(state.destinations);
      renderTagFilters(state.mediaItems);
      applyActiveFilter();
      queueMasonryUpdate();
    },
    setSort(sortKey) {
      currentSort = String(sortKey || "manual");
      shuffleOrder = null;
      if (sortOptions && sortOptions.length && sortValue) {
        const match = [...sortOptions].find(
          (option) => (option.getAttribute("data-sort") || "manual") === currentSort
        );
        sortValue.textContent = match ? match.textContent : "Manual";
      }
      renderMediaWithSort();
      applyActiveFilter();
    },
    async reloadFromServer() {
      const { data, destinations } = await fetchMediaData();
      state.mediaItems = (data.mediaItems || []).map((item) => ensureItemId(item));
      state.photoItems = data.photoItems || [];
      state.destinations = Array.isArray(destinations) ? destinations : [];
      renderMediaWithSort();
      renderLocationFilters(state.destinations);
      renderTagFilters(state.mediaItems);
      applyActiveFilter();
      updateMasonry();
      scheduleVideoAspectRetry();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if ("ResizeObserver" in window && mediaGrid) {
    const gridResizeObserver = new ResizeObserver(() => {
      queueMasonryUpdate();
    });
    gridResizeObserver.observe(mediaGrid);
  }

  window.addEventListener("resize", () => {
    queueMasonryUpdate();
  });

  window.addEventListener("load", () => {
    queueMasonryUpdate();
  });
})();
