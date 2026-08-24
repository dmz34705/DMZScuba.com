const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

const root = path.resolve(__dirname, "..");
const workerPath = path.join(root, "workers", "dmz-media-api", "src", "index.js");
const workerSource = fs.readFileSync(workerPath, "utf8");
const workerModulePromise = import(`data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`);

test("public registration snapshots contain counts but no customer PII", async () => {
  const { buildPublicRegistrationSnapshot } = await workerModulePromise;
  const result = buildPublicRegistrationSnapshot({
    sourceId: "lake-day",
    eventDate: "2026-09-12",
    registrationEnabled: true,
    registrationClosed: false,
    registrationCapacity: 12,
    usedSpots: 3,
    remainingSpots: 9,
    registrants: [{ name: "Private Diver", email: "private@example.com", phone: "555-1212" }],
    registeredDivers: [{ name: "Private Diver" }],
  });

  assert.deepEqual(result, {
    sourceId: "lake-day",
    eventDate: "2026-09-12",
    registrationEnabled: true,
    registrationClosed: false,
    registrationCapacity: 12,
    usedSpots: 3,
    remainingSpots: 9,
  });
  assert.equal(JSON.stringify(result).includes("private@example.com"), false);
  assert.equal(Object.hasOwn(result, "registrants"), false);
  assert.equal(Object.hasOwn(result, "registeredDivers"), false);
});

test("Supabase claims produce the stable customer identity", async () => {
  const { validateSupabaseClaims } = await workerModulePromise;
  const identity = validateSupabaseClaims(
    {
      iss: "https://project.supabase.co/auth/v1",
      aud: "authenticated",
      exp: 2_000_000_000,
      sub: "19f3ec36-f314-4fea-ae98-809b997d17aa",
      role: "authenticated",
      email: "Diver@Example.com",
      session_id: "session-1",
      aal: "aal1",
      user_metadata: { first_name: "Alex" },
    },
    { issuer: "https://project.supabase.co/auth/v1", audience: "authenticated" },
    1_900_000_000
  );

  assert.equal(identity.userId, "19f3ec36-f314-4fea-ae98-809b997d17aa");
  assert.equal(identity.email, "diver@example.com");
  assert.equal(identity.userMetadata.first_name, "Alex");
});

test("Supabase claims reject expired, anonymous, and wrong-audience tokens", async () => {
  const { validateSupabaseClaims } = await workerModulePromise;
  const base = {
    iss: "https://project.supabase.co/auth/v1",
    aud: "authenticated",
    exp: 2_000_000_000,
    sub: "user-1",
    role: "authenticated",
    email: "diver@example.com",
  };
  const options = { issuer: "https://project.supabase.co/auth/v1", audience: "authenticated" };

  assert.throws(() => validateSupabaseClaims({ ...base, exp: 100 }, options, 101), /expired/i);
  assert.throws(() => validateSupabaseClaims({ ...base, is_anonymous: true }, options, 100), /invalid/i);
  assert.throws(() => validateSupabaseClaims({ ...base, aud: "service_role" }, options, 100), /invalid/i);
});

test("Worker verifies a signed Supabase ES256 access token against JWKS", async () => {
  const { verifySupabaseAccessToken } = await workerModulePromise;
  const subtle = globalThis.crypto.subtle;
  const keyPair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await subtle.exportKey("jwk", keyPair.publicKey);
  Object.assign(publicJwk, { kid: "test-key", alg: "ES256", use: "sig" });
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "ES256", kid: "test-key", typ: "JWT" });
  const payload = encode({
    iss: "https://signed-test.supabase.co/auth/v1",
    aud: "authenticated",
    exp: 2_000_000_000,
    iat: 1_700_000_000,
    sub: "signed-user",
    role: "authenticated",
    email: "signed@example.com",
  });
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    Buffer.from(`${header}.${payload}`)
  );
  const jwt = `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  try {
    const identity = await verifySupabaseAccessToken(jwt, {
      SUPABASE_URL: "https://signed-test.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    assert.equal(identity.userId, "signed-user");
    assert.equal(identity.email, "signed@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account portal stays disabled until Supabase and Turnstile are configured", async () => {
  const worker = await workerModulePromise;
  const request = new Request("https://dmzscuba.com/api/account/auth/status", { method: "GET" });
  const response = await worker.default.fetch(request, {}, { waitUntil() {} });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.enabled, false);

  const configured = await worker.default.fetch(request, {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    TURNSTILE_SITE_KEY: "0x4AAAA-test",
  }, { waitUntil() {} });
  const configuredData = await configured.json();
  assert.equal(configuredData.enabled, true);
  assert.equal(configuredData.turnstileSiteKey, "0x4AAAA-test");
});

test("customer account and credential endpoints reject requests without a JWT", async () => {
  const worker = await workerModulePromise;
  const requests = [
    new Request("https://dmzscuba.com/api/account", { method: "GET" }),
    new Request("https://dmzscuba.com/api/account/auth/password", { method: "PUT" }),
    new Request("https://dmzscuba.com/api/account/auth/email", { method: "PUT" }),
    new Request("https://dmzscuba.com/api/account/auth/email/verify", { method: "POST" }),
  ];
  for (const request of requests) {
    const response = await worker.default.fetch(request, {}, { waitUntil() {} });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "Sign in is required." });
  }
});

test("account migration and page include the required foundation", () => {
  const migration = fs.readFileSync(path.join(root, "workers", "dmz-media-api", "migrations", "0002_create_customer_accounts.sql"), "utf8");
  const page = fs.readFileSync(path.join(root, "pages", "account", "index.html"), "utf8");
  const client = fs.readFileSync(path.join(root, "js", "account.js"), "utf8");

  for (const table of ["customer_profiles", "customer_roles", "customer_certifications", "customer_reservations", "customer_documents", "customer_audit_log"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /ALTER TABLE event_registrations_v2 ADD COLUMN user_id/);
  assert.match(page, /data-signup-form/);
  assert.match(page, /data-turnstile="signup"/);
  assert.match(page, /data-change-password-form/);
  assert.match(page, /data-change-email-form/);
  assert.match(page, /data-current-email-code-form/);
  assert.match(page, /data-new-email-code-form/);
  assert.match(page, /data-account-created/);
  for (const view of ["home", "profile", "certifications", "activity", "security"]) {
    assert.match(page, new RegExp(`data-account-view-panel="${view}"`));
  }
  assert.match(client, /dmzCustomerAccessToken/);
  assert.match(client, /\/api\/account\/link-existing/);
  assert.match(client, /\/api\/account\/auth\/email\/verify/);
  assert.match(client, /showAccountCreated/);
  assert.match(client, /Your account is ready\. Welcome to DMZ Scuba\./);
  assert.match(workerSource, /current_password/);
  assert.match(workerSource, /type: "email_change"/);
});

(async () => {
  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      console.error(`FAIL ${entry.name}`);
      throw error;
    }
  }
  console.log("All customer account tests passed.");
})();
