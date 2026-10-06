const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const root = path.join(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'src/app-layout.js'), 'utf8').replace('export function', 'function');
const worker = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/^export \{[\s\S]*?^\};/m, '').replace('export default', 'const worker =');
const sandbox = vm.createContext({ Response, Request, URL, Headers, TextEncoder, TextDecoder, console, crypto: require('node:crypto').webcrypto });
vm.runInContext(`${helper}\n${worker}\nrequireCustomerIdentity = async () => ({ identity: { userId: 'test-diver' } });\nglobalThis.api = { handleUpdateCustomerAppSettings, getCustomerAppSettings, normalizeCustomerLayout };`, sandbox);
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(path.join(root, 'migrations/0004_customer_app_settings.sql'), 'utf8'));
db.exec(fs.readFileSync(path.join(root, 'migrations/0010_customer_app_layout.sql'), 'utf8'));
const env = { DB: { prepare(sql) { return { bind(...params) { return { run: async () => db.prepare(sql).run(...params), first: async () => db.prepare(sql).get(...params) }; } }; } } };
const put = async settings => {
  const response = await sandbox.api.handleUpdateCustomerAppSettings(new Request('https://example.com/api/account/app-settings', { method: 'PUT', body: JSON.stringify({ settings }) }), env);
  assert.equal(response.status, 200);
  return (await response.json()).appSettings;
};
(async () => {
  const custom = { tools: ['dive-lens', 'unknown', 'dive-lens'], home: ['learning'], quickAccess: ['dive-log', 'color-loss'] };
  const saved = await put({ depthUnit: 'm', layout: custom });
  assert.equal(saved.layout.tools[0], 'dive-lens');
  assert.equal(saved.layout.home[0], 'learning');
  assert.deepEqual(saved.layout.quickAccess, ['dive-log', 'color-loss']);
  const legacy = await put({ depthUnit: 'ft' });
  assert.deepEqual(legacy.layout, saved.layout, 'An old client must preserve the saved layout.');
  const anotherDevice = await sandbox.api.getCustomerAppSettings(env, 'test-diver');
  assert.deepEqual(JSON.parse(JSON.stringify(anotherDevice.layout)), saved.layout);
  const empty = await put({ layout: { quickAccess: [] } });
  assert.deepEqual(empty.layout.quickAccess, []);
  db.close();
  const fresh = new DatabaseSync(':memory:');
  fresh.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
  assert.ok(fresh.prepare('PRAGMA table_info(customer_app_settings)').all().some(row => row.name === 'layout_json'));
  fresh.close();
  console.log('Account layout checks passed: migration, save/read, legacy clients, empty shortcuts and fresh schema.');
})().catch(error => { console.error(error); process.exitCode = 1; });
