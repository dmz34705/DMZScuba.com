var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}
__name(jsonResponse, "jsonResponse");
function getAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "*";
  const allowList = String(env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!allowList.length) return "*";
  if (allowList.includes("*")) return "*";
  return allowList.includes(origin) ? origin : allowList[0];
}
__name(getAllowedOrigin, "getAllowedOrigin");
function withCors(request, env, headers = {}) {
  return {
    ...headers,
    "Access-Control-Allow-Origin": getAllowedOrigin(request, env),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Tus-Resumable, Upload-Length, Upload-Metadata",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
__name(withCors, "withCors");
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const row = await env.DB.prepare(
    "SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?"
  ).bind(token, (/* @__PURE__ */ new Date()).toISOString()).first();
  return !!row;
}
__name(requireAuth, "requireAuth");
function formatFieldLabel(key) {
  return String(key || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}
__name(formatFieldLabel, "formatFieldLabel");
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
__name(formatFields, "formatFields");
async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASS) {
    return jsonResponse({ ok: false, error: "Invalid credentials." }, 401);
  }
  const token = crypto.randomUUID();
  const now = /* @__PURE__ */ new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1e3);
  await env.DB.prepare(
    "INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)"
  ).bind(token, now.toISOString(), expires.toISOString()).run();
  return jsonResponse({ ok: true, token });
}
__name(handleLogin, "handleLogin");
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
  const submittedAt = (/* @__PURE__ */ new Date()).toISOString();
  const message = [
    `Form: ${formName}`,
    `Submitted: ${submittedAt}`,
    pageUrl ? `Page: ${pageUrl}` : "",
    name ? `Name: ${name}` : "",
    email ? `Email: ${email}` : "",
    "",
    ...lines,
    body.message ? `
Message:
${body.message}` : ""
  ].filter(Boolean).join("\n");
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
    text: message
  };
  const isValidEmail = /* @__PURE__ */ __name((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")), "isValidEmail");
  if (email && isValidEmail(email)) {
    payload.reply_to = [email];
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
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
__name(handleContact, "handleContact");
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
    createdAt: row.created_at || ""
  };
}
__name(normalizeItem, "normalizeItem");
async function handleGetMedia(env) {
  const { results } = await env.DB.prepare(
    "SELECT rowid, * FROM media_items ORDER BY rowid ASC"
  ).all();
  const rows = results || [];
  const now = Date.now();
  const counts = /* @__PURE__ */ new Map();
  rows.forEach((row) => {
    if (!row) return;
    const key = row.created_at || "";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;
    const needsBackfill = !row.created_at || row.created_at === "";
    const isDuplicate = row.created_at && (counts.get(row.created_at) || 0) > 1;
    if (needsBackfill || isDuplicate) {
      const offset = rows.length - 1 - i;
      const createdAt = new Date(now - offset * 1e3).toISOString();
      row.created_at = createdAt;
      await env.DB.prepare("UPDATE media_items SET created_at = ? WHERE id = ?").bind(createdAt, row.id).run();
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
      "Cloudflare-CDN-Cache-Control": "no-store"
    }
  );
}
__name(handleGetMedia, "handleGetMedia");
async function handleCreateMedia(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => ({}));
  const id = body.id || crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : JSON.stringify([]);
  const meta = Array.isArray(body.meta) ? JSON.stringify(body.meta) : JSON.stringify([]);
  await env.DB.prepare(
    `INSERT INTO media_items
      (id, type, title, description, tags, badge, thumb_text, url, thumb_url, stream_id, meta, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
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
    now
  ).run();
  return jsonResponse({ ok: true, id });
}
__name(handleCreateMedia, "handleCreateMedia");
async function handleUpdateMedia(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => ({}));
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : void 0;
  const meta = Array.isArray(body.meta) ? JSON.stringify(body.meta) : void 0;
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
      location = COALESCE(?, location)
     WHERE id = ?`
  ).bind(
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
    id
  ).run();
  return jsonResponse({ ok: true });
}
__name(handleUpdateMedia, "handleUpdateMedia");
async function handleDeleteMedia(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  await env.DB.prepare("DELETE FROM media_items WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}
__name(handleDeleteMedia, "handleDeleteMedia");
async function handleBulkUpsert(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  const deleteIds = Array.isArray(body.deleteIds) ? body.deleteIds.filter(Boolean) : [];
  const deleteStreamIds = Array.isArray(body.deleteStreamIds) ? body.deleteStreamIds.filter(Boolean) : [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  async function fetchStreamCreated(streamId) {
    if (!streamId || !env.CF_ACCOUNT_ID || !env.CF_STREAM_TOKEN) return "";
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${streamId}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${env.CF_STREAM_TOKEN}` }
      });
      const json = await resp.json();
      const created = json && json.result && (json.result.created || json.result.created_at) || "";
      return created || "";
    } catch (error) {
      console.log("Stream lookup failed", streamId, error);
      return "";
    }
  }
  __name(fetchStreamCreated, "fetchStreamCreated");
  const existingRows = await env.DB.prepare(
    "SELECT id, created_at FROM media_items WHERE id IS NOT NULL"
  ).all();
  const existingMap = /* @__PURE__ */ new Map();
  (existingRows.results || []).forEach((row) => {
    if (row && row.id && row.created_at) {
      existingMap.set(row.id, row.created_at);
    }
  });
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO media_items
      (id, type, title, description, tags, badge, thumb_text, url, thumb_url, stream_id, meta, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    let createdAt = item.createdAt || existingMap.get(id) || "";
    if (!createdAt && item.streamId) {
      createdAt = await fetchStreamCreated(item.streamId);
    }
    await stmt.bind(
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
      createdAt || now
    ).run();
  }
  if (deleteStreamIds.length && env.CF_ACCOUNT_ID && env.CF_STREAM_TOKEN) {
    for (const streamId of deleteStreamIds) {
      try {
        const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${streamId}`;
        const resp = await fetch(url, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${env.CF_STREAM_TOKEN}`
          }
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
__name(handleBulkUpsert, "handleBulkUpsert");
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
        headers: { Authorization: `Bearer ${env.CF_STREAM_TOKEN}` }
      });
      const json = await resp.json();
      const created = json && json.result && (json.result.created || json.result.created_at) || "";
      if (created) {
        await env.DB.prepare("UPDATE media_items SET created_at = ? WHERE id = ?").bind(created, row.id).run();
        updated += 1;
      }
    } catch (error) {
      console.log("Stream sync failed", row.stream_id, error);
    }
  }
  return jsonResponse({ ok: true, updated });
}
__name(handleStreamDateSync, "handleStreamDateSync");
async function handleStreamDirectUpload(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/direct_upload`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_STREAM_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      maxDurationSeconds: 3600,
      requireSignedURLs: false
    })
  });
  const json = await resp.json();
  if (!resp.ok) {
    return jsonResponse({ ok: false, error: "Stream direct upload failed.", details: json }, 500);
  }
  return jsonResponse(json, 200);
}
__name(handleStreamDirectUpload, "handleStreamDirectUpload");
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
      "Upload-Metadata": uploadMetadata
    }
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
__name(handleStreamTusUpload, "handleStreamTusUpload");
var index_default = {
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
    } else if (pathname === "/api/admin/media" && request.method === "POST") {
      response = await handleCreateMedia(request, env);
    } else if (pathname === "/api/admin/media-bulk" && request.method === "PUT") {
      response = await handleBulkUpsert(request, env);
    } else if (pathname === "/api/admin/stream-date-sync" && request.method === "POST") {
      response = await handleStreamDateSync(request, env);
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
      headers
    });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
