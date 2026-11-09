-- Backfill mailbox-key rows for opt-outs recorded before commit 96c8bd7.
--
-- Since 96c8bd7, addSuppression stores an opt-out under the exact address and
-- under its mailbox key (src/lib/referral/helpers.ts mailboxKey: lowercase,
-- +tag removed, and for gmail.com / googlemail.com dots removed and the
-- domain folded to gmail.com), and every lookup checks both keys of the
-- recipient. Rows written before that hold only the exact address, so their
-- other spellings (for example legacyuser@gmail.com for an opt-out stored as
-- legacy.user@gmail.com) were still mailed. This adds the missing key rows.
--
-- Safe to run more than once and before or after deploying the app: it only
-- inserts rows that do not exist (email is UNIQUE), copies the original
-- reason, and changes nothing else. Adding a key can only suppress more mail,
-- never less.

WITH parts AS (
  SELECT
    s.email,
    s.reason,
    s.source_message_id,
    s.created_at,
    lower(btrim(s.email)) AS e,
    substring(lower(btrim(s.email)) FROM '^(.*)@[^@]*$') AS raw_local,
    substring(lower(btrim(s.email)) FROM '@([^@]*)$') AS raw_domain
  FROM email_suppressions s
),
keyed AS (
  SELECT
    p.*,
    CASE WHEN p.raw_domain = 'googlemail.com' THEN 'gmail.com' ELSE p.raw_domain END AS domain,
    split_part(p.raw_local, '+', 1) AS local_no_tag
  FROM parts p
),
keys AS (
  SELECT
    k.email,
    k.reason,
    k.source_message_id,
    k.created_at,
    CASE
      WHEN k.raw_local IS NULL OR k.raw_local = '' THEN k.e
      WHEN k.domain = 'gmail.com' THEN replace(k.local_no_tag, '.', '') || '@gmail.com'
      ELSE k.local_no_tag || '@' || k.domain
    END AS key
  FROM keyed k
)
INSERT INTO email_suppressions (email, reason, source_message_id, notes)
SELECT DISTINCT ON (key) key, reason, source_message_id,
       'Mailbox-key backfill (00038) for ' || email
FROM keys
WHERE key <> email
ORDER BY key, created_at
ON CONFLICT (email) DO NOTHING;
