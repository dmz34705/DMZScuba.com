const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("shared navigation includes the accessible mobile drawer controls", () => {
  const source = read("js/main.js");
  assert.match(source, /class="nav-menu-toggle"/);
  assert.match(source, /class="site-brand"/);
  assert.match(source, /class="site-name">DMZ Scuba/);
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
  assert.match(components, /@media \(max-width: 780px\)[\s\S]*\.site-name\{[\s\S]*display:\s*block/);
  assert.match(source, /\.nav-drawer-links[\s\S]*visibility:\s*visible/);
  assert.match(components, /\.mobile-nav-layer\{[\s\S]*position:\s*fixed[\s\S]*min-height:\s*100dvh/);
  assert.match(components, /\.mobile-nav-drawer\{[\s\S]*position:\s*absolute[\s\S]*max-height:\s*100dvh/);
  assert.match(components, /\.mobile-nav-layer\.is-open \.mobile-nav-drawer/);
  assert.match(source, /input:not\([\s\S]*font-size:\s*16px !important/);
  assert.match(source, /\.page-hero[\s\S]*padding:\s*28px 18px 24px/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
});

test("training table of contents follows the hidden mobile header", () => {
  const javascript = read("js/main.js");
  const responsive = read("css/responsive.css");
  assert.match(javascript, /const setHeaderHidden = \(hidden\) =>/);
  assert.match(javascript, /document\.body\?\.classList\.toggle\("site-header-is-hidden", hidden\)/);
  assert.match(responsive, /body\.training-landing-page \.toc\{[\s\S]*transition:\s*top 220ms ease/);
  assert.match(responsive, /body\.training-landing-page\.site-header-is-hidden \.toc\{[\s\S]*top:\s*0/);
  assert.match(responsive, /body\.media-page \.media-controls\{[\s\S]*transition:\s*top 220ms ease/);
  assert.match(responsive, /body\.media-page\.site-header-is-hidden \.media-controls\{[\s\S]*top:\s*0/);
  assert.match(responsive, /\.media-page \.media-controls\{[\s\S]*width:\s*calc\(100% \+ 36px\)[\s\S]*max-width:\s*none/);
  assert.doesNotMatch(javascript, /contains\("media-page"\)\) \{\s*setHeaderHidden\(false\);\s*return;/);
});

test("events calendar has a focused mobile planning flow", () => {
  const page = read("pages/events/index.html");
  const responsive = read("css/responsive.css");
  const embed = read("pages/events/embed.html");
  assert.match(page, /class="events-mobile-nav"/);
  assert.match(page, /href="#calendar"/);
  assert.match(page, /id="calendar"/);
  assert.match(page, /id="planning"/);
  assert.match(page, /class="events-native-calendar"/);
  assert.match(page, /data-events-calendar/);
  assert.match(page, /class="events-admin-embed"/);
  assert.match(responsive, /body\.events-page\.site-header-is-hidden \.events-mobile-nav\{[\s\S]*top:\s*0/);
  assert.match(responsive, /\.events-page \.events-page-layout-embed \.events-list-block\{[\s\S]*order:\s*1/);
  assert.match(responsive, /body\.events-authenticated \.events-page \.events-native-calendar\{[\s\S]*display:\s*none/);
  assert.match(responsive, /\.events-page \.events-embed-shell-card\{[\s\S]*margin-right:\s*-18px/);
  assert.match(responsive, /\.events-page \.page-hero-events \.page-hero-card\{[\s\S]*display:\s*none/);
  assert.match(embed, /responsive\.css\?v=20260730e1/);
});

test("mobile sticky actions stay inside narrow viewports", () => {
  const source = read("css/responsive.css");
  assert.match(source, /width:\s*calc\(100% - 32px\)/);
  assert.match(source, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*42px/);
  assert.match(source, /transform:\s*translateX\(-50%\)/);
  assert.match(source, /overflow:\s*hidden/);
});

test("public pages use one isolated mobile header contract", () => {
  const main = read("js/main.js");
  const responsive = read("css/responsive.css");
  const legacy = read("css/main.css");
  const media = read("css/pages/media.css");
  const travel = read("css/pages/travel.css");

  assert.match(main, /header\.dataset\.siteHeader = "unified"/);
  assert.match(main, /document\.body\.insertBefore\(header, pageRoot\)/);
  assert.match(responsive, /One mobile header contract for every public site shell/);
  assert.match(responsive, /\.site-header\[data-site-nav\][\s\S]*position:\s*sticky !important/);
  assert.match(responsive, /--mobile-site-header-height:\s*64px/);
  assert.doesNotMatch(legacy, /\.site-header\s*\{/);
  assert.doesNotMatch(legacy, /\.main-nav\s*\{/);
  assert.doesNotMatch(media, /media-page \.site-header/);
  assert.doesNotMatch(travel, /travel-page \.site-header/);
});

test("every public shell page loads the unified navigation assets", () => {
  const shellPages = [
    "index.html",
    "pages/about/index.html",
    "pages/contact/index.html",
    "pages/events/event.html",
    "pages/events/index.html",
    "pages/media/index.html",
    "pages/nfc/index.html",
    "pages/privacy/index.html",
    "pages/thanks/index.html",
    "pages/training/advanced-specialty/index.html",
    "pages/training/course-builder/index.html",
    "pages/training/discover-scuba/index.html",
    "pages/training/index.html",
    "pages/training/interactive-tools/index.html",
    "pages/training/open-water-referral/index.html",
    "pages/training/open-water/index.html",
    "pages/training/skill-refresh/index.html",
    "pages/training/specialty/drysuit/index.html",
    "pages/training/specialty/full-face-mask/index.html",
    "pages/training/specialty/index.html",
    "pages/training/specialty/nitrox/index.html",
    "pages/training/specialty/wreck/index.html",
    "pages/travel/destination.html",
    "pages/travel/index.html",
  ];

  shellPages.forEach((relativePath) => {
    const source = read(relativePath);
    assert.match(source, /<header class="site-header" data-site-nav>/, `${relativePath} needs the shared header`);
    assert.match(source, /css\/components\.css/, `${relativePath} needs shared components`);
    assert.match(source, /css\/responsive\.css/, `${relativePath} needs the mobile contract`);
    assert.match(source, /js\/main\.js/, `${relativePath} needs shared navigation behavior`);
  });
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

test("training feature-card rails receive visual scroll dots when they overflow", () => {
  const javascript = read("js/main.js");
  const responsive = read("css/responsive.css");
  assert.match(javascript, /function initTrainingScrollDots\(\)/);
  assert.match(javascript, /training-landing-page:not\(\.training-home-page\)/);
  assert.match(javascript, /dots\.hidden = !canScroll/);
  assert.match(javascript, /track\.insertAdjacentElement\("afterend", dots\)/);
  assert.match(javascript, /track\.addEventListener\("scroll", scheduleUpdate/);
  assert.match(responsive, /\.training-scroll-dots span\.is-active/);
});

test("Travel page prioritizes globe exploration and destination browsing", () => {
  const page = read("pages/travel/index.html");
  const globe = read("js/globe.js");
  const travel = read("css/pages/travel.css");
  assert.match(page, /class="section travel-explorer" id="globe"/);
  assert.match(page, /class="travel-explorer-guide"/);
  assert.match(page, /class="section travel-browse-section" id="destination-list"/);
  assert.ok(page.indexOf('id="destination-list"') < page.indexOf('id="travel-upcoming-title"'));
  assert.match(page, /class="section destination-preview" id="destination"/);
  assert.doesNotMatch(page, /class="micro-note/);
  assert.match(globe, /destination-item-image/);
  assert.match(globe, /item\.append\(imageWrap, body\)/);
  assert.match(globe, /wrap\.getBoundingClientRect\(\)\.width/);
  assert.match(globe, /new ResizeObserver\(fitCanvas\)\.observe\(canvas\.parentElement\)/);
  assert.match(travel, /\.globe-filter-pills\s*\{[\s\S]*flex-wrap:\s*nowrap/);
  assert.match(travel, /\.destination-item\s*\{[\s\S]*grid-template-columns:\s*112px/);
  assert.match(travel, /body:not\(\.dest-authenticated\) \.dest-admin-fab/);
  assert.match(travel, /body\.travel-page \{[\s\S]*overflow-x:\s*clip/);
  assert.match(travel, /body\.travel-page #globeCanvas[\s\S]*max-width:\s*100% !important/);
  assert.match(travel, /\.destination-item\s*\{[\s\S]*grid-template-columns:\s*minmax\(88px, 30%\) minmax\(0, 1fr\)/);
  assert.match(read("css/pages/destination.css"), /Mobile containment for every destination detail section/);
  assert.match(read("css/pages/destination.css"), /body\.destination-page \{[\s\S]*overflow-x:\s*clip/);
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
    "css/main.css",
    "css/pages/contact.css",
    "css/pages/home.css",
    "css/pages/media.css",
    "css/pages/travel.css",
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
