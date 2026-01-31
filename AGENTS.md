# DMZScuba.com Codex Guide

## Project snapshot
- Static HTML/CSS/JS site with a Cloudflare Worker API.
- Static pages live in `index.html` and `pages/**`.
- Worker API lives in `workers/dmz-media-api/`.

## Local preview
- Static site: run `Python Server.bat` and open `http://localhost:8080`.
- Optional external tunnel: run `Pcloudfare.bat`.

## File map
- Content pages: `pages/**`.
- Global styles: `css/base.css`, `css/components.css`, `css/main.css`, `css/responsive.css`.
- Page styles: `css/pages/*.css`.
- Global JS: `js/main.js`.
- Feature JS: `js/media.js`, `js/media-edit.js`, `js/globe.js`, `js/destination.js`, `js/course-builder.js`.
- Data: `assets/data/destinations.json`, `assets/data/destinations-expanded.json`, `assets/data/media.json`.
- Worker: `workers/dmz-media-api/src/index.js`, schema in `workers/dmz-media-api/schema.sql`.

## Conventions
- Keep paths rooted at `/assets/...` in HTML/JSON.
- Prefer page-specific tweaks in `css/pages/*.css`; keep tokens and shared UI in `css/base.css` + `css/components.css`.
- Avoid editing `css/dmz_scuba_main_full.css` and `js/globe - Copy.js` (legacy/unused).
- When changing destinations, update both destination JSON files with the same `id`.
- When changing contact or course forms, update both frontend submit logic and the Worker `/api/contact` handler.

## Common tasks
- Add a destination: update both destination JSON files, add images in `assets/images`, verify `pages/travel` and `pages/travel/destination.html?id=slug`.
- Update media library: edit `js/media.js` and/or `js/media-edit.js`, adjust Worker endpoints as needed.
- Update training content: edit `pages/training/**`, and adjust shared styles in `css/components.css`.
