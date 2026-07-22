const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const trainingRoot = path.join(root, "pages", "training");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const htmlFiles = walk(trainingRoot).filter((file) => path.basename(file) === "index.html");
const commercialPages = htmlFiles.filter(
  (file) =>
    !file.includes(`${path.sep}interactive-tools${path.sep}`) &&
    !file.includes(`${path.sep}course-builder${path.sep}`) &&
    file !== path.join(trainingRoot, "specialty", "index.html") &&
    file !== path.join(trainingRoot, "index.html")
);

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  assert(/<title>[^<]+<\/title>/.test(html), `${relative}: missing title`);
  assert(/<meta\s+name="description"\s+content="[^"]+"/.test(html), `${relative}: missing meta description`);
  assert(/<link\s+rel="canonical"\s+href="https:\/\/www\.dmzscuba\.com\/[^"]+"/.test(html), `${relative}: missing canonical`);
  assert((html.match(/<h1\b/g) || []).length === 1, `${relative}: expected exactly one H1`);
  for (const image of html.matchAll(/<img\b[^>]*>/g)) {
    assert(/\balt="[^"]*"/.test(image[0]), `${relative}: image missing alt text`);
  }
  assert(!/(Additional fee applies|\$1099|\$1199|from \$399|â|Â)/.test(html), `${relative}: outdated price, fee, or encoding copy`);

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|javascript:)/.test(href)) continue;
    const [targetPart, hash = ""] = href.split("#");
    if (!targetPart) {
      if (hash) assert(new RegExp(`id=["']${hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(html), `${relative}: missing #${hash}`);
      continue;
    }
    if (targetPart.startsWith("/assets/") || targetPart.startsWith("/css/") || targetPart.startsWith("/js/")) continue;
    if (/\.(css|js|png|jpg|jpeg|webp|ico)(\?|$)/i.test(targetPart)) continue;
    const cleanTarget = targetPart.split("?")[0];
    let resolved = cleanTarget.startsWith("/") ? path.join(root, cleanTarget) : path.resolve(path.dirname(file), cleanTarget);
    if (cleanTarget.endsWith("/")) resolved = path.join(resolved, "index.html");
    assert(fs.existsSync(resolved), `${relative}: broken local link ${href}`);
    if (hash && resolved.endsWith(".html")) {
      const targetHtml = fs.readFileSync(resolved, "utf8");
      assert(new RegExp(`id=["']${hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(targetHtml), `${relative}: missing target ${href}`);
    }
  }
}

for (const file of commercialPages) {
  const html = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  assert(/course-builder\/index\.html\?course=/.test(html), `${relative}: missing course-prefilled inquiry link`);
  assert(/mobile-sticky-cta-link/.test(html), `${relative}: missing course-specific mobile CTA`);
}

const builderHtml = fs.readFileSync(path.join(trainingRoot, "course-builder", "index.html"), "utf8");
const builderCourses = new Set([...builderHtml.matchAll(/data-value="(sdi-[^"]+)"/g)].map((match) => match[1]));
for (const file of commercialPages) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/course=([^"&]+)/g)) {
    assert(builderCourses.has(match[1]), `${path.relative(root, file)}: unknown course prefill ${match[1]}`);
  }
}

console.log(`PASS training funnel validation (${htmlFiles.length} pages)`);
