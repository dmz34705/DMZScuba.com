(() => {
  const addCardTags = "video photo wreck reef training";
  const defaultAssetPath = "/assets/media/";
  const mediaTypePaths = {
    photo: "/assets/media/photos/",
    video: defaultAssetPath,
  };
  const thumbDefaultPath = "/assets/media/thumbnails/";
  const desktopDragQuery = window.matchMedia("(min-width: 981px)");
  const dragState = {
    card: null,
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
        } else {
          card.remove();
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
      "Place files in assets/media/ (photos in assets/media/photos/, thumbs in assets/media/thumbnails/). Leave thumbnails blank for auto previews.";

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

    const mediaUrlLabel = document.createElement("label");
    mediaUrlLabel.textContent = "Media URL";
    const mediaUrlInput = document.createElement("input");
    mediaUrlInput.type = "text";
    mediaUrlInput.placeholder = "assets/media/your-file.mp4 or https://...";

    const mediaFileLabel = document.createElement("label");
    mediaFileLabel.textContent = "Pick media file (local)";
    const mediaFileInput = document.createElement("input");
    mediaFileInput.type = "file";
    mediaFileInput.accept = "video/*,image/*";

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
    form.appendChild(mediaUrlLabel);
    form.appendChild(mediaUrlInput);
    form.appendChild(mediaFileLabel);
    form.appendChild(mediaFileInput);
    form.appendChild(thumbUrlLabel);
    form.appendChild(thumbUrlInput);
    form.appendChild(thumbFileLabel);
    form.appendChild(thumbFileInput);

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

    mediaFileInput.addEventListener("change", () => {
      const file = mediaFileInput.files && mediaFileInput.files[0];
      syncMediaUrlFromFile(file);
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
        type,
        title: titleInput.value.trim() || "New Media",
        description: descInput.value.trim(),
        tags,
        badge: type === "photo" ? "PHOTO" : "VIDEO",
        thumbText: type === "photo" ? "Photo" : "YouTube Thumbnail",
        url: mediaUrlInput.value.trim() || "#",
        thumbUrl: thumbUrlInput.value.trim(),
        meta: [],
        location: locationInput.value.trim(),
      };
      if (item && typeof index === "number") {
        window.DMZMedia.updateMediaItem(index, nextItem);
        window.DMZMedia.setMediaItems(window.DMZMedia.getMediaItems());
      } else {
        window.DMZMedia.addMediaItem(nextItem);
      }
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
    const exportButton = document.querySelector(".media-edit-export");
    const resetButton = document.querySelector(".media-edit-reset");
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
    toggle.addEventListener("click", () => {
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

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (!window.DMZMedia) return;
        const confirmReset = window.confirm("Discard local edits and reload from media.json?");
        if (confirmReset) {
          window.DMZMedia.clearDraft();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupEditToggle);
  } else {
    setupEditToggle();
  }
})();
