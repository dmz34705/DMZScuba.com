const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const workerSource = read("workers", "dmz-media-api", "src", "index.js");
const migration = read("workers", "dmz-media-api", "migrations", "0006_customer_bookings.sql");
const page = read("pages", "book", "index.html");
const client = read("js", "booking.js");
const managementPage = read("management", "index.html");
const managementClient = read("js", "management-bookings.js");

test("booking storage separates offerings, customer requests, and payment state", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS booking_offerings/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS customer_bookings_v2/);
  assert.match(migration, /payment_status TEXT NOT NULL DEFAULT 'unpaid'/);
  assert.match(workerSource, /customer_bookings_v2/);
  assert.match(workerSource, /booking\.created/);
});

test("booking page requires an account and supports all three booking journeys", () => {
  assert.match(page, /Sign in before you book/);
  assert.match(page, /data-booking-category="class"/);
  assert.match(page, /data-booking-category="trip"/);
  assert.match(page, /data-booking-category="event"/);
  assert.match(page, /House Call/);
  assert.match(page, /Virtual Classroom/);
  assert.match(page, /Veteran or public-safety discount/);
  assert.match(client, /dmzAccountReturnPath/);
  assert.match(client, /preferredDates/);
  assert.match(page, /name="certificationLevel"/);
});

test("management console can import and configure booking options", () => {
  assert.match(managementPage, /data-site-studio-tab="bookings"/);
  assert.match(managementPage, /Import Upcoming Calendar/);
  assert.match(managementClient, /api\/admin\/booking-offerings\/import-events/);
  assert.match(managementClient, /Deposit due/);
  assert.match(managementClient, /Booking Status/);
});

test("booking APIs reject unauthenticated requests", async () => {
  const worker = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`);
  const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" };
  for (const request of [
    new Request("https://dmzscuba.com/api/bookings/catalog"),
    new Request("https://dmzscuba.com/api/bookings", { method: "POST", body: "{}" }),
    new Request("https://dmzscuba.com/api/admin/bookings"),
  ]) {
    const response = await worker.default.fetch(request, env, { waitUntil() {} });
    assert.equal(response.status, 401);
  }
});
