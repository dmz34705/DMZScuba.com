# Training funnel telemetry

Training pages use the existing `/api/client-telemetry` endpoint through `window.DMZTelemetry`.

## Events

- `training_course_view`: Fires once when a mapped training landing, detail, hub, or request page initializes. Includes `course`, `device`, `source`, and `campaign`.
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
