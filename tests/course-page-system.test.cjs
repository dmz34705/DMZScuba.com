const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const courseFiles = [
  "pages/training/open-water/index.html",
  "pages/training/discover-scuba/index.html",
  "pages/training/open-water-referral/index.html",
  "pages/training/advanced-specialty/index.html",
  "pages/training/skill-refresh/index.html",
  "pages/training/specialty/index.html",
  "pages/training/specialty/nitrox/index.html",
  "pages/training/specialty/drysuit/index.html",
  "pages/training/specialty/wreck/index.html",
  "pages/training/specialty/full-face-mask/index.html",
];
const pages = Object.fromEntries(courseFiles.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]));
const css = fs.readFileSync(path.join(root, "css/pages/course-page.css"), "utf8");
const motion = fs.readFileSync(path.join(root, "js/course-page.js"), "utf8");
const main = fs.readFileSync(path.join(root, "js/main.js"), "utf8");

test("every training course page uses the shared capability-first system", () => {
  Object.entries(pages).forEach(([file, html]) => {
    assert.match(html, /class="[^"]*course-page/);
    assert.match(html, /css\/pages\/course-page\.css/);
    assert.match(html, /js\/course-page\.js/);
    assert.match(html, /class="page-hero [^"]*course-page-hero"/);
    assert.match(html, /class="course-hero-summary"/);
    assert.match(html, /class="course-outcome" id="unlocks"/);
    assert.match(html, /data-course-reveal/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file} should have one H1`);
    assert.doesNotMatch(html, /Day 3 of 7/i);
  });
});

test("course pages preserve decision-critical facts", () => {
  const openWater = pages["pages/training/open-water/index.html"];
  [/\$1,099/, /\$1,199/, /\$649/, /\$299/, /4-6/, /200 yards/, /10-minute/, /Ages 10-11/].forEach((pattern) => assert.match(openWater, pattern));

  const discovery = pages["pages/training/discover-scuba/index.html"];
  [/\$299/, /within 60 days/, /Up to 2/, /not an independent-diver certification/i].forEach((pattern) => assert.match(discovery, pattern));

  const referral = pages["pages/training/open-water-referral/index.html"];
  [/\$649/, /destination dive operator/i, /Destination checkout dives/, /travel costs/].forEach((pattern) => assert.match(referral, pattern));

  const advanced = pages["pages/training/advanced-specialty/index.html"];
  [/\$599/, /Five training dives/, /2 core \+ 3 electives/, /Open Water \(or equivalent\) certification/].forEach((pattern) => assert.match(advanced, pattern));

  const refresh = pages["pages/training/skill-refresh/index.html"];
  [/\$399/, /certification card/, /Pool, confined water, or open water/, /Buoyancy and Trim/].forEach((pattern) => assert.match(refresh, pattern));

  const nitrox = pages["pages/training/specialty/nitrox/index.html"];
  [/\$399/, /maximum operating depth/i, /oxygen exposure/i, /Open Water \(or equivalent\) certification/].forEach((pattern) => assert.match(nitrox, pattern));

  const drysuit = pages["pages/training/specialty/drysuit/index.html"];
  [/\$399/, /Open Water<\/a> \(or equivalent\) certification/, /runaway ascents/, /Facility entry fees/].forEach((pattern) => assert.match(drysuit, pattern));

  const wreck = pages["pages/training/specialty/wreck/index.html"];
  [/\$399/, /Advanced Adventure<\/a> \(or equivalent\) is recommended/, /boat\/site access/, /penetration is appropriate/i].forEach((pattern) => assert.match(wreck, pattern));

  const fullFace = pages["pages/training/specialty/full-face-mask/index.html"];
  [/\$399/, /Open Water<\/a> \(or equivalent\) certification/, /Full face mask rental or purchase/, /Clearing, removal, recovery/].forEach((pattern) => assert.match(fullFace, pattern));
});

test("course motion is restrained, progressive, and reduced-motion safe", () => {
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(motion, /wheel|touchmove|scrollTo|preventDefault/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.course-outcome/);
  assert.match(css, /@media \(max-width: 780px\)/);
});

test("supporting course information uses grouped reading surfaces instead of floating card mosaics", () => {
  assert.match(css, /\.course-page \.content-columns,[\s\S]*?\.course-page \.content-section > \.feature-grid\{[\s\S]*?gap: 1px;[\s\S]*?overflow: hidden;[\s\S]*?border: 1px solid var\(--course-line\);/);
  assert.match(css, /\.course-page \.content-columns > div,[\s\S]*?\.course-page \.content-section > \.feature-grid > \.feature-card\{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?box-shadow: none;/);
  assert.match(css, /\.course-page \.two-col-grid\{[\s\S]*?overflow: hidden;[\s\S]*?border: 1px solid var\(--course-line\);[\s\S]*?gap: 0;/);
  assert.match(css, /\.course-page \.mobile-collapsible\{[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/);
  assert.match(css, /\.course-page \.specialty-grid \.specialty-card\{[\s\S]*?border-radius: 18px;/);
  Object.values(pages).forEach((html) => assert.match(html, /course-page\.css\?v=20260822c/));
});

test("mobile course hero proof points cannot inherit carousel height", () => {
  assert.match(css, /@media \(max-width: 780px\)[\s\S]*?\.course-page \.course-page-hero \.hero-proof-list\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: 1fr;[\s\S]*?scroll-snap-type: none;/);
  assert.match(css, /\.course-page \.course-page-hero \.hero-proof-list li\{[\s\S]*?min-height: 0;[\s\S]*?flex: none;[\s\S]*?scroll-snap-align: none;/);
  assert.doesNotMatch(css, /@media \(max-width: 520px\)[\s\S]*?\.course-page \.course-page-hero \.hero-proof-list\{[\s\S]*?flex-direction: column;/);
});

test("existing course telemetry and builder routing remain intact", () => {
  [
    "open-water",
    "open-water-referral",
    "scuba-discovery",
    "advanced-adventure",
    "skill-refresh",
    "specialty-hub",
    "nitrox",
    "dry-suit",
    "wreck",
    "full-face-mask",
  ].forEach((course) => assert.match(main, new RegExp(`\"${course}\"`)));

  Object.values(pages).forEach((html) => {
    assert.match(html, /course-builder\/index\.html/);
    assert.match(html, /mobile-sticky-cta-link/);
  });
});
