-- ============================================================================
-- Untamed Beverages - Community-First Points Reset
--
-- The loyalty program is reframed around community (UGC + referrals) with
-- points as a quiet background perk. One simple rule: 100 points per $1 of
-- merchandise subtotal (i.e. 1 point per cent), plus flat instant bonuses:
--
--   signup                       1,000
--   referred friend joins        1,000  (to the referrer)
--   referred friend's 1st order  5,000  (to the referrer)
--   UGC approved                 2,500
--   UGC featured                 7,500 total (delta credited after approve)
--
-- This migration:
--   1. Adds the new referral transaction types to the ledger constraint.
--   2. Retires the old referral reward tiers (flat instant payouts now).
--   3. Reprices historical UGC awards and pending online-order credits.
--   4. Recomputes every member's balance from order history at the new
--      rates and records the difference as a single 'adjustment' transaction
--      ("Points recalculation") for the audit trail.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Allow the new flat referral bonus transaction types
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_transactions
  DROP CONSTRAINT loyalty_transactions_type_check;

ALTER TABLE loyalty_transactions
  ADD CONSTRAINT loyalty_transactions_type_check
  CHECK (type IN (
    'receipt_approved',
    'signup_bonus',
    'redemption',
    'adjustment',
    'ugc_approved',
    'online_order',
    'referral_signup',
    'referral_purchase'
  ));

-- ----------------------------------------------------------------------------
-- 2. Retire the referral tier system (kept read-only for history)
-- ----------------------------------------------------------------------------
UPDATE referral_reward_tiers
SET is_active = false
WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 3. Reprice historical awards to the new scale
-- ----------------------------------------------------------------------------
-- UGC: approved 2,500 / featured 7,500. Only touch rows that actually paid
-- out (points_awarded > 0) so admin-chosen zero awards stay zero.
UPDATE ugc_submissions
SET points_awarded = 2500
WHERE status = 'approved' AND points_awarded > 0;

UPDATE ugc_submissions
SET points_awarded = 7500
WHERE status = 'featured' AND points_awarded > 0;

-- Online orders: 1 point per cent of subtotal. Unclaimed (pending) orders are
-- credited from points_awarded at claim time, so they MUST be repriced;
-- claimed orders are updated too so reporting matches the new rate.
UPDATE loyalty_orders
SET points_awarded = subtotal_cents;

-- ----------------------------------------------------------------------------
-- 4. Recompute every member's balance at the new rates
--
-- target = signup bonus (1,000 if they ever received one)
--        + 1 pt/cent of every CLAIMED online order subtotal
--        + repriced UGC awards
--        + approved in-store receipt awards (kept at their recorded value)
--        - points spent on redemptions (redemption txns are negative)
--
-- The difference vs. the current balance is written as one 'adjustment'
-- transaction per member so the ledger explains the jump.
-- ----------------------------------------------------------------------------
WITH targets AS (
  SELECT
    m.id AS member_id,
    (
      CASE WHEN EXISTS (
        SELECT 1 FROM loyalty_transactions t
        WHERE t.member_id = m.id AND t.type = 'signup_bonus'
      ) THEN 1000 ELSE 0 END
    )
    + COALESCE((
        SELECT SUM(o.subtotal_cents) FROM loyalty_orders o
        WHERE o.member_id = m.id AND o.points_claimed = true
      ), 0)
    + COALESCE((
        SELECT SUM(u.points_awarded) FROM ugc_submissions u
        WHERE u.loyalty_member_id = m.id
          AND u.status IN ('approved', 'featured')
      ), 0)
    + COALESCE((
        SELECT SUM(r.points_awarded) FROM loyalty_receipts r
        WHERE r.member_id = m.id AND r.status = 'approved'
      ), 0)
    + COALESCE((
        SELECT SUM(t.points) FROM loyalty_transactions t
        WHERE t.member_id = m.id AND t.type = 'redemption'
      ), 0) AS target_balance
  FROM loyalty_members m
),
deltas AS (
  SELECT
    t.member_id,
    t.target_balance,
    t.target_balance - m.points_balance AS delta
  FROM targets t
  JOIN loyalty_members m ON m.id = t.member_id
  WHERE t.target_balance <> m.points_balance
),
logged AS (
  INSERT INTO loyalty_transactions (member_id, points, type, description)
  SELECT
    member_id,
    delta,
    'adjustment',
    'Points recalculation (community program update)'
  FROM deltas
  RETURNING member_id
)
UPDATE loyalty_members m
SET points_balance = d.target_balance
FROM deltas d
WHERE m.id = d.member_id;

COMMIT;
