(() => {
  const addCardTags = "video photo wreck reef training";
  const defaultAssetPath = "/assets/media/";
  const mediaTypePaths = {
    photo: "/assets/media/photos/",
    video: defaultAssetPath,
  };
  const thumbDefaultPath = "/assets/media/thumbnails/";
  const desktopDragQuery = window.matchMedia("(min-width: 981px)");
  const apiBase =
    (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const apiRoot = apiBase || "";
  const tokenStorageKey = "dmzMediaToken";
  const draftStorageKey = "dmzMediaDraft";
  let isDirty = false;
  let bannerTimer = null;
  const modalScrollState = {
    lockCount: 0,
    scrollY: 0,
  };
  const dragState = {
    card: null,
  };
  const uploadQueueState = {
    maxConcurrent: 3,
    active: 0,
    pending: [],
    sequence: 0,
  };
  const uploadCardStatusById = new Map();
  const uploadCardRenderState = {
    queued: false,
  };

  function lockModalScroll() {
    if (modalScrollState.lockCount === 0) {
      modalScrollState.scrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = "fixed";
      document.body.style.top = `-${modalScrollState.scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    modalScrollState.lockCount += 1;
  }

  function unlockModalScroll() {
    if (modalScrollState.lockCount <= 0) return;
    modalScrollState.lockCount -= 1;
    if (modalScrollState.lockCount > 0) return;
    const restoreY = modalScrollState.scrollY || 0;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo({ top: restoreY, behavior: "auto" });
  }

  function getToken() {
    return window.localStorage.getItem(tokenStorageKey) || "";
  }

  function setToken(token) {
    if (!token) {
      window.localStorage.removeItem(tokenStorageKey);
      return;
    }
    window.localStorage.setItem(tokenStorageKey, token);
  }

  function setDirty(next) {
    isDirty = Boolean(next);
    document.body.classList.toggle("media-has-unsaved", isDirty);
    if (isDirty) {
      showPublishBanner("Media not published. Please publish to save.", "warning");
    } else {
      hidePublishBanner();
    }
  }

  function markDirty() {
    setDirty(true);
  }

  function showPublishBanner(message, state = "warning", autoHideMs = null) {
    const banner = document.getElementById("mediaPublishBanner");
    if (!banner) return;
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
    banner.textContent = message;
    banner.classList.add("is-visible");
    if (state === "success") {
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
    const banner = document.getElementById("mediaPublishBanner");
    if (!banner) return;
    banner.classList.remove("is-visible");
  }

  async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${apiRoot}${path}`, { ...options, headers });
  }

  function reportTelemetry(eventType, details = {}) {
    if (!eventType) return;
    if (window.DMZTelemetry && typeof window.DMZTelemetry.report === "function") {
      window.DMZTelemetry.report(eventType, details);
      return;
    }
    const payload = {
      eventType: String(eventType),
      details: details && typeof details === "object" ? details : {},
      pageUrl: window.location.href,
      sentAt: new Date().toISOString(),
    };
    fetch(`${apiRoot}/api/client-telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }

  function buildTusMetadata(file) {
    const pairs = [];
    if (file && file.name) {
      pairs.push(`filename ${btoa(unescape(encodeURIComponent(file.name)))}`);
    }
    if (file && file.type) {
      pairs.push(`filetype ${btoa(file.type)}`);
    }
    return pairs.join(",");
  }

  function findMediaIndexById(id) {
    if (!id || !window.DMZMedia || typeof window.DMZMedia.getMediaItems !== "function") return -1;
    const items = window.DMZMedia.getMediaItems() || [];
    return items.findIndex((entry) => entry && entry.id === id);
  }

  function applyStreamUploadToMediaItem(itemId, streamId, thumbUrl = "") {
    if (!itemId || !streamId || !window.DMZMedia) return;
    const index = findMediaIndexById(itemId);
    if (index === -1) return;
    const items = window.DMZMedia.getMediaItems() || [];
    const current = items[index] || {};
    window.DMZMedia.updateMediaItem(index, {
      type: "video",
      url: "",
      streamId,
      thumbUrl: current.thumbUrl || thumbUrl || buildStreamThumbUrl(streamId),
    });
    if (typeof window.DMZMedia.setMediaItems === "function") {
      window.DMZMedia.setMediaItems(window.DMZMedia.getMediaItems());
    }
    markDirty();
  }

  function getUploadCardStatusLabel(status) {
    const state = status && status.state ? status.state : "";
    const progress = typeof status?.progress === "number" ? Math.max(0, Math.min(100, status.progress)) : 0;
    if (status && status.label) return status.label;
    if (state === "uploading") return `Uploading ${progress}%`;
    if (state === "queued") return "Queued";
    if (state === "retrying") return "Retrying";
    if (state === "complete") return "Uploaded";
    if (state === "failed") return "Upload failed";
    return "Uploading";
  }

  function renderUploadCardIndicators(mediaGrid) {
    if (!mediaGrid) return;
    mediaGrid.querySelectorAll(".media-upload-thumb-status").forEach((node) => node.remove());
    if (!document.body.classList.contains("media-edit-mode")) return;
    if (!window.DMZMedia || typeof window.DMZMedia.getMediaItems !== "function") return;
    const items = window.DMZMedia.getMediaItems() || [];
    const cards = mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)");
    cards.forEach((card) => {
      const index = Number(card.getAttribute("data-index"));
      if (!Number.isFinite(index) || index < 0) return;
      const item = items[index];
      if (!item || !item.id) return;
      const status = uploadCardStatusById.get(item.id);
      if (!status) return;
      const thumb = card.querySelector(".media-thumb");
      if (!thumb) return;
      const state = status.state || "uploading";
      const progress =
        typeof status.progress === "number" ? Math.max(0, Math.min(100, status.progress)) : 0;
      const indicator = document.createElement("div");
      indicator.className = `media-upload-thumb-status is-${state}`;
      const label = document.createElement("span");
      label.className = "media-upload-thumb-label";
      label.textContent = getUploadCardStatusLabel(status);
      const track = document.createElement("span");
      track.className = "media-upload-thumb-track";
      const fill = document.createElement("span");
      fill.className = "media-upload-thumb-fill";
      fill.style.width = `${state === "queued" ? 8 : progress}%`;
      track.appendChild(fill);
      indicator.appendChild(label);
      indicator.appendChild(track);
      thumb.appendChild(indicator);
    });
  }

  function scheduleUploadCardStatusRender() {
    if (uploadCardRenderState.queued) return;
    uploadCardRenderState.queued = true;
    requestAnimationFrame(() => {
      uploadCardRenderState.queued = false;
      renderUploadCardIndicators(document.getElementById("mediaGrid"));
    });
  }

  function setUploadCardStatus(itemId, nextStatus) {
    if (!itemId || !nextStatus) return;
    const current = uploadCardStatusById.get(itemId) || {};
    uploadCardStatusById.set(itemId, { ...current, ...nextStatus });
    scheduleUploadCardStatusRender();
  }

  function clearUploadCardStatus(itemId) {
    if (!itemId) return;
    if (!uploadCardStatusById.has(itemId)) return;
    uploadCardStatusById.delete(itemId);
    scheduleUploadCardStatusRender();
  }

  let tusClientPromise = null;

  function ensureTusClient() {
    if (window.tus && typeof window.tus.Upload === "function") {
      return Promise.resolve(window.tus);
    }
    if (tusClientPromise) return tusClientPromise;
    tusClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/tus-js-client@latest/dist/tus.js";
      script.async = true;
      script.onload = () => resolve(window.tus || null);
      script.onerror = () => reject(new Error("Unable to load resumable upload support"));
      document.head.appendChild(script);
    });
    return tusClientPromise;
  }

  async function uploadFileToStream(file, callbacks = {}) {
    const onStatus = typeof callbacks.onStatus === "function" ? callbacks.onStatus : () => {};
    const onProgress =
      typeof callbacks.onProgress === "function" ? callbacks.onProgress : () => {};
    onStatus("starting");
    onProgress(0);

    await ensureTusClient().catch(() => null);
    let uploadedUid = "";
    const useTus = Boolean(window.tus && typeof window.tus.Upload === "function");
    let tusCompleted = false;

    if (useTus) {
      try {
        const resp = await apiFetch("/api/admin/stream-tus-upload", {
          method: "POST",
          headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": String(file.size),
            "Upload-Metadata": buildTusMetadata(file),
          },
        });
        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`Resumable init failed (${resp.status}). ${errorText || ""}`.trim());
        }
        const data = await resp.json();
        const uploadUrl = data?.uploadURL;
        uploadedUid = data?.uid || "";
        if (!uploadUrl) throw new Error("Missing upload URL");
        onStatus("uploading");
        await new Promise((resolve, reject) => {
          const upload = new window.tus.Upload(file, {
            uploadUrl,
            chunkSize: 50 * 1024 * 1024,
            retryDelays: [0, 1000, 3000, 5000, 8000],
            onProgress(bytesSent, bytesTotal) {
              if (!bytesTotal) return;
              const percent = Math.min(100, Math.round((bytesSent / bytesTotal) * 100));
              onProgress(percent);
            },
            onError(error) {
              reject(error);
            },
            onSuccess() {
              resolve();
            },
          });
          upload.start();
        });
        tusCompleted = true;
      } catch (error) {
        console.error("Tus upload failed", error);
        reportTelemetry("media_upload_tus_failed", {
          reason: String((error && error.message) || "unknown"),
          fileName: file && file.name ? file.name : "",
          fileSize: file && Number.isFinite(file.size) ? file.size : 0,
        });
        onStatus("fallback");
      }
    }

    if (!tusCompleted) {
      const resp = await apiFetch("/api/admin/stream-direct-upload", { method: "POST" });
      const data = await resp.json();
      const uploadUrl = data?.result?.uploadURL;
      uploadedUid = uploadedUid || data?.result?.uid || "";
      if (!uploadUrl) throw new Error("Missing upload URL");
      onStatus("uploading");
      const formData = new FormData();
      formData.append("file", file);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl, true);
        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
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
    }

    if (!uploadedUid) throw new Error("Missing Stream ID after upload.");
    onProgress(100);
    onStatus("complete");
    return {
      streamId: uploadedUid,
      thumbUrl: buildStreamThumbUrl(uploadedUid),
    };
  }

  function runUploadQueue() {
    while (uploadQueueState.active < uploadQueueState.maxConcurrent && uploadQueueState.pending.length) {
      const task = uploadQueueState.pending.shift();
      if (!task) break;
      uploadQueueState.active += 1;
      const onDone = () => {
        uploadQueueState.active = Math.max(0, uploadQueueState.active - 1);
        runUploadQueue();
      };
      uploadFileToStream(task.file, {
        onStatus: task.onStatus,
        onProgress: task.onProgress,
      })
        .then((result) => {
          if (typeof task.onComplete === "function") {
            task.onComplete(result);
          }
        })
        .catch((error) => {
          console.error("Queued Stream upload failed", error);
          reportTelemetry("media_upload_queue_failed", {
            reason: String((error && error.message) || "unknown"),
            taskId: task && task.id ? task.id : "",
            fileName: task && task.file && task.file.name ? task.file.name : "",
          });
          if (typeof task.onError === "function") {
            task.onError(error);
          }
        })
        .finally(onDone);
    }
  }

  function enqueueStreamUploadTask(task) {
    if (!task || !task.file) return null;
    const queuedTask = {
      ...task,
      id: `stream-upload-${Date.now()}-${uploadQueueState.sequence++}`,
    };
    uploadQueueState.pending.push(queuedTask);
    runUploadQueue();
    return queuedTask.id;
  }

  function ensureId(item) {
    if (!item) return item;
    if (item.id) return item;
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      item.id = window.crypto.randomUUID();
    } else {
      item.id = `media-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    return item;
  }

  function buildLoginModal(_onSuccess) {
    window.location.href = "/management/?redirect=" + encodeURIComponent(window.location.href);
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

  function buildStreamThumbUrl(id) {
    if (!id) return "";
    return `https://videodelivery.net/${id}/thumbnails/thumbnail.jpg?time=1s`;
  }

  function formatDateForInput(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  function normalizeDateInput(value) {
    if (!value) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    const withTime = raw.includes("T") ? raw : `${raw}T00:00:00`;
    const parsed = new Date(withTime);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString();
  }

  function renderMetaLine(metaEl, metaItems, location) {
    const items = Array.isArray(metaItems) ? [...metaItems] : [];
    if (location && !items.some((entry) => entry.toLowerCase() === location.toLowerCase())) {
      items.push(location);
    }
    metaEl.innerHTML = "";
    items.forEach((item, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.textContent = "/";
        metaEl.appendChild(sep);
      }
      const span = document.createElement("span");
      span.textContent = item;
      metaEl.appendChild(span);
    });
  }

  function isDesktopDragEnabled() {
    return desktopDragQuery.matches;
  }

  function setDragStateForCards(mediaGrid, enabled) {
    if (!mediaGrid) return;
    mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)").forEach((card) => {
      card.setAttribute("draggable", enabled ? "true" : "false");
      if (!enabled) {
        card.classList.remove("is-dragging");
      }
    });
  }

  function syncOrderFromDom(mediaGrid) {
    if (!mediaGrid || !window.DMZMedia) return;
    const items = window.DMZMedia.getMediaItems();
    const cards = [...mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)")];
    const next = cards
      .map((card) => items[Number(card.getAttribute("data-index"))])
      .filter(Boolean);
    if (next.length !== items.length) return;
    window.DMZMedia.setMediaItems(next);
    markDirty();
  }

  function bindDragReorder(mediaGrid) {
    if (!mediaGrid || mediaGrid.dataset.dragBound === "true") return;
    mediaGrid.dataset.dragBound = "true";

    mediaGrid.addEventListener("dragstart", (event) => {
      if (!isDesktopDragEnabled() || !document.body.classList.contains("media-edit-mode")) return;
      const card = event.target.closest(".media-card");
      if (!card || card.classList.contains("media-edit-add")) return;
      if (event.target.closest("button, input, textarea, select, a, video, [contenteditable='true']")) {
        event.preventDefault();
        return;
      }
      dragState.card = card;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", "drag");
      } catch (error) {
        // Ignore dataTransfer errors.
      }
    });

    mediaGrid.addEventListener("dragover", (event) => {
      if (!dragState.card || !isDesktopDragEnabled()) return;
      event.preventDefault();
      const target = event.target.closest(".media-card");
      if (!target || target === dragState.card || target.classList.contains("media-edit-add")) return;
      const rect = target.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      mediaGrid.insertBefore(dragState.card, before ? target : target.nextSibling);
    });

    mediaGrid.addEventListener("drop", (event) => {
      if (!dragState.card) return;
      event.preventDefault();
      dragState.card.classList.remove("is-dragging");
      dragState.card = null;
      syncOrderFromDom(mediaGrid);
    });

    mediaGrid.addEventListener("dragend", () => {
      if (!dragState.card) return;
      dragState.card.classList.remove("is-dragging");
      dragState.card = null;
      syncOrderFromDom(mediaGrid);
    });
  }

  function addDeleteButtons(mediaGrid) {
    if (!mediaGrid) return;
    const cards = mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)");
    cards.forEach((card) => {
      if (card.querySelector(".media-edit-delete")) return;
      const btn = document.createElement("button");
      btn.className = "media-edit-delete";
      btn.type = "button";
      btn.setAttribute("aria-label", "Delete media item");
      btn.textContent = "x";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(card.getAttribute("data-index"));
        const confirmDelete = window.confirm("Delete this media item? This will remove it on publish.");
        if (!confirmDelete) return;
        if (window.DMZMedia) {
          window.DMZMedia.removeMediaItem(index);
          markDirty();
        } else {
          card.remove();
          markDirty();
        }
      });
      card.appendChild(btn);
    });
  }

  function addEditButtons(mediaGrid) {
    if (!mediaGrid) return;
    const cards = mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)");
    cards.forEach((card) => {
      if (card.querySelector(".media-edit-more")) return;
      const btn = document.createElement("button");
      btn.className = "media-edit-more";
      btn.type = "button";
      btn.setAttribute("aria-label", "Edit media details");
      btn.textContent = "...";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!window.DMZMedia) return;
        const index = Number(card.getAttribute("data-index"));
        const items = window.DMZMedia.getMediaItems();
        const item = items[index];
        if (!item) return;
        buildAddModal(item, index);
      });
      card.appendChild(btn);
    });
  }

  function enableInlineEdits(mediaGrid) {
    if (!mediaGrid || !window.DMZMedia) return;
    const items = window.DMZMedia.getMediaItems();
    const cards = mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)");
    cards.forEach((card) => {
      const index = Number(card.getAttribute("data-index"));
      const item = items[index];
      if (!item) return;

      const title = card.querySelector(".media-body h3");
      const description = card.querySelector(".media-body p");
      const meta = card.querySelector(".media-meta");

      if (title) {
        title.setAttribute("contenteditable", "true");
        title.setAttribute("data-edit-field", "title");
        if (!title.getAttribute("data-edit-bound")) {
          title.addEventListener("input", () => {
            window.DMZMedia.updateMediaItem(index, { title: title.textContent.trim() });
            markDirty();
          });
          title.setAttribute("data-edit-bound", "true");
        }
      }

      if (description) {
        description.setAttribute("contenteditable", "true");
        description.setAttribute("data-edit-field", "description");
        if (!description.getAttribute("data-edit-bound")) {
          description.addEventListener("input", () => {
            const value = description.textContent.trim();
            window.DMZMedia.updateMediaItem(index, { description: value });
            markDirty();
            if (value) {
              description.classList.remove("media-desc-empty");
            } else {
              description.classList.add("media-desc-empty");
            }
          });
          description.setAttribute("data-edit-bound", "true");
        }
      }

      if (meta) {
        renderMetaLine(meta, item.meta, item.location);
      }

      const body = card.querySelector(".media-body");
      if (!body || body.querySelector(".media-edit-fields")) return;

      const fields = document.createElement("div");
      fields.className = "media-edit-fields";

      const locationLabel = document.createElement("label");
      locationLabel.textContent = "Location";
      const locationInput = document.createElement("input");
      locationInput.type = "text";
      locationInput.value = item.location || "";
      locationInput.placeholder = "e.g. Great Lakes";

      locationInput.addEventListener("input", () => {
        const location = locationInput.value.trim();
        window.DMZMedia.updateMediaItem(index, { location });
        markDirty();
        if (meta) {
          renderMetaLine(meta, item.meta, location);
        }
      });

      const tagsLabel = document.createElement("label");
      tagsLabel.textContent = "Tags";
      const tagsInput = document.createElement("input");
      tagsInput.type = "text";
      tagsInput.value = (item.tags || []).join(", ");
      tagsInput.placeholder = "video, wreck, greatlakes";

      tagsInput.addEventListener("input", () => {
        const tags = tagsInput.value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        window.DMZMedia.updateMediaItem(index, { tags });
        markDirty();
        card.setAttribute("data-tags", tags.join(" "));
        window.DMZMedia.applyActiveFilter();
      });

      fields.appendChild(locationLabel);
      fields.appendChild(locationInput);
      fields.appendChild(tagsLabel);
      fields.appendChild(tagsInput);
      body.appendChild(fields);
    });
  }

  function bindMobileCardEditOpen(mediaGrid) {
    if (!mediaGrid || mediaGrid.dataset.mobileEditTapBound === "true") return;
    mediaGrid.dataset.mobileEditTapBound = "true";

    mediaGrid.addEventListener("click", (event) => {
      if (!document.body.classList.contains("media-edit-mode")) return;
      if (isDesktopDragEnabled()) return;
      const card = event.target.closest(".media-card:not(.media-edit-add)");
      if (!card) return;
      if (
        event.target.closest(
          ".media-edit-delete, .media-edit-more, .media-edit-fields, [data-edit-field], input, textarea, select, button, a"
        )
      ) {
        return;
      }
      if (!window.DMZMedia) return;
      const index = Number(card.getAttribute("data-index"));
      const items = window.DMZMedia.getMediaItems();
      const item = items[index];
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      buildAddModal(item, index);
    });
  }

  function buildAddModal(item = null, index = null) {
    if (document.querySelector(".media-edit-modal")) return;
    const overlay = document.createElement("div");
    overlay.className = "media-edit-modal";

    const card = document.createElement("div");
    card.className = "media-edit-modal-card";

    const heading = document.createElement("h3");
    heading.textContent = item ? "Edit Media" : "Add Media";

    const hint = document.createElement("p");
    hint.className = "media-edit-modal-hint";
    hint.textContent =
      "You can paste a Stream ID, a URL, or upload to Stream from here. Local assets still work.";

    const form = document.createElement("form");
    form.className = "media-edit-form";

    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Type";
    const typeSelect = document.createElement("select");
    const optVideo = document.createElement("option");
    optVideo.value = "video";
    optVideo.textContent = "Video";
    const optPhoto = document.createElement("option");
    optPhoto.value = "photo";
    optPhoto.textContent = "Photo";
    typeSelect.appendChild(optVideo);
    typeSelect.appendChild(optPhoto);

    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.type = "text";

    const descLabel = document.createElement("label");
    descLabel.textContent = "Description";
    const descInput = document.createElement("textarea");
    descInput.rows = 3;

    const tagsLabel = document.createElement("label");
    tagsLabel.textContent = "Tags (comma separated)";
    const tagsInput = document.createElement("input");
    tagsInput.type = "text";

    const locationLabel = document.createElement("label");
    locationLabel.textContent = "Location";
    const locationInput = document.createElement("input");
    locationInput.type = "text";

    const dateWrap = document.createElement("div");
    dateWrap.className = "media-edit-date";
    const dateLabel = document.createElement("label");
    dateLabel.textContent = "Publish Date (optional)";
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateWrap.appendChild(dateLabel);
    dateWrap.appendChild(dateInput);

    const streamIdLabel = document.createElement("label");
    streamIdLabel.textContent = "Cloudflare Stream ID";
    const streamIdInput = document.createElement("input");
    streamIdInput.type = "text";
    streamIdInput.placeholder = "Auto-filled after upload";

    const streamUploadBtn = document.createElement("button");
    streamUploadBtn.type = "button";
    streamUploadBtn.className = "media-edit-save";
    streamUploadBtn.textContent = "Queue Stream Upload";
    streamUploadBtn.disabled = true;
    let uploadQueued = false;
    let uploadInFlight = false;
    let uploadComplete = false;
    let queuedTaskId = "";
    let uploadCreatedItem = false;
    let uploadCreatedItemId = "";

    const progressWrap = document.createElement("div");
    progressWrap.className = "media-edit-progress";
    progressWrap.hidden = true;
    const progressBar = document.createElement("div");
    progressBar.className = "media-edit-progress-bar";
    const progressLabel = document.createElement("div");
    progressLabel.className = "media-edit-progress-label";
    progressLabel.textContent = "0%";
    progressWrap.appendChild(progressBar);
    progressWrap.appendChild(progressLabel);

    const mediaFileLabel = document.createElement("label");
    mediaFileLabel.textContent = "Pick media file";
    const mediaFileInput = document.createElement("input");
    mediaFileInput.type = "file";
    mediaFileInput.accept = "video/*,image/*";

    const uploadStatus = document.createElement("p");
    uploadStatus.className = "media-upload-note";
    uploadStatus.textContent = "Recommended for video. Uploads directly to Cloudflare Stream.";

    const urlToggle = document.createElement("button");
    urlToggle.type = "button";
    urlToggle.className = "media-edit-cancel";
    urlToggle.textContent = "Use direct URL instead";

    const mediaUrlLabel = document.createElement("label");
    mediaUrlLabel.textContent = "Media URL";
    const mediaUrlInput = document.createElement("input");
    mediaUrlInput.type = "text";
    mediaUrlInput.placeholder = "/assets/media/your-file.mp4 or https://...";

    const thumbUrlLabel = document.createElement("label");
    thumbUrlLabel.textContent = "Thumbnail URL (optional)";
    const thumbUrlInput = document.createElement("input");
    thumbUrlInput.type = "text";
    thumbUrlInput.placeholder = "assets/media/thumbnails/your-thumb.jpg or https://...";

    const thumbFileLabel = document.createElement("label");
    thumbFileLabel.textContent = "Pick thumbnail image (local)";
    const thumbFileInput = document.createElement("input");
    thumbFileInput.type = "file";
    thumbFileInput.accept = "image/*";

    const uploadBlock = document.createElement("div");
    uploadBlock.className = "media-upload-block";
    const uploadHead = document.createElement("div");
    uploadHead.className = "media-upload-head";
    const uploadTitle = document.createElement("div");
    uploadTitle.className = "media-upload-title";
    uploadTitle.textContent = "Stream upload";
    uploadHead.appendChild(uploadTitle);
    uploadBlock.appendChild(uploadHead);
    uploadBlock.appendChild(uploadStatus);
    uploadBlock.appendChild(mediaFileLabel);
    uploadBlock.appendChild(mediaFileInput);
    uploadBlock.appendChild(streamUploadBtn);
    uploadBlock.appendChild(progressWrap);
    uploadBlock.appendChild(streamIdLabel);
    uploadBlock.appendChild(streamIdInput);

    const urlBlock = document.createElement("div");
    urlBlock.className = "media-upload-block";
    urlBlock.hidden = true;
    const urlHead = document.createElement("div");
    urlHead.className = "media-upload-head";
    const urlTitle = document.createElement("div");
    urlTitle.className = "media-upload-title";
    urlTitle.textContent = "Direct URL (advanced)";
    urlHead.appendChild(urlTitle);
    urlBlock.appendChild(urlHead);
    urlBlock.appendChild(mediaUrlLabel);
    urlBlock.appendChild(mediaUrlInput);
    urlBlock.appendChild(thumbUrlLabel);
    urlBlock.appendChild(thumbUrlInput);
    urlBlock.appendChild(thumbFileLabel);
    urlBlock.appendChild(thumbFileInput);

    const actions = document.createElement("div");
    actions.className = "media-edit-modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "media-edit-cancel";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "media-edit-save";
    saveBtn.textContent = item ? "Save" : "Add";

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    form.appendChild(typeLabel);
    form.appendChild(typeSelect);
    form.appendChild(titleLabel);
    form.appendChild(titleInput);
    form.appendChild(descLabel);
    form.appendChild(descInput);
    form.appendChild(tagsLabel);
    form.appendChild(tagsInput);
    form.appendChild(locationLabel);
    form.appendChild(locationInput);
    form.appendChild(dateWrap);
    form.appendChild(uploadBlock);
    form.appendChild(urlToggle);
    form.appendChild(urlBlock);

    card.appendChild(heading);
    card.appendChild(hint);
    form.appendChild(actions);
    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    lockModalScroll();

    function closeModal() {
      overlay.remove();
      unlockModalScroll();
    }

    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });

    if (item) {
      typeSelect.value = item.type || "video";
      titleInput.value = item.title || "";
      descInput.value = item.description || "";
      tagsInput.value = (item.tags || []).join(", ");
      locationInput.value = item.location || "";
      dateInput.value = formatDateForInput(item.createdAt || "");
      mediaUrlInput.value = item.url || "";
      thumbUrlInput.value = item.thumbUrl || "";
      streamIdInput.value = item.streamId || "";
    }

    const updateDateVisibility = () => {
      const hasStream = Boolean(streamIdInput.value.trim());
      dateWrap.hidden = hasStream;
    };
    updateDateVisibility();
    streamIdInput.addEventListener("input", updateDateVisibility);

    if (mediaUrlInput.value || thumbUrlInput.value) {
      urlBlock.hidden = false;
      urlToggle.textContent = "Hide direct URL fields";
    }

    function syncMediaUrlFromFile(file) {
      if (!file) return;
      if (file.type && file.type.startsWith("image/")) {
        typeSelect.value = "photo";
      } else if (file.type && file.type.startsWith("video/")) {
        typeSelect.value = "video";
      }
      const basePath = mediaTypePaths[typeSelect.value] || defaultAssetPath;
      mediaUrlInput.value = `${basePath}${file.name}`;
    }

    function updateUploadState(file) {
      if (!file) {
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Queue Stream Upload";
        uploadStatus.textContent = "Pick a file to upload to Stream.";
        uploadQueued = false;
        uploadInFlight = false;
        uploadComplete = false;
        return;
      }
      if (file.type && file.type.startsWith("image/")) {
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Queue Stream Upload";
        uploadStatus.textContent = "Images use direct URLs or local assets (no Stream upload).";
        uploadQueued = false;
        uploadInFlight = false;
        uploadComplete = false;
        return;
      }
      if (uploadComplete) {
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Upload successful";
        uploadStatus.textContent = "Upload complete. Stream ID added.";
        return;
      }
      if (uploadInFlight) {
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Uploading...";
        uploadStatus.textContent = "Uploading in background...";
        return;
      }
      if (uploadQueued) {
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Upload queued";
        uploadStatus.textContent = "Upload is queued and will start automatically.";
        return;
      }
      streamUploadBtn.disabled = false;
      streamUploadBtn.textContent = "Queue Stream Upload";
      uploadStatus.textContent = "Ready to queue video upload to Stream.";
    }

    mediaFileInput.addEventListener("change", () => {
      const file = mediaFileInput.files && mediaFileInput.files[0];
      uploadComplete = false;
      syncMediaUrlFromFile(file);
      updateUploadState(file);
      if (file && file.type && file.type.startsWith("image/")) {
        urlBlock.hidden = false;
        urlToggle.textContent = "Hide direct URL fields";
      }
    });

    typeSelect.addEventListener("change", () => {
      const file = mediaFileInput.files && mediaFileInput.files[0];
      if (!file) return;
      const basePath = mediaTypePaths[typeSelect.value] || defaultAssetPath;
      mediaUrlInput.value = `${basePath}${file.name}`;
    });

    thumbFileInput.addEventListener("change", () => {
      const file = thumbFileInput.files && thumbFileInput.files[0];
      if (!file) return;
      thumbUrlInput.value = `${thumbDefaultPath}${file.name}`;
    });

    urlToggle.addEventListener("click", () => {
      urlBlock.hidden = !urlBlock.hidden;
      urlToggle.textContent = urlBlock.hidden ? "Use direct URL instead" : "Hide direct URL fields";
    });

    streamIdInput.addEventListener("input", () => {
      const value = streamIdInput.value.trim();
      if (value && !thumbUrlInput.value) {
        thumbUrlInput.value = buildStreamThumbUrl(value);
      }
    });

    function ensureUploadedItemDraft(file) {
      if (uploadCreatedItem || item || !window.DMZMedia) return "";
      const rawName = file && file.name ? file.name : "Uploaded Video";
      const title = rawName.replace(/\.[^/.]+$/, "");
      const nextItem = {
        type: "video",
        title: title || "Uploaded Video",
        description: "",
        tags: ["video"],
        badge: "VIDEO",
        thumbText: "VIDEO",
        url: "",
        thumbUrl: thumbUrlInput.value.trim(),
        streamId: streamIdInput.value.trim(),
        meta: [],
        location: "",
      };
      const created = ensureId(nextItem);
      uploadCreatedItemId = created.id || "";
      window.DMZMedia.addMediaItem(created);
      uploadCreatedItem = true;
      markDirty();
      return uploadCreatedItemId;
    }

    function queueUploadForTarget(file, targetId) {
      if (!file || !targetId || queuedTaskId || uploadComplete) return null;
      uploadQueued = true;
      uploadInFlight = false;
      progressWrap.hidden = false;
      progressBar.style.width = "0%";
      progressLabel.textContent = "Queued";
      setUploadCardStatus(targetId, { state: "queued", progress: 0, label: "Queued" });
      updateUploadState(file);
      queuedTaskId = enqueueStreamUploadTask({
        file,
        onStatus(status) {
          if (status === "uploading") {
            uploadInFlight = true;
            progressLabel.textContent = "Uploading...";
            setUploadCardStatus(targetId, { state: "uploading", label: "" });
          } else if (status === "fallback") {
            progressLabel.textContent = "Retrying...";
            setUploadCardStatus(targetId, { state: "retrying", label: "Retrying..." });
          }
          updateUploadState(file);
        },
        onProgress(percent) {
          progressBar.style.width = `${percent}%`;
          progressLabel.textContent = `${percent}%`;
          setUploadCardStatus(targetId, { state: "uploading", progress: percent, label: "" });
        },
        onComplete(result) {
          uploadQueued = false;
          uploadInFlight = false;
          uploadComplete = true;
          queuedTaskId = "";
          const streamId = result && result.streamId ? result.streamId : "";
          const nextThumb = result && result.thumbUrl ? result.thumbUrl : "";
          if (streamId) {
            streamIdInput.value = streamId;
            if (!thumbUrlInput.value) {
              thumbUrlInput.value = nextThumb || buildStreamThumbUrl(streamId);
            }
            applyStreamUploadToMediaItem(targetId, streamId, nextThumb);
          }
          uploadStatus.textContent = "Upload complete. Stream ID added to draft.";
          progressBar.style.width = "100%";
          progressLabel.textContent = "100%";
          setUploadCardStatus(targetId, { state: "complete", progress: 100, label: "Uploaded" });
          updateUploadState(file);
          setTimeout(() => {
            clearUploadCardStatus(targetId);
          }, 2200);
          setTimeout(() => {
            progressWrap.hidden = true;
          }, 1000);
        },
        onError() {
          uploadQueued = false;
          uploadInFlight = false;
          queuedTaskId = "";
          uploadStatus.textContent = "Upload failed. You can queue it again.";
          progressLabel.textContent = "Failed";
          reportTelemetry("media_upload_failed", {
            itemId: targetId,
            fileName: file && file.name ? file.name : "",
          });
          setUploadCardStatus(targetId, { state: "failed", label: "Upload failed" });
          updateUploadState(file);
          setTimeout(() => {
            progressWrap.hidden = true;
          }, 1200);
        },
      });
      return queuedTaskId;
    }

    streamUploadBtn.addEventListener("click", () => {
      const file = mediaFileInput.files && mediaFileInput.files[0];
      if (!file) {
        streamUploadBtn.textContent = "Pick a video file first";
        return;
      }
      if (file.type && file.type.startsWith("image/")) {
        streamUploadBtn.textContent = "Video uploads only";
        return;
      }
      const targetId = (item && item.id) || uploadCreatedItemId || ensureUploadedItemDraft(file);
      if (!targetId) return;
      mediaUrlInput.value = "";
      queueUploadForTarget(file, targetId);
    });

    updateUploadState(null);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!window.DMZMedia) return;
      const type = typeSelect.value;
      const tags = tagsInput.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (!tags.includes(type)) {
        tags.unshift(type);
      }
      const nextItem = {
        id: item && item.id ? item.id : undefined,
        type,
        title: titleInput.value.trim() || "New Media",
        description: descInput.value.trim(),
        tags,
        badge: type === "photo" ? "PHOTO" : "VIDEO",
        thumbText: type === "photo" ? "Photo" : "YouTube Thumbnail",
        url: mediaUrlInput.value.trim() || "",
        thumbUrl: thumbUrlInput.value.trim(),
        streamId: streamIdInput.value.trim(),
        meta: [],
        location: locationInput.value.trim(),
        createdAt:
          normalizeDateInput(dateInput.value) ||
          (item && item.createdAt) ||
          new Date().toISOString(),
      };
      const selectedFile = mediaFileInput.files && mediaFileInput.files[0];
      const shouldQueueStreamUpload = Boolean(
        selectedFile &&
          !(selectedFile.type && selectedFile.type.startsWith("image/")) &&
          !streamIdInput.value.trim()
      );
      let persistedId = nextItem.id || "";
      if (item && typeof index === "number") {
        window.DMZMedia.updateMediaItem(index, nextItem);
        window.DMZMedia.setMediaItems(window.DMZMedia.getMediaItems());
        persistedId = item.id || nextItem.id || "";
      } else if (uploadCreatedItemId) {
        const items = window.DMZMedia.getMediaItems();
        const createdIndex = items.findIndex((entry) => entry && entry.id === uploadCreatedItemId);
        if (createdIndex !== -1) {
          window.DMZMedia.updateMediaItem(createdIndex, { ...nextItem, id: uploadCreatedItemId });
          window.DMZMedia.setMediaItems(window.DMZMedia.getMediaItems());
          persistedId = uploadCreatedItemId;
        } else {
          const created = ensureId(nextItem);
          window.DMZMedia.addMediaItem(created);
          persistedId = created.id || "";
        }
      } else {
        const created = ensureId(nextItem);
        window.DMZMedia.addMediaItem(created);
        persistedId = created.id || "";
      }
      if (shouldQueueStreamUpload && persistedId && !queuedTaskId) {
        queueUploadForTarget(selectedFile, persistedId);
      }
      markDirty();
      closeModal();
    });
  }

  function ensureAddCard(mediaGrid) {
    if (!mediaGrid || mediaGrid.querySelector(".media-edit-add")) return;
    const card = document.createElement("article");
    card.className = "media-card media-edit-add";
    card.setAttribute("data-tags", addCardTags);
    card.style.gridRowEnd = "span 18";

    const button = document.createElement("button");
    button.className = "media-edit-add-button";
    button.type = "button";
    button.setAttribute("aria-label", "Add media");

    const thumb = document.createElement("div");
    thumb.className = "media-thumb media-edit-add-thumb";

    const thumbText = document.createElement("div");
    thumbText.className = "media-thumb-faux";
    thumbText.textContent = "Add Media";
    thumb.appendChild(thumbText);

    const body = document.createElement("div");
    body.className = "media-body";

    const title = document.createElement("h3");
    title.textContent = "Add Media";

    const description = document.createElement("p");
    description.textContent = "Click to add a new item.";

    body.appendChild(title);
    body.appendChild(description);

    button.appendChild(thumb);
    button.appendChild(body);
    card.appendChild(button);
    mediaGrid.appendChild(card);

    button.addEventListener("click", () => {
      buildAddModal();
    });
  }

  function removeEditControls(mediaGrid) {
    if (!mediaGrid) return;
    mediaGrid.querySelectorAll(".media-edit-delete").forEach((btn) => btn.remove());
    mediaGrid.querySelectorAll(".media-edit-more").forEach((btn) => btn.remove());
    const addCard = mediaGrid.querySelector(".media-edit-add");
    if (addCard) addCard.remove();
    mediaGrid.querySelectorAll(".media-edit-fields").forEach((fields) => fields.remove());
    mediaGrid.querySelectorAll(".media-upload-thumb-status").forEach((status) => status.remove());
    mediaGrid.querySelectorAll("[data-edit-field]").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-edit-field");
    });
  }

  function captureViewportAnchor(mediaGrid) {
    const snapshot = {
      index: "",
      top: 0,
      scrollY: window.scrollY || window.pageYOffset || 0,
    };
    if (!mediaGrid) return snapshot;
    const cards = [...mediaGrid.querySelectorAll(".media-card:not(.media-edit-add)")];
    if (!cards.length) return snapshot;
    const anchorY = Math.max(80, Math.min(window.innerHeight * 0.32, 220));
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.top - anchorY);
      if (distance < bestDistance) {
        best = card;
        bestDistance = distance;
      }
    });
    if (!best) return snapshot;
    snapshot.index = best.getAttribute("data-index") || "";
    snapshot.top = best.getBoundingClientRect().top;
    return snapshot;
  }

  function restoreViewportAnchor(snapshot, mediaGrid) {
    if (!snapshot) return;
    const apply = () => {
      if (!mediaGrid) {
        window.scrollTo({ top: snapshot.scrollY || 0, behavior: "auto" });
        return;
      }
      if (snapshot.index) {
        const card = mediaGrid.querySelector(`.media-card[data-index="${snapshot.index}"]`);
        if (card) {
          const delta = card.getBoundingClientRect().top - snapshot.top;
          if (Math.abs(delta) > 1) {
            window.scrollBy(0, delta);
          }
          return;
        }
      }
      window.scrollTo({ top: snapshot.scrollY || 0, behavior: "auto" });
    };

    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
    setTimeout(apply, 220);
    setTimeout(apply, 420);
  }

  function setupEditToggle() {
    const mediaGrid = document.getElementById("mediaGrid");
    const toggle = document.querySelector(".media-edit-toggle");
    const loginButton = document.querySelector(".media-login-button");
    const exportButton = document.querySelector(".media-edit-export");
    const publishButton = document.querySelector(".media-edit-publish");
    const resetButton = document.querySelector(".media-edit-reset");
    const refreshButton = document.querySelector(".media-edit-refresh");
    const syncButton = document.querySelector(".media-edit-sync");
    const logoutButton = document.querySelector(".media-edit-logout");
    const statusLabel = document.getElementById("mediaAdminStatus");
    if (!toggle) return;
    if (mediaGrid) {
      bindDragReorder(mediaGrid);
      bindMobileCardEditOpen(mediaGrid);
    }
    const updateDragAvailability = () => {
      const enabled = document.body.classList.contains("media-edit-mode") && isDesktopDragEnabled();
      setDragStateForCards(mediaGrid, enabled);
    };
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains("media-edit-mode")) {
        addDeleteButtons(mediaGrid);
        addEditButtons(mediaGrid);
        ensureAddCard(mediaGrid);
        enableInlineEdits(mediaGrid);
        renderUploadCardIndicators(mediaGrid);
        updateDragAvailability();
      }
    });
    if (mediaGrid) {
      observer.observe(mediaGrid, { childList: true });
    }
    desktopDragQuery.addEventListener("change", updateDragAvailability);
    const updateAuthState = () => {
      const authed = Boolean(getToken());
      document.body.classList.toggle("media-authenticated", authed);
      if (statusLabel) {
        statusLabel.textContent = authed ? "Signed in" : "Signed out";
      }
      if (loginButton) {
        loginButton.style.display = authed ? "" : "none";
        loginButton.textContent = "Re-auth";
      }
    };

    updateAuthState();
    try {
      if (window.localStorage.getItem(draftStorageKey)) {
        setDirty(true);
      }
    } catch (error) {
      // Ignore storage errors.
    }

    window.addEventListener("beforeunload", (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    });

    if (loginButton) {
      loginButton.addEventListener("click", () => {
        buildLoginModal(() => {
          updateAuthState();
        });
      });
    }

    const exitEditMode = () => {
      if (!document.body.classList.contains("media-edit-mode")) return;
      document.body.classList.remove("media-edit-mode");
      toggle.setAttribute("aria-pressed", "false");
      removeEditControls(mediaGrid);
      updateDragAvailability();
      if (window.DMZMedia && window.DMZMedia.updateMasonry) {
        window.DMZMedia.updateMasonry();
      }
      if (window.DMZMedia && window.DMZMedia.resetHeights) {
        window.DMZMedia.resetHeights();
      }
    };

    toggle.addEventListener("click", () => {
      if (!getToken()) {
        buildLoginModal(() => {
          updateAuthState();
          toggle.click();
        });
        return;
      }
      const anchorSnapshot = captureViewportAnchor(mediaGrid);
      const isActive = document.body.classList.toggle("media-edit-mode");
      toggle.setAttribute("aria-pressed", isActive ? "true" : "false");
      if (isActive) {
        addDeleteButtons(mediaGrid);
        addEditButtons(mediaGrid);
        ensureAddCard(mediaGrid);
        enableInlineEdits(mediaGrid);
        renderUploadCardIndicators(mediaGrid);
        updateDragAvailability();
        if (window.DMZMedia && window.DMZMedia.updateMasonry) {
          window.DMZMedia.updateMasonry();
        }
      } else {
        removeEditControls(mediaGrid);
        updateDragAvailability();
        if (window.DMZMedia && window.DMZMedia.updateMasonry) {
          window.DMZMedia.updateMasonry();
        }
        if (window.DMZMedia && window.DMZMedia.resetHeights) {
          window.DMZMedia.resetHeights();
        } else if (window.DMZMedia && window.DMZMedia.updateMasonry) {
          window.DMZMedia.updateMasonry();
        }
      }
      restoreViewportAnchor(anchorSnapshot, mediaGrid);
    });

    if (exportButton) {
      exportButton.addEventListener("click", () => {
        if (!window.DMZMedia) return;
        if (window.DMZMedia.syncFromDom) {
          window.DMZMedia.syncFromDom();
        }
        const payload = {
          mediaItems: window.DMZMedia.getMediaItems(),
          photoItems: window.DMZMedia.getPhotoItems ? window.DMZMedia.getPhotoItems() : [],
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "media.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    }

    if (publishButton) {
      publishButton.addEventListener("click", async () => {
        if (!window.DMZMedia) return;
        if (!getToken()) {
          buildLoginModal(() => publishButton.click());
          return;
        }
        if (window.DMZMedia.syncFromDom) {
          window.DMZMedia.syncFromDom();
        }
        const baseItems = window.DMZMedia.getMediaItems().map((item) => ensureId({ ...item }));
        const nowIso = new Date().toISOString();
        const items = baseItems.map((item, index) => {
          return {
            ...item,
            createdAt: item.createdAt || nowIso,
            sortOrder: index,
          };
        });
        let deleteIds = [];
        let deleteStreamIds = [];
        try {
          const resp = await fetch(`${apiRoot || ""}/api/media`, { cache: "no-store" });
          if (resp.ok) {
            const serverData = await resp.json();
            const serverItems = [
              ...(serverData.mediaItems || []),
              ...(serverData.photoItems || []),
            ];
            const currentIds = new Set(items.map((entry) => entry.id).filter(Boolean));
            deleteIds = serverItems
              .map((entry) => entry && entry.id)
              .filter((id) => id && !currentIds.has(id));
            deleteStreamIds = serverItems
              .filter((entry) => entry && entry.id && deleteIds.includes(entry.id))
              .map((entry) => entry.streamId)
              .filter(Boolean);
          }
        } catch (error) {
          console.warn("Failed to load server media list for delete sync.", error);
        }
        const resp = await apiFetch("/api/admin/media-bulk", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, deleteIds, deleteStreamIds }),
        });
        if (!resp.ok) {
          window.alert("Publish failed. Check your login or API.");
          return;
        }
        window.alert("Media published to DMZ.");
        try {
          window.localStorage.removeItem(draftStorageKey);
        } catch (error) {
          // Ignore storage errors.
        }
        setDirty(false);
        showPublishBanner("Media published.", "success", 2000);
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (!window.DMZMedia) return;
        const confirmReset = window.confirm("Discard local edits and reload from media.json?");
        if (confirmReset) {
          setDirty(false);
          hidePublishBanner();
          window.DMZMedia.clearDraft();
        }
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", async () => {
        if (!window.DMZMedia || typeof window.DMZMedia.reloadFromServer !== "function") {
          window.location.reload();
          return;
        }
        if (isDirty) {
          const ok = window.confirm("Unsaved changes will be lost. Continue with master refresh?");
          if (!ok) return;
        }
        setDirty(false);
        hidePublishBanner();
        try {
          window.localStorage.removeItem(draftStorageKey);
        } catch (error) {
          // Ignore storage errors.
        }
        await window.DMZMedia.reloadFromServer();
      });
    }

    if (syncButton) {
      syncButton.addEventListener("click", async () => {
        if (!getToken()) {
          buildLoginModal(() => syncButton.click());
          return;
        }
        syncButton.disabled = true;
        syncButton.textContent = "Syncing...";
        try {
          const resp = await apiFetch("/api/admin/stream-date-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force: true }),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            window.alert("Stream date sync failed.");
          } else {
            const count = data.updated || 0;
            window.alert(`Stream dates synced (${count} updated).`);
            if (window.DMZMedia && window.DMZMedia.setMediaItems) {
              const draftItems = (window.DMZMedia.getMediaItems() || []).map((item) => ({
                ...(item || {}),
              }));
              try {
                const mediaResp = await fetch(`${apiRoot || ""}/api/media`, { cache: "no-store" });
                if (mediaResp.ok) {
                  const serverData = await mediaResp.json();
                  const serverItems = Array.isArray(serverData.mediaItems)
                    ? serverData.mediaItems
                    : [];
                  const serverById = new Map();
                  const serverByStreamId = new Map();
                  serverItems.forEach((item) => {
                    if (!item) return;
                    if (item.id) serverById.set(item.id, item);
                    if (item.streamId) serverByStreamId.set(item.streamId, item);
                  });
                  const draftIds = new Set(
                    draftItems.map((item) => item && item.id).filter(Boolean)
                  );
                  const draftStreamIds = new Set(
                    draftItems.map((item) => item && item.streamId).filter(Boolean)
                  );
                  const hasDraftMatch = (item) => {
                    if (!item) return false;
                    if (item.id && draftIds.has(item.id)) return true;
                    if (item.streamId && draftStreamIds.has(item.streamId)) return true;
                    return false;
                  };
                  const merged = draftItems.map((item) => {
                    if (!item) return item;
                    const match =
                      (item.id && serverById.get(item.id)) ||
                      (item.streamId && serverByStreamId.get(item.streamId));
                    if (!match) return item;
                    return {
                      ...item,
                      createdAt: match.createdAt || item.createdAt,
                      uploadedAt: match.uploadedAt || item.uploadedAt,
                      date: match.date || item.date,
                      uploadDate: match.uploadDate || item.uploadDate,
                    };
                  });
                  const extras = serverItems.filter((item) => !hasDraftMatch(item));
                  window.DMZMedia.setMediaItems([...merged, ...extras]);
                } else {
                  window.DMZMedia.setMediaItems(draftItems);
                }
              } catch (error) {
                window.DMZMedia.setMediaItems(draftItems);
              }
            }
            markDirty();
          }
        } catch (error) {
          window.alert("Stream date sync failed.");
        } finally {
          syncButton.disabled = false;
          syncButton.textContent = "Sync Stream Dates";
        }
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        setToken("");
        updateAuthState();
        exitEditMode();
        hidePublishBanner();
      });
    }
  }

  function maybeAutoActivate() {
    if (getToken() && new URLSearchParams(window.location.search).get("editMode") === "1") {
      const toggle = document.querySelector(".media-edit-toggle");
      if (toggle && !document.body.classList.contains("media-edit-mode")) toggle.click();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { setupEditToggle(); maybeAutoActivate(); });
  } else {
    setupEditToggle();
    maybeAutoActivate();
  }
})();
