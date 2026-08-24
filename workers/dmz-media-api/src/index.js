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
  let hostname = "";
  try {
    hostname = new URL(origin).hostname || "";
  } catch (error) {
    hostname = "";
  }
  const isLocalDevOrigin =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("https://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("https://127.0.0.1:") ||
    origin.includes(".local");
  if (isLocalDevOrigin) return origin;
  const isCloudflareDevOrigin =
    hostname.endsWith(".pages.dev") || hostname.endsWith(".trycloudflare.com");
  if (isCloudflareDevOrigin) return origin;
  const isDmzDomain = hostname === "dmzscuba.com" || hostname.endsWith(".dmzscuba.com");
  if (isDmzDomain) return origin;
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

const customerJwksCache = new Map();

function getSupabaseUrl(env) {
  return String((env && env.SUPABASE_URL) || "").trim().replace(/\/+$/, "");
}

function getSupabasePublishableKey(env) {
  return String((env && (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)) || "").trim();
}

function isCustomerAuthConfigured(env) {
  return Boolean(getSupabaseUrl(env) && getSupabasePublishableKey(env));
}

function getCustomerTurnstileSiteKey(env) {
  return String((env && env.TURNSTILE_SITE_KEY) || "").trim();
}

function getCustomerCaptchaToken(body) {
  return String(body && body.captchaToken || "").trim().slice(0, 4096);
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtJson(value) {
  const bytes = base64UrlToBytes(value);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function validateSupabaseClaims(claims, options = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!claims || typeof claims !== "object") throw new Error("Invalid access token.");
  const issuer = String(options.issuer || "").replace(/\/+$/, "");
  const expectedAudience = String(options.audience || "authenticated");
  const audiences = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud || "")];
  const email = String(claims.email || "").trim().toLowerCase();
  if (!issuer || String(claims.iss || "").replace(/\/+$/, "") !== issuer) throw new Error("Invalid access token.");
  if (!audiences.includes(expectedAudience)) throw new Error("Invalid access token.");
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= nowSeconds) throw new Error("Access token expired.");
  if (claims.nbf != null && Number(claims.nbf) > nowSeconds + 30) throw new Error("Invalid access token.");
  if (claims.iat != null && Number(claims.iat) > nowSeconds + 60) throw new Error("Invalid access token.");
  if (!String(claims.sub || "").trim()) throw new Error("Invalid access token.");
  if (String(claims.role || "") !== "authenticated" || claims.is_anonymous === true) throw new Error("Invalid access token.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid access token.");
  return {
    userId: String(claims.sub).trim(),
    email,
    sessionId: String(claims.session_id || "").trim(),
    aal: String(claims.aal || "aal1").trim(),
    userMetadata: claims.user_metadata && typeof claims.user_metadata === "object" ? claims.user_metadata : {},
  };
}

async function getSupabaseJwks(env, forceRefresh = false) {
  const supabaseUrl = getSupabaseUrl(env);
  if (!supabaseUrl) throw new Error("Customer accounts are not configured.");
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  const cached = customerJwksCache.get(jwksUrl);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(jwksUrl, {
    headers: { Accept: "application/json" },
    cf: { cacheEverything: true, cacheTtl: 600 },
  });
  if (!response.ok) throw new Error("Customer authentication is temporarily unavailable.");
  const data = await response.json().catch(() => ({}));
  const keys = Array.isArray(data && data.keys) ? data.keys : [];
  if (!keys.length) throw new Error("Customer authentication signing keys are unavailable.");
  customerJwksCache.set(jwksUrl, { keys, expiresAt: Date.now() + 10 * 60 * 1000 });
  return keys;
}

async function verifySupabaseAccessToken(token, env) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid access token.");
  const header = decodeJwtJson(parts[0]);
  const claims = decodeJwtJson(parts[1]);
  const algorithm = String(header && header.alg || "");
  const keyId = String(header && header.kid || "");
  if (!keyId || !["ES256", "RS256"].includes(algorithm)) throw new Error("Invalid access token.");

  let keys = await getSupabaseJwks(env);
  let jwk = keys.find((candidate) => String(candidate && candidate.kid || "") === keyId);
  if (!jwk) {
    keys = await getSupabaseJwks(env, true);
    jwk = keys.find((candidate) => String(candidate && candidate.kid || "") === keyId);
  }
  if (!jwk || String(jwk.alg || algorithm) !== algorithm) throw new Error("Invalid access token.");

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  let importedKey;
  let verifyAlgorithm;
  if (algorithm === "ES256") {
    importedKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    verifyAlgorithm = { name: "ECDSA", hash: "SHA-256" };
  } else {
    importedKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    verifyAlgorithm = { name: "RSASSA-PKCS1-v1_5" };
  }
  const validSignature = await crypto.subtle.verify(verifyAlgorithm, importedKey, signature, signingInput);
  if (!validSignature) throw new Error("Invalid access token.");

  return validateSupabaseClaims(claims, {
    issuer: `${getSupabaseUrl(env)}/auth/v1`,
    audience: String(env.SUPABASE_JWT_AUDIENCE || "authenticated"),
  });
}

