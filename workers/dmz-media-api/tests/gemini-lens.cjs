const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const sourcePath = fs.existsSync(path.join(__dirname, '../src/index.js'))
  ? path.join(__dirname, '../src/index.js') : path.join(__dirname, 'index.js');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/export \{[\s\S]*?\n\};/, '')
  .replace('export default {', 'const workerDefault = {');
const logs = [];
const sandbox = vm.createContext({
  Request, Response, Headers, URL, TextEncoder, TextDecoder, Uint8Array, Buffer, AbortController,
  crypto: webcrypto, setTimeout, clearTimeout,
  console: { log: (...args) => logs.push(JSON.stringify(args)), error: (...args) => logs.push(JSON.stringify(args)) },
});
vm.runInContext(source + '\nglobalThis.api={handleVisionIdentify,handleItineraryImport,workerDefault};', sandbox);
const env = { AI_PROVIDER: 'local', LENS_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'private-fixture-key', LOCAL_AI_ORIGIN_URL: 'https://local.test', LOCAL_AI_SHARED_SECRET: 'private-origin-fixture' };
const sentinel = 'PRIVATE_TEST_PAYLOAD_NEVER_LOG';
const result = {
  category: 'unclear', commonName: 'Unidentified subject', scientificName: null,
  confidence: 'low', description: 'Insufficient visual evidence.', safetyNote: null, funFact: null,
  identificationLevel: 'unidentified', evidence: [], uncertainty: 'Unclear', nextPhoto: null,
  alternatives: [], gear: null, marineLife: null,
};
const makeRequest = (body = { imageBase64: sentinel, mimeType: 'image/jpeg' }, auth = true) => new Request('https://dmz.test/api/vision/identify', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-session' } : {}) }, body: JSON.stringify(body),
});
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
(async () => {
  await check('real authentication rejects unsigned requests before any provider call', async () => {
    sandbox.fetch = async () => { throw new Error('Provider must not be called'); };
    assert.equal((await sandbox.api.handleVisionIdentify(makeRequest(undefined, false), env)).status, 401);
  });
  // Simulate an already verified customer only inside this isolated test context.
  vm.runInContext('requireCustomerIdentity = async () => ({ identity: { userId: "test-user" }, profile: {} });', sandbox);
  await check('Dive Lens uses Gemini while itinerary provider is local', async () => {
    sandbox.fetch = async (url, options) => {
      assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
      assert.ok(!url.includes(env.GEMINI_API_KEY));
      assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
      const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.equal(body.contents[0].parts[1].inlineData.data, sentinel);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: sentinel }, { text: JSON.stringify(result) }] } }] }));
    };
    const response = await sandbox.api.handleVisionIdentify(makeRequest(), env, 'gemini-routing-test');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).schemaVersion, 2);
  });
  await check('missing key fails before provider request', async () => {
    sandbox.fetch = async () => { throw new Error('Provider must not be called'); };
    assert.equal((await sandbox.api.handleVisionIdentify(makeRequest(), { ...env, GEMINI_API_KEY: '' })).status, 500);
  });
  for (const [providerStatus, expected] of [[429,429],[503,503],[403,502]]) {
    await check(`provider HTTP ${providerStatus} is handled without logging its body`, async () => {
      sandbox.fetch = async () => new Response(sentinel + env.GEMINI_API_KEY, { status: providerStatus });
      assert.equal((await sandbox.api.handleVisionIdentify(makeRequest(), env)).status, expected);
    });
  }
  await check('timeout returns 504', async () => {
    sandbox.fetch = async () => { throw Object.assign(new Error(sentinel), { name: 'AbortError' }); };
    assert.equal((await sandbox.api.handleVisionIdentify(makeRequest(), env)).status, 504);
  });
  await check('invalid and blocked model output return 502 without being logged', async () => {
    for (const payload of [{ candidates: [{ content: { parts: [{ text: sentinel }] } }] }, { promptFeedback: { blockReason: sentinel } }]) {
      sandbox.fetch = async () => new Response(JSON.stringify(payload));
      assert.equal((await sandbox.api.handleVisionIdentify(makeRequest(), env)).status, 502);
    }
  });
  await check('local Lens opt-in remains available without a Gemini key', async () => {
    sandbox.fetch = async (url, options) => {
      assert.equal(url, 'https://local.test/v1/structured');
      assert.equal(JSON.parse(options.body).specialist.type, 'fishial');
      return new Response(JSON.stringify({ ok: true, result }));
    };
    assert.equal((await sandbox.api.handleVisionIdentify(makeRequest(), { ...env, LENS_AI_PROVIDER: 'local', GEMINI_API_KEY: '' })).status, 200);
  });
  await check('text and PDF itinerary requests still use the local host', async () => {
    for (const body of [{ text: sentinel }, { pdfBase64: sentinel }]) {
      sandbox.fetch = async (url) => {
        assert.equal(url, `https://local.test/v1/${body.pdfBase64 ? 'document' : 'structured'}`);
        return new Response(JSON.stringify({ ok: true, result: { items: [] } }));
      };
      const request = new Request('https://dmz.test/api/planner/itinerary/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal((await sandbox.api.handleItineraryImport(request, env)).status, 200);
    }
  });
  await check('diagnostics contain no key, request payload or provider output', async () => {
    const text = logs.join('\n');
    assert.ok(!text.includes(sentinel));
    assert.ok(!text.includes(env.GEMINI_API_KEY));
    assert.ok(!text.includes(env.LOCAL_AI_SHARED_SECRET));
    assert.ok(!text.includes(result.description));
  });
  console.log(`Gemini Lens checks passed: ${checks}/${checks}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
