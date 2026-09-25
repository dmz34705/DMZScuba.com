// Turn the app's self-contained WebView document into the travel page's browser asset.
// Generate the input with buildAtlasDocument() in dmzscuba-app, then run:
// node scripts/build-ocean-atlas-travel.cjs <app-atlas-snapshot.html>
const fs = require('node:fs');
const path = require('node:path');

const input = process.argv[2];
if (!input) throw new Error('Pass the app Ocean Atlas HTML snapshot path.');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'pages/travel/ocean-atlas.html');
const bridge = fs.readFileSync(path.join(root, 'js/ocean-atlas-frame-bridge.js'), 'utf8');
if (!fs.existsSync(path.join(root, 'js/ocean-atlas-guide-engine.js')))
  throw new Error('Build the Ocean Atlas guide engine before building the Atlas document.');
let html = fs.readFileSync(path.resolve(input), 'utf8');
const call = '\natlasRuntime(';
const at = html.lastIndexOf(call);
if (at < 0 || html.indexOf(call) !== at || !html.includes('</body></html>')) {
  throw new Error('App Ocean Atlas document format changed; update this adapter before rebuilding.');
}
// Capture the Leaflet map and provide the app's native message channel in-browser.
const setup = `
window.L.Map.addInitHook(function () { window.DMZ_TRAVEL_ATLAS_MAP = this; });
window.ReactNativeWebView = { postMessage: function (payload) {
  try { window.dispatchEvent(new CustomEvent('atlas-message', { detail: JSON.parse(payload) })); }
  catch (error) { console.warn('[Ocean Atlas] Invalid bridge message', error); }
} };`;
html = html.slice(0, at) + setup + html.slice(at);
html = html.replace('<head>', '<head><title>Ocean Atlas | DMZ Scuba</title><meta name="robots" content="noindex,nofollow">');
html = html.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' 'self'");
const runtimeScript = html.lastIndexOf('<script>');
if (runtimeScript < 0) throw new Error('Atlas runtime script not found.');
html = html.slice(0, runtimeScript) + '<script src="../../js/ocean-atlas-guide-engine.js?v=20260924-guides1"></script>' + html.slice(runtimeScript);
html = html.replace('</body></html>', `<script>${bridge.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
fs.writeFileSync(output, html);
console.log(`Built ${path.relative(root, output)} (${Buffer.byteLength(html).toLocaleString()} bytes).`);
