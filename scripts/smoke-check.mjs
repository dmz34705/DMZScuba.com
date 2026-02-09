#!/usr/bin/env node

const args = process.argv.slice(2);

function readArg(name, fallback = "") {
  const pref = `${name}=`;
  const exactIndex = args.indexOf(name);
  if (exactIndex !== -1) {
    const next = args[exactIndex + 1];
    if (next && !next.startsWith("--")) return next;
    return "true";
  }
  const kv = args.find((arg) => arg.startsWith(pref));
  if (kv) return kv.slice(pref.length);
  return fallback;
}

const baseInput = readArg("--base", "https://dmzscuba-com.pages.dev");
const timeoutMs = Number(readArg("--timeout-ms", "12000")) || 12000;
const skipApi = readArg("--skip-api", "false") === "true";
const verbose = readArg("--verbose", "false") === "true";

const baseUrl = baseInput.replace(/\/+$/, "");

function ok(result, detail = "") {
  return { ok: true, result, detail };
}

function fail(result, detail = "") {
  return { ok: false, result, detail };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function buildUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${baseUrl}${path}`;
}

async function checkHtml(path, marker) {
  const url = buildUrl(path);
  try {
    const res = await fetchWithTimeout(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return fail(`${path}`, `HTTP ${res.status}`);
    const text = await res.text();
    if (marker && !text.includes(marker)) {
      return fail(`${path}`, `Missing marker: ${marker}`);
    }
    return ok(`${path}`, `HTTP ${res.status}`);
  } catch (error) {
    return fail(`${path}`, String(error && error.message ? error.message : error));
  }
}

async function checkApiMedia() {
  const path = "/api/media";
  const url = buildUrl(path);
  try {
    const res = await fetchWithTimeout(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return fail(path, `HTTP ${res.status}`);
    const json = await res.json();
    const hasMedia = Array.isArray(json && json.mediaItems);
    const hasPhotos = Array.isArray(json && json.photoItems);
    if (!hasMedia || !hasPhotos) {
      return fail(path, "Expected JSON with mediaItems[] and photoItems[]");
    }
    return ok(path, `mediaItems=${json.mediaItems.length}, photoItems=${json.photoItems.length}`);
  } catch (error) {
    return fail(path, String(error && error.message ? error.message : error));
  }
}

async function checkApiDestinations() {
  const path = "/api/v2/destinations";
  const url = buildUrl(path);
  try {
    const res = await fetchWithTimeout(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return fail(path, `HTTP ${res.status}`);
    const json = await res.json();
    const hasItems = Array.isArray(json && json.items);
    if (!hasItems) return fail(path, "Expected JSON with items[]");
    return ok(path, `items=${json.items.length}`);
  } catch (error) {
    return fail(path, String(error && error.message ? error.message : error));
  }
}

async function checkApiContactNoDelivery() {
  const path = "/api/contact";
  const url = buildUrl(path);
  try {
    const payload = {
      form: "Smoke Test",
      name: "Smoke Bot",
      email: "smoke@example.com",
      message: "Smoke check",
      honey: "smoke-trap",
      fields: {
        "contact-name": "Smoke Bot",
        "contact-email": "smoke@example.com",
        message: "Smoke check",
      },
    };
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return fail(path, `HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    if (!json || json.ok !== true) return fail(path, "Expected { ok: true }");
    return ok(path, "honeypot bypass path returned ok");
  } catch (error) {
    return fail(path, String(error && error.message ? error.message : error));
  }
}

async function run() {
  const checks = [
    () => checkHtml("/", "DMZ Scuba"),
    () => checkHtml("/pages/contact/index.html", "quickContactForm"),
    () => checkHtml("/pages/media/index.html", "mediaGrid"),
    () => checkHtml("/pages/travel/index.html", "travel-page"),
  ];

  if (!skipApi) {
    checks.push(
      () => checkApiMedia(),
      () => checkApiDestinations(),
      () => checkApiContactNoDelivery()
    );
  }

  const results = [];
  for (const check of checks) {
    // eslint-disable-next-line no-await-in-loop
    const result = await check();
    results.push(result);
    const icon = result.ok ? "PASS" : "FAIL";
    const suffix = result.detail ? ` - ${result.detail}` : "";
    console.log(`[${icon}] ${result.result}${suffix}`);
    if (verbose && !result.ok) {
      console.log(`       base=${baseUrl}`);
    }
  }

  const failed = results.filter((item) => !item.ok);
  console.log("");
  console.log(`Smoke check base: ${baseUrl}`);
  console.log(`Checks: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);

  if (failed.length) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Smoke check runner failed:", error);
  process.exitCode = 1;
});
