# Account layout deployment

Mobile layout changes are in `/Users/dmz/dmzscuba-app`. This checkout contains the matching account-service changes.

Local validation:

```sh
node tests/app-layout.cjs
```

Before deploying, authenticate Wrangler with the existing Cloudflare account. Check the remote database migration history and apply `migrations/0010_customer_app_layout.sql` exactly once, then deploy the Worker. Apply the additive database migration before the Worker so its queries can read `layout_json`.

The migration leaves existing account layouts null. Older clients preserve a saved layout when updating units. The mobile client keeps layouts locally until the server confirms the saved layout; failed uploads retry automatically.
