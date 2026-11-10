# Email signups, double opt-in, and the preference center

Phase 3 of the email roadmap. People can sign up for email on the website, and every
signup is confirmed by email before anyone is subscribed. Subscribers manage their
topics, pause email, add a birthday, or unsubscribe at `/email/preferences`.

Read `README.md` in this folder first for how consent, suppressions, and sending work.

## Where the forms are

| Form | Where | Lists | Code |
| --- | --- | --- | --- |
| Newsletter, compact | Site footer (every page with the footer, except the three below) | Consumer topics the person ticks | `src/components/EmailSignupForm.tsx`, `src/components/Footer.tsx` |
| Newsletter, full | Homepage, `/shop`, `/subscribe` (footer strip hidden there) | Consumer topics the person ticks | `src/app/page.tsx`, `src/app/shop/page.tsx`, `src/app/subscribe/page.tsx` |
| "Join the Pack" checkbox | Loyalty join form on `/rewards`, `/referral`, drink reward pages | All active consumer lists | `src/components/loyalty/JoinForm.tsx`, `src/app/api/portal/magic-link/route.ts` |
| Wholesale checkbox | Distributor / retail inquiry form (`/retail`, `/distribute`, `/lp/retail/*`) | `trade` | `src/components/referral/DistributorLeadForm.tsx`, `src/app/api/distributor/lead/route.ts` |

- The newsletter form has: email, first name (full variant only), a checkbox per active
  consumer topic (all ticked to start), a required **unticked** 21+ checkbox, the consent
  sentence shown word for word, a hidden honeypot field, the Turnstile widget when
  configured, and the browser's time zone (sent automatically).
- The join and wholesale checkboxes are separate, start unticked, and are never part of
  the terms. Ticking the join box also shows a required 21+ checkbox. The main form works
  the same whether or not the box is ticked, and a failed opt-in never fails it.
- `/subscribe` is an ad landing page. It is deliberately **not** under `/email/`, so it
  keeps the age gate, pixels, and page-view tracking.
- Topics come from `email_lists` (active, `audience = 'consumer'`). Turning a list off in
  the database removes it from every form.

## How double opt-in works

```
form ──► POST /api/email/subscribe ─► checks ─► "check your inbox" (always the same answer)
                                         │
                                         ▼ after the response
                      per-address limit, suppression check
                      email_signup_requests row (pending, token SHA-256, wording, evidence)
                      confirmation email (transactional, from loyalty@)
                                         │
person clicks link ─► GET /email/confirm-signup?t=…   (shows a button; changes nothing)
presses confirm   ─► POST /api/email/confirm-signup ─► applyConsent(opt_in, 'signup_form')
                                                        + time zone, birthday, first name
```

1. **Checks** (`createSignupRequest` in `src/lib/email/signup.ts`): valid address up to
   320 characters; the form's copy version matches the server's; every requested list is
   active and belongs to the form's audience; 21+ attestation for any list that needs it;
   honeypot empty; Turnstile token valid (when configured); at most **20 requests per IP
   per hour**. Failures here get a specific error message, none of which depend on the
   address.
