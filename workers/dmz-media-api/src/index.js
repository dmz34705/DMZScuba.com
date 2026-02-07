function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "*";
  const allowList = String(env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!allowList.length) return "*";
  if (allowList.includes("*")) return "*";
  return allowList.includes(origin) ? origin : allowList[0];
}

function withCors(request, env, headers = {}) {
  return {
    ...headers,
    "Access-Control-Allow-Origin": getAllowedOrigin(request, env),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Tus-Resumable, Upload-Length, Upload-Metadata",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const row = await env.DB.prepare(
    "SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?"
  )
    .bind(token, new Date().toISOString())
    .first();
  return !!row;
}

async function ensureSortOrderColumn(env) {
  try {
    await env.DB.prepare("ALTER TABLE media_items ADD COLUMN sort_order INTEGER").run();
  } catch (error) {
    // Column already exists or migration not needed.
  }
}

function formatFieldLabel(key) {
  return String(key || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatFields(fields) {
  const lines = [];
  if (Array.isArray(fields)) {
    fields.forEach((entry) => {
      if (!entry) return;
      const label = entry.label || entry.key || "Field";
      const value = entry.value || "";
      if (!value) return;
      lines.push(`${label}: ${value}`);
    });
    return lines;
  }
  if (fields && typeof fields === "object") {
    Object.entries(fields).forEach(([key, value]) => {
      if (value == null || value === "") return;
      const label = formatFieldLabel(key);
      if (Array.isArray(value)) {
        const joined = value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
        if (joined) lines.push(`${label}: ${joined}`);
        return;
      }
      const text = String(value).trim();
      if (text) lines.push(`${label}: ${text}`);
    });
  }
  return lines;
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASS) {
    return jsonResponse({ ok: false, error: "Invalid credentials." }, 401);
  }
  const token = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    "INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)"
  )
    .bind(token, now.toISOString(), expires.toISOString())
    .run();
  return jsonResponse({ ok: true, token });
}

