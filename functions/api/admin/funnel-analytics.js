const ALLOWED_RANGES = new Set([7, 30, 90, 400]);
const ALLOWED_ENVIRONMENTS = new Set(["live", "dev", "all"]);
const MANAGEMENT_ACCESS_URL = "https://dmz-media-api.zacharylisowski55.workers.dev/api/admin/access";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseAnalyticsFilters(url) {
  const requestedDays = Number.parseInt(url.searchParams.get("days") || "30", 10);
  const requestedEnvironment = String(url.searchParams.get("environment") || "live").toLowerCase();
  return {
    days: ALLOWED_RANGES.has(requestedDays) ? requestedDays : 30,
    environment: ALLOWED_ENVIRONMENTS.has(requestedEnvironment) ? requestedEnvironment : "live",
  };
}

function startOfUtcDay(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((toNumber(numerator) / toNumber(denominator)) * 1000) / 10;
}

function normalizeSummary(row = {}) {
  const summary = {
    totalEvents: toNumber(row.total_events),
    sessions: toNumber(row.sessions),
    pageViews: toNumber(row.page_views),
    ctaClicks: toNumber(row.cta_clicks),
    progressionClicks: toNumber(row.progression_clicks),
    formStarts: toNumber(row.form_starts),
    submitAttempts: toNumber(row.submit_attempts),
    completions: toNumber(row.completions),
    abandonments: toNumber(row.abandonments),
    firstEventAt: row.first_event_at || null,
    lastEventAt: row.last_event_at || null,
  };
  summary.rates = {
    ctaClick: percent(summary.ctaClicks, summary.pageViews),
    formStart: percent(summary.formStarts, summary.pageViews),
    completion: percent(summary.completions, summary.pageViews),
    formCompletion: percent(summary.completions, summary.formStarts),
  };
  return summary;
}

function analyticsWhere(environment, includeUpperBound = false) {
  const clauses = ["received_at >= ?"];
  if (includeUpperBound) clauses.push("received_at < ?");
  if (environment !== "all") clauses.push("site_environment = ?");
  return clauses.join(" AND ");
}

function analyticsBindings(from, environment, to = "") {
  const bindings = [from];
  if (to) bindings.push(to);
  if (environment !== "all") bindings.push(environment);
  return bindings;
}

const SUMMARY_SELECT = `
  COUNT(*) AS total_events,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(DISTINCT CASE WHEN event_type = 'training_course_view' THEN session_id END) AS page_views,
  COUNT(DISTINCT CASE WHEN event_type IN ('training_cta_click', 'training_sticky_cta_click') THEN session_id END) AS cta_clicks,
  COUNT(DISTINCT CASE WHEN event_type = 'training_internal_progression_click' THEN session_id END) AS progression_clicks,
  COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_form_start' THEN session_id END) AS form_starts,
  COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_submit_attempt' THEN session_id END) AS submit_attempts,
  COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_completed' THEN session_id END) AS completions,
  COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_form_abandoned' THEN session_id END) AS abandonments,
  MIN(received_at) AS first_event_at,
  MAX(received_at) AS last_event_at`;

async function requireAnalyticsAuth(request, env, fetchImpl = fetch) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;

  // Preserve the original console login while account-based management access
  // is adopted across the website and mobile app.
  if (!token.includes(".") && env.DB) {
    const row = await env.DB.prepare(
      "SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?"
    )
      .bind(token, new Date().toISOString())
      .first();
    if (row) return true;
  }

  // Supabase account sessions are validated by the Worker, which is the
  // authoritative source for Employee and Administrator roles.
  try {
    const response = await fetchImpl(MANAGEMENT_ACCESS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) return false;
    const result = await response.json().catch(() => null);
    return Boolean(result && result.ok && Array.isArray(result.roles)
      && result.roles.some((role) => role === "staff" || role === "admin"));
  } catch (error) {
    console.error("Funnel Analytics access validation failed", error);
    return false;
  }
}

function statement(env, sql, bindings) {
  return env.DB.prepare(sql).bind(...bindings);
}

function resultRows(result) {
  return result && Array.isArray(result.results) ? result.results : [];
}

