# Untamed Beverages

Next.js 15 / React 19 application for the public website, customer portal, and admin tools.
Repository: https://github.com/Untamedbevs/untamed

## Local setup

Use Node.js 22 or newer and npm. Install the versions pinned in the lockfile:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local # Only on a fresh checkout; do not overwrite existing secrets.
```

Fill `.env.local` with the existing **Untamed development** settings. The template contains
every variable referenced directly in `src/` and `scripts/`, plus AI Gateway authentication
used implicitly by the AI SDK. Empty values are unconfigured, not working demo credentials.
`.env.local` is ignored by Git; `.env.example` is safe to share.

```powershell
npm.cmd run env:check           # Core auth/database settings; lists other missing integrations.
npm.cmd run env:check -- --full # Requires all app integration groups.
npm.cmd run services:check      # Read-only connectivity/authentication checks; no generation or email.
npm.cmd run typecheck
npm.cmd run dev
```

Development runs at http://localhost:3003. Stop it before running a build because both
commands use `.next/`.

```powershell
npm.cmd run build
npm.cmd run start -- -p 3003
```

The environment checker reports names and presence, never credential values. A passing
check does **not** validate provider permissions, token expiration, database schema, or
external callback delivery. `--full` covers app integration groups; deployment-only Lambda
and webhook registration URLs still need review for their target environment.

## Integration settings

| Feature | Settings / source |
| --- | --- |
| Portal, admin, database routes | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from the correct Supabase project. The public key must be a publishable/anon key; the service role/secret key stays server-only. Keep this repository's exact variable names. |
| Local callback and referral links | `NEXT_PUBLIC_SITE_URL=http://localhost:3003`. Confirm this callback is allowed in Supabase Auth before testing sign-in: `http://localhost:3003/api/auth/callback`. |
| Uploads and media | Untamed's `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`; optional `MEDIA_CDN_URL`. Use development resources where available. |
| Public assets | Leave `NEXT_PUBLIC_SITE_ASSET_BASE_URL` blank to serve the checked-in `public/` assets. Set it only for an existing synchronized CDN prefix. |
| Studio generation | `FAL_KEY` for images/video; `AI_GATEWAY_API_KEY` or a current `VERCEL_OIDC_TOKEN` for AI SDK campaign planning. The Gateway requirement is implicit in `generateObject` with a string model. |
| Email | Transactional: `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_APP_PASSWORD` (relay defaults in the template). Marketing: Amazon SES plus the `SES_*` and `EMAIL_*` settings; see [the email runbook](docs/email/README.md). Marketing stays blocked locally until every required setting is present. |
| Meta | See [Meta setup](docs/ads/meta-api-setup.md). Ads, conversion events, and organic publishing have distinct requirements in the checker. |
| Orders | `ACCELPAY_API_TOKEN`, `ACCELPAY_WEBHOOK_SECRET`; the existing brand ID is `5008728`. The public layout also loads the live AccelPay cart for this brand independently of server credentials. |
| Background/internal routes | `CRON_SECRET`, `CE_OPS_SECRET`. Use independent random local secrets. `CRON_SECRET` also signs unsubscribe links, so use a stable matching value on each deployed environment. |
| Video processing | `MEDIACONVERT_ENDPOINT`, `MEDIACONVERT_ROLE_ARN`, `UGC_LAMBDA_WEBHOOK_SECRET`; see [Lambda setup](scripts/aws/lambda/untamed-video-processor/README.md). The app and Lambda must share the webhook secret. |
| Lambda / webhook registration | `APP_BASE_URL` on the Lambda and `WEBHOOK_BASE_URL` for the registration script must be externally reachable. Localhost alone cannot receive provider callbacks. |
| Analytics | Optional `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, Meta Pixel and Google Ads IDs. Leave them blank for local work unless deliberately testing events. |

Only `NEXT_PUBLIC_*` values belong in the browser bundle. Never place privileged tokens
or secret keys in public variables. Do not paste credentials into issues or commit messages.

Next loads local environment files automatically. Standalone scripts do not all do this;
on Node 22+, supply the file explicitly when needed, for example:

```powershell
node --env-file=.env.local scripts/generate-qr-samples.mjs
```

Asset sync, webhook registration, AWS setup, email, advertising, and commerce actions can
modify external services. Run them only for the intended environment and task.

## Database and deployment

`supabase/migrations/` contains existing schema history. Do not blindly apply it to a live
project: verify its migration history first, including the two files with the `00020` prefix.
No remote schema changes are part of local bootstrap.

Deployment is handled from repository changes. Local `.env.local` values are not pushed
to the deployment host. The deployment owner must maintain its environment settings and
external webhook/cron configuration. The local checkout does not require Vercel linking.

## Bootstrap validation (2026-10-19)

- Imported `main` at `c85a7fc46a84569e458c87a4ed08991d2f72183c` and verified it against GitHub.
- `npm ci` installed 506 packages from the existing lockfile.
- `npm run typecheck` passed using Node 25.8.1 / npm 11.11.0.
- `npm run dev` served the public homepage with HTTP 200 and the expected brand title.
- `npm run build` passed with the supplied local settings, including all 117 page generations.
- Environment inventory covers 45 directly referenced variable names plus SDK Gateway auth.
- The 21 supplied settings are stored in ignored `.env.local`; the Google app password's
  display spaces were removed. The site URL remains `http://localhost:3003`.
- All 11 read-only provider checks passed. The direct Postgres connection also passed
  an authenticated read-only query with certificate and hostname verification enabled.
- The missing influencer table was created using the repository's `00026` migration with
  explicit grants and staff-only RLS. Server writes and non-staff restrictions were checked
  inside a transaction that was rolled back; no test lead remains.
- This database has no Supabase CLI migration-history table. Do not replay all migrations.
- `CE_OPS_SECRET` and `UGC_LAMBDA_WEBHOOK_SECRET` remain local generated values; the latter
  has not been matched to a remote Lambda. `CRON_SECRET` uses the supplied value.
- Meta ads still needs `META_AD_ACCOUNT_ID`; organic publishing needs its Page/Instagram
  values. AccelPay reconciliation/webhooks need its API token and webhook secret.
- `npm run lint` currently exits into Next's configuration prompt: the upstream repository
  has no ESLint configuration.
- Actual sign-in/email delivery, paid generation, upload/transcode execution, and deployment
  environment settings remain outside the completed read-only checks.

See [the verification report](docs/local-setup-verification.md) for exact checks and limits.
