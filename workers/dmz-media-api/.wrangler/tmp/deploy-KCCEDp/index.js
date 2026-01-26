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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
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
    location: row.location || ""
  };
}
__name(normalizeItem, "normalizeItem");
async function handleGetMedia(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM media_items ORDER BY created_at DESC"
  ).all();
  const items = (results || []).map(normalizeItem);
  const mediaItems = items.filter((item) => item.type !== "photo");
  const photoItems = items.filter((item) => item.type === "photo");
  return jsonResponse({ mediaItems, photoItems });
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
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO media_items
      (id, type, title, description, tags, badge, thumb_text, url, thumb_url, stream_id, meta, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of items) {
    const id = item.id || crypto.randomUUID();
    const tags = Array.isArray(item.tags) ? JSON.stringify(item.tags) : JSON.stringify([]);
    const meta = Array.isArray(item.meta) ? JSON.stringify(item.meta) : JSON.stringify([]);
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
      item.createdAt || now
    ).run();
  }
  return jsonResponse({ ok: true, count: items.length });
}
__name(handleBulkUpsert, "handleBulkUpsert");
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
    } else if (pathname === "/api/admin/login" && request.method === "POST") {
      response = await handleLogin(request, env);
    } else if (pathname === "/api/admin/stream-direct-upload" && request.method === "POST") {
      response = await handleStreamDirectUpload(request, env);
    } else if (pathname === "/api/admin/media" && request.method === "POST") {
      response = await handleCreateMedia(request, env);
    } else if (pathname === "/api/admin/media-bulk" && request.method === "PUT") {
      response = await handleBulkUpsert(request, env);
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
