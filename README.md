# DMZScuba.com

DMZ Scuba is a static multi-page website deployed through Cloudflare Pages and backed by a Cloudflare Worker API. The public site covers training, travel, media, contact, about, and event registration flows. The admin surface supports media publishing, destination editing, site calendar data, home page ticker updates, and business management records.

## Status Snapshot

Current as of April 29, 2026.

Project maturity: active development on the dev site, with dev and live kept as separate repos.

Current strengths:
- Public site structure is stable across Home, Training, Travel, Media, Contact, About, Thanks, Events, and Travel Destinations.
- Worker API is live for media, contact delivery, destination v2 data, event/calendar data, home ticker data, admin auth, Cloudflare Stream uploads, and Cloudflare Images uploads.
- Media admin supports Stream uploads, draft/publish workflow, manual YouTube date handling, Stream date sync, and ordering/sort persistence.
- Destination editors are in place for both travel listing and destination detail content.
- The management console now acts as the main business operations workspace for contacts, inquiries, classes, trips/calendar records, tasks, event registrations, and the home page news ticker.

Primary remaining risk areas:
- No broad automated test suite. Regression coverage is mostly manual QA plus targeted syntax checks.
- Some older docs may lag behind the Worker endpoint surface.
- Dev and live repos must stay separated. Never promote to live unless explicitly requested.

## Management Console

The management console lives at `management/index.html` and uses `js/management.js` with page styling in `css/pages/management.css`.

Current console capabilities:
- Contacts: editable contact records, phone/email copy buttons, expandable profile details, sorting, and student class enrollment management.
- Inquiries: outgoing and incoming business inquiry tracking with category, direction, progress pipeline, next-step callout, follow-up date, owner, balances, and expandable inquiry details.
- Classes: class records with schedule/session details, enrolled students, capacity, remaining spots, and roster management.
- Calendar and trips: site calendar records are shown in the main record list using the same card style as other management records. Clicking a calendar card opens the editor, and site event links remain available.
- Registrations: event and class registration snapshots can be reviewed and converted into management/contact records where supported.
- Site tools: editable site areas include event/calendar data, media, destinations, and the home page news ticker.

The editor is modal-based. Record cards are for viewing and scanning; the editor is for making changes. Save or cancel before switching records.

## Development Workflow

Default workspace:
- Dev repo: `H:\dmz-scuba site`
- GitHub repo: `dmz34705/DMZScuba.com`
- Branch: `main`

Live workspace:
- Live repo: `H:\dmz-scuba-live`
- GitHub repo: `dmz34705/DMZScuba-live`

Rules:
- Work in the dev repo by default.
- Do not touch or push the live repo unless Zach explicitly asks to promote or push live.
- Preserve existing local changes. Do not use destructive git commands to discard work unless explicitly requested.
- When JS changes, run a targeted syntax check such as `node --check js\management.js`.
- Run `git diff --check` before committing.

Push workflow:
1. Check status:
   ```powershell
   git status --short --branch
   ```
2. Review changed files:
   ```powershell
   git diff --stat
   git diff --check
   ```
3. Run relevant validation.
4. Commit with a clear message.
5. Push dev changes using the repo's push batch file when working manually:
   ```powershell
   .\push.bat
   ```
6. Report the commit hash and confirm whether the working tree is clean.

## Claude And Codex Collaboration

Claude and Codex may both edit this dev repo. Treat any uncommitted changes as user or assistant work that must be preserved.

Claude handoff expectations:
- Claude can make focused edits in `H:\dmz-scuba site`.
- Claude should follow the same dev-only workflow and use `push.bat` for manual pushes.
- Claude should not promote to live.
- Claude should not reset, checkout, or revert unrelated changes.
- If Claude leaves changes unpushed, Codex can review, validate, commit, and push them from the dev repo.

Codex handoff expectations:
- Codex validates changed files before pushing.
- Codex reports the resulting commit hash.
- Codex does not modify `H:\dmz-scuba-live` unless Zach explicitly requests a live promotion.

## Helpful Scripts

Common repo scripts:
- `push.bat`: manual dev push helper.
- `Deploy Worker.bat`: Worker deployment helper.
- `Smoke Check.bat`: smoke-check helper.
- `Python Server.bat`: local static server helper.
- `Test Media Logic.bat`: media logic check helper.

Use the script that matches the task. Do not deploy the Worker unless the Worker API changed or Zach asks for it.
