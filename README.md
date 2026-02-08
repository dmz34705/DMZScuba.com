# DMZScuba.com

DMZ Scuba is a static HTML/CSS/JS site deployed on Cloudflare Pages, with a Cloudflare Worker API (`workers/dmz-media-api`) for media, destination content, admin auth, image uploads, and contact form delivery.

## Go-Live Status (February 2026)

The site is in late pre-launch and very close to go-live.

Current production-ready areas:
- Destination pages are powered by Worker v2 destination APIs and editable via admin tools.
- Contact, Dive Now, Course Builder, and destination interest-list forms post to `/api/contact`.
- Resend automation is active for internal lead notifications and user confirmations.
- Destination-specific interest auto-replies are routed by template ID (Cozumel, Haigh, Key Largo, Mermet, Playa, Roatan, Catalina, default fallback).
- Media operations are active through Cloudflare Stream + Images + D1.

Final checks before launch:
- Run end-to-end submit tests on all primary forms from live Pages domain.
- Verify each destination template route and content in Resend.
- Verify sender setup and deliverability (SPF, DKIM, DMARC, inbox placement).
- Complete mobile and cross-browser QA on core pages.
- Complete final copy/link QA on destination detail pages.

## Current Architecture

- Frontend: static files in `index.html`, `pages/**`, `css/**`, `js/**`.
- Backend: Cloudflare Worker in `workers/dmz-media-api/src/index.js`.
- Database: Cloudflare D1 (`media_items`, `admin_sessions`, `destinations_v2`, plus legacy tables).
- Media storage: Cloudflare Stream for videos; Cloudflare Images for destination hero/isometric uploads.

## Repository Layout

- `index.html` Home page.
- `pages/travel/index.html`: Travel landing + globe + travel admin panel.
- `pages/travel/destination.html`: Destination detail page + destination admin panel.
- `pages/media/index.html`: Media library + filters + media admin integration.
- `pages/contact/index.html`: Contact forms posting to `/api/contact`.
- `pages/training/**`: Training pages.
- `pages/about/index.html`, `pages/thanks/index.html`.
- `js/main.js`: Shared site behavior + form submit helpers.
- `js/globe.js`: Travel globe rendering and destination selection.
- `js/travel-admin.js`: Travel page destination admin editor.
- `js/destination.js`: Destination page rendering + inline admin editor.
- `js/media.js`: Media page rendering, filters, sorting, embeds.
- `js/media-edit.js`: Media admin editor logic.
- `css/base.css`, `css/components.css`, `css/main.css`, `css/responsive.css`.
- `css/pages/*.css`: page-specific styles.
- `workers/dmz-media-api/src/index.js`: Worker routes + handlers.
- `workers/dmz-media-api/schema.sql`: D1 schema/migrations reference.
- `workers/dmz-media-api/wrangler.toml`: Worker config.
- `Python Server.bat`: local static preview at `http://localhost:8080`.
- `Pcloudfare.bat`: cloudflared tunnel to local preview.
- `Deploy Worker.bat`: deploys Worker via Wrangler.
- `push.bat`: pull/rebase, commit, and push helper.

## Active API Endpoints (Worker)

Source of truth: `workers/dmz-media-api/src/index.js`.

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

Notes:
- Legacy destination endpoints are intentionally not part of the active runtime flow.
- Destination pages/editors now read and write v2 destination payloads.

## Local Development

1. From repo root, run `Python Server.bat`.
2. Open `http://localhost:8080`.
3. Optional external access: run `Pcloudfare.bat`.

For local static styling/markup work, the Python server is enough.
For API changes, deploy or run Worker tooling in `workers/dmz-media-api`.

## Deploy Workflow

Static site (Cloudflare Pages):
1. Commit changes.
2. Push to GitHub `main`.
3. Cloudflare Pages deploy runs automatically.

Worker API:
1. Run `Deploy Worker.bat`.
2. Verify worker routes from the dev domain.

## Environment Variables (Worker)

Configured in Cloudflare Worker environment/secrets:

- `ADMIN_USER`
- `ADMIN_PASS`
- `ALLOWED_ORIGINS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `RESEND_TO`
- `RESEND_TEMPLATE_GENERAL_INQUIRY` (optional; fallback HTML is used if unset)
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

## Data and Legacy Notes

- `assets/data/media.json` is a fallback source if media API data is unavailable.
- `assets/data/destinations.json` and `assets/data/destinations-expanded.json` exist in repo but are not the primary live source for current destination pages.
- `js/globe - Copy.js` and `css/dmz_scuba_main_full.css` are legacy/unused artifacts.

## Project-Specific Notes

- Admin auth token is stored in `sessionStorage` key `dmzMediaToken`.
- Destination and travel admin editors are actively used for near-live content operations.
- `exports/` is a local working folder for manual JSON exports/import prep and is currently untracked.
