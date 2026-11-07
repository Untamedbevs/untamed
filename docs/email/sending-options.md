# Email sending after the SES denial

Written 2026-11-06. This is a recommendation only. No production code or DNS has changed.

## Recommendation in short

| Mail | Send through | Why |
| --- | --- | --- |
| Sign-in links, Hunt and reward notices, redemption alerts, lead notifications to staff | **Google Workspace SMTP (keep)** | Low volume. Already authenticated and working. Replies reach real inboxes. |
| CRM blasts, scheduled campaigns, test sends | **SendGrid Email API, Essentials ($19.95/mo)** | Its policy names alcohol as allowed with age gating. Sending through it keeps blast complaints and bounces off the Workspace account that sends sign-in links. |
| Referral warm intros (member emails a friend) | **Workspace SMTP for now**, pending counsel (see open questions) | The friend never opted in. SendGrid and Resend both forbid email without prior consent. |
| Transactional, later | **Postmark Basic ($15/mo)**, when a trigger below is hit | Built for transactional mail. Alcohol isn't on its prohibited list. |

Don't send any marketing blast through Workspace in the meantime. Nothing has been blasted yet: `messaging_campaigns` is empty, so nothing has to be undone.

## 1. What sends email today (`main`, 956e98a)

There's one transport, `src/lib/email/smtp.ts`. It uses nodemailer to `smtp-relay.gmail.com:587` by default (`GOOGLE_SMTP_HOST` can override it), with no pooling and retries on 4xx errors. Every sender goes through it:

| Sender | Path | Kind | Recipient | Unsubscribe headers |
| --- | --- | --- | --- | --- |
| Portal magic link | `src/lib/auth/send-portal-magic-link.ts` (calls `sendEmail` directly, writes a redacted log row, max 5 per hour per address) | Transactional | Member | No |
| CRM blast queue | `src/app/api/admin/crm/blast/route.ts` queues rows; `src/app/api/admin/messaging/process-scheduled/route.ts` (cron every minute) sends them | Marketing | Loyalty, referrers, distributors | Yes, RFC 8058 one-click |
| Blast test send | `src/app/api/admin/crm/blast/test/route.ts` | Marketing (to staff) | Staff | No |
| Rewards notices `hunt-approved`, `hunt-needs-changes`, `reward-on-its-way` | `src/lib/rewards/notify.ts` → `sendTemplateEmail` in `src/lib/email/templates.ts` | Transactional | Member | No |
| Referral warm intro | `src/app/api/portal/referrals/send/route.ts` + `src/lib/referral/warm-intro-email.ts` | Member-initiated, to a non-member | Friend | Yes |
| Redemption, claim, redeem alerts | `src/app/api/portal/{redemptions,rewards/claim,rewards/redeem}/route.ts` | Internal | `loyalty@` | No |
| Retail and influencer lead alerts | `src/app/api/distributor/lead/route.ts`, `src/app/api/influencers/apply/route.ts` | Internal | `joe.colella@` | No |

Everything except the magic link goes through `sendAndLogEmail` (`src/lib/messaging/email-log.ts`), which writes to `email_messages`.

**Volume**, from the `email_messages` table using the Supabase keys in the local `.env.local`:

- 38 outbound emails in total, sent 2026-09-25 to 2026-11-05, and 24 of them in the last 30 days. The busiest day had 3.
- By type: 22 retail-lead alerts, 13 magic links, 3 influencer-lead alerts. There have been no campaigns and no rewards notices yet.
- Every row's status is `sent`. Nothing ever records a bounce or a delivery.
- `email_suppressions` is empty. `email_webhook_events` has 11 rows, which look like SES sandbox tests.
- Possible blast audience: 132 loyalty members, 119 referral participants and 26 distributor leads. That's under 300 addresses before order buyers are counted.

Realistic volume over the next few months:

- Transactional: tens to a few hundred emails a month.
- Marketing: a weekly email to under 1,000 people, which is under 5,000 emails a month.

Every option below covers that on its cheapest paid tier.

## 2. The unfinished SES work (`codex/untamed-local-setup`, uncommitted)

I read this checkout without changing it. It's based on `e95dc37`, which isn't an ancestor of `main`, so landing it needs a merge.

The parts worth keeping, whichever provider is chosen:

