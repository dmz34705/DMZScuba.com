# DMZ Scuba Release Checklist

Use this checklist for every dev and live promotion cycle.

## 1) Dev Change and Validate (`dmzscuba-com`)

1. Confirm workspace and branch:
   - `H:/dmz-scuba site`
   - `git status --short --branch` should show `main`
2. Implement scoped change.
3. Run targeted checks:
   - Load changed page(s)
   - Verify key form submit still works where relevant
   - Verify media page + admin flow if touched
4. Commit and push dev repo:
   - `git add <files>`
   - `git commit -m "<message>"`
   - `git push origin main`
5. Confirm Cloudflare `dmzscuba-com` deploy is green (Production).

## 2) Live Promotion (`dmzscuba-live`) - Only When Explicitly Approved

1. Confirm user explicitly approved promotion to live.
2. Identify approved commit(s) in dev repo:
   - `git -C "H:/dmz-scuba site" log --oneline --max-count=10`
3. Confirm live workspace clean:
   - `git -C "H:/dmz-scuba-live" status --short --branch`
4. Cherry-pick approved commit(s) into live repo only.
5. Verify changed file(s) in live workspace.
6. Push live repo `main`:
   - `git -C "H:/dmz-scuba-live" push origin main`
7. Confirm Cloudflare `dmzscuba-live` deploy is green (Production).

## 3) Minimum Smoke Checks Before Signoff

1. Home page loads without console/runtime errors.
2. Contact page renders expected phone/email/name text.
3. Contact form submits and returns success.
4. Media page loads cards and filters.
5. Reel Mode opens and closes.
6. If media/admin touched:
   - admin login works
   - publish works
   - Stream upload queue works

## 4) Rollback Procedure (If Needed)

1. Identify bad commit in affected repo:
   - `git log --oneline --max-count=10`
2. Revert (do not reset):
   - `git revert --no-edit <commit>`
3. Push branch and verify deploy recovers.
