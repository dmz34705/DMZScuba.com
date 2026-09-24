# Logbook and gear sync — development

The app and website use the existing Supabase identity. The new records live in a separate **development-only** D1 database, `dmz-account-sync-dev` (`892a7121-e461-4116-b113-b5370cdc4423`). Neither the shared `dmz-media-api` Worker nor its `dmz_media` database is deployed or migrated by this feature.

## Deployment

- Website: `https://dmzscuba-com.pages.dev/pages/account/#logbook` and `#gear`.
- Service: `workers/dmz-account-sync/`, deployed as `dmz-account-sync-dev`.
- Pages forwards `/api/account/sync/*` to that service. The mobile sync client uses the Pages origin; the existing profile/sign-in API keeps its existing origin.
- Apply `schema.sql` only to `dmz-account-sync-dev`, then deploy that Worker, then push the dev website. Do not run this schema against `dmz_media`.

## Behavior

- Guest use and offline edits remain available. First sign-in adopts the existing local records. Later account switches save and restore separate local account vaults, including device-only attachment references. Sign-out retains the last account's records on the device for offline use; they cannot upload to a different account.
- While signed in, the app syncs on login, foreground, manual **Sync now**, and every 30 seconds while active. There is no promise of background iOS execution. Network failures leave the records and pending changes on the device.
- Record kinds: `dive`, `computerLog`, `gear`, `setup`, `preferences`. Computer depth profiles and downloaded metadata are preserved. Gear components, assignments, and setup details travel as native JSON. Gear device dismissals and computer priority are included; existing profile and supported settings sync remains in place.
- Photos and gear documents are intentionally excluded from cloud records. Downloading record updates preserves the receiving device's attachments. Attachments do not appear on another device or the website.
- Each mutation names the server revision it was based on. SQL compares that revision atomically. Conflicting updates return HTTP 409 and never silently replace a different revision. Retry mutation IDs are persisted before uploading. Deletions leave server tombstones so other devices learn about them.
- The app retains both versions of a conflict and lets the diver choose in **Account → Review changed records**. Resolved originals remain in a local recovery archive. Website conflicts leave the editor draft open and ask the diver to review the newer record before retrying.
- A manifest is paginated at 500 rows; records are fetched separately. Requests are bounded at 1.5 MB per record. Oversized computer logs show a sync error and remain on the device; binary/chunked profile storage is a future extension.

## Security

The service derives ownership from the existing account API's verified token and active-account response, never from request JSON. Every database operation includes that owner. Responses are private/no-store. Refresh tokens continue to use iOS SecureStore, never AsyncStorage or website source.

This independent dev dataset is not yet integrated into the shared administrator merge/archive tools. Before promotion to the live site, implement account-data merge/export/erasure in that lifecycle and choose the production dataset and mobile endpoint together. Supabase account deactivation already blocks access to this service.

## Verification

- Website backend: `node tests/account-data-sync.test.cjs` (Node 24 with built-in SQLite).
- Existing account regression checks: `node tests/customer-accounts.test.cjs`.
- App: `node scripts/verify-account-data-sync.cjs`, `node scripts/verify-account-data-vault.cjs`, and existing auth, account, dive-log, and gear-checklist checks.
- Browser checks cover desktop/mobile layout, depth chart rendering, dive edits retaining computer links, and gear edits retaining components, using synthetic records without changing a real account.

Device acceptance: reload the updated app, sign in, open Account and wait for **synced**, then sign in with the same account on the dev website. Edit a dive note and gear service date on the website, bring the app to the foreground, and confirm both changes. Test an offline edit and reconnection, then an edit to the same record on two devices and conflict resolution. Keep local backups until device acceptance is complete.