async function handleContact(request, env) {
  const body = await request.json().catch(() => ({}));
  const honey = String(body.honey || body.website || "").trim();
  if (honey) {
    return jsonResponse({ ok: true });
  }

  const fields = body.fields || {};
  const lines = formatFields(fields);
  const name = String(body.name || fields.name || fields["contact-name"] || "").trim();
  const email = String(body.email || fields.email || fields["contact-email"] || "").trim();
  const formName = String(body.form || "DMZ Inquiry").trim();
  const subject = String(body.subject || "").trim() || `${formName} Inquiry`;
  const pageUrl = String(body.pageUrl || "").trim();
  const submittedAt = new Date().toISOString();

  const message = [
    `Form: ${formName}`,
    `Submitted: ${submittedAt}`,
    pageUrl ? `Page: ${pageUrl}` : "",
    name ? `Name: ${name}` : "",
    email ? `Email: ${email}` : "",
    "",
    ...lines,
    body.message ? `\nMessage:\n${body.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const apiKey = String(env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse({ ok: false, error: "Email send failed." }, 502);
  }

  const fromEmail = String(env.RESEND_FROM_EMAIL || "").trim() || "no-reply@dmzscuba.com";
  const fromName = String(env.RESEND_FROM_NAME || "").trim() || "DMZ Scuba";
  const toEmail = String(env.RESEND_TO || "").trim() || "info@dmzscuba.com";

  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [toEmail],
    subject,
    text: message,
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
  if (email && isValidEmail(email)) {
    payload.reply_to = [email];
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.log("Resend error", resp.status, errorText);
    return jsonResponse(
      { ok: false, error: "Email send failed.", details: errorText || null },
      502
    );
  }

  return jsonResponse({ ok: true });
}

function normalizeItem(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title || "",
    description: row.description || "",
    tags: row.tags ? JSON.parse(row.tags) : [],
    badge: row.badge || "",
    thumbText: row.thumb_text || "",
    url: row.url || "",
    thumbUrl: row.thumb_url || "",
    streamId: row.stream_id || "",
    meta: row.meta ? JSON.parse(row.meta) : [],
    location: row.location || "",
    createdAt: row.created_at || "",
    sortOrder: row.sort_order ?? null,
  };
}

function parseJsonSafe(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeDestinationRow(row) {
  const data = parseJsonSafe(row && row.data, null);
  if (!data || typeof data !== "object") return null;
  if (!data.id && row && row.id) {
    data.id = row.id;
  }
  return data;
}

function mergeDestinationRecords(base, extra) {
  if (!base && !extra) return null;
  if (!base) return { ...(extra || {}) };
  if (!extra) return { ...(base || {}) };

  const merged = { ...base, ...extra };
  const mergeArray = (first, second) => {
    if (!Array.isArray(first) && !Array.isArray(second)) return null;
    const seen = new Set();
    const next = [];
    [...(first || []), ...(second || [])].forEach((item) => {
      if (item == null) return;
      const key =
        typeof item === "string" || typeof item === "number" || typeof item === "boolean"
          ? String(item).trim()
          : JSON.stringify(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      next.push(item);
    });
    return next;
  };

  ["tags", "bullets", "diveSites", "nonDiving", "logisticsTips", "perfectFor", "howItWorks"].forEach(
    (key) => {
      const mergedArray = mergeArray(base[key], extra[key]);
      if (mergedArray) merged[key] = mergedArray;
    }
  );

  if (base.resort || extra.resort) {
    merged.resort = { ...(base.resort || {}), ...(extra.resort || {}) };
  }
  if (base.conditions || extra.conditions) {
    merged.conditions = { ...(base.conditions || {}), ...(extra.conditions || {}) };
  }
  if (base.whyItWorks || extra.whyItWorks) {
    merged.whyItWorks = { ...(base.whyItWorks || {}), ...(extra.whyItWorks || {}) };
  }
  return merged;
}

async function ensureDestinationsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS destinations (
      id TEXT PRIMARY KEY,
      base_json TEXT NOT NULL,
      expanded_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
  try {
    await env.DB.prepare("ALTER TABLE destinations ADD COLUMN data_json TEXT").run();
  } catch (error) {
    // Column already exists.
  }
}

async function fetchDestinationRows(env, table) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY updated_at DESC, rowid ASC`).all();
  return results || [];
}

function normalizeUnifiedDestination(row) {
  const direct = parseJsonSafe(row && row.data_json, null);
  if (direct && typeof direct === "object") {
    if (!direct.id && row && row.id) direct.id = row.id;
    return direct;
  }
  const base = parseJsonSafe(row && row.base_json, null);
  const expanded = parseJsonSafe(row && row.expanded_json, null);
  const merged = mergeDestinationRecords(base, expanded);
  if (!merged || typeof merged !== "object") return null;
  if (!merged.id && row && row.id) merged.id = row.id;
  return merged;
}

function pickTimestamp(baseRow, expRow, field, fallback) {
  const baseValue = baseRow && baseRow[field] ? baseRow[field] : "";
  const expValue = expRow && expRow[field] ? expRow[field] : "";
  if (baseValue && expValue) {
    return baseValue < expValue ? baseValue : expValue;
  }
  return baseValue || expValue || fallback;
}

