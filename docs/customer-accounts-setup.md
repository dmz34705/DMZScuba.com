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
3. Keep **Secure email change** enabled. The DMZ Scuba account page confirms one code from the current inbox and one from the new inbox.
4. Enable the setting that requires the current password for password changes.
5. Do not enable anonymous sign-ins.
6. Set the one-time code expiry to one hour or less.

The website intentionally rejects a signup that immediately returns a session because that indicates email confirmation is disabled.

## 3. Send six-digit codes through Resend

Connect the existing verified DMZ Scuba Resend domain to Supabase under **Authentication > Email > SMTP Settings**.

Use the Resend SMTP credentials:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: a dedicated Resend API key

Use a dedicated authentication sender such as `accounts@auth.dmzscuba.com`. Keep authentication email tracking disabled.

The account page verifies codes directly, so customers do not need to open an email link on the same device. In **Authentication > Email Templates**, replace these three templates.

### Confirm signup

Subject:

```text
Confirm your DMZ Scuba account
```

Body:

```html
<h2>Welcome to DMZ Scuba</h2>
<p>Enter this verification code on the DMZ Scuba account page to confirm your email address:</p>
<p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:24px 0;">{{ .Token }}</p>
<p>If you did not create a DMZ Scuba account, you can ignore this email.</p>
```

### Reset password

Subject:

```text
Reset your DMZ Scuba password
```

Body:

```html
<h2>Reset your DMZ Scuba password</h2>
<p>Enter this recovery code on the DMZ Scuba account page:</p>
<p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:24px 0;">{{ .Token }}</p>
<p>If you did not request a password reset, you can ignore this email. Your password will not change.</p>
```

### Change email address

Subject:

```text
Confirm your DMZ Scuba email change
```

Body:

```html
<h2>Confirm your email change</h2>
<p>A request was made to change the DMZ Scuba sign-in email from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>.</p>
<p>Enter the code from this email in the matching field on the DMZ Scuba account page:</p>
<p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:24px 0;">{{ .Token }}</p>
<p>For security, the change is completed only after the codes sent to both email addresses are verified. If you did not request this change, do not enter the code.</p>
```

The **Change email address** template is sent once to the current address and once to the new address when Secure email change is enabled. Each message contains its own code.

Also enable the **Password changed** and **Email changed** security-notification templates. These are alerts after a change succeeds and should tell the customer to contact DMZ Scuba immediately if they did not make the change. They do not use verification codes.

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
