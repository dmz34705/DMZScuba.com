# DMZ Scuba Customer Accounts Setup

The dev repository contains the customer account foundation. The account page stays disabled until the Worker has a Supabase project URL and publishable key.

## 1. Create the Supabase project

1. Sign in to Supabase and create a project named `dmz-scuba-accounts`.
2. Use a unique database password and save it in the team's password manager. The website and Worker do not use this password.
3. Choose the US region nearest DMZ Scuba's customers.
4. Open **Project Settings > API**.
5. Copy the **Project URL** and the **publishable key**. Do not copy, send, or commit the `service_role` key.

These two public-client values are needed for the Worker configuration:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

## 2. Require verified email addresses

In **Authentication > Providers > Email**:

1. Keep email/password signup enabled.
2. Enable email confirmation.
3. Do not enable anonymous sign-ins.
4. Set the one-time code expiry to one hour or less.

The website intentionally rejects a signup that immediately returns a session because that indicates email confirmation is disabled.

## 3. Send six-digit codes through Resend

Connect the existing verified DMZ Scuba Resend domain to Supabase under **Authentication > Email > SMTP Settings**.

Use the Resend SMTP credentials:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: a dedicated Resend API key

Use a dedicated authentication sender such as `accounts@auth.dmzscuba.com`. Keep authentication email tracking disabled.

Update the signup-confirmation and password-recovery templates to prominently display `{{ .Token }}` as a six-digit code. The account page verifies codes directly, so the customer does not need to open an email link on the same device.

## 4. Add abuse protection

Create a Cloudflare Turnstile widget for the dev and live DMZ Scuba domains. In Supabase, enable CAPTCHA protection under **Authentication > Bot and Abuse Protection** and select Cloudflare Turnstile.

Add the public Turnstile site key to the Worker as `TURNSTILE_SITE_KEY`. The account portal remains disabled until Supabase and Turnstile are both configured. Do not enable public signup until the protection has been tested.

## 5. Configure and migrate the dev Worker

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the dev Worker environment. Never use the Supabase service-role key.

Apply the account migration before deploying Worker code:

```powershell
cd "Y:\980 Evo\dmz-scuba site\workers\dmz-media-api"
npx wrangler d1 migrations apply dmz_media --remote
```

The Worker currently serves both DMZ Scuba site projects. Deploying it affects the live API, so deployment requires explicit live approval after dev validation.

## 6. Mobile app configuration

Use the same Supabase project URL and publishable key in the mobile app. The app sends its Supabase access JWT to the DMZ Worker in the `Authorization: Bearer <token>` header. The Worker uses the JWT `sub` claim as the same `customer_profiles.user_id` used by the website.

Store mobile refresh tokens only in the platform's secure credential storage. Do not put refresh tokens in ordinary app preferences or logs.