2. **After the response** (so timing doesn't reveal anything): at most **3 requests per
   address per hour**; no email to addresses suppressed for `hard_bounce`, `complaint`,
   `manual`, or `data_deletion` (a plain `unsubscribe` can sign up again). Then the
   request is saved and the confirmation email sent. Already-subscribed addresses get a
   confirmation too, so the answer never differs.
3. **The link** carries a random 32-byte token. Only its SHA-256 is stored
   (`email_signup_requests.token_hash`). It expires after 7 days (database default).
4. **Confirming** records the opt-in through `email_apply_consent` with the evidence from
   the original signup: the exact sentence and version, 21+ wording, IP, browser, country,
   and where the form was shown (`source_detail`, e.g. "Website signup form (footer)").
   The confirming click (time, IP, country) and the request id go in the evidence note.
   The request is claimed before consent is written, so a double click records one
   opt-in. Lists switched off since the signup are skipped. An expired link marks the
   request `expired`.
5. **First opt-in to a consumer list** enrolls the contact in the `welcome` flow (database
   trigger from migration 00028; the flow ships as draft).

## Preference center

`/email/preferences?t=<manage token>` (`src/app/email/preferences/`). The token is the
signed `manage:` token from `src/lib/messaging/unsubscribe.ts` and doesn't expire. Marketing
emails link here from their footer. The page is server-rendered and changes nothing on
open; every change is a form POST to `/api/email/preferences`.

| Section | What it does |
| --- | --- |
| Topics | One toggle per active list with its current status. Turning one on is an `opt_in` with `source: 'preference_page'` and `PREFERENCES_CONSENT_TEXT`. 21+ lists need the 21+ checkbox unless the contact is already age-verified. Turning one off is an `opt_out`. |
| Take a break | Pause all marketing for 30 or 90 days (`email_contacts.marketing_paused_until`), or resume. The recipient query already skips paused contacts. |
| Birthday | Optional month and day (`birthday_month`, `birthday_day`), used by the birthday flow. |
| Unsubscribe from everything | `unsubscribe_all`, with the same suppression-only fallback as `/unsubscribe`. |

- Addresses suppressed for a bounce, complaint, manual block, or deletion see a note to
  contact support; their topics can't be turned on from the page.
- After an unsubscribe-all, all topics show as off, and turning any on lifts the
  unsubscribe.
- Pause and birthday need a contact row, so they appear once the address is known.
- **Without a token** the page shows an "email me a link" form. It always answers "if that
  address gets Untamed emails, we've sent it a link", sends only to existing contacts that
  aren't blocked, at most 3 links per address per hour, after the response.
- `/unsubscribe` links to the preference page ("Manage preferences instead") when its
  token is valid. The manage token is signed on the server from the verified unsubscribe
  token's address. The footer's "Email Preferences" link goes to `/email/preferences`.

## Wording and versions

All signup wording is in `src/lib/email/signup-copy.ts`, version `signup-2026-11-v1`:

- `SIGNUP_FORMS.website.consentText`: next to the newsletter form
- `SIGNUP_FORMS.join.consentText`: the join-form checkbox
- `SIGNUP_FORMS.trade.consentText`: the wholesale checkbox
- `SIGNUP_AGE_TEXT`: the 21+ checkbox
- `PREFERENCES_CONSENT_TEXT`: above "Save topics" on the preference page
- `SIGNUP_CONFIRM_EMAIL`, `SIGNUP_CONFIRM_PAGE`, `PREFERENCES_LINK_EMAIL`: emails and page

**Changing any consent or 21+ sentence means bumping `SIGNUP_COPY_VERSION`.** Forms send
the version they showed; the server rejects a mismatch (409, "refresh the page"), so the
recorded wording is always what the person saw. Email and page wording can change
without a bump. Unlike the permission request, signups aren't gated on an approved
version: the double opt-in is the safeguard. The join-checkbox sentence names "new drinks,
offers, and community news"; if consumer lists are added or renamed, update it and bump
the version.

## Turnstile (bot protection)

Optional. Without it, the newsletter and "email me a link" forms rely on the honeypot and
rate limits.

1. Cloudflare dashboard, Turnstile, Add widget. Domains: `untamedbeverages.com` (and any
   preview domain you test on). Mode: Managed.
2. Set both in Vercel (and `.env.local` to test locally):
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the site key (shown in the browser; needs a
     redeploy because it's built into the page)
   - `TURNSTILE_SECRET_KEY` = the secret key
3. Set both or neither. A secret without a site key rejects every signup.

The widget script loads from `challenges.cloudflare.com` only after someone focuses a
form. Verification fails closed: if Cloudflare can't be reached, the signup is refused.
The join and wholesale checkboxes don't use Turnstile (their forms have no widget); they
still have the rate limits. Cloudflare's test keys (site `1x00000000000000000000AA`,
secret `1x0000000000000000000000000000000AA`) always pass, for local testing.

## Requirements and limits

- Confirmation and link emails go through the transactional stream (Google Workspace while
  `EMAIL_TRANSPORT=smtp`), from `loyalty@`, logged in `email_messages` with
  `template_slug` `signup-confirm` or `preferences-link`.
- `CRON_SECRET` must be set: it signs the unsubscribe and manage links in these emails.
- `NEXT_PUBLIC_SITE_URL` is optional. Unset, links use https://untamedbeverages.com; if it is set, it must be the public site.
- Rate limits are constants at the top of `src/lib/email/signup.ts`. 20 per IP per hour
  can be too low for an in-person event on shared Wi-Fi; raise it for the day if needed.

## Testing (staff addresses only)

1. Sign up a staff address on `/subscribe`. Check the confirmation email arrives, the link
   opens a page with a button, and nothing changes until it's pressed.
2. Confirm. In Admin, Contacts, the address shows the opt-in with source "signup_form",
   the wording, version `signup-2026-11-v1`, and a 21+ attestation.
3. Open the preference page from the confirm page. Turn a topic off and on, pause, resume,
   set a birthday, then unsubscribe from everything. Each step shows in the contact's
   history.
4. Tick the join-form and wholesale checkboxes with staff addresses and confirm both.
5. Use an address suppressed for a hard bounce: the form still says "check your inbox" and
   no email arrives.

## Questions for counsel

1. **Signup wording** (`signup-2026-11-v1`): the newsletter sentence, the join and
   wholesale checkbox sentences, the 21+ sentence, and the preference-page sentence.
   Any edit bumps the version.
2. **Topic checkboxes start ticked** on the newsletter form. The person still submits the
   form and confirms by email, and the consent sentence says "the topics I've checked".
   Confirm that's acceptable, or we start them unticked.
3. **Self-attested 21+.** The form records a ticked "I am 21 years of age or older"
   checkbox. Confirm that's sufficient for alcohol marketing email, or whether stronger
   age verification is expected for some states.
4. **Confirmation email content.** It's sent before consent exists, so it carries no
   promotional content. Confirm it may include the topic names and the unsubscribe link.
5. **Birthday messages.** The birthday flow sends on the `offers` list. Confirm a birthday
   offer is acceptable for alcohol under the applicable advertising code.
6. **Privacy Policy.** It should describe website signups, double opt-in, what we record
   as evidence (IP, browser, country, time zone), and the preference center.
