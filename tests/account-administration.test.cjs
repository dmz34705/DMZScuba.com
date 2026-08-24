const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
assert.match(accountsClient, /Professional/);
assert.match(accountsClient, /Employee/);
assert.match(accountsClient, /Administrator/);
assert.match(accountsClient, /Type the duplicate email to confirm/);

console.log("Account administration foundation is present and guarded.");