function getBearerToken(request) {
  const authorization = String(request.headers.get("Authorization") || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function requireCustomerIdentity(request, env) {
  const token = getBearerToken(request);
  if (!token) return { response: jsonResponse({ ok: false, error: "Sign in is required." }, 401) };
  if (!isCustomerAuthConfigured(env)) {
    return { response: jsonResponse({ ok: false, error: "Customer accounts are not configured yet." }, 503) };
  }
  try {
    return { identity: await verifySupabaseAccessToken(token, env) };
  } catch (error) {
    const message = error && error.message === "Access token expired." ? "Your session expired. Please sign in again." : "Sign in is required.";
    return { response: jsonResponse({ ok: false, error: message }, 401) };
  }
}

function getCustomerRefreshCookieName(request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" ? "dmz_customer_refresh" : "__Host-dmz_customer_refresh";
}

function getCookieValue(request, name) {
  const cookieHeader = String(request.headers.get("Cookie") || "");
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

function buildCustomerRefreshCookie(request, refreshToken, maxAge = 60 * 60 * 24 * 30) {
  const name = getCustomerRefreshCookieName(request);
  const secure = name.startsWith("__Host-") ? "; Secure" : "";
  return `${name}=${encodeURIComponent(String(refreshToken || ""))}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${Math.max(0, Number(maxAge) || 0)}`;
}

async function callSupabaseAuth(env, path, body, accessToken = "", method = "POST") {
  if (!isCustomerAuthConfigured(env)) {
    return { ok: false, status: 503, data: { message: "Customer accounts are not configured yet." } };
  }
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: getSupabasePublishableKey(env),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${getSupabaseUrl(env)}/auth/v1${path}`, {
      method,
      headers,
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      data: {
        message: timedOut
          ? "The account service took too long to respond. Please try again."
          : "The account service could not be reached. Please try again.",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getSupabaseAuthError(result, fallback) {
  const data = result && result.data && typeof result.data === "object" ? result.data : {};
  const message = String(data.msg || data.message || data.error_description || data.error || "").trim();
  return message && message.length <= 240 ? message : fallback;
}

function customerSessionResponse(request, data, status = 200, extra = {}) {
  const accessToken = String(data && data.access_token || "");
  const refreshToken = String(data && data.refresh_token || "");
  if (!accessToken || !refreshToken) {
    return jsonResponse({ ok: false, error: "A customer session could not be created." }, 502);
  }
  const user = data.user && typeof data.user === "object" ? data.user : {};
  return jsonResponse(
    {
      ok: true,
      ...extra,
      accessToken,
      expiresIn: Math.max(0, Number(data.expires_in) || 0),
      user: {
        id: String(user.id || ""),
        email: String(user.email || "").trim().toLowerCase(),
      },
    },
    status,
    {
      "Cache-Control": "no-store",
      "Set-Cookie": buildCustomerRefreshCookie(request, refreshToken),
    }
  );
}

function isTrustedDestinationDevWrite(request) {
  const origin = String(request.headers.get("Origin") || "").trim().toLowerCase();
  return origin === "https://dmzscuba-com.pages.dev";
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFieldValue(fields, key) {
  if (!fields || typeof fields !== "object") return "";
  const raw = fields[key];
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

function shouldSendInterestAutoReply(body, fields) {
  const direct = String(body.autoReplyType || "").trim().toLowerCase();
  const field = getFieldValue(fields, "autoReplyType").toLowerCase();
  return direct === "interest-list" || field === "interest-list";
}

function isCozumelInterest(fields) {
  const destination = getFieldValue(fields, "destination").toLowerCase();
  const location = getFieldValue(fields, "location").toLowerCase();
  return destination.includes("cozumel") || location.includes("cozumel");
}

function isHaighInterest(fields) {
  const destination = getFieldValue(fields, "destination").toLowerCase();
  const location = getFieldValue(fields, "location").toLowerCase();
  return destination.includes("haigh") || location.includes("haigh");
}

function isKeyLargoInterest(fields) {
  const destination = getFieldValue(fields, "destination").toLowerCase();
  const location = getFieldValue(fields, "location").toLowerCase();
  return destination.includes("key largo") || destination.includes("key-largo") || location.includes("key largo");
}

function isMermetInterest(fields) {
  const destination = getFieldValue(fields, "destination").toLowerCase();
  const location = getFieldValue(fields, "location").toLowerCase();
  return destination.includes("mermet") || location.includes("mermet");
}

function isPlayaInterest(fields) {
  const destination = getFieldValue(fields, "destination").toLowerCase();
  const location = getFieldValue(fields, "location").toLowerCase();
  return destination.includes("playa") || location.includes("playa");
}

function isRoatanInterest(fields) {
  const destination = getFieldValue(fields, "destination").toLowerCase();
  const location = getFieldValue(fields, "location").toLowerCase();
  return destination.includes("roatan") || location.includes("roatan");
}

function isCatalinaInterest(fields) {
  const destination = getFieldValue(fields, "destination").toLowerCase();
  const location = getFieldValue(fields, "location").toLowerCase();
  return (
    destination.includes("catalina") ||
    location.includes("catalina") ||
    destination.includes("southern california")
  );
}

function buildCozumelInterestEmail(name = "") {
  const safeName = escapeHtml(name || "Diver");
  const subject = "Thank you for your interest in diving Cozumel with DMZ Scuba.";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>DMZ Scuba | Cozumel Interest</title>
  </head>
  <body style="margin:0;padding:0;background:#050b14;color:#eaf2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Thank you for your interest in diving Cozumel with DMZ Scuba.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050b14;padding:20px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;border:1px solid rgba(255,255,255,0.12);border-radius:18px;overflow:hidden;background:#071325;">
            <tr>
              <td style="padding:24px;background:linear-gradient(180deg, rgba(85,185,255,0.18) 0%, rgba(7,19,37,1) 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
                <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:1.1px;text-transform:uppercase;color:#9bd3ff;">DMZ Scuba Travel and Training</p>
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#eaf2ff;">Thank you for your interest in diving Cozumel with DMZ Scuba.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px;color:#dce8f8;">
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#dce8f8;">Hi ${safeName},</p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#dce8f8;">
                  We’ve received your inquiry and wanted to provide you with a clear overview of what to expect, along with resources you can explore at your own pace as you consider joining us.
                  Cozumel remains one of the most consistent and rewarding dive destinations in the Caribbean, offering warm water, excellent visibility, and a smooth, well-organized dive experience that works equally well for newer divers and experienced travelers.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#dce8f8;">
                  Our trips are structured to be straightforward and low-stress from the moment you begin planning through your final dive of the week.
                  Divers typically review the destination overview and travel logistics first to get a sense of the overall experience, daily dive rhythm, and travel flow.
                  From there, you can decide whether you would like additional details, pricing information, or help aligning the trip with your schedule and experience level.
                </p>
                <p style="margin:0 0 10px 0;font-size:15px;line-height:1.7;color:#eef5ff;font-weight:700;">Booking and trip planning resources:</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:10px 10px 8px 10px;">
                        <tr><td style="padding:0 0 8px 0;"><a href="https://dmzscuba-com.pages.dev/pages/travel/destination?id=cozumel" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:#e21b23;color:#ffffff;border:1px solid #e21b23;text-decoration:none;text-align:center;">DMZ Cozumel destination page</a></td></tr>
                        <tr><td style="padding:0 0 8px 0;"><a href="https://www.dresseldivers.com/dive/mexico/cozumel-scuba-diving/" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:rgba(255,255,255,0.05);color:#eaf2ff;border:1px solid rgba(255,255,255,0.16);text-decoration:none;text-align:center;">Dressel Divers Cozumel</a></td></tr>
                        <tr><td style="padding:0 0 8px 0;"><a href="https://www.iberostar.com/en/hotels/cozumel/iberostar-cozumel" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:rgba(255,255,255,0.05);color:#eaf2ff;border:1px solid rgba(255,255,255,0.16);text-decoration:none;text-align:center;">Iberostar Waves Cozumel</a></td></tr>
                        <tr><td style="padding:0 0 8px 0;"><a href="https://vacations.united.com/destinations/mexico/" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:rgba(255,255,255,0.05);color:#eaf2ff;border:1px solid rgba(255,255,255,0.16);text-decoration:none;text-align:center;">United Vacations (search Cozumel + Iberostar)</a></td></tr>
                        <tr><td style="padding:0 0 8px 0;"><a href="https://www.aavacations.com/en/beach-vacation-packages" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:rgba(255,255,255,0.05);color:#eaf2ff;border:1px solid rgba(255,255,255,0.16);text-decoration:none;text-align:center;">American Airlines Vacations (search Cozumel + Iberostar)</a></td></tr>
                        <tr><td style="padding:0;"><a href="https://www.delta.com/us/en/delta-vacations/vacation-inspiration/mexico-vacations/cozumel-vacation-packages" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:rgba(255,255,255,0.05);color:#eaf2ff;border:1px solid rgba(255,255,255,0.16);text-decoration:none;text-align:center;">Delta Vacations Cozumel packages</a></td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 14px 0;padding:12px 14px;border-radius:12px;background:rgba(226,27,35,0.12);border:1px solid rgba(226,27,35,0.42);font-size:13px;line-height:1.6;color:#ffe3e5;font-weight:700;text-transform:uppercase;letter-spacing:0.2px;">Important: Airline vacation packages do not include any diving.</p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#dce8f8;">These materials are designed to answer most initial questions and allow you to explore independently before deciding how you would like to proceed. When you feel ready, you are welcome to reply directly to this email to discuss availability, trip timing, training considerations prior to travel, or any other planning details.</p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#dce8f8;">You have also been added to the DMZ Scuba interest list for this destination. This simply ensures you will be notified of any trip developments, new dates, pricing releases, or availability updates as they are announced. There is no commitment required - it is simply the best way to stay informed as plans evolve.</p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#dce8f8;">There is no obligation or timeline - the goal is to provide clear information so you can determine whether this destination and travel style are the right fit for you.</p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#eef5ff;">We appreciate your interest and look forward to the possibility of diving together.</p>
                <p style="margin:0;font-size:15px;line-height:1.75;color:#eaf2ff;">Warm regards,<br/>Zachary Lisowski<br/>Owner | DMZ Scuba LLC<br/>DMZ Scuba Travel and Training<br/>[Phone]<br/><a href="https://dmzscuba.com" style="color:#9bd3ff;text-decoration:none;">dmzscuba.com</a></p>
              </td>
            </tr>
            <tr><td style="padding:14px 24px;border-top:1px solid rgba(255,255,255,0.10);font-size:12px;line-height:1.6;color:rgba(234,242,255,0.62);">DMZ Scuba | Always Dive</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    `Hi ${name || "Diver"},`,
    "",
    "Thank you for your interest in diving Cozumel with DMZ Scuba.",
    "You have been added to the DMZ Scuba interest list for Cozumel.",
    "",
    "Resources:",
    "- DMZ Cozumel destination page: https://dmzscuba-com.pages.dev/pages/travel/destination?id=cozumel",
    "- Dressel Divers Cozumel: https://www.dresseldivers.com/dive/mexico/cozumel-scuba-diving/",
    "- Iberostar Waves Cozumel: https://www.iberostar.com/en/hotels/cozumel/iberostar-cozumel",
    "- United Vacations: https://vacations.united.com/destinations/mexico/",
    "- American Airlines Vacations: https://www.aavacations.com/en/beach-vacation-packages",
    "- Delta Vacations Cozumel: https://www.delta.com/us/en/delta-vacations/vacation-inspiration/mexico-vacations/cozumel-vacation-packages",
    "",
    "Important: Airline vacation packages do not include any diving.",
  ].join("\n");
  return { subject, html, text };
}

function buildGenericInterestEmail(name = "", destinationName = "this destination") {
  const safeName = escapeHtml(name || "Diver");
  const safeDestinationName = escapeHtml(destinationName || "this destination");
  const subject = `You are on the DMZ Scuba interest list for ${destinationName || "this destination"}.`;
  const html = `<!doctype html><html><body style="margin:0;padding:20px;background:#050b14;color:#eaf2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;border:1px solid rgba(255,255,255,0.12);border-radius:18px;overflow:hidden;background:#071325;"><tr><td style="padding:24px;"><h1 style="margin:0 0 10px 0;font-size:24px;color:#eaf2ff;">You are in.</h1><p style="margin:0 0 12px 0;color:#dce8f8;line-height:1.7;">Hi ${safeName}, thank you for joining the interest list for ${safeDestinationName}.</p><p style="margin:0 0 12px 0;color:#dce8f8;line-height:1.7;">We will email updates when dates, pricing, and availability are released.</p><p style="margin:0;color:#eaf2ff;">DMZ Scuba</p></td></tr></table></td></tr></table></body></html>`;
  const text = `Hi ${name || "Diver"},\n\nThank you for joining the interest list for ${destinationName || "this destination"}.\nWe will email updates when dates, pricing, and availability are released.\n\nDMZ Scuba`;
  return { subject, html, text };
}

function buildTemplateVariables(name = "", destinationName = "") {
  return {
    NAME: String(name || "Diver").trim() || "Diver",
    DESTINATION: String(destinationName || "Cozumel").trim() || "Cozumel",
    DMZ_DESTINATION_URL: "https://dmzscuba-com.pages.dev/pages/travel/destination?id=cozumel",
    DRESSEL_URL: "https://www.dresseldivers.com/dive/mexico/cozumel-scuba-diving/",
    IBEROSTAR_URL: "https://www.iberostar.com/en/hotels/cozumel/iberostar-cozumel",
    UNITED_URL: "https://vacations.united.com/destinations/mexico/",
    AMERICAN_URL: "https://www.aavacations.com/en/beach-vacation-packages",
    DELTA_URL: "https://www.delta.com/us/en/delta-vacations/vacation-inspiration/mexico-vacations/cozumel-vacation-packages",
    WEBSITE_URL: "https://dmzscuba.com",
    INSTAGRAM_URL: "https://www.instagram.com/dmzscuba/",
    YOUTUBE_URL: "https://www.youtube.com/@divemasterzach34705",
  };
}

const QUIZ_RESULTS_TEMPLATE_ID_FALLBACK = "a2b38bfb-89a1-41e4-99f9-9a95063a3cf1";

function shouldSendQuizResultsAutoReply(formName = "") {
  const value = String(formName || "").trim().toLowerCase();
  if (!value) return false;
  return value.includes("dive quiz") || value.includes("quiz");
}

function shouldSendGeneralInquiryAutoReply(formName = "") {
  const value = String(formName || "").trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes("quick contact") ||
    value.includes("dive now") ||
    value.includes("course builder") ||
    value.includes("contact")
  );
}

function buildQuizResultsConfirmationEmail() {
  const subject = "We received your Dive Path Quiz results - DMZ Scuba";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#050b14;color:#eaf2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050b14;padding:18px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;border:1px solid rgba(255,255,255,0.12);border-radius:18px;overflow:hidden;background:#071325;">
            <tr>
              <td style="padding:24px;background:linear-gradient(180deg, rgba(85,185,255,0.18) 0%, rgba(7,19,37,1) 100%);border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;">
                <img src="https://dmzscuba.com/assets/images/logos/dmz-scuba-logo.png" width="96" alt="DMZ Scuba logo" style="display:inline-block;width:96px;height:auto;border:0;outline:none;text-decoration:none;margin:0 0 10px 0;" />
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#eaf2ff;">Your dive path is in.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px;color:#dce8f8;">
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.75;">Thank you for completing the DMZ Scuba Dive Path Quiz. We received your results and are preparing your personalized next-step plan.</p>
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.75;">Please watch for either an email from <a href="mailto:info@dmzscuba.com" style="color:#9bd3ff;text-decoration:none;">info@dmzscuba.com</a> or a call from <a href="tel:+16306604536" style="color:#9bd3ff;text-decoration:none;">630-660-4536</a>.</p>
                <p style="margin:0;font-size:15px;line-height:1.75;color:#eaf2ff;">Warm regards,<br/>Zachary Lisowski<br/>Owner | DMZ Scuba LLC<br/><a href="mailto:info@dmzscuba.com" style="color:#9bd3ff;text-decoration:none;">info@dmzscuba.com</a><br/><a href="https://dmzscuba.com" style="color:#9bd3ff;text-decoration:none;">dmzscuba.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    "Thank you for completing the DMZ Scuba Dive Path Quiz.",
    "We received your results and are preparing your personalized next-step plan.",
    "",
    "Please watch for either:",
    "- Email: info@dmzscuba.com",
    "- Call: 630-660-4536",
    "",
    "DMZ Scuba",
  ].join("\n");
  return { subject, html, text };
}

function buildGeneralInquiryConfirmationEmail(name = "") {
  const safeName = escapeHtml(name || "Diver");
  const subject = "We received your request - DMZ Scuba";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#050b14;color:#eaf2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050b14;padding:18px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;border:1px solid rgba(255,255,255,0.12);border-radius:18px;overflow:hidden;background:#071325;">
            <tr>
              <td style="padding:24px;background:linear-gradient(180deg, rgba(85,185,255,0.18) 0%, rgba(7,19,37,1) 100%);border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;">
                <img src="https://dmzscuba-com.pages.dev/assets/images/logos/dmz-scuba-logo.png" width="96" alt="DMZ Scuba logo" style="display:inline-block;width:96px;height:auto;border:0;outline:none;text-decoration:none;margin:0 0 10px 0;" />
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#eaf2ff;">We received your request.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px;color:#dce8f8;">
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.75;">Hi ${safeName},</p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;">
                  Thank you for reaching out to DMZ Scuba. Your inquiry has been received, and you should hear back from us shortly with next steps.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
                  <tr><td style="padding:0 0 8px 0;"><a href="https://dmzscuba.com" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:#e21b23;color:#ffffff;border:1px solid #e21b23;text-decoration:none;text-align:center;">DMZ Scuba website</a></td></tr>
                  <tr><td style="padding:0 0 8px 0;"><a href="https://www.instagram.com/dmzscuba/" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:rgba(255,255,255,0.05);color:#eaf2ff;border:1px solid rgba(255,255,255,0.16);text-decoration:none;text-align:center;">Instagram</a></td></tr>
                  <tr><td style="padding:0;"><a href="https://www.youtube.com/@divemasterzach34705" style="display:block;padding:14px 18px;border-radius:14px;font-weight:700;font-size:14px;line-height:1.2;background:rgba(255,255,255,0.05);color:#eaf2ff;border:1px solid rgba(255,255,255,0.16);text-decoration:none;text-align:center;">YouTube</a></td></tr>
                </table>
                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.75;color:#eaf2ff;">
                  Warm regards,<br/>Zachary Lisowski<br/>Owner | DMZ Scuba LLC<br/><a href="mailto:info@dmzscuba.com" style="color:#9bd3ff;text-decoration:none;">info@dmzscuba.com</a><br/><a href="https://dmzscuba.com" style="color:#9bd3ff;text-decoration:none;">dmzscuba.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    `Hi ${name || "Diver"},`,
    "",
    "Thank you for reaching out to DMZ Scuba.",
    "Your inquiry has been received, and you should hear back from us shortly.",
    "",
    "DMZ Scuba website: https://dmzscuba.com",
    "Instagram: https://www.instagram.com/dmzscuba/",
    "YouTube: https://www.youtube.com/@divemasterzach34705",
    "",
    "Warm regards,",
    "Zachary Lisowski",
    "Owner | DMZ Scuba LLC",
    "info@dmzscuba.com",
    "dmzscuba.com",
  ].join("\n");
  return { subject, html, text };
}

function emailTextBlock(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}

function buildEmailRichText(value) {
  const blocks = String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return "";
  return blocks
    .map((block) => {
      return `<p style="margin:0 0 14px 0;color:#dce8f8;font-size:14px;line-height:1.72;">${emailTextBlock(block)}</p>`;
    })
    .join("");
}

function htmlToPlainText(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildEmailDetailRows(rows = []) {
  return rows
    .filter((row) => row && row.label)
    .map((row) => {
      const value = row.value === undefined || row.value === null || row.value === "" ? "-" : row.value;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1d324d;color:#9bd3ff;font-size:13px;font-weight:700;vertical-align:top;width:38%;">${escapeHtml(row.label)}</td>
          <td style="padding:12px 0;border-bottom:1px solid #1d324d;color:#f2f7ff;font-size:14px;line-height:1.55;vertical-align:top;">${emailTextBlock(value)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildDmzEventEmailShell({ kicker, title, intro, rows = [], bodyHtml = "", footerHtml = "" }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <style>
      :root { color-scheme: dark; supported-color-schemes: dark; }
      body, table, td, p, a { -webkit-text-size-adjust: 100%; }
    </style>
  </head>
  <body bgcolor="#050b14" style="margin:0;padding:0;background-color:#050b14;color:#eaf2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#050b14" style="background-color:#050b14;padding:22px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#071325" style="max-width:640px;border:1px solid #1d324d;border-radius:18px;overflow:hidden;background-color:#071325;">
            <tr>
              <td bgcolor="#0b2840" style="padding:24px;background-color:#0b2840;border-bottom:1px solid #1d324d;">
                <p style="margin:0 0 8px 0;color:#55b9ff;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">${escapeHtml(kicker)}</p>
                <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;font-weight:800;">${escapeHtml(title)}</h1>
                ${intro ? `<p style="margin:12px 0 0 0;color:#eaf2ff;font-size:15px;line-height:1.65;">${emailTextBlock(intro)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td bgcolor="#071325" style="padding:24px;background-color:#071325;">
                ${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${buildEmailDetailRows(rows)}</table>` : ""}
                ${bodyHtml}
                ${footerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEventRegistrationNotifyEmail(details = {}) {
  const title = String(details.title || "DMZ Scuba Event").trim();
  const scheduleLine = String(details.scheduleLine || "").trim();
  const registrantName = String(details.registrantName || "New registrant").trim();
  const email = String(details.email || "").trim();
  const phone = String(details.phone || "").trim();
  const certLevel = String(details.certLevel || "").trim();
  const additionalGuests = Math.max(0, Number(details.additionalGuests) || 0);
  const partySize = Math.max(1, Number(details.partySize) || 1);
  const remainingSpots = Math.max(0, Number(details.remainingSpots) || 0);
  const subject = `New event signup: ${title}`;
  const text = [
    `A new event registration was submitted for ${title}.`,
    scheduleLine ? `Schedule: ${scheduleLine}` : "",
    `Registrant: ${registrantName}`,
    email ? `Email: ${email}` : "",
    phone ? `Phone: ${phone}` : "",
    certLevel ? `Certification Level: ${certLevel}` : "",
    `Party Size: ${partySize}`,
    `Additional Guests: ${additionalGuests}`,
    `Remaining Spots: ${remainingSpots}`,
  ].filter(Boolean).join("\n");
  const html = buildDmzEventEmailShell({
    kicker: "Event Registration",
    title,
    intro: "A new signup was received for this event.",
    rows: [
      { label: "Registrant", value: registrantName },
      { label: "Schedule", value: scheduleLine || "Date coming soon" },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Certification", value: certLevel },
      { label: "Party Size", value: partySize },
      { label: "Additional Guests", value: additionalGuests },
      { label: "Remaining Spots", value: remainingSpots },
    ],
    footerHtml: email
      ? `<p style="margin:18px 0 0 0;color:#dce8f8;font-size:14px;line-height:1.65;">Reply directly to this email to contact ${escapeHtml(registrantName)}.</p>`
      : "",
  });
  return { subject, html, text };
}

function applyEventRegistrationMergeTags(value, details = {}) {
  const firstName = String(details.firstName || details.registrantName || "Diver").trim();
  const lastName = String(details.lastName || "").trim();
  const fullName = String(details.fullName || [firstName, lastName].filter(Boolean).join(" ")).trim();
  const tags = {
    first_name: firstName,
    firstname: firstName,
    last_name: lastName,
    lastname: lastName,
    full_name: fullName || firstName,
    name: fullName || firstName,
    event_title: String(details.title || "").trim(),
    title: String(details.title || "").trim(),
    event_date: String(details.eventDate || "").trim(),
    date: String(details.eventDate || "").trim(),
    schedule: String(details.scheduleLine || "").trim(),
    party_size: String(Math.max(1, Number(details.partySize) || 1)),
    spots_remaining: String(Math.max(0, Number(details.remainingSpots) || 0)),
    contact_email: String(details.contactEmail || "info@dmzscuba.com").trim() || "info@dmzscuba.com",
  };
  return String(value || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const normalized = String(key || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(tags, normalized) ? tags[normalized] : match;
  });
}

function buildEventRegistrationTemplateVariables(details = {}) {
  const firstName = String(details.firstName || details.registrantName || "Diver").trim();
  const lastName = String(details.lastName || "").trim();
  const fullName = String(details.fullName || [firstName, lastName].filter(Boolean).join(" ")).trim() || firstName;
  return {
    first_name: firstName,
    firstname: firstName,
    last_name: lastName,
    lastname: lastName,
    full_name: fullName,
    name: fullName,
    event_title: String(details.title || "").trim(),
    title: String(details.title || "").trim(),
    event_date: String(details.eventDate || "").trim(),
    date: String(details.eventDate || "").trim(),
    schedule: String(details.scheduleLine || "").trim(),
    party_size: String(Math.max(1, Number(details.partySize) || 1)),
    spots_remaining: String(Math.max(0, Number(details.remainingSpots) || 0)),
    contact_email: String(details.contactEmail || "info@dmzscuba.com").trim() || "info@dmzscuba.com",
    registrant_email: String(details.email || "").trim(),
    phone: String(details.phone || "").trim(),
    certification: String(details.certLevel || "").trim(),
  };
}

function looksLikeFullHtmlEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  return text.startsWith("<!doctype html") || text.startsWith("<html") || (text.includes("<html") && text.includes("<body"));
}

function buildEventRegistrationConfirmationEmail(details = {}) {
  const title = String(details.title || "your DMZ Scuba event").trim();
  const scheduleLine = String(details.scheduleLine || "").trim();
  const registrantName = String(details.registrantName || "Diver").trim();
  const customSubject = applyEventRegistrationMergeTags(details.subject || "", details).trim();
  const subject = customSubject || `You're signed up for ${title}`;
  const fullHtmlSource = String(details.fullHtml || "").trim();
  const descriptionSource = String(details.description || "").trim();
  const shouldUseFullHtml = (details.useFullHtml && fullHtmlSource) || looksLikeFullHtmlEmail(descriptionSource);
  if (shouldUseFullHtml) {
    const html = applyEventRegistrationMergeTags(fullHtmlSource || descriptionSource, details).trim();
    const fallbackText = htmlToPlainText(html);
    return {
      subject,
      html,
      text: fallbackText || `Hi ${registrantName},\n\nYou're signed up for ${title}.\n\nDMZ Scuba`,
    };
  }
  const description = applyEventRegistrationMergeTags(details.description || "", details).trim();
  const descriptionIsHtml = Boolean(details.descriptionIsHtml);
  const descriptionText = descriptionIsHtml ? htmlToPlainText(description) : description;
  const contactEmail = String(details.contactEmail || "info@dmzscuba.com").trim() || "info@dmzscuba.com";
  const partySize = Math.max(1, Number(details.partySize) || 1);
  const remainingSpots = Math.max(0, Number(details.remainingSpots) || 0);
  const text = [
    `Hi ${registrantName},`,
    "",
    `You're signed up for ${title}.`,
    scheduleLine ? `Schedule: ${scheduleLine}` : "",
    descriptionText ? "" : "",
    descriptionText ? `Registration Details: ${descriptionText}` : "",
    `Party Size: ${partySize}`,
    `Remaining Spots: ${remainingSpots}`,
    "",
    `If you have any questions before the event, email ${contactEmail} and DMZ Scuba will help you out.`,
    "",
    "DMZ Scuba",
  ].filter(Boolean).join("\n");
  const html = buildDmzEventEmailShell({
    kicker: "Event Confirmation",
    title: "You're signed up.",
    intro: `Hi ${registrantName}, thanks for registering for ${title}.`,
    rows: [
      { label: "Event", value: title },
      { label: "Schedule", value: scheduleLine || "We will follow up with final schedule details if anything changes." },
      { label: "Party Size", value: partySize },
      { label: "Remaining Spots", value: remainingSpots },
    ],
    bodyHtml: description
      ? `<div style="margin-top:18px;padding:16px;border:1px solid #1d324d;border-radius:14px;background-color:#0b1f36;"><p style="margin:0 0 12px 0;color:#55b9ff;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Registration Details</p>${descriptionIsHtml ? description : buildEmailRichText(description)}</div>`
      : "",
    footerHtml: `<p style="margin:18px 0 0 0;color:#eaf2ff;font-size:14px;line-height:1.65;">If you need to update anything before the event, email <a href="mailto:${escapeHtml(contactEmail)}" style="color:#9bd3ff;text-decoration:none;">${escapeHtml(contactEmail)}</a>.</p>`,
  });
  return { subject, html, text };
}

async function sendResendEmail(env, payload, logLabel = "Resend email") {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured." };
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
    console.log(`${logLabel} error`, resp.status, errorText);
    return { ok: false, error: errorText || `HTTP ${resp.status}` };
  }
  return { ok: true };
}

async function sendEventRegistrationAttendeeEmail(env, config, details = {}, logLabel = "Event attendee confirmation email") {
  const fromEmail = String(env.RESEND_FROM_EMAIL || "").trim() || "no-reply@dmzscuba.com";
  const fromName = String(env.RESEND_FROM_NAME || "").trim() || "DMZ Scuba";
  const toEmail = String(env.RESEND_TO || "").trim() || "info@dmzscuba.com";
  const attendeeDetails = {
    title: config.title || "DMZ Scuba Event",
    subject: config.registrationEmailSubject || "",
    scheduleLine: details.scheduleLine || [String(config.title || "").trim(), String(details.eventDate || "").trim()].filter(Boolean).join(" | "),
    eventDate: details.eventDate || "",
    description: config.registrationEmailContent || "",
    descriptionIsHtml: Boolean(config.registrationEmailIsHtml),
    useFullHtml: Boolean(config.registrationEmailUseFullHtml),
    fullHtml: config.registrationEmailFullHtml || "",
    contactEmail: toEmail,
    registrantName: details.firstName || details.registrantName || details.fullName || "Diver",
    firstName: details.firstName || "",
    lastName: details.lastName || "",
    fullName: details.fullName || [details.firstName, details.lastName].filter(Boolean).join(" "),
    email: details.email || "",
    phone: details.phone || "",
    certLevel: details.certLevel || "",
    partySize: Math.max(1, Number(details.partySize) || 1),
    remainingSpots: Math.max(0, Number(details.remainingSpots) || 0),
  };
  const attendeeSubject = applyEventRegistrationMergeTags(
    config.registrationEmailSubject || `You're signed up for {{event_title}}`,
    attendeeDetails
  ).trim();
  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [attendeeDetails.email],
    reply_to: [toEmail],
    ...(config.registrationEmailTemplateId
      ? {
          subject: attendeeSubject,
          template: {
            id: String(config.registrationEmailTemplateId || "").trim(),
            variables: buildEventRegistrationTemplateVariables(attendeeDetails),
          },
        }
      : (() => {
          const attendeeContent = buildEventRegistrationConfirmationEmail(attendeeDetails);
          return {
            subject: attendeeContent.subject,
            html: attendeeContent.html,
            text: attendeeContent.text,
          };
        })()),
  };
  return sendResendEmail(env, payload, logLabel);
}

function formatEventAlertDate(value) {
  const text = String(value || "").trim();
  const parts = text.split("-");
  if (parts.length !== 3) return text;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function buildEventAlertTemplateVariables(details = {}) {
  return {
    first_name: String(details.firstName || "Diver").trim(),
    name: String(details.name || details.firstName || "Diver").trim(),
    event_title: String(details.title || "DMZ Scuba Event").trim(),
    event_date: String(details.eventDate || "").trim(),
    event_date_formatted: formatEventAlertDate(details.eventDate),
    event_time: String(details.time || "").trim(),
    event_location: String(details.location || "").trim(),
    event_type: String(details.type || "").trim(),
    event_summary: String(details.summary || "").trim(),
    registration_link: String(details.registrationLink || "").trim(),
    spots_remaining: String(Math.max(0, Number(details.remainingSpots) || 0)),
    contact_email: String(details.contactEmail || "info@dmzscuba.com").trim(),
  };
}

function buildEventAlertEmail(details = {}) {
  const firstName = String(details.firstName || "Diver").trim();
  const title = String(details.title || "DMZ Scuba Event").trim();
  const eventDate = String(details.eventDate || "").trim();
  const time = String(details.time || "").trim();
  const location = String(details.location || "").trim();
  const type = String(details.type || "").trim();
  const summary = String(details.summary || "").trim();
  const registrationLink = String(details.registrationLink || "").trim();
  const remainingSpots = Math.max(0, Number(details.remainingSpots) || 0);
  const contactEmail = String(details.contactEmail || "info@dmzscuba.com").trim() || "info@dmzscuba.com";
  const subject = `New DMZ Scuba event open: ${title}`;
  const text = [
    `Hi ${firstName},`,
    "",
    `A new DMZ Scuba event is open for registration: ${title}.`,
    eventDate ? `Date: ${formatEventAlertDate(eventDate)}` : "",
    time ? `Time: ${time}` : "",
    location ? `Location: ${location}` : "",
    type ? `Type: ${type}` : "",
    remainingSpots ? `Spots remaining: ${remainingSpots}` : "",
    summary ? `\nDetails:\n${summary}` : "",
    registrationLink ? `\nRegister here: ${registrationLink}` : "",
    "",
    `Questions? Email ${contactEmail}.`,
    "",
    "DMZ Scuba",
  ].filter(Boolean).join("\n");
  const html = buildDmzEventEmailShell({
    kicker: "New Event Alert",
    title,
    intro: `Hi ${firstName}, a new DMZ Scuba event is open for registration.`,
    rows: [
      { label: "Event", value: title },
      { label: "Date", value: eventDate ? formatEventAlertDate(eventDate) : "" },
      { label: "Time", value: time || "Time coming soon" },
      { label: "Location", value: location || "Location coming soon" },
      { label: "Type", value: type },
      { label: "Spots Remaining", value: remainingSpots || "Open registration" },
    ],
    bodyHtml: summary
      ? `<div style="margin-top:18px;padding:16px;border:1px solid #1d324d;border-radius:14px;background-color:#0b1f36;"><p style="margin:0 0 12px 0;color:#55b9ff;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Event Details</p>${buildEmailRichText(summary)}</div>`
      : "",
    footerHtml: `
      ${registrationLink ? `<p style="margin:20px 0 0 0;"><a href="${escapeHtml(registrationLink)}" style="display:inline-block;padding:12px 16px;border-radius:12px;background-color:#e21b23;color:#ffffff;font-weight:800;text-decoration:none;">View Event & Register</a></p>` : ""}
      <p style="margin:18px 0 0 0;color:#eaf2ff;font-size:14px;line-height:1.65;">If you have questions, email <a href="mailto:${escapeHtml(contactEmail)}" style="color:#9bd3ff;text-decoration:none;">${escapeHtml(contactEmail)}</a>.</p>
    `,
  });
  return { subject, html, text };
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

async function handleCustomerAuthStatus(env) {
  const authConfigured = isCustomerAuthConfigured(env);
  const turnstileSiteKey = getCustomerTurnstileSiteKey(env);
  return jsonResponse(
    {
      ok: true,
      enabled: Boolean(authConfigured && turnstileSiteKey),
      authConfigured,
      turnstileSiteKey,
      emailVerification: "code",
    },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleCustomerSignup(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const password = String(body.password || "");
  const firstName = String(body.firstName || "").trim().slice(0, 80);
  const lastName = String(body.lastName || "").trim().slice(0, 80);
  const captchaToken = getCustomerCaptchaToken(body);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: "Enter a valid email address." }, 400);
  }
  if (password.length < 12 || password.length > 128) {
    return jsonResponse({ ok: false, error: "Use a password between 12 and 128 characters." }, 400);
  }
  if (!firstName || !lastName) {
    return jsonResponse({ ok: false, error: "Enter your first and last name." }, 400);
  }
  if (!getCustomerTurnstileSiteKey(env)) {
    return jsonResponse({ ok: false, error: "Customer signup abuse protection is not configured yet." }, 503);
  }
  if (!captchaToken) return jsonResponse({ ok: false, error: "Complete the security check." }, 400);
  const result = await callSupabaseAuth(env, "/signup", {
    email,
    password,
    data: { first_name: firstName, last_name: lastName },
    gotrue_meta_security: { captcha_token: captchaToken },
  });
  if (!result.ok) {
    return jsonResponse({ ok: false, error: getSupabaseAuthError(result, "Account creation failed.") }, result.status || 400);
  }
  if (result.data && result.data.access_token) {
    return jsonResponse(
      { ok: false, error: "Email confirmation must be enabled before customer accounts can launch." },
      503,
      { "Cache-Control": "no-store" }
    );
  }
  return jsonResponse(
    { ok: true, verificationRequired: true, message: "Check your email for the six-digit verification code." },
    201,
    { "Cache-Control": "no-store" }
  );
}

async function handleCustomerVerify(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const token = String(body.token || "").trim().replace(/\s+/g, "").slice(0, 20);
  const type = String(body.type || "signup") === "recovery" ? "recovery" : "signup";
  if (!email || !token) return jsonResponse({ ok: false, error: "Enter your email and verification code." }, 400);
  const result = await callSupabaseAuth(env, "/verify", { email, token, type });
  if (!result.ok) {
    return jsonResponse({ ok: false, error: getSupabaseAuthError(result, "The verification code is invalid or expired.") }, result.status || 400);
  }
  return customerSessionResponse(request, result.data);
}

async function handleCustomerLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const password = String(body.password || "");
  const captchaToken = getCustomerCaptchaToken(body);
  if (!email || !password) return jsonResponse({ ok: false, error: "Enter your email and password." }, 400);
  if (!getCustomerTurnstileSiteKey(env)) {
    return jsonResponse({ ok: false, error: "Customer login abuse protection is not configured yet." }, 503);
  }
  if (!captchaToken) return jsonResponse({ ok: false, error: "Complete the security check." }, 400);
  const result = await callSupabaseAuth(env, "/token?grant_type=password", {
    email,
    password,
    gotrue_meta_security: { captcha_token: captchaToken },
  });
  if (!result.ok) {
    return jsonResponse({ ok: false, error: getSupabaseAuthError(result, "The email or password is incorrect.") }, result.status || 401);
  }
  return customerSessionResponse(request, result.data);
}

async function handleCustomerRefresh(request, env) {
  const cookieName = getCustomerRefreshCookieName(request);
  const refreshToken = getCookieValue(request, cookieName) || getCookieValue(request, "dmz_customer_refresh") || getCookieValue(request, "__Host-dmz_customer_refresh");
  if (!refreshToken) return jsonResponse({ ok: false, error: "Sign in is required." }, 401, { "Cache-Control": "no-store" });
  const result = await callSupabaseAuth(env, "/token?grant_type=refresh_token", { refresh_token: refreshToken });
  if (!result.ok) {
    return jsonResponse(
      { ok: false, error: "Your session expired. Please sign in again." },
      401,
      { "Cache-Control": "no-store", "Set-Cookie": buildCustomerRefreshCookie(request, "", 0) }
    );
  }
  return customerSessionResponse(request, result.data);
}

async function handleCustomerLogout(request, env) {
  const accessToken = getBearerToken(request);
  if (accessToken && isCustomerAuthConfigured(env)) {
    await callSupabaseAuth(env, "/logout", {}, accessToken).catch(() => null);
  }
  return jsonResponse(
    { ok: true },
    200,
    { "Cache-Control": "no-store", "Set-Cookie": buildCustomerRefreshCookie(request, "", 0) }
  );
}

async function handleCustomerRecovery(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const captchaToken = getCustomerCaptchaToken(body);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: "Enter a valid email address." }, 400);
  }
  if (!getCustomerTurnstileSiteKey(env)) {
    return jsonResponse({ ok: false, error: "Customer recovery abuse protection is not configured yet." }, 503);
  }
  if (!captchaToken) return jsonResponse({ ok: false, error: "Complete the security check." }, 400);
  const result = await callSupabaseAuth(env, "/recover", {
    email,
    gotrue_meta_security: { captcha_token: captchaToken },
  });
  if (!result.ok) {
    return jsonResponse({ ok: false, error: getSupabaseAuthError(result, "Password recovery could not be started.") }, result.status || 400);
  }
  return jsonResponse(
    { ok: true, message: "If that address has an account, a recovery code is on the way." },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleCustomerPasswordUpdate(request, env) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  const currentPassword = String(body.currentPassword || "");
  if (password.length < 12 || password.length > 128) {
    return jsonResponse({ ok: false, error: "Use a password between 12 and 128 characters." }, 400);
  }
  const update = { password };
  if (currentPassword) update.current_password = currentPassword;
  const result = await callSupabaseAuth(env, "/user", update, getBearerToken(request), "PUT");
  if (!result.ok) {
    return jsonResponse({ ok: false, error: getSupabaseAuthError(result, "The password could not be updated.") }, result.status || 400);
  }
  return jsonResponse({ ok: true, message: "Your password has been updated." }, 200, { "Cache-Control": "no-store" });
}

async function handleCustomerEmailUpdate(request, env) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: "Enter a valid new email address." }, 400);
  }
  if (email === auth.identity.email) {
    return jsonResponse({ ok: false, error: "Enter an email address different from your current one." }, 400);
  }
  const result = await callSupabaseAuth(env, "/user", { email }, getBearerToken(request), "PUT");
  if (!result.ok) {
    return jsonResponse({ ok: false, error: getSupabaseAuthError(result, "The email change could not be started.") }, result.status || 400);
  }
  await writeCustomerAudit(env, auth.identity.userId, "auth.email_change_requested", "customer_profile", auth.identity.userId);
  return jsonResponse(
    {
      ok: true,
      currentEmail: auth.identity.email,
      newEmail: email,
      message: "Verification codes were sent to your current and new email addresses.",
    },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleCustomerEmailVerification(request, env) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const token = String(body.token || "").trim().replace(/\s+/g, "").slice(0, 20);
  const stage = String(body.stage || "") === "new" ? "new" : "current";
  if (!email || !token) return jsonResponse({ ok: false, error: "Enter the email verification code." }, 400);
  if (stage === "current" && email !== auth.identity.email) {
    return jsonResponse({ ok: false, error: "The current email address does not match your signed-in account." }, 400);
  }
  const result = await callSupabaseAuth(env, "/verify", { email, token, type: "email_change" }, getBearerToken(request));
  if (!result.ok) {
    return jsonResponse({ ok: false, error: getSupabaseAuthError(result, "The verification code is invalid or expired.") }, result.status || 400);
  }
  if (stage === "current") {
    return jsonResponse(
      { ok: true, complete: false, message: "Current email verified. Now enter the code sent to your new email address." },
      200,
      { "Cache-Control": "no-store" }
    );
  }
  await writeCustomerAudit(env, auth.identity.userId, "auth.email_change_verified", "customer_profile", auth.identity.userId);
  if (result.data && result.data.access_token && result.data.refresh_token) {
    return customerSessionResponse(
      request,
      result.data,
      200,
      { complete: true, message: "Your email address has been changed." }
    );
  }
  return jsonResponse(
    { ok: true, complete: true, refreshRequired: true, message: "Your email address has been changed." },
    200,
    { "Cache-Control": "no-store" }
  );
}

