# DMZScuba.com

DMZ Scuba is a static multi-page site deployed on Cloudflare Pages, backed by a Cloudflare Worker API for media management, destination management, admin auth, Cloudflare Stream/Images integrations, and contact form delivery.

## Status Snapshot (February 9, 2026)

Project maturity: late pre-launch, functional and actively refined.

Current strengths:
- Public site structure is stable across Home, Training, Travel, Media, Contact, About, and Thanks.
- Worker API is live for media, contact, destination v2, admin auth, Stream uploads, and Cloudflare Images uploads.
- Media page now supports both classic gallery and Reel Mode with infinite scroll and autoplay behavior.
- Media admin supports parallel Stream uploads and draft/publish workflow.
- Destination editors are in place for both travel listing and destination detail content.

Primary remaining risk areas:
- No automated test suite (regression risk is manual QA only).
- Some pages call a hardcoded Worker URL while others use same-origin `/api` proxy behavior.
- Worker docs (`workers/dmz-media-api/README.md`) are behind current endpoint surface.

## Architecture

Frontend:
- Static HTML/CSS/JS in `index.html`, `pages/**`, `css/**`, `js/**`.
- No bundler and no framework runtime.
- Works from static hosting and local Python static server.

Backend:
- Cloudflare Worker in `workers/dmz-media-api/src/index.js`.
- Pages Function proxy in `functions/api/[[path]].js` forwards `/api/*` to Worker origin.
- D1 database bound as `DB`.

Storage/Services:
- Cloudflare Stream: video uploads and playback IDs.
- Cloudflare Images: destination image uploads/deletes.
- Resend: contact and interest-list email automation.

## Repository Layout

- `index.html`: homepage.
- `pages/media/index.html`: media gallery + reel mode + media admin UI shell.
- `pages/travel/index.html`: travel overview + destination admin list editor.
- `pages/travel/destination.html`: destination detail + inline destination admin editor.
- `pages/contact/index.html`: contact/lead funnel form.
- `pages/training/**`: training and course content pages.
- `js/main.js`: shared UX and form submit helpers.
- `js/media.js`: media rendering, filtering, sorting, reel mode, public player behavior.
- `js/media-edit.js`: media admin auth/edit/publish/parallel upload tooling.
- `js/travel-admin.js`: travel destination admin panel logic.
- `js/destination.js`: destination detail page rendering + admin editing.
- `workers/dmz-media-api/src/index.js`: Worker routes and handlers.
- `workers/dmz-media-api/schema.sql`: D1 schema baseline.
- `workers/dmz-media-api/wrangler.toml`: Worker config and vars.
- `functions/api/[[path]].js`: Pages-side API proxy to Worker.
- `assets/data/media.json`: media fallback source when `/api/media` is unavailable.

## Media System Analysis

Public media (`js/media.js`):
- Loads data from `/api/media` with fallback to `assets/data/media.json`.
- Supports filter chips, tag filters, location filters, search, and sort.
- Uses masonry-style layout recalculation and thumbnail aspect handling.
- Handles YouTube, Stream, local video, and image cards.

Reel Mode (`js/media.js` + `css/pages/media.css`):
- Toggle button: `#mediaReelModeToggle`.
- Fullscreen mobile behavior with safe-area and Safari viewport handling.
- Desktop behavior uses centered vertical-card presentation.
- Infinite feed appends in batches as user scrolls.
- Active card autoplay/pause behavior as cards enter/leave active viewport.
- Local/Stream video playback via native video element (Stream via HLS with `hls.js` fallback when needed).
- YouTube playback via API-controlled iframe mount/unmount.
- Sound model includes explicit user gesture unlock.
- Reel sequence now randomizes when opening reel mode and when reel items are refreshed from active filters.

Media admin (`js/media-edit.js`):
- Admin token via `sessionStorage` key `dmzMediaToken`.
- Draft state via `localStorage` key `dmzMediaDraft`.
- Edit mode supports inline title/description plus modal editing for full fields.
- Publish pushes full upsert payload to `/api/admin/media-bulk`.
- Stream upload queue supports parallel background uploads (`maxConcurrent: 3`).
- Upload can be queued while continuing to add/edit more items.
- Per-card upload status overlays now show queued/progress/retry/success/fail on media preview cards during edit mode.

## Destination System Analysis

Travel destination data:
- Public reads from `GET /api/v2/destinations` and `GET /api/v2/destinations/:id`.
- Admin writes through `PUT /api/admin/v2/destinations/:id` and delete through `DELETE /api/admin/v2/destinations/:id`.
- Worker includes migration/bootstrap support for `destinations_v2`.

Admin UX:
- `js/travel-admin.js`: manages destination list editing (travel page context).
- `js/destination.js`: manages destination detail editing, highlight cards, hero/isometric image operations, and save workflow.
- Destination admin also reuses `dmzMediaToken` auth session.

## Contact/Lead Flow Analysis

