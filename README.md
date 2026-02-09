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

## Updates Planned

The following updates are currently being planned:
1. Address the issue of Cloudflare Stream horizontal videos being cropped in the media reel mode.
2. Fix interactive demos for better functionality on mobile devices.
3. Go through the site and resolve small items such as layout issues and other neatening work items.

## Architecture

Frontend:
[...] (rest of content unchanged)