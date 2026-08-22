const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "pages", "training", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "pages", "training-home.css"), "utf8");
const js = fs.readFileSync(path.join(root, "js", "training-home-motion.js"), "utf8");

test("main training page presents one complete four-stage journey", () => {
  assert.match(page, /data-training-story/);
  assert.equal((page.match(/data-training-visual=/g) || []).length, 4);
  assert.equal((page.match(/data-training-scene=/g) || []).length, 4);

  const start = page.indexOf("<h3>Start</h3>");
  const explore = page.indexOf("<h3>Explore</h3>");
  const specialize = page.indexOf("<h3>Specialize</h3>");
  const lead = page.indexOf("<h3>Lead</h3>");
  assert.ok(start > -1 && start < explore && explore < specialize && specialize < lead);
  assert.doesNotMatch(page, /Day 3 of 7/i);
});

test("course catalog pairs learning with real-world access", () => {
  assert.equal((page.match(/class="training-course-card(?:\s|\")/g) || []).length, 11);
  assert.equal((page.match(/<b>Learn<\/b>/g) || []).length, 11);
  assert.equal((page.match(/<b>Unlocks<\/b>/g) || []).length, 11);
  assert.match(page, /Open Water turns curiosity into access/);
  assert.match(page, /You do not need the whole path today/);
  assert.match(page, /Open Water and a few vacation dives can be exactly enough/);
});

test("course stages use responsive editorial imagery without changing the catalog", () => {
  assert.equal((page.match(/class="training-stage-visual"/g) || []).length, 4);
  ["openwater-hero-lower", "rwadvanced-hero", "hero-specialtymain", "hero-training"].forEach((asset) => {
    assert.match(page, new RegExp(`${asset}\\.png`));
    assert.match(page, new RegExp(`${asset}-mobile\\.webp`));
  });
  assert.match(page, /class="training-after-bg"/);
  assert.match(page, /hero-travel-mobile\.webp/);
  assert.match(css, /\.training-stage-visual/);
  assert.match(css, /\.training-after-bg/);
});

test("training landing page preserves SEO, pricing, and conversion routes", () => {
  [
    /Scuba Classes Near Chicago/,
    /scuba classes near Chicago/i,
    /Open Water certification/i,
    /Advanced Adventure/,
    /Specialty courses/,
    /\$1,099 group \/ \$1,199 private/,
    /data-events-preview/,
    /mobile-sticky-cta/,
    /course-builder\/index\.html/,
    /js\/events\.js/,
    /js\/main\.js/,
  ].forEach((pattern) => assert.match(page, pattern));
});

test("scroll motion settles to full scenes and remains interruptible", () => {
  assert.match(css, /\.training-motion-ready \.training-journey\s*\{\s*height:\s*400svh/);
  assert.match(css, /height:\s*430svh/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(js, /const sceneSettleDelay = 160/);
  assert.match(js, /Math\.round\(progress \* sceneStops\) \/ sceneStops/);
  assert.match(js, /wheel/);
  assert.match(js, /touchstart/);
  assert.match(js, /pointerdown/);
  assert.doesNotMatch(js, /setTimeout/);
});

test("mobile course catalog stacks without horizontal scrolling", () => {
  assert.match(
    css,
    /@media \(max-width: 780px\)[\s\S]*?\.training-home-page \.training-course-grid,[\s\S]*?grid-template-columns:\s*1fr;[\s\S]*?overflow:\s*visible;/
  );
});

test("new training motion assets are scoped to the main page", () => {
  assert.match(page, /css\/pages\/training-home\.css/);
  assert.match(page, /js\/training-home-motion\.js/);

  const detailPages = [
    "open-water/index.html",
    "discover-scuba/index.html",
    "advanced-specialty/index.html",
    "skill-refresh/index.html",
    "specialty/index.html",
  ];
  detailPages.forEach((relative) => {
    const detail = fs.readFileSync(path.join(root, "pages", "training", relative), "utf8");
    assert.doesNotMatch(detail, /training-home\.(?:css|js)/);
  });
});
