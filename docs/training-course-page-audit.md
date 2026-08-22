# Individual Training Page Audit and Migration Map

Date: 2026-08-22

## Scope

The current site contains eight individual course pages, one Open Water referral page, and one specialty chooser page. The main `/pages/training/` landing page, course builder, and interactive tools are outside the individual-page migration.

There are no existing detail pages for Deep Diver, Rescue Diver, or Divemaster. This migration will not invent those offerings or their standards.

## Existing shared system to preserve

- Global navigation, footer, buttons, mobile sticky CTA, and responsive shell.
- `main.js` course-view, CTA-click, sticky-CTA, and internal-progression telemetry.
- UTM and `source_page` forwarding into training links.
- Course Builder query-string selections and all existing internal links.
- Mobile sticky table of contents and horizontally scrollable feature-card behavior.
- Existing titles, descriptions, canonical URLs, course terminology, prices, prerequisites, inclusions, exclusions, locations, and scheduling language.
- Existing course-specific hero and lower-page imagery.

## Page inventory

### Open Water

- URL: `/pages/training/open-water/`
- Intent: primary beginner conversion page.
- Facts to retain: $1,099 per diver for groups of 2-4; $1,199 private total; $649 referral; $299 Discovery credit within 60 days; eLearning; classroom review; pool work; 4-6 included training dives; certification fees; pool rental gear; flexible payment; house-call academics; swim/float requirements; youth and junior-depth information; locations; excluded gear, travel, admissions, and added dives.
- CTAs: Open Water, private Open Water, youth training, referral, Discovery, questions.
- Positioning opportunity: lead with becoming a diver, then show access to local diving, travel, events, and future capability.

### Scuba Discovery

- URL: `/pages/training/discover-scuba/`
- Intent: supervised, lower-commitment first scuba experience.
- Facts to retain: $299 per person; full credit toward Open Water within 60 days; required eLearning; direct supervision; pool or condition-dependent open-water option; up to two hours on scuba; open-water location fees may vary; not an independent-diver certification.
- CTA: schedule Discovery or compare Open Water.
- Positioning opportunity: sell a real first underwater experience without overstating what the recognition permits.

### Open Water Referral

- URL: `/pages/training/open-water-referral/`
- Intent: complete academics and confined-water work locally, then checkout dives with a destination operator.
- Facts to retain: $649 per person for the local portion; SDI eLearning; classroom/house-call review; pool training; referral paperwork; destination coordination; destination dives, fees, rentals, travel, and destination-controlled processing are separate; destination acceptance and timing must be confirmed.
- CTA: plan referral training or compare full Open Water.
- Positioning opportunity: make the local-to-destination handoff visually obvious and keep responsibility boundaries prominent.

### Advanced Adventure

- URL: `/pages/training/advanced-specialty/`
- Intent: five coached dives that expand range and confidence after Open Water.
- Facts to retain: $599; Open Water prerequisite; five dives consisting of deep and navigation foundations plus three electives; materials, instruction, debriefs, certification; deposits/payment options; listed Midwest locations; optional destination training; exclusions and optional add-ons.
- CTA: plan Advanced Adventure or ask a question.
- Positioning opportunity: become comfortable saying yes to more sites and conditions without implying that a card alone creates competence.

### Skill Refresh

- URL: `/pages/training/skill-refresh/`
- Intent: rebuild current, relevant skills before returning to diving.
- Facts to retain: $399 session; custom focus; pool/confined-water/open-water options; buoyancy, trim, mask, regulator, navigation, air sharing, ascent, and problem-solving practice; certification card and personal gear guidance; rentals or recommendations; exclusions.
- CTA: plan a Skill Refresh.
- Positioning opportunity: normalize returning without pretending to remember everything and connect the session to the diver's actual next dive.

### Specialty chooser

- URL: `/pages/training/specialty/`
- Intent: comparison hub, not an individual certification page.
- Facts to retain: current four offered specialties; $399 per course; materials, instruction, required sessions, and certification fees; listed exclusions; course links and chooser CTA.
- Unique functionality: routes students to each specialty or the Course Builder.
- Positioning opportunity: make each card clearly state the capability and environment it supports.

### Nitrox

