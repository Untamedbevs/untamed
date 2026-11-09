# Gmail sync and one-to-one outreach

Phase 5 of the email roadmap. It covers four things:

- **Conversation logging.** Staff email with known contacts shows on the contact's page, both directions.
- **Unsubscribe mailbox.** Messages to `unsubscribe@untamedbeverages.com` are processed automatically.
- **One-to-one email.** Staff send from the contact page, from their own address.
- **Follow-up sequences.** Plain-text steps go out from the enrolling staff member's mailbox. They stop when the person replies.

| Piece | Where |
| --- | --- |
| Gmail API client (service account, JWT, token cache) | `src/lib/gmail/client.ts` |
| Message parsing, quoted-reply stripping, stop-request detection | `src/lib/gmail/parse.ts` |
| Mailbox sync, reply handling, unsubscribe mailbox | `src/lib/gmail/sync.ts` |
| Send as a staff member (`sendAsStaff`) | `src/lib/gmail/send.ts` |
| Sequence rules and merge tags | `src/lib/gmail/outreach.ts` |
| Sequence sender | `src/lib/gmail/outreach-run.ts` |
| Crons | `/api/cron/gmail-sync` (every 10 min), `/api/cron/outreach` (every 15 min) |
| Staff pages | `/admin/crm/outreach`, `/admin/crm/contacts/[id]` |
| Schema | `gmail_sync_state`, `email_mailbox_processed`, `outreach_sequences`, `outreach_enrollments`, Gmail columns on `email_messages` (migration 00028) |

## Google Cloud and Workspace setup

The app reads and sends mail as staff members through a **service account with domain-wide
delegation**. Staff don't sign in or grant anything one by one. A Workspace super admin does
the setup once.

1. **Pick a Google Cloud project** owned by the untamedbeverages.com organization, or create
   one at <https://console.cloud.google.com/projectcreate>.
2. **Enable the Gmail API**: APIs & Services, then Library, then "Gmail API", then Enable.
3. **Create the service account**: IAM & Admin, then Service accounts, then Create. Name it,
   for example, `untamed-gmail`. It needs no IAM roles.
4. **Create a key**: open the service account, go to Keys, then Add key, then JSON. Keep the file
   private. If key creation is blocked, the organization policy
   `iam.disableServiceAccountKeyCreation` must allow it for this project.
5. **Copy the client ID**: on the service account's Details tab, copy the numeric *Unique ID*
   (also called the OAuth 2 client ID).
