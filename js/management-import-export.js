(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const API_URL_KEY = "managementApiUrl";
  function getApiUrl() {
    return localStorage.getItem(API_URL_KEY) || window.managementUrl || "";
  }

  // ── Column auto-map: normalized header → record field path ──────────────────
  const COLUMN_MAP = {
    // identity
    "id": "id",
    "type": "recordType", "recordtype": "recordType",
    "title": "title",
    "status": "status",
    "priority": "priority",
    "owner": "owner",
    // contact info
    "firstname": "extras.firstName", "first name": "extras.firstName", "first_name": "extras.firstName",
    "lastname": "extras.lastName", "last name": "extras.lastName", "last_name": "extras.lastName",
    "contactname": "contactName", "contact name": "contactName", "contact_name": "contactName", "name": "contactName",
    "email": "contactEmail", "contactemail": "contactEmail", "contact email": "contactEmail", "contact_email": "contactEmail",
    "phone": "contactPhone", "contactphone": "contactPhone", "contact phone": "contactPhone", "contact_phone": "contactPhone",
    // scheduling
    "duedate": "dueDate", "due date": "dueDate", "due_date": "dueDate",
    "startdate": "extras.startDate", "start date": "extras.startDate", "start_date": "extras.startDate",
    "enddate": "extras.endDate", "end date": "extras.endDate", "end_date": "extras.endDate",
    "relatedevent": "relatedEvent", "related event": "relatedEvent", "related_event": "relatedEvent", "event": "relatedEvent",
    // financials
    "amountowed": "extras.amountOwed", "amount owed": "extras.amountOwed", "amount_owed": "extras.amountOwed", "owed": "extras.amountOwed",
    "amountpaid": "extras.amountPaid", "amount paid": "extras.amountPaid", "amount_paid": "extras.amountPaid", "paid": "extras.amountPaid",
    // CRM
    "source": "extras.source",
    "stage": "extras.stage",
    "nextstep": "extras.nextStep", "next step": "extras.nextStep", "next_step": "extras.nextStep",
    "notes": "notes",
    // dive
    "certification": "extras.certification", "cert": "extras.certification",
    "eventtag": "extras.eventTag", "event tag": "extras.eventTag", "event_tag": "extras.eventTag",
    "eventlocation": "extras.eventLocation", "event location": "extras.eventLocation", "event_location": "extras.eventLocation",
    "location": "extras.eventLocation",
  };

  const EXPORT_HEADERS = [
    "recordType", "title", "status", "priority", "owner",
    "contactName", "contactEmail", "contactPhone",
    "dueDate", "relatedEvent", "notes",
    "firstName", "lastName", "source", "stage",
    "amountOwed", "amountPaid", "nextStep",
    "certification", "startDate", "endDate", "eventTag", "eventLocation",
  ];

  // ── Modal DOM ───────────────────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "mgmt-ie-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="mgmt-ie-modal" role="dialog" aria-modal="true" aria-label="Import / Export">
      <div class="mgmt-ie-header">
        <h2>Import / Export</h2>
        <button class="mgmt-ie-close" type="button" aria-label="Close">✕</button>
      </div>

      <div class="mgmt-ie-tabs">
        <button class="mgmt-ie-tab is-active" data-ie-tab="export">Export</button>
        <button class="mgmt-ie-tab" data-ie-tab="import">Import</button>
      </div>

      <!-- EXPORT PANEL -->
      <div class="mgmt-ie-panel" data-ie-panel="export">
        <p class="mgmt-ie-desc">Download all records of a given type as a CSV file.</p>
        <div class="mgmt-ie-row">
          <label class="mgmt-ie-label">Record type
            <select class="mgmt-ie-select" data-ie-export-type>
              <option value="all">All records</option>
              <option value="contact">Contacts</option>
              <option value="task">Tasks</option>
              <option value="calendar">Calendar</option>
              <option value="registration">Registrations</option>
              <option value="inquiry">Inquiries</option>
            </select>
          </label>
          <button class="mgmt-ie-btn primary" data-ie-export-btn>⤓ Download CSV</button>
        </div>
        <p class="mgmt-ie-status" data-ie-export-status aria-live="polite"></p>
      </div>

      <!-- IMPORT PANEL -->
      <div class="mgmt-ie-panel" data-ie-panel="import" hidden>
        <p class="mgmt-ie-desc">Upload a CSV file to import records. Column headers are mapped automatically.</p>
        <div class="mgmt-ie-row">
          <label class="mgmt-ie-label">Default record type (if CSV has no "type" column)
            <select class="mgmt-ie-select" data-ie-import-type>
              <option value="contact">Contact</option>
              <option value="task">Task</option>
              <option value="calendar">Calendar</option>
              <option value="registration">Registration</option>
              <option value="inquiry">Inquiry</option>
            </select>
          </label>
        </div>
        <div class="mgmt-ie-row">
          <label class="mgmt-ie-label mgmt-ie-file-label">
            <span data-ie-file-name>Choose CSV file…</span>
            <input type="file" accept=".csv,text/csv" data-ie-file-input />
          </label>
        </div>
        <div class="mgmt-ie-preview" data-ie-preview hidden>
          <p class="mgmt-ie-preview-title" data-ie-preview-title></p>
          <div class="mgmt-ie-table-wrap">
            <table class="mgmt-ie-table" data-ie-preview-table></table>
          </div>
          <div class="mgmt-ie-mapping" data-ie-mapping-section hidden>
            <p class="mgmt-ie-mapping-title">Unmapped columns — choose a field or skip:</p>
            <div class="mgmt-ie-mapping-rows" data-ie-mapping-rows></div>
          </div>
          <button class="mgmt-ie-btn primary" data-ie-import-btn>⤒ Import records</button>
        </div>
        <div class="mgmt-ie-progress" data-ie-progress hidden>
          <div class="mgmt-ie-progress-bar-wrap">
            <div class="mgmt-ie-progress-bar" data-ie-progress-bar style="width:0%"></div>
          </div>
          <p class="mgmt-ie-progress-label" data-ie-progress-label>Importing…</p>
        </div>
        <p class="mgmt-ie-status" data-ie-import-status aria-live="polite"></p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── Element refs ─────────────────────────────────────────────────────────────
  const modal          = overlay.querySelector(".mgmt-ie-modal");
  const closeBtn       = overlay.querySelector(".mgmt-ie-close");
  const tabs           = overlay.querySelectorAll("[data-ie-tab]");
  const panels         = overlay.querySelectorAll("[data-ie-panel]");

  const exportTypeEl   = overlay.querySelector("[data-ie-export-type]");
  const exportBtn      = overlay.querySelector("[data-ie-export-btn]");
  const exportStatus   = overlay.querySelector("[data-ie-export-status]");

  const importTypeEl   = overlay.querySelector("[data-ie-import-type]");
  const fileInput      = overlay.querySelector("[data-ie-file-input]");
  const fileNameEl     = overlay.querySelector("[data-ie-file-name]");
  const previewSection = overlay.querySelector("[data-ie-preview]");
  const previewTitle   = overlay.querySelector("[data-ie-preview-title]");
  const previewTable   = overlay.querySelector("[data-ie-preview-table]");
  const mappingSection = overlay.querySelector("[data-ie-mapping-section]");
  const mappingRows    = overlay.querySelector("[data-ie-mapping-rows]");
  const importBtn      = overlay.querySelector("[data-ie-import-btn]");
  const progressWrap   = overlay.querySelector("[data-ie-progress]");
  const progressBar    = overlay.querySelector("[data-ie-progress-bar]");
  const progressLabel  = overlay.querySelector("[data-ie-progress-label]");
  const importStatus   = overlay.querySelector("[data-ie-import-status]");

  let parsedRows = [];
  let parsedHeaders = [];

  // ── Open / close ─────────────────────────────────────────────────────────────
  function openModal() {
    overlay.hidden = false;
    document.body.classList.add("mgmt-ie-open");
    closeBtn.focus();
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.classList.remove("mgmt-ie-open");
  }

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlay.hidden) closeModal(); });

  // ── Tab switching ─────────────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.ieTab;
      tabs.forEach(t => t.classList.toggle("is-active", t.dataset.ieTab === key));
      panels.forEach(p => { p.hidden = p.dataset.iePanel !== key; });
    });
  });

  // ── Trigger button (sidebar footer) ─────────────────────────────────────────
  const triggerBtn = document.createElement("button");
  triggerBtn.type = "button";
  triggerBtn.className = "mgmt-sidebar-link";
  triggerBtn.setAttribute("data-open-import-export", "");
  triggerBtn.textContent = "Import / Export";
  triggerBtn.addEventListener("click", openModal);

  const sidebarFooter = app.querySelector(".mgmt-sidebar-footer");
  const shortcutsBtn  = sidebarFooter?.querySelector("[data-open-shortcuts]");
  if (shortcutsBtn) sidebarFooter.insertBefore(triggerBtn, shortcutsBtn);
  else sidebarFooter?.insertBefore(triggerBtn, sidebarFooter.querySelector(".mgmt-sidebar-bottom"));

  // ── CSV helpers ───────────────────────────────────────────────────────────────
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    function splitLine(line) {
      const out = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(s => s.trim());
    }

    const headers = splitLine(lines[0]);
    const rows = lines.slice(1).map(l => {
      const vals = splitLine(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
    return { headers, rows };
  }

  function toCSV(records) {
    const escape = v => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = EXPORT_HEADERS.join(",");
    const bodyLines = records.map(rec => {
      const e = typeof rec.extras === "string" ? (() => { try { return JSON.parse(rec.extras); } catch { return {}; } })() : (rec.extras || {});
      return EXPORT_HEADERS.map(h => {
        if (["firstName","lastName","source","stage","amountOwed","amountPaid","nextStep","certification","startDate","endDate","eventTag","eventLocation"].includes(h))
          return escape(e[h] ?? "");
        return escape(rec[h] ?? "");
      }).join(",");
    });
    return [header, ...bodyLines].join("\n");
  }

  function downloadCSV(filename, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  exportBtn.addEventListener("click", async () => {
    const type = exportTypeEl.value;
    exportStatus.textContent = "Fetching records…";
    exportBtn.disabled = true;
    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) throw new Error("API URL not found. Open a record first to initialize the connection.");
      const res  = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let records = data.items || [];
      if (type !== "all") records = records.filter(r => r.recordType === type);
      if (!records.length) { exportStatus.textContent = `No ${type} records found.`; return; }
      const csv      = toCSV(records);
      const typeSlug = type === "all" ? "all-records" : type + "s";
      const dateStr  = new Date().toISOString().slice(0, 10);
      downloadCSV(`dmz-${typeSlug}-${dateStr}.csv`, csv);
      exportStatus.textContent = `✓ Exported ${records.length} record${records.length !== 1 ? "s" : ""}.`;
    } catch (err) {
      exportStatus.textContent = `Error: ${err.message}`;
    } finally {
      exportBtn.disabled = false;
    }
  });

  // ── Import: file parsing ──────────────────────────────────────────────────────
  function normalizeHeader(h) {
    return h.toLowerCase().replace(/[^a-z0-9 _]/g, "").trim();
  }

  function resolveMapping(headers) {
    const mapping = {}; // rawHeader → field path or null
    headers.forEach(h => {
      const key = normalizeHeader(h);
      mapping[h] = COLUMN_MAP[key] || null;
    });
    return mapping;
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileNameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length) { importStatus.textContent = "Could not parse CSV."; return; }
      parsedHeaders = headers;
      parsedRows    = rows;
      renderPreview(headers, rows);
    };
    reader.readAsText(file);
  });

  function renderPreview(headers, rows) {
    previewSection.hidden = false;
    importStatus.textContent = "";
    progressWrap.hidden = true;

    previewTitle.textContent = `${rows.length} row${rows.length !== 1 ? "s" : ""} detected — preview of first 5:`;

    // Build preview table
    const previewRows = rows.slice(0, 5);
    previewTable.innerHTML = "";
    const thead = previewTable.createTHead();
    const hr = thead.insertRow();
    headers.forEach(h => { const th = document.createElement("th"); th.textContent = h; hr.appendChild(th); });
    const tbody = previewTable.createTBody();
    previewRows.forEach(row => {
      const tr = tbody.insertRow();
      headers.forEach(h => { const td = tr.insertCell(); td.textContent = row[h] ?? ""; });
    });

    // Mapping for unmapped columns
    const mapping = resolveMapping(headers);
    const unmapped = headers.filter(h => !mapping[h]);

    mappingRows.innerHTML = "";
    if (unmapped.length) {
      mappingSection.hidden = false;
      unmapped.forEach(h => {
        const row = document.createElement("div");
        row.className = "mgmt-ie-mapping-row";
        const label = document.createElement("label");
        label.className = "mgmt-ie-mapping-label";
        label.textContent = h + " →";
        const sel = document.createElement("select");
        sel.className = "mgmt-ie-select mgmt-ie-select-sm";
        sel.setAttribute("data-map-header", h);
        const skipOpt = document.createElement("option");
        skipOpt.value = ""; skipOpt.textContent = "(skip)";
        sel.appendChild(skipOpt);
        const allFields = Object.values(COLUMN_MAP).filter((v, i, a) => a.indexOf(v) === i).sort();
        allFields.forEach(f => {
          const opt = document.createElement("option");
          opt.value = f; opt.textContent = f;
          sel.appendChild(opt);
        });
        row.appendChild(label);
        row.appendChild(sel);
        mappingRows.appendChild(row);
      });
    } else {
      mappingSection.hidden = true;
    }
  }

  // ── Import: POST records ──────────────────────────────────────────────────────
  function buildRecord(csvRow, baseMapping, overrideMapping, defaultType) {
    // Merge auto-mapping with manual overrides
    const finalMap = { ...baseMapping };
    overrideMapping.forEach((path, header) => { if (path) finalMap[header] = path; });

    const rec = { id: "", extras: {} };
    parsedHeaders.forEach(h => {
      const path = finalMap[h];
      if (!path) return;
      const val = csvRow[h] ?? "";
      if (path.startsWith("extras.")) {
        rec.extras[path.slice(7)] = val;
      } else {
        rec[path] = val;
      }
    });

    // Default type
    if (!rec.recordType) rec.recordType = defaultType;

    // Auto-build title for contacts
    if (rec.recordType === "contact" && !rec.title) {
      const fn = rec.extras.firstName || "";
      const ln = rec.extras.lastName  || "";
      rec.title = [fn, ln].filter(Boolean).join(" ") || "Imported Contact";
    }

    // Auto-build contactName
    if (!rec.contactName) {
      const fn = rec.extras.firstName || "";
      const ln = rec.extras.lastName  || "";
      const full = [fn, ln].filter(Boolean).join(" ");
      if (full) rec.contactName = full;
    }

    return rec;
  }

  importBtn.addEventListener("click", async () => {
    if (!parsedRows.length) return;
    const apiUrl = getApiUrl();
    if (!apiUrl) { importStatus.textContent = "API URL not found. Open a record first."; return; }

    // Collect manual overrides
    const overrideMapping = new Map();
    mappingRows.querySelectorAll("[data-map-header]").forEach(sel => {
      overrideMapping.set(sel.dataset.mapHeader, sel.value || null);
    });

    const baseMapping = resolveMapping(parsedHeaders);
    const defaultType = importTypeEl.value;

    const records = parsedRows.map(row => buildRecord(row, baseMapping, overrideMapping, defaultType));

    // Progress UI
    previewSection.hidden = true;
    progressWrap.hidden = false;
    importStatus.textContent = "";
    importBtn.disabled = true;

    const BATCH = 5;
    let done = 0, failed = 0;

    function setProgress(n, total) {
      const pct = Math.round((n / total) * 100);
      progressBar.style.width = pct + "%";
      progressLabel.textContent = `Importing ${n} / ${total}…`;
    }

    setProgress(0, records.length);

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await Promise.all(batch.map(async rec => {
        try {
          const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ record: rec }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          done++;
        } catch {
          failed++;
        }
        setProgress(done + failed, records.length);
      }));
    }

    progressLabel.textContent = `Done: ${done} imported${failed ? `, ${failed} failed` : ""}.`;
    progressBar.style.width = "100%";
    importStatus.textContent = failed
      ? `⚠ ${failed} record${failed !== 1 ? "s" : ""} failed to import. ${done} succeeded.`
      : `✓ ${done} record${done !== 1 ? "s" : ""} imported successfully.`;

    importBtn.disabled = false;

    // Trigger a refresh if possible
    if (!failed) {
      const refreshBtn = app.querySelector("[data-refresh-records]");
      if (refreshBtn) setTimeout(() => refreshBtn.click(), 600);
    }
  });

  // ── Sync managementUrl ────────────────────────────────────────────────────────
  // management.js sets window.managementUrl at runtime — try to capture it
  const _origFetch = window.fetch;
  let urlCaptured = false;
  window.fetch = function (...args) {
    if (!urlCaptured && typeof args[0] === "string" && args[0].includes("management")) {
      try {
        const url = new URL(args[0]);
        if (!args[1] || args[1].method === "GET" || !args[1].method) {
          localStorage.setItem(API_URL_KEY, url.origin + url.pathname);
          urlCaptured = true;
        }
      } catch {}
    }
    return _origFetch.apply(this, args);
  };
})();
