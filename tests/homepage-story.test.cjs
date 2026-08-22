const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("homepage follows the lifestyle-to-start storytelling sequence", () => {
  const page = read("index.html");
  const markers = [
    'class="hero"',
    'class="home-section possibility"',
    'class="unlock-story"',
    'class="why-story"',
    'class="community-proof"',
    'class="home-section start-panel"',
    'class="home-section after-cert"',
    'class="dive-quiz-entry"',
    'class="final-cta"',
  ];

  let previous = -1;
  markers.forEach((marker) => {
    const index = page.indexOf(marker);
    assert.ok(index > previous, `${marker} should appear in the intended sequence`);
    previous = index;
  });
});

test("homepage answers the five first-time visitor questions", () => {
  const page = read("index.html");
  assert.match(page, /What scuba unlocks/);
  assert.match(page, /This could actually be you/);
  assert.match(page, /Why start with DMZ Scuba/);
  assert.match(page, /Open Water is the beginning, not the finish line/);
  assert.match(page, /View Open Water Training/);
});

test("homepage keeps search relevance and transparent Open Water details", () => {
  const page = read("index.html");
  assert.match(page, /<title>Scuba Certification Chicago \| DMZ Scuba<\/title>/);
  assert.match(page, /scuba classes near Chicago/);
  assert.match(page, /Open Water scuba certification near Chicago/);
  assert.match(page, /From \$1,099/);
  assert.match(page, /La Grange, Illinois/);
});

test("homepage preserves live functionality and low-pressure conversion paths", () => {
  const page = read("index.html");
  assert.match(page, /data-home-ticker/);
  assert.match(page, /data-events-preview/);
  assert.match(page, /data-event-alert-subscribe/);
  assert.match(page, /data-open-quiz="quick"/);
  assert.match(page, /id="dive-quiz-modal"/);
  assert.match(page, /class="js-map-link"/);
  assert.match(page, /id="mobile-sticky-cta"/);
});

test("homepage mobile layer uses intentional stacks, crops, and full-width actions", () => {
  const styles = read("css/pages/home.css");
  assert.match(styles, /@media \(max-width: 780px\)/);
  assert.match(styles, /\.hero\{[\s\S]*min-height: min\(760px, calc\(100svh - 64px\)\)/);
  assert.match(styles, /\.hero-bg\{[\s\S]*object-position: 58% center/);
  assert.match(styles, /\.unlock-story-scenes\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.diver-path\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.mobile-sticky-cta\{[\s\S]*width: calc\(100% - 32px\)/);
});

test("homepage uses deliberate scroll stories instead of generic section stacking", () => {
  const page = read("index.html");
  const styles = read("css/pages/home.css");
  const motion = read("js/home-motion.js");

  assert.match(page, /data-scroll-story="unlocks"/);
  assert.equal((page.match(/data-unlock-scene=/g) || []).length, 4);
  assert.match(page, /data-scroll-story="why"/);
  assert.equal((page.match(/data-why-step=/g) || []).length, 4);
  assert.doesNotMatch(page, /stack-frame/);
  assert.match(styles, /\.motion-ready \.unlock-story\{\s*height: 480svh/);
  assert.match(styles, /\.motion-ready \.why-story\{\s*height: 380svh/);
  assert.match(motion, /requestAnimationFrame/);
  assert.match(motion, /--scene-opacity/);
  assert.match(motion, /--story-progress/);
  assert.doesNotMatch(motion, /setTimeout/);
});

test("scroll stories settle to a complete scene without trapping user input", () => {
  const motion = read("js/home-motion.js");

  assert.match(motion, /snapNearestStoryScene/);
  assert.match(motion, /Math\.round\(currentProgress \* \(story\.sceneCount - 1\)\)/);
  assert.match(motion, /sceneSettleDelay = 160/);
  assert.match(motion, /addEventListener\("wheel", interruptSceneSnap/);
  assert.match(motion, /addEventListener\("touchstart", interruptSceneSnap/);
  assert.match(motion, /addEventListener\("keydown"/);
});