- **`src/lib/email/transport.ts` + `src/lib/email/config.ts`.** Every send has a `stream` (`marketing` or `transactional`), and each stream picks its own transport through `EMAIL_TRANSPORT` and `EMAIL_MARKETING_TRANSPORT`. `getMarketingReadiness()` blocks blasts until the provider, the webhook, `EMAIL_POSTAL_ADDRESS` and `CRON_SECRET` are all set. This is exactly the split needed here. The only SES-specific part is the `ses` branch of `send()` and `getSesTransporter()`.
- **Consent model** (migrations `00027`, `00028`, `src/lib/messaging/consent.ts`): opt-in proof, 21+ attestation, a country filter and suppression checked again before each send. The 21+ attestation is what SendGrid's age-gating clause asks for. These migrations aren't applied to the live database.
- **Daily cap, warm-up table, quiet hours, sunset policy, auto-pause on complaint rate.** None of these depend on the provider.
- **Unsubscribe fix.** On `main`, a GET to `/api/unsubscribe` suppresses the address as soon as the link is opened, so corporate link scanners can unsubscribe people. The local branch makes opening the link harmless and only unsubscribes on the button press or the one-click POST.
- **SES webhook with SNS signature check** (`src/app/api/webhooks/ses/route.ts`, `src/lib/email/sns-verify.ts`). Keep it as a template for the new provider's webhook. It's dead code unless SES is approved later.
- `scripts/aws/ses/setup-ses.mjs` and the SES steps in `docs/email/README.md` can be parked.

## 3. Risks of blasting through Workspace SMTP

**Daily limits.** Google's published limits:

