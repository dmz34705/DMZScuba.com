# DMZ Media API (Cloudflare Worker)

Cloudflare Worker backend for DMZ Scuba media, contact forms, and destination v2 content.

This service handles:
- Public media reads
- Contact/interest-list form delivery through Resend
- Admin authentication and session tokens
- Media CRUD + bulk publish to D1
- Cloudflare Stream upload helpers
- Cloudflare Images upload/delete helpers
- Destination v2 read/write/delete APIs
- Customer signup, verified-email login, profiles, certifications, and linked reservations

Source of truth: `src/index.js`.

## Auth Model

- Admin auth route: `POST /api/admin/login`
- Valid credentials: `ADMIN_USER` + `ADMIN_PASS`
- On success, Worker issues a token and stores it in `admin_sessions`
- Token lifetime: 24 hours
- Admin routes require header: `Authorization: Bearer <token>`

Customer authentication also provides role-based management access while the legacy admin login remains available during the transition:

- Supabase Auth owns customer credentials, verification codes, password recovery, and refresh tokens.
- The website receives the refresh token only as an HTTP-only, same-site cookie.
- Customer API routes require a short-lived Supabase JWT in `Authorization: Bearer <token>`.
- The Worker verifies the JWT signature against Supabase's JWKS endpoint and uses its `sub` claim as the D1 customer ID.
- D1 never stores customer passwords or Supabase refresh tokens.
- Every account keeps the baseline `customer` role and may also have `instructor` (Professional), `staff` (Employee), or `admin` (Administrator).
- Employee and Administrator accounts can use their normal customer session in the management console. Only Administrators can change roles, deactivate accounts, or merge duplicates.
- D1 account status is checked on login, refresh, customer-data routes, and authenticated registration requests.

## API Routes

### Public

- `GET /api/media`
  - Returns `{ mediaItems, photoItems }`
  - Reads from `media_items` table

- `POST /api/contact`
  - Accepts form payload from site forms
  - Sends internal notifications via Resend
  - Sends user auto-replies (general inquiry or interest-list templates/fallback)

- `POST /api/client-telemetry`
  - Accepts lightweight client operational and training-funnel events from approved site origins
  - Logs sanitized structured telemetry to Worker logs
  - Persists only the approved `training_*` funnel events to D1 with an explicit field allowlist
  - Does not persist full query strings, IP addresses, user-agent strings, form contents, or direct customer identifiers

- `GET /api/v2/destinations`
  - Returns destination v2 collection payload

- `GET /api/v2/destinations/:id`
  - Returns one destination v2 record

- `GET /api/account/auth/status`
  - Reports whether customer authentication has been configured

- `POST /api/account/auth/signup`
- `POST /api/account/auth/verify`
- `POST /api/account/auth/login`
- `POST /api/account/auth/refresh`
- `POST /api/account/auth/logout`
- `POST /api/account/auth/recover`
  - Customer authentication proxy endpoints; refresh tokens are delivered only by HTTP-only cookie

### Customer

- `GET /api/account`
  - Returns the signed-in customer's profile, roles, certifications, registrations, and reservations
- `PUT /api/account`
  - Updates the signed-in customer's allowed profile fields
- `POST /api/account/link-existing`
  - Connects existing records that exactly match the customer's verified email
- `POST /api/account/certifications`
- `PUT /api/account/certifications/:id`
- `DELETE /api/account/certifications/:id`
  - Manages customer-owned certifications; edited certifications return to pending verification
- `PUT /api/account/auth/password`
  - Updates the signed-in customer's password through Supabase

### Admin

- `GET /api/admin/access`
  - Validates Employee or Administrator access for a signed-in DMZ account

- `GET /api/admin/accounts`
- `PUT /api/admin/accounts/:userId/roles`
- `POST /api/admin/accounts/:userId/deactivate`
- `POST /api/admin/accounts/:userId/reactivate`
- `POST /api/admin/accounts/merge`
  - Administrator-only account management; merges move connected business history to the surviving account and disable the duplicate login

- `POST /api/admin/login`
  - Body: `{ "user": "...", "pass": "..." }`
  - Response: `{ ok, token }` on success

- `POST /api/admin/media`
  - Create media item in `media_items`