Frontend:
- `js/main.js` normalizes form fields and submits JSON payload to `/api/contact` (or `data-contact-api` override).
- Supports quick contact and dive-now form patterns.
- Includes honeypot handling and UX toast feedback.

Backend:
- `POST /api/contact` sends internal notifications and optional user auto-replies via Resend.
- Interest-list routing supports destination-specific templates (with fallback behavior).

## Worker API Surface

Public:
- `GET /api/media`
- `POST /api/contact`
- `GET /api/v2/destinations`
- `GET /api/v2/destinations/:id`

Admin:
- `POST /api/admin/login`
- `POST /api/admin/stream-direct-upload`
- `POST /api/admin/stream-tus-upload`
- `POST /api/admin/stream-date-sync`
- `POST /api/admin/images-direct-upload`
- `POST /api/admin/images-delete`
- `POST /api/admin/media`
- `PUT /api/admin/media/:id`
- `DELETE /api/admin/media/:id`
- `PUT /api/admin/media-bulk`
- `PUT /api/admin/v2/destinations/:id`
- `DELETE /api/admin/v2/destinations/:id`

## Data Model (D1)

Core tables from `workers/dmz-media-api/schema.sql`:
- `media_items`
- `admin_sessions`
- `destinations_v2`
- legacy destination tables (`destinations`, `destinations_base`, `destinations_expanded`) remain present for historical compatibility.

## Environment Configuration (Worker)

Expected vars/secrets include:
- `ADMIN_USER`
- `ADMIN_PASS`
- `ALLOWED_ORIGINS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `RESEND_TO`
- `RESEND_TEMPLATE_GENERAL_INQUIRY` (optional)
- `RESEND_TEMPLATE_INTEREST_DEFAULT` (optional)
- `RESEND_TEMPLATE_COZUMEL` (optional)
- `RESEND_TEMPLATE_HAIGH` (optional)
- `RESEND_TEMPLATE_KEY_LARGO` (optional)
- `RESEND_TEMPLATE_MERMET` (optional)
- `RESEND_TEMPLATE_PLAYA` (optional)
- `RESEND_TEMPLATE_ROATAN` (optional)
- `RESEND_TEMPLATE_CATALINA` (optional)
- `CF_ACCOUNT_ID`
- `CF_STREAM_TOKEN`
- `CF_IMAGES_TOKEN`
- `CF_IMAGES_ACCOUNT_ID` (optional if using `CF_ACCOUNT_ID`)
- `CF_IMAGES_DELIVERY`
- `CF_IMAGES_VARIANT`

## Local Development

Static site:
1. Run `Python Server.bat`.
2. Open `http://localhost:8080`.

Optional tunnel:
1. Run `Pcloudfare.bat`.
2. Use the generated `trycloudflare.com` URL for remote device testing.

Worker:
1. Open `workers/dmz-media-api`.
2. Run Wrangler commands directly or use `Deploy Worker.bat` from repo root.

Smoke checks:
1. Run `Smoke Check.bat <base-url>`.
2. Example: `Smoke Check.bat https://dmzscuba-com.pages.dev`

Media logic unit tests:
1. Run `Test Media Logic.bat`

## Deployment Workflow

Static site (Cloudflare Pages):
1. Commit and push to `main`.
2. Cloudflare Pages deploys automatically from GitHub.

Worker API:
1. Run `Deploy Worker.bat` (executes `npx wrangler deploy` in worker directory).
2. Validate critical endpoints (`/api/media`, `/api/contact`, admin login, upload init routes).

## Operational Notes

- API proxy behavior:
  - Same-origin `/api/*` requests are supported by `functions/api/[[path]].js`.
  - Some pages still set `data-contact-api` to direct Worker domain; this is functional but should be standardized.
- Media fallback behavior:
  - If `/api/media` is unavailable, media page falls back to `assets/data/media.json`.
- Admin sessions:
  - Worker login creates 24-hour token entries in `admin_sessions`.
- Draft behavior:
  - Media edits persist locally until publish/reset.

## Quality and Risk Summary

High priority:
1. Add automated smoke checks for forms and API availability.
2. Standardize API base usage across all pages (`/api` proxy vs hardcoded Worker URL).
3. Update Worker-level README to match current endpoint and destination v2 functionality.

Medium priority:
1. Add basic unit coverage for media filter/sort/reel selection logic.
2. Add a release checklist for media admin publish and destination publish.
3. Add structured error telemetry for failed uploads and failed contact sends.

Low priority:
1. Remove stale comments/legacy references once migration is finalized.
2. Consolidate duplicated admin-login modal logic across admin scripts.

## Maintainer Notes

- Windows helper scripts in repo root are part of the active workflow (`push.bat`, `Deploy Worker.bat`, `Python Server.bat`, `Pcloudfare.bat`).
- `AGENTS.md` documents assistant workflow expectations for this repo.
- `RELEASE-CHECKLIST.md` is the operational release gate for dev and live promotions.
- Keep `assets/data/media.json` viable as a fallback snapshot even when API is primary.
