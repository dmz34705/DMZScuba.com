# DMZScuba.com

DMZ Scuba is a static HTML/CSS/JS site with a Cloudflare Worker backend for the media library API and contact form email delivery (Resend). The site is hosted as static assets, and the Worker handles /api routes.

## Top-level
- `index.html` Home page.
- `push.bat` Git add/commit/push helper.
- `Python Server.bat` Run `python -m http.server 8080` in this folder for local preview.
- `Pcloudfare.bat` Run cloudflared tunnel to the local server.
- `README.md` This doc.

## Pages
- `pages/about/index.html` About page.
- `pages/contact/index.html` Contact page with Quick Contact + Dive Now forms; submits to `/api/contact`.
- `pages/thanks/index.html` Thank-you confirmation.
- `pages/media/index.html` Media library UI, filters, admin actions.
- `pages/travel/index.html` Travel landing with interactive globe and destination list.
- `pages/travel/destination.html` Destination detail page driven by `destinations.json` and `destinations-expanded.json`.
- `pages/training/index.html` Training landing page.
- `pages/training/course-builder/index.html` Course Builder form (also uses `/api/contact`).
- `pages/training/open-water/index.html` Open Water course page.
- `pages/training/advanced-specialty/index.html` Advanced Adventure course page.
- `pages/training/skill-refresh/index.html` Skill refresh page.
- `pages/training/specialty/index.html` Specialty landing page.
- `pages/training/specialty/drysuit/index.html` Drysuit specialty page.
- `pages/training/specialty/nitrox/index.html` Nitrox specialty page.
- `pages/training/specialty/wreck/index.html` Wreck specialty page.
- `pages/training/specialty/full-face-mask/index.html` Full Face Mask specialty page.
- `pages/training/Open Water Scuba Certification.txt` Copy draft for Open Water content.
- `pages/training/advanced specialties.txt` Copy draft for advanced/specialty content.

## Styles
- `css/base.css` Global tokens, resets, base layout.
- `css/components.css` Shared UI components, training content sections, CTA, hero variants.
- `css/main.css` Large theme file with home, contact, media, travel, and globe styles.
- `css/responsive.css` Breakpoints and mobile adjustments.
- `css/pages/*.css` Page-specific overrides.
- `css/dmz_scuba_main_full.css` Monolithic older/duplicate stylesheet; not referenced by any HTML file.

## Scripts
- `js/main.js` Global helpers (footer year, dropdowns, copy-to-clipboard, toast, form submit to `/api/contact`, URL prefill).
- `js/media.js` Media library rendering, filters, masonry layout, YouTube/Stream embeds, loads `/api/media` with local draft support. Falls back to `/assets/data/media.json` if API fails (file not present).
- `js/media-edit.js` Admin media editing, login, drag reorder, Stream direct upload, publish to `/api/admin/media-bulk`.
- `js/globe.js` Canvas globe renderer for Travel page with pin selection, zoom, and destination list.
- `js/globe - Copy.js` Unused earlier globe version (not referenced).
- `js/destination.js` Destination detail page renderer merging base/expanded destination JSON.
- `js/course-builder.js` Submits Course Builder form via `window.DMZForms.submit`.

## Data
- `assets/data/destinations.json` Primary destination dataset used by travel globe and destination pages.
- `assets/data/destinations-expanded.json` Additional long-form destination details for destination page.
- `assets/data/Add a pin.txt` Template for adding a destination entry.

## Assets
- `assets/icons/favicon.ico` Favicon. (Note: HTML references `/assets/icons/favicon.png`, which is not present.)
- `assets/images/...` Logos, hero backgrounds, globe textures, destination hero images, isometric resort images.
- `assets/media/thumbnails/Screenshot 2026-01-20 030957.png` Media thumbnail example. (No `assets/media` or `assets/media/photos` directories exist in the repo even though `js/media-edit.js` suggests those paths.)

## Worker backend
Location: `workers/dmz-media-api/`

- `src/index.js` Cloudflare Worker API:
  - `GET /api/media` -> media items from D1.
  - `POST /api/contact` -> sends email via Resend.
  - `POST /api/admin/login` -> session token stored in D1.
  - `POST /api/admin/stream-direct-upload` -> Cloudflare Stream direct upload URL.
  - `POST /api/admin/media` -> create media item (admin).
  - `PUT /api/admin/media/:id` -> update media item (admin).
  - `DELETE /api/admin/media/:id` -> delete media item (admin).
  - `PUT /api/admin/media-bulk` -> upsert list (admin).
- `schema.sql` D1 tables for `media_items` and `admin_sessions`.
- `wrangler.toml` Worker config, D1 binding, and Resend/allowed origin vars.
- `README.md` Worker overview (slightly outdated vs current endpoints).

## Local preview
- Run `Python Server.bat` and open `http://localhost:8080`.
- `Pcloudfare.bat` can tunnel the local server for external testing.

## Notes / gaps
- `assets/icons/favicon.png` is referenced but missing.
- `/assets/data/media.json` is referenced as a fallback but missing.
- `css/dmz_scuba_main_full.css` and `js/globe - Copy.js` are not referenced by any HTML.
