# Training funnel telemetry

Training pages use the existing `/api/client-telemetry` endpoint through `window.DMZTelemetry`. The endpoint continues to write sanitized operational events to Cloudflare Worker logs and now persists the approved training-funnel events below in the `funnel_events` D1 table.

## Events

- `training_course_view`: Fires once when a mapped training landing, detail, hub, or request page initializes. Includes `course`, `device`, `source`, `medium`, `campaign`, and `content`.
- `training_cta_click`: Fires when a non-sticky training-page button link is clicked. Includes `course`, `label`, `destination`, `ctaType`, and `placement`.
- `training_sticky_cta_click`: Fires when a course-specific mobile sticky CTA is clicked. Uses the same details as `training_cta_click`.
- `training_sticky_cta_dismiss`: Fires when a visitor dismisses a training mobile CTA. Includes `course`.
- `training_internal_progression_click`: Fires when a non-button internal link moves a visitor between training pages. Includes `course`, `label`, and `destination`.
- `training_inquiry_form_start`: Fires once after the first course-request form interaction. Includes selected `course` and `sourcePage`.
- `training_inquiry_submit_attempt`: Fires on course-request submission before the existing form service runs. Includes `course` and `sourcePage`.
- `training_inquiry_completed`: Fires only after `/api/contact` returns a successful response for the course request. Includes `course`, `experience`, `group`, and `sourcePage`.
- `training_inquiry_form_abandoned`: Fires on page exit after a form start when no successful completion was recorded. Includes `course` and `sourcePage`.

Existing Google Ads parameters (`utm_*` and `gclid`) are preserved across internal training links. `source_page` records the original training-page path that started the internal journey.

The primary funnel metric is completed qualified inquiries per relevant landing-page session. CTA clicks and form starts are diagnostic metrics, not final conversions.

## D1 data policy

- Each event has a random event ID for idempotent inserts and a random per-tab session ID stored in `sessionStorage` for funnel grouping. The ID is not tied to a customer record or submitted form data.
- D1 stores the event type, site environment, page path, timestamps, and an event-specific allowlist of course, device, campaign label, CTA, destination-path, source-page, experience, and group fields.
- The browser sends a page URL without its query string or fragment. Source pages are reduced to a first-party path, `direct`, `unspecified`, or `external` before transmission.
- The Worker does not persist IP addresses, user-agent strings, names, email addresses, phone numbers, messages, form-field contents, `gclid`, or arbitrary event fields. Email- or phone-like values in approved text fields are discarded.
- Non-funnel operational events remain in sanitized Worker logs and are not inserted into D1.
- A daily Worker cron deletes funnel rows more than 400 days old. `FUNNEL_RETENTION_DAYS` can adjust this between 30 and 730 days.
