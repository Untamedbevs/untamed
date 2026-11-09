# Untamed local setup verification

Verified October 19, 2026. Credential values are stored only in ignored `.env.local`.

## Configuration

- Merged 21 supplied settings while preserving the local site URL and existing local-only
  ops/webhook secrets. Normalized display spaces out of the Google app password.
- Stored `Postgres_Link` using its supplied name. The application uses Supabase HTTP APIs;
  it does not consume this administrative connection string.
- Supabase's public CA was downloaded to `.git/info/supabase-prod-ca-2021.crt` for the direct
  database check. The connection verified the CA and hostname; certificate verification
  was not disabled. The certificate URL comes from
  [Supabase's official Studio configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).

## Completed checks

| Check | Result |
| --- | --- |
| Production build | Passed compilation, type validation, and all 117 page generations |
| Public routes | `/`, `/referral`, `/influencers`, `/admin/login`, `/portal/login`: HTTP 200 |
| Private route protection | `/admin` and `/portal`: HTTP 307 to sign-in when unauthenticated |
| Location API | `/api/locations`: HTTP 200 |
| Supabase public auth settings | Public key accepted |
| Supabase service key | Zero-row database SELECT accepted; all 39 source-referenced tables exposed |
| Direct Postgres | Authenticated query over verified TLS passed |
| S3 | Existing site asset readable in the expected AWS account |
| S3 CORS | `http://localhost:3003` allowed for PUT uploads |
| Media CDN | Configured site-asset URL returned HTTP 200 |
| MediaConvert | Job listing authorized; no transcode submitted |
| Fal | Authenticated model catalog accepted; no generation submitted |
| AI Gateway | Key accepted, positive credits, and the app's campaign model present in catalog |
| Google SMTP | STARTTLS connection and authentication accepted; no message sent |
| Meta | Token identity and configured Pixel metadata accepted; no events sent |
| Browser-output credential scan | No supplied private credential values found in 231 static build files |

An initial SMTP connection failed transiently. Separate relay/Gmail authentication checks
and the final service check passed using the configured SMTP relay. The reusable check
retries transient SMTP connection failures once.

## Database change actually applied

The project lacked `public.influencer_leads`, so creator applications and the influencer
admin screens could not use their expected table. Applied only the existing
`supabase/migrations/00026_influencer_leads.sql` inside a transaction, with explicit grants
and RLS policies restricted to active staff. Added an explicit UPDATE `WITH CHECK`.

Verified:

- RLS is enabled, both policies target `authenticated`, and UPDATE has `WITH CHECK`.
- Service-role insertion and updating work.
- A non-staff identity cannot read or update a verification row.
- Anonymous table privileges and authenticated INSERT/DELETE privileges are denied.
- The verification row was rolled back; no sample lead was retained.
- The table is now available through the Supabase Data API.

The database had no `supabase_migrations.schema_migrations` table. This was a targeted
existing-schema repair, not a replay of migration history. Existing tables and customer
records were not changed.

## Remaining configuration and practical limits

- Meta ads: `META_AD_ACCOUNT_ID` is missing. The CAPI token's accepted Pixel access does
  not prove that it has Marketing API permissions for an ad account.
- Organic publishing: `META_PAGE_ACCESS_TOKEN`, `META_FB_PAGE_ID`, and `META_IG_USER_ID`
  are missing.
- AccelPay server-side reconciliation and signed callbacks: `ACCELPAY_API_TOKEN` and
  `ACCELPAY_WEBHOOK_SECRET` are missing. The existing public cart still has its own brand setup.
- Optional Google analytics/ad IDs remain blank.
- `UGC_LAMBDA_WEBHOOK_SECRET` is a local generated value, not a verified remote shared
  secret. MediaConvert read access does not prove `CreateJob` / `iam:PassRole` permissions.
- SMTP login is verified; message delivery and sender-alias behavior were not exercised.
- No paid inference, email, conversion event, S3 upload, ad action, or transcode was submitted.
- Sign-in was not exercised with a real user, and Auth redirect allowlisting was not changed.
- Lint still requires configuration in this upstream repository.
- These settings are local. No Git push or deployment was performed; the deployment owner
  must maintain its environment settings separately.

Run `npm run env:check` for core settings, `npm run env:check -- --full` for all feature
groups, and `npm run services:check` to repeat the read-only provider checks.
