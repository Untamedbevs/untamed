# Email system

Marketing email, consent records, automation, outreach, and deliverability for
untamedbeverages.com. All six phases of the email roadmap are built:

| Phase | What | Where to read more |
| --- | --- | --- |
| 0–2 | Legal fixes, Amazon SES sending, contacts with provable consent | this file |
| 3 | Website signup forms, double opt-in, preference center | [signups.md](signups.md) |
| 4 | Templates, scheduling, segments, automated flows, reporting | this file, "Phases 4 and 6" |
| 5 | Gmail conversation sync, one-to-one outreach, follow-up sequences, contact timeline | [gmail-and-outreach.md](gmail-and-outreach.md) |
| 6 | Approvals, content checks, alerts and auto-pause, audit log, retention | this file, "Phases 4 and 6" |

Database: migrations `00027_email_contacts_and_consent.sql` and `00028_email_platform.sql`.

## How it fits together

```
loyalty_members ─┐
loyalty_orders ──┤ database triggers      email_apply_consent()        email_suppressions
referrals ───────┼──────────────────► email_contacts ──► email_consents ◄──── (bounce, complaint,
wholesale leads ─┤ (one row per                │         + email_consent_events     unsubscribe,
creator apps ────┤  address, no consent)       │           (append-only proof)      deletion)
contact form ────┘                             ▼
                                    blast planner (admin)  ── audience filters, then consent rules
                                               │
                                               ▼
                                    scheduled_messages ──► cron worker (re-checks consent per batch,
                                                           daily cap, rate limit)
                                               │
                    marketing: Amazon SES ◄────┴────► transactional: Google Workspace (or SES)
                               │
                               ▼  SNS topic ses-events-untamed
                    /api/webhooks/ses (signature-verified) ──► email_messages status,
                                                              suppressions, consent events
```

| Piece | Where |
| --- | --- |
| Schema, triggers, consent and recipient functions | `supabase/migrations/00027_email_contacts_and_consent.sql` |
| Settings and the "can marketing send?" check | `src/lib/email/config.ts` |
| SES / Google Workspace transport | `src/lib/email/transport.ts` |
| Consent records, eligible recipients | `src/lib/messaging/consent.ts` |
| Permission-request and checkout wording (legal text) | `src/lib/email/consent-copy.ts` |
| Marketing footer (reason, unsubscribe, postal address, 21+) | `src/lib/messaging/marketing-email.ts` |
| Signed unsubscribe / confirm links | `src/lib/messaging/unsubscribe.ts` |
| Blast planning and sending | `src/lib/crm/blast-plan.ts`, `src/app/api/admin/crm/blast/`, `src/app/api/admin/messaging/process-scheduled/` |
| SES event webhook + SNS signature check | `src/app/api/webhooks/ses/route.ts`, `src/lib/email/sns-verify.ts` |
| Public pages | `/unsubscribe`, `/email/confirm` (permission request), `/subscribe`, `/email/confirm-signup`, `/email/preferences`, plus the signup form in the footer, homepage, and shop ([signups.md](signups.md)) |
| Staff pages | `/admin/crm/contacts`, `/admin/crm/blast` |

## Rules the code enforces

- **No opt-in, no marketing.** A marketing blast targets one list. Only contacts with a
  recorded opt-in for that list receive it. Audience filters can only narrow that set.
- **Every opt-in carries proof**: the exact wording, its version, time, IP, browser,
  country, and source. Staff-recorded opt-ins need an admin and a written evidence note.
  Consent events can't be edited.
- **21+ lists** (all consumer lists) also require a recorded 21+ attestation.
- **Countries**: contacts known to be outside `EMAIL_MARKETING_COUNTRIES` (default `US`)
  are skipped. Unknown country is allowed.
- **Suppression wins.** Unsubscribe, complaint, hard bounce, manual block, and deletion
  requests stop all marketing. A fresh opt-in lifts only a plain unsubscribe.
