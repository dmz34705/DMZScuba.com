# DMZScuba.com

A static multi-page website built on HTML/CSS/JS, deployed via Cloudflare Pages, and backed by a Cloudflare Worker API (`dmz-media-api`) with a D1 SQLite database. The public site covers training, travel, media, events, contact, and about. The management console is a full business operations workspace for contacts, inquiries, classes, trips, tasks, site content, and registrations.

---

## Table of Contents

1. [Repo and Deployment Structure](#repo-and-deployment-structure)
2. [Public Site Pages](#public-site-pages)
3. [CSS Architecture](#css-architecture)
4. [JavaScript Modules](#javascript-modules)
5. [Management Console](#management-console)
6. [Worker API (dmz-media-api)](#worker-api-dmz-media-api)
7. [D1 Database Schema](#d1-database-schema)
8. [Training Section](#training-section)
9. [Events System](#events-system)
10. [Development Workflow](#development-workflow)
11. [Scripts Reference](#scripts-reference)
12. [AI Collaboration Guide](#ai-collaboration-guide)

---

## Repo and Deployment Structure

| Layer | Path / Repo | Cloudflare Project | Domain |
|---|---|---|---|
| Dev site | `H:\dmz-scuba site` / `dmz34705/DMZScuba.com` | `dmzscuba-com` | `dmzscuba-com.pages.dev` |
| Live site | `H:\dmz-scuba-live` / `dmz34705/DMZScuba-live` | `dmzscuba-live` | `www.dmzscuba.com` |
| Worker API | `workers/dmz-media-api/` | `dmz-media-api` | `dmz-media-api.zacharylisowski55.workers.dev` |

**Dev is the default workspace.** The live repo is only touched when Zach explicitly approves promotion.

API requests from Pages are proxied to the Worker via `functions/api/[[path]].js` (a Cloudflare Pages Function), which rewrites `/api/*` to the Worker origin. The `_redirects` file also routes `/management` and `/training` to their HTML files and redirects bare `dmzscuba.com` to `www.dmzscuba.com`.

---

## Public Site Pages

```
index.html                          Home
pages/about/index.html              About
pages/contact/index.html            Contact form
pages/thanks/index.html             Post-contact thank-you
pages/media/index.html              Media gallery
pages/travel/index.html             Travel / destination listing
pages/travel/destination.html       Individual destination detail (?id=slug)
pages/events/index.html             Public event listing
pages/events/event.html             Individual event detail
pages/events/embed.html             Embeddable event calendar widget
pages/training/index.html           Training hub
  pages/training/open-water/        Open Water Certification
  pages/training/specialty/         Specialty courses (nitrox, wreck, drysuit, full-face mask)
  pages/training/advanced-specialty/ Advanced Specialty courses
  pages/training/skill-refresh/     Skill Refresh course
  pages/training/course-builder/    Interactive course builder tool
  pages/training/interactive-tools/ Physics demos (Boyle's Law, color loss) + tools hub
quiz/index.html                     Quiz (loaded by js/quiz.js)
management/index.html               Admin management console (auth-gated)
```

**Home page** (`index.html`) renders the animated globe, a news ticker pulled from the Worker, and hero sections. Globe data is driven by `assets/data/destinations.json`.

**Travel listing** (`pages/travel/index.html`) reads destination data from `GET /api/v2/destinations` and renders cards with a 3D globe. `pages/travel/destination.html` loads an individual destination by `?id=` query param.

**Media gallery** (`pages/media/index.html`) fetches `GET /api/media` and renders video/photo cards with tag filtering and Reel Mode (fullscreen slideshow).

**Contact page** submits to `POST /api/contact`, which sends a Resend notification email to `info@dmzscuba.com` and an auto-reply to the submitter.

---

## CSS Architecture

```
css/base.css          CSS custom properties / design tokens
css/components.css    Shared UI components (buttons, modals, cards, etc.)
css/main.css          Site-wide layout and structural styles
css/responsive.css    Global breakpoints and mobile overrides
css/pages/            Per-page stylesheets
  about.css
  contact.css
  course-builder.css
  destination.css
  event-detail.css
  events.css
  home.css
  management.css      ~114KB — full management console styles including mobile layout
  media.css
  thanks.css
  travel.css
```

**Rule:** Page-specific tweaks go in `css/pages/*.css`. Design tokens and shared component styles go in `base.css` + `components.css`. Do not edit legacy unused files (`js/globe - Copy.js`, `css/dmz_scuba_main_full.css`).

The management console has mobile-first layout at ≤680px: bottom tab bar + bottom sheet pattern. All console features must remain functional on mobile.

---

## JavaScript Modules

### Public Site

| File | Purpose |
|---|---|
| `js/main.js` | Global nav, mobile menu, shared page utilities |
| `js/home.js` | Home page sections and ticker integration |
| `js/globe.js` | 3D interactive globe (Three.js / WebGL) for travel pages |
| `js/destination.js` | Destination detail page data loading and rendering |
| `js/destinations-edit.js` | Standalone destination admin editor (outside management console) |
| `js/travel-admin.js` | Travel section admin tools |
| `js/events.js` | Public event listing, filtering, and calendar display |
| `js/events-admin.js` | Event admin (calendar data editing) |
| `js/event-detail.js` | Individual event detail page, registration form |
| `js/media.js` | Public media gallery: cards, tag filtering, Reel Mode |
| `js/media-edit.js` | Standalone media admin editor (outside management console) |
| `js/media-logic.js` | Shared media filtering/sorting logic (has unit tests) |
| `js/course-builder.js` | Interactive course builder tool |
| `js/quiz.js` | Quiz engine (loads questions, scores results, emails via Resend) |

### Management Console (split modules)

The console is composed of one large core file plus multiple focused modules that are all loaded on `management/index.html`. Each module is self-contained and attaches behavior to the shared DOM.

| File | Purpose |
|---|---|
| `js/management.js` (~170KB) | Core engine: login, record CRUD, editor, filters, search, sort, calendar, registration manager, site studio tabs, home ticker modal |
| `js/management-dashboard.js` | Dashboard home tab: overdue items, due-today, open inquiries, open tasks, outstanding balance summary |
| `js/management-bulk.js` | Bulk select mode — multi-card status update via a floating action bar |
| `js/management-quick-advance.js` | Per-card quick-advance button that moves a record one step along its status pipeline |
| `js/management-keyboard.js` | Keyboard shortcuts: `1–6` for tabs, `N` new record, `Esc` close, `/` search, `Cmd/Ctrl+F` search, `?` help overlay |
| `js/management-note-logger.js` | Quick timestamped log entry input that prepends to a record's notes field |
| `js/management-import-export.js` | CSV import with header auto-mapping and CSV export for all record types |
| `js/management-media-studio.js` | Inline media admin within Site Studio: list, edit, publish, delete, Stream/Images upload |
| `js/management-travel-studio.js` | Inline destination admin within Site Studio: core data, gallery, details editor with tabbed layout |
| `js/management-balance.js` | Outstanding balance badges on record cards (owed − paid, debounced via MutationObserver) |
| `js/management-hide-complete.js` | "Hide Done / Show Done" toggle button (persisted in `localStorage`) |
| `js/management-cal-toggle.js` | "Show Past / Hide Past" toggle for the Calendar tab |
| `js/management-more.js` | "More" overflow nav panel managing secondary nav and site studio links |

---

## Management Console

### Access

Navigate to `/management` (or `management/index.html`). Login requires `ADMIN_USER` + `ADMIN_PASS` credentials stored as Worker secrets. On success, a 24-hour session token is stored in `localStorage` under the key `dmzMediaToken`.

### Navigation Tabs

| Key | Tab | Content |
|---|---|---|
| `1` | Dashboard | Priority summary, overdue, due today, open inquiries, open tasks, total outstanding balance |
| `2` | Agenda | All open records across all types |
| `3` | Contacts | Contact profiles only |
| `4` | Inquiries | Business inquiries only |
| `5` | Classes | Scheduled class records |
| `6` | Calendar | Trip and calendar event records |
| — | Registrations (More) | Event and class registration snapshots |
| — | Site Studio (More) | Inline editors for events, media, destinations, home ticker |

### Record Types

#### Contact
Personal contact profile. Fields: first/last name, email, phone, source channel, certification level, priority, notes (preferences, gear, relationship history), and linked class enrollments.

#### Inquiry
Business inquiry or outreach with a full pipeline. Direction: inbound or outbound. Categories cover a range of inquiry types.

Pipeline statuses (in order):
`new` → `to_contact` → `reached_out` → `gathering_details` → `planning` → `payment` → `timing` → `complete`

Additional closed statuses: `dead_end`, `not_fit`, `archived`

Financial fields: `amountOwed` and `amountPaid` (outstanding balance = owed − paid). Cards show a balance badge when there's an outstanding amount.

Other fields: organization/partner, next action, outcome reason, target start/end dates, owner, source, activity notes log.

#### Class
A scheduled diving class. Fields: class name, class ID, capacity, schedule (sessions with type: classroom/pool/open water), roster (enrolled contacts with status), registration settings (open/closed), and email confirmation config (subject, template ID, HTML body, or full custom HTML).

Contact enrollment is managed within the class editor and also reflected in the Contact's linked classes list.

#### Trip (Calendar Event)
A site calendar event or dive trip. Fields: title, start/end dates, start/end times, event tag, location, registration toggle, capacity, and email config matching the class email setup.

Calendar events appear on the public site's events/calendar pages when published via the Site Studio events editor.

#### Task
A business task or to-do. Fields: title, status, priority, owner, due date, next action, notes.

Pipeline: `new` → `active` → `complete` (or `waiting` → `complete`)

### Editor Behavior

- Record cards are for scanning. Clicking a card opens the modal editor.
- Save or cancel before switching to another record.
- Editor fields are dynamically shown/hidden based on record type.
- The Note Logger (inquiry, task, contact) prepends a timestamped entry to the notes field without replacing existing content.
- Quick Advance button on cards advances the record one pipeline step without opening the editor.

### Sorting and Filtering

- Filter buttons: All, Contacts, Inquiries, Classes, Calendar
- Sort options: Newest, Oldest, Priority, Due Date, Status
- Text search across title, contact name, email, and notes
- "Hide Done" toggle: hides complete/archived records (default on, persisted)
- "Show Past" toggle: shows past calendar events (default hidden)

### Bulk Operations

Click **Select** in the operations toolbar to enter bulk mode. Checkbox appears on each card. Select multiple cards, then use the bulk action bar to apply a status change to all selected records at once.

### Import / Export

- **Export**: Downloads a CSV of all currently filtered records with all standard field headers.
- **Import**: Accepts a CSV file. Headers are auto-mapped (case-insensitive, supports common aliases). New records are created; if an `id` column matches an existing record, it is updated.

### Site Studio

The Site Studio panel within the console provides inline editors without leaving the management page:

- **Events/Calendar**: Edit site calendar records. Changes are pushed to `PUT /api/admin/v2/events` and immediately reflected on the public events pages.
- **Media Studio**: Full media admin — list all items, edit metadata (title, description, tags, badge, location), publish/unpublish, delete, and upload new videos via Cloudflare Stream (direct upload or resumable TUS) or photos via Cloudflare Images.
- **Travel Studio**: Full destination admin — tabbed editor (Core, Gallery, Details) for each destination. Saves to `PUT /api/admin/v2/destinations/:id`. Previews link to the live travel destination page.
- **Home Ticker**: Edit the scrolling news ticker text lines shown on the home page. Saves to `PUT /api/admin/v2/home-ticker`.

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` – `6` | Switch to that tab (Dashboard through Calendar) |
| `N` | New record |
| `Esc` | Close editor / drawer |
| `/` | Focus search input |
| `Cmd/Ctrl+F` | Focus search (ops panel only) |
| `?` | Toggle shortcuts help overlay |

---

## Worker API (dmz-media-api)

**Source:** `workers/dmz-media-api/src/index.js`
**Config:** `workers/dmz-media-api/wrangler.toml`
**D1 binding:** `DB` → database `dmz_media`

The Worker is deployed separately from the Pages site. Pages proxies all `/api/*` requests to the Worker via the Pages Function at `functions/api/[[path]].js`.

### Auth Model

- Login: `POST /api/admin/login` with `{ user, pass }`
- Returns a token stored in `admin_sessions` (24-hour TTL)
- All admin routes require: `Authorization: Bearer <token>`

### Public Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/media` | Returns `{ mediaItems, photoItems }` from `media_items` |
| `POST` | `/api/contact` | Contact form submission — sends Resend notification + auto-reply |
| `POST` | `/api/client-telemetry` | Client error events (contact failures, upload failures) — logged to Worker logs |
| `GET` | `/api/v2/destinations` | All destination v2 records |
| `GET` | `/api/v2/destinations/:id` | Single destination v2 record |
| `GET` | `/api/v2/events` | All calendar/event records |
| `GET` | `/api/v2/events/:id/registrations` | Registrations for a specific event |
| `POST` | `/api/v2/events/:id/registrations` | Submit a new event registration (public) |
| `GET` | `/api/v2/home-ticker` | Home page news ticker content |

### Admin Endpoints

All require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Authenticate and receive session token |
| `GET` | `/api/admin/management` | Fetch all management records |
| `POST` | `/api/admin/management` | Create a management record |
| `PUT` | `/api/admin/management/:id` | Update a management record |
| `DELETE` | `/api/admin/management/:id` | Delete a management record |
| `POST` | `/api/admin/media` | Create a media item |
| `PUT` | `/api/admin/media/:id` | Update a media item |
| `DELETE` | `/api/admin/media/:id` | Delete a media item |
| `PUT` | `/api/admin/media-bulk` | Bulk upsert/publish + optional Stream delete list |
| `POST` | `/api/admin/stream-direct-upload` | Get a Cloudflare Stream direct upload URL |
| `POST` | `/api/admin/stream-tus-upload` | Initialize a resumable TUS Stream upload |
| `POST` | `/api/admin/stream-date-sync` | Sync media `created_at` dates from Stream metadata |
| `POST` | `/api/admin/images-direct-upload` | Get a Cloudflare Images direct upload URL |
| `POST` | `/api/admin/images-delete` | Delete a Cloudflare Images asset by ID |
| `PUT` | `/api/admin/v2/destinations/:id` | Upsert a destination v2 record |
| `DELETE` | `/api/admin/v2/destinations/:id` | Delete a destination v2 record |
| `PUT` | `/api/admin/v2/events` | Upsert site calendar/event data |
| `DELETE` | `/api/admin/v2/events` | Delete a calendar event |
| `PUT` | `/api/admin/v2/home-ticker` | Update home ticker content |
| `PUT` | `/api/admin/v2/events/:id/approval` | Approve or deny a registration |
| `DELETE` | `/api/admin/v2/events/:id/registrations/:regId` | Delete a specific registration |

### Email (Resend)

Contact form submissions send two emails via [Resend](https://resend.com):
1. Internal notification to `info@dmzscuba.com`
2. Auto-reply to the submitter

Template IDs for per-destination interest forms are optional env vars (`RESEND_TEMPLATE_ROATAN`, etc.) and fall back to a generic template. Quiz results use `RESEND_TEMPLATE_QUIZ_RESULTS`.

### Required Environment Variables

Set as Worker secrets in the Cloudflare dashboard:

| Variable | Purpose |
|---|---|
| `ADMIN_USER` | Admin login username |
| `ADMIN_PASS` | Admin login password |
| `CF_ACCOUNT_ID` | Cloudflare account ID (Stream) |
| `CF_STREAM_TOKEN` | Cloudflare Stream API token |
| `RESEND_API_KEY` | Resend API key |
| `CF_IMAGES_TOKEN` | Cloudflare Images API token |
| `CF_IMAGES_DELIVERY` | Images delivery URL/hash |
| `CF_IMAGES_VARIANT` | Images variant name (e.g. `public`) |

Set in `wrangler.toml` (non-secret):

| Variable | Value |
|---|---|
| `RESEND_FROM_EMAIL` | `no-reply@dmzscuba.com` |
| `RESEND_FROM_NAME` | `DMZ Scuba` |
| `RESEND_TO` | `info@dmzscuba.com` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |

---

## D1 Database Schema

Schema file: `workers/dmz-media-api/schema.sql`

| Table | Purpose |
|---|---|
| `media_items` | Stream videos, YouTube links, and photo assets. Fields: id, type, title, description, tags, badge, thumb_text, url, thumb_url, stream_id, meta, location, sort_order, created_at |
| `admin_sessions` | Session tokens with expiry (24h TTL) |
| `destinations_v2` | Live destination records as JSON blobs |
| `events_v2` | Site calendar events keyed by `calendar_key` |
| `event_registrations_v2` | Public event and class registrations with approval status |
| `site_settings` | Key/value store for site settings (home ticker, etc.) |
| `management_records` | All management console records (contacts, inquiries, classes, trips, tasks) |

Legacy tables (`destinations`, `destinations_base`, `destinations_expanded`) exist for backward compatibility. New destination data uses `destinations_v2`.

Indexes:
- `idx_media_type` on `media_items(type)`
- `idx_management_type_status` on `management_records(record_type, status)`
- `idx_management_due_date` on `management_records(due_date)`
- `idx_event_regs_source_date` on `event_registrations_v2(source_id, event_date)`

---

## Training Section

```
pages/training/index.html                   Training hub / course catalog
pages/training/open-water/index.html        Open Water Certification detail
pages/training/specialty/index.html         Specialty course listing
  specialty/nitrox/index.html               Nitrox course
  specialty/wreck/index.html                Wreck Diving course
  specialty/drysuit/index.html              Drysuit course
  specialty/full-face-mask/index.html       Full Face Mask course
pages/training/advanced-specialty/index.html  Advanced Specialty overview
pages/training/skill-refresh/index.html     Skill Refresh course
pages/training/course-builder/index.html    Interactive course builder (driven by js/course-builder.js)
pages/training/interactive-tools/index.html  Tools hub
  interactive-tools/boyles-law-demo.html   Self-contained Boyle's Law physics simulation
  interactive-tools/color-loss-demo.html   Self-contained underwater color loss demo
```

The interactive tool pages are self-contained single-file demos (large HTML files) that include inline sprites and animations for dive physics education.

---

## Events System

| File | Purpose |
|---|---|
| `pages/events/index.html` | Public event listing with filters and calendar view |
| `pages/events/event.html` | Individual event detail page with registration form |
| `pages/events/embed.html` | Embeddable calendar widget (iframe-friendly) |
| `js/events.js` | Event listing: fetch from API, render cards, filter, calendar display |
| `js/events-admin.js` | Event admin: add/edit/delete calendar records |
| `js/event-detail.js` | Event detail page: load event data, render details, submit registrations |

Event data is stored in `events_v2` and served by `GET /api/v2/events`. The management console's Calendar tab and Site Studio events editor both write to the same table via `PUT /api/admin/v2/events`.

Registrations from the public event form go to `POST /api/v2/events/:id/registrations` and are stored in `event_registrations_v2` with `approval_status = 'pending'`. Admins can approve, deny, or delete registrations from the Registrations tab in the management console.

---

## Development Workflow

### Workspaces

- **Dev:** `H:\dmz-scuba site` → branch `main` → `dmz34705/DMZScuba.com`
- **Live:** `H:\dmz-scuba-live` → branch `main` → `dmz34705/DMZScuba-live` (do not touch unless explicitly asked)

### Standard Push Workflow

```powershell
# 1. Check status
git status --short --branch

# 2. Review changes
git diff --stat
git diff --check

# 3. Validate JS if changed
node --check js\management.js
# or for the Worker
node --check workers\dmz-media-api\src\index.js

# 4. Commit
git add <files>
git commit -m "<clear message>"

# 5. Push using the batch file
.\push.bat
```

`push.bat` handles: confirm git repo, pull --rebase --autostash, add all, prompt for commit message (or auto-timestamp), commit, push to `origin main`.

### Worker Deployment

Only deploy the Worker when the Worker source (`workers/dmz-media-api/src/index.js`) has changed or when Zach explicitly asks:

```powershell
.\Deploy Worker.bat
# Runs: cd workers\dmz-media-api && npx wrangler deploy
```

### Local Development

```powershell
.\Python Server.bat      # Starts a local static server at http://localhost:8080
.\Pcloudfare.bat         # Optional: Cloudflare tunnel for external access
```

### Testing

```powershell
.\Smoke Check.bat        # Runs scripts/smoke-check.mjs against dmzscuba-com.pages.dev
.\Test Media Logic.bat   # Runs tests/media-logic.test.cjs (Node)
```

Smoke check validates: all public pages load, API endpoints respond, contact form, media page, reel mode, and admin login. Pass `--base <url>` to target a different environment.

### Live Promotion (only when explicitly approved)

1. Confirm Zach explicitly approved the specific commit(s).
2. Cherry-pick approved commit(s) from dev into `H:\dmz-scuba-live`.
3. Push live repo.
4. Confirm Cloudflare `dmzscuba-live` deploy is green.
5. Run smoke check against `https://dmzscuba-live.pages.dev`.

---

## Scripts Reference

| Script | What it does |
|---|---|
| `push.bat` | Interactive dev push: pull, stage all, commit, push to `origin main` |
| `Deploy Worker.bat` | Deploys `workers/dmz-media-api` via `wrangler deploy` |
| `Smoke Check.bat` | Runs `scripts/smoke-check.mjs` against the dev Pages URL |
| `Python Server.bat` | Starts a Python HTTP server for local static preview |
| `Pcloudfare.bat` | Starts a Cloudflare tunnel for external local preview |
| `Test Media Logic.bat` | Runs `tests/media-logic.test.cjs` with Node |

---

## AI Collaboration Guide

### Rules for Claude and Codex

- **Default to dev.** Work in `H:\dmz-scuba site`. Do not touch `H:\dmz-scuba-live` unless Zach explicitly asks.
- **Preserve local work.** Never use `git reset --hard`, `git checkout --`, or `git restore` to discard uncommitted changes without explicit instruction.
- **Validate JS before committing.** Run `node --check` on any changed JS file before staging.
- **Run `git diff --check`** before committing to catch whitespace errors.
- **Use `push.bat` for manual pushes.** Do not run `git push` directly.
- **Do not deploy the Worker** unless Worker source changed or Zach requests it.
- **Do not promote to live** without explicit approval for specific commits.
- **Mobile-first always.** The management console must remain usable on mobile (≤680px). Bottom tab bar + bottom sheet layout must not be broken by any console changes.

### Data file conventions

- Destination IDs must match between `destinations.json`, `destinations-expanded.json`, and `destinations_v2` in D1.
- When updating the Worker schema, run `schema.sql` against D1 to apply changes.
- When updating `assets/data/*.json` directly (local fallback files), the live data source is D1 via the Worker API — the JSON files are not the source of truth for production.

### Handoff notes

Claude or Codex may leave unpushed changes. The other can review, validate, commit, and push from the dev repo. Always check `git status` before starting new work to understand what's already staged or modified.
