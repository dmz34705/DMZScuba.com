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

Source of truth: `src/index.js`.

## Auth Model

- Admin auth route: `POST /api/admin/login`
- Valid credentials: `ADMIN_USER` + `ADMIN_PASS`
- On success, Worker issues a token and stores it in `admin_sessions`
- Token lifetime: 24 hours
- Admin routes require header: `Authorization: Bearer <token>`

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
  - Accepts lightweight client error events
  - Current usage: contact submit failures and media upload failures
  - Logs structured telemetry to Worker logs

- `GET /api/v2/destinations`
  - Returns destination v2 collection payload

- `GET /api/v2/destinations/:id`
  - Returns one destination v2 record

### Admin

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

Run `schema.sql` when initializing D1.

Primary tables:
- `media_items`
- `admin_sessions`
- `destinations_v2`

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
- `CF_IMAGES_ACCOUNT_ID` (falls back to `CF_ACCOUNT_ID`)
- `RESEND_TEMPLATE_GENERAL_INQUIRY`
- `RESEND_TEMPLATE_INTEREST_DEFAULT`
- `RESEND_TEMPLATE_COZUMEL`
- `RESEND_TEMPLATE_HAIGH`
- `RESEND_TEMPLATE_KEY_LARGO`
- `RESEND_TEMPLATE_MERMET`
- `RESEND_TEMPLATE_PLAYA`
- `RESEND_TEMPLATE_ROATAN`
- `RESEND_TEMPLATE_CATALINA`

## Deploy

From repo root:

```powershell
./Deploy Worker.bat
```

This runs `npx wrangler deploy` in `workers/dmz-media-api`.

