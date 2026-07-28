(function () {
  const canvas = document.getElementById("globeCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // -------------------------
  // Canvas sizing (device-pixel aware)
  // -------------------------
  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  function fitCanvas() {
    const wrap = canvas.parentElement;
    const maxW = wrap ? wrap.clientWidth : 920;
    const targetW = maxW;

    const isMobile = window.innerWidth <= 768;
    const targetH = wrap && !isMobile ? wrap.clientHeight : (isMobile ? targetW : Math.round(targetW * 0.56));

    canvas.style.width = targetW + "px";
    canvas.style.height = targetH + "px";

    canvas.width = targetW * DPR;
    canvas.height = targetH * DPR;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  // -------------------------
  // Destination data (JSON)
  // -------------------------
  function normalizeDestinations(list) {
    return (list || []).map((d) => ({
      id: d.id,
      name: d.name,
      subtitle: d.subtitle || "",
      lat: Number(d.lat),
      lon: Number(d.lon),
      tags: Array.isArray(d.tags) ? d.tags : [],
      bullets: Array.isArray(d.bullets) ? d.bullets : [],
      heroImage: typeof d.heroImage === "string" ? d.heroImage : "",
      isoImage: typeof d.isoImage === "string" ? d.isoImage : "",
      isoTitle: typeof d.isoTitle === "string" ? d.isoTitle : "",
      isoDesc: typeof d.isoDesc === "string" ? d.isoDesc : "",
    }));
  }

  function formatDestinationName(value) {
    const raw = String(value || "").trim();
    if (!raw) return "Destination";
    if (raw === raw.toUpperCase()) {
      return raw
        .toLowerCase()
        .replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
    }
    return raw;
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, count) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
  }

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function parseDateKey(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-");
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  }

  function parseMonthAnchor(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-");
    if (parts.length !== 2) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
    return new Date(year, month - 1, 1);
  }

  function nthWeekdayOfMonth(year, monthIndex, weekOfMonth, weekday) {
    const first = new Date(year, monthIndex, 1);
    const shift = (7 + weekday - first.getDay()) % 7;
    const dayNumber = 1 + shift + (weekOfMonth - 1) * 7;
    const candidate = new Date(year, monthIndex, dayNumber);
    if (candidate.getMonth() !== monthIndex) return null;
    return candidate;
  }

  function getLegacyTemplateStartDate(template) {
    if (!template || !template.startMonth || !template.rule) return null;
    const anchor = parseMonthAnchor(template.startMonth);
    if (!anchor) return null;
    const weekOfMonth = Number(template.rule.weekOfMonth);
    const weekday = Number(template.rule.weekday);
    if (!Number.isFinite(weekOfMonth) || !Number.isFinite(weekday)) return null;
    return nthWeekdayOfMonth(anchor.getFullYear(), anchor.getMonth(), weekOfMonth, weekday);
  }

  function getTemplateStartDate(template) {
    const explicitStart = parseDateKey(String((template && template.startDate) || "").trim());
    if (explicitStart) return explicitStart;
    return getLegacyTemplateStartDate(template);
  }

  function addRepeatInterval(date, count, unit) {
    const interval = Math.max(1, Number(count) || 1);
    if (unit === "week") return addDays(date, interval * 7);
    if (unit === "year") return new Date(date.getFullYear() + interval, date.getMonth(), date.getDate());
    return new Date(date.getFullYear(), date.getMonth() + interval, date.getDate());
  }

  function parseEventDate(eventItem) {
    const parsed = new Date(`${eventItem.date}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeEventInstance(eventItem) {
    if (!eventItem || !eventItem.date) return null;
    const dateObj = parseEventDate(eventItem);
    if (!dateObj) return null;
    const anchorStartObj = parseDateKey(String(eventItem.startDate || eventItem.date || "").trim());
    const explicitEndDate = String(eventItem.endDate || "").trim();
    const explicitEndDateObj = explicitEndDate ? parseDateKey(explicitEndDate) : null;
    const derivedDurationDays =
      anchorStartObj && explicitEndDateObj && explicitEndDateObj >= anchorStartObj
        ? Math.max(1, Math.round((explicitEndDateObj.getTime() - anchorStartObj.getTime()) / 86400000) + 1)
        : 1;
    const durationDays = Math.max(1, Number(eventItem.durationDays) || derivedDurationDays);
    const endDateObj =
      explicitEndDateObj && explicitEndDateObj >= dateObj
        ? explicitEndDateObj
        : durationDays > 1
          ? addDays(dateObj, durationDays - 1)
          : dateObj;
    return {
      ...eventItem,
      date: dateKey(dateObj),
      endDate: endDateObj > dateObj ? dateKey(endDateObj) : "",
      dateObj,
      endDateObj,
    };
  }

  function expandTravelEvents(payload) {
    const today = startOfDay(new Date());
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const horizonMonths = Math.max(1, Number(payload && payload.horizonMonths) || 30);
    const explicitEvents = payload && Array.isArray(payload.events) ? payload.events : [];
    const templates = payload && Array.isArray(payload.templates) ? payload.templates : [];
    const generated = [];

    explicitEvents.forEach((eventItem) => {
      const normalized = normalizeEventInstance(eventItem);
      if (!normalized || normalized.endDateObj < today) return;
      if (normalizeText(normalized.type) !== "travel") return;
      generated.push(normalized);
    });

    templates.forEach((template) => {
      if (normalizeText(template && template.type) !== "travel") return;
      const anchor = getTemplateStartDate(template);
      if (!anchor) return;
      const repeatInterval = Math.max(1, Number(template.repeatInterval || template.intervalMonths) || 1);
      const repeatUnit = ["week", "month", "year"].includes(String(template.repeatUnit || "").trim())
        ? String(template.repeatUnit || "").trim()
        : "month";
      const allowedMonths = Array.isArray(template.months) ? template.months : null;
      const coverageEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + horizonMonths, 0);

      for (let occurrence = new Date(anchor); occurrence <= coverageEnd; occurrence = addRepeatInterval(occurrence, repeatInterval, repeatUnit)) {
        if (allowedMonths && !allowedMonths.includes(occurrence.getMonth() + 1)) continue;
        if (Array.isArray(template.excludedDates) && template.excludedDates.includes(dateKey(occurrence))) continue;
        const normalized = normalizeEventInstance({
          ...template,
          id: `${template.id || "travel"}-${dateKey(occurrence)}`,
          date: dateKey(occurrence),
        });
        if (!normalized || normalized.endDateObj < today) continue;
        generated.push(normalized);
      }
    });

    return generated.sort((a, b) => a.dateObj - b.dateObj);
  }

  async function loadDestinationsFromApi(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load destinations API");
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    return normalizeDestinations(items);
  }

  let destinations = [];
  let destinationsById = new Map();
  let destinationTripStatusById = new Map();
  let adminUnsubscribe = null;

  const TRIP_SOON_DAYS = 60;
  const TRIP_STATUS = {
    none: "none",
    planned: "planned",
    soon: "soon",
    active: "active",
  };
  const PIN_COLORS = {
    none: "rgba(226,27,35,0.95)",
    planned: "rgba(85,185,255,0.95)",
    soon: "rgba(255,193,69,0.96)",
    active: "rgba(35,209,143,0.96)",
  };
  const PIN_INNER_DOT = "rgba(234,242,255,0.96)";
  const DESTINATION_EVENT_ALIASES = {
    cozumel: ["cozumel"],
    greatlakesLM: ["lake michigan", "great lakes", "milwaukee", "two rivers", "door county"],
    floridakey: ["key largo", "key largo florida", "florida keys", "florida key"],
    haigh: ["haigh", "haigh quarry"],
    playa: ["playa del carmen", "playa", "mexico cenotes"],
    roatan: ["roatan"],
    california: ["southern california", "catalina", "channel islands", "california"],
    mermet: ["mermet", "mermet springs"],
    thailand: ["thailand", "similan", "similan islands", "phuket", "khao lak"],
    gilboa: ["gilboa", "gilboa quarry"],
  };

  function buildDestinationAliasList(dest) {
    const values = new Set();
    const add = (value) => {
      const normalized = normalizeText(value);
      if (normalized) values.add(normalized);
    };

    add(dest && dest.name);
    add(dest && dest.id);

    (DESTINATION_EVENT_ALIASES[dest && dest.id] || []).forEach(add);

    return Array.from(values).sort((a, b) => b.length - a.length);
  }

  function eventMatchesDestination(eventItem, dest) {
    if (!eventItem || !dest) return false;
    const haystack = normalizeText([
      eventItem.title,
      eventItem.location,
      eventItem.summary,
      eventItem.eventId,
      eventItem.id,
    ].filter(Boolean).join(" "));
    if (!haystack) return false;
    return buildDestinationAliasList(dest).some((alias) => {
      if (!alias) return false;
      return haystack === alias || haystack.includes(alias);
    });
  }

  function computeTripStatusForDestination(dest, travelEvents) {
    const today = startOfDay(new Date());
    const matched = (travelEvents || []).filter((eventItem) => eventMatchesDestination(eventItem, dest));
    if (!matched.length) {
      return { state: TRIP_STATUS.none, nextDate: null, daysUntil: null };
    }

    let nearestFuture = null;

    for (const eventItem of matched) {
      const start = eventItem.dateObj instanceof Date ? startOfDay(eventItem.dateObj) : null;
      const end = eventItem.endDateObj instanceof Date ? startOfDay(eventItem.endDateObj) : start;
      if (!start || !end) continue;
      if (start <= today && end >= today) {
        return { state: TRIP_STATUS.active, nextDate: start, daysUntil: 0 };
      }
      if (start > today && (!nearestFuture || start < nearestFuture)) {
        nearestFuture = start;
      }
    }

    if (!nearestFuture) {
      return { state: TRIP_STATUS.none, nextDate: null, daysUntil: null };
    }

    const daysUntil = Math.max(0, Math.round((nearestFuture.getTime() - today.getTime()) / 86400000));
    return {
      state: daysUntil <= TRIP_SOON_DAYS ? TRIP_STATUS.soon : TRIP_STATUS.planned,
      nextDate: nearestFuture,
      daysUntil,
    };
  }

  function applyTravelEventState(travelEvents) {
    const nextMap = new Map();
    destinations.forEach((dest) => {
      nextMap.set(dest.id, computeTripStatusForDestination(dest, travelEvents));
    });
    destinationTripStatusById = nextMap;
    updateGlobeStats();
  }

  async function loadEventsPayload(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load events API (${response.status})`);
    return response.json();
  }

  async function initTravelStatuses() {
    const eventsPreview = document.querySelector("[data-events-preview]");
    const dataUrl = (eventsPreview && eventsPreview.getAttribute("data-events-src")) || "/api/v2/events";
    const fallbackDataUrl =
      (eventsPreview && eventsPreview.getAttribute("data-events-fallback-src")) || "/assets/data/events.json";

    try {
      const payload = await loadEventsPayload(dataUrl).catch((error) => {
        if (!fallbackDataUrl || fallbackDataUrl === dataUrl) throw error;
        return loadEventsPayload(fallbackDataUrl);
      });
      applyTravelEventState(expandTravelEvents(payload));
    } catch (error) {
      console.error("Failed to load travel events for globe pin status:", error);
      applyTravelEventState([]);
    }
  }

  function applyDestinationState(nextItems) {
    destinations = normalizeDestinations(nextItems || []);
    destinationsById = new Map(destinations.map((d) => [d.id, d]));
    renderDestinationList();
    extractAllTags();
    initTravelStatuses();
  }

  async function initDestinations() {
    try {
      const admin = window.DMZDestinations;
      if (admin && typeof admin.getBaseItems === "function") {
        const adminItems = admin.getBaseItems() || [];
        applyDestinationState(adminItems);
        if (!adminUnsubscribe && typeof admin.subscribe === "function") {
          adminUnsubscribe = admin.subscribe((next) => {
            applyDestinationState(next);
          });
        }
        return;
      }
      const data = await loadDestinationsFromApi("/api/v2/destinations");
      applyDestinationState(data);
    } catch (err) {
      console.error("Failed to load destinations:", err);
      applyDestinationState([]);
    }
  }

  window.addEventListener("dmz:destinations-updated", () => {
    initDestinations();
  });

  function renderDestinationList() {
    const listEl = document.getElementById("destinationList");
    if (!listEl) return;

    listEl.innerHTML = "";

    const visible = getVisibleDestinations();
    const sorted = [...visible].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

    sorted.forEach((dest) => {
      const item = document.createElement("a");
      item.className = "destination-item";
      item.href = `./destination.html?id=${encodeURIComponent(dest.id)}`;
      item.setAttribute("aria-label", `View details for ${formatDestinationName(dest.name)}`);

      const title = document.createElement("div");
      title.className = "destination-item-title";
      title.textContent = formatDestinationName(dest.name);

      const sub = document.createElement("div");
      sub.className = "destination-item-sub";
      sub.textContent = dest.subtitle || "Tap to view details.";

      const tags = document.createElement("div");
      tags.className = "destination-item-tags";
      (dest.tags || []).slice(0, 4).forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "destination-tag";
        chip.textContent = tag;
        tags.appendChild(chip);
      });

      item.appendChild(title);
      item.appendChild(sub);
      item.appendChild(tags);
      listEl.appendChild(item);
    });

    // Show empty state if filtered to nothing
    const emptyEl = document.getElementById("destinationListEmpty");
    if (emptyEl) emptyEl.hidden = sorted.length > 0;
  }

  // -------------------------
  // Globe parameters
  // -------------------------
  let rotY = 0;
  let rotX = -0.20;

  const GLOBE_CONFIG = {
    pinLonOffsetDeg: 1.75,
    pinLatOffsetDeg: -0.75,
  };

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  let isInteracting = false;
  const IDLE_ROTATE_SPEED = 0.00035;
  let rafId = null;
  let autoRotateEnabled = true;

  let pinHit = [];
  let hoverPinId = null;
  let pinDragging = null;
  let pinDragMoved = false;

  let mobileInspectPinId = null;

  let pinClusterOfId = new Map();
  let pinRepIdByComp = new Map();
  let pinOverlapIds = new Set();

  // Zoom
  let zoom = 1.0;
  let zoomTarget = 1.0;
  let wheelDbgDY = 0;
  let wheelDbgOver = false;

  const ZOOM_MIN = 1.0;
  const ZOOM_MAX = 6.0;
  const LABELS_SHOW_AT_ZOOM = 1.35;

  let rotYTarget = rotY;
  let rotXTarget = rotX;

  // 2.0: Inertia
  let frameCount = 0;
  let velX = 0;
  let velY = 0;
  const FRICTION = 0.88;
  const VEL_STOP = 0.00006;

  // 2.0: Filters + search
  let activeFilters = new Set();
  let searchQuery = "";
  let allTags = [];

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function setZoomTarget(next) {
    zoomTarget = clamp(next, ZOOM_MIN, ZOOM_MAX);
  }

  function zoomBy(factor) {
    setZoomTarget(zoomTarget * factor);
  }

  // -------------------------
  // 2.0: Globe navigation
  // -------------------------
  function resetGlobeView() {
    rotYTarget = 0;
    rotXTarget = -0.20;
    setZoomTarget(1.0);
    velX = 0;
    velY = 0;
  }

  function flyToDestination(dest) {
    const lam = (-dest.lon * Math.PI) / 180;
    const phi = (-dest.lat * Math.PI) / 180;
    // Center this longitude on screen: rotY = lam - π/2
    const targetRotY = lam - Math.PI / 2;
    // Go the short way around
    let dy = targetRotY - rotY;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    rotYTarget = rotY + dy;
    rotXTarget = clamp(phi * 0.65, -1.10, 1.10);
    if (zoomTarget < 1.8) setZoomTarget(2.0);
    velX = 0;
    velY = 0;
  }

  // -------------------------
  // 2.0: Filter + search system
  // -------------------------
  function getVisibleDestinations() {
    let list = destinations;
    if (activeFilters.size > 0) {
      list = list.filter((d) => d.tags.some((t) => activeFilters.has(t)));
    }
    if (searchQuery) {
      const q = normalizeText(searchQuery);
      list = list.filter(
        (d) =>
          normalizeText(d.name).includes(q) ||
          normalizeText(d.subtitle).includes(q)
      );
    }
    return list;
  }

  function extractAllTags() {
    const tagSet = new Set();
    destinations.forEach((d) => d.tags.forEach((t) => { if (t) tagSet.add(t); }));
    allTags = Array.from(tagSet).sort();
    buildFilterPills();
    updateGlobeStats();
  }

  function buildFilterPills() {
    const container = document.getElementById("globeFilterPills");
    if (!container) return;
    container.innerHTML = "";

    allTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.className = "globe-filter-pill" + (activeFilters.has(tag) ? " is-active" : "");
      btn.type = "button";
      btn.textContent = tag;
      btn.addEventListener("click", () => {
        if (activeFilters.has(tag)) activeFilters.delete(tag);
        else activeFilters.add(tag);
        buildFilterPills();
        renderDestinationList();
        updateGlobeStats();
      });
      container.appendChild(btn);
    });

    if (activeFilters.size > 0 || searchQuery.length > 0) {
      const clearBtn = document.createElement("button");
      clearBtn.className = "globe-filter-pill globe-filter-clear";
      clearBtn.type = "button";
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        activeFilters.clear();
        searchQuery = "";
        const searchEl = document.getElementById("globeSearch");
        if (searchEl) searchEl.value = "";
        buildFilterPills();
        renderDestinationList();
        updateGlobeStats();
      });
      container.appendChild(clearBtn);
    }
  }

  function updateGlobeStats() {
    const statsEl = document.getElementById("globeStatsBar");
    if (!statsEl) return;

    let active = 0, soon = 0, planned = 0;
    let nextDest = null, nextDays = Infinity;

    destinations.forEach((d) => {
      const status = destinationTripStatusById.get(d.id);
      if (!status) return;
      if (status.state === TRIP_STATUS.active) {
        active++;
      } else if (status.state === TRIP_STATUS.soon) {
        soon++;
        if (status.daysUntil !== null && status.daysUntil < nextDays) {
          nextDays = status.daysUntil;
          nextDest = d;
        }
      } else if (status.state === TRIP_STATUS.planned) {
        planned++;
        if (status.daysUntil !== null && status.daysUntil < nextDays) {
          nextDays = status.daysUntil;
          nextDest = d;
        }
      }
    });

    const total = destinations.length;
    const parts = [`<span>${total} destination${total !== 1 ? "s" : ""}</span>`];
    if (active > 0) parts.push(`<span class="globe-stat-active">${active} active</span>`);
    if (soon > 0) parts.push(`<span class="globe-stat-soon">${soon} soon</span>`);
    if (planned > 0) parts.push(`<span class="globe-stat-planned">${planned} planned</span>`);
    if (nextDest && nextDays < Infinity) {
      parts.push(`<span>next: <strong>${formatDestinationName(nextDest.name)}</strong> in ${nextDays}d</span>`);
    }
    statsEl.innerHTML = parts.join('<span class="globe-stat-dot">&middot;</span>');
  }

  function initSearchWiring() {
    const searchEl = document.getElementById("globeSearch");
    if (!searchEl) return;
    searchEl.addEventListener("input", () => {
      searchQuery = searchEl.value.trim();
      buildFilterPills();
      renderDestinationList();
      updateGlobeStats();
    });
    searchEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const visible = getVisibleDestinations();
      if (visible.length === 1) {
        flyToDestination(visible[0]);
        autoRotateEnabled = false;
      }
    });
  }

  function initHomeButton() {
    const btn = document.getElementById("globeHomeBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      resetGlobeView();
      autoRotateEnabled = true;
    });
  }

  // -------------------------
  // Theme colors
  // -------------------------
  const bg = "#050B14";
  const line = "rgba(255,255,255,0.10)";
  const glow = "rgba(85,185,255,0.20)";
  const text = "rgba(234,242,255,0.92)";
  const muted = "rgba(234,242,255,0.62)";

  // -------------------------
  // Texture helpers
  // -------------------------
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let globeTex = null;
  let globeTexData = null;
  let sphereBuf = null;
  let sphereBufCtx = null;
  let sphereSize = 0;

  let earthImgLoaded = false;
  let earthImgLoading = false;

  function buildGlobeTexture(size = 768) {
    const tex = document.createElement("canvas");
    tex.width = size;
    tex.height = size;
    const tctx = tex.getContext("2d");

    const og = tctx.createLinearGradient(0, 0, 0, size);
    og.addColorStop(0, "rgba(12, 55, 120, 1)");
    og.addColorStop(0.6, "rgba(8, 35, 85, 1)");
    og.addColorStop(1, "rgba(5, 18, 45, 1)");
    tctx.fillStyle = og;
    tctx.fillRect(0, 0, size, size);

    const rnd = mulberry32(1337);
    tctx.globalAlpha = 0.08;
    tctx.fillStyle = "rgba(255,255,255,1)";
    for (let i = 0; i < 1200; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const rr = rnd() * 1.6;
      tctx.beginPath();
      tctx.arc(x, y, rr, 0, Math.PI * 2);
      tctx.fill();
    }
    tctx.globalAlpha = 1;

    tctx.globalAlpha = 0.85;
    tctx.fillStyle = "rgba(35,140,85,1)";
    tctx.beginPath();
    tctx.ellipse(size * 0.25, size * 0.55, size * 0.10, size * 0.07, 0, 0, Math.PI * 2);
    tctx.fill();
    tctx.beginPath();
    tctx.ellipse(size * 0.62, size * 0.42, size * 0.12, size * 0.08, 0, 0, Math.PI * 2);
    tctx.fill();
    tctx.globalAlpha = 1;

    return tex;
  }

  function loadEarthTexture() {
    if (earthImgLoaded || earthImgLoading) return;
    earthImgLoading = true;

    const img = new Image();
    img.src = "/assets/images/globe/earth.png";

    img.onload = () => {
      const tex = document.createElement("canvas");
      tex.width = img.naturalWidth;
      tex.height = img.naturalHeight;

      const tctx = tex.getContext("2d", { willReadFrequently: true });
      tctx.drawImage(img, 0, 0);

      globeTex = tex;
      globeTexData = null;
      earthImgLoaded = true;
      earthImgLoading = false;
    };

    img.onerror = () => {
      earthImgLoading = false;
      earthImgLoaded = false;
    };
  }

  function ensureSphereBuffer(sizePx) {
    if (sphereBuf && sphereSize === sizePx) return;
    sphereSize = sizePx;
    sphereBuf = document.createElement("canvas");
    sphereBuf.width = sizePx;
    sphereBuf.height = sizePx;
    sphereBufCtx = sphereBuf.getContext("2d", { willReadFrequently: true });
  }

  function ensureTextureData() {
    loadEarthTexture();
    if (!globeTex) globeTex = buildGlobeTexture(768);

    if (!globeTexData) {
      const tctx = globeTex.getContext("2d", { willReadFrequently: true });
      globeTexData = tctx.getImageData(0, 0, globeTex.width, globeTex.height).data;
    }
  }

  // -------------------------
  // Earth rendering: sphere-mapped texture
  // -------------------------
  function drawMappedEarth(cx, cy, r) {
    ensureTextureData();

    const zoomScale = zoom > 1 ? 1 / (zoom * 0.9) : 1;
    const bufSize = Math.max(220, Math.min(700, Math.round(r * 2 * zoomScale)));
    ensureSphereBuffer(bufSize);

    const w = sphereBuf.width;
    const h = sphereBuf.height;
    const rad = w * 0.5;
    const invRad = 1 / rad;

    const img = sphereBufCtx.createImageData(w, h);
    const out = img.data;

    const tw = globeTex.width;
    const th = globeTex.height;
    const tdat = globeTexData;

    const cyR = Math.cos(-rotY), syR = Math.sin(-rotY);
    const cxR = Math.cos(-rotX), sxR = Math.sin(-rotX);

    let idx = 0;
    for (let j = 0; j < h; j++) {
      const yy = (j - rad + 0.5) * invRad;
      const yy2 = yy * yy;

      for (let i = 0; i < w; i++) {
        const xx = (i - rad + 0.5) * invRad;
        const d2 = xx * xx + yy2;

        if (d2 > 1) {
          out[idx + 3] = 0;
          idx += 4;
          continue;
        }

        const zz = Math.sqrt(1 - d2);

        const y1 = yy * cxR - zz * sxR;
        const z1 = yy * sxR + zz * cxR;
        const x1 = xx;

        const x2 = x1 * cyR + z1 * syR;
        const z2 = -x1 * syR + z1 * cyR;
        const y2 = y1;

        const lon = Math.atan2(z2, x2);
        const lat = Math.asin(Math.max(-1, Math.min(1, y2)));

        let u = 0.5 - (lon / (Math.PI * 2));
        let v = 0.5 + (lat / Math.PI);

        u = u - Math.floor(u);
        v = Math.max(0, Math.min(1, v));

        const tx = (u * (tw - 1)) | 0;
        const ty = (v * (th - 1)) | 0;
        const tIndex = (ty * tw + tx) * 4;

        const light = 0.65 + 0.35 * zz;

        out[idx]     = (tdat[tIndex]     * light) | 0;
        out[idx + 1] = (tdat[tIndex + 1] * light) | 0;
        out[idx + 2] = (tdat[tIndex + 2] * light) | 0;
        out[idx + 3] = 255;

        idx += 4;
      }
    }

    sphereBufCtx.putImageData(img, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(sphereBuf, cx - r, cy - r, 2 * r, 2 * r);
    ctx.restore();
  }

  // -------------------------
  // Projection helpers
  // -------------------------
  function project(lat, lon, cx, cy, r) {
    const phi = (-lat * Math.PI) / 180;
    const lam = (-lon * Math.PI) / 180;

    const x0 = Math.cos(phi) * Math.cos(lam);
    const y0 = Math.sin(phi);
    const z0 = Math.cos(phi) * Math.sin(lam);

    const x1 = x0 * Math.cos(rotY) + z0 * Math.sin(rotY);
    const z1 = -x0 * Math.sin(rotY) + z0 * Math.cos(rotY);

    const y2 = y0 * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = y0 * Math.sin(rotX) + z1 * Math.cos(rotX);

    return { x: cx + x1 * r, y: cy + y2 * r, z: z2, scale: 1 };
  }

  function projectPinOnEarth(lat, lon, cx, cy, r) {
    const phi = (-(lat + GLOBE_CONFIG.pinLatOffsetDeg) * Math.PI) / 180;
    const lam = (-(lon + GLOBE_CONFIG.pinLonOffsetDeg) * Math.PI) / 180;

    const x0 = Math.cos(phi) * Math.cos(lam);
    const y0 = Math.sin(phi);
    const z0 = Math.cos(phi) * Math.sin(lam);

    const x1 = x0 * Math.cos(rotY) + z0 * Math.sin(rotY);
    const z1 = -x0 * Math.sin(rotY) + z0 * Math.cos(rotY);

    const y2 = y0 * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = y0 * Math.sin(rotX) + z1 * Math.cos(rotX);

    if (z2 <= 0) return null;

    return { x: cx + x1 * r, y: cy + y2 * r, z: z2, scale: 1 };
  }

  function unprojectToLatLon(x, y, cx, cy, r) {
    const nx = (x - cx) / r;
    const ny = (y - cy) / r;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) return null;

    const nz = Math.sqrt(1 - d2);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y1 = ny * cosX + nz * sinX;
    const z1 = -ny * sinX + nz * cosX;
    const x1 = nx;

    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x0 = x1 * cosY - z1 * sinY;
    const z0 = x1 * sinY + z1 * cosY;
    const y0 = y1;

    const lat = -Math.asin(Math.max(-1, Math.min(1, y0))) * (180 / Math.PI);
    const lon = -Math.atan2(z0, x0) * (180 / Math.PI);

    return {
      lat: lat - GLOBE_CONFIG.pinLatOffsetDeg,
      lon: lon - GLOBE_CONFIG.pinLonOffsetDeg,
    };
  }

  function normalizeLon(value) {
    let lon = value;
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return lon;
  }

  // -------------------------
  // 2.0: Visual effects
  // -------------------------
  function drawStarField(w, h) {
    const rnd = mulberry32(0xDEAD42);
    const count = 180;
    for (let i = 0; i < count; i++) {
      const sx = rnd() * w;
      const sy = rnd() * h;
      const size = rnd() * 1.5 + 0.3;
      const base = rnd() * 0.55 + 0.18;
      const twinkle = base * (0.72 + 0.28 * Math.sin(frameCount * 0.022 + i * 1.73));
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,228,255,${twinkle.toFixed(3)})`;
      ctx.fill();
    }
  }

  function drawAtmosphere(cx, cy, r) {
    const inner = r * 0.92;
    const outer = r * 1.16;
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    grad.addColorStop(0, "rgba(50,130,255,0.00)");
    grad.addColorStop(0.40, "rgba(55,140,255,0.20)");
    grad.addColorStop(0.72, "rgba(30,90,200,0.09)");
    grad.addColorStop(1, "rgba(10,40,140,0.00)");
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function drawNightSide(cx, cy, r) {
    // Simulate a fixed sun from upper-right; darkens the opposite hemisphere edges
    const grad = ctx.createRadialGradient(
      cx + r * 0.30, cy - r * 0.14, r * 0.30,
      cx, cy, r * 1.01
    );
    grad.addColorStop(0,    "rgba(0,0,0,0.00)");
    grad.addColorStop(0.58, "rgba(0,0,0,0.00)");
    grad.addColorStop(1,    "rgba(0,4,18,0.52)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // -------------------------
  // Draw globe + grid
  // -------------------------
  function drawGlobe(cx, cy, r) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Star field behind the globe
    drawStarField(w, h);

    // Ambient glow halo
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Earth texture sphere
    drawMappedEarth(cx, cy, r);

    // Night-side depth gradient
    drawNightSide(cx, cy, r);

    // Atmospheric rim
    drawAtmosphere(cx, cy, r);

    // Globe outline
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Latitude grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";

    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 6) {
        const p = project(lat, lon, cx, cy, r);
        if (p.z > 0) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    // Longitude grid
    for (let lon = -150; lon <= 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -85; lat <= 85; lat += 3) {
        const p = project(lat, lon, cx, cy, r);
        if (p.z > 0) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
  }

  // -------------------------
  // Draw pins + labels + cluster behavior
  // -------------------------
  function drawPins(cx, cy, r) {
    pinHit = [];

    const showLabels = zoom >= LABELS_SHOW_AT_ZOOM;

    pinClusterOfId = new Map();
    pinRepIdByComp = new Map();
    pinOverlapIds = new Set();

    function boxesOverlap(a, b) {
      return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
    }

    const visibleDests = getVisibleDestinations();

    const pinProjections = visibleDests
      .map((d) => ({ d, p: projectPinOnEarth(d.lat, d.lon, cx, cy, r) }))
      .filter((item) => item.p)
      .sort((a, b) => a.p.z - b.p.z); // far -> near

    const zById = new Map(pinProjections.map(({ d, p }) => [d.id, p.z]));
    const compOfId = new Map();
    const repIdByComp = new Map();

    const labelBoxesById = new Map();
    const overlapIds = new Set();

    if (showLabels) {
      ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      for (const { d, p } of pinProjections) {
        const s = Math.max(0.85, Math.min(1.25, 1.05 + p.z * 0.35));
        const sink = 2.0 * s;

        const label = formatDestinationName(d.name).split(",")[0];
        const lx = p.x + 12;
        const ly = p.y - 20 * s + sink;

        const m = ctx.measureText(label);
        const padX = 2;
        const halfH = 7;

        labelBoxesById.set(d.id, {
          id: d.id, label, lx, ly,
          x1: lx - padX, y1: ly - halfH,
          x2: lx + m.width + padX, y2: ly + halfH,
        });
      }

      const boxes = Array.from(labelBoxesById.values());

      const parent = new Map();
      for (const b of boxes) parent.set(b.id, b.id);

      const find = (x) => {
        let p = parent.get(x);
        if (p === x) return x;
        p = find(p);
        parent.set(x, p);
        return p;
      };

      const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(rb, ra);
      };

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (boxesOverlap(boxes[i], boxes[j])) {
            overlapIds.add(boxes[i].id);
            overlapIds.add(boxes[j].id);
            union(boxes[i].id, boxes[j].id);
          }
        }
      }

      const membersByRoot = new Map();
      for (const b of boxes) {
        const root = find(b.id);
        compOfId.set(b.id, root);
        if (!membersByRoot.has(root)) membersByRoot.set(root, []);
        membersByRoot.get(root).push(b.id);
      }

      for (const [root, members] of membersByRoot.entries()) {
        const overlappingMembers = members.filter((id) => overlapIds.has(id));
        if (overlappingMembers.length < 2) continue;

        let bestId = overlappingMembers[0];
        let bestZ = zById.get(bestId) ?? -Infinity;

        for (const id of overlappingMembers) {
          const z = zById.get(id) ?? -Infinity;
          if (z > bestZ) { bestZ = z; bestId = id; }
        }

        repIdByComp.set(root, bestId);
      }

      pinClusterOfId = compOfId;
      pinRepIdByComp = repIdByComp;
      pinOverlapIds = overlapIds;
    }

    for (const { d, p } of pinProjections) {
      const tripStatus = destinationTripStatusById.get(d.id) || { state: TRIP_STATUS.none };
      const pinColor = PIN_COLORS[tripStatus.state] || PIN_COLORS.none;
      const s = Math.max(0.85, Math.min(1.25, 1.05 + p.z * 0.35));
      const pinR = 7 * s;
      const sink = 2.0 * s;
      const py = p.y - 20 * s + sink;

      // 2.0: Animated rings for active / soon pins (drawn behind the pin head)
      if (tripStatus.state === TRIP_STATUS.active) {
        const phase = (frameCount % 75) / 75;
        const rippleR = pinR * (1 + phase * 2.4);
        const rippleA = (1 - phase) * 0.70;
        ctx.beginPath();
        ctx.arc(p.x, py, rippleR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(35,209,143,${rippleA.toFixed(3)})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      if (tripStatus.state === TRIP_STATUS.soon) {
        const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.06);
        ctx.beginPath();
        ctx.arc(p.x, py, pinR + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,193,69,${(0.22 + pulse * 0.38).toFixed(3)})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Stem (from just below pin head down to earth surface)
      ctx.beginPath();
      ctx.moveTo(p.x, py + 2 * s);
      ctx.lineTo(p.x, py + 14 * s);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pin head
      ctx.beginPath();
      ctx.arc(p.x, py, pinR, 0, Math.PI * 2);
      ctx.fillStyle = pinColor;
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(p.x, py, 3.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = PIN_INNER_DOT;
      ctx.fill();

      // Label
      if (showLabels) {
        const isOverlapping = overlapIds.has(d.id);
        let shouldShow = false;

        if (!isOverlapping) {
          shouldShow = true;
        } else {
          const myComp = compOfId.get(d.id) ?? d.id;
          const hoverComp = hoverPinId ? (compOfId.get(hoverPinId) ?? hoverPinId) : null;
          const inspectComp = mobileInspectPinId
            ? (compOfId.get(mobileInspectPinId) ?? mobileInspectPinId)
            : null;

          if (mobileInspectPinId && inspectComp === myComp) {
            shouldShow = d.id === mobileInspectPinId;
          } else if (hoverPinId && hoverComp === myComp) {
            shouldShow = d.id === hoverPinId;
          } else {
            const rep = repIdByComp.get(myComp);
            shouldShow = rep ? d.id === rep : false;
          }
        }

        if (shouldShow) {
          const b = labelBoxesById.get(d.id);
          if (b) {
            ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            ctx.fillStyle = text;
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(b.label, b.lx, b.ly);
          }
        }
      }

      // Hit target
      pinHit.push({
        id: d.id,
        name: formatDestinationName(d.name),
        x: p.x,
        y: py,
        r: 16 * s,
      });
    }

    // Hovered label pill (drawn last, always on top)
    if (showLabels && hoverPinId && labelBoxesById.has(hoverPinId)) {
      const b = labelBoxesById.get(hoverPinId);
      if (b) {
        const padX = 6;
        const padY = 4;
        const pillW = (b.x2 - b.x1) + padX * 2;
        const pillH = (b.y2 - b.y1) + padY * 2;
        const pillX = b.x1 - padX;
        const pillY = b.y1 - padY;
        const radius = pillH * 0.5;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pillX + radius, pillY);
        ctx.lineTo(pillX + pillW - radius, pillY);
        ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + radius);
        ctx.lineTo(pillX + pillW, pillY + pillH - radius);
        ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - radius, pillY + pillH);
        ctx.lineTo(pillX + radius, pillY + pillH);
        ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - radius);
        ctx.lineTo(pillX, pillY + radius);
        ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
        ctx.closePath();
        ctx.fillStyle = "rgba(5, 11, 20, 0.88)";
        ctx.fill();
        ctx.restore();

        ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillStyle = text;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(b.label, b.lx, b.ly);
      }
    }
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const isMobileView = window.innerWidth <= 768;
    const cx = w * 0.5;
    const cy = isMobileView ? h * 0.5 : h * 0.52;

    const baseR = Math.min(w, h) * (isMobileView ? 0.38 : 0.34);
    const r = baseR * zoom;

    drawGlobe(cx, cy, r);
    drawPins(cx, cy, r);

    if (window.innerWidth > 768) {
      ctx.fillStyle = muted;
      ctx.font = "600 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "right";
      ctx.fillText(
        "Drag · Scroll to zoom · Click a pin",
        w - 18,
        h - 18
      );
    }
  }

  function getGlobeMetrics() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const isMobileView = window.innerWidth <= 768;
    const cx = w * 0.5;
    const cy = isMobileView ? h * 0.5 : h * 0.52;
    const baseR = Math.min(w, h) * (isMobileView ? 0.38 : 0.34);
    const r = baseR * zoom;
    return { cx, cy, r };
  }

  // -------------------------
  // Animation loop (2.0: inertia + frame counter)
  // -------------------------
  function animate() {
    frameCount++;
    zoom += (zoomTarget - zoom) * 0.10;

    if (dragging) {
      rotYTarget = rotY;
      rotXTarget = rotX;
    } else if (autoRotateEnabled && !isInteracting) {
      velX = 0;
      velY = 0;
      rotY += IDLE_ROTATE_SPEED;
      rotYTarget = rotY;
    } else {
      const dyTarget = rotYTarget - rotY;
      const dxTarget = rotXTarget - rotX;
      const flyingToTarget = Math.abs(dyTarget) + Math.abs(dxTarget) > 0.008;

      if (flyingToTarget) {
        // Lerp toward zoom-to-destination or keyboard-nav target
        velX = 0;
        velY = 0;
        rotY += dyTarget * 0.12;
        rotX += dxTarget * 0.12;
      } else {
        // Inertia coast after drag release
        if (Math.abs(velX) > VEL_STOP || Math.abs(velY) > VEL_STOP) {
          velX *= FRICTION;
          velY *= FRICTION;
          rotX += velX;
          rotY += velY;
          rotX = clamp(rotX, -1.10, 1.10);
          rotXTarget = rotX;
          rotYTarget = rotY;
        } else {
          velX = 0;
          velY = 0;
        }
      }
    }

    draw();
    rafId = requestAnimationFrame(animate);
  }

  // -------------------------
  // Input: drag rotate
  // -------------------------
  function startDrag(x, y) {
    dragging = true;
    isInteracting = true;
    autoRotateEnabled = false;
    lastX = x;
    lastY = y;
  }

  function endDrag() {
    dragging = false;
    isInteracting = false;
    // Velocity carries over — inertia handled in animate()
  }

  function startPinDrag(pinId) {
    pinDragging = { id: pinId };
    pinDragMoved = false;
    isInteracting = true;
    autoRotateEnabled = false;
  }

  function updatePinDrag(x, y) {
    if (!pinDragging) return;
    const admin = window.DMZDestinations;
    if (!admin || typeof admin.setPinPosition !== "function") return;
    const { cx, cy, r } = getGlobeMetrics();
    const pos = unprojectToLatLon(x, y, cx, cy, r);
    if (!pos) return;
    admin.setPinPosition(pinDragging.id, pos.lat, normalizeLon(pos.lon));
    pinDragMoved = true;
  }

  function endPinDrag() {
    pinDragging = null;
    isInteracting = false;
  }

  function moveDrag(x, y) {
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;

    const dragSpeedFactor = Math.max(0.005, Math.min(1, 1 / (zoom * 0.35)));

    // Track velocity for inertia
    velY = dx * 0.0075 * dragSpeedFactor;
    velX = -(dy * 0.0055 * dragSpeedFactor);

    rotY += velY;
    rotX += velX;

    const maxTilt = 1.10;
    if (rotX > maxTilt) rotX = maxTilt;
    if (rotX < -maxTilt) rotX = -maxTilt;
  }

  canvas.addEventListener("mousedown", (e) => {
    const admin = window.DMZDestinations;
    if (admin && typeof admin.isEditMode === "function" && admin.isEditMode()) {
      const hit = pickPin(e.offsetX, e.offsetY);
      if (hit) {
        startPinDrag(hit.id);
        return;
      }
    }
    startDrag(e.offsetX, e.offsetY);
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (pinDragging) {
      updatePinDrag(x, y);
      canvas.style.cursor = "grabbing";
      return;
    }

    const p = pickPin(x, y);
    hoverPinId = p ? p.id : null;

    canvas.style.cursor = hoverPinId ? "pointer" : (dragging ? "grabbing" : "grab");
  });

  canvas.addEventListener("mouseleave", () => {
    hoverPinId = null;
    canvas.style.cursor = dragging ? "grabbing" : "grab";
  });

  window.addEventListener("mousemove", (e) => {
    if (pinDragging) {
      const rect = canvas.getBoundingClientRect();
      updatePinDrag(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    moveDrag(e.clientX - rect.left, e.clientY - rect.top);
  });

  window.addEventListener("mouseup", () => {
    if (pinDragging) { endPinDrag(); return; }
    endDrag();
  });
  window.addEventListener("mouseleave", () => {
    if (pinDragging) { endPinDrag(); return; }
    endDrag();
  });
  window.addEventListener("blur", () => {
    if (pinDragging) { endPinDrag(); return; }
    endDrag();
  });

  // -------------------------
  // Wheel zoom
  // -------------------------
  function handleWheelZoom(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    const isOverGlobe =
      x >= rect.left && x <= rect.right &&
      y >= rect.top && y <= rect.bottom;

    wheelDbgDY = e.deltaY;
    wheelDbgOver = isOverGlobe;

    if (!isOverGlobe) return;

    e.preventDefault();
    e.stopPropagation();

    const dir = e.deltaY > 0 ? 1 : -1;
    const step = dir > 0 ? 0.90 : 1.10;
    zoomBy(step);

    isInteracting = true;
    autoRotateEnabled = false;
    velX = 0;
    velY = 0;
    clearTimeout(canvas.__zoomIdleT);
    canvas.__zoomIdleT = setTimeout(() => (isInteracting = false), 250);
  }

  document.addEventListener("wheel", handleWheelZoom, { passive: false, capture: true });
  canvas.addEventListener("wheel", handleWheelZoom, { passive: false });

  // -------------------------
  // Touch: 1-finger rotate, 2-finger pinch zoom, tap to select
  // -------------------------
  let pinchActive = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  const TAP_SLOP_PX = 10;
  let tapStartX = 0;
  let tapStartY = 0;
  let tapMoved = false;
  let suppressNextClick = false;

  function touchDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canvas.addEventListener("touchstart", (e) => {
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const t = e.touches[0];
      tapStartX = t.clientX;
      tapStartY = t.clientY;
      tapMoved = false;

      dragging = false;
      isInteracting = true;
      lastX = t.clientX - rect.left;
      lastY = t.clientY - rect.top;

      pinchActive = false;

    } else if (e.touches.length === 2) {
      e.preventDefault();
      mobileInspectPinId = null;

      pinchActive = true;
      dragging = false;
      tapMoved = true;
      isInteracting = true;
      autoRotateEnabled = false;
      velX = 0;
      velY = 0;

      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartZoom = zoomTarget;
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    const rect = canvas.getBoundingClientRect();

    if (pinchActive && e.touches.length === 2) {
      e.preventDefault();
      const d = touchDist(e.touches[0], e.touches[1]);
      if (pinchStartDist > 0) {
        const factor = d / pinchStartDist;
        setZoomTarget(pinchStartZoom * factor);
      }
      return;
    }

    if (e.touches.length !== 1) return;

    e.preventDefault();

    const t = e.touches[0];
    const dx = t.clientX - tapStartX;
    const dy = t.clientY - tapStartY;

    if (dx * dx + dy * dy > TAP_SLOP_PX * TAP_SLOP_PX) {
      if (!tapMoved) {
        tapMoved = true;
        mobileInspectPinId = null;
        startDrag(lastX, lastY);
      }
    }

    if (dragging) {
      moveDrag(t.clientX - rect.left, t.clientY - rect.top);
    } else {
      lastX = t.clientX - rect.left;
      lastY = t.clientY - rect.top;
    }

  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) pinchActive = false;

    if (!pinchActive && !tapMoved && e.changedTouches && e.changedTouches.length) {
      const rect = canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      suppressNextClick = true;
      handlePinTapMobile(x, y);
    }

    if (dragging) endDrag();
    else isInteracting = false;

  }, { passive: true });

  // -------------------------
  // Picking + selection
  // -------------------------
  function pickPin(x, y) {
    for (const p of pinHit) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= p.r * p.r) return p;
    }
    return null;
  }

  function handlePinTapMobile(x, y) {
    const pin = pickPin(x, y);

    if (!pin) {
      mobileInspectPinId = null;
      return;
    }

    const myComp = pinClusterOfId.get(pin.id) ?? pin.id;
    const isClustered = pinRepIdByComp.has(myComp);

    let isBlank = false;

    if (isClustered) {
      if (mobileInspectPinId) {
        const inspectComp =
          pinClusterOfId.get(mobileInspectPinId) ?? mobileInspectPinId;
        if (inspectComp === myComp) {
          isBlank = pin.id !== mobileInspectPinId;
        }
      } else {
        const rep = pinRepIdByComp.get(myComp);
        if (rep) {
          isBlank = pin.id !== rep;
        }
      }
    }

    if (isClustered && isBlank) {
      mobileInspectPinId = pin.id;
      if (zoomTarget < LABELS_SHOW_AT_ZOOM) {
        setZoomTarget(LABELS_SHOW_AT_ZOOM);
      }
      return;
    }

    mobileInspectPinId = null;
    handlePinSelect(x, y);
  }

  function handlePinSelect(x, y) {
    const pin = pickPin(x, y);
    if (!pin) return;

    const dest = destinationsById.get(pin.id);
    if (!dest) return;

    const admin = window.DMZDestinations;
    if (admin && typeof admin.selectId === "function" && admin.isEditMode && admin.isEditMode()) {
      admin.selectId(pin.id);
    }

    const tripStatus = destinationTripStatusById.get(dest.id) || { state: TRIP_STATUS.none };
    const destinationPanel = document.getElementById("destination");
    if (destinationPanel) destinationPanel.hidden = false;

    // Core text fields
    const titleEl = document.getElementById("destTitle");
    const subEl = document.getElementById("destSub");
    const ul = document.getElementById("destBullets");

    if (titleEl) titleEl.textContent = formatDestinationName(dest.name);
    if (subEl) subEl.textContent = dest.subtitle || "";

    // 2.0: Status badge
    const badge = document.getElementById("destStatusBadge");
    if (badge) {
      const labels = {
        none: "No Trip Planned",
        planned: "Trip Planned",
        soon: "Trip Soon",
        active: "Active Trip",
      };
      badge.textContent = labels[tripStatus.state] || "";
      badge.className = `dest-status-badge is-${tripStatus.state}`;
    }

    // 2.0: Tags row
    const tagsRow = document.getElementById("destTagsRow");
    if (tagsRow) {
      tagsRow.innerHTML = "";
      (dest.tags || []).forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "destination-tag";
        chip.textContent = tag;
        tagsRow.appendChild(chip);
      });
    }

    // 2.0: Trip info chip
    const tripInfo = document.getElementById("destTripInfo");
    if (tripInfo) {
      if (tripStatus.state === TRIP_STATUS.active) {
        tripInfo.innerHTML = '<span class="dest-trip-chip is-active">Trip in progress</span>';
      } else if (tripStatus.daysUntil !== null) {
        const d = tripStatus.daysUntil;
        tripInfo.innerHTML = `<span class="dest-trip-chip is-${tripStatus.state}">Next trip in ${d} day${d !== 1 ? "s" : ""}</span>`;
      } else {
        tripInfo.innerHTML = "";
      }
    }

    // 2.0: Hero strip
    const heroStrip = document.getElementById("destHeroStrip");
    const heroImg = document.getElementById("destHeroImg");
    if (heroStrip && heroImg) {
      if (dest.heroImage) {
        heroImg.src = dest.heroImage;
        heroImg.alt = `${formatDestinationName(dest.name)} diving`;
        heroStrip.classList.add("is-loaded");
      } else {
        heroImg.removeAttribute("src");
        heroStrip.classList.remove("is-loaded");
      }
    }

    // Bullets
    if (ul) {
      ul.innerHTML = "";
      (dest.bullets || []).forEach((b) => {
        const li = document.createElement("li");
        li.textContent = b;
        ul.appendChild(li);
      });
    }

    // Iso box
    const iso = document.getElementById("isoBox");
    const isoImg = document.getElementById("isoImage");
    const isoLabel = document.getElementById("isoLabel");
    const isoTitle = document.getElementById("isoTitle");
    const isoDesc = document.getElementById("isoDesc");
    const isoLink = document.getElementById("isoLink");
    const detailsLink = document.getElementById("seeDetails");

    if (isoTitle) isoTitle.textContent = dest.isoTitle || "Resort View (Isometric)";
    if (isoDesc) {
      isoDesc.textContent = dest.isoDesc || "Select a destination to load the resort view.";
    }

    if (iso) {
      if (isoImg) {
        if (dest.isoImage) {
          isoImg.src = dest.isoImage;
          isoImg.alt = `Isometric view of ${formatDestinationName(dest.name)}`;
          iso.classList.add("is-loaded");
          if (isoLabel) isoLabel.textContent = "Select a destination to preview.";
        } else {
          isoImg.removeAttribute("src");
          isoImg.alt = "";
          iso.classList.remove("is-loaded");
          if (isoLabel) isoLabel.textContent = `${formatDestinationName(dest.name)} photos coming soon.`;
        }
      }
      iso.classList.remove("is-pulse");
      void iso.offsetWidth;
      iso.classList.add("is-pulse");
    }

    if (isoLink) {
      isoLink.href = `./destination.html?id=${encodeURIComponent(dest.id || "")}`;
    }
    if (detailsLink) {
      detailsLink.href = `./destination.html?id=${encodeURIComponent(dest.id || "")}`;
      detailsLink.removeAttribute("aria-disabled");
      detailsLink.removeAttribute("tabindex");
    }

    const mediaLink = document.getElementById("relatedMediaLink");
    if (mediaLink) {
      const param = encodeURIComponent(dest.id || dest.name || "");
      mediaLink.href = param ? `../media/index.html?location=${param}` : "../media/index.html";
    }

    // 2.0: Fly globe to this destination
    flyToDestination(dest);

    // Scroll to destination panel
    const scrollToDestHeader = () => {
      const tEl = document.getElementById("destTitle");
      if (!tEl) return;
      const headerEl = document.querySelector(".site-header");
      const headerH = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 0;
      const pad = 12;
      const yPos = window.scrollY + tEl.getBoundingClientRect().top - headerH - pad;
      window.scrollTo({ top: Math.max(0, yPos), behavior: "smooth" });
    };

    requestAnimationFrame(() => requestAnimationFrame(scrollToDestHeader));
  }

  canvas.addEventListener("click", (e) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (pinDragMoved) {
      pinDragMoved = false;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePinSelect(x, y);
  });

  // -------------------------
  // 2.0: Keyboard navigation
  // -------------------------
  document.addEventListener("keydown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;

    // Don't steal keys when user is typing in a form field (except the globe itself)
    const active = document.activeElement;
    if (active && active !== document.body && active.tagName !== "CANVAS" &&
        !active.closest("#globeWrap")) return;

    const ROT_STEP = 0.08;

    switch (e.key) {
      case "ArrowLeft":
        rotYTarget -= ROT_STEP;
        velX = 0; velY = 0;
        autoRotateEnabled = false;
        e.preventDefault();
        break;
      case "ArrowRight":
        rotYTarget += ROT_STEP;
        velX = 0; velY = 0;
        autoRotateEnabled = false;
        e.preventDefault();
        break;
      case "ArrowUp":
        rotXTarget = clamp(rotXTarget - ROT_STEP, -1.10, 1.10);
        velX = 0; velY = 0;
        autoRotateEnabled = false;
        e.preventDefault();
        break;
      case "ArrowDown":
        rotXTarget = clamp(rotXTarget + ROT_STEP, -1.10, 1.10);
        velX = 0; velY = 0;
        autoRotateEnabled = false;
        e.preventDefault();
        break;
      case "+":
      case "=":
        zoomBy(1.15);
        autoRotateEnabled = false;
        break;
      case "-":
        zoomBy(1 / 1.15);
        break;
      case "Escape":
      case "Home":
        resetGlobeView();
        autoRotateEnabled = true;
        break;
    }
  });

  // -------------------------
  // Boot
  // -------------------------
  initDestinations().then(() => {
    initSearchWiring();
    initHomeButton();
    const globeWrap = document.getElementById("globeWrap");
    let globeStarted = false;
    const startGlobe = () => {
      if (globeStarted) return;
      globeStarted = true;
      animate();
    };

    if (!globeWrap || !("IntersectionObserver" in window)) {
      startGlobe();
      return;
    }

    const globeObserver = new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      startGlobe();
    }, { rootMargin: "320px 0px" });
    globeObserver.observe(globeWrap);
  });
})();
