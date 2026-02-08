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
  };
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
    const mermetTemplateId = String(env.RESEND_TEMPLATE_MERMET || "").trim();
    const haighTemplateId = String(env.RESEND_TEMPLATE_HAIGH || "").trim();
    const keyLargoTemplateId = String(env.RESEND_TEMPLATE_KEY_LARGO || "").trim();
    const cozumelTemplateId = String(env.RESEND_TEMPLATE_COZUMEL || "").trim();
    const defaultTemplateId = String(env.RESEND_TEMPLATE_INTEREST_DEFAULT || "").trim();

    let autoReplyPayload = null;
    if (mermet && mermetTemplateId) {
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
    return jsonResponse({ ok: true, autoReplySent: true, notifySent: true });
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
};
