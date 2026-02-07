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

// Mobile = square, Desktop = cinematic
const isMobile = window.innerWidth <= 768;
const targetH = wrap && !isMobile ? wrap.clientHeight : (isMobile ? targetW : Math.round(targetW * 0.56));


    canvas.style.width = targetW + "px";
    canvas.style.height = targetH + "px";

    canvas.width = targetW * DPR;
    canvas.height = targetH * DPR;

    // Draw in CSS pixels
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
      isoImage: typeof d.isoImage === "string" ? d.isoImage : "",
      isoTitle: typeof d.isoTitle === "string" ? d.isoTitle : "",
      isoDesc: typeof d.isoDesc === "string" ? d.isoDesc : "",
    }));
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

  async function initDestinations() {
    try {
      const data = await loadDestinationsFromApi("/api/v2/destinations");
      destinations = data;
      destinationsById = new Map(destinations.map((d) => [d.id, d]));
      renderDestinationList();
    } catch (err) {
      console.error("Failed to load destinations:", err);
      destinations = [];
      destinationsById = new Map();
      renderDestinationList();
    }
  }

  function renderDestinationList() {
    const listEl = document.getElementById("destinationList");
    if (!listEl) return;

    listEl.innerHTML = "";

    const sorted = [...destinations].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

    sorted.forEach((dest) => {
      const item = document.createElement("a");
      item.className = "destination-item";
      item.href = `./destination.html?id=${encodeURIComponent(dest.id)}`;
      item.setAttribute("aria-label", `View details for ${dest.name}`);

      const title = document.createElement("div");
      title.className = "destination-item-title";
      title.textContent = dest.name || "Destination";

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
  }

  // -------------------------
  // Globe parameters
  // -------------------------
  let rotY = 0;      // longitude rotation
  let rotX = -0.20;  // tilt

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
  let autoRotateEnabled = true; // stops forever after first drag

  // Clickable pin hit targets
  let pinHit = [];

  // Desktop hover: which pin is currently under the cursor
  let hoverPinId = null;

  let pinDragging = null;
  let pinDragMoved = false;

  // -------------------------
  // Mobile cluster "inspect" (tap once reveals label, tap again selects)
  // -------------------------
  let mobileInspectPinId = null;

  // Cluster metadata (refreshed inside drawPins when labels are on)
  let pinClusterOfId = new Map(); // pinId -> componentRootId
  let pinRepIdByComp = new Map(); // componentRootId -> representativePinId
  let pinOverlapIds = new Set();  // ids participating in any overlap

  // -------------------------
  // Zoom + focus (smooth targets)
  // -------------------------
  let zoom = 1.0;
  let zoomTarget = 1.0;

  // Debug (desktop wheel)
  let wheelDbgDY = 0;
  let wheelDbgOver = false;

  const ZOOM_MIN = 1.0;
  const ZOOM_MAX = 6.0;
  const LABELS_SHOW_AT_ZOOM = 1.35;

  // Smoothly animate rotation toward a target (reserved for future focus)
  let rotYTarget = rotY;
  let rotXTarget = rotX;

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
  // Theme colors
  // -------------------------
  const bg = "#050B14";
  const line = "rgba(255,255,255,0.10)";
  const glow = "rgba(85,185,255,0.20)";
  const text = "rgba(234,242,255,0.92)";
  const muted = "rgba(234,242,255,0.62)";
  const pinRed = "rgba(226,27,35,0.95)";
  const pinBlue = "rgba(85,185,255,0.92)";

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

  let globeTex = null;       // canvas containing the texture
  let globeTexData = null;   // Uint8ClampedArray pixel data
  let sphereBuf = null;      // offscreen sphere render
  let sphereBufCtx = null;
  let sphereSize = 0;

  let earthImgLoaded = false;
  let earthImgLoading = false;

  function buildGlobeTexture(size = 768) {
    // Procedural fallback if image fails to load
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

    // simple “land”
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
    img.src = "/assets/images/globe/earth.png"; // ensure this path exists

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
      // fallback stays procedural
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

    // Inverse rotation (camera -> globe space)
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

        const zz = Math.sqrt(1 - d2); // front hemisphere

        // Undo X rotation
        const y1 = yy * cxR - zz * sxR;
        const z1 = yy * sxR + zz * cxR;
        const x1 = xx;

        // Undo Y rotation
        const x2 = x1 * cyR + z1 * syR;
        const z2 = -x1 * syR + z1 * cyR;
        const y2 = y1;

        const lon = Math.atan2(z2, x2);
        const lat = Math.asin(Math.max(-1, Math.min(1, y2)));

        // U flip + V flip
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
  // Draw globe + grid
  // -------------------------
  function drawGlobe(cx, cy, r) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // glow behind globe
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Earth body
    drawMappedEarth(cx, cy, r);

    // outline
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.stroke();

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";

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

    // Clear cluster metadata unless recomputed this frame
    pinClusterOfId = new Map();
    pinRepIdByComp = new Map();
    pinOverlapIds = new Set();

    function boxesOverlap(a, b) {
      return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
    }

    const pinProjections = destinations
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

        const label = d.name.split(",")[0];
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

      // Union-Find
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

      // Build members by root
      const membersByRoot = new Map();
      for (const b of boxes) {
        const root = find(b.id);
        compOfId.set(b.id, root);
        if (!membersByRoot.has(root)) membersByRoot.set(root, []);
        membersByRoot.get(root).push(b.id);
      }

      // Representative label per overlapping cluster (highest z)
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

      // Export cluster metadata for mobile tap-to-inspect
      pinClusterOfId = compOfId;
      pinRepIdByComp = repIdByComp;
      pinOverlapIds = overlapIds;
    }

    for (const { d, p } of pinProjections) {
      const s = Math.max(0.85, Math.min(1.25, 1.05 + p.z * 0.35));
      const pinR = 7 * s;
      const sink = 2.0 * s;

      // stem
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 18 * s + sink);
      ctx.lineTo(p.x, p.y - 6 * s + sink);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // head
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20 * s + sink, pinR, 0, Math.PI * 2);
      ctx.fillStyle = pinRed;
      ctx.fill();

      // inner dot
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20 * s + sink, 3.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = pinBlue;
      ctx.fill();

      // label
      if (showLabels) {
        const isOverlapping = overlapIds.has(d.id);
        let shouldShow = false;

        if (!isOverlapping) {
          // Never overlapping: always show
          shouldShow = true;
        } else {
          const myComp = compOfId.get(d.id) ?? d.id;
          const hoverComp = hoverPinId ? (compOfId.get(hoverPinId) ?? hoverPinId) : null;

          // Mobile inspect: show only inspected label in that cluster
          const inspectComp = mobileInspectPinId
            ? (compOfId.get(mobileInspectPinId) ?? mobileInspectPinId)
            : null;

          if (mobileInspectPinId && inspectComp === myComp) {
            shouldShow = d.id === mobileInspectPinId;
          } else if (hoverPinId && hoverComp === myComp) {
            // Desktop hover: show only hovered label in that cluster
            shouldShow = d.id === hoverPinId;
          } else {
            // Default: show representative label for overlapping cluster
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

      // hit target
      pinHit.push({
        id: d.id,
        name: d.name,
        x: p.x,
        y: p.y - 20 * s + sink,
        r: 16 * s,
      });
    }

    // Draw hovered label last so it stays on top of other pins/labels.
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
        ctx.fillStyle = "rgba(5, 11, 20, 0.85)";
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

// Desktop-only hint (mobile uses static text above the globe)
if (window.innerWidth > 768) {
  ctx.fillStyle = muted;
  ctx.font = "600 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "right";
  ctx.fillText(
    "Drag to rotate. Click a pin to view destination.",
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
  // Animation loop
  // -------------------------
  function animate() {
    zoom += (zoomTarget - zoom) * 0.10;

    if (!dragging) {
      rotY += (rotYTarget - rotY) * 0.10;
      rotX += (rotXTarget - rotX) * 0.10;
    } else {
      rotYTarget = rotY;
      rotXTarget = rotX;
    }

    if (autoRotateEnabled && !isInteracting) {
      rotY += IDLE_ROTATE_SPEED;
      rotYTarget = rotY;
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

    // Adjust movement sensitivity based on zoom level
    // When zoomed out, we want the movement to be faster (less sensitivity)
    // When zoomed in, we want the movement to be slower (more sensitivity)
    const dragSpeedFactor = Math.max(0.005, Math.min(1, 1 / (zoom * 0.35)));

    // Scale the drag movement based on the zoom level and drag sensitivity factor
    rotY += dx * 0.0075 * dragSpeedFactor;
    rotX -= dy * 0.0055 * dragSpeedFactor;

    // Constrain the rotation on the X-axis to prevent flipping
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

  // Desktop hover label control
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
    if (pinDragging) {
      endPinDrag();
      return;
    }
    endDrag();
  });
  window.addEventListener("mouseleave", () => {
    if (pinDragging) {
      endPinDrag();
      return;
    }
    endDrag();
  });
  window.addEventListener("blur", () => {
    if (pinDragging) {
      endPinDrag();
      return;
    }
    endDrag();
  });

  // -------------------------
  // Wheel zoom (desktop/trackpad)
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
    clearTimeout(canvas.__zoomIdleT);
    canvas.__zoomIdleT = setTimeout(() => (isInteracting = false), 250);
  }

  document.addEventListener("wheel", handleWheelZoom, { passive: false, capture: true });
  canvas.addEventListener("wheel", handleWheelZoom, { passive: false });

  // -------------------------
  // Touch: 1-finger rotate, 2-finger pinch zoom (+ tap to select pins)
  // -------------------------
  let pinchActive = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  const TAP_SLOP_PX = 10;
  let tapStartX = 0;
  let tapStartY = 0;
  let tapMoved = false;
    // Prevent mobile synthetic click after a touch tap (avoids double action)
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

          // Do NOT start drag yet.
      // We only start dragging after the user moves beyond TAP_SLOP_PX.
      dragging = false;
      isInteracting = true;
      lastX = t.clientX - rect.left;
      lastY = t.clientY - rect.top;

      pinchActive = false;

    } else if (e.touches.length === 2) {
      e.preventDefault();
      mobileInspectPinId = null; // stop inspection when pinch starts

      pinchActive = true;
      dragging = false;
      tapMoved = true;
      isInteracting = true;
      autoRotateEnabled = false;

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

    // Once the user moves past slop, this is a drag.
    if (dx * dx + dy * dy > TAP_SLOP_PX * TAP_SLOP_PX) {
      if (!tapMoved) {
        tapMoved = true;
        mobileInspectPinId = null; // stop inspection when dragging

        // Start dragging only now (after slop threshold)
        startDrag(lastX, lastY);
      }
    }

    if (dragging) {
      moveDrag(t.clientX - rect.left, t.clientY - rect.top);
    } else {
      // Keep last position updated so drag starts smoothly if slop is crossed
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

  // Tap empty clears inspect
  if (!pin) {
    mobileInspectPinId = null;
    return;
  }

  // Determine cluster membership (overlap-based)
  const myComp = pinClusterOfId.get(pin.id) ?? pin.id;
  const isClustered = pinRepIdByComp.has(myComp);

  // Determine if this pin is currently "blank"
  // (i.e., not the label currently being shown for its cluster)
  let isBlank = false;

  if (isClustered) {
    if (mobileInspectPinId) {
      // If inspecting within this cluster, only inspected pin is non-blank
      const inspectComp =
        pinClusterOfId.get(mobileInspectPinId) ?? mobileInspectPinId;
      if (inspectComp === myComp) {
        isBlank = pin.id !== mobileInspectPinId;
      }
    } else {
      // No inspect active: only representative is non-blank
      const rep = pinRepIdByComp.get(myComp);
      if (rep) {
        isBlank = pin.id !== rep;
      }
    }
  }

  // Mobile hover-replication:
  // Tapping a blank clustered pin reveals its label only
  if (isClustered && isBlank) {
    mobileInspectPinId = pin.id;

    // Ensure labels are visible
    if (zoomTarget < LABELS_SHOW_AT_ZOOM) {
      setZoomTarget(LABELS_SHOW_AT_ZOOM);
    }
    return;
  }

  // Otherwise: normal select
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

    const titleEl = document.getElementById("destTitle");
    const subEl = document.getElementById("destSub");
    const ul = document.getElementById("destBullets");
    const iso = document.getElementById("isoBox");
    const isoImg = document.getElementById("isoImage");
    const isoLabel = document.getElementById("isoLabel");
    const isoTitle = document.getElementById("isoTitle");
    const isoDesc = document.getElementById("isoDesc");
      const isoLink = document.getElementById("isoLink");
      const detailsLink = document.getElementById("seeDetails");

    if (titleEl) titleEl.textContent = dest.name;
    if (subEl) subEl.textContent = dest.subtitle || "";
    if (isoTitle) isoTitle.textContent = dest.isoTitle || "Resort View (Isometric)";
    if (isoDesc) {
      isoDesc.textContent = dest.isoDesc || "Select a destination to load the resort view.";
    }

    if (ul) {
      ul.innerHTML = "";
      (dest.bullets || []).forEach((b) => {
        const li = document.createElement("li");
        li.textContent = b;
        ul.appendChild(li);
      });
    }

    if (iso) {
      if (isoImg) {
        if (dest.isoImage) {
          isoImg.src = dest.isoImage;
          isoImg.alt = `Isometric view of ${dest.name}`;
          iso.classList.add("is-loaded");
          if (isoLabel) isoLabel.textContent = "Select a destination to preview.";
        } else {
          isoImg.removeAttribute("src");
          isoImg.alt = "";
          iso.classList.remove("is-loaded");
          if (isoLabel) isoLabel.textContent = `${dest.name} photos coming soon.`;
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

    // Manual scroll with header offset + double rAF (Safari)
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

  // Desktop click selects immediately
  canvas.addEventListener("click", (e) => {
  // Mobile browsers can fire a synthetic click after touchend.
  // If a touch tap just ran, ignore this one click.
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
  // Boot
  // -------------------------
  initDestinations().then(() => {
    animate();
  });
})();
