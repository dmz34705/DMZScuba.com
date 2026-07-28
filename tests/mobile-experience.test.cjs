const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("shared navigation includes the accessible mobile drawer controls", () => {
  const source = read("js/main.js");
  assert.match(source, /class="nav-menu-toggle"/);
  assert.match(source, /aria-controls="mobile-navigation"/);
  assert.match(source, /class="nav-menu-close"/);
  assert.match(source, /class="nav-backdrop"/);
  assert.match(source, /class="mobile-nav-layer"/);
  assert.match(source, /class="mobile-nav-drawer"/);
  assert.match(source, /class="nav-drawer-links"/);
  assert.match(source, /document\.body\.insertAdjacentHTML\("beforeend", mobileLayerHtml\)/);
  ["Home", "Classes", "Travel", "Media", "Events", "Contact", "About"].forEach((label) => {
    assert.match(source, new RegExp(`label: "${label}"`));
  });
  assert.match(source, /body\.classList\.toggle\("mobile-nav-open"/);
  assert.match(source, /drawer\.inert = true/);
  assert.match(source, /event\.key === "Escape"/);
});

test("mobile CSS keeps the header compact and form controls touch friendly", () => {
  const source = read("css/responsive.css");
  const components = read("css/components.css");
  assert.match(source, /\.site-header[\s\S]*min-height:\s*64px/);
  assert.match(source, /\.nav-drawer-links[\s\S]*visibility:\s*visible/);
  assert.match(components, /\.mobile-nav-layer\{[\s\S]*position:\s*fixed[\s\S]*min-height:\s*100dvh/);
  assert.match(components, /\.mobile-nav-drawer\{[\s\S]*position:\s*absolute[\s\S]*max-height:\s*100dvh/);
  assert.match(components, /\.mobile-nav-layer\.is-open \.mobile-nav-drawer/);
  assert.match(source, /input:not\([\s\S]*font-size:\s*16px !important/);
  assert.match(source, /\.page-hero[\s\S]*padding:\s*28px 18px 24px/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
});

test("mobile sticky actions stay inside narrow viewports", () => {
  const source = read("css/responsive.css");
  assert.match(source, /width:\s*calc\(100% - 32px\)/);
  assert.match(source, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*42px/);
  assert.match(source, /transform:\s*translateX\(-50%\)/);
  assert.match(source, /overflow:\s*hidden/);
});

test("key mobile journeys include contextual sticky actions", () => {
  const pages = [
    "index.html",
    "pages/travel/index.html",
    "pages/travel/destination.html",
    "pages/media/index.html",
    "pages/events/index.html",
    "pages/events/event.html",
    "pages/training/open-water/index.html",
  ];
  pages.forEach((relativePath) => {
    assert.match(
      read(relativePath),
      /id="mobile-sticky-cta"/,
      `${relativePath} should include a mobile sticky action`
    );
  });
});

test("optimized mobile hero and logo assets referenced by the site exist", () => {
  const assetPaths = [
    "assets/images/logos/dmz-scuba-logo-mobile.webp",
    "assets/images/logos/dmz-scuba-logo-display.webp",
    "assets/images/hero/hero-placeholder-mobile.webp",
    "assets/images/hero/hero-training-mobile.webp",
    "assets/images/hero/hero-travel-mobile.webp",
    "assets/images/hero/hero-media-mobile.webp",
    "assets/images/hero/hero-contact-mobile.webp",
  ];
  assetPaths.forEach((relativePath) => {
    const fullPath = path.join(root, relativePath);
    assert.equal(fs.existsSync(fullPath), true, `${relativePath} should exist`);
    assert.ok(fs.statSync(fullPath).size > 0, `${relativePath} should not be empty`);
  });
});

test("edited stylesheets have balanced blocks", () => {
  const stylesheets = [
    "css/components.css",
    "css/pages/contact.css",
    "css/pages/home.css",
    "css/responsive.css",
  ];
  stylesheets.forEach((relativePath) => {
    const source = read(relativePath)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
    let depth = 0;
    for (const character of source) {
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      assert.ok(depth >= 0, `${relativePath} closes a block before it opens`);
    }
    assert.equal(depth, 0, `${relativePath} should have balanced blocks`);
  });
});
