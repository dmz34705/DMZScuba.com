# DMZ Media API (Cloudflare Worker)

This Worker provides a simple API for the media library using Cloudflare D1.

## Endpoints

- `GET /api/media`
  - Returns `{ mediaItems, photoItems }` for the media page.

- `POST /api/admin/login`
  - Body: `{ "user": "...", "pass": "..." }`
  - Returns `{ ok, token }` for admin actions.

- `POST /api/admin/stream-direct-upload`
  - Returns a Stream direct upload URL (admin only).

- `POST /api/admin/media`
  - Create a media item (admin only).

- `PUT /api/admin/media/:id`
  - Update a media item (admin only).

- `DELETE /api/admin/media/:id`
  - Delete a media item (admin only).

## D1 Schema

Run the migration in `schema.sql` when you create the D1 database.

## Environment Variables

- `ADMIN_USER`
- `ADMIN_PASS`
- `CF_ACCOUNT_ID`
- `CF_STREAM_TOKEN`
- `ALLOWED_ORIGINS` (optional)