- **Checked twice.** Eligibility is applied when a blast is queued, and again for each
  batch right before sending.
- **Unsubscribe works without friction.** One-click from mail apps (RFC 8058) or one
  button on `/unsubscribe`. Opening a link never changes anything, so security scanners
  can't unsubscribe people. The 21+ age gate is skipped on email pages.
- **Email-link URLs stay private.** `/unsubscribe` and `/email/*` URLs carry a token that
  identifies the recipient. Those pages load no Meta, Google, or AccelPay scripts and
  record no page views (`src/lib/email/private-paths.ts`).
- **Marketing won't send half-configured.** The blast API refuses, and the worker leaves
  messages queued, until SES, its configuration set, the webhook topic, the postal
  address, and `CRON_SECRET` are all set. The blast page lists anything missing.
- **The permission request goes once per contact**, only to people who have never opted
  in or out, and only after its wording is approved.
- **Webhook trust.** Only SNS messages with a valid Amazon signature from a topic in
  `SES_SNS_TOPIC_ARNS` are processed. Retries are deduplicated.

## Phases 4 and 6: day-to-day email

Staff areas live under **CRM** in the admin:

| Page | What it's for |
| --- | --- |
| `/admin/crm/email` | Dashboard: deliverability (30-day bounce/complaint/click rates against thresholds), alerts, sends today vs the daily cap, automated flows, campaign results with attributed revenue, list growth, and the marketing kill switch |
| `/admin/crm/blast` | New campaign: list, audience and segments, block editor or template, live preview at desktop and phone width, content checks, test send, send now or schedule |
| `/admin/crm/blast/[id]` | Campaign status: approve/reject, pause/resume/cancel, results, preview |
| `/admin/crm/email/flows` | Automated flows (roadmap point 26): status, trigger, results; each flow's steps are edited on its own page |
| `/admin/crm/email/templates` | Reusable designs for campaigns, flows, and outreach |
| `/admin/crm/email/settings` | Kill switch, sending policy, setup status, staff activity log (admins) |

### Automated flows (point 26)

Flows send themselves when something happens. All of them ship as **drafts**: review the copy,
send yourself a test from the step editor, then press Activate (admins only; activation is
refused while any step fails the content checks).

| Flow | Starts when | Type |
| --- | --- | --- |
| Welcome series | First opt-in to a consumer list | Marketing (Loyalty & community) |
| After an order | Every online order. Step 1 (3 days): how's it going, share for points. Step 2 (18 days later): reorder reminder, skipped if they've already reordered | Marketing |
| Win back | No order for 60 days (configurable). Ends the moment they order | Marketing (Offers) |
| Referral credit earned | Referral points credited (friend joined: 1,000; friend's first purchase: 5,000). Shows the new balance and the rewards it covers, then a reminder after 7 days if they haven't redeemed | Account notice |
| Points ready to redeem | Balance covers a reward and no redemption in 30 days | Account notice |
| Redemption received / Reward on its way | A redemption is placed / staff mark it fulfilled. Cancelled automatically if the portal rolls the redemption back | Account notice |
| Birthday | The birthday saved in email preferences | Marketing (Offers) |
| Abandoned cart | Not available: the AccelPay cart doesn't report carts or emails before checkout | — |

**Previous orders** drive the order flows. Every contact carries order count, first and last
order date, total spent, and US state (from the shipping ZIP). Segments use the same fields:
"Min total spent", "Bought product", "State", and engagement (opened/clicked within N days).
The contact page shows the full order history.

**Referral credit = redemption process.** Referral rewards are loyalty points. The referral
flow tells the member what they earned and links straight into the rewards catalog. The
redemption flows then confirm the redemption and its fulfillment. Together they cover the
whole credit-to-redemption path.

*Marketing* flows follow every campaign rule: opt-in to the step's list, 21+, not paused or
sunset, quiet hours, weekly cap, daily cap, kill switch. *Account notices* don't need a list
opt-in (they're about the member's own account), but anyone who unsubscribed, bounced,
complained, or asked for deletion is never emailed.

### Campaign lifecycle and approvals

Submit → (if needed) **pending approval** → queued **now** or **scheduled** → sending → sent.
A second admin must approve when:
- a contractor submitted the campaign
- it's the permission request
- it goes to more people than the approval threshold (Settings, default 500)

The submitter can't approve their own campaign. Recipients are re-checked against consent
when the campaign is approved, when it's queued, and again right before each send. Any
queued campaign can be paused, resumed, or cancelled.

Roles:

| Role | Can do |
| --- | --- |
| Super admin, admin | Send, approve, activate flows, change settings, record opt-ins, export/delete data |
| Full contractor | Draft campaigns and submit them for approval; edit templates and flow copy |
| Limited contractor | No access to contacts, outreach, or email settings |

### Sending policy (Settings)

- **Weekly frequency cap**: at most N marketing emails per person per 7 days. Campaign sends
  over the cap are skipped; flow steps wait a day.
- **Quiet hours**: no marketing between 21:00 and 08:00 in the recipient's time zone (saved
  time zone, else their state, else the default). Messages wait until the window opens.
