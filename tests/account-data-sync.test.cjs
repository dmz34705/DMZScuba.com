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
  console.log('PASS: authentication, inactive accounts, owner isolation, forged owners, atomic conflicts, retries, tombstones, validation, and body limits.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