async function backfillDestinations(env) {
  await ensureDestinationsTable(env);
  const existingRows = await env.DB.prepare(
    "SELECT id, base_json, expanded_json, data_json, created_at, updated_at FROM destinations"
  ).all();
  const existing = existingRows.results || [];
  if (existing.length) {
    const update = env.DB.prepare("UPDATE destinations SET data_json = ? WHERE id = ?");
    for (const row of existing) {
      const current = normalizeUnifiedDestination(row);
      if (!current || !current.id) continue;
      await update.bind(JSON.stringify(current), row.id).run();
    }
    return;
  }

  const baseRows = await env.DB.prepare(
    "SELECT id, data, created_at, updated_at FROM destinations_base"
  ).all();
  const expandedRows = await env.DB.prepare(
    "SELECT id, data, created_at, updated_at FROM destinations_expanded"
  ).all();

  const baseMap = new Map((baseRows.results || []).map((row) => [row.id, row]));
  const expandedMap = new Map((expandedRows.results || []).map((row) => [row.id, row]));
  const ids = new Set([...baseMap.keys(), ...expandedMap.keys()]);
  if (!ids.size) return;

  const now = new Date().toISOString();
  const insert = env.DB.prepare(
    `INSERT OR REPLACE INTO destinations (id, base_json, expanded_json, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const id of ids) {
    const baseRow = baseMap.get(id);
    const expRow = expandedMap.get(id);
    const baseData = normalizeDestinationRow(baseRow);
    const expandedData = normalizeDestinationRow(expRow);
    const unified = mergeDestinationRecords(baseData, expandedData) || { id };
    if (!unified.id) unified.id = id;
    const unifiedJson = JSON.stringify(unified);
    const createdAt = pickTimestamp(baseRow, expRow, "created_at", now);
    const updatedAt = [baseRow?.updated_at, expRow?.updated_at].filter(Boolean).sort().pop() || now;
    await insert.bind(id, unifiedJson, unifiedJson, unifiedJson, createdAt, updatedAt).run();
  }
}

async function handleGetDestinations(env) {
  await backfillDestinations(env);
  const unifiedRows = await env.DB.prepare(
    "SELECT * FROM destinations ORDER BY updated_at DESC, rowid ASC"
  ).all();
  const unifiedItems = (unifiedRows.results || [])
    .map((row) => normalizeUnifiedDestination(row))
    .filter(Boolean);
  if (unifiedItems.length) {
    return jsonResponse(
      { items: unifiedItems },
      200,
      {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
      }
    );
  }
  const rows = await fetchDestinationRows(env, "destinations_base");
  const items = rows.map(normalizeDestinationRow).filter(Boolean);
  return jsonResponse(
    { items },
    200,
    {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    }
  );
}

async function handleGetDestinationsExpanded(env) {
  await backfillDestinations(env);
  const unifiedRows = await env.DB.prepare(
    "SELECT * FROM destinations ORDER BY updated_at DESC, rowid ASC"
  ).all();
  const unifiedItems = (unifiedRows.results || [])
    .map((row) => normalizeUnifiedDestination(row))
    .filter(Boolean);
  if (unifiedItems.length) {
    return jsonResponse(
      { items: unifiedItems },
      200,
      {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
      }
    );
  }
  const rows = await fetchDestinationRows(env, "destinations_expanded");
  const items = rows.map(normalizeDestinationRow).filter(Boolean);
  return jsonResponse(
    { items },
    200,
    {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    }
  );
}

async function handleGetDestinationById(env, id) {
  if (!id) return jsonResponse({ ok: false, error: "Missing id." }, 400);
  await backfillDestinations(env);
  const unifiedRow = await env.DB.prepare("SELECT * FROM destinations WHERE id = ?").bind(id).first();
  if (unifiedRow) {
    const item = normalizeUnifiedDestination(unifiedRow);
    if (item) {
      return jsonResponse({ item }, 200, { "Cache-Control": "no-store" });
    }
  }
  const baseRow = await env.DB.prepare("SELECT * FROM destinations_base WHERE id = ?").bind(id).first();
  const expRow = await env.DB.prepare("SELECT * FROM destinations_expanded WHERE id = ?").bind(id).first();
  const base = normalizeDestinationRow(baseRow);
  const expanded = normalizeDestinationRow(expRow);
  const item = mergeDestinationRecords(base, expanded);
  if (!item) return jsonResponse({ ok: false, error: "Not found." }, 404);
  if (!item.id) item.id = id;
  return jsonResponse({ item }, 200, { "Cache-Control": "no-store" });
}

async function handleDestinationsBulkUpsert(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  const deleteIds = Array.isArray(body.deleteIds) ? body.deleteIds.filter(Boolean) : [];
  const now = new Date().toISOString();

  await ensureDestinationsTable(env);

  const unifiedExisting = await env.DB.prepare("SELECT id, created_at FROM destinations").all();
  const createdMap = new Map((unifiedExisting.results || []).map((row) => [row.id, row.created_at]));

  if (deleteIds.length) {
    const delBase = env.DB.prepare("DELETE FROM destinations_base WHERE id = ?");
    const delExpanded = env.DB.prepare("DELETE FROM destinations_expanded WHERE id = ?");
    const delUnified = env.DB.prepare("DELETE FROM destinations WHERE id = ?");
    for (const id of deleteIds) {
      await delBase.bind(id).run();
      await delExpanded.bind(id).run();
      await delUnified.bind(id).run();
    }
  }

  const ids = new Set();
  items.forEach((item) => {
    if (item && item.id) ids.add(item.id);
  });

  const unifiedStmt = env.DB.prepare(
    `INSERT OR REPLACE INTO destinations (id, base_json, expanded_json, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const baseStmt = env.DB.prepare(
    `INSERT OR REPLACE INTO destinations_base (id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  );
  const expandedStmt = env.DB.prepare(
    `INSERT OR REPLACE INTO destinations_expanded (id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  );

  for (const id of ids) {
    const existing = await env.DB.prepare("SELECT * FROM destinations WHERE id = ?").bind(id).first();
    const directItem = items.find((item) => item && item.id === id) || { id };
    const nextItem = { ...directItem };
    if (!nextItem.id) nextItem.id = id;
    const createdAt = createdMap.get(id) || (existing && existing.created_at) || now;
    const payload = JSON.stringify(nextItem);
    await unifiedStmt
      .bind(id, payload, payload, payload, createdAt, now)
      .run();
    await baseStmt.bind(id, payload, createdAt, now).run();
    await expandedStmt.bind(id, payload, createdAt, now).run();
  }

  return jsonResponse({ ok: true, count: ids.size }, 200);
}

async function handleGetMedia(env) {
  await ensureSortOrderColumn(env);
  const { results } = await env.DB.prepare(
    "SELECT * FROM media_items ORDER BY sort_order IS NULL, sort_order ASC, created_at DESC, rowid ASC"
  ).all();
  const rows = results || [];
  const now = Date.now();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;
    const needsBackfill = !row.created_at || row.created_at === "";
    if (needsBackfill) {
      const offset = rows.length - 1 - i;
      const createdAt = new Date(now - offset * 1000).toISOString();
      row.created_at = createdAt;
      await env.DB.prepare("UPDATE media_items SET created_at = ? WHERE id = ?")
        .bind(createdAt, row.id)
        .run();
    }
  }
  const items = rows.map(normalizeItem);
  const mediaItems = items.filter((item) => item.type !== "photo");
  const photoItems = items.filter((item) => item.type === "photo");
  return jsonResponse(
    { mediaItems, photoItems },
    200,
    {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    }
  );
}

async function handleCreateMedia(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  await ensureSortOrderColumn(env);

  const body = await request.json().catch(() => ({}));
  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : JSON.stringify([]);
  const meta = Array.isArray(body.meta) ? JSON.stringify(body.meta) : JSON.stringify([]);

  await env.DB.prepare(
    `INSERT INTO media_items
      (id, type, title, description, tags, badge, thumb_text, url, thumb_url, stream_id, meta, location, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.type || "video",
      body.title || "",
      body.description || "",
      tags,
      body.badge || "",
      body.thumbText || "",
      body.url || "",
      body.thumbUrl || "",
      body.streamId || "",
      meta,
      body.location || "",
      body.sortOrder ?? null,
      now
    )
    .run();

  return jsonResponse({ ok: true, id });
}

async function handleUpdateMedia(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  await ensureSortOrderColumn(env);
  const body = await request.json().catch(() => ({}));
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : undefined;
  const meta = Array.isArray(body.meta) ? JSON.stringify(body.meta) : undefined;

  await env.DB.prepare(
    `UPDATE media_items SET
      type = COALESCE(?, type),
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      tags = COALESCE(?, tags),
      badge = COALESCE(?, badge),
      thumb_text = COALESCE(?, thumb_text),
      url = COALESCE(?, url),
      thumb_url = COALESCE(?, thumb_url),
      stream_id = COALESCE(?, stream_id),
      meta = COALESCE(?, meta),
      location = COALESCE(?, location),
      sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  )
    .bind(
      body.type ?? null,
      body.title ?? null,
      body.description ?? null,
      tags ?? null,
      body.badge ?? null,
      body.thumbText ?? null,
      body.url ?? null,
      body.thumbUrl ?? null,
      body.streamId ?? null,
      meta ?? null,
      body.location ?? null,
      body.sortOrder ?? null,
      id
    )
    .run();

  return jsonResponse({ ok: true });
}

async function handleDeleteMedia(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  await env.DB.prepare("DELETE FROM media_items WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}

async function handleBulkUpsert(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  await ensureSortOrderColumn(env);
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  const deleteIds = Array.isArray(body.deleteIds) ? body.deleteIds.filter(Boolean) : [];
  const deleteStreamIds = Array.isArray(body.deleteStreamIds)
    ? body.deleteStreamIds.filter(Boolean)
    : [];
  const now = new Date().toISOString();
  async function fetchStreamCreated(streamId) {
    if (!streamId || !env.CF_ACCOUNT_ID || !env.CF_STREAM_TOKEN) return "";
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${streamId}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${env.CF_STREAM_TOKEN}` },
      });
      const json = await resp.json();
      const created =
        (json && json.result && (json.result.created || json.result.created_at)) || "";
      return created || "";
    } catch (error) {
      console.log("Stream lookup failed", streamId, error);
      return "";
    }
  }
  const existingRows = await env.DB.prepare(
    "SELECT id, created_at, sort_order FROM media_items WHERE id IS NOT NULL"
  ).all();
  const existingCreatedMap = new Map();
  const existingOrderMap = new Map();
  (existingRows.results || []).forEach((row) => {
    if (row && row.id && row.created_at) {
      existingCreatedMap.set(row.id, row.created_at);
    }
    if (row && row.id && row.sort_order != null) {
      existingOrderMap.set(row.id, row.sort_order);
    }
  });
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO media_items
      (id, type, title, description, tags, badge, thumb_text, url, thumb_url, stream_id, meta, location, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  if (deleteIds.length) {
    const deleteStmt = env.DB.prepare("DELETE FROM media_items WHERE id = ?");
    for (const id of deleteIds) {
      await deleteStmt.bind(id).run();
    }
  }
  for (const item of items) {
    const id = item.id || crypto.randomUUID();
    const tags = Array.isArray(item.tags) ? JSON.stringify(item.tags) : JSON.stringify([]);
    const meta = Array.isArray(item.meta) ? JSON.stringify(item.meta) : JSON.stringify([]);
    let createdAt = item.createdAt || existingCreatedMap.get(id) || "";
    if (!createdAt && item.streamId) {
      createdAt = await fetchStreamCreated(item.streamId);
    }
    const sortOrder = item.sortOrder ?? existingOrderMap.get(id) ?? null;
    await stmt
      .bind(
        id,
        item.type || "video",
        item.title || "",
        item.description || "",
        tags,
        item.badge || "",
        item.thumbText || "",
        item.url || "",
        item.thumbUrl || "",
        item.streamId || "",
        meta,
        item.location || "",
        sortOrder,
        createdAt || now
      )
      .run();
  }
  if (deleteStreamIds.length && env.CF_ACCOUNT_ID && env.CF_STREAM_TOKEN) {
    for (const streamId of deleteStreamIds) {
      try {
        const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${streamId}`;
        const resp = await fetch(url, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${env.CF_STREAM_TOKEN}`,
          },
        });
        if (!resp.ok) {
          const errorText = await resp.text();
          console.log("Stream delete failed", streamId, resp.status, errorText);
        }
      } catch (error) {
        console.log("Stream delete failed", streamId, error);
      }
    }
  }
  return jsonResponse({ ok: true, count: items.length });
}

async function handleStreamDateSync(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => ({}));
  const force = Boolean(body.force);
  const { results } = await env.DB.prepare(
    "SELECT id, stream_id, created_at FROM media_items WHERE stream_id IS NOT NULL AND stream_id != ''"
  ).all();
  const rows = results || [];
  let updated = 0;
  for (const row of rows) {
    if (!row) continue;
    if (!force && row.created_at) continue;
    if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_TOKEN) continue;
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${row.stream_id}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${env.CF_STREAM_TOKEN}` },
      });
      const json = await resp.json();
      const created =
        (json && json.result && (json.result.created || json.result.created_at)) || "";
      if (created) {
        await env.DB.prepare("UPDATE media_items SET created_at = ? WHERE id = ?")
          .bind(created, row.id)
          .run();
        updated += 1;
      }
    } catch (error) {
      console.log("Stream sync failed", row.stream_id, error);
    }
  }
  return jsonResponse({ ok: true, updated });
}

async function handleStreamDirectUpload(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/direct_upload`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_STREAM_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxDurationSeconds: 3600,
      requireSignedURLs: false,
    }),
  });
  const json = await resp.json();
  if (!resp.ok) {
    return jsonResponse({ ok: false, error: "Stream direct upload failed.", details: json }, 500);
  }
  return jsonResponse(json, 200);
}

function buildImagesDeliveryUrl(env, imageId, variantOverride = "") {
  if (!imageId) return "";
  const variant = String(variantOverride || env.CF_IMAGES_VARIANT || "public").trim();
  const delivery = String(env.CF_IMAGES_DELIVERY || "").trim();
  if (!delivery) return "";
  if (delivery.includes("{id}")) {
    return delivery.replace("{id}", imageId).replace("{variant}", variant);
  }
  return `https://imagedelivery.net/${delivery}/${imageId}/${variant}`;
}

function extractImagesHash(env) {
  const delivery = String(env.CF_IMAGES_DELIVERY || "").trim();
  if (!delivery) return "";
  const match = delivery.match(/imagedelivery\.net\/([^/]+)/i);
  if (match && match[1]) return match[1];
  if (delivery.includes("{id}")) {
    return delivery
      .replace("https://", "")
      .replace("http://", "")
      .split("/")[1] || "";
  }
  return delivery;
}

function extractImageIdFromUrl(url, env) {
  if (!url) return "";
  const hash = extractImagesHash(env);
  if (!hash) return "";
  const pattern = new RegExp(`imagedelivery\\.net/${hash}/([^/]+)/`, "i");
  const match = String(url).match(pattern);
  return match && match[1] ? match[1] : "";
}

async function handleImagesDirectUpload(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const token = String(env.CF_IMAGES_TOKEN || "").trim();
  const accountId = String(env.CF_IMAGES_ACCOUNT_ID || env.CF_ACCOUNT_ID || "").trim();
  if (!token || !accountId) {
    return jsonResponse({ ok: false, error: "Images upload not configured." }, 500);
  }
  let variantOverride = "";
  try {
    const body = await request.json();
    variantOverride = String(body?.variant || "").trim();
  } catch (error) {
    // ignore missing/invalid JSON
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`;
  const formData = new FormData();
  formData.append("requireSignedURLs", "false");
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const json = await resp.json();
  if (!resp.ok) {
    return jsonResponse({ ok: false, error: "Images direct upload failed.", details: json }, 500);
  }
  const uploadURL = json?.result?.uploadURL || "";
  const id = json?.result?.id || "";
  const deliveryUrl = buildImagesDeliveryUrl(env, id, variantOverride);
  return jsonResponse({ ok: true, uploadURL, id, deliveryUrl }, 200);
}

async function handleImagesDelete(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const token = String(env.CF_IMAGES_TOKEN || "").trim();
  const accountId = String(env.CF_IMAGES_ACCOUNT_ID || env.CF_ACCOUNT_ID || "").trim();
  if (!token || !accountId) {
    return jsonResponse({ ok: false, error: "Images delete not configured." }, 500);
  }
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim() || extractImageIdFromUrl(body.url, env);
  if (!id) return jsonResponse({ ok: false, error: "Missing image id." }, 400);

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${id}`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return jsonResponse({ ok: false, error: "Images delete failed.", details: json }, 500);
  }
  return jsonResponse({ ok: true, id }, 200);
}

async function handleStreamTusUpload(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const uploadLength = request.headers.get("Upload-Length");
  if (!uploadLength) {
    return jsonResponse({ ok: false, error: "Missing Upload-Length header." }, 400);
  }
  const uploadMetadata = request.headers.get("Upload-Metadata") || "";
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream?direct_user=true`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_STREAM_TOKEN}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": uploadLength,
      "Upload-Metadata": uploadMetadata,
    },
  });
  const location = resp.headers.get("Location") || "";
  const uid = resp.headers.get("stream-media-id") || "";
  if (!resp.ok || !location) {
    const errorText = await resp.text();
    return jsonResponse(
      { ok: false, error: "Stream tus upload init failed.", details: errorText || null },
      500
    );
  }
  return jsonResponse({ ok: true, uploadURL: location, uid });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCors(request, env) });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    let response = null;

    if (pathname === "/api/media" && request.method === "GET") {
      response = await handleGetMedia(env);
    } else if (pathname === "/api/contact" && request.method === "POST") {
      response = await handleContact(request, env);
    } else if (pathname === "/api/admin/login" && request.method === "POST") {
      response = await handleLogin(request, env);
    } else if (pathname === "/api/admin/stream-direct-upload" && request.method === "POST") {
      response = await handleStreamDirectUpload(request, env);
    } else if (pathname === "/api/admin/stream-tus-upload" && request.method === "POST") {
      response = await handleStreamTusUpload(request, env);
    } else if (pathname === "/api/admin/images-direct-upload" && request.method === "POST") {
      response = await handleImagesDirectUpload(request, env);
    } else if (pathname === "/api/admin/images-delete" && request.method === "POST") {
      response = await handleImagesDelete(request, env);
    } else if (pathname === "/api/admin/media" && request.method === "POST") {
      response = await handleCreateMedia(request, env);
    } else if (pathname === "/api/admin/media-bulk" && request.method === "PUT") {
      response = await handleBulkUpsert(request, env);
    } else if (pathname === "/api/admin/stream-date-sync" && request.method === "POST") {
      response = await handleStreamDateSync(request, env);
    } else if (pathname === "/api/destinations" && request.method === "GET") {
      response = await handleGetDestinations(env);
    } else if (pathname === "/api/destinations-expanded" && request.method === "GET") {
      response = await handleGetDestinationsExpanded(env);
    } else if (pathname.startsWith("/api/destinations/") && request.method === "GET") {
      const id = pathname.split("/").pop();
      response = await handleGetDestinationById(env, id);
    } else if (pathname === "/api/admin/destinations-bulk" && request.method === "PUT") {
      response = await handleDestinationsBulkUpsert(request, env);
    } else if (pathname.startsWith("/api/admin/media/")) {
      const id = pathname.split("/").pop();
      if (request.method === "PUT") {
        response = await handleUpdateMedia(request, env, id);
      } else if (request.method === "DELETE") {
        response = await handleDeleteMedia(request, env, id);
      }
    }

    if (!response) {
      response = jsonResponse({ ok: false, error: "Not found." }, 404);
    }

    const headers = new Headers(response.headers);
    const cors = withCors(request, env);
    Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