| Route | Limit per user per day | Other limits |
| --- | --- | --- |
| `smtp-relay.gmail.com` (the code's default) | 10,000 unique recipients and 10,000 messages | 100 recipients per SMTP transaction |
| Plain `smtp.gmail.com` | 2,000 messages and 2,000 unique external recipients | 500 on a trial account |

Going over a limit stops that user sending for up to 24 hours. Google says accounts that send spam can be suspended or restricted permanently.

The worker caps itself at `EMAIL_DAILY_LIMIT` (default 1,800), counted across **all** outbound rows. Magic links don't pass through that cap but do count against Google's limit. A blast that hits Google's ceiling would therefore stop sign-in emails for up to a day. Even an ordinary blast uses up the budget that rewards notices need.

**Deliverability and domain reputation.** Blasts would go out as `support@`, `loyalty@` or `orders@untamedbeverages.com`. Those are the same domain, the same Google sending IPs and partly the same mailboxes as staff mail and sign-in links. Spam complaints on a promotional alcohol email would count against `untamedbeverages.com` itself, and staff mail and sign-in links would start landing in spam too. Google and Yahoo's bulk-sender rules require:

- DMARC
- one-click unsubscribe
- a complaint rate under 0.3%

Untamed would have no way to measure that complaint rate (next point).

**Bounces and complaints.** SMTP returns only a "250 accepted". Bounces arrive later as bounce reports in the sending mailbox, where nothing reads them. Complaints are never reported. That's why every row in `email_messages` says `sent`, and nothing feeds `email_suppressions` except manual unsubscribes. Repeatedly mailing dead addresses is the fastest way to damage the domain.

**Unsubscribe headers.** `process-scheduled` and warm intros already send `List-Unsubscribe` with an https link and a mailto, plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. `/api/unsubscribe` handles the POST. That part is fine. Two gaps:

- `unsubscribe@` is a mailbox that someone has to process by hand.
- The open-link GET bug described in section 2.

The provider doesn't change either of these.

**Footer.** The footer on `main` (`src/lib/email/render.ts`) has no postal address and no privacy-policy link. CAN-SPAM requires the address on every marketing email, and SendGrid's policy requires both. The local branch adds the address through `EMAIL_POSTAL_ADDRESS`, but not a privacy link.

## 4. Provider comparison

These policies and prices were checked on 2026-11-06.

| | **SendGrid** (Twilio) | **Postmark** | **Resend** | **Mailgun** (Sinch) |
| --- | --- | --- | --- | --- |
| Alcohol in policy | **Explicitly allowed.** Twilio Email Policy, "Age Gating": senders of alcohol email must verify recipients are of legal age to consent, and show proof if asked. | Not on the prohibited list (porn, pharma, gambling, MLM and others). The catch-all lets them refuse email that "hurts our reputation". | Not on the prohibited list. A catch-all lets them refuse "high risk" businesses at their discretion. Unsolicited email of any kind is banned. | Not on the restricted list (payday loans, gambling without a license and others). |
| Marketing allowed | Yes, with affirmative consent, an unsubscribe link, a postal address and a privacy-policy link | Yes, in a separate Broadcast stream | Yes, through `/emails` with your own unsubscribe headers, or Broadcasts | Yes |
| Thresholds stated | "Unreasonable" complaints | Complaints under 0.1%, bounces under 10% | "High" bounce or complaint rates | Not stated |
| Price at our volume | Essentials 50K **$19.95/mo**. No free plan, only a 60-day trial at 100 a day. | Basic **$15/mo** for 10,000, then $1.80 per 1,000. Free tier is 100 a month. | Pro **$20/mo** for 50,000, no daily cap. Free tier is 3,000 a month but only 100 a day, too few for a blast. | Basic **$15/mo** for 10,000. Free tier is 100 a day. Logs kept 1 day. |
| Bounce and complaint webhooks | Event Webhook covering bounce, dropped, spamreport, unsubscribe, delivered, open and click, with ECDSA signatures | Webhooks for Bounce, SpamComplaint, Delivery and SubscriptionChange. Authenticated with basic auth in the URL; no payload signature. | Bounced, complained, delivered and others, signed through Svix. 5 endpoints on Pro. | Permanent failures, complaints and unsubscribes, signed with HMAC |
| Migration effort | SMTP relay (`smtp.sendgrid.net`, user `apikey`) fits the existing nodemailer path. One new webhook route. | SMTP fits too; the stream is chosen with the `X-PM-Message-Stream` header. One webhook route. | SMTP (`smtp.resend.com`) or REST. One webhook route. | SMTP or REST. One webhook route. |

**Why SendGrid for blasts.** It's the only one of the four whose policy addresses alcohol directly and permits it. After a denial, that's the strongest protection against another rejection or a later suspension. The age-gating condition matches the 21+ attestation already built on the local branch. Essentials includes 50,000 emails, room for about 50 sends to the current audience.

Its weak points:

- Essentials uses shared IPs.
- Twilio is known for strict signup review, so describe the opt-in and 21+ process when signing up.

**Fallbacks if SendGrid refuses.** Mailgun Basic, then a Postmark Broadcast stream. Postmark's 0.1% complaint ceiling is tight for promotional alcohol email. Ask either one in writing before building.

**Why Postmark later for transactional, not Resend or Mailgun.**

- Postmark's whole product is fast, reliable transactional delivery, which matters most for sign-in links.
- It keeps transactional and broadcast streams on separate infrastructure.
- Mailgun keeps logs for one day, which is too short for debugging.
- Resend is close behind Postmark and would be fine.

Not needed until one of these happens:

- transactional volume passes about 1,000 a month
- members report missing sign-in emails
- Google throttles the account

## 5. Code changes needed

Land them as a PR to `main`, in this order:

1. **Bring over the stream split** from the local branch:
   - `transport.ts` and `config.ts`
   - callers passing `stream: 'marketing'` from `process-scheduled` and `blast/test`
   - the unsubscribe GET fix
   
   Rename `smtp.ts` to `transport.ts` and update the 3 imports (`email-log.ts`, `send-portal-magic-link.ts`, `templates.ts`).
2. **Add a `sendgrid` transport.**
   - Extend `EmailTransportName` to `'smtp' | 'ses' | 'sendgrid'` and add a second nodemailer SMTP transporter: `smtp.sendgrid.net:587`, user `apikey`, pass `SENDGRID_API_KEY`.
   - Add an `X-SMTPAPI` header with `unique_args: { stream, campaign_id }`, and turn off SendGrid's own subscription tracking (`filters.subscriptiontrack.settings.enable = 0`) so our unsubscribe page stays the only one.
   - Leave click tracking off until link branding is set up.
   - Set `EMAIL_MARKETING_TRANSPORT=sendgrid`.
3. **Add `/api/webhooks/sendgrid`**, modelled on the SES route.
   - Verify `X-Twilio-Email-Event-Webhook-Signature` and `-Timestamp` against `SENDGRID_WEBHOOK_PUBLIC_KEY`.
   - Log each event to `email_webhook_events`.
   - `bounce` (type `bounce`) → `addSuppression(hard_bounce)`.
   - `spamreport` → `complaint`.
   - `unsubscribe` → `unsubscribe`.
   - `delivered` and `bounce` update `email_messages.status`.
   - Match on the `smtp-id` field, which equals the nodemailer Message-ID already stored in `ses_message_id`. Renaming that column to `provider_message_id` is optional.
4. **Separate the daily budgets.**
   - `process-scheduled` should count only marketing sends against `EMAIL_MARKETING_DAILY_CAP` (warm-up: 200, then 500, then 1,500).
   - Add a second guard so Workspace SMTP sends stay under about 1,500 a day.
   - Tag rows with the stream so both counts are possible. This needs a `stream` column on `email_messages`, or reuse `campaign_id IS NOT NULL`.
5. **Readiness check.** Replace the SES checks in `getMarketingReadiness()` with checks for `SENDGRID_API_KEY` and `SENDGRID_WEBHOOK_PUBLIC_KEY`. Keep the requirements for `EMAIL_POSTAL_ADDRESS` and `CRON_SECRET`. SendGrid also requires a privacy-policy link in every marketing email, so add it to the footer in `src/lib/email/render.ts` or `marketing-email.ts`.
6. **Remove the SES-sandbox error text** from `portal/referrals/send` (it says "SES send failed"). Leave warm intros on the transactional or SMTP stream until counsel answers.
7. **Later, for Postmark:** add a `postmark` transport (SMTP at `smtp.postmarkapp.com` with the `X-PM-Message-Stream: outbound` header) and a `/api/webhooks/postmark` route, then set `EMAIL_TRANSPORT=postmark`.

Estimated effort for steps 1–6: about 1–2 days including a staff-only test blast. Step 1 is most of the work, and it's mostly done on the local branch.

New Vercel env vars:

- `SENDGRID_API_KEY`, scoped to Mail Send only
- `SENDGRID_WEBHOOK_PUBLIC_KEY`
- `EMAIL_MARKETING_TRANSPORT=sendgrid`
- `EMAIL_MARKETING_DAILY_CAP`
- `EMAIL_POSTAL_ADDRESS`

## 6. DNS records

Current records, checked with public DNS on 2026-11-06:

| Record | Value |
| --- | --- |
| `untamedbeverages.com` TXT | `v=spf1 include:_spf.google.com include:amazonses.com ~all` |
| `google._domainkey` | 2048-bit Google DKIM in place |
| `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@untamedbeverages.com` |
| `bounce.untamedbeverages.com` | SES custom MAIL FROM (MX + SPF) |
| MX | Google |

To add for SendGrid, using Domain Authentication with automated security on. The exact hostnames and targets come from the SendGrid dashboard:

| Type | Host | Points to |
| --- | --- | --- |
| CNAME | `em####.untamedbeverages.com` (return path) | `u#####.wl###.sendgrid.net` |
| CNAME | `s1._domainkey.untamedbeverages.com` | `s1.domainkey.u#####.wl###.sendgrid.net` |
| CNAME | `s2._domainkey.untamedbeverages.com` | `s2.domainkey.u#####.wl###.sendgrid.net` |
| CNAME (optional, for click tracking) | `url####.untamedbeverages.com` and `#####.untamedbeverages.com` | `sendgrid.net` |

- **SPF.** The root record needs no change for SendGrid: its SPF check runs on the `em####` return-path subdomain. Remove `include:amazonses.com` from the root once SES is formally given up. It only costs a DNS lookup today, and the SES MAIL FROM subdomain has its own SPF. Delete the `bounce.` records at the same time.
- **DKIM.** SendGrid signs as `d=untamedbeverages.com` through `s1` and `s2`, Google through `google`. Both align with the From domain, so DMARC passes.
- **DMARC.** Keep `p=none` while switching over. After 2–4 weeks of aggregate reports showing only Google and SendGrid, move to `p=quarantine; pct=100`, then `p=reject`. Optionally add `adkim=r; aspf=r` explicitly.
- **Postmark, later.** One DKIM TXT record at `<timestamp>pm._domainkey.untamedbeverages.com` and a return-path CNAME `pm-bounces.untamedbeverages.com` → `pm.mtasv.net`.
- **Monitoring.** Verify the domain in Google Postmaster Tools (a TXT record) before the first blast.

## Open questions for Eric

1. **Did AWS give a reason for the SES denial?** If it was "not enough detail" rather than the content, a second request could succeed. It would need the opt-in process, 21+ gating, list size (under 300) and bounce handling. All the SES code already exists. Do you want to try once more before signing up for SendGrid?
2. **Who signs up for SendGrid, and under which Untamed account?** It shouldn't be a Company Engineers account. The signup asks about content type and list source, so expect a review.
3. **Is production on `smtp-relay.gmail.com` or `smtp.gmail.com`?** That decides whether the Workspace ceiling is 10,000 or 2,000 a day. Check `GOOGLE_SMTP_HOST` in Vercel.
4. **Should marketing come from the root domain or a subdomain?** The plan above keeps `loyalty@untamedbeverages.com` as the From address. A subdomain such as `news.untamedbeverages.com` would separate blast reputation from staff mail. It's worth it once the list grows past a few thousand, at the cost of a less familiar From address.
5. **Counsel: are referral warm intros allowed?** The friend never opted in. That breaks SendGrid's and Resend's consent rules and is why they stay on Workspace for now. Is a member-initiated invite acceptable to counsel, or should it become a share link the member sends themselves?
6. **Should the `codex/untamed-local-setup` email work land in `main` first?** It means migrations `00027` and `00028`, the consent model and the readiness checks. This plan assumes yes: blasting before the consent model is live would rely on the loyalty signup counting as marketing opt-in, which the Terms say it doesn't.
7. **Postal address for CAN-SPAM.** `EMAIL_POSTAL_ADDRESS` needs a full street address or a registered PO box. What should it be?