- **Sunset**: people who haven't opened or clicked in 180 days after 8+ emails stop getting
  marketing until they engage again (an open, click, or reply resets it).
- **Content checks** run on every campaign and flow step:
  - errors block sending: empty or fake "RE:" subjects, unknown or broken merge tags,
    buttons without a link, health claims, wording that appeals to under-21s
  - warnings are shown for a person to judge: all-caps subjects, spam phrases, missing alt
    text, too many links, HTML over Gmail's 102 KB clipping limit

### Alerts, auto-pause, retention, audit

- A campaign is **auto-paused** when its complaint rate passes 0.3% or its hard-bounce rate
  passes 5% (after 100 sends). All marketing is **paused** when the 7-day complaint rate
  passes the threshold (after 500 sends). Both raise an alert on the dashboard and email
  `EMAIL_ALERT_RECIPIENTS`.
- Failed send runs, flow failures, and Gmail sync failures also raise alerts, at most once a
  day per problem.
- **Retention** runs daily:
  - email bodies older than the retention setting (default 365 days) are cleared; who,
    when, and status are kept
  - raw SES webhook payloads and finished queue rows are dropped after 90 days
  - consent evidence is never purged
- The **staff activity log** records:
  - sends, schedules, approvals, rejections, pauses, cancels
  - flow activation and edits, template changes
  - consent changes, exports, deletions
  - settings changes and test sends

### Crons (vercel.json)

| Path | Schedule | Does |
| --- | --- | --- |
| `/api/admin/messaging/process-scheduled` | every minute | Sends queued campaign emails |
| `/api/cron/email-flows` | every 10 min | Sends due flow steps |
| `/api/cron/email-daily` | 14:00 UTC | Time-based flow triggers, 7-day health check, retention, expire signup requests |
| `/api/cron/gmail-sync` | every 10 min | Logs conversations with known contacts; processes `unsubscribe@` |
| `/api/cron/outreach` | every 15 min | Sends due outreach sequence steps |

## Current state (checked 2026-11-05)

- DNS: SPF, DMARC (`p=none`, reports to `dmarc@`), Google DKIM, and the SES custom
  MAIL FROM (`bounce.untamedbeverages.com`) are all in place.
- SES (us-east-1): domain verified, DKIM signing, account suppression on. **Still in the
  sandbox**: 200 emails/day, 1/second, verified recipients only.
- Configuration set `untamed-blasts` publishes events to SNS topic `ses-events-untamed`,
  which is subscribed to `https://untamedbeverages.com/api/webhooks/ses`.
- AccelPay checkout has a marketing checkbox: `buyerAcceptsMarketing` appeared on 59 of
  103 stored orders, ticked on 54. No age field is sent.