- URL: `/pages/training/specialty/nitrox/`
- Intent: enriched-air analysis and dive-planning capability.
- Facts to retain: $399; Open Water prerequisite; analysis, labeling, MOD, oxygen exposure, computer-based planning; private/group/bundle formats; included academic/practical work and certification; fills, rentals, transport, admissions, personal gear, and added dives excluded.
- CTA: plan Nitrox certification.
- Positioning opportunity: connect the skill to appropriate repetitive resort, liveaboard, and travel profiles without promising universally longer dives.

### Dry Suit

- URL: `/pages/training/specialty/drysuit/`
- Intent: cold-water comfort, buoyancy, and a longer Midwest season.
- Facts to retain: $399; Open Water prerequisite; fit, seals, thermal strategy, weighting, venting, trim, and emergency procedures; private/group formats; Midwest locations; inclusions and exclusions.
- CTA: plan Dry Suit training.
- Positioning opportunity: stop letting warm-water seasons determine when and where the diver can participate.

### Wreck Diver

- URL: `/pages/training/specialty/wreck/`
- Intent: approach planning, awareness, line basics, navigation, and low-impact technique around structure.
- Facts to retain: $399; Advanced Adventure or equivalent is recommended, not stated as mandatory; private/group formats; Midwest, Great Lakes, and travel location language; included training and excluded access/boat/site/gear costs.
- CTA: plan Wreck training.
- Positioning opportunity: connect to Great Lakes history and destination wrecks while avoiding unsupported penetration claims.

### Full Face Mask

- URL: `/pages/training/specialty/full-face-mask/`
- Intent: competency with a specialized breathing configuration.
- Facts to retain: $399; Open Water prerequisite; fit, setup, breathing, equalization, clearing, removal, recovery, emergency procedures, and communication considerations; private/group formats; mask rental or purchase excluded.
- CTA: ask about Full Face Mask training.
- Positioning opportunity: emphasize specialized capability, warmth, and practiced procedures rather than implying the equipment automatically creates longer dives.

## Current hierarchy problems

- The DMZ logo occupies the hero's visual summary position instead of helping answer price, prerequisite, and format questions.
- Repeated blocks such as “Best For,” “What Happens Next,” “Program Snapshot,” and “What Makes This Program Different” compete for the same early-page attention.
- The real-world outcome is present in copy but does not have a consistent, visually prominent component.
- Important facts are distributed across long pages rather than summarized near the top and grouped in a practical decision area.
- Course-specific photography is largely confined to background images and does not connect directly to the capability story.
- The pages use the same skeleton, but the shared system feels inherited rather than intentionally designed.

## Reusable course-page architecture

1. **Capability hero** — course name, outcome-led headline, concise proof, price/prerequisite summary, primary CTA, and practical secondary CTA.
2. **Sticky course navigation** — outcome, learning, logistics/pricing, and enrollment anchors; critical information remains directly accessible.
3. **Outcome panel** — a course-specific image and “what this unlocks” narrative with accurate real-world uses.
4. **Learning and process** — preserve existing skills, standards, and steps in scannable cards or timelines.
5. **Practical decision area** — price, prerequisites, format, inclusions, exclusions, equipment, locations, and scheduling remain crawlable and visible.
6. **Relevant DMZ difference** — select only the teaching benefits that matter for that course.
7. **Course-specific continuation** — go diving, prepare for travel, join local events, use the skill, or continue training only when useful.
8. **Low-pressure final CTA** — consistent Course Builder route plus a question/contact option.

## Implementation constraints

- Use one page-specific stylesheet and one small, progressively enhanced reveal script across the family.
- Keep all current page URLs and Course Builder values.
- Preserve `main.js` analytics hooks rather than replacing tracking.
- Keep course facts in HTML; do not hide price or prerequisites behind accordions.
- Motion must disable under reduced-motion preferences and must not alter scrolling behavior.
- Use existing responsive image assets and lazy loading below the hero.

## Analytics note

The existing shared telemetry already records course-page views, primary and secondary CTA clicks, sticky-CTA clicks and dismissals, and internal training-progression links. It does not currently emit dedicated events when a visitor reaches pricing, the outcome section, or the final CTA. This migration preserves the current analytics contract. A future analytics-only change could add consistent `course_outcome_reached`, `course_pricing_reached`, and `course_final_cta_reached` events through one shared observer after event naming and reporting requirements are confirmed.
