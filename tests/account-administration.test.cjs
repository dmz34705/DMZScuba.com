const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const migration = read("workers", "dmz-media-api", "migrations", "0003_customer_account_administration.sql");
const worker = read("workers", "dmz-media-api", "src", "index.js");
const accountPage = read("pages", "account", "index.html");
const accountClient = read("js", "account.js");
const managementPage = read("management", "index.html");
const managementClient = read("js", "management.js");
const accountsClient = read("js", "management-accounts.js");

assert.match(migration, /account_status TEXT NOT NULL DEFAULT 'active'/);
assert.match(migration, /merged_into_user_id/);
assert.match(worker, /requireManagementIdentity\(request, env, true\)/);
assert.match(worker, /hasLegacyAdminSession/);
assert.match(worker, /authMode: auth\.legacy \? "legacy" : "account"/);
assert.match(worker, /Administrator access is required/);
assert.match(worker, /You cannot deactivate your own account/);
assert.match(worker, /Remove Administrator access from the duplicate account before merging it/);
for (const table of ["event_registrations_v2", "customer_certifications", "customer_reservations", "customer_documents", "management_records"]) {
  assert.match(worker, new RegExp(`UPDATE ${table}`));
}
for (const route of ["/api/admin/access", "/api/admin/accounts", "/api/admin/accounts/merge"]) {
  assert.ok(worker.includes(route), `missing ${route}`);
}

assert.match(accountPage, /data-management-access hidden/);
assert.match(accountClient, /role === "staff" \|\| role === "admin"/);
assert.match(managementPage, /data-site-studio-tab="accounts"/);
assert.match(managementPage, /data-account-detail/);
assert.match(managementClient, /dmzCustomerAccessToken/);
assert.match(managementClient, /validateManagementAccess/);
assert.match(managementClient, /openSiteStudioPanel\("home"\)/);
assert.match(accountsClient, /Professional/);
assert.match(accountsClient, /Employee/);
assert.match(accountsClient, /Administrator/);
assert.match(accountsClient, /Type the duplicate email to confirm/);

console.log("Account administration foundation is present and guarded.");

test("the previous admin session receives transitional Administrator access", async () => {
  const module = await import(`data:text/javascript;base64,${Buffer.from(worker).toString("base64")}`);
  const DB = {
    prepare(sql) {
      assert.match(sql, /admin_sessions/);
      return {
        bind() { return this; },
        async first() { return { token: "legacy-session" }; },
      };
    },
  };
  const response = await module.default.fetch(new Request("https://dmzscuba.com/api/admin/access", {
    headers: { Authorization: "Bearer legacy-session" },
  }), { DB }, { waitUntil() {} });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.isAdministrator, true);
  assert.equal(data.authMode, "legacy");
  assert.deepEqual(data.roles, ["staff", "admin"]);
});
