const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'workers/dmz-account-sync/src/index.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'workers/dmz-account-sync/schema.sql'), 'utf8');
const db = new DatabaseSync(':memory:'); db.exec(sql);
const env = { DB: { prepare(query) { return { bind(...args) {
  return { first: async () => db.prepare(query).get(...args), all: async () => ({ results:db.prepare(query).all(...args) }),
    run: async () => ({ meta:{ changes:db.prepare(query).run(...args).changes } }) };
} }; } } };
let authCalls = 0;
env.ACCOUNT_API = { async fetch(request) {
  authCalls++;
  assert.equal(new URL(request.url).pathname, '/api/account');
  const user = request.headers.get('Authorization').slice(7);
  return new Response(JSON.stringify({ ok:user !== 'inactive',profile:{ userId:user } }), { status:user === 'inactive' ? 403 : 200 });
} };
(async () => {
  const { handle } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const request = (user,route = '',body) => handle(new Request(`https://dev.test/api/account/sync${route}`, {
    method:body ? 'PUT' : 'GET', headers:user ? { Authorization:`Bearer ${user}` } : {}, ...(body ? { body:JSON.stringify(body) } : {}),
  }), env);
  const payload = (revision, mutationId, name = 'Blue Hole', deleted = false) => ({ baseRevision:revision, mutationId,deleted,data:{ id:'dive-1',site:{ name } } });
  assert.equal((await request(null)).status,401);
  assert.equal(authCalls,0,'requests without a bearer token must not call the account service');
  assert.equal((await request('inactive')).status,403);
  assert.equal((await request('alice','/dive/dive-1',payload(0,'a'))).status,200);
  assert.equal((await request('bob','/dive/dive-1')).status,404);
  assert.deepEqual((await (await request('bob')).json()).records,[]);
  assert.equal((await request('alice','/dive/dive-1',payload(1,'b','Updated'))).status,200);
  assert.equal((await request('alice','/dive/dive-1',payload(1,'stale','Lost change'))).status,409);
  const retry = await (await request('alice','/dive/dive-1',payload(1,'b','Updated'))).json();
  assert.equal(retry.record.revision,2,'retry must not create a new revision');
  const simultaneous = await Promise.all(['one','two'].map((id) => request('alice','/dive/dive-1',payload(2,id,id))));
  assert.deepEqual(simultaneous.map((r) => r.status).sort(),[200,409]);
  assert.equal((await request('alice','/dive/dive-1',payload(3,'delete','Deleted',true))).status,200);
  assert.equal((await request('alice','/dive/dive-1',payload(2,'resurrect'))).status,409);
  assert.equal((await (await request('alice')).json()).records[0].deleted,true);
  assert.equal((await request('alice','/dive/dive-1',{ ...payload(4,'wrong'),data:{ id:'wrong-id' } })).status,400);
  assert.equal((await request('alice','/dive/dive-1',payload(4,'huge','x'.repeat(1600000)))).status,413);
  assert.equal((await request('bob','/dive/dive-1',{ ...payload(0,'other'),userId:'alice' })).status,200);
  assert.equal((await (await request('alice','/dive/dive-1')).json()).record.deleted,true,'body owner cannot target another account');
  // Bulk read: records with data, paged, one account verification per page, never another owner's rows.
  const put = (user, kind, id, data) => request(user, `/${kind}/${id}`, { baseRevision:0, mutationId:`m-${kind}-${id}`, deleted:false, data:{ id, ...data } });
  for (let i = 0; i < 260; i++) await put('carol', 'dive', `d${String(i).padStart(3, '0')}`, { site:{ name:`Site ${i}` } });
  await put('carol', 'gear', 'bcd', { name:'BCD' });
  await put('carol', 'computerLog', 'log-1', { profile:{ samples:[] } });
  await put('carol', 'dive', 'gone', { site:{ name:'Deleted' } });
  await request('carol', '/dive/gone', { baseRevision:1, mutationId:'m-gone-del', deleted:true, data:{ id:'gone' } });
  assert.equal((await request('carol', '?include=bogus')).status, 400);
  const bulk = []; let after = '', pages = 0;
  const before = authCalls;
  do {
    const page = await (await request('carol', `?include=dive,gear,setup${after ? `&after=${encodeURIComponent(after)}` : ''}`)).json();
    bulk.push(...page.records); after = page.next; pages++;
  } while (after);
  assert.equal(authCalls - before, pages, 'one account verification per page, not per record');
  assert.equal(pages, 2);
  assert.equal(bulk.length, 262, 'every dive (including the tombstone) and gear item, no computer logs');
  assert.ok(bulk.every((row) => row.kind !== 'computerLog'));
  assert.equal(bulk.find((row) => row.id === 'd123').data.site.name, 'Site 123');
  assert.deepEqual(bulk.filter((row) => row.deleted).map((row) => [row.id, row.data]), [['gone', null]]);
  assert.equal(new Set(bulk.map((row) => `${row.kind}/${row.id}`)).size, bulk.length, 'pages never overlap');
  assert.deepEqual((await (await request('bob', '?include=dive,gear')).json()).records.map((row) => row.id), ['dive-1'], 'bulk reads stay within the owner');
  console.log('PASS: authentication, inactive accounts, owner isolation, forged owners, atomic conflicts, retries, tombstones, validation, body limits, and bulk paged reads.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