6. **Grant domain-wide delegation** in the Workspace Admin console
   (<https://admin.google.com>): Security, then Access and data control, then API controls,
   then Manage domain-wide delegation, then Add new.
   - Client ID: the Unique ID from step 5
   - OAuth scopes (exactly these two, comma-separated):
     ```
     https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.send
     ```
   Changes usually apply within minutes. They can take up to 24 hours.
7. **Set the environment** (Vercel, and `.env.local` to test locally):

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the key file |
   | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` from the key file. Pasting it with `\n` escapes is fine, and so is pasting the whole JSON file. |
   | `GMAIL_SYNC_MAILBOXES` | Comma-separated staff mailboxes to log (see below) |
   | `GMAIL_UNSUBSCRIBE_MAILBOX` | Defaults to `unsubscribe@untamedbeverages.com`. Set `off` to keep handling it by hand. |
   | `GMAIL_SYNC_LOOKBACK_DAYS` | How far back the first sync of each mailbox reads (default 14, max 90) |
   | `EMAIL_POSTAL_ADDRESS` | Already required for marketing. Sequences don't send without it. |
   | `CRON_SECRET` | Already set. Both crons check it. |

8. **Deploy, then check** after the next run:
   ```sql
   select mailbox, last_synced_at, last_message_at, messages_synced, last_error from gmail_sync_state;
   ```
   Problems also raise a `gmail_sync_failure` alert on the email dashboard. Common errors:
   - `unauthorized_client`: delegation is missing or has the wrong scopes (step 6).
   - `invalid_grant`: the address isn't a real Workspace user. It's a group or an alias.

### Which mailboxes to list

- **`GMAIL_SYNC_MAILBOXES`**: every staff member who emails customers, wholesale leads, or
  creators, and **everyone who will enroll people in sequences**. Replies go to the sender's
  own inbox, so an unlisted sender's replies won't show on contact timelines. The outreach
  sender still notices replies, because it checks the sender's mailbox directly before each
  step. Each entry must be a real user account, not a group or alias.
- **`GMAIL_UNSUBSCRIBE_MAILBOX`**: must be a real user mailbox, because a Google Group or alias
  can't be read through the API. If `unsubscribe@` is currently an alias or group, either turn
  it into a user account or set the variable to `off` and keep processing it by hand. In that
  mailbox, add a Gmail filter for all mail with "Never send it to Spam" turned on. Only the
  inbox is read, so a request that lands in Spam would be missed.
- Don't list `unsubscribe@` in `GMAIL_SYNC_MAILBOXES`. It's skipped if you do.

## Privacy: what is stored

- The sync reads the **headers** of each new message in a listed mailbox: From, To, Cc,
  Subject, and the message IDs. It fetches and stores a message **only if the other party is
  already in `email_contacts`**. That means a customer, member, referrer, wholesale lead, or
  creator. All other mail is never downloaded past its headers, and nothing about it is kept.
- Mail between our own domains (`untamedbeverages.com`, `untamedbevs.com`, and the domains of
  the listed mailboxes) is skipped. So are auto-replies and bounce notices.
- The stored copy is the plain-text body, truncated to about 20,000 characters. HTML and
  attachments aren't kept. Bodies are cleared after the retention period in Email Settings, and
  "Delete email data" on a contact removes them along with the rest of the log.
- Delegation technically lets the service account read **any** mailbox in the domain. The app
  only reads the mailboxes listed in the environment. Treat the key like a password. Rotate it
  by creating a new key, updating the environment, and deleting the old key.
- Staff who can see contacts (everyone except limited contractors) can read logged
  conversations on contact pages.

## How replies and stop requests work

**During each sync** (every 10 minutes), for each new inbound message from a contact:

- **Stop requests.** If the person's own words ask to stop, the address is unsubscribed from
  all marketing. This is recorded as a consent event with source "Unsubscribe email" and the
  message's Message-ID as evidence. Every active outreach enrollment for them is then
  **stopped**. Phrases that count include "unsubscribe", "remove me from your list", "stop
  emailing", "don't email me", "opt me out", "take me off", and "no more emails". The check
  ignores quoted text, like `>` lines, "On … wrote:", and Outlook's "From: / Sent:" block. That
  matters because our own footer says "Reply 'unsubscribe'". This applies to any email from a
  known contact to a synced mailbox, not just outreach replies.
- **Other replies.** Any other reply marks the person's active enrollments **replied**, so no
  more steps go out. A person should take it from there.
- **Bounces.** A bounce notice in an outreach thread marks that enrollment **bounced**.

**Before every sequence step** (every 15 minutes), the sender checks the following again:

- whether the address has sent anything since enrolling. It looks in the log and also searches
  the sender's mailbox live, so a reply that arrived since the last sync still counts.
  Out-of-office replies don't count.
- the suppression list (unsubscribes, complaints, bounces, deletion requests)
- the sequence's daily cap for that sender. Steps over the cap move to 9:00–10:30 Eastern the
  next day.

## The unsubscribe mailbox

Every new message in `GMAIL_UNSUBSCRIBE_MAILBOX` is handled once and recorded in
`email_mailbox_processed` with an outcome:

| Outcome | Meaning |
| --- | --- |
| `unsubscribed` | The sender's address was unsubscribed from all marketing and their outreach stopped |
| `needs_review` | As above, but the subject names a **different** address. That one is not unsubscribed automatically, because anyone could otherwise unsubscribe anyone. An alert says which address to check. Unsubscribe it in Contacts if the request is genuine. |
| `ignored_automated` | A bounce, auto-reply, or no-reply sender |
| `skipped` / `invalid_sender` | Our own mail, or no readable From address |

The mail-app unsubscribe link (`mailto:` in `List-Unsubscribe`) puts `unsubscribe <address>` in
the subject. Usually that's the sender's own address, so it's simply unsubscribed. To review
recent decisions:

```sql
select outcome, count(*) from email_mailbox_processed group by outcome;
```

## Sending one-to-one email

On a contact's page, **Send email** opens a composer. **Reply** on a conversation thread
answers in that thread.

- With Gmail connected, the message goes out through the Gmail API **as the signed-in staff
  member**. It appears in their Sent folder and replies come back to them.
- Without Gmail, it goes through the Google Workspace relay from their address. That copy
  doesn't appear in their Sent folder. The composer says so.
- Suppressed addresses are refused.
- Every message gets a short footer with the company name and postal address, plus
  *Reply 'unsubscribe' and we won't email you again.* CAN-SPAM applies to business-to-business
  sales email too.

## Sequences

`/admin/crm/outreach`:

- **Create and edit** sequences: admins, super admins, and full contractors. Each sequence has
  a name, a description, a daily cap per sender, and up to 10 plain-text steps.
  - Step 1 waits *N* days after enrolling (0 means within 15 minutes). Each later step waits
    *N* days (at least 1) after the previous one.
  - Later steps go out as replies in the same thread ("Re: …"). A custom subject on a
    follow-up may start a new thread in Gmail.
  - Merge tags: `{{first_name|there}}`, `{{last_name}}`, `{{name}}`, `{{email}}`,
    `{{sender_first_name}}`, `{{sender_name}}`, `{{site_url}}`.
  - Archiving a sequence stops everyone still in it. Editing steps changes only the steps
    people haven't received yet.
- **Enroll** contacts: any staff member who can see contacts. They search and tick contacts,
  or use **Add to sequence** on a contact's page. The person enrolling is the sender, and steps
  go out from their mailbox. Suppressed addresses and people already in that sequence are
  skipped.
- **Enrollments** tab: status, sender, progress, next step, and last sent, with a **Stop**
  button.
- **Requirements.** Sequences don't send until Gmail is connected (reply detection depends on
  it) and `EMAIL_POSTAL_ADDRESS` is set. The page shows a banner until both are in place.

Every create, edit, archive, enrollment, stop, and one-to-one send is written to
`staff_audit_log`.

## Limits

- The first sync of a mailbox reads at most the 1,000 most recent messages in the lookback
  window. Each run handles up to 150 new messages per mailbox and continues on the next run.
- If a message can't be processed, that mailbox's cursor stays put, so the message is retried
  on the next run, and an alert is raised (once a day).
- Sequence sends: up to 60 per run, every 15 minutes, within each sequence's per-sender cap.
  The cap counts outreach that the system sent for that staff member since midnight Eastern.