function buildAnalyticsPayload(results, filters, range) {
  const current = normalizeSummary(resultRows(results[0])[0]);
  const previous = normalizeSummary(resultRows(results[1])[0]);
  const daily = resultRows(results[2]).map((row) => ({
    date: row.day,
    pageViews: toNumber(row.page_views),
    ctaClicks: toNumber(row.cta_clicks),
    formStarts: toNumber(row.form_starts),
    completions: toNumber(row.completions),
  }));
  const courses = resultRows(results[3]).map((row) => {
    const item = {
      course: row.course_label || "unspecified",
      pageViews: toNumber(row.page_views),
      ctaClicks: toNumber(row.cta_clicks),
      formStarts: toNumber(row.form_starts),
      completions: toNumber(row.completions),
    };
    item.completionRate = percent(item.completions, item.pageViews);
    return item;
  });
  const sources = resultRows(results[4]).map((row) => ({
    source: row.source_label || "direct-or-referral",
    sessions: toNumber(row.sessions),
  }));
  const devices = resultRows(results[5]).map((row) => ({
    device: row.device_label || "unspecified",
    sessions: toNumber(row.sessions),
  }));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    filters: {
      days: filters.days,
      environment: filters.environment,
      from: range.currentFrom,
      to: range.currentTo,
    },
    summary: current,
    previousSummary: previous,
    daily,
    courses,
    sources,
    devices,
  };
}

async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "Funnel Analytics is not connected to D1." }, 503);
  }
  if (!(await requireAnalyticsAuth(request, env))) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const filters = parseAnalyticsFilters(new URL(request.url));
  const currentStart = startOfUtcDay();
  currentStart.setUTCDate(currentStart.getUTCDate() - (filters.days - 1));
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - filters.days);
  const currentFrom = currentStart.toISOString();
  const previousFrom = previousStart.toISOString();
  const currentTo = new Date().toISOString();
  const currentWhere = analyticsWhere(filters.environment);
  const previousWhere = analyticsWhere(filters.environment, true);
  const currentBindings = analyticsBindings(currentFrom, filters.environment);
  const previousBindings = analyticsBindings(previousFrom, filters.environment, currentFrom);

  const queries = [
    statement(env, `SELECT ${SUMMARY_SELECT} FROM funnel_events WHERE ${currentWhere}`, currentBindings),
    statement(env, `SELECT ${SUMMARY_SELECT} FROM funnel_events WHERE ${previousWhere}`, previousBindings),
    statement(env, `
      SELECT substr(received_at, 1, 10) AS day,
        COUNT(DISTINCT CASE WHEN event_type = 'training_course_view' THEN session_id END) AS page_views,
        COUNT(DISTINCT CASE WHEN event_type IN ('training_cta_click', 'training_sticky_cta_click') THEN session_id END) AS cta_clicks,
        COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_form_start' THEN session_id END) AS form_starts,
        COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_completed' THEN session_id END) AS completions
      FROM funnel_events WHERE ${currentWhere}
      GROUP BY day ORDER BY day`, currentBindings),
    statement(env, `
      SELECT COALESCE(NULLIF(course, ''), 'unspecified') AS course_label,
        COUNT(DISTINCT CASE WHEN event_type = 'training_course_view' THEN session_id END) AS page_views,
        COUNT(DISTINCT CASE WHEN event_type IN ('training_cta_click', 'training_sticky_cta_click') THEN session_id END) AS cta_clicks,
        COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_form_start' THEN session_id END) AS form_starts,
        COUNT(DISTINCT CASE WHEN event_type = 'training_inquiry_completed' THEN session_id END) AS completions
      FROM funnel_events WHERE ${currentWhere}
      GROUP BY course_label
      ORDER BY page_views DESC, completions DESC, course_label
      LIMIT 20`, currentBindings),
    statement(env, `
      SELECT COALESCE(NULLIF(source, ''), 'direct-or-referral') AS source_label,
        COUNT(DISTINCT session_id) AS sessions
      FROM funnel_events
      WHERE ${currentWhere} AND event_type = 'training_course_view'
      GROUP BY source_label ORDER BY sessions DESC, source_label LIMIT 12`, currentBindings),
    statement(env, `
      SELECT COALESCE(NULLIF(device, ''), 'unspecified') AS device_label,
        COUNT(DISTINCT session_id) AS sessions
      FROM funnel_events
      WHERE ${currentWhere} AND event_type = 'training_course_view'
      GROUP BY device_label ORDER BY sessions DESC, device_label`, currentBindings),
  ];

  try {
    const results = await env.DB.batch(queries);
    return jsonResponse(buildAnalyticsPayload(results, filters, { currentFrom, currentTo }));
  } catch (error) {
    console.error("Funnel Analytics query failed", error);
    return jsonResponse({ ok: false, error: "Could not load Funnel Analytics." }, 500);
  }
}

function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: "GET, OPTIONS" } });
}

export {
  buildAnalyticsPayload,
  normalizeSummary,
  onRequestGet,
  onRequestOptions,
  parseAnalyticsFilters,
  requireAnalyticsAuth,
};