- Migration 00027 has **not** been applied to the live database.

## Go-live checklist

Do these in order. Steps 1–2 must happen before this code is deployed.

1. **Apply migrations 00027 then 00028** in the Supabase SQL editor (this database has no
   migration history table; apply these two files, not the folder).
   - 00027 builds contacts from every existing address and creates no consent.
   - 00028 adds the platform tables and seeds every flow as a draft.
   Check the result: `select count(*) from email_contacts;`,
   `select * from email_lists;`, `select slug, status from email_flows;`.
2. **Set the deployment environment** (Vercel), then deploy:
   - `SES_SNS_TOPIC_ARNS` = the ARN of `ses-events-untamed`. It's printed by the setup
     script below. **Set it before deploying:** the live SNS subscription already posts to
     the webhook, and the new webhook rejects topics that aren't listed.
   - `SES_CONFIGURATION_SET_MARKETING=untamed-blasts`
   - `SES_CONFIGURATION_SET_TRANSACTIONAL=untamed-transactional` (after step 4)
   - `EMAIL_POSTAL_ADDRESS` = a full street address or USPS-registered PO box.
     "Parrish, FL 34219" alone isn't enough.
   - `EMAIL_MARKETING_DAILY_CAP` (see warm-up below), `EMAIL_MARKETING_TRANSPORT=ses`
   - Leave `EMAIL_TRANSPORT=smtp` for now; transactional mail stays on Google Workspace.
   - `EMAIL_ALERT_RECIPIENTS` (who gets alert emails).
   - Optional: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` for signup bot
     protection ([signups.md](signups.md)).
   - Optional: the Google service account settings for Gmail sync and outreach
     ([gmail-and-outreach.md](gmail-and-outreach.md)).
3. **Request SES production access** (AWS console, SES, Account dashboard). Describe it as
   opt-in-only marketing with bounce and complaint handling.
4. **Run the SES setup script** to add the transactional configuration set and tidy the
   marketing event types. Dry run first:
   ```
   node --env-file=.env.local scripts/aws/ses/setup-ses.mjs
   node --env-file=.env.local scripts/aws/ses/setup-ses.mjs --apply
   ```
5. **Verify**: `npm run services:check` (SES account, domain, event wiring) and
   `node scripts/email/check-email-dns.mjs`.
6. **Counsel sign-off** (see below). Then set `EMAIL_REPERMISSION_APPROVED_VERSION`
   (and, once the checkout wording is known, `EMAIL_CHECKOUT_CONSENT_APPROVED_VERSION`).
7. **Test end to end with staff addresses.** In Contacts, record an opt-in for each staff
   address (evidence: "internal test"). Send a marketing blast to that list and confirm:
   - the footer and unsubscribe button work
   - Gmail's one-click unsubscribe works
   - delivery and open events reach the contact's history
8. **Activate flows one at a time.** Open each flow and adjust the copy. Send yourself a
   test, then activate it. Start with the account notices (referral credit, redemption
   received/fulfilled), which don't depend on marketing being live.
9. **Register in Google Postmaster Tools** (DNS TXT verification) to watch spam rate and
   reputation. Gmail and Yahoo require complaint rates under 0.3%. Aim for under 0.1%.

### Warm-up

Marketing shares `untamedbeverages.com` with staff mail, so ramp up slowly and start with
the most engaged people (recent buyers who opted in):

| Days | `EMAIL_MARKETING_DAILY_CAP` |
| --- | --- |
| 1–3 | 200 |
| 4–7 | 500 |
| 8–14 | 1,500 |
| 15–21 | 5,000 |
| after | remove the cap if complaints stay under 0.1% and bounces under 2% |

Messages over the cap stay queued and go out the next day. Move DMARC from `p=none` to
`p=quarantine` once the aggregate reports show only Google and SES sending.

## Questions for counsel

1. **Permission-request wording** (`REPERMISSION_COPY` in `src/lib/email/consent-copy.ts`,
   version `repermission-2026-11-v1`): approve or edit. Any edit bumps the version.
2. **Privacy Policy vs Terms.** Privacy §3 says signing up for loyalty, referrals, or a
   wholesale inquiry *is* the opt-in. Terms §5 says those signups cover transactional email
   only and marketing needs a separate opt-in. The system follows the Terms. The Privacy
   Policy wording should be brought in line.
3. **AccelPay checkout checkbox.** We need the exact wording, and whether the box starts
   checked. About 91% of buyers tick it, which suggests it may be pre-checked; a pre-checked
   box is weak evidence of consent. We also need to know whether AccelPay verifies 21+ at
   checkout.
4. **Alcohol advertising rules.** Which code applies (spirits/DISCUS, beer, or wine
   institute), and whether TTB's advertising requirements need more than the footer's
   company name, address, and "21 and over" line.
5. **Warm intros.** Referral warm intros now skip suppressed addresses and carry the
   postal address. Confirm they're acceptable as member-initiated messages.
6. **Signup and preference-page wording** (`src/lib/email/signup-copy.ts`), and whether
   storing a birthday (month and day only) for the birthday flow needs a privacy-policy line.
7. **Flow copy.** The seeded flow emails are drafts. Review them, especially the "account
   notice" ones, which go without a list opt-in and so must stay purely about the member's
   own points and redemptions, with no promotion.
8. **Outreach footer** for one-to-one B2B emails ([gmail-and-outreach.md](gmail-and-outreach.md)).

## Operating it

- **Someone asks to stop emails**: in Contacts, use "Unsubscribe from all". Any staff
  member who can see contacts can do this.
- **Opt-in collected offline** (event sign-up sheet, phone): an admin uses "Record an
  opt-in" with an evidence note saying where the proof is kept. Only tick 21+ if the
  evidence shows it.
- **Access request**: Contacts, then the person, then "Export email data (JSON)".
- **Deletion request**: use "Delete email data". This removes the contact, consent history,
  email log, and queue, and leaves a `data_deletion` suppression. Loyalty, order, and
  lead records are separate and not touched. If one of those records changes later, the
  contact is recreated (still suppressed).
- **Messages to `unsubscribe@untamedbeverages.com`** are processed automatically every 10
  minutes once Gmail sync is set up ([gmail-and-outreach.md](gmail-and-outreach.md)). The
  sender is unsubscribed. A request to unsubscribe a *different* address raises an alert
  for a person to check. Until Gmail sync is configured, process that mailbox by hand the
  same day.
- **Replies to synced mailboxes** appear on the contact's timeline. Any email from a known
  contact that asks to stop ("unsubscribe", "remove me", "stop emailing") unsubscribes
  them from all marketing and stops their outreach sequences, including when it's sent to
  support.
- **Outreach** (one-to-one email and sequences) goes from the staff member's own mailbox.
  It's refused for suppressed addresses and stops when the person replies or bounces.
  Sequences need Gmail sync (to see replies) and the postal address.

## Local development

- Marketing stays blocked locally unless every readiness setting is present. With SES
  in the sandbox, only verified addresses can receive mail.
- `node --env-file=.env.local scripts/email/inspect-accelpay-consent.mjs` lists the
  consent and age fields AccelPay sends. It's read-only and never prints values.

## Needs people, not code

- Apply the migrations, set the environment, request SES production access, run the SES
  setup script (go-live checklist above).
- Counsel sign-off on the questions above; then set the approval env vars.
- AccelPay: the exact checkout checkbox wording and whether it verifies 21+.
- Google Workspace admin: create the service account and grant domain-wide delegation, if you
  want Gmail sync and outreach from staff mailboxes.
- Cart abandonment needs cart events from AccelPay; ask whether their embed can report
  them.
