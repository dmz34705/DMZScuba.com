(() => {
  const addCardTags = "video photo wreck reef training";
  const defaultAssetPath = "/assets/media/";
  const mediaTypePaths = {
    photo: "/assets/media/photos/",
    video: defaultAssetPath,
  };
  const thumbDefaultPath = "/assets/media/thumbnails/";
  const desktopDragQuery = window.matchMedia("(min-width: 981px)");
  const apiBase = (document.body && document.body.dataset.mediaApi) || "";
  const apiRoot = apiBase || "";
  const tokenStorageKey = "dmzMediaToken";
  const draftStorageKey = "dmzMediaDraft";
  let isDirty = false;
  const dragState = {
    card: null,
  };

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

  function setDirty(next) {
    isDirty = Boolean(next);
    document.body.classList.toggle("media-has-unsaved", isDirty);
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

  function buildLoginModal(onSuccess) {
    if (document.querySelector(".media-auth-modal")) return;
    const overlay = document.createElement("div");
    overlay.className = "media-edit-modal media-auth-modal";
    const card = document.createElement("div");
    card.className = "media-edit-modal-card";

    const heading = document.createElement("h3");
    heading.textContent = "DMZ Media Admin";
    const hint = document.createElement("p");
    hint.className = "media-edit-modal-hint";
    hint.textContent = "Sign in to manage the media library.";

    const form = document.createElement("form");
    form.className = "media-edit-form";

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

    form.appendChild(userLabel);
    form.appendChild(userInput);
    form.appendChild(passLabel);
    form.appendChild(passInput);
    form.appendChild(error);
    form.appendChild(actions);

    card.appendChild(heading);
    card.appendChild(hint);
    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }

    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    form.addEventListener("submit", async (event) => {
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
        console.error("Media login failed.", err);
        error.textContent = "Login failed. Check the console for details.";
      }
    });
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
      if (event.target.closest("button, input, textarea, select, a, video")) {
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

    const streamIdLabel = document.createElement("label");
    streamIdLabel.textContent = "Cloudflare Stream ID";
    const streamIdInput = document.createElement("input");
    streamIdInput.type = "text";
    streamIdInput.placeholder = "Auto-filled after upload";

    const streamUploadBtn = document.createElement("button");
    streamUploadBtn.type = "button";
    streamUploadBtn.className = "media-edit-save";
    streamUploadBtn.textContent = "Upload to Stream";
    streamUploadBtn.disabled = true;
    let uploadComplete = false;

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
    form.appendChild(uploadBlock);
    form.appendChild(urlToggle);
    form.appendChild(urlBlock);

    card.appendChild(heading);
    card.appendChild(hint);
    form.appendChild(actions);
    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function closeModal() {
      overlay.remove();
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
      mediaUrlInput.value = item.url || "";
      thumbUrlInput.value = item.thumbUrl || "";
      streamIdInput.value = item.streamId || "";
    }

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
        streamUploadBtn.textContent = "Upload to Stream";
        uploadStatus.textContent = "Pick a file to upload to Stream.";
        uploadComplete = false;
        return;
      }
      if (file.type && file.type.startsWith("image/")) {
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Upload to Stream";
        uploadStatus.textContent = "Images use direct URLs or local assets (no Stream upload).";
        uploadComplete = false;
        return;
      }
      if (uploadComplete) {
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Upload successful";
        uploadStatus.textContent = "Upload complete. Stream ID added.";
        return;
      }
      streamUploadBtn.disabled = false;
      streamUploadBtn.textContent = "Upload to Stream";
      uploadStatus.textContent = "Ready to upload video to Stream.";
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

    streamUploadBtn.addEventListener("click", async () => {
      const file = mediaFileInput.files && mediaFileInput.files[0];
      if (!file) {
        streamUploadBtn.textContent = "Pick a video file first";
        return;
      }
      if (file.type && file.type.startsWith("image/")) {
        streamUploadBtn.textContent = "Video uploads only";
        return;
      }
      streamUploadBtn.disabled = true;
      streamUploadBtn.textContent = "Uploading...";
      uploadStatus.textContent = "Uploading to Stream. Please stay on this page.";
      progressWrap.hidden = false;
      progressBar.style.width = "0%";
      progressLabel.textContent = "0%";
      try {
        const useTus = Boolean(window.tus && typeof window.tus.Upload === "function");
        if (!useTus) {
          uploadStatus.textContent = "Resumable upload unavailable. Falling back.";
        }

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
            const uid = data?.uid;
            if (!uploadUrl) throw new Error("Missing upload URL");
            if (uid) {
              streamIdInput.value = uid;
              if (!thumbUrlInput.value) {
                thumbUrlInput.value = buildStreamThumbUrl(uid);
              }
            }

            await new Promise((resolve, reject) => {
              const upload = new window.tus.Upload(file, {
                uploadUrl,
                chunkSize: 50 * 1024 * 1024,
                retryDelays: [0, 1000, 3000, 5000, 8000],
                onProgress(bytesSent, bytesTotal) {
                  if (!bytesTotal) return;
                  const percent = Math.min(100, Math.round((bytesSent / bytesTotal) * 100));
                  progressBar.style.width = `${percent}%`;
                  progressLabel.textContent = `${percent}%`;
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
            uploadStatus.textContent = "Resumable upload failed. Trying standard upload...";
          }
        }

        if (!tusCompleted) {
          const resp = await apiFetch("/api/admin/stream-direct-upload", { method: "POST" });
          const data = await resp.json();
          const uploadUrl = data?.result?.uploadURL;
          const uid = data?.result?.uid;
          if (!uploadUrl) throw new Error("Missing upload URL");
          const formData = new FormData();
          formData.append("file", file);
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", uploadUrl, true);
            xhr.upload.addEventListener("progress", (event) => {
              if (!event.lengthComputable) return;
              const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
              progressBar.style.width = `${percent}%`;
              progressLabel.textContent = `${percent}%`;
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
          streamIdInput.value = uid || "";
          if (streamIdInput.value && !thumbUrlInput.value) {
            thumbUrlInput.value = buildStreamThumbUrl(streamIdInput.value);
          }
        }

        mediaUrlInput.value = "";
        uploadComplete = true;
        streamUploadBtn.disabled = true;
        streamUploadBtn.textContent = "Upload successful";
        uploadStatus.textContent = "Upload complete. Stream ID added.";
      } catch (error) {
        console.error("Stream upload failed", error);
        streamUploadBtn.textContent = "Upload failed";
        uploadStatus.textContent = "Upload failed. Check your connection and try again.";
      } finally {
        if (!uploadComplete) {
          streamUploadBtn.disabled = false;
          setTimeout(() => {
            streamUploadBtn.textContent = "Upload to Stream";
            progressWrap.hidden = true;
          }, 1200);
        } else {
          progressWrap.hidden = true;
        }
      }
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
      };
      if (item && typeof index === "number") {
        window.DMZMedia.updateMediaItem(index, nextItem);
        window.DMZMedia.setMediaItems(window.DMZMedia.getMediaItems());
      } else {
        window.DMZMedia.addMediaItem(ensureId(nextItem));
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
    mediaGrid.querySelectorAll("[data-edit-field]").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-edit-field");
    });
  }

  function setupEditToggle() {
    const mediaGrid = document.getElementById("mediaGrid");
    const toggle = document.querySelector(".media-edit-toggle");
    const loginButton = document.querySelector(".media-login-button");
    const exportButton = document.querySelector(".media-edit-export");
    const publishButton = document.querySelector(".media-edit-publish");
    const resetButton = document.querySelector(".media-edit-reset");
    const refreshButton = document.querySelector(".media-edit-refresh");
    const logoutButton = document.querySelector(".media-edit-logout");
    const statusLabel = document.getElementById("mediaAdminStatus");
    if (!toggle) return;
    if (mediaGrid) {
      bindDragReorder(mediaGrid);
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
        loginButton.textContent = authed ? "Re-auth" : "DMZ Login";
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
      const scrollY = window.scrollY;
      const isActive = document.body.classList.toggle("media-edit-mode");
      toggle.setAttribute("aria-pressed", isActive ? "true" : "false");
      if (isActive) {
        addDeleteButtons(mediaGrid);
        addEditButtons(mediaGrid);
        ensureAddCard(mediaGrid);
        enableInlineEdits(mediaGrid);
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
      window.scrollTo({ top: scrollY, behavior: "auto" });
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
        const items = window.DMZMedia.getMediaItems().map((item) => ensureId({ ...item }));
        const resp = await apiFetch("/api/admin/media-bulk", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
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
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (!window.DMZMedia) return;
        const confirmReset = window.confirm("Discard local edits and reload from media.json?");
        if (confirmReset) {
          setDirty(false);
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
        try {
          window.localStorage.removeItem(draftStorageKey);
        } catch (error) {
          // Ignore storage errors.
        }
        await window.DMZMedia.reloadFromServer();
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        setToken("");
        updateAuthState();
        exitEditMode();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupEditToggle);
  } else {
    setupEditToggle();
  }
})();
