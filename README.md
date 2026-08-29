# DMZScuba.com — Complete Technical Reference

DMZ Scuba is a full-stack dive business platform built entirely without a front-end framework. The public site runs as static HTML/CSS/JS on Cloudflare Pages. Every dynamic feature — media, events, destinations, contact forms, and business operations — flows through a single Cloudflare Worker backed by a D1 SQLite database. The management console is a purpose-built business operations workspace that lives as a single authenticated HTML page inside the same repo, sharing the same API.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Visual Design System](#visual-design-system)
3. [Public Site — Page by Page](#public-site--page-by-page)
4. [JavaScript Architecture](#javascript-architecture)
5. [The Management Console](#the-management-console)
6. [The Worker API](#the-worker-api)
7. [D1 Database Schema](#d1-database-schema)
8. [The Events System](#the-events-system)
9. [The Media System](#the-media-system)
10. [The Globe](#the-globe)
11. [The Quiz Engine](#the-quiz-engine)
12. [Email System (Resend)](#email-system-resend)
13. [Training Section](#training-section)
14. [Development Workflow](#development-workflow)
15. [Scripts Reference](#scripts-reference)
16. [Repo and Deployment Structure](#repo-and-deployment-structure)
17. [AI Collaboration Guide](#ai-collaboration-guide)

---

## Architecture Overview

```
Browser
  │
  ├── Cloudflare Pages (static HTML/CSS/JS)
  │     ├── Public pages (/, /pages/**, /quiz, /pages/events/embed.html)
  │     └── /management  ← single authenticated SPA
  │
  ├── Cloudflare Pages Functions
  │     ├── functions/api/[[path]].js proxies shared /api/* requests to the Worker
  │     └── functions/api/admin/funnel-analytics.js reads aggregate-only D1 reporting in dev
  │
  └── Cloudflare Worker  (dmz-media-api)
        ├── D1 (SQLite) — all data
        ├── Cloudflare Stream — video hosting + upload
        ├── Cloudflare Images — photo hosting + upload
        └── Resend — transactional email delivery
```

**Why no framework?** Every JS file on this site is a self-contained IIFE (Immediately Invoked Function Expression). There is no build step, no bundler, no dependencies loaded into the browser. Pages load by fetching a couple of flat `.js` files. The management console with all its features is 170KB of vanilla JS, split across 13 module files that all attach to the same shared DOM.

**The Worker is the single source of truth.** No static JSON file is authoritative for production data. Static JSON files (`assets/data/*.json`) exist as local development fallbacks and for things like the globe's destination pins, but the live site reads everything from the Worker API.

---

## Visual Design System

The site uses a cinematic dark ocean theme defined in `css/base.css`:

```css
--bg:      #050B14   /* near-black deep ocean */
--bg-2:    #071325   /* slightly lighter */
--text:    #EAF2FF   /* ice-white */
--muted:   rgba(234, 242, 255, 0.72)
--accent:  #E21B23   /* DMZ red */
--glow:    rgba(85, 185, 255, 0.18)  /* blue highlight glow */
--radius:  18px
```

The body background is a two-layer composite: a radial gradient that simulates light entering water from above, layered over a linear gradient from near-black to deep blue. This means every page has a subtle underwater atmosphere without any image.

**Scroll behavior (mobile):** `js/main.js` implements a custom accumulation-based scroll reveal for the nav header on mobile. It does not simply toggle on scroll direction — it tracks accumulated scroll distance in both directions and only hides the header after 32px of downward accumulation (44px on media), and only reveals after 240px back up (96px on media). This prevents accidental flicker on bumpy scroll. The nav stays fixed at the top for 220px before the scroll logic activates.

**Mobile sticky CTA:** The home page has a bottom-pinned CTA bar (`#mobile-sticky-cta`) that dismisses on close and stores `dmz-mobile-sticky-cta-dismissed` in `localStorage` so it does not re-appear after a user closes it.

**URL-driven form prefill:** Any contact form URL can carry `?interest=training&location=...&course=...&name=...` parameters. `js/main.js` reads these on `DOMContentLoaded` and prefills the matching form fields, then adds `needs-input` highlight classes to any unfilled required fields so the user's eye goes straight to what they still need to complete.

---

## Public Site — Page by Page

### Home (`index.html`)

The most feature-dense public page. It loads five JS files: `main.js`, `events.js`, `quiz.js`, `home.js`, and an inline `mapLinkChooser` script.

**Hero section:** Static layout with a background image, animated ticker, and trust microcopy. The ticker element (`data-home-ticker`) starts hidden and is revealed by `home.js` once it successfully fetches `/api/v2/home-ticker`. If the API is unreachable, the ticker simply stays hidden — no broken layout.

**Events preview:** A `data-events-preview` section fetches `/api/v2/events` (falling back to `/assets/data/events.json`) and renders upcoming event cards via the shared `events.js` engine. Events appear on the home page through the exact same code that powers the full events page — the script reads `data-events-preview` to switch into embed mode.

**Quiz entry:** Two buttons (`data-open-quiz="quick"` and `data-open-quiz="builder"`) launch the quiz modal. The quiz modal is statically in the HTML but `aria-hidden="true"` by default and fully managed by `quiz.js`.

**Map link router:** An inline script at the bottom of the page intercepts `.js-map-link` clicks and routes to Apple Maps on iOS, the `geo:` URI scheme on Android, and Google Maps in a new tab on desktop. This means the training address opens the native map app on mobile.

### Contact (`pages/contact/index.html`)

Two forms in one page:

1. **Quick Contact form** (`#quickContactForm`) — minimal fields, submits via `window.DMZForms.submit()` from `main.js`, redirects to `/pages/thanks/` on success.
2. **Dive Now form** (`#dive-now .dmz-form`) — full planning form with interest, location, dates, group size, experience level, and course fields. Prefillable via URL params.

Both forms use a **honeypot field** named `company`. The Worker checks for this field on `POST /api/contact` and silently returns `{ ok: true }` without sending any email if it's populated — invisible to bots, zero cost.

The contact page also has `data-copy` buttons on the phone and email display. `main.js` handles these globally: `navigator.clipboard.writeText()` with a `textarea`/`execCommand` fallback for non-secure contexts (like `file://` previews). Visual confirmation via `aria-label` swap and a 1400ms auto-clearing toast.

### Travel (`pages/travel/index.html`)

Renders the destination grid and the interactive globe. Loads `globe.js`, `destination.js`, and `travel-admin.js`. Fetches `/api/v2/destinations` on load. The globe and destination card grid are synchronized — clicking a destination card highlights the corresponding globe pin, and clicking a globe pin scrolls to and highlights the card.

Individual destinations link to `pages/travel/destination.html?id=slug`, which loads the full destination detail via `destination.js` reading `/api/v2/destinations/:id`.

### Media (`pages/media/index.html`)

The media gallery is a full filtering + discovery surface backed by `media.js` (~88KB). It reads `/api/media` to get the full item set and `/api/v2/destinations` to populate the location filter with destination names. Features: tag filter, location filter, text search, sort (manual/date/shuffle), card size slider, and Reel Mode.

**Reel Mode** is a fullscreen vertical scroll feed — think TikTok for dive content. It renders media items as a scrolling feed using IntersectionObserver to detect which card is in the viewport, then pauses/plays video accordingly. It supports Cloudflare Stream, YouTube, and local video, with full sound-on/off control. The initial user interaction (clicking Reel Mode) unlocks audio in browsers that require a gesture first.

### Events (`pages/events/index.html`)

Full calendar surface with month navigation, a list/calendar toggle, event type filters (Training, Travel, Local Dive, Workshop, Community), and event detail modals. Events can have multi-day duration, and the calendar renders them spanning multiple date cells. Events with `registrationEnabled: true` show a registration form in the modal that posts to `/api/v2/events/:id/registrations`.

### Quiz (`quiz/index.html`)

Loads `quiz.js` in a bare page that is only ever accessed via the modal. The quiz is primarily used embedded in the home page modal, but the standalone page exists for direct linking.

---

## JavaScript Architecture

Every JS file on the site uses the IIFE pattern:

```js
(() => {
  // entire module scope — nothing leaks to window
})();
```

The exceptions are intentional: `main.js` exposes `window.DMZForms` and `window.DMZTelemetry` so that inline `<form>` submit handlers in HTML can call them without coupling to a specific file name. Everything else communicates through the DOM (data attributes, CustomEvents, classList mutations).

**No external runtime dependencies.** The globe is pure Canvas 2D. The quiz is pure DOM manipulation. The media masonry layout is calculated manually. The management console's complex state is a plain `const state = {}` object.

**Shared patterns across all files:**

| Pattern | Usage |
|---|---|
| `apiFetch(url, opts)` | Injects `Authorization: Bearer <token>` from `localStorage` on every request |
| `escapeHtml(value)` | Used before any user content goes into `innerHTML` — XSS prevention is consistent |
| `setStatus(node, msg, tone)` | Status feedback element that toggles `is-error` / `is-success` CSS classes |
| `data-` attribute routing | `data-site-studio-tab`, `data-filter-type`, `data-record-id` etc. used as CSS hooks and JS selectors |
| `normalizeSiteText(value)` | Trims, lowercases, and strips accents for consistent comparisons |
| Telemetry on failure | `window.DMZTelemetry.report()` fires on contact submit failures and media upload failures via `navigator.sendBeacon` (fetch fallback) |

**Module split strategy:** The management console's 170KB core (`management.js`) handles data loading, rendering, and CRUD. Each behavior feature that adds UI or state is its own module file. The modules use `MutationObserver` and DOM queries to find the elements they need, so they never import from or call into `management.js`. This means any module can be removed without touching core.

---

## The Management Console

The console (`management/index.html`) is a single HTML page that presents a full sidebar + main panel layout on desktop, and a bottom tab bar + bottom sheet on mobile. It is `noindex, nofollow` so it does not appear in search results. Authentication is required — the login screen is rendered in the same HTML file and toggled with `hidden`.

### How Auth Works

1. User submits username + password via the login form.
2. `management.js` POSTs `{ user, pass }` to `POST /api/admin/login`.
3. Worker validates against `ADMIN_USER` + `ADMIN_PASS` environment secrets.
4. On success, Worker generates a `crypto.randomUUID()` token, stores it in `admin_sessions` with a 24-hour expiry, returns it to the client.
5. Token is stored in `localStorage` under `dmzMediaToken`.
6. All subsequent API calls include `Authorization: Bearer <token>`.
7. If any API call returns 401, the token is cleared and the login screen is shown.

### Record Types in Depth

All record types are stored in the same `management_records` table and differentiated by `record_type`. Each type has a `typeConfig` object in `management.js` that controls which form fields are shown, what labels say, and what placeholder text is used.

**Contact** — The CRM leaf. Stores certification level, source channel (website/referral/phone/social), notes as a relationship log, and a linked class enrollment list. The form shows first/last name separately even though the API stores them in `extras.firstName` / `extras.lastName`. When a contact is opened, their enrolled classes are loaded and shown in a collapsible section inside the editor. You can add a contact to a class from the contact editor, or add a contact to the class roster from the class editor — both sides update the same data.

**Inquiry** — The business development record. Has a full 8-stage pipeline with `statusRank` ordering so "Progress" sort puts records in pipeline order. Financial tracking: `amountOwed` and `amountPaid` stored in `extras`. Outstanding balance (owed − paid) appears as a badge on the card. Inquiry direction (incoming vs. outgoing) and category (pool, agency, vendor, customer, travel partner, community, etc.) enable filtering by business context.

**Class** — Scuba class with a multi-session schedule. Each session has a type (classroom/pool/open water), date, start time, end time, and location. The form uses a `<details>` disclosure element for the schedule so it does not dominate the editor. The `getEffectiveClassStatus()` function computes a dynamic status from the session dates: if all sessions are in the past, the class is effectively "complete" even if the status field says "scheduled". This computed status is used for rendering but not saved — saving always writes what the user explicitly set.

**Class ↔ Calendar sync:** When you save a class, `syncClassRecordToCalendar()` constructs a calendar event payload from the class sessions and pushes it to `PUT /api/admin/v2/events`. The first session date becomes the registration anchor date. This is how a class record generates a public calendar entry automatically.

**Trip (Calendar Event)** — A site calendar event. Has all the scheduling fields (start/end dates, times, tag, location) plus registration configuration. Registration email config supports three modes: plain text, HTML body, or full custom HTML with merge tags. Merge tags: `{{event_title}}`, `{{event_date}}`, `{{registrant_first_name}}`, `{{registrant_last_name}}`, `{{registrant_email}}`, `{{registrant_phone}}`, `{{cert_level}}`, `{{party_size}}`.

**Task** — The simplest record type. Title, status, priority, owner, due date, next action, notes. Quick Advance moves it: `new` → `active` → `complete`.

### Dashboard Module (`management-dashboard.js`)

Loads independently from the main operations list. Queries `GET /api/admin/management` itself (does not share the state object with `management.js`) and renders four sections:

- **Needs Attention:** overdue records first, then records due today, de-duplicated
- **Open Inquiries:** up to 6 open inquiries, clickable to open in the operations panel
- **Open Tasks:** up to 6 open tasks, sorted by due date
- **Outstanding Balance:** sum of (owed − paid) across all open non-contact records

Clicking any dashboard row dispatches a navigation to the operations panel and opens that record's editor. Overdue rows get `is-overdue` class (styled red); due-today rows get `is-today` class (styled amber).

### Funnel Analytics (`management-analytics.js`)

The authenticated **Site Analytics** panel summarizes the privacy-limited `funnel_events` table without sending raw event rows to the browser. It defaults to live traffic and provides 7-, 30-, 90-, and 400-day views of course-page sessions, CTA clicks, form starts, completed inquiries, daily trends, course performance, traffic sources, and device mix. The dev Pages Function accepts legacy `admin_sessions` tokens and validates website/mobile account sessions through the Worker's shared Employee/Administrator access check before running aggregate D1 queries.

### Bulk Select (`management-bulk.js`)

Injects a **Select** button into the operations topbar on load (before the **+ New** button). On click, enters bulk mode: checkboxes appear on every card. A floating action bar appears below the topbar with a status select and Apply button. Selecting all via **Select All** checks every visible card. Applying updates all selected records via individual `PUT /api/admin/management/:id` calls.

### Quick Advance (`management-quick-advance.js`)

Attaches a `click` delegate to the record list. When a button with `data-quick-advance` is clicked, it reads the card's record type, looks up the next status in the `NEXT` pipeline map, PATCHes the record via `PUT /api/admin/management/:id`, and re-renders without opening the editor. Inquiry pipeline: `new` → `to_contact` → `reached_out` → `gathering_details` → `planning` → `payment` → `timing` → `complete`. Terminal steps have `isDone: true` and render as `✓ Close`.

### Note Logger (`management-note-logger.js`)

A quick-entry field visible when a record of type `inquiry`, `task`, or `contact` is open in the editor. Submitting it prepends `[May 26, 2026] <text>` to the notes textarea, with the newest entry always at the top. The textarea field value is updated in-memory but not saved until the user hits Save — consistent with the rest of the editor. The logger input is cleared after each entry.

### Import / Export (`management-import-export.js`)

**Export:** Downloads all currently filtered records as a CSV with 22 columns. Fields from `extras` (the JSON blob inside each record) are promoted to top-level columns.

**Import:** Accepts a CSV file. Header normalization handles aliases (`firstname`, `first name`, `first_name` all map to `extras.firstName`). Records with an `id` column that matches an existing record are updated via `PUT`. Records without an `id` (or with an unrecognized ID) are created via `POST`. Import runs sequentially with a summary of created/updated/failed counts.

### Site Studio

The Site Studio is a section within the management console that provides inline editors for site content. It runs as separate panels within the same page.

**Media Studio (`management-media-studio.js`):** Two-column layout — sidebar (list + edit form) and live preview iframe. The list shows all media items with a search input. Selecting an item loads its fields into the edit form. Changes are tracked in `st.edits` (a Map of `id → field changes`). Deleting items is tracked in `st.deleting` (a Set). The **Publish to Site** button sends the full dirty diff via `PUT /api/admin/media-bulk`. The preview iframe shows `/pages/media/` and has a Refresh button. Stream sync calls `POST /api/admin/stream-date-sync` to pull actual upload dates from Stream metadata and update `created_at` on the corresponding `media_items` rows.

**Travel Studio (`management-travel-studio.js`):** Same two-column layout. The editor has three tabs: **Core** (name, subtitle, coordinates, description, hero image), **Content** (bullets, tags, dive info), and **JSON** (raw JSON editor for power editing). The JSON tab shows the full record serialized, allows direct edits, and validates JSON on save. Changes are saved per-destination via `PUT /api/admin/v2/destinations/:id`. The preview iframe shows `/pages/travel/`.

### Registration Handling

When a public event has `registrationEnabled: true`, the management console's Signups view loads all registrations across all enabled events in parallel via `Promise.all()` against `GET /api/v2/events/:id/registrations` for each. Each registration entry shows the registrant's details and action buttons: **Approve**, **Convert to Contact**, and **Delete**.

- **Approve** → `PUT /api/admin/v2/events/:id/approval` with `{ approvalStatus: "approved" }`
- **Convert to Contact** → creates a new Contact management record from the registration data, then approves the registration
- **Delete** → `DELETE /api/admin/v2/events/:id/registrations/:regId`

Class registrations (from the class escrow system) work similarly but load from the class editor's roster section rather than the Signups tab.

---

## The Worker API

**Source:** `workers/dmz-media-api/src/index.js`
**Config:** `workers/dmz-media-api/wrangler.toml`
**D1 binding:** `DB` → database `dmz_media` (id: `47d73216-f4d9-4831-a207-4548ccad9244`)

The Worker is a single `export default { fetch }` handler. There is no routing library — route matching is a chain of `if/else if` on `pathname` and `request.method`. CORS headers are applied to every response including errors.

### CORS Strategy

`getAllowedOrigin()` returns the request's `Origin` header if it matches one of:
- `localhost:*` or `127.0.0.1:*` (local dev)
- Any `*.pages.dev` or `*.trycloudflare.com` (Cloudflare preview)
- `dmzscuba.com` or any subdomain
- An entry in the `ALLOWED_ORIGINS` env var

If none match, it falls back to the first item in `ALLOWED_ORIGINS` or `*`. The `Vary: Origin` header is set so CDN caches respect the origin-based selection.

### Auth Token Flow

```
POST /api/admin/login
  body: { user: "...", pass: "..." }
  → validates against ADMIN_USER + ADMIN_PASS env secrets
  → crypto.randomUUID() → stored in admin_sessions with 24h expiry
  → returns { ok: true, token: "..." }

requireAuth(request, env)
  → reads Authorization: Bearer <token>
  → queries: SELECT token FROM admin_sessions WHERE token = ? AND expires_at > NOW()
  → returns true/false
```

### Contact Form Pipeline

`POST /api/contact` is the most complex public endpoint. On every valid submission it does four things:

1. **Honeypot check** — if `body.honey` or `body.website` is non-empty, return `{ ok: true }` silently.
2. **Send internal notification** — HTML email to `RESEND_TO` via Resend with all form fields formatted as a table.
3. **Auto-reply to submitter** — picks the right template based on `autoReplyType` field or destination detection (see Email System below).
4. **Create management inquiry record** — calls `createManagementRecord()` to write a new `inquiry` record to D1. This means every contact form submission automatically appears in the management console as a "New" inquiry, pre-populated with the submitter's name, email, phone, related destination/course, and the raw message as notes. No manual entry required.

### Management Record API

```
GET  /api/admin/management           → all records, ordered by updated_at DESC
POST /api/admin/management           → create (generates id, timestamps)
PUT  /api/admin/management/:id       → update (updates updated_at)
DELETE /api/admin/management/:id     → hard delete
```

Records are stored with `data_json` column holding `extras` (all non-top-level fields). Top-level columns (`record_type`, `title`, `status`, `priority`, `owner`, `contact_name`, `contact_email`, `contact_phone`, `due_date`, `related_event`, `notes`) exist for indexing and queries.

### Stream Upload Flow

**Direct upload** (`POST /api/admin/stream-direct-upload`):
- Worker calls Cloudflare Stream API with `CF_ACCOUNT_ID` + `CF_STREAM_TOKEN` to get a one-time upload URL.
- Client uploads the file directly to Stream via the returned URL.
- Worker is never in the upload path — the file goes browser → Stream.

**Resumable TUS upload** (`POST /api/admin/stream-tus-upload`):
- Worker initializes a TUS session with Stream and returns `{ uploadUrl, uid }`.
- Client uses the TUS protocol (resumable uploads) to stream the file chunk-by-chunk.
- Enables large file uploads over slow connections that can resume after interruption.

### Public Endpoint Table

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/media` | Returns `{ mediaItems, photoItems }` from `media_items` table |
| `POST` | `/api/contact` | Contact form: honeypot check → internal email → auto-reply → create management inquiry |
| `POST` | `/api/client-telemetry` | Sanitized operational logging plus allowlisted training-funnel persistence in D1 |
| `GET` | `/api/v2/destinations` | All destinations from `destinations_v2` |
| `GET` | `/api/v2/destinations/:id` | Single destination by slug ID |
| `GET` | `/api/v2/events` | Full events payload from `events_v2` |
| `GET` | `/api/v2/events/:id/registrations` | Registrations for a specific event + date |
| `POST` | `/api/v2/events/:id/registrations` | Public registration submission |
| `GET` | `/api/v2/home-ticker` | Home page ticker lines |

### Admin Endpoint Table

All require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Authenticate, get 24h session token |
| `GET` | `/api/admin/funnel-analytics` | Aggregate-only training-funnel reporting from the dev Pages Function |
| `GET` | `/api/admin/management` | All management records |
| `POST` | `/api/admin/management` | Create management record |
| `PUT` | `/api/admin/management/:id` | Update management record |
| `DELETE` | `/api/admin/management/:id` | Delete management record |
| `POST` | `/api/admin/media` | Create media item |
| `PUT` | `/api/admin/media/:id` | Update media item |
| `DELETE` | `/api/admin/media/:id` | Delete media item |
| `PUT` | `/api/admin/media-bulk` | Bulk upsert + optional Stream delete list |
| `POST` | `/api/admin/stream-direct-upload` | Get Stream one-time upload URL |
| `POST` | `/api/admin/stream-tus-upload` | Initialize Stream TUS resumable upload |
| `POST` | `/api/admin/stream-date-sync` | Sync media `created_at` from Stream metadata |
| `POST` | `/api/admin/images-direct-upload` | Get Cloudflare Images upload URL |
| `POST` | `/api/admin/images-delete` | Delete Cloudflare Images asset |
| `PUT` | `/api/admin/v2/destinations/:id` | Upsert destination record |
| `DELETE` | `/api/admin/v2/destinations/:id` | Delete destination record |
| `PUT` | `/api/admin/v2/events` | Upsert calendar/event data |
| `DELETE` | `/api/admin/v2/events` | Delete calendar event |
| `PUT` | `/api/admin/v2/home-ticker` | Update home ticker lines |
| `PUT` | `/api/admin/v2/events/:id/approval` | Approve or deny a registration |
| `DELETE` | `/api/admin/v2/events/:id/registrations/:regId` | Delete a specific registration |

---

## D1 Database Schema

Schema source: `workers/dmz-media-api/schema.sql`

### `media_items`
Media content records. `type` is `video` or `photo`. `stream_id` links to a Cloudflare Stream asset. `url` is the playback URL or file path. `meta` is a JSON string for flexible extra data. `sort_order` drives the "manual" sort on the media page. The `sort_order` column is added via a runtime migration (`ensureSortOrderColumn`) that runs `ALTER TABLE ... ADD COLUMN` and silently ignores the error if the column already exists — safe to run repeatedly.

### `admin_sessions`
Session token store. Cleaned up by expiry check on every `requireAuth()` call — no background job needed.

### `destinations_v2`
Each row is `(id TEXT, data_json TEXT, created_at, updated_at)`. The `data_json` blob is the full destination object including name, coordinates, description, images, bullets, and all travel detail content. The `id` matches the slug used in URL params (`?id=cozumel`).

### `events_v2`
Keyed by `calendar_key` (a string identifier for the event/template). `data_json` holds the full event payload which can include both explicit event instances and recurring templates. The management console's Calendar tab and the public events page both read from this table.

### `event_registrations_v2`
One row per registration submission. `source_id` + `event_date` form a composite index for fast lookups per event instance. `approval_status` is `pending` by default and can be set to `approved` or `denied`. `party_size` tracks group registrations.

### `site_settings`
Key/value store for miscellaneous site configuration. Currently used for the home ticker (`setting_key = 'home_ticker'`).

### `management_records`
Core business ops table. Indexed by `(record_type, status)` for filtered queries and by `due_date` for overdue calculations. The `data_json` column stores the `extras` object: financial fields, schedule data, roster, class sessions, registration email config, and any other type-specific fields that don't have their own column.

### Legacy Tables
`destinations`, `destinations_base`, `destinations_expanded` — exist in schema for backward compatibility. Active data uses `destinations_v2` only.

---

## The Events System

`js/events.js` is the largest single piece of logic on the public side. It runs in three contexts simultaneously from the same script load: `data-events-page` (full page), `data-events-preview` (home page section), and `data-events-embed-frame` (embeddable widget). Each context renders differently but uses the same data pipeline.

### Event Data Model

The `/api/v2/events` response carries a payload with two arrays:

- **`events`** — explicit single-instance events. Each has a `date`, optional `endDate`, `type`, `title`, `location`, `summary`, `time`, `endTime`, and registration config.
- **`templates`** — recurring event definitions. Each has a `startDate`, a `repeatInterval` + `repeatUnit` (`week`/`month`/`year`), optional `months` whitelist, optional `excludedDates`, and the same event fields.

`expandSiteEventPayload()` in `events.js` and `globe.js` runs this expansion client-side: it iterates templates from their start date forward for `horizonMonths` (default 30) months, generating one explicit instance per occurrence, filtering excluded dates and month whitelists. This means the calendar data stored in D1 is compact but the rendered calendar can show dozens of future events.

Multi-day events derive `durationDays` from the difference between `startDate` and `endDate`. The calendar view renders them spanning multiple date cells.

**Nth weekday rule (legacy):** The `nthWeekdayOfMonth()` function handles the legacy `rule: { weekOfMonth, weekday }` template format, computing "the 2nd Tuesday of each month" type schedules. New templates use explicit `startDate` + repeat interval instead.

### Registration Flow

1. User clicks an event with `registrationEnabled: true`
2. Event detail modal opens with a registration form
3. Form submits to `POST /api/v2/events/:sourceId/registrations?date=YYYY-MM-DD`
4. Worker validates capacity, creates a row in `event_registrations_v2`
5. Worker sends a confirmation email to the registrant via Resend (see Email System)
6. Registration appears in management console Signups tab with `approval_status: 'pending'`

### How the Calendar Relates to Management Records

Site calendar events are not management records — they are separate data. But the management console renders them side-by-side with management records in the Calendar tab. It does this by fetching both `GET /api/admin/management` and `GET /api/v2/events`, expanding the events, and interleaving them. Site event cards have a distinct visual style and link to the public event page. Clicking a site event card opens an editor that saves back to the events API, not the management records API.

When a class management record is saved, `syncClassRecordToCalendar()` pushes a corresponding site calendar entry automatically, so the class appears on the public calendar without a separate step.

---

## The Media System

The media gallery (`js/media.js`, ~88KB) is one of the most sophisticated features on the site.

### Data Sources

On load, two parallel fetches:
1. `GET /api/media` → video and photo items
2. `GET /api/v2/destinations` → destination records for the location filter

Destination names are mapped to location filter options so the media page's "Location" filter shows real destination names, not raw IDs.

### Supported Media Types

| Type | Playback method |
|---|---|
| Cloudflare Stream | `iframe.videodelivery.net/:id?autoplay=true` |
| YouTube | `youtube.com/embed/:id?autoplay=1&rel=0` |
| Local `.mp4` / `.webm` | Native `<video>` element with `autoplay` |
| Photo (any image URL) | Inline `<img>` |

Stream IDs are detected from `videodelivery.net` or `cloudflarestream.com` hostnames. YouTube IDs are extracted from `youtu.be/`, `?v=`, or `/embed/` URL patterns. Everything else falls through to image or local video.

### Video Poster Capture

For local video files, `captureVideoPoster()` seeks the video to 0.1 seconds, draws the frame onto a hidden `<canvas>`, and calls `toDataURL('image/jpeg', 0.82)` to create a base64 poster image. This means local videos always show a meaningful thumbnail without any server-side processing.

### Masonry Layout

Cards use a CSS-columns-based masonry layout. `queueMasonryUpdate()` uses `requestAnimationFrame` debouncing so that rapid-fire DOM changes (multiple videos loading aspect ratios) batch into a single layout recalculation.

### Reel Mode

Reel Mode converts the media page into a TikTok-style vertical feed. Implementation details:

- Locks `document.body` scroll by capturing `scrollY` and using `position: fixed` + `top: -${scrollY}px`
- Renders items in a scrollable `feedEl` container
- `IntersectionObserver` on each card detects when it enters the 60% viewport zone
- On entry: play the video (or load/resume it), update the title label
- On exit: pause and seek-to-start
- Sound control: uses a `WeakMap` (`reelRemoteControllers`) to track the active player for each card, so the sound toggle can reach into the right player instance
- HLS streams: lazy-loads `hls.js` from CDN if a stream URL needs it
- Audio unlock: the first Reel Mode open may need a user gesture to allow audio; Reel Mode stores `audioUnlocked` state and retries audio after the gesture

---

## The Globe

`js/globe.js` (~59KB) is a pure Canvas 2D interactive globe — no WebGL, no Three.js, no external library.

### Rendering

Device pixel ratio (`DPR`) is detected on load and applied to the canvas scaling transform. The globe is drawn each animation frame:

1. Draw ocean fill (radial gradient)
2. Project and draw country/coastline path data as filled polygons
3. Rotate the sphere using a continuous animation loop
4. Draw destination pins at projected lat/lon coordinates
5. Draw hover/selection highlight ring around active pin
6. Draw the info card for the selected destination

### Destination-Trip Status Coloring

Pins are color-coded based on the trip status computed from the events calendar:

| Status | Color | Meaning |
|---|---|---|
| `none` | Red `rgba(226,27,35,0.95)` | Destination exists, no trips planned |
| `planned` | Blue `rgba(85,185,255,0.95)` | Trip scheduled in the future |
| `soon` | Amber `rgba(255,193,69,0.96)` | Trip within 60 days |
| `active` | Green `rgba(35,209,143,0.96)` | Trip is currently happening |

`DESTINATION_EVENT_ALIASES` maps destination IDs to the text strings that might appear in event titles/locations. For example `cozumel: ["cozumel"]` and `greatlakesLM: ["lake michigan", "great lakes", "milwaukee", "two rivers", "door county"]`. `eventMatchesDestination()` normalizes and substring-matches against this alias list to determine if a calendar event is associated with a destination.

### Event Expansion on the Globe

The globe independently expands the events payload (same `expandTravelEvents()` function as `events.js`) and computes trip status per destination. This means the globe pin colors reflect the live calendar — a newly scheduled Cozumel trip will turn the Cozumel pin blue without any code change.

---

## The Quiz Engine

`js/quiz.js` implements two adaptive quiz modes in under 35KB.

### Two Modes

**Quick Recommendation (30 sec):** 9-question bank. About 5-6 questions actually appear per run depending on answers. Each question has a `when(answers)` predicate that gates it on previous answers — for example, `newGoal` only appears if `experience === "new"`.

**Dive Path Builder (2 min):** 15-question bank. More thorough, covers experience level, interests, comfort, timeline, travel goals, gear, frequency, team setup, and skill focus.

### Question Branching

`buildActiveQuestions(mode, answers)` filters the bank by evaluating each question's `when()` predicate against the current answers object. `refreshQuestionSet()` re-evaluates this on every navigation step and prunes answers for questions that are no longer active (preventing stale answer data from affecting the result when a user goes back and changes an earlier answer).

### Accessibility

The quiz modal uses `aria-hidden="true"` / `"false"` toggling, `role="dialog" aria-modal="true"`, and a focus trap (tab cycles within the card). Keyboard shortcut: `Escape` closes the quiz and returns focus to the element that opened it (`state.lastFocused`).

### Result + Contact Handoff

After the final question, the quiz renders a result screen with a recommended path and a **Start My Plan** CTA. The CTA links to `/pages/contact/?interest=<answer>&course=<answer>` — pre-filling the Dive Now form with the quiz's top recommendation. The quiz result screen also sends a summary email via `POST /api/contact` with `autoReplyType: "quiz-results"`.

---

## Email System (Resend)

All email delivery goes through [Resend](https://resend.com) via the Worker. The `from` address is always `no-reply@dmzscuba.com` (from `RESEND_FROM_EMAIL`). Replies go to `info@dmzscuba.com`.

### Contact Form Auto-Reply Selection

When `POST /api/contact` fires, the Worker picks the auto-reply template by checking the submitted fields in order:

1. Is `autoReplyType === "interest-list"`? → destination-specific template
2. Which destination was mentioned in `destination` or `location` fields?
   - Cozumel → `RESEND_TEMPLATE_COZUMEL` (or inline `buildCozumelInterestEmail()`)
   - Haigh Quarry → `RESEND_TEMPLATE_HAIGH`
   - Key Largo → `RESEND_TEMPLATE_KEY_LARGO`
   - Mermet Springs → `RESEND_TEMPLATE_MERMET`
   - Playa del Carmen → `RESEND_TEMPLATE_PLAYA`
   - Roatan → `RESEND_TEMPLATE_ROATAN`
   - Catalina / Southern California → `RESEND_TEMPLATE_CATALINA`
3. Is `autoReplyType === "quiz-results"`? → `RESEND_TEMPLATE_QUIZ_RESULTS`
4. Default → `RESEND_TEMPLATE_GENERAL_INQUIRY` (or plain-text fallback)

Each destination detection function checks both `destination` and `location` fields with normalized substring matching. Template IDs are optional env vars — if unset, the Worker falls back to inline HTML email builders that render the full branded email in code.

### Event Registration Emails

`sendEventRegistrationAttendeeEmail()` fires after each successful registration. It supports three rendering modes based on the event's registration email config:

1. **Resend template ID:** If `registrationEmailTemplateId` is set, uses Resend's template system with a `variables` object containing all merge tag values.
2. **Custom HTML body:** If `registrationEmailIsHtml` is true, renders the body as HTML within the standard DMZ branded email shell (`buildDmzEventEmailShell()`).
3. **Full custom HTML:** If `registrationEmailUseFullHtml` is true, renders the entire email from `registrationEmailFullHtml` after applying merge tag substitution.
4. **Plain text / default:** Generates a structured branded HTML email with event details, schedule, and party size from the `buildEventRegistrationConfirmationEmail()` function.

### Inline Email Templates

The Worker contains full branded HTML email templates for each destination inline (e.g., `buildCozumelInterestEmail()`). These are ~200-line HTML documents styled to match the site's dark ocean theme: dark backgrounds, `EAF2FF` text, rounded borders, gradient headers, DMZ branding. They are complete standalone emails — no external stylesheets or images beyond the logo.

---

## Training Section

```
pages/training/index.html                    Course catalog hub
pages/training/discover-scuba/index.html     Discover Scuba try-dive class
pages/training/open-water/index.html         Open Water Certification — $1099 for groups of 2-4
pages/training/specialty/index.html          Specialty course listing
  specialty/nitrox/index.html                Enriched Air / Nitrox
  specialty/wreck/index.html                 Wreck Diving
  specialty/drysuit/index.html               Drysuit
  specialty/full-face-mask/index.html        Full Face Mask
pages/training/advanced-specialty/index.html Advanced Specialty overview (multilevel page)
pages/training/skill-refresh/index.html      Skill Refresh program
pages/training/course-builder/index.html     Interactive course configurator (js/course-builder.js)
pages/training/interactive-tools/index.html  Physics education tools hub
  interactive-tools/boyles-law-demo.html     Boyle's Law pressure/volume simulation
  interactive-tools/color-loss-demo.html     Underwater color spectrum loss demo
pages/privacy/index.html                     Privacy policy for website forms, analytics, and advertising disclosures
```

Each specialty page follows the same structure: hero image, course overview, skills covered, who it's for, prerequisite, and a CTA that pre-fills the contact form with the relevant course interest.

**Interactive Tools:** The Boyle's Law and color loss demos are fully self-contained single HTML files (~265KB and ~124KB respectively). They include inline sprite sheets and animation logic. These are educational simulations for dive physics — the Boyle's Law demo shows how air volume changes with depth using animated visualizations.

**Course Builder** (`js/course-builder.js`) is a form-based tool that guides a student through selecting their current certification level, interests, goals, and preferred timeline, then generates a recommended course sequence and links to the contact form pre-filled with that sequence.

---

## Development Workflow

### Workspaces

| Repo | Local path | GitHub | Cloudflare Pages |
|---|---|---|---|
| Dev | `Y:\980 Evo\dmz-scuba site` | `dmz34705/DMZScuba.com` | `dmzscuba-com` (`dmzscuba-com.pages.dev`) |
| Live | `Y:\980 Evo\dmz-scuba-live` | `dmz34705/DMZScuba-live` | `dmzscuba-live` → `www.dmzscuba.com` |

**Always work in dev.** Live is only touched when Zach explicitly approves promotion of specific commits.

### Push Workflow

```powershell
# 1. Check state
git status --short --branch

# 2. Review changes
git diff --stat
git diff --check          # fails on trailing whitespace

# 3. Validate changed JS
node --check js\management.js
node --check workers\dmz-media-api\src\index.js

# 4. Stage specific files (avoid git add -A for large changes)
git add README.md js\management.js

# 5. Commit
git commit -m "clear description of what changed and why"

# 6. Push via the batch file
.\push.bat
```

`push.bat` flow: verify git repo → show status → `git pull --rebase --autostash` → `git add -A` → prompt for commit message (auto-timestamp if blank) → `git commit` → `git push origin main`.

### Worker Deployment

Only when Worker source changed:

```powershell
.\Deploy Worker.bat
# Runs: cd workers\dmz-media-api && npx wrangler deploy
```

### Live Promotion

1. Confirm Zach explicitly approved the specific commit(s) for live promotion.
2. `git -C "Y:/980 Evo/dmz-scuba-live" cherry-pick <commit-hash>`
3. `git -C "Y:/980 Evo/dmz-scuba-live" push origin main`
4. Verify Cloudflare `dmzscuba-live` deploy is green.
5. Run `.\Smoke Check.bat https://dmzscuba-live.pages.dev`

### Routing (`_redirects`)

```
https://dmzscuba.com/* → https://www.dmzscuba.com/:splat  301
http://dmzscuba.com/*  → https://www.dmzscuba.com/:splat  301
/api/*  → https://dmz-media-api.zacharylisowski55.workers.dev/api/:splat  200
/management  → /management/index.html  200
/training    → /pages/training/index.html  200
```

The `/api/*` proxy (200 status) is backed by the Pages Function at `functions/api/[[path]].js`. All it does is rewrite the URL and forward the request — no logic, no auth — so the Worker handles everything.

---

## Scripts Reference

| Script | What it does |
|---|---|
| `push.bat` | Interactive dev push: pull rebase, stage all, commit prompt, push to `origin main` |
| `Deploy Worker.bat` | Runs `npx wrangler deploy` in `workers/dmz-media-api` |
| `Smoke Check.bat` | Runs `scripts/smoke-check.mjs` against the dev Pages URL. Pass `--base <url>` for a different target |
| `Python Server.bat` | Starts a Python HTTP server for local static preview at `http://localhost:8080` |
| `Pcloudfare.bat` | Opens a Cloudflare tunnel for external access to the local server |
| `Test Media Logic.bat` | Runs `tests/media-logic.test.cjs` with Node |

**Smoke check** (`scripts/smoke-check.mjs`) validates: all public pages return 200 and contain expected HTML markers, key API endpoints respond, contact form POST returns success, media items load, and admin login works. Can skip API checks with `--skip-api`. Default timeout is 12 seconds per check.

---

## Repo and Deployment Structure

```
Y:\980 Evo\dmz-scuba site\
├── index.html                         Home page
├── management\index.html              Admin console (noindex)
├── quiz\index.html                    Quiz standalone page
├── pages\                             All public section pages
│   ├── about\  contact\  thanks\
│   ├── events\ (index, event, embed)
│   ├── media\
│   ├── travel\ (index, destination)
│   └── training\ (full subtree)
├── js\                                All JavaScript
│   ├── main.js                        Global nav, forms, telemetry
│   ├── management.js                  Console core (~170KB)
│   ├── management-*.js                12 console feature modules
│   ├── events.js  events-admin.js
│   ├── media.js  media-edit.js  media-logic.js
│   ├── globe.js
│   ├── destination.js  destinations-edit.js
│   ├── quiz.js
│   ├── travel-admin.js
│   ├── course-builder.js
│   └── home.js
├── css\
│   ├── base.css  components.css  main.css  responsive.css
│   └── pages\  (per-page stylesheets)
├── assets\
│   ├── data\  (JSON fallback files)
│   ├── images\ (hero, logos, globe earth tiles)
│   └── media\thumbnails\
├── functions\api\[[path]].js          Pages Function — API proxy
├── functions\api\admin\funnel-analytics.js  Authenticated aggregate funnel reporting
├── workers\dmz-media-api\             Cloudflare Worker
│   ├── src\index.js                   Worker source (~2800 lines)
│   ├── schema.sql                     D1 schema
│   └── wrangler.toml
├── wrangler.toml                       Dev Pages configuration and D1 binding
├── scripts\smoke-check.mjs
├── tests\media-logic.test.cjs
├── _redirects                         Cloudflare Pages routing rules
├── _headers                           Security headers
├── push.bat  Deploy Worker.bat  Smoke Check.bat
├── Python Server.bat  Pcloudfare.bat  Test Media Logic.bat
└── RELEASE-CHECKLIST.md
```

---

## AI Collaboration Guide

### Hard Rules

- **Default to dev.** `Y:\980 Evo\dmz-scuba site` only. Never touch `Y:\980 Evo\dmz-scuba-live` without explicit instruction.
- **Preserve local changes.** Never `git reset --hard`, `git checkout --`, or `git restore` without explicit instruction.
- **Validate JS before committing.** `node --check js\<file>` on any changed `.js` file.
- **Run `git diff --check`.** Trailing whitespace errors will block a clean commit history.
- **Use `push.bat` for pushes.** Do not run bare `git push`.
- **Only deploy the Worker if Worker source changed** or Zach explicitly requests it.
- **Mobile-first always.** The console must remain usable at ≤680px. Bottom tab bar + bottom sheet layout is non-negotiable.

### Architecture Rules

- `data_json` / `extras` fields are the escape hatch for per-type data. Do not add new D1 columns without good reason — extend `extras` first.
- When adding a new management record field, update: the HTML form in `management/index.html`, the `typeConfigs` field list in `management.js`, the `COLUMN_MAP` and `EXPORT_HEADERS` in `management-import-export.js`, and the Worker's `createManagementRecord` / `updateManagementRecord` handlers.
- When adding a new API route to the Worker, add it to the `if/else if` chain in the `fetch` handler and ensure CORS headers are included on all response paths.
- Do not introduce npm dependencies to the public site JS. No bundler, no `node_modules` in the site root.
- When touching destination data, update both `assets/data/destinations.json` (local fallback) and the Worker's `destinations_v2` table. IDs must match.

### Data File Conventions

- `assets/data/destinations.json` — globe + travel page fallback (dev only)
- `assets/data/destinations-expanded.json` — detailed destination data fallback (dev only)
- `assets/data/events.json` — events fallback (dev only, used when API unreachable)
- `assets/data/media.json` — media fallback (dev only)
- `assets/data/home-ticker.json` — ticker fallback (dev only)

In production, the API is always authoritative. Local JSON files are only read when `apiBase` is empty (i.e., when running from `file://` or `localhost` without the API wired up).
