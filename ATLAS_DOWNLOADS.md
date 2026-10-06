# Mobile Ocean Atlas downloads

The mobile app checks `/assets/atlas/v1/manifest.json` for prepared, versioned JSON
snapshots. This is separate from the website's existing rendered Atlas page and
guide-engine bundles. It requires no Worker or database migration.

Generate a release from the app checkout:

```sh
cd /path/to/dmzscuba-app
npm run build:atlas-release -- --output-dir /path/to/DMZScuba.com
npm run test:atlas-updates
```

Commit `assets/atlas`, `_headers` and this document through the normal development
site workflow. The manifest must revalidate on each request. The JSON files have
content hashes in their names and can be cached indefinitely. Keep earlier files
when publishing an update so a device that already read the old manifest can
finish its download. The generator retains these automatically.

The app verifies the manifest version, each file's exact UTF-8 byte length and
SHA-256 checksum, and dataset structures. It changes its stored active pointer
only after the entire release has passed validation. Failed updates retain the
previous working Atlas. Source dates, licenses and attribution remain in each
dataset; the manifest's publication date is the snapshot's publication date,
not a claim that all source observations are recent.

For development-site testing, start Metro in the app checkout with:

```sh
EXPO_PUBLIC_ATLAS_ORIGIN=https://dmzscuba-com.pages.dev npx expo start --dev-client
```

The default app origin is `https://www.dmzscuba.com`. Live receives only the
specific tested commits approved for promotion under the existing release
workflow. A production app never falls back to development downloads.

The download package contains data only. Map code and editorial region guides
are still bundled with the app. Photos and detailed basemap tiles still require
internet; deliberate offline media storage is a subsequent phase.