function normalizeCustomerText(value, maxLength = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeCustomerDate(value) {
  const date = normalizeCustomerText(value, 10);
  return !date || /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

async function writeCustomerAudit(env, userId, action, targetType = "", targetId = "", actorUserId = "") {
  await env.DB.prepare(
    `INSERT INTO customer_audit_log (id, user_id, actor_user_id, action, target_type, target_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      userId,
      actorUserId || userId,
      normalizeCustomerText(action, 120),
      normalizeCustomerText(targetType, 80),
      normalizeCustomerText(targetId, 100),
      new Date().toISOString()
    )
    .run()
    .catch(() => null);
}

async function ensureCustomerProfile(env, identity) {
  const now = new Date().toISOString();
  const metadata = identity.userMetadata || {};
  const firstName = normalizeCustomerText(metadata.first_name || metadata.firstName, 80);
  const lastName = normalizeCustomerText(metadata.last_name || metadata.lastName, 80);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO customer_profiles
     (user_id, email, first_name, last_name, preferred_name, phone, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, '', '', ?, ?, ?)`
  )
    .bind(identity.userId, identity.email, firstName, lastName, now, now, now)
    .run();
  await env.DB.prepare(
    `UPDATE customer_profiles
     SET email = ?, last_login_at = ?, updated_at = CASE WHEN email <> ? THEN ? ELSE updated_at END
     WHERE user_id = ?`
  )
    .bind(identity.email, now, identity.email, now, identity.userId)
    .run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO customer_roles (user_id, role, created_at, created_by)
     VALUES (?, 'customer', ?, ?)`
  )
    .bind(identity.userId, now, identity.userId)
    .run();
  return env.DB.prepare(
    `SELECT user_id, email, first_name, last_name, preferred_name, phone, created_at, updated_at, last_login_at
     FROM customer_profiles WHERE user_id = ? LIMIT 1`
  )
    .bind(identity.userId)
    .first();
}

function mapCustomerProfile(row) {
  return {
    userId: String(row && row.user_id || ""),
    email: String(row && row.email || ""),
    firstName: String(row && row.first_name || ""),
    lastName: String(row && row.last_name || ""),
    preferredName: String(row && row.preferred_name || ""),
    phone: String(row && row.phone || ""),
    createdAt: String(row && row.created_at || ""),
    updatedAt: String(row && row.updated_at || ""),
  };
}

function mapCustomerCertification(row) {
  return {
    id: String(row && row.id || ""),
    agency: String(row && row.agency || ""),
    certificationName: String(row && row.certification_name || ""),
    certificationNumber: String(row && row.certification_number || ""),
    issuedOn: String(row && row.issued_on || ""),
    expiresOn: String(row && row.expires_on || ""),
    verificationStatus: String(row && row.verification_status || "pending"),
    createdAt: String(row && row.created_at || ""),
    updatedAt: String(row && row.updated_at || ""),
  };
}

async function getCustomerAccountPayload(env, identity) {
  const profile = await ensureCustomerProfile(env, identity);
  const [roleRows, certificationRows, registrationRows, reservationRows] = await Promise.all([
    env.DB.prepare("SELECT role FROM customer_roles WHERE user_id = ? ORDER BY role ASC").bind(identity.userId).all(),
    env.DB.prepare(
      `SELECT id, agency, certification_name, certification_number, issued_on, expires_on,
              verification_status, created_at, updated_at
       FROM customer_certifications WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(identity.userId).all(),
    env.DB.prepare(
      `SELECT id, source_id, event_date, party_size, approval_status, created_at
       FROM event_registrations_v2 WHERE user_id = ? ORDER BY event_date DESC, created_at DESC`
    ).bind(identity.userId).all(),
    env.DB.prepare(
      `SELECT id, reservation_type, source_id, source_registration_id, event_date, status, party_size,
              data_json, created_at, updated_at
       FROM customer_reservations WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(identity.userId).all(),
  ]);
  return {
    ok: true,
    profile: mapCustomerProfile(profile),
    roles: (roleRows.results || []).map((row) => String(row.role || "")).filter(Boolean),
    certifications: (certificationRows.results || []).map(mapCustomerCertification),
    eventRegistrations: (registrationRows.results || []).map((row) => ({
      id: String(row.id || ""),
      sourceId: String(row.source_id || ""),
      eventDate: String(row.event_date || ""),
      partySize: Math.max(1, Number(row.party_size) || 1),
      status: String(row.approval_status || "pending"),
      createdAt: String(row.created_at || ""),
    })),
    reservations: (reservationRows.results || []).map((row) => ({
      id: String(row.id || ""),
      type: String(row.reservation_type || "booking"),
      sourceId: String(row.source_id || ""),
      sourceRegistrationId: String(row.source_registration_id || ""),
      eventDate: String(row.event_date || ""),
      status: String(row.status || "pending"),
      partySize: Math.max(1, Number(row.party_size) || 1),
      details: parseJsonSafe(row.data_json, {}),
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || ""),
    })),
  };
}

async function handleGetCustomerAccount(request, env) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  return jsonResponse(await getCustomerAccountPayload(env, auth.identity), 200, { "Cache-Control": "no-store" });
}

async function handleUpdateCustomerProfile(request, env) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  await ensureCustomerProfile(env, auth.identity);
  const body = await request.json().catch(() => ({}));
  const profile = {
    firstName: normalizeCustomerText(body.firstName, 80),
    lastName: normalizeCustomerText(body.lastName, 80),
    preferredName: normalizeCustomerText(body.preferredName, 80),
    phone: normalizeCustomerText(body.phone, 40),
  };
  if (!profile.firstName || !profile.lastName) {
    return jsonResponse({ ok: false, error: "First and last name are required." }, 400);
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE customer_profiles
     SET first_name = ?, last_name = ?, preferred_name = ?, phone = ?, email = ?, updated_at = ?
     WHERE user_id = ?`
  )
    .bind(profile.firstName, profile.lastName, profile.preferredName, profile.phone, auth.identity.email, now, auth.identity.userId)
    .run();
  await writeCustomerAudit(env, auth.identity.userId, "profile.updated", "customer_profile", auth.identity.userId);
  return jsonResponse(await getCustomerAccountPayload(env, auth.identity), 200, { "Cache-Control": "no-store" });
}

function normalizeCustomerCertification(body = {}, existing = {}) {
  const agency = normalizeCustomerText(body.agency != null ? body.agency : existing.agency, 80);
  const certificationName = normalizeCustomerText(
    body.certificationName != null ? body.certificationName : existing.certificationName,
    120
  );
  const certificationNumber = normalizeCustomerText(
    body.certificationNumber != null ? body.certificationNumber : existing.certificationNumber,
    120
  );
  const issuedOn = normalizeCustomerDate(body.issuedOn != null ? body.issuedOn : existing.issuedOn);
  const expiresOn = normalizeCustomerDate(body.expiresOn != null ? body.expiresOn : existing.expiresOn);
  if (!agency || !certificationName) return null;
  return { agency, certificationName, certificationNumber, issuedOn, expiresOn };
}

async function handleCreateCustomerCertification(request, env) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  await ensureCustomerProfile(env, auth.identity);
  const certification = normalizeCustomerCertification(await request.json().catch(() => ({})));
  if (!certification) return jsonResponse({ ok: false, error: "Agency and certification name are required." }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO customer_certifications
     (id, user_id, agency, certification_name, certification_number, issued_on, expires_on,
      verification_status, verified_at, verified_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`
  )
    .bind(
      id,
      auth.identity.userId,
      certification.agency,
      certification.certificationName,
      certification.certificationNumber,
      certification.issuedOn,
      certification.expiresOn,
      now,
      now
    )
    .run();
  await writeCustomerAudit(env, auth.identity.userId, "certification.created", "customer_certification", id);
  return jsonResponse(await getCustomerAccountPayload(env, auth.identity), 201, { "Cache-Control": "no-store" });
}

async function handleUpdateCustomerCertification(request, env, certificationId) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  const id = normalizeCustomerText(certificationId, 100);
  const row = await env.DB.prepare(
    `SELECT id, agency, certification_name, certification_number, issued_on, expires_on
     FROM customer_certifications WHERE id = ? AND user_id = ? LIMIT 1`
  ).bind(id, auth.identity.userId).first();
  if (!row) return jsonResponse({ ok: false, error: "Certification not found." }, 404);
  const certification = normalizeCustomerCertification(await request.json().catch(() => ({})), {
    agency: row.agency,
    certificationName: row.certification_name,
    certificationNumber: row.certification_number,
    issuedOn: row.issued_on,
    expiresOn: row.expires_on,
  });
  if (!certification) return jsonResponse({ ok: false, error: "Agency and certification name are required." }, 400);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE customer_certifications
     SET agency = ?, certification_name = ?, certification_number = ?, issued_on = ?, expires_on = ?,
         verification_status = 'pending', verified_at = NULL, verified_by = NULL, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).bind(
    certification.agency,
    certification.certificationName,
    certification.certificationNumber,
    certification.issuedOn,
    certification.expiresOn,
    now,
    id,
    auth.identity.userId
  ).run();
  await writeCustomerAudit(env, auth.identity.userId, "certification.updated", "customer_certification", id);
  return jsonResponse(await getCustomerAccountPayload(env, auth.identity), 200, { "Cache-Control": "no-store" });
}

async function handleDeleteCustomerCertification(request, env, certificationId) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  const id = normalizeCustomerText(certificationId, 100);
  const result = await env.DB.prepare("DELETE FROM customer_certifications WHERE id = ? AND user_id = ?")
    .bind(id, auth.identity.userId)
    .run();
  const changes = Number(result && result.meta && result.meta.changes || 0);
  if (!changes) return jsonResponse({ ok: false, error: "Certification not found." }, 404);
  await writeCustomerAudit(env, auth.identity.userId, "certification.deleted", "customer_certification", id);
  return jsonResponse(await getCustomerAccountPayload(env, auth.identity), 200, { "Cache-Control": "no-store" });
}

async function handleLinkCustomerRecords(request, env) {
  const auth = await requireCustomerIdentity(request, env);
  if (auth.response) return auth.response;
  await ensureCustomerProfile(env, auth.identity);
  await ensureEventRegistrationsV2Table(env);
  await ensureManagementRecordsTable(env);
  const registrationResult = await env.DB.prepare(
    `UPDATE event_registrations_v2 SET user_id = ?
     WHERE user_id IS NULL AND lower(email) = ?`
  ).bind(auth.identity.userId, auth.identity.email).run();
  const managementResult = await env.DB.prepare(
    `UPDATE management_records SET customer_user_id = ?
     WHERE customer_user_id IS NULL AND lower(contact_email) = ?`
  ).bind(auth.identity.userId, auth.identity.email).run();
  const linkedRegistrations = Number(registrationResult && registrationResult.meta && registrationResult.meta.changes || 0);
  const linkedRecords = Number(managementResult && managementResult.meta && managementResult.meta.changes || 0);
  await writeCustomerAudit(env, auth.identity.userId, "records.linked", "customer_profile", auth.identity.userId);
  return jsonResponse(
    {
      ...(await getCustomerAccountPayload(env, auth.identity)),
      linked: { registrations: linkedRegistrations, records: linkedRecords },
    },
    200,
    { "Cache-Control": "no-store" }
  );
}

function buildPublicInquiryManagementRecord({ body, fields, lines, name, email, formName, subject, pageUrl, submittedAt }) {
  const phone =
    String(body.phone || "").trim() ||
    getFieldValue(fields, "phone") ||
    getFieldValue(fields, "contact-phone") ||
    getFieldValue(fields, "tel");
  const relatedEvent =
    getFieldValue(fields, "course") ||
    getFieldValue(fields, "class") ||
    getFieldValue(fields, "trip") ||
    getFieldValue(fields, "destination") ||
    getFieldValue(fields, "location") ||
    getFieldValue(fields, "interest") ||
    "";
  const messageText = String(body.message || "").trim();
  const notes = [
    `Form: ${formName}`,
    `Submitted: ${submittedAt}`,
    pageUrl ? `Page: ${pageUrl}` : "",
    "",
    ...lines,
    messageText ? `\nMessage:\n${messageText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const titleSource = subject || formName || relatedEvent || "Website inquiry";
  const titleContact = name || email || "";
  return {
    recordType: "inquiry",
    title: titleContact ? `${titleSource} - ${titleContact}` : titleSource,
    status: "new",
    priority: "normal",
    contactName: name,
    contactEmail: email,
    contactPhone: phone,
    relatedEvent,
    notes,
    extras: {
      source: "Public site form",
      formName,
      pageUrl,
      submittedAt,
      subject,
      autoReplyType: String(body.autoReplyType || getFieldValue(fields, "autoReplyType") || "").trim(),
    },
  };
}

async function savePublicInquiryManagementRecord(env, recordInput) {
  try {
    const saved = await createManagementRecord(env, recordInput);
    return saved && saved.id ? saved : null;
  } catch (error) {
    console.log("Management inquiry save error", error && error.message ? error.message : error);
    return null;
  }
}

function splitSubscriberName(name) {
  const parts = normalizeManagementText(name, 160).split(" ").filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

async function findContactByEmail(env, email) {
  const safeEmail = normalizeManagementText(email, 180).toLowerCase();
  if (!safeEmail) return null;
  await ensureManagementRecordsTable(env);
  const row = await env.DB.prepare(
    "SELECT * FROM management_records WHERE record_type = 'contact' AND lower(contact_email) = ? ORDER BY updated_at DESC LIMIT 1"
  )
    .bind(safeEmail)
    .first();
  return row ? managementRecordFromRow(row) : null;
}

async function saveEventAlertSubscriber(env, details) {
  const submittedAt = new Date().toISOString();
  const email = normalizeManagementText(details && details.email, 180).toLowerCase();
  const name = normalizeManagementText(details && details.name, 160);
  const phone = normalizeManagementText(details && details.phone, 60);
  const pageUrl = normalizeManagementText(details && details.pageUrl, 500);
  const nameParts = splitSubscriberName(name);
  const existing = await findContactByEmail(env, email);
  const existingExtras = existing && existing.extras && typeof existing.extras === "object" ? existing.extras : {};
  const extras = {
    ...existingExtras,
    firstName: existingExtras.firstName || nameParts.firstName,
    lastName: existingExtras.lastName || nameParts.lastName,
    source: existingExtras.source || "Public event alert signup",
    emailAlerts: "1",
    emailAlertsSubscribedAt: existingExtras.emailAlertsSubscribedAt || submittedAt,
    emailAlertsUpdatedAt: submittedAt,
    emailAlertsSource: "public_site",
    emailAlertsPageUrl: pageUrl,
  };

  if (!existing) {
    return createManagementRecord(env, {
      recordType: "contact",
      title: name || email,
      status: "active",
      priority: "normal",
      contactName: name,
      contactEmail: email,
      contactPhone: phone,
      notes: [
        "Subscribed to DMZ Scuba event alert emails from the public website.",
        `Submitted: ${submittedAt}`,
        pageUrl ? `Page: ${pageUrl}` : "",
      ].filter(Boolean).join("\n"),
      extras,
    });
  }

  const next = normalizeManagementRecord({
    ...existing,
    title: existing.title || name || email,
    status: existing.status || "active",
    priority: existing.priority || "normal",
    contactName: existing.contactName || name,
    contactEmail: email,
    contactPhone: existing.contactPhone || phone,
    notes: existing.notes || [
      "Subscribed to DMZ Scuba event alert emails from the public website.",
      `Submitted: ${submittedAt}`,
      pageUrl ? `Page: ${pageUrl}` : "",
    ].filter(Boolean).join("\n"),
    extras,
  }, existing);
  const now = submittedAt;
  await env.DB.prepare(
    `UPDATE management_records
     SET record_type = ?, title = ?, status = ?, priority = ?, owner = ?, contact_name = ?, contact_email = ?, contact_phone = ?, due_date = ?, related_event = ?, notes = ?, data_json = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      next.recordType,
      next.title,
      next.status,
      next.priority,
      next.owner,
      next.contactName,
      next.contactEmail,
      next.contactPhone,
      next.dueDate,
      next.relatedEvent,
      next.notes,
      JSON.stringify({ extras: next.extras }),
      now,
      existing.id
    )
    .run();
  return { ...next, id: existing.id, createdAt: existing.createdAt, updatedAt: now };
}

async function saveQuizLeadContact(env, details) {
  const submittedAt = normalizeManagementText(details && details.submittedAt, 40) || new Date().toISOString();
  const fields = details && details.fields && typeof details.fields === "object" ? details.fields : {};
  const name = normalizeManagementText(details && details.name, 160);
  const email = normalizeManagementText(details && details.email, 180).toLowerCase();
  const phone = normalizeManagementText((details && details.phone) || getFieldValue(fields, "phone"), 60);
  const pageUrl = normalizeManagementText(details && details.pageUrl, 500);
  const subject = normalizeManagementText(details && details.subject, 180);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  const nameParts = splitSubscriberName(name);
  const existing = await findContactByEmail(env, email);
  const existingExtras = existing && existing.extras && typeof existing.extras === "object" ? existing.extras : {};
  const quizRoute = normalizeManagementText(getFieldValue(fields, "quiz_route"), 120);
  const quizMode = normalizeManagementText(getFieldValue(fields, "quiz_mode"), 80);
  const quizPath = normalizeManagementText(getFieldValue(fields, "quiz_path"), 120);
  const quizAnswers = normalizeManagementLongText(getFieldValue(fields, "quiz_answers_summary"), 1200);
  const goals = normalizeManagementLongText(getFieldValue(fields, "goals"), 1200);
  const message = normalizeManagementLongText((details && details.message) || getFieldValue(fields, "message"), 1200);
  const subjectMatch = subject.match(/^Dive Quiz Lead:\s*(.+)$/i);
  const messageMatch = message.match(/Recommended start:\s*([^|]+)/i);
  const quizRecommendedStart = normalizeManagementText(
    (subjectMatch && subjectMatch[1]) || (messageMatch && messageMatch[1]) || "",
    180
  );
  const noteBlock = [
    `Dive quiz submitted: ${submittedAt}`,
    quizRecommendedStart ? `Recommended start: ${quizRecommendedStart}` : "",
    quizRoute ? `Recommended route: ${quizRoute}` : "",
    quizMode ? `Quiz mode: ${quizMode}` : "",
    quizPath ? `Quiz path: ${quizPath}` : "",
    goals ? `Goals: ${goals}` : "",
    message ? `Message: ${message}` : "",
    quizAnswers ? `Answers: ${quizAnswers}` : "",
    pageUrl ? `Page: ${pageUrl}` : "",
  ].filter(Boolean).join("\n");
  const extras = {
    ...existingExtras,
    firstName: existingExtras.firstName || nameParts.firstName,
    lastName: existingExtras.lastName || nameParts.lastName,
    source: existingExtras.source || "Dive Path Quiz",
    quizLead: "1",
    quizLastSubmittedAt: submittedAt,
    quizRoute,
    quizMode,
    quizPath,
    quizRecommendedStart,
    quizAnswers,
    quizPageUrl: pageUrl,
  };

  if (!existing) {
    return createManagementRecord(env, {
      recordType: "contact",
      title: name || email,
      status: "active",
      priority: "normal",
      contactName: name,
      contactEmail: email,
      contactPhone: phone,
      notes: noteBlock,
      extras,
    });
  }

  const notes = normalizeManagementLongText(
    [noteBlock, existing.notes].filter(Boolean).join(existing.notes ? "\n\n" : ""),
    4000
  );
  const next = normalizeManagementRecord({
    ...existing,
    title: existing.title || name || email,
    status: existing.status || "active",
    priority: existing.priority || "normal",
    contactName: existing.contactName || name,
    contactEmail: email,
    contactPhone: existing.contactPhone || phone,
    notes,
    extras,
  }, existing);
  const now = submittedAt;
  await env.DB.prepare(
    `UPDATE management_records
     SET record_type = ?, title = ?, status = ?, priority = ?, owner = ?, contact_name = ?, contact_email = ?, contact_phone = ?, due_date = ?, related_event = ?, notes = ?, data_json = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      next.recordType,
      next.title,
      next.status,
      next.priority,
      next.owner,
      next.contactName,
      next.contactEmail,
      next.contactPhone,
      next.dueDate,
      next.relatedEvent,
      next.notes,
      JSON.stringify({ extras: next.extras }),
      now,
      existing.id
    )
    .run();
  return { ...next, id: existing.id, createdAt: existing.createdAt, updatedAt: now };
}

function getQuizRouteTitleLabel(route) {
  const key = normalizeManagementText(route, 80);
  const labels = {
    cert: "Open Water Certification",
    refresh: "Skill Refresh",
    travel: "Trip-Ready Coaching",
    contact: "Discovery Consult",
  };
  return labels[key] || key;
}

function buildQuizInquiryTitle(contact, fallbackTitle = "") {
  const contactName = normalizeManagementText(contact && (contact.contactName || contact.title || contact.contactEmail), 160);
  const extras = contact && contact.extras && typeof contact.extras === "object" ? contact.extras : {};
  const quizResult =
    normalizeManagementText(extras.quizRecommendedStart, 180) ||
    getQuizRouteTitleLabel(extras.quizRoute) ||
    normalizeManagementText(extras.quizPath, 120);
  const detail = ["Dive Path Quiz", quizResult].filter(Boolean).join(": ");
  return [contactName, detail].filter(Boolean).join(" - ") || fallbackTitle;
}

function buildQuizInquiryNotes(contact, fallbackNotes = "") {
  const contactName = normalizeManagementText(contact && (contact.contactName || contact.title || contact.contactEmail), 160);
  const extras = contact && contact.extras && typeof contact.extras === "object" ? contact.extras : {};
  const quizRoute = normalizeManagementText(extras.quizRoute, 120);
  const quizRecommendedStart = normalizeManagementText(extras.quizRecommendedStart, 180);
  const quizMode = normalizeManagementText(extras.quizMode, 80);
  const quizPath = normalizeManagementText(extras.quizPath, 120);
  const quizAnswers = normalizeManagementLongText(extras.quizAnswers, 1200);
  const contactNotes = normalizeManagementLongText(contact && contact.notes, 2400);
  const lines = [
    "Dive Path Quiz Result",
    "",
    contactName ? `Contact: ${contactName}` : "",
    contact && contact.contactEmail ? `Email: ${contact.contactEmail}` : "",
    contact && contact.contactPhone ? `Phone: ${contact.contactPhone}` : "",
    "",
    quizRecommendedStart ? `Recommended start: ${quizRecommendedStart}` : "",
    quizRoute ? `Recommended route: ${quizRoute}` : "",
    quizMode ? `Quiz mode: ${quizMode}` : "",
    quizPath ? `Quiz path: ${quizPath}` : "",
    quizAnswers ? `Answers: ${quizAnswers}` : "",
    "",
    "Original contact notes:",
    contactNotes || normalizeManagementLongText(fallbackNotes, 1200),
  ].filter((line) => line !== "");
  return normalizeManagementLongText(lines.join("\n"), 4000);
}

async function handleEventAlertSubscribe(request, env) {
  const body = await request.json().catch(() => ({}));
  const honey = String(body.honey || body.website || body.company || "").trim();
  if (honey) return jsonResponse({ ok: true }, 200, { "Cache-Control": "no-store" });

  const fields = body.fields && typeof body.fields === "object" ? body.fields : {};
  const name = normalizeManagementText(body.name || fields.name || fields["subscriber-name"], 160);
  const email = normalizeManagementText(body.email || fields.email || fields["subscriber-email"], 180).toLowerCase();
  const phone = normalizeManagementText(body.phone || fields.phone || fields["subscriber-phone"], 60);
  const pageUrl = normalizeManagementText(body.pageUrl, 500);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: "Valid email is required." }, 400, { "Cache-Control": "no-store" });
  }

  const saved = await saveEventAlertSubscriber(env, { name, email, phone, pageUrl });
  if (!saved || !saved.id) {
    return jsonResponse({ ok: false, error: "Could not save subscriber." }, 500, { "Cache-Control": "no-store" });
  }
  return jsonResponse({ ok: true, contactSaved: true }, 200, { "Cache-Control": "no-store" });
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
  const managementRecord = buildPublicInquiryManagementRecord({
    body,
    fields,
    lines,
    name,
    email,
    formName,
    subject,
    pageUrl,
    submittedAt,
  });

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
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

  if (shouldSendInterestAutoReply(body, fields)) {
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "Valid email is required." }, 400);
    }
    // 1) Notify DMZ inbox about the new interest-list signup.
    const notifyPayload = {
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject,
      text: message,
      reply_to: [email],
    };

    const notifyResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notifyPayload),
    });

    if (!notifyResp.ok) {
      const notifyError = await notifyResp.text();
      console.log("Resend notify error", notifyResp.status, notifyError);
      return jsonResponse(
        { ok: false, error: "Email send failed.", details: notifyError || null },
        502
      );
    }

    // 2) Send branded auto-reply to the user.
    const destinationName =
      getFieldValue(fields, "location") || getFieldValue(fields, "destination") || "this destination";
    const cozumel = isCozumelInterest(fields);
    const haigh = isHaighInterest(fields);
    const keyLargo = isKeyLargoInterest(fields);
    const mermet = isMermetInterest(fields);
    const playa = isPlayaInterest(fields);
    const roatan = isRoatanInterest(fields);
    const catalina = isCatalinaInterest(fields);
    const catalinaTemplateId = String(env.RESEND_TEMPLATE_CATALINA || "").trim();
    const roatanTemplateId = String(env.RESEND_TEMPLATE_ROATAN || "").trim();
    const playaTemplateId = String(env.RESEND_TEMPLATE_PLAYA || "").trim();
    const mermetTemplateId = String(env.RESEND_TEMPLATE_MERMET || "").trim();
    const haighTemplateId = String(env.RESEND_TEMPLATE_HAIGH || "").trim();
    const keyLargoTemplateId = String(env.RESEND_TEMPLATE_KEY_LARGO || "").trim();
    const cozumelTemplateId = String(env.RESEND_TEMPLATE_COZUMEL || "").trim();
    const defaultTemplateId = String(env.RESEND_TEMPLATE_INTEREST_DEFAULT || "").trim();

    let autoReplyPayload = null;
    if (catalina && catalinaTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Thank you for your interest in diving Catalina Island with DMZ Scuba.",
        reply_to: [toEmail],
        template: {
          id: catalinaTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else if (roatan && roatanTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Thank you for your interest in diving Roatan with DMZ Scuba.",
        reply_to: [toEmail],
        template: {
          id: roatanTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else if (playa && playaTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Thank you for your interest in diving Playa del Carmen with DMZ Scuba.",
        reply_to: [toEmail],
        template: {
          id: playaTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else if (mermet && mermetTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Thank you for your interest in diving Mermet Springs with DMZ Scuba.",
        reply_to: [toEmail],
        template: {
          id: mermetTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else if (haigh && haighTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Thank you for your interest in diving Haigh Quarry with DMZ Scuba.",
        reply_to: [toEmail],
        template: {
          id: haighTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else if (keyLargo && keyLargoTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Thank you for your interest in diving Key Largo with DMZ Scuba.",
        reply_to: [toEmail],
        template: {
          id: keyLargoTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else if (cozumel && cozumelTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Thank you for your interest in diving Cozumel with DMZ Scuba.",
        reply_to: [toEmail],
        template: {
          id: cozumelTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else if (!cozumel && defaultTemplateId) {
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: `You are on the DMZ Scuba interest list for ${destinationName}.`,
        reply_to: [toEmail],
        template: {
          id: defaultTemplateId,
          variables: buildTemplateVariables(name, destinationName),
        },
      };
    } else {
      const content = cozumel
        ? buildCozumelInterestEmail(name)
        : buildGenericInterestEmail(name, destinationName);
      autoReplyPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: content.subject,
        html: content.html,
        text: content.text,
        reply_to: [toEmail],
      };
    }

    const autoReplyResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(autoReplyPayload),
    });

    if (!autoReplyResp.ok) {
      const autoReplyError = await autoReplyResp.text();
      console.log("Resend auto-reply error", autoReplyResp.status, autoReplyError);
      return jsonResponse(
        { ok: false, error: "Email send failed.", details: autoReplyError || null },
        502
      );
    }
    const savedRecord = await savePublicInquiryManagementRecord(env, managementRecord);
    return jsonResponse({ ok: true, autoReplySent: true, notifySent: true, managementRecordSaved: Boolean(savedRecord) });
  }

  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [toEmail],
    subject,
    text: message,
  };

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

  const isQuizSubmission = shouldSendQuizResultsAutoReply(formName);
  let generalAutoReplySent = false;
  if (email && isValidEmail(email) && shouldSendGeneralInquiryAutoReply(formName)) {
    const generalTemplateId = String(env.RESEND_TEMPLATE_GENERAL_INQUIRY || "").trim();
    const quizTemplateId =
      String(env.RESEND_TEMPLATE_QUIZ_RESULTS || "").trim() || QUIZ_RESULTS_TEMPLATE_ID_FALLBACK;
    const selectedTemplateId = isQuizSubmission ? quizTemplateId : generalTemplateId;
    const autoReplyContent = isQuizSubmission
      ? buildQuizResultsConfirmationEmail()
      : buildGeneralInquiryConfirmationEmail(name);
    const autoReplyPayload = selectedTemplateId
      ? {
          from: `${fromName} <${fromEmail}>`,
          to: [email],
          subject: autoReplyContent.subject,
          reply_to: [toEmail],
          template: {
            id: selectedTemplateId,
            variables: buildTemplateVariables(name, ""),
          },
        }
      : {
          from: `${fromName} <${fromEmail}>`,
          to: [email],
          subject: autoReplyContent.subject,
          html: autoReplyContent.html,
          text: autoReplyContent.text,
          reply_to: [toEmail],
        };

    const autoReplyResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(autoReplyPayload),
    });
    if (!autoReplyResp.ok) {
      const autoReplyError = await autoReplyResp.text();
      console.log("Resend general auto-reply error", autoReplyResp.status, autoReplyError);
      return jsonResponse(
        { ok: false, error: "Email send failed.", details: autoReplyError || null },
        502
      );
    }
    generalAutoReplySent = true;
  }

  const savedQuizContact = isQuizSubmission
    ? await saveQuizLeadContact(env, {
        name,
        email,
        phone: getFieldValue(fields, "phone"),
        fields,
        message: body.message,
        subject,
        pageUrl,
        submittedAt,
      })
    : null;
  if (savedQuizContact && savedQuizContact.id) {
    const savedQuizExtras = savedQuizContact.extras && typeof savedQuizContact.extras === "object"
      ? savedQuizContact.extras
      : {};
    managementRecord.extras = {
      ...(managementRecord.extras || {}),
      source: "Dive Path Quiz",
      inquiryDirection: "incoming",
      inquiryCategory: "customer",
      quizRoute: savedQuizExtras.quizRoute || "",
      quizMode: savedQuizExtras.quizMode || "",
      quizPath: savedQuizExtras.quizPath || "",
      quizRecommendedStart: savedQuizExtras.quizRecommendedStart || "",
      quizAnswers: savedQuizExtras.quizAnswers || "",
      inquiryContactIds: [savedQuizContact.id],
    };
    managementRecord.title = buildQuizInquiryTitle(savedQuizContact, managementRecord.title);
    managementRecord.relatedEvent =
      savedQuizExtras.quizRecommendedStart ||
      getQuizRouteTitleLabel(savedQuizExtras.quizRoute) ||
      savedQuizExtras.quizPath ||
      managementRecord.relatedEvent;
    managementRecord.notes = buildQuizInquiryNotes(savedQuizContact, managementRecord.notes);
    managementRecord.contactName = savedQuizContact.contactName || managementRecord.contactName;
    managementRecord.contactEmail = savedQuizContact.contactEmail || managementRecord.contactEmail;
    managementRecord.contactPhone = savedQuizContact.contactPhone || managementRecord.contactPhone;
  }
  const savedRecord = await savePublicInquiryManagementRecord(env, managementRecord);
  return jsonResponse({
    ok: true,
    generalAutoReplySent,
    managementRecordSaved: Boolean(savedRecord),
    contactSaved: Boolean(savedQuizContact && savedQuizContact.id),
  });
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

function hasNonEmptyText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function hasNonEmptyList(value) {
  return Array.isArray(value) && value.some((entry) => {
    if (typeof entry === "string") return entry.trim() !== "";
    if (entry && typeof entry === "object") return Object.values(entry).some((v) => hasNonEmptyText(v));
    return false;
  });
}

function destinationWriteGuardReason(existingItem, nextItem) {
  if (!existingItem || typeof existingItem !== "object") return "";
  if (!nextItem || typeof nextItem !== "object") return "Payload item is missing or invalid.";

  const nextName = String(nextItem.name || "").trim().toLowerCase();
  const placeholderName = nextName === "destination" || nextName === "destination not found";
  const hasMedia = hasNonEmptyText(nextItem.heroImage) || hasNonEmptyText(nextItem.isoImage);
  const hasCopy =
    hasNonEmptyText(nextItem.summary) ||
    hasNonEmptyText(nextItem.narrative) ||
    hasNonEmptyList(nextItem.bullets) ||
    hasNonEmptyList(nextItem.diveSites);

  if (placeholderName && !hasMedia && !hasCopy) {
    return "Payload looks like fallback placeholder content, not a real destination.";
  }

  return "";
}

async function ensureDestinationsV2Table(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS destinations_v2 (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
}

function normalizeDestinationV2(item, id = "") {
  if (!item || typeof item !== "object") return null;
  const next = { ...item };
  const normalizedId = String(next.id || id || "").trim().toLowerCase();
  if (!normalizedId) return null;
  next.id = normalizedId;
  return next;
}

async function seedDestinationsV2IfNeeded(env) {
  await ensureDestinationsV2Table(env);
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM destinations_v2").first();
  const count = Number((countRow && countRow.count) || 0);
  if (count > 0) return;

  const now = new Date().toISOString();
  const insert = env.DB.prepare(
    `INSERT OR REPLACE INTO destinations_v2 (id, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  );

  const unifiedRows = await env.DB.prepare(
    "SELECT id, data_json, created_at, updated_at FROM destinations"
  ).all();
  const unified = unifiedRows.results || [];
  for (const row of unified) {
    const direct = parseJsonSafe(row && row.data_json, null);
    const item = normalizeDestinationV2(direct, row && row.id);
    if (!item) continue;
    const createdAt = (row && row.created_at) || now;
    const updatedAt = (row && row.updated_at) || now;
    await insert.bind(item.id, JSON.stringify(item), createdAt, updatedAt).run();
  }
}

async function listDestinationsV2(env) {
  await seedDestinationsV2IfNeeded(env);
  const rows = await env.DB.prepare("SELECT id, data_json FROM destinations_v2 ORDER BY id ASC").all();
  return (rows.results || [])
    .map((row) => normalizeDestinationV2(parseJsonSafe(row && row.data_json, null), row && row.id))
    .filter(Boolean);
}

async function getDestinationByIdV2(env, id) {
  const normalizedId = String(id || "").trim().toLowerCase();
  if (!normalizedId) return null;
  await seedDestinationsV2IfNeeded(env);
  const row = await env.DB.prepare("SELECT id, data_json FROM destinations_v2 WHERE id = ?").bind(normalizedId).first();
  if (!row) return null;
  return normalizeDestinationV2(parseJsonSafe(row && row.data_json, null), normalizedId);
}

async function ensureEventsV2Table(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS events_v2 (
      calendar_key TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
}

async function ensureSiteSettingsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS site_settings (
      setting_key TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
}

async function ensureManagementRecordsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS management_records (
      id TEXT PRIMARY KEY,
      customer_user_id TEXT,
      record_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      owner TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      due_date TEXT,
      related_event TEXT,
      notes TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare("ALTER TABLE management_records ADD COLUMN customer_user_id TEXT")
    .run()
    .catch(() => {});
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_management_type_status ON management_records(record_type, status)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_management_due_date ON management_records(due_date)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_management_customer_user ON management_records(customer_user_id, updated_at)"
  ).run();
}

function normalizeManagementText(value, maxLen = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeManagementLongText(value, maxLen = 4000) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().slice(0, maxLen);
}

function normalizeManagementChoice(value, fallback, allowed) {
  const normalized = normalizeManagementText(value, 60).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeManagementRecord(input = {}, existing = {}) {
  const source = input && typeof input === "object" ? input : {};
  const allowedTypes = ["contact", "inquiry", "class", "trip", "task"];
  const allowedStatuses = [
    "new",
    "active",
    "waiting",
    "scheduled",
    "complete",
    "archived",
    "to_contact",
    "reached_out",
    "gathering_details",
    "planning",
    "payment",
    "timing",
    "dead_end",
    "not_fit",
  ];
  const allowedPriorities = ["low", "normal", "high", "urgent"];
  const recordType = normalizeManagementChoice(source.recordType || source.type, existing.recordType || "inquiry", allowedTypes);
  const status = normalizeManagementChoice(source.status, existing.status || "new", allowedStatuses);
  const priority = normalizeManagementChoice(source.priority, existing.priority || "normal", allowedPriorities);
  const title = normalizeManagementText(source.title, 180);
  if (!title) return null;

  const extras = source.extras && typeof source.extras === "object" && !Array.isArray(source.extras)
    ? source.extras
    : {};
  return {
    id: normalizeManagementText(source.id || existing.id, 80),
    recordType,
    title,
    status,
    priority,
    owner: normalizeManagementText(source.owner, 120),
    contactName: normalizeManagementText(source.contactName, 160),
    contactEmail: normalizeManagementText(source.contactEmail, 180).toLowerCase(),
    contactPhone: normalizeManagementText(source.contactPhone, 60),
    dueDate: normalizeManagementText(source.dueDate, 20),
    relatedEvent: normalizeManagementText(source.relatedEvent, 180),
    notes: normalizeManagementLongText(source.notes, 4000),
    extras,
  };
}

async function createManagementRecord(env, input) {
  const record = normalizeManagementRecord(input);
  if (!record) return null;

  await ensureManagementRecordsTable(env);
  const now = new Date().toISOString();
  const id = record.id || crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO management_records
     (id, record_type, title, status, priority, owner, contact_name, contact_email, contact_phone, due_date, related_event, notes, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      record.recordType,
      record.title,
      record.status,
      record.priority,
      record.owner,
      record.contactName,
      record.contactEmail,
      record.contactPhone,
      record.dueDate,
      record.relatedEvent,
      record.notes,
      JSON.stringify({ extras: record.extras }),
      now,
      now
    )
    .run();

  return { ...record, id, createdAt: now, updatedAt: now };
}

function managementRecordFromRow(row) {
  const data = parseJsonSafe(row && row.data_json, {});
  return {
    id: String((row && row.id) || ""),
    recordType: String((row && row.record_type) || "inquiry"),
    title: String((row && row.title) || ""),
    status: String((row && row.status) || "new"),
    priority: String((row && row.priority) || "normal"),
    owner: String((row && row.owner) || ""),
    contactName: String((row && row.contact_name) || ""),
    contactEmail: String((row && row.contact_email) || ""),
    contactPhone: String((row && row.contact_phone) || ""),
    dueDate: String((row && row.due_date) || ""),
    relatedEvent: String((row && row.related_event) || ""),
    notes: String((row && row.notes) || ""),
    extras: data && typeof data.extras === "object" && !Array.isArray(data.extras) ? data.extras : {},
    createdAt: String((row && row.created_at) || ""),
    updatedAt: String((row && row.updated_at) || ""),
  };
}

function isManagementContactEmailAlertSubscriber(record) {
  if (!record || record.recordType !== "contact") return false;
  const email = normalizeManagementText(record.contactEmail, 180).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const extras = record.extras && typeof record.extras === "object" && !Array.isArray(record.extras)
    ? record.extras
    : {};
  const optedIn = String(extras.emailAlerts || "").trim().toLowerCase();
  const optedOut = String(extras.emailAlertsOptOut || extras.unsubscribed || "").trim().toLowerCase();
  if (["1", "true", "yes", "on", "subscribed"].includes(optedOut)) return false;
  return extras.emailAlerts === true || ["1", "true", "yes", "on", "subscribed"].includes(optedIn);
}

function toEventAlertSubscriber(record) {
  const extras = record.extras && typeof record.extras === "object" && !Array.isArray(record.extras)
    ? record.extras
    : {};
  const firstName = normalizeManagementText(extras.firstName, 80);
  const lastName = normalizeManagementText(extras.lastName, 80);
  const fullName = normalizeManagementText(
    record.contactName || [firstName, lastName].filter(Boolean).join(" ") || record.title,
    160
  );
  return {
    id: record.id,
    name: fullName,
    firstName,
    lastName,
    email: normalizeManagementText(record.contactEmail, 180).toLowerCase(),
    phone: normalizeManagementText(record.contactPhone, 60),
    source: normalizeManagementText(extras.source || extras.emailAlertsSource, 120),
    subscribedAt: normalizeManagementText(extras.emailAlertsSubscribedAt || record.createdAt, 40),
    updatedAt: normalizeManagementText(extras.emailAlertsUpdatedAt || record.updatedAt, 40),
  };
}

async function listEventAlertSubscribers(env) {
  await ensureManagementRecordsTable(env);
  const rows = await env.DB.prepare(
    "SELECT * FROM management_records WHERE record_type = 'contact' ORDER BY updated_at DESC"
  ).all();
  const byEmail = new Map();
  (rows.results || [])
    .map(managementRecordFromRow)
    .filter(isManagementContactEmailAlertSubscriber)
    .forEach((record) => {
      const subscriber = toEventAlertSubscriber(record);
      if (!subscriber.email || byEmail.has(subscriber.email)) return;
      byEmail.set(subscriber.email, subscriber);
    });
  return Array.from(byEmail.values()).sort((a, b) =>
    String(a.name || a.email).localeCompare(String(b.name || b.email))
  );
}

async function handleListEventAlertSubscribers(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401, { "Cache-Control": "no-store" });

  const subscribers = await listEventAlertSubscribers(env);
  return jsonResponse({ ok: true, count: subscribers.length, subscribers }, 200, { "Cache-Control": "no-store" });
}

async function handleListManagementRecords(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401, { "Cache-Control": "no-store" });

  await ensureManagementRecordsTable(env);
  const url = new URL(request.url);
  const type = normalizeManagementText(url.searchParams.get("type"), 40).toLowerCase();
  const status = normalizeManagementText(url.searchParams.get("status"), 40).toLowerCase();
  const allowedTypes = ["contact", "inquiry", "class", "trip", "task"];
  const allowedStatuses = [
    "new",
    "active",
    "waiting",
    "scheduled",
    "complete",
    "archived",
    "to_contact",
    "reached_out",
    "gathering_details",
    "planning",
    "payment",
    "timing",
    "dead_end",
    "not_fit",
  ];
  let sql = "SELECT * FROM management_records";
  const conditions = [];
  const bindings = [];
  if (allowedTypes.includes(type)) {
    conditions.push("record_type = ?");
    bindings.push(type);
  }
  if (allowedStatuses.includes(status)) {
    conditions.push("status = ?");
    bindings.push(status);
  }
  if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
  sql += " ORDER BY CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date ASC, updated_at DESC";

  const stmt = env.DB.prepare(sql);
  const rows = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
  const items = (rows.results || []).map(managementRecordFromRow);
  return jsonResponse({ ok: true, items }, 200, { "Cache-Control": "no-store" });
}

async function handleCreateManagementRecord(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401, { "Cache-Control": "no-store" });

  const body = await request.json().catch(() => ({}));
  const incoming = body && typeof body.record === "object" ? body.record : body;
  const record = await createManagementRecord(env, incoming);
  if (!record) return jsonResponse({ ok: false, error: "Title is required." }, 400, { "Cache-Control": "no-store" });

  return jsonResponse({ ok: true, item: record }, 201, { "Cache-Control": "no-store" });
}

async function handleUpdateManagementRecord(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401, { "Cache-Control": "no-store" });

  const safeId = normalizeManagementText(id, 80);
  if (!safeId) return jsonResponse({ ok: false, error: "Missing record id." }, 400, { "Cache-Control": "no-store" });

  await ensureManagementRecordsTable(env);
  const existingRow = await env.DB.prepare("SELECT * FROM management_records WHERE id = ?").bind(safeId).first();
  if (!existingRow) return jsonResponse({ ok: false, error: "Not found." }, 404, { "Cache-Control": "no-store" });

  const body = await request.json().catch(() => ({}));
  const incoming = body && typeof body.record === "object" ? body.record : body;
  const existing = managementRecordFromRow(existingRow);
  const record = normalizeManagementRecord({ ...existing, ...incoming, id: safeId }, existing);
  if (!record) return jsonResponse({ ok: false, error: "Title is required." }, 400, { "Cache-Control": "no-store" });

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE management_records
     SET record_type = ?, title = ?, status = ?, priority = ?, owner = ?, contact_name = ?, contact_email = ?, contact_phone = ?, due_date = ?, related_event = ?, notes = ?, data_json = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      record.recordType,
      record.title,
      record.status,
      record.priority,
      record.owner,
      record.contactName,
      record.contactEmail,
      record.contactPhone,
      record.dueDate,
      record.relatedEvent,
      record.notes,
      JSON.stringify({ extras: record.extras }),
      now,
      safeId
    )
    .run();

  return jsonResponse({ ok: true, item: { ...record, id: safeId, createdAt: existing.createdAt, updatedAt: now } }, 200, { "Cache-Control": "no-store" });
}

async function handleDeleteManagementRecord(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401, { "Cache-Control": "no-store" });

  const safeId = normalizeManagementText(id, 80);
  if (!safeId) return jsonResponse({ ok: false, error: "Missing record id." }, 400, { "Cache-Control": "no-store" });
  await ensureManagementRecordsTable(env);
  const result = await env.DB.prepare("DELETE FROM management_records WHERE id = ?").bind(safeId).run();
  if (!result || !result.meta || !result.meta.changes) {
    return jsonResponse({ ok: false, error: "Not found." }, 404, { "Cache-Control": "no-store" });
  }
  return jsonResponse({ ok: true, id: safeId }, 200, { "Cache-Control": "no-store" });
}

function normalizeHomeTickerPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const rawLines = Array.isArray(source.lines) ? source.lines : [];
  const lines = rawLines
    .map((entry) => String(entry || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((entry) => entry.slice(0, 220));
  return { lines };
}

async function getHomeTickerPayload(env) {
  await ensureSiteSettingsTable(env);
  const row = await env.DB.prepare("SELECT data_json FROM site_settings WHERE setting_key = ?")
    .bind("home_ticker")
    .first();
  if (!row) return null;
  return normalizeHomeTickerPayload(parseJsonSafe(row && row.data_json, null));
}

function normalizeEventRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  const weekOfMonth = Number(rule.weekOfMonth);
  const weekday = Number(rule.weekday);
  if (!Number.isFinite(weekOfMonth) || !Number.isFinite(weekday)) return null;
  return {
    weekOfMonth: Math.max(1, Math.min(5, Math.trunc(weekOfMonth))),
    weekday: Math.max(0, Math.min(6, Math.trunc(weekday))),
  };
}

function isValidRepeatUnit(value) {
  return value === "week" || value === "month" || value === "year";
}

function deriveLegacyTemplateStartDate(item) {
  if (!item || !item.startMonth || !item.rule) return "";
  const parts = String(item.startMonth).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return "";
  const weekOfMonth = Number(item.rule.weekOfMonth);
  const weekday = Number(item.rule.weekday);
  if (!Number.isFinite(weekOfMonth) || !Number.isFinite(weekday)) return "";
  const first = new Date(year, month - 1, 1);
  const shift = (7 + weekday - first.getDay()) % 7;
  const dayNumber = 1 + shift + (weekOfMonth - 1) * 7;
  const candidate = new Date(year, month - 1, dayNumber);
  if (candidate.getMonth() !== month - 1) return "";
  return candidate.toISOString().slice(0, 10);
}

function normalizeEventDefinition(item) {
  if (!item || typeof item !== "object") return null;
  const id = String(item.id || "").trim().toLowerCase();
  const title = String(item.title || "").trim();
  if (!id || !title) return null;
  return {
    id,
    slug: String(item.slug || id).trim().toLowerCase(),
    title,
    type: String(item.type || "Event").trim() || "Event",
    eyebrow: String(item.eyebrow || "").trim(),
    heroSummary: String(item.heroSummary || "").trim(),
    narrative: String(item.narrative || "").trim(),
    experience: String(item.experience || "").trim(),
    scheduleNote: String(item.scheduleNote || "").trim(),
    whatToExpect: Array.isArray(item.whatToExpect)
      ? item.whatToExpect.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    included: Array.isArray(item.included)
      ? item.included.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    primaryCtaLabel: String(item.primaryCtaLabel || "").trim(),
    primaryCtaHref: String(item.primaryCtaHref || "").trim(),
  };
}

function normalizeEventRosterEntry(item) {
  if (!item || typeof item !== "object") return null;
  const contactId = String(item.contactId || "").trim();
  const email = String(item.email || "").trim().toLowerCase();
  const name = String(item.name || "").trim();
  const firstName = String(item.firstName || "").trim();
  const lastName = String(item.lastName || "").trim();
  if (!contactId && !email && !name && !firstName) return null;
  return {
    contactId,
    firstName,
    lastName,
    name,
    email,
    phone: String(item.phone || "").trim(),
    certificationLevel: String(item.certificationLevel || "").trim(),
    source: String(item.source || "").trim(),
    sourceRegistrationId: String(item.sourceRegistrationId || "").trim(),
    status: String(item.status || "").trim(),
  };
}

function normalizeEventEntry(item, kind = "event") {
  if (!item || typeof item !== "object") return null;
  const next = { ...item };
  const id = String(next.id || "").trim().toLowerCase();
  const title = String(next.title || "").trim();
  if (!id || !title) return null;
  const normalized = {
    id,
    title,
    time: String(next.time || "").trim(),
    endTime: String(next.endTime || "").trim(),
    type: String(next.type || "Event").trim() || "Event",
    status: String(next.status || "").trim(),
    location: String(next.location || "").trim(),
    summary: String(next.summary || "").trim(),
    registrationEnabled: Boolean(next.registrationEnabled),
    registrationClosed: Boolean(next.registrationClosed),
    registrationCapacity: Math.max(0, Math.trunc(Number(next.registrationCapacity) || 0)),
    registrationEmailSubject: String(next.registrationEmailSubject || "").trim(),
    registrationEmailUseTemplate: Boolean(next.registrationEmailUseTemplate),
    registrationEmailTemplateId: String(next.registrationEmailTemplateId || "").trim(),
    registrationEmailIsHtml: Boolean(next.registrationEmailIsHtml),
    registrationEmailContent: String(next.registrationEmailContent || "").trim(),
    registrationEmailUseFullHtml: Boolean(next.registrationEmailUseFullHtml),
    registrationEmailFullHtml: String(next.registrationEmailFullHtml || "").trim(),
    ctaLabel: String(next.ctaLabel || "").trim(),
    ctaHref: String(next.ctaHref || "").trim(),
    managementPriority: String(next.managementPriority || "").trim(),
    managementOwner: String(next.managementOwner || "").trim(),
    managementContactName: String(next.managementContactName || "").trim(),
    managementContactEmail: String(next.managementContactEmail || "").trim(),
    managementContactPhone: String(next.managementContactPhone || "").trim(),
    managementDueDate: String(next.managementDueDate || "").trim(),
    managementAmountOwed: String(next.managementAmountOwed || "").trim(),
    managementAmountPaid: String(next.managementAmountPaid || "").trim(),
    managementNextStep: String(next.managementNextStep || "").trim(),
    managementNotes: String(next.managementNotes || "").trim(),
    managementClassId: String(next.managementClassId || "").trim().toLowerCase(),
    managementClassSessionType: String(next.managementClassSessionType || "").trim(),
    managementClassSessionIndex: Math.max(0, Math.trunc(Number(next.managementClassSessionIndex) || 0)),
    managementClassPrimary: Boolean(next.managementClassPrimary),
    managementClassRoster: Array.isArray(next.managementClassRoster)
      ? next.managementClassRoster.map((entry) => normalizeEventRosterEntry(entry)).filter(Boolean).slice(0, 200)
      : [],
  };
  const endDate = String(next.endDate || "").trim();

  if (kind === "template") {
    const startDate = String(next.startDate || deriveLegacyTemplateStartDate(next) || "").trim();
    if (!startDate) return null;
    normalized.startDate = startDate;
    normalized.repeatInterval = Math.max(
      1,
      Math.trunc(Number(next.repeatInterval || next.intervalMonths) || 1)
    );
    normalized.repeatUnit = isValidRepeatUnit(String(next.repeatUnit || "").trim())
      ? String(next.repeatUnit || "").trim()
      : "month";
    const explicitEndDate = String(next.endDate || "").trim();
    if (explicitEndDate && explicitEndDate >= startDate) {
      normalized.endDate = explicitEndDate;
    } else {
      const durationDays = Math.max(1, Math.trunc(Number(next.durationDays) || 1));
      if (durationDays > 1) normalized.durationDays = durationDays;
    }
    if (Array.isArray(next.excludedDates)) {
      normalized.excludedDates = Array.from(
        new Set(
          next.excludedDates
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )
      ).sort();
    }
    if (Array.isArray(next.months)) {
      normalized.months = next.months
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 12);
    }
    return normalized;
  }

  const date = String(next.date || "").trim();
  if (!date) return null;
  normalized.date = date;
  if (endDate && endDate >= date) normalized.endDate = endDate;
  return normalized;
}

function normalizeEventsPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const definitions = Array.isArray(payload.definitions)
    ? payload.definitions.map((item) => normalizeEventDefinition(item)).filter(Boolean)
    : [];
  const templates = Array.isArray(payload.templates)
    ? payload.templates.map((item) => normalizeEventEntry(item, "template")).filter(Boolean)
    : [];
  const events = Array.isArray(payload.events)
    ? payload.events.map((item) => normalizeEventEntry(item, "event")).filter(Boolean)
    : [];
  return {
    updated: String(payload.updated || new Date().toISOString().slice(0, 10)).trim(),
    timezone: String(payload.timezone || "America/Chicago").trim(),
    horizonMonths: Math.max(1, Math.min(60, Math.trunc(Number(payload.horizonMonths) || 30))),
    previewCount: Math.max(1, Math.min(12, Math.trunc(Number(payload.previewCount) || 3))),
    definitions,
    events,
    templates,
  };
}

async function getEventsPayloadV2(env) {
  await ensureEventsV2Table(env);
  const row = await env.DB.prepare("SELECT data_json FROM events_v2 WHERE calendar_key = ?")
    .bind("primary")
    .first();
  if (!row) return null;
  return normalizeEventsPayload(parseJsonSafe(row && row.data_json, null));
}

async function handleGetEventsV2(env) {
  const payload = await getEventsPayloadV2(env);
  if (!payload) return jsonResponse({ ok: false, error: "Not found." }, 404, { "Cache-Control": "no-store" });
  return jsonResponse(payload, 200, {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
  });
}

async function saveEventsPayloadV2(env, payload) {
  await ensureEventsV2Table(env);
  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT created_at FROM events_v2 WHERE calendar_key = ?")
    .bind("primary")
    .first();
  const createdAt = (existing && existing.created_at) || now;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO events_v2 (calendar_key, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind("primary", JSON.stringify(payload), createdAt, now)
    .run();
  return now;
}

async function handlePutEventsV2(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => ({}));
  const incoming = body && typeof body.payload === "object" ? body.payload : body;
  const payload = normalizeEventsPayload(incoming);
  if (!payload) return jsonResponse({ ok: false, error: "Invalid payload." }, 400);

  const now = await saveEventsPayloadV2(env, payload);
  return jsonResponse({ ok: true, payload, updatedAt: now }, 200, { "Cache-Control": "no-store" });
}

async function handleDeleteEventsV2(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  await ensureEventsV2Table(env);
  await env.DB.prepare("DELETE FROM events_v2 WHERE calendar_key = ?").bind("primary").run();
  return jsonResponse({ ok: true }, 200, { "Cache-Control": "no-store" });
}

async function ensureEventRegistrationsV2Table(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS event_registrations_v2 (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      source_id TEXT NOT NULL,
      event_date TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      cert_level TEXT NOT NULL,
      additional_guests INTEGER NOT NULL DEFAULT 0,
      party_size INTEGER NOT NULL DEFAULT 1,
      approval_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare("ALTER TABLE event_registrations_v2 ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending'")
    .run()
    .catch(() => {});
  await env.DB.prepare("ALTER TABLE event_registrations_v2 ADD COLUMN user_id TEXT")
    .run()
    .catch(() => {});
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_event_regs_source_date ON event_registrations_v2(source_id, event_date)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_event_regs_user ON event_registrations_v2(user_id, created_at)"
  ).run();
}

function normalizeRegistrationText(value, maxLen = 120) {
  return String(value || "").trim().slice(0, maxLen);
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function getChicagoTodayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function addDaysToDateKey(value, days) {
  if (!isDateKey(value)) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function getRegistrationEndDate(item, eventDate) {
  const explicitEnd = String((item && item.endDate) || "").trim();
  if (isDateKey(explicitEnd) && explicitEnd >= eventDate) return explicitEnd;
  const durationDays = Math.max(1, Number((item && item.durationDays) || 1) || 1);
  return durationDays > 1 ? addDaysToDateKey(eventDate, durationDays - 1) : eventDate;
}

function isRegistrationPast(config) {
  const endDate = String((config && (config.endDate || config.eventDate)) || "").trim();
  return isDateKey(endDate) && endDate < getChicagoTodayKey();
}

function buildRegistrantLabel(firstName, lastName) {
  const first = normalizeRegistrationText(firstName, 40);
  const last = normalizeRegistrationText(lastName, 40);
  const initial = last ? `${last[0].toUpperCase()}.` : "";
  return [first, initial].filter(Boolean).join(" ");
}

function resolveRegistrationConfig(payload, sourceId, eventDate) {
  if (!payload || !sourceId || !eventDate) return null;
  const events = Array.isArray(payload.events) ? payload.events : [];
  const templates = Array.isArray(payload.templates) ? payload.templates : [];
  const definitions = Array.isArray(payload.definitions) ? payload.definitions : [];
  const getDescriptionForItem = (item) => {
    if (!item || typeof item !== "object") return "";
    const summary = String(item.summary || "").trim();
    if (summary) return summary;
    const definitionId = String(item.eventId || item.id || "").trim().toLowerCase();
    const definition = definitions.find((entry) => entry && String(entry.id || "").trim().toLowerCase() === definitionId);
    if (!definition) return "";
    return String(definition.narrative || definition.heroSummary || "").trim();
  };
  const getRegistrationEmailContentForItem = (item) => {
    if (!item || typeof item !== "object") return "";
    const content = String(item.registrationEmailContent || "").trim();
    return content || getDescriptionForItem(item);
  };
  const getRegistrationEmailSubjectForItem = (item) => {
    if (!item || typeof item !== "object") return "";
    return String(item.registrationEmailSubject || "").trim();
  };
  const eventMatch = events.find((item) => item && item.id === sourceId && item.date === eventDate);
  if (eventMatch) {
    return {
      sourceId,
      eventDate,
      endDate: getRegistrationEndDate(eventMatch, eventDate),
      title: String(eventMatch.title || "").trim(),
      time: String(eventMatch.time || "").trim(),
      endTime: String(eventMatch.endTime || "").trim(),
      type: String(eventMatch.type || "").trim(),
      location: String(eventMatch.location || "").trim(),
      description: getDescriptionForItem(eventMatch),
      registrationEmailSubject: getRegistrationEmailSubjectForItem(eventMatch),
      registrationEmailUseTemplate: Boolean(eventMatch.registrationEmailUseTemplate),
      registrationEmailTemplateId: String(eventMatch.registrationEmailTemplateId || "").trim(),
      registrationEmailIsHtml: Boolean(eventMatch.registrationEmailIsHtml),
      registrationEmailContent: getRegistrationEmailContentForItem(eventMatch),
      registrationEmailUseFullHtml: Boolean(eventMatch.registrationEmailUseFullHtml),
      registrationEmailFullHtml: String(eventMatch.registrationEmailFullHtml || "").trim(),
      registrationEnabled: Boolean(eventMatch.registrationEnabled),
      registrationClosed: Boolean(eventMatch.registrationClosed),
      registrationCapacity: Math.max(0, Number(eventMatch.registrationCapacity) || 0),
      managementClassId: String(eventMatch.managementClassId || "").trim().toLowerCase(),
      managementClassRoster: Array.isArray(eventMatch.managementClassRoster) ? eventMatch.managementClassRoster : [],
    };
  }
  const templateMatch = templates.find((item) => item && item.id === sourceId);
  if (!templateMatch) return null;
  return {
    sourceId,
    eventDate,
    endDate: getRegistrationEndDate(templateMatch, eventDate),
    title: String(templateMatch.title || "").trim(),
    time: String(templateMatch.time || "").trim(),
    endTime: String(templateMatch.endTime || "").trim(),
    type: String(templateMatch.type || "").trim(),
    location: String(templateMatch.location || "").trim(),
    description: getDescriptionForItem(templateMatch),
    registrationEmailSubject: getRegistrationEmailSubjectForItem(templateMatch),
    registrationEmailUseTemplate: Boolean(templateMatch.registrationEmailUseTemplate),
    registrationEmailTemplateId: String(templateMatch.registrationEmailTemplateId || "").trim(),
    registrationEmailIsHtml: Boolean(templateMatch.registrationEmailIsHtml),
    registrationEmailContent: getRegistrationEmailContentForItem(templateMatch),
    registrationEmailUseFullHtml: Boolean(templateMatch.registrationEmailUseFullHtml),
    registrationEmailFullHtml: String(templateMatch.registrationEmailFullHtml || "").trim(),
    registrationEnabled: Boolean(templateMatch.registrationEnabled),
    registrationClosed: Boolean(templateMatch.registrationClosed),
    registrationCapacity: Math.max(0, Number(templateMatch.registrationCapacity) || 0),
    managementClassId: String(templateMatch.managementClassId || "").trim().toLowerCase(),
    managementClassRoster: Array.isArray(templateMatch.managementClassRoster) ? templateMatch.managementClassRoster : [],
  };
}

async function setRegistrationClosedForPayload(env, payload, sourceId, eventDate, closed) {
  if (!payload || !sourceId) return false;
  const safeSourceId = String(sourceId || "").trim();
  const safeEventDate = String(eventDate || "").trim();
  const nextClosed = Boolean(closed);
  const events = Array.isArray(payload.events) ? payload.events : [];
  const templates = Array.isArray(payload.templates) ? payload.templates : [];
  const eventMatch = events.find((item) => item && item.id === safeSourceId && item.date === safeEventDate);
  if (eventMatch) {
    if (Boolean(eventMatch.registrationClosed) === nextClosed) return false;
    eventMatch.registrationClosed = nextClosed;
    payload.updated = new Date().toISOString().slice(0, 10);
    await saveEventsPayloadV2(env, payload);
    return true;
  }
  const templateMatch = templates.find((item) => item && item.id === safeSourceId);
  if (!templateMatch || Boolean(templateMatch.registrationClosed) === nextClosed) return false;
  templateMatch.registrationClosed = nextClosed;
  payload.updated = new Date().toISOString().slice(0, 10);
  await saveEventsPayloadV2(env, payload);
  return true;
}

function getManagementRecordExtras(row) {
  try {
    const parsed = JSON.parse(String((row && row.data_json) || "{}"));
    return parsed && parsed.extras && typeof parsed.extras === "object" ? parsed.extras : {};
  } catch (_error) {
    return {};
  }
}

function getContactClassEnrollmentsFromRow(row) {
  const extras = getManagementRecordExtras(row);
  return Array.isArray(extras.classEnrollments) ? extras.classEnrollments : [];
}

async function getManagementClassRoster(env, classId) {
  const safeClassId = String(classId || "").trim().toLowerCase();
  if (!safeClassId) return [];
  await ensureManagementRecordsTable(env);
  const rows = await env.DB.prepare(
    `SELECT id, title, contact_name, contact_email, contact_phone, data_json
     FROM management_records
     WHERE record_type = 'contact' AND data_json LIKE ?`
  )
    .bind(`%"classId":"${safeClassId}"%`)
    .all();
  return (rows.results || [])
    .map((row) => {
      const extras = getManagementRecordExtras(row);
      const enrollment = getContactClassEnrollmentsFromRow(row).find((entry) =>
        String((entry && entry.classId) || "").trim().toLowerCase() === safeClassId
      );
      if (!enrollment) return null;
      const contactName = String((row && (row.contact_name || row.title)) || "").trim();
      const nameParts = contactName.split(/\s+/).filter(Boolean);
      return {
        contactId: String((row && row.id) || "").trim(),
        firstName: String(extras.firstName || nameParts[0] || "").trim(),
        lastName: String(extras.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "") || "").trim(),
        name: contactName || String((row && row.contact_email) || "").trim() || "Registered diver",
        email: String((row && row.contact_email) || "").trim().toLowerCase(),
        phone: String((row && row.contact_phone) || "").trim(),
        certificationLevel: String(extras.certification || "").trim(),
        source: String((enrollment && enrollment.source) || "in_house").trim(),
        sourceRegistrationId: String((enrollment && enrollment.sourceRegistrationId) || "").trim(),
        status: String((enrollment && enrollment.status) || "enrolled").trim(),
      };
    })
    .filter(Boolean);
}

async function getRegistrationSnapshot(env, sourceId, eventDate, config) {
  await ensureEventRegistrationsV2Table(env);
  const rows = await env.DB.prepare(
    `SELECT id, first_name, last_name, email, phone, cert_level, additional_guests, party_size, approval_status, created_at
     FROM event_registrations_v2
     WHERE source_id = ? AND event_date = ?
     ORDER BY created_at ASC`
  )
    .bind(sourceId, eventDate)
    .all();
  const list = (rows.results || []).map((row) => ({
    id: String((row && row.id) || "").trim(),
    firstName: String((row && row.first_name) || "").trim(),
    lastName: String((row && row.last_name) || "").trim(),
    name: buildRegistrantLabel(row && row.first_name, row && row.last_name),
    email: String((row && row.email) || "").trim(),
    phone: String((row && row.phone) || "").trim(),
    certificationLevel: String((row && row.cert_level) || "").trim(),
    additionalGuests: Math.max(0, Number((row && row.additional_guests) || 0) || 0),
    partySize: Math.max(1, Number((row && row.party_size) || 1) || 1),
    approvalStatus: String((row && row.approval_status) || "pending").trim() === "approved" ? "approved" : "pending",
    createdAt: String((row && row.created_at) || ""),
    source: "online_registration",
  }));
  const liveRoster = await getManagementClassRoster(env, config && config.managementClassId);
  const configuredRoster = Array.isArray(config && config.managementClassRoster) ? config.managementClassRoster : [];
  const rosterSource = liveRoster.length ? liveRoster : configuredRoster;
  const rosterList = rosterSource
    .map((entry) => {
      const firstName = String((entry && entry.firstName) || "").trim();
      const lastName = String((entry && entry.lastName) || "").trim();
      const displayName = String((entry && entry.name) || "").trim();
      return {
        id: String((entry && entry.sourceRegistrationId) || (entry && entry.contactId) || "").trim(),
        contactId: String((entry && entry.contactId) || "").trim(),
        firstName,
        lastName,
        name: buildRegistrantLabel(firstName || displayName, firstName ? lastName : ""),
        email: String((entry && entry.email) || "").trim(),
        phone: String((entry && entry.phone) || "").trim(),
        certificationLevel: String((entry && entry.certificationLevel) || "").trim(),
        additionalGuests: 0,
        partySize: 1,
        createdAt: "",
        source: "management_roster",
        approvalStatus: "approved",
        sourceRegistrationId: String((entry && entry.sourceRegistrationId) || "").trim(),
      };
    })
    .filter((entry) => entry.name || entry.email || entry.contactId);
  const rosterRegistrationIds = new Set(
    rosterList.map((entry) => String(entry.sourceRegistrationId || "").trim()).filter(Boolean)
  );
  const rosterEmails = new Set(
    rosterList.map((entry) => String(entry.email || "").trim().toLowerCase()).filter(Boolean)
  );
  const uniqueOnlineList = list.filter((entry) => {
    const id = String(entry.id || "").trim();
    const email = String(entry.email || "").trim().toLowerCase();
    if (id && rosterRegistrationIds.has(id)) return false;
    if (email && rosterEmails.has(email)) return false;
    return true;
  });
  const approvedOnlineList = uniqueOnlineList.filter((entry) => entry.approvalStatus === "approved");
  const registeredDivers = [...rosterList, ...uniqueOnlineList];
  const usedSpots = registeredDivers.reduce((sum, entry) => sum + Math.max(1, Number(entry.partySize) || 1), 0);
  const capacity = Math.max(0, Number((config && config.registrationCapacity) || 0) || 0);
  const remainingSpots = capacity > 0 ? Math.max(0, capacity - usedSpots) : 0;
  return {
    sourceId,
    eventDate,
    registrationEnabled: Boolean(config && config.registrationEnabled),
    registrationClosed: Boolean(config && config.registrationClosed) || isRegistrationPast(config),
    registrationCapacity: capacity,
    usedSpots,
    remainingSpots,
    rosterSpots: rosterList.length,
    onlineSpots: uniqueOnlineList.reduce((sum, entry) => sum + Math.max(1, Number(entry.partySize) || 1), 0),
    approvedOnlineSpots: approvedOnlineList.reduce((sum, entry) => sum + Math.max(1, Number(entry.partySize) || 1), 0),
    pendingSpots: uniqueOnlineList
      .filter((entry) => entry.approvalStatus !== "approved")
      .reduce((sum, entry) => sum + Math.max(1, Number(entry.partySize) || 1), 0),
    registrants: list,
    rosterRegistrants: rosterList,
    registeredDivers,
  };
}

function buildPublicRegistrationSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  return {
    sourceId: String(source.sourceId || ""),
    eventDate: String(source.eventDate || ""),
    registrationEnabled: Boolean(source.registrationEnabled),
    registrationClosed: Boolean(source.registrationClosed),
    registrationCapacity: Math.max(0, Number(source.registrationCapacity) || 0),
    usedSpots: Math.max(0, Number(source.usedSpots) || 0),
    remainingSpots: Math.max(0, Number(source.remainingSpots) || 0),
  };
}

async function handleGetEventRegistrationsV2(request, env, sourceId) {
  const url = new URL(request.url);
  const eventDate = String(url.searchParams.get("date") || "").trim();
  if (!sourceId || !eventDate) {
    return jsonResponse({ ok: false, error: "Missing source id or date." }, 400, { "Cache-Control": "no-store" });
  }
  const payload = await getEventsPayloadV2(env);
  const config = resolveRegistrationConfig(payload, sourceId, eventDate);
  if (!config) {
    return jsonResponse({ ok: false, error: "Event not found." }, 404, { "Cache-Control": "no-store" });
  }
  const snapshot = await getRegistrationSnapshot(env, sourceId, eventDate, config);
  return jsonResponse({ ok: true, ...buildPublicRegistrationSnapshot(snapshot) }, 200, { "Cache-Control": "no-store" });
}

async function handleGetAdminEventRegistrationsV2(request, env, sourceId) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const eventDate = String(url.searchParams.get("date") || "").trim();
  if (!sourceId || !eventDate) {
    return jsonResponse({ ok: false, error: "Missing source id or date." }, 400, { "Cache-Control": "no-store" });
  }
  const payload = await getEventsPayloadV2(env);
  const config = resolveRegistrationConfig(payload, sourceId, eventDate);
  if (!config) {
    return jsonResponse({ ok: false, error: "Event not found." }, 404, { "Cache-Control": "no-store" });
  }
  const snapshot = await getRegistrationSnapshot(env, sourceId, eventDate, config);
  return jsonResponse({ ok: true, ...snapshot }, 200, { "Cache-Control": "no-store" });
}

async function handleCreateEventRegistrationV2(request, env, sourceId) {
  let customerIdentity = null;
  const customerToken = getBearerToken(request);
  if (customerToken) {
    if (!isCustomerAuthConfigured(env)) {
      return jsonResponse({ ok: false, error: "Customer accounts are not configured yet." }, 503);
    }
    try {
      customerIdentity = await verifySupabaseAccessToken(customerToken, env);
    } catch (_error) {
      return jsonResponse({ ok: false, error: "Your session expired. Please sign in again." }, 401);
    }
  }
  const body = await request.json().catch(() => ({}));
  const eventDate = normalizeRegistrationText(body && body.eventDate, 20);
  if (!sourceId || !eventDate) {
    return jsonResponse({ ok: false, error: "Missing source id or date." }, 400, { "Cache-Control": "no-store" });
  }
  const payload = await getEventsPayloadV2(env);
  const config = resolveRegistrationConfig(payload, sourceId, eventDate);
  if (!config) {
    return jsonResponse({ ok: false, error: "Event not found." }, 404, { "Cache-Control": "no-store" });
  }
  if (!config.registrationEnabled || config.registrationCapacity <= 0) {
    return jsonResponse({ ok: false, error: "Registration is not enabled for this event." }, 400, { "Cache-Control": "no-store" });
  }
  if (config.registrationClosed) {
    return jsonResponse({ ok: false, error: "Registration has closed for this event." }, 409, { "Cache-Control": "no-store" });
  }
  if (isRegistrationPast(config)) {
    return jsonResponse({ ok: false, error: "Registration has closed because this event has passed." }, 409, { "Cache-Control": "no-store" });
  }

  const firstName = normalizeRegistrationText(body && body.firstName, 60);
  const lastName = normalizeRegistrationText(body && body.lastName, 60);
  const email = normalizeRegistrationText(body && body.email, 160).toLowerCase();
  const phone = normalizeRegistrationText(body && body.phone, 40);
  const certLevel = normalizeRegistrationText(body && body.certificationLevel, 80);
  const additionalGuests = Math.max(0, Math.min(20, Math.trunc(Number((body && body.additionalGuests) || 0) || 0)));
  const partySize = 1 + additionalGuests;

  if (!firstName || !lastName || !email || !phone || !certLevel) {
    return jsonResponse({ ok: false, error: "Missing required registration fields." }, 400, { "Cache-Control": "no-store" });
  }
  if (!email.includes("@")) {
    return jsonResponse({ ok: false, error: "Email address is invalid." }, 400, { "Cache-Control": "no-store" });
  }
  if (customerIdentity && email !== customerIdentity.email) {
    return jsonResponse(
      { ok: false, error: "Use the verified email address connected to your DMZ Scuba account." },
      400,
      { "Cache-Control": "no-store" }
    );
  }

  const snapshotBefore = await getRegistrationSnapshot(env, sourceId, eventDate, config);
  if (snapshotBefore.remainingSpots < partySize) {
    return jsonResponse(
      { ok: false, error: "Not enough spots remaining for that party size.", remainingSpots: snapshotBefore.remainingSpots },
      409,
      { "Cache-Control": "no-store" }
    );
  }

  const now = new Date().toISOString();
  const registrationId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO event_registrations_v2
     (id, user_id, source_id, event_date, first_name, last_name, email, phone, cert_level, additional_guests, party_size, approval_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      registrationId,
      customerIdentity ? customerIdentity.userId : null,
      sourceId,
      eventDate,
      firstName,
      lastName,
      email,
      phone,
      certLevel,
      additionalGuests,
      partySize,
      "pending",
      now
    )
    .run();

  const snapshotAfter = await getRegistrationSnapshot(env, sourceId, eventDate, config);
  const fromEmail = String(env.RESEND_FROM_EMAIL || "").trim() || "no-reply@dmzscuba.com";
  const fromName = String(env.RESEND_FROM_NAME || "").trim() || "DMZ Scuba";
  const toEmail = String(env.RESEND_TO || "").trim() || "info@dmzscuba.com";
  const registrantName = `${firstName} ${lastName}`.trim();
  const scheduleLine = [String(config.title || "").trim(), String(eventDate || "").trim()]
    .filter(Boolean)
    .join(" | ");
  let notifyEmailSent = false;
  let attendeeEmailSent = false;
  let emailWarning = "";

  const notifyContent = buildEventRegistrationNotifyEmail({
    title: config.title || "DMZ Scuba Event",
    subject: config.registrationEmailSubject || "",
    scheduleLine,
    registrantName,
    email,
    phone,
    certLevel,
    additionalGuests,
    partySize,
    remainingSpots: snapshotAfter.remainingSpots,
  });
  const notifyPayload = {
    from: `${fromName} <${fromEmail}>`,
    to: [toEmail],
    subject: notifyContent.subject,
    html: notifyContent.html,
    text: notifyContent.text,
    reply_to: [email],
  };
  const notifyResult = await sendResendEmail(env, notifyPayload, "Event notify email");
  notifyEmailSent = Boolean(notifyResult.ok);

  const attendeeResult = await sendEventRegistrationAttendeeEmail(env, config, {
    scheduleLine,
    eventDate,
    registrantName: firstName || registrantName,
    firstName,
    lastName,
    fullName: registrantName,
    email,
    phone,
    certLevel,
    partySize,
    remainingSpots: snapshotAfter.remainingSpots,
  });
  attendeeEmailSent = Boolean(attendeeResult.ok);

  if (!notifyResult.ok || !attendeeResult.ok) {
    emailWarning = [notifyResult.error, attendeeResult.error].filter(Boolean).join(" | ");
  }

  return jsonResponse(
    {
      ok: true,
      registration: {
        id: registrationId,
        name: buildRegistrantLabel(firstName, lastName),
        additionalGuests,
        partySize,
        createdAt: now,
      },
      notifyEmailSent,
      attendeeEmailSent,
      emailWarning: emailWarning || undefined,
      ...buildPublicRegistrationSnapshot(snapshotAfter),
    },
    201,
    { "Cache-Control": "no-store" }
  );
}

async function handleDeleteEventRegistrationV2(request, env, sourceId, registrationId) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const eventDate = String(url.searchParams.get("date") || "").trim();
  const safeRegistrationId = String(registrationId || "").trim();
  if (!sourceId || !eventDate || !safeRegistrationId) {
    return jsonResponse({ ok: false, error: "Missing source id, registration id, or date." }, 400, { "Cache-Control": "no-store" });
  }

  const payload = await getEventsPayloadV2(env);
  const config = resolveRegistrationConfig(payload, sourceId, eventDate);
  if (!config) {
    return jsonResponse({ ok: false, error: "Event not found." }, 404, { "Cache-Control": "no-store" });
  }

  await ensureEventRegistrationsV2Table(env);
  const existing = await env.DB.prepare(
    `SELECT id
     FROM event_registrations_v2
     WHERE id = ? AND source_id = ? AND event_date = ?
     LIMIT 1`
  )
    .bind(safeRegistrationId, sourceId, eventDate)
    .first();

  if (!existing) {
    return jsonResponse({ ok: false, error: "Registration not found." }, 404, { "Cache-Control": "no-store" });
  }

  const snapshotBefore = await getRegistrationSnapshot(env, sourceId, eventDate, config);
  await env.DB.prepare(
    `DELETE FROM event_registrations_v2
     WHERE id = ? AND source_id = ? AND event_date = ?`
  )
    .bind(safeRegistrationId, sourceId, eventDate)
    .run();

  let nextConfig = config;
  let snapshot = await getRegistrationSnapshot(env, sourceId, eventDate, nextConfig);
  const wasFull = snapshotBefore.registrationCapacity > 0 && snapshotBefore.remainingSpots <= 0;
  const hasOpenSpots = snapshot.registrationCapacity > 0 && snapshot.remainingSpots > 0;
  if (nextConfig.registrationClosed && wasFull && hasOpenSpots && !isRegistrationPast(nextConfig)) {
    const reopened = await setRegistrationClosedForPayload(env, payload, sourceId, eventDate, false);
    if (reopened) {
      nextConfig = resolveRegistrationConfig(payload, sourceId, eventDate) || nextConfig;
      snapshot = await getRegistrationSnapshot(env, sourceId, eventDate, nextConfig);
    }
  }
  return jsonResponse({ ok: true, removedRegistrationId: safeRegistrationId, ...snapshot }, 200, { "Cache-Control": "no-store" });
}

async function handleUpdateEventRegistrationApprovalV2(request, env, sourceId, registrationId) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const eventDate = String(url.searchParams.get("date") || body.eventDate || "").trim();
  const safeRegistrationId = String(registrationId || "").trim();
  const nextStatus = String(body.status || "approved").trim() === "approved" ? "approved" : "pending";
  if (!sourceId || !eventDate || !safeRegistrationId) {
    return jsonResponse({ ok: false, error: "Missing source id, registration id, or date." }, 400, { "Cache-Control": "no-store" });
  }

  const payload = await getEventsPayloadV2(env);
  const config = resolveRegistrationConfig(payload, sourceId, eventDate);
  if (!config) {
    return jsonResponse({ ok: false, error: "Event not found." }, 404, { "Cache-Control": "no-store" });
  }

  await ensureEventRegistrationsV2Table(env);
  const result = await env.DB.prepare(
    `UPDATE event_registrations_v2
     SET approval_status = ?
     WHERE id = ? AND source_id = ? AND event_date = ?`
  )
    .bind(nextStatus, safeRegistrationId, sourceId, eventDate)
    .run();

  const changed = result && result.meta ? Number(result.meta.changes || 0) : 0;
  if (!changed) {
    return jsonResponse({ ok: false, error: "Registration not found." }, 404, { "Cache-Control": "no-store" });
  }

  const snapshot = await getRegistrationSnapshot(env, sourceId, eventDate, config);
  return jsonResponse({ ok: true, updatedRegistrationId: safeRegistrationId, approvalStatus: nextStatus, ...snapshot }, 200, { "Cache-Control": "no-store" });
}

async function handleResendEventRegistrationEmailV2(request, env, sourceId, registrationId) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const eventDate = String(url.searchParams.get("date") || "").trim();
  const safeRegistrationId = String(registrationId || "").trim();
  if (!sourceId || !eventDate || !safeRegistrationId) {
    return jsonResponse({ ok: false, error: "Missing source id, registration id, or date." }, 400, { "Cache-Control": "no-store" });
  }

  const payload = await getEventsPayloadV2(env);
  const config = resolveRegistrationConfig(payload, sourceId, eventDate);
  if (!config) {
    return jsonResponse({ ok: false, error: "Event not found." }, 404, { "Cache-Control": "no-store" });
  }

  await ensureEventRegistrationsV2Table(env);
  const row = await env.DB.prepare(
    `SELECT id, first_name, last_name, email, phone, cert_level, additional_guests, party_size
     FROM event_registrations_v2
     WHERE id = ? AND source_id = ? AND event_date = ?
     LIMIT 1`
  )
    .bind(safeRegistrationId, sourceId, eventDate)
    .first();

  if (!row) {
    return jsonResponse({ ok: false, error: "Registration not found." }, 404, { "Cache-Control": "no-store" });
  }

  const snapshot = await getRegistrationSnapshot(env, sourceId, eventDate, config);
  const firstName = String(row.first_name || "").trim();
  const lastName = String(row.last_name || "").trim();
  const fullName = buildRegistrantLabel(firstName, lastName);
  const result = await sendEventRegistrationAttendeeEmail(env, config, {
    eventDate,
    firstName,
    lastName,
    fullName,
    registrantName: firstName || fullName,
    email: String(row.email || "").trim(),
    phone: String(row.phone || "").trim(),
    certLevel: String(row.cert_level || "").trim(),
    partySize: Math.max(1, Number(row.party_size) || 1),
    remainingSpots: snapshot.remainingSpots,
  }, "Event attendee confirmation resend");

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error || "Could not resend registration email." }, 502, { "Cache-Control": "no-store" });
  }

  return jsonResponse({ ok: true, resentRegistrationId: safeRegistrationId, attendeeEmailSent: true }, 200, { "Cache-Control": "no-store" });
}

async function handleSendEventAlertEmailV2(request, env, sourceId) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const eventDate = String(url.searchParams.get("date") || "").trim();
  const safeSourceId = String(sourceId || "").trim();
  if (!safeSourceId || !eventDate) {
    return jsonResponse({ ok: false, error: "Missing source id or date." }, 400, { "Cache-Control": "no-store" });
  }

  const payload = await getEventsPayloadV2(env);
  const config = resolveRegistrationConfig(payload, safeSourceId, eventDate);
  if (!config) {
    return jsonResponse({ ok: false, error: "Event not found." }, 404, { "Cache-Control": "no-store" });
  }
  if (!config.registrationEnabled || config.registrationCapacity <= 0) {
    return jsonResponse({ ok: false, error: "Registration is not open for this event." }, 400, { "Cache-Control": "no-store" });
  }
  if (config.registrationClosed || isRegistrationPast(config)) {
    return jsonResponse({ ok: false, error: "Registration is closed for this event." }, 409, { "Cache-Control": "no-store" });
  }

  const snapshot = await getRegistrationSnapshot(env, safeSourceId, eventDate, config);
  if (snapshot.registrationClosed || snapshot.remainingSpots <= 0) {
    return jsonResponse({ ok: false, error: "Registration is full or closed for this event." }, 409, { "Cache-Control": "no-store" });
  }

  const subscribers = await listEventAlertSubscribers(env);
  if (!subscribers.length) {
    return jsonResponse({ ok: false, error: "No event alert subscribers found." }, 409, { "Cache-Control": "no-store" });
  }

  const fromEmail = String(env.RESEND_FROM_EMAIL || "").trim() || "no-reply@dmzscuba.com";
  const fromName = String(env.RESEND_FROM_NAME || "").trim() || "DMZ Scuba";
  const contactEmail = String(env.RESEND_TO || "").trim() || "info@dmzscuba.com";
  const templateId = String(env.RESEND_TEMPLATE_EVENT_ALERT || "").trim();
  const timeText = [config.time, config.endTime].filter(Boolean).join(" - ");
  const registrationLink = `https://www.dmzscuba.com/pages/events/?event=${encodeURIComponent(safeSourceId)}&date=${encodeURIComponent(eventDate)}`;
  const failures = [];
  let sentCount = 0;

  for (const subscriber of subscribers) {
    const email = String(subscriber.email || "").trim().toLowerCase();
    if (!email) continue;
    const firstName = String(subscriber.firstName || subscriber.name || "Diver").trim().split(/\s+/)[0] || "Diver";
    const details = {
      firstName,
      name: subscriber.name || firstName,
      title: config.title || "DMZ Scuba Event",
      eventDate,
      time: timeText,
      location: config.location || "",
      type: config.type || "",
      summary: config.description || "",
      registrationLink,
      remainingSpots: snapshot.remainingSpots,
      contactEmail,
    };
    const content = buildEventAlertEmail(details);
    const emailPayload = {
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      reply_to: [contactEmail],
      ...(templateId
        ? {
            subject: content.subject,
            template: {
              id: templateId,
              variables: buildEventAlertTemplateVariables(details),
            },
          }
        : {
            subject: content.subject,
            html: content.html,
            text: content.text,
          }),
    };
    const result = await sendResendEmail(env, emailPayload, "Event alert email");
    if (result.ok) {
      sentCount += 1;
    } else {
      failures.push({ email, error: result.error || "Send failed." });
    }
  }

  return jsonResponse({
    ok: failures.length === 0,
    event: {
      sourceId: safeSourceId,
      eventDate,
      title: config.title || "DMZ Scuba Event",
      remainingSpots: snapshot.remainingSpots,
    },
    subscriberCount: subscribers.length,
    sentCount,
    failedCount: failures.length,
    failures: failures.slice(0, 10),
  }, failures.length ? 207 : 200, { "Cache-Control": "no-store" });
}

async function handleGetHomeTicker(env) {
  const payload = await getHomeTickerPayload(env);
  if (!payload) return jsonResponse({ ok: false, error: "Not found." }, 404, { "Cache-Control": "no-store" });
  return jsonResponse(payload, 200, {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
  });
}

async function handlePutHomeTicker(request, env) {
  const authed = await requireAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => ({}));
  const incoming = body && typeof body.payload === "object" ? body.payload : body;
  const payload = normalizeHomeTickerPayload(incoming);

  await ensureSiteSettingsTable(env);
  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT created_at FROM site_settings WHERE setting_key = ?")
    .bind("home_ticker")
    .first();
  const createdAt = (existing && existing.created_at) || now;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO site_settings (setting_key, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind("home_ticker", JSON.stringify(payload), createdAt, now)
    .run();
  return jsonResponse({ ok: true, payload, updatedAt: now }, 200, { "Cache-Control": "no-store" });
}

async function handleGetDestinationsV2(env) {
  const items = await listDestinationsV2(env);
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

async function handleGetDestinationByIdV2(env, id) {
  const item = await getDestinationByIdV2(env, id);
  if (!item) return jsonResponse({ ok: false, error: "Not found." }, 404);
  return jsonResponse({ item }, 200, { "Cache-Control": "no-store" });
}

async function handlePutDestinationByIdV2(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed && !isTrustedDestinationDevWrite(request)) {
    return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  }
  const normalizedId = String(id || "").trim().toLowerCase();
  if (!normalizedId) return jsonResponse({ ok: false, error: "Missing id." }, 400);

  const body = await request.json().catch(() => ({}));
  const incoming = body && typeof body.item === "object" ? body.item : null;
  const item = normalizeDestinationV2(incoming, normalizedId);
  if (!item) return jsonResponse({ ok: false, error: "Invalid item payload." }, 400);

  await ensureDestinationsV2Table(env);
  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT created_at FROM destinations_v2 WHERE id = ?").bind(normalizedId).first();
  const createdAt = (existing && existing.created_at) || now;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO destinations_v2 (id, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(normalizedId, JSON.stringify(item), createdAt, now)
    .run();
  return jsonResponse({ ok: true, item, updatedAt: now }, 200, { "Cache-Control": "no-store" });
}

async function handleDeleteDestinationByIdV2(request, env, id) {
  const authed = await requireAuth(request, env);
  if (!authed && !isTrustedDestinationDevWrite(request)) {
    return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  }
  const normalizedId = String(id || "").trim().toLowerCase();
  if (!normalizedId) return jsonResponse({ ok: false, error: "Missing id." }, 400);
  await ensureDestinationsV2Table(env);
  const existing = await env.DB.prepare("SELECT id FROM destinations_v2 WHERE id = ?").bind(normalizedId).first();
  if (!existing) return jsonResponse({ ok: false, error: "Not found." }, 404);
  await env.DB.prepare("DELETE FROM destinations_v2 WHERE id = ?").bind(normalizedId).run();
  return jsonResponse({ ok: true, id: normalizedId }, 200, { "Cache-Control": "no-store" });
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

const PERSISTED_FUNNEL_EVENT_TYPES = new Set([
  "training_course_view",
  "training_cta_click",
  "training_sticky_cta_click",
  "training_sticky_cta_dismiss",
  "training_internal_progression_click",
  "training_inquiry_form_start",
  "training_inquiry_submit_attempt",
  "training_inquiry_completed",
  "training_inquiry_form_abandoned",
]);

const TELEMETRY_MAX_BODY_BYTES = 12_000;
const TELEMETRY_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasPotentialPii(value) {
  const text = String(value || "");
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) || /\+?\d[\d\s().-]{7,}\d/.test(text);
}

function sanitizeAnalyticsValue(value, maxLength = 120) {
  const text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  if (!text || hasPotentialPii(text)) return "";
  return text.replace(/[^a-z0-9._~:/ -]/gi, "").trim();
}

function sanitizeAnalyticsPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const sentinel = raw.toLowerCase();
  if (["direct", "unspecified", "direct-or-referral"].includes(sentinel)) return sentinel;
  if (!raw.startsWith("/") && !/^https?:\/\//i.test(raw)) return "";
  try {
    const url = new URL(raw, "https://www.dmzscuba.com");
    const hostname = url.hostname.toLowerCase();
    const isDmzHost = hostname === "dmzscuba.com" || hostname.endsWith(".dmzscuba.com");
    const isDmzPagesHost =
      hostname === "dmzscuba-com.pages.dev" ||
      hostname.endsWith(".dmzscuba-com.pages.dev") ||
      hostname === "dmzscuba-live.pages.dev" ||
      hostname.endsWith(".dmzscuba-live.pages.dev");
    if (/^https?:\/\//i.test(raw) && !isDmzHost && !isDmzPagesHost) return "external";
    return String(url.pathname || "/").slice(0, 300);
  } catch (error) {
    return "";
  }
}

function getTelemetryPageContext(pageUrl) {
  try {
    const url = new URL(String(pageUrl || ""));
    const hostname = url.hostname.toLowerCase();
    let siteEnvironment = "unknown";
    if (hostname === "dmzscuba.com" || hostname === "www.dmzscuba.com" || hostname === "dmzscuba-live.pages.dev" || hostname.endsWith(".dmzscuba-live.pages.dev")) {
      siteEnvironment = "live";
    } else if (hostname === "dmzscuba-com.pages.dev" || hostname.endsWith(".dmzscuba-com.pages.dev")) {
      siteEnvironment = "dev";
    } else if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) {
      siteEnvironment = "local";
    } else if (hostname.endsWith(".trycloudflare.com") || hostname.endsWith(".pages.dev")) {
      siteEnvironment = "preview";
    }
    return {
      pagePath: String(url.pathname || "/").slice(0, 300),
      siteEnvironment,
    };
  } catch (error) {
    return { pagePath: "/", siteEnvironment: "unknown" };
  }
}

function isTrustedTelemetryOrigin(request, env) {
  const origin = String(request.headers.get("Origin") || "").trim();
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) return true;
    if (hostname === "dmzscuba.com" || hostname.endsWith(".dmzscuba.com")) return true;
    if (hostname.endsWith(".trycloudflare.com")) return true;
    if (
      hostname === "dmzscuba-com.pages.dev" ||
      hostname.endsWith(".dmzscuba-com.pages.dev") ||
      hostname === "dmzscuba-live.pages.dev" ||
      hostname.endsWith(".dmzscuba-live.pages.dev")
    ) {
      return true;
    }
    const allowList = String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return allowList.includes(origin);
  } catch (error) {
    return false;
  }
}

function sanitizeOperationalLogDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const sanitized = {};
  Object.entries(details).slice(0, 20).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 60);
    if (!key || /(email|phone|name|message|token|authorization|url)/i.test(key)) return;
    if (typeof rawValue === "boolean" || typeof rawValue === "number") {
      sanitized[key] = rawValue;
      return;
    }
    if (typeof rawValue === "string") {
      const value = sanitizeAnalyticsValue(rawValue, 200);
      if (value) sanitized[key] = value;
    }
  });
  return sanitized;
}

function normalizeOccurredAt(value, receivedAt) {
  const receivedMs = Date.parse(receivedAt);
  const occurredMs = Date.parse(String(value || ""));
  const earliestAllowed = receivedMs - 7 * 24 * 60 * 60 * 1000;
  const latestAllowed = receivedMs + 5 * 60 * 1000;
  if (!Number.isFinite(occurredMs) || occurredMs < earliestAllowed || occurredMs > latestAllowed) {
    return receivedAt;
  }
  return new Date(occurredMs).toISOString();
}

function buildFunnelEventRecord(body, receivedAt = new Date().toISOString()) {
  const eventType = String((body && body.eventType) || "").trim().slice(0, 80);
  if (!PERSISTED_FUNNEL_EVENT_TYPES.has(eventType)) return null;
  const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {};
  const pageContext = getTelemetryPageContext(body.pageUrl);
  const eventId = TELEMETRY_UUID_PATTERN.test(String(body.eventId || "")) ? String(body.eventId).toLowerCase() : crypto.randomUUID();
  const sessionId = TELEMETRY_UUID_PATTERN.test(String(body.sessionId || "")) ? String(body.sessionId).toLowerCase() : crypto.randomUUID();
  const record = {
    id: eventId,
    eventType,
    sessionId,
    siteEnvironment: pageContext.siteEnvironment,
    pagePath: pageContext.pagePath,
    course: sanitizeAnalyticsValue(details.course, 80) || null,
    device: ["mobile", "desktop"].includes(String(details.device || "").toLowerCase()) ? String(details.device).toLowerCase() : null,
    source: null,
    medium: null,
    campaign: null,
    content: null,
    ctaType: ["primary", "secondary"].includes(String(details.ctaType || "").toLowerCase()) ? String(details.ctaType).toLowerCase() : null,
    label: sanitizeAnalyticsValue(details.label, 120) || null,
    placement: sanitizeAnalyticsValue(details.placement, 160) || null,
    destinationPath: sanitizeAnalyticsPath(details.destination) || null,
    sourcePage: sanitizeAnalyticsPath(details.sourcePage) || null,
    experience: sanitizeAnalyticsValue(details.experience, 80) || null,
    groupType: sanitizeAnalyticsValue(details.group, 80) || null,
    occurredAt: normalizeOccurredAt(body.sentAt, receivedAt),
    receivedAt,
  };
  if (eventType === "training_course_view") {
    record.source = sanitizeAnalyticsValue(details.source, 100) || null;
    record.medium = sanitizeAnalyticsValue(details.medium, 100) || null;
    record.campaign = sanitizeAnalyticsValue(details.campaign, 120) || null;
    record.content = sanitizeAnalyticsValue(details.content, 120) || null;
  }
  return record;
}

async function persistFunnelEvent(env, record) {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO funnel_events (
      id, event_type, session_id, site_environment, page_path, course, device,
      source, medium, campaign, content, cta_type, label, placement, destination_path,
      source_page, experience, group_type, occurred_at, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      record.id,
      record.eventType,
      record.sessionId,
      record.siteEnvironment,
      record.pagePath,
      record.course,
      record.device,
      record.source,
      record.medium,
      record.campaign,
      record.content,
      record.ctaType,
      record.label,
      record.placement,
      record.destinationPath,
      record.sourcePage,
      record.experience,
      record.groupType,
      record.occurredAt,
      record.receivedAt
    )
    .run();
}

async function deleteExpiredFunnelEvents(env) {
  const configuredDays = Number.parseInt(String(env.FUNNEL_RETENTION_DAYS || "400"), 10);
  const retentionDays = Number.isFinite(configuredDays) ? Math.min(730, Math.max(30, configuredDays)) : 400;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare("DELETE FROM funnel_events WHERE received_at < ?").bind(cutoff).run();
  console.log(JSON.stringify({ kind: "funnel_retention", cutoff, changes: result.meta && result.meta.changes ? result.meta.changes : 0 }));
}

async function handleClientTelemetry(request, env, context) {
  if (!isTrustedTelemetryOrigin(request, env)) {
    return jsonResponse({ ok: false, error: "Telemetry origin is not allowed." }, 403);
  }
  const declaredLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > TELEMETRY_MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Telemetry payload is too large." }, 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > TELEMETRY_MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Telemetry payload is too large." }, 413);
  }
  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch (error) {
    return jsonResponse({ ok: false, error: "Invalid telemetry JSON." }, 400);
  }
  const eventType = String(body.eventType || "").trim().slice(0, 80);
  if (!eventType) {
    return jsonResponse({ ok: false, error: "Missing eventType." }, 400);
  }
  const receivedAt = new Date().toISOString();
  const pageContext = getTelemetryPageContext(body.pageUrl);
  console.log(JSON.stringify({
    kind: "client_telemetry",
    eventType,
    pagePath: pageContext.pagePath,
    siteEnvironment: pageContext.siteEnvironment,
    details: sanitizeOperationalLogDetails(body.details),
    receivedAt,
  }));

  const record = buildFunnelEventRecord(body, receivedAt);
  let persisted = false;
  if (record && env.DB) {
    const write = persistFunnelEvent(env, record).catch((error) => {
      console.error("Funnel event persistence failed", error);
    });
    if (context && typeof context.waitUntil === "function") {
      context.waitUntil(write);
      persisted = true;
    } else {
      await write;
      persisted = true;
    }
  }
  return jsonResponse({ ok: true, persisted });
}