- `PUT /api/admin/media/:id`
  - Update media item

- `DELETE /api/admin/media/:id`
  - Delete media item

- `PUT /api/admin/media-bulk`
  - Bulk upsert media publish payload
  - Supports delete by item id and optional Stream delete list

- `POST /api/admin/stream-direct-upload`
  - Returns Cloudflare Stream direct upload URL

- `POST /api/admin/stream-tus-upload`
  - Initializes resumable Stream upload and returns upload URL + uid

- `POST /api/admin/stream-date-sync`
  - Syncs media `created_at` from Stream metadata where available

- `POST /api/admin/images-direct-upload`
  - Returns Cloudflare Images direct upload URL

- `POST /api/admin/images-delete`
  - Deletes Cloudflare Images asset by id

- `PUT /api/admin/v2/destinations/:id`
  - Upsert destination v2 record

- `DELETE /api/admin/v2/destinations/:id`
  - Delete destination v2 record

## CORS

- CORS headers are applied on all responses
- Allowed origins are resolved from:
  - local development origins
  - Pages dev/tunnel hostnames
  - `dmzscuba.com` domains
  - `ALLOWED_ORIGINS` env var fallback

## D1 Schema

Run `schema.sql` only when initializing a new D1 database. Apply numbered migrations to an existing database.

Primary tables:
- `media_items`
- `admin_sessions`
- `destinations_v2`
- `funnel_events`
- `customer_profiles`
- `customer_roles`
- `customer_certifications`
- `customer_reservations`
- `customer_documents`
- `customer_audit_log`

Legacy compatibility tables also exist in schema:
- `destinations`
- `destinations_base`
- `destinations_expanded`

## Environment Variables

### Required (core auth/media)

- `ADMIN_USER`
- `ADMIN_PASS`
- `CF_ACCOUNT_ID`
- `CF_STREAM_TOKEN`

### Required (email/contact flow)

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `RESEND_TO`

### Required (images flow)

- `CF_IMAGES_TOKEN`
- `CF_IMAGES_DELIVERY`
- `CF_IMAGES_VARIANT`

### Optional

- `ALLOWED_ORIGINS`
- `SUPABASE_URL` (required to enable customer accounts)
- `SUPABASE_PUBLISHABLE_KEY` (required to enable customer accounts; never use the service-role key)
- `SUPABASE_JWT_AUDIENCE` (defaults to `authenticated`)
- `TURNSTILE_SITE_KEY` (required to enable customer signup, login, and recovery)
- `FUNNEL_RETENTION_DAYS` (defaults to `400` and is constrained to 30–730 days)
- `CF_IMAGES_ACCOUNT_ID` (falls back to `CF_ACCOUNT_ID`)
- `RESEND_TEMPLATE_GENERAL_INQUIRY`
- `RESEND_TEMPLATE_QUIZ_RESULTS` (falls back to `a2b38bfb-89a1-41e4-99f9-9a95063a3cf1` if unset)
- `RESEND_TEMPLATE_INTEREST_DEFAULT`
- `RESEND_TEMPLATE_COZUMEL`
- `RESEND_TEMPLATE_HAIGH`
- `RESEND_TEMPLATE_KEY_LARGO`
- `RESEND_TEMPLATE_MERMET`
- `RESEND_TEMPLATE_PLAYA`
- `RESEND_TEMPLATE_ROATAN`
- `RESEND_TEMPLATE_CATALINA`

## Deploy

Authenticate Wrangler, then apply pending D1 migrations before deploying Worker code. From `workers/dmz-media-api`:

```powershell
npx wrangler login
npx wrangler d1 migrations apply dmz_media --remote
npx wrangler deploy
```

The scheduled Worker trigger runs daily and removes `funnel_events` rows older than `FUNNEL_RETENTION_DAYS`.

For a fresh local validation database:

```powershell
npx wrangler d1 migrations apply dmz_media --local
```

From the repository root, the final deploy command can also be run through:

```powershell
./Deploy Worker.bat
```

This runs `npx wrangler deploy` in `workers/dmz-media-api`.

The dev and live site repositories currently use the same Worker name and D1 database ID. Apply the migration and deploy the Worker once, even when the matching source change is committed to both repositories.

