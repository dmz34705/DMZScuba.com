const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workerPath = path.resolve(__dirname, "..", "workers", "dmz-media-api", "src", "index.js");
const workerSource = fs.readFileSync(workerPath, "utf8");
const workerModulePromise = import(`data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`);

const EVENT_ID = "fa4650ea-851f-40a8-bd4f-5e171ad8a001";
const SESSION_ID = "d7079bbb-0b53-4365-9aba-c0a9b130b002";

test("funnel records keep only approved, normalized analytics fields", async () => {
  const { buildFunnelEventRecord } = await workerModulePromise;
  const record = buildFunnelEventRecord(
    {
      eventId: EVENT_ID,
      sessionId: SESSION_ID,
      eventType: "training_course_view",
      pageUrl: "https://www.dmzscuba.com/pages/training/open-water/?email=person@example.com&gclid=secret#form",
      sentAt: "2026-08-23T12:00:00.000Z",
      details: {
        course: "open-water",
        device: "mobile",
        source: "google",
        medium: "paid-search",
        campaign: "person@example.com",
        content: "open-water-ad",
        name: "Never Store Me",
        phone: "555-555-1212",
      },
    },
    "2026-08-23T12:00:01.000Z"
  );

  assert.equal(record.id, EVENT_ID);
  assert.equal(record.sessionId, SESSION_ID);
  assert.equal(record.siteEnvironment, "live");
  assert.equal(record.pagePath, "/pages/training/open-water/");
  assert.equal(record.source, "google");
  assert.equal(record.medium, "paid-search");
  assert.equal(record.campaign, null);
  assert.equal(record.content, "open-water-ad");
  assert.equal(Object.hasOwn(record, "name"), false);
  assert.equal(Object.hasOwn(record, "phone"), false);
});

test("funnel paths remove query strings and external referrers", async () => {
  const { buildFunnelEventRecord } = await workerModulePromise;
  const record = buildFunnelEventRecord(
    {
      eventId: EVENT_ID,
      sessionId: SESSION_ID,
      eventType: "training_cta_click",
      pageUrl: "https://dmzscuba-com.pages.dev/pages/training/open-water/",
      sentAt: "2026-08-23T12:00:00.000Z",
      details: {
        course: "open-water",
        label: "Start Your Course",
        destination: "/pages/training/course-builder/?course=open-water&email=person@example.com",
        sourcePage: "https://search.example/?q=private",
        ctaType: "primary",
        placement: "course-hero",
      },
    },
    "2026-08-23T12:00:01.000Z"
  );

  assert.equal(record.siteEnvironment, "dev");
  assert.equal(record.label, "Start Your Course");
  assert.equal(record.destinationPath, "/pages/training/course-builder/");
  assert.equal(record.sourcePage, "external");
  assert.equal(record.ctaType, "primary");
});

test("non-funnel operational telemetry is not prepared for D1", async () => {
  const { buildFunnelEventRecord } = await workerModulePromise;
  assert.equal(
    buildFunnelEventRecord({ eventType: "contact_submit_failed", details: { status: 500 } }),
    null
  );
});

test("telemetry endpoint queues an idempotent D1 insert for a trusted origin", async () => {
  const worker = await workerModulePromise;
  const calls = [];
  const pending = [];
  const env = {
    ALLOWED_ORIGINS: "https://dmzscuba.com",
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            calls.push({ sql, values });
            return { run: async () => ({ success: true, meta: { changes: 1 } }) };
          },
        };
      },
    },
  };
  const request = new Request("https://worker.example/api/client-telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://dmzscuba.com" },
    body: JSON.stringify({
      eventId: EVENT_ID,
      sessionId: SESSION_ID,
      eventType: "training_inquiry_completed",
      pageUrl: "https://dmzscuba.com/pages/training/course-builder/",
      sentAt: "2026-08-23T12:00:00.000Z",
      details: { course: "open-water", experience: "new-diver", group: "individual", sourcePage: "/pages/training/open-water/" },
    }),
  });

  const response = await worker.default.fetch(request, env, { waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, persisted: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT OR IGNORE INTO funnel_events/);
  assert.equal(calls[0].values[0], EVENT_ID);
  assert.equal(calls[0].values[1], "training_inquiry_completed");
  assert.equal(calls[0].values[2], SESSION_ID);
});

test("telemetry endpoint rejects untrusted origins before writing", async () => {
  const worker = await workerModulePromise;
  let prepared = false;
  const request = new Request("https://worker.example/api/client-telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ eventType: "training_course_view" }),
  });
  const response = await worker.default.fetch(
    request,
    { ALLOWED_ORIGINS: "https://dmzscuba.com", DB: { prepare: () => { prepared = true; } } },
    { waitUntil() {} }
  );

  assert.equal(response.status, 403);
  assert.equal(prepared, false);
});