export {
  buildFunnelEventRecord,
  buildPublicRegistrationSnapshot,
  deleteExpiredFunnelEvents,
  isTrustedTelemetryOrigin,
  sanitizeAnalyticsPath,
  validateSupabaseClaims,
  verifySupabaseAccessToken,
};

export default {
  async fetch(request, env, context) {
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
    } else if (pathname === "/api/event-alert-subscribe" && request.method === "POST") {
      response = await handleEventAlertSubscribe(request, env);
    } else if (pathname === "/api/client-telemetry" && request.method === "POST") {
      response = await handleClientTelemetry(request, env, context);
    } else if (pathname === "/api/account/auth/status" && request.method === "GET") {
      response = await handleCustomerAuthStatus(env);
    } else if (pathname === "/api/account/auth/signup" && request.method === "POST") {
      response = await handleCustomerSignup(request, env);
    } else if (pathname === "/api/account/auth/verify" && request.method === "POST") {
      response = await handleCustomerVerify(request, env);
    } else if (pathname === "/api/account/auth/login" && request.method === "POST") {
      response = await handleCustomerLogin(request, env);
    } else if (pathname === "/api/account/auth/refresh" && request.method === "POST") {
      response = await handleCustomerRefresh(request, env);
    } else if (pathname === "/api/account/auth/logout" && request.method === "POST") {
      response = await handleCustomerLogout(request, env);
    } else if (pathname === "/api/account/auth/recover" && request.method === "POST") {
      response = await handleCustomerRecovery(request, env);
    } else if (pathname === "/api/account/auth/password" && request.method === "PUT") {
      response = await handleCustomerPasswordUpdate(request, env);
    } else if (pathname === "/api/account/auth/email" && request.method === "PUT") {
      response = await handleCustomerEmailUpdate(request, env);
    } else if (pathname === "/api/account/auth/email/verify" && request.method === "POST") {
      response = await handleCustomerEmailVerification(request, env);
    } else if (pathname === "/api/account" && request.method === "GET") {
      response = await handleGetCustomerAccount(request, env);
    } else if (pathname === "/api/account" && request.method === "PUT") {
      response = await handleUpdateCustomerProfile(request, env);
    } else if (pathname === "/api/account/link-existing" && request.method === "POST") {
      response = await handleLinkCustomerRecords(request, env);
    } else if (pathname === "/api/account/certifications" && request.method === "POST") {
      response = await handleCreateCustomerCertification(request, env);
    } else if (pathname.startsWith("/api/account/certifications/") && request.method === "PUT") {
      const certificationId = decodeURIComponent(pathname.split("/").pop() || "");
      response = await handleUpdateCustomerCertification(request, env, certificationId);
    } else if (pathname.startsWith("/api/account/certifications/") && request.method === "DELETE") {
      const certificationId = decodeURIComponent(pathname.split("/").pop() || "");
      response = await handleDeleteCustomerCertification(request, env, certificationId);
    } else if (pathname === "/api/admin/login" && request.method === "POST") {
      response = await handleLogin(request, env);
    } else if (pathname === "/api/admin/event-alert-subscribers" && request.method === "GET") {
      response = await handleListEventAlertSubscribers(request, env);
    } else if (pathname === "/api/admin/management" && request.method === "GET") {
      response = await handleListManagementRecords(request, env);
    } else if (pathname === "/api/admin/management" && request.method === "POST") {
      response = await handleCreateManagementRecord(request, env);
    } else if (pathname.startsWith("/api/admin/management/") && request.method === "PUT") {
      const id = decodeURIComponent(pathname.split("/").pop() || "");
      response = await handleUpdateManagementRecord(request, env, id);
    } else if (pathname.startsWith("/api/admin/management/") && request.method === "DELETE") {
      const id = decodeURIComponent(pathname.split("/").pop() || "");
      response = await handleDeleteManagementRecord(request, env, id);
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
    } else if (pathname === "/api/v2/events" && request.method === "GET") {
      response = await handleGetEventsV2(env);
    } else if (pathname.startsWith("/api/v2/events/") && pathname.endsWith("/registrations") && request.method === "GET") {
      const sourceId = decodeURIComponent(pathname.split("/")[4] || "").trim().toLowerCase();
      response = await handleGetEventRegistrationsV2(request, env, sourceId);
    } else if (pathname.startsWith("/api/v2/events/") && pathname.endsWith("/registrations") && request.method === "POST") {
      const sourceId = decodeURIComponent(pathname.split("/")[4] || "").trim().toLowerCase();
      response = await handleCreateEventRegistrationV2(request, env, sourceId);
    } else if (pathname.startsWith("/api/admin/v2/events/") && pathname.endsWith("/registrations") && request.method === "GET") {
      const sourceId = decodeURIComponent(pathname.split("/")[5] || "").trim().toLowerCase();
      response = await handleGetAdminEventRegistrationsV2(request, env, sourceId);
    } else if (pathname.startsWith("/api/admin/v2/events/") && pathname.endsWith("/alerts") && request.method === "POST") {
      const parts = pathname.split("/");
      const sourceId = decodeURIComponent(parts[5] || "").trim().toLowerCase();
      response = await handleSendEventAlertEmailV2(request, env, sourceId);
    } else if (pathname.startsWith("/api/admin/v2/events/") && pathname.endsWith("/approval") && request.method === "PUT") {
      const parts = pathname.split("/");
      const sourceId = decodeURIComponent(parts[5] || "").trim().toLowerCase();
      const registrationId = decodeURIComponent(parts[7] || "").trim();
      response = await handleUpdateEventRegistrationApprovalV2(request, env, sourceId, registrationId);
    } else if (pathname.startsWith("/api/admin/v2/events/") && pathname.endsWith("/email") && request.method === "POST") {
      const parts = pathname.split("/");
      const sourceId = decodeURIComponent(parts[5] || "").trim().toLowerCase();
      const registrationId = decodeURIComponent(parts[7] || "").trim();
      response = await handleResendEventRegistrationEmailV2(request, env, sourceId, registrationId);
    } else if (pathname.startsWith("/api/admin/v2/events/") && pathname.includes("/registrations/") && request.method === "DELETE") {
      const parts = pathname.split("/");
      const sourceId = decodeURIComponent(parts[5] || "").trim().toLowerCase();
      const registrationId = decodeURIComponent(parts[7] || "").trim();
      response = await handleDeleteEventRegistrationV2(request, env, sourceId, registrationId);
    } else if (pathname === "/api/admin/v2/events" && request.method === "PUT") {
      response = await handlePutEventsV2(request, env);
    } else if (pathname === "/api/admin/v2/events" && request.method === "DELETE") {
      response = await handleDeleteEventsV2(request, env);
    } else if (pathname === "/api/v2/home-ticker" && request.method === "GET") {
      response = await handleGetHomeTicker(env);
    } else if (pathname === "/api/admin/v2/home-ticker" && request.method === "PUT") {
      response = await handlePutHomeTicker(request, env);
    } else if (pathname === "/api/v2/destinations" && request.method === "GET") {
      response = await handleGetDestinationsV2(env);
    } else if (pathname.startsWith("/api/v2/destinations/") && request.method === "GET") {
      const id = pathname.split("/").pop();
      response = await handleGetDestinationByIdV2(env, id);
    } else if (pathname.startsWith("/api/admin/v2/destinations/") && request.method === "PUT") {
      const id = pathname.split("/").pop();
      response = await handlePutDestinationByIdV2(request, env, id);
    } else if (pathname.startsWith("/api/admin/v2/destinations/") && request.method === "DELETE") {
      const id = pathname.split("/").pop();
      response = await handleDeleteDestinationByIdV2(request, env, id);
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
  async scheduled(controller, env, context) {
    context.waitUntil(
      deleteExpiredFunnelEvents(env).catch((error) => {
        console.error("Funnel retention cleanup failed", error);
      })
    );
  },
};
