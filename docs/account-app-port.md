# App workflows on the dev website

The website adapters reuse pure logic from `dmzscuba-app` revision `6cccd64`. `js/account-app-models.js` contains the app's Gear Locker, insurance helpers, planner, deterministic flight/non-flight booking parsers, and booking review/apply logic. `js/dive-profile-geometry.js` contains the app's profile geometry, including temperature smoothing and oxygen/setpoint scaling. No React Native or Expo runtime is required by these modules.

Regenerate after reviewing an app change:

```
node scripts/build-account-app-port.cjs C:/path/to/dmzscuba-app --check
```

The script pins the reviewed revision. Update that pin deliberately before regenerating for a newer app version. Browser UI and persistence stay in `account-profile.js`, `account-packing.js`, `account-diving.js`, and `account-planner.js`.

The profile sample cleanup is separately pinned to app revision `48f7707` in `js/account-profile-samples.js`. It reuses the exact schema cleanup and normalization functions: remove missing-depth event markers and legacy bare zero-depth rows in rich profiles, retain genuine surfacing and endpoints, and interpolate depth for sensor-only rows. This addresses Suunto EON event-marker spikes without a blanket spike filter. It applies to the displayed profile only; Sample Explorer, original JSON, and CSV still use every untouched synced sample. Selecting a raw marker in Sample Explorer opens the nearest retained profile point. Verify with `node tests/account-profile-samples.cjs` and the same generation check above.

## Workflows

- **Logbook:** interactive depth, temperature, multi-computer/multi-tank pressure, ppO₂ and setpoint traces; pointer scrubbing, keyboard navigation, zoom, computer selection, and expanded view. Readouts use nearest original sensor samples. Events are marked on the plot and listed separately. Sample Explorer displays every synced sample, including dynamically discovered nested fields, with paging and a complete sample CSV. JSON remains available as a source-record download, rather than the main inspection experience. Display-unit conversion never changes stored values; sample CSV/table use explicitly labeled SI units.
- **Gear Locker:** equipment, setups/packing, and service views. Packing uses the app's component/accessory keys, parent partial-check state, undergarment choices, setup questions, floating gear movement, and reset behavior. Setup updates preserve fields the website does not edit. Equipment component service records can be edited independently. Quick-dive checks stamp `checkedOn`, matching the app.
- **Trip planner:** the app's day timeline and continued stays, individual segment editing, connection information, actionable readiness checks, direct setup/extra-equipment selection, component-aware plan packing, and inline tasks. Quick-dive and plan checklists remain separate. Pasted booking emails use the app's deterministic parsers, review selection, duplicate replacement, and optional date extension before a save.

## Verification and current boundary

The account tools use a fixed viewport while open. Browser search, filters, view switching, creation, refresh, and export belong to the left record browser. The profile canvas and its sensor rail share the remaining area; all current sensor readings are visible rather than expanding a disclosure above the plot. On phones, the rail becomes a compact grid below the canvas. Other record tabs and forms retain their own scrolling. Leaving the tools or signing out restores normal page scrolling. Layout tests assert bounds for the complete plot, summary, readings, and time slider at 1440×900, 1366×768, 1024×768, 390×844, and 390×667.

Run `tests/account-app-port-browser.cjs` with Playwright to exercise desktop and phone interactions, all-sample export, packing persistence, itinerary edits, readiness inheritance, and reviewed booking imports. Existing account/sync tests continue to cover authentication and record isolation.

Photos, attachment files, and insurance-policy records are not part of the current sync protocol. The website does not pretend these local-only records are available. Booking text is parsed locally in the browser; smart/AI booking import and native file ingestion are not included. Profile inspection can show only the samples that the app has uploaded; it cannot reconstruct readings absent from the synced record. No live-site promotion is included.
