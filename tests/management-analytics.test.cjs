const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const functionPath = path.join(root, "functions", "api", "admin", "funnel-analytics.js");
const functionSource = fs.readFileSync(functionPath, "utf8");
const functionModulePromise = import(`data:text/javascript;base64,${Buffer.from(functionSource).toString("base64")}`);

function queryResult(results) {
  return { results, success: true, meta: {} };
}

const SUMMARY_ROW = {
  total_events: 42,
  sessions: 20,
  page_views: 20,
  cta_clicks: 10,
  progression_clicks: 6,
  form_starts: 5,
  submit_attempts: 4,
  completions: 3,
  abandonments: 2,
  first_event_at: "2026-08-20T12:00:00.000Z",
  last_event_at: "2026-08-23T12:00:00.000Z",
};

const BATCH_RESULTS = [
  queryResult([SUMMARY_ROW]),
  queryResult([{ ...SUMMARY_ROW, page_views: 10, cta_clicks: 4, form_starts: 2, completions: 1 }]),
  queryResult([{ day: "2026-08-23", page_views: 8, cta_clicks: 4, form_starts: 2, completions: 1 }]),
  queryResult([{ course_label: "open-water", page_views: 12, cta_clicks: 7, form_starts: 4, completions: 3 }]),
  queryResult([{ source_label: "google", sessions: 9 }]),
  queryResult([{ device_label: "mobile", sessions: 11 }]),
];

test("analytics filters allow only supported ranges and environments", async () => {
  const { parseAnalyticsFilters } = await functionModulePromise;
  assert.deepEqual(parseAnalyticsFilters(new URL("https://example.test/?days=7&environment=dev")), {
    days: 7,
    environment: "dev",
  });
  assert.deepEqual(parseAnalyticsFilters(new URL("https://example.test/?days=999&environment=private")), {
    days: 30,
    environment: "live",
  });
});

test("summary normalization calculates the funnel conversion rates", async () => {
  const { normalizeSummary } = await functionModulePromise;
  const summary = normalizeSummary(SUMMARY_ROW);
  assert.equal(summary.pageViews, 20);
  assert.equal(summary.completions, 3);
  assert.deepEqual(summary.rates, {
    ctaClick: 50,
    formStart: 25,
    completion: 15,
    formCompletion: 60,
  });
});

test("analytics endpoint requires a valid management session", async () => {
  const { onRequestGet } = await functionModulePromise;
  let batchCalled = false;
  const env = {
    DB: {
      prepare() {
        return {
          bind() { return this; },
          async first() { return null; },
        };
      },
      async batch() { batchCalled = true; return []; },
    },
  };
  const response = await onRequestGet({
    request: new Request("https://example.test/api/admin/funnel-analytics"),
    env,
  });
  assert.equal(response.status, 401);
  assert.equal(batchCalled, false);
});

test("analytics accepts an account session with a management role", async () => {
  const { requireAnalyticsAuth } = await functionModulePromise;
  let requestedUrl = "";
  let requestedAuthorization = "";
  const allowed = await requireAnalyticsAuth(
    new Request("https://example.test/api/admin/funnel-analytics", {
      headers: { Authorization: "Bearer header.payload.signature" },
    }),
    {
      DB: {
        prepare() {
          throw new Error("Supabase sessions must not use the legacy token table.");
        },
      },
    },
    async (url, options) => {
      requestedUrl = url;
      requestedAuthorization = options.headers.Authorization;
      return new Response(JSON.stringify({ ok: true, roles: ["customer", "admin"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  assert.equal(allowed, true);
  assert.equal(requestedUrl, "https://dmz-media-api.zacharylisowski55.workers.dev/api/admin/access");
  assert.equal(requestedAuthorization, "Bearer header.payload.signature");
});

test("analytics rejects an account session without a management role", async () => {
  const { requireAnalyticsAuth } = await functionModulePromise;
  const allowed = await requireAnalyticsAuth(
    new Request("https://example.test/api/admin/funnel-analytics", {
      headers: { Authorization: "Bearer header.payload.signature" },
    }),
    { DB: {} },
    async () => new Response(JSON.stringify({ ok: true, roles: ["customer"] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );

  assert.equal(allowed, false);
});

test("analytics endpoint returns aggregate-only D1 reporting", async () => {
  const { onRequestGet } = await functionModulePromise;
  const prepared = [];
  const env = {
    DB: {
      prepare(sql) {
        const item = {
          sql,
          bindings: [],
          bind(...bindings) { this.bindings = bindings; return this; },
          async first() { return sql.includes("admin_sessions") ? { token: "valid" } : null; },
        };
        prepared.push(item);
        return item;
      },
      async batch(statements) {
        assert.equal(statements.length, 6);
        statements.forEach((item) => {
          assert.match(item.sql, /funnel_events/);
          assert.match(item.sql, /site_environment = \?/);
          assert.equal(item.bindings.at(-1), "dev");
          assert.doesNotMatch(item.sql, /SELECT\s+\*/i);
        });
        return BATCH_RESULTS;
      },
    },
  };
  const response = await onRequestGet({
    request: new Request("https://example.test/api/admin/funnel-analytics?days=7&environment=dev", {
      headers: { Authorization: "Bearer valid-token" },
    }),
    env,
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.filters.days, 7);
  assert.equal(data.filters.environment, "dev");
  assert.equal(data.summary.completions, 3);
  assert.equal(data.summary.rates.completion, 15);
  assert.deepEqual(data.courses[0], {
    course: "open-water",
    pageViews: 12,
    ctaClicks: 7,
    formStarts: 4,
    completions: 3,
    completionRate: 25,
  });
  assert.equal(data.sources[0].source, "google");
  assert.equal(data.devices[0].device, "mobile");
  assert.equal(Object.hasOwn(data, "events"), false);
  assert.equal(prepared[0].sql.includes("admin_sessions"), true);
});

test("management console exposes the responsive Site Analytics area", () => {
  const html = fs.readFileSync(path.join(root, "management", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "js", "management-analytics.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "css", "pages", "management.css"), "utf8");
  const config = fs.readFileSync(path.join(root, "wrangler.toml"), "utf8");

  assert.match(html, /data-site-studio-tab="analytics"/);
  assert.match(html, /data-site-studio-panel="analytics"/);
  assert.match(html, /data-more-tab="analytics"/);
  assert.match(html, /management-analytics\.js/);
  assert.match(js, /\/api\/admin\/funnel-analytics/);
  assert.match(js, /Authorization: `Bearer \$\{token\}`/);
  assert.match(css, /\.mgmt-analytics-stats/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.mgmt-analytics-controls/);
  assert.match(config, /name = "dmzscuba-com"/);
  assert.match(config, /binding = "DB"/);
});
