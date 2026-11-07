-- ============================================================================
-- Untamed Beverages - every points change goes through the locked ledger
--
-- A member's points are stored twice: the balance on loyalty_members and the
-- history in loyalty_transactions. loyalty_apply_points() (00028) changes both
-- under a row lock, but most code paths still read the balance, wrote the
-- history, and then wrote the balance back later with no condition. Two bugs
-- came from that, both replayed against the real code (see
-- docs/statecharts/order-points/):
--
--   1. An online order credited while the member redeemed a reward erased the
--      redemption from the balance: the reward was free.
--   2. A delivery that stopped after saving the order and before adding its
--      points lost them for good: every retry saw a duplicate and stopped.
--
-- Each function below makes one change all-or-nothing (one transaction) and
-- locks the rows it decides on, so concurrent requests take turns:
--
--   loyalty_award_order           credit one saved order to a member, once
--   loyalty_credit_online_order   save an AccelPay sale and credit it, or finish
--                                 crediting it when a retry finds it unclaimed
--   loyalty_claim_pending_orders  credit a member's unclaimed orders
--   loyalty_redeem_reward         debit the points and record the redemption
--   loyalty_cancel_redemption     cancel a pending redemption and refund it once
--   loyalty_grant_signup_bonus    grant the signup bonus at most once
--   loyalty_review_receipt        approve or reject a pending receipt
--   loyalty_review_ugc            approve or feature UGC, if it hasn't changed
--
-- Service role only, like loyalty_apply_points. Nothing here changes existing
-- rows when it is applied.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Online orders
-- ----------------------------------------------------------------------------

-- Credit a saved order to a member. Returns the points credited now (0 when
-- the order is already claimed, belongs to someone else, earns nothing, or an
-- interrupted run of the old code already wrote its ledger row).
CREATE OR REPLACE FUNCTION loyalty_award_order(p_order_id UUID, p_member_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order loyalty_orders%ROWTYPE;
  v_points INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM loyalty_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.points_claimed THEN
    RETURN 0;
  END IF;
  IF v_order.member_id IS NOT NULL AND v_order.member_id <> p_member_id THEN
    RETURN 0;
  END IF;

  IF v_order.points_awarded > 0 AND NOT EXISTS (
    SELECT 1 FROM loyalty_transactions t
    WHERE t.order_id = p_order_id AND t.type = 'online_order'
  ) THEN
    v_points := v_order.points_awarded;
    PERFORM loyalty_apply_points(
      p_member_id, v_points, 'online_order',
      format('Online order (+%s pts)', v_points), p_order_id
    );
  END IF;

  UPDATE loyalty_orders
  SET member_id = p_member_id, points_claimed = true
  WHERE id = p_order_id;

  RETURN v_points;
END;
$$;

-- Save an AccelPay sale (p_order holds loyalty_orders columns) and credit its
-- points to p_member_id, in one transaction. A sale that is already saved is a
-- retry: it returns 'duplicate', unless the order was left unclaimed, in which
-- case it is credited now ('credited').
CREATE OR REPLACE FUNCTION loyalty_credit_online_order(p_order JSONB, p_member_id UUID)
RETURNS TABLE (result TEXT, order_id UUID, points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_order_id UUID;
  v_points INTEGER;
  v_awarded INTEGER;
BEGIN
  INSERT INTO loyalty_orders (
    accelpay_sale_id, member_id, email, status, subtotal_cents, total_cents,
    tax_cents, delivery_cents, discount_cents, pack_count, points_awarded,
    points_claimed, items, raw_payload
  )
  SELECT
    r.accelpay_sale_id, p_member_id, r.email, r.status,
    COALESCE(r.subtotal_cents, 0), COALESCE(r.total_cents, 0), COALESCE(r.tax_cents, 0),
    COALESCE(r.delivery_cents, 0), COALESCE(r.discount_cents, 0), COALESCE(r.pack_count, 0),
    COALESCE(r.points_awarded, 0), false, r.items, r.raw_payload
  FROM jsonb_populate_record(NULL::loyalty_orders, p_order) AS r
  ON CONFLICT (accelpay_sale_id) DO NOTHING
  RETURNING id, points_awarded INTO v_order_id, v_points;

  IF v_order_id IS NOT NULL THEN
    IF p_member_id IS NOT NULL AND v_points > 0 THEN
      RETURN QUERY SELECT 'credited'::TEXT, v_order_id, loyalty_award_order(v_order_id, p_member_id);
    ELSE
      RETURN QUERY SELECT 'pending'::TEXT, v_order_id, v_points;
    END IF;
    RETURN;
  END IF;

  SELECT o.id INTO v_order_id
  FROM loyalty_orders o
  WHERE o.accelpay_sale_id = (p_order->>'accelpay_sale_id')::BIGINT;

  IF p_member_id IS NOT NULL THEN
    v_awarded := loyalty_award_order(v_order_id, p_member_id);
    IF v_awarded > 0 THEN
      RETURN QUERY SELECT 'credited'::TEXT, v_order_id, v_awarded;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'duplicate'::TEXT, v_order_id, 0;
END;
$$;

-- Credit every unclaimed order for this email that has no member yet or is
-- already this member's. Returns the points credited. All the orders are
-- locked before the member is, the same order every other function here
-- takes its locks in, so it can't deadlock with a delivery crediting one.
CREATE OR REPLACE FUNCTION loyalty_claim_pending_orders(p_member_id UUID, p_email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids UUID[];
  v_order_id UUID;
  v_total INTEGER := 0;
BEGIN
  SELECT array_agg(s.id ORDER BY s.created_at) INTO v_order_ids
  FROM (
    SELECT o.id, o.created_at FROM loyalty_orders o
    WHERE o.points_claimed = false
      AND (o.member_id IS NULL OR o.member_id = p_member_id)
      AND lower(o.email) = lower(btrim(p_email))
    ORDER BY o.created_at
    FOR UPDATE
  ) s;

  FOREACH v_order_id IN ARRAY COALESCE(v_order_ids, '{}') LOOP
    v_total := v_total + loyalty_award_order(v_order_id, p_member_id);
  END LOOP;
  RETURN v_total;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Redemptions
-- ----------------------------------------------------------------------------

-- Debit the reward's cost and record the redemption. Returns the saved
-- loyalty_redemptions row as JSON and the new balance. Raises check_violation
-- (23514) when the balance is too low, and then nothing is written.
CREATE OR REPLACE FUNCTION loyalty_redeem_reward(
  p_member_id UUID,
  p_reward_slug TEXT,
  p_reward_label TEXT,
  p_points_cost INTEGER,
  p_retail_value_cents INTEGER DEFAULT 0,
  p_ship_state TEXT DEFAULT NULL
)
RETURNS TABLE (redemption JSONB, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_txn UUID;
  v_balance INTEGER;
  v_row loyalty_redemptions%ROWTYPE;
BEGIN
  IF p_points_cost IS NULL OR p_points_cost <= 0 THEN
    RAISE EXCEPTION 'points cost must be positive (got %)', p_points_cost
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT a.transaction_id, a.new_balance INTO v_txn, v_balance
  FROM loyalty_apply_points(
    p_member_id, -p_points_cost, 'redemption', 'Redeemed: ' || p_reward_label
  ) AS a;

  INSERT INTO loyalty_redemptions (
    member_id, reward_slug, reward_label, points_cost, retail_value_cents,
    ship_state, status, redeem_transaction_id
  )
  VALUES (
    p_member_id, p_reward_slug, p_reward_label, p_points_cost,
    COALESCE(p_retail_value_cents, 0), p_ship_state, 'pending', v_txn
  )
  RETURNING * INTO v_row;

  RETURN QUERY SELECT to_jsonb(v_row), v_balance;
END;
$$;

-- Cancel a pending redemption and refund its points. Only one call can move a
-- redemption out of 'pending', so it is refunded at most once. result is
-- 'cancelled', 'not_found', or the status it already had.
CREATE OR REPLACE FUNCTION loyalty_cancel_redemption(
  p_redemption_id UUID,
  p_staff_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (result TEXT, refunded_points INTEGER, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_r loyalty_redemptions%ROWTYPE;
  v_txn UUID;
  v_balance INTEGER;
BEGIN
  SELECT * INTO v_r FROM loyalty_redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, 0, NULL::INTEGER;
    RETURN;
  END IF;
  IF v_r.status <> 'pending' THEN
    RETURN QUERY SELECT v_r.status::TEXT, 0, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_r.points_cost > 0 THEN
    SELECT a.transaction_id, a.new_balance INTO v_txn, v_balance
    FROM loyalty_apply_points(
      v_r.member_id, v_r.points_cost, 'adjustment',
      'Refund for cancelled redemption: ' || v_r.reward_label,
      NULL, NULL, p_staff_id
    ) AS a;
  ELSE
    SELECT m.points_balance INTO v_balance FROM loyalty_members m WHERE m.id = v_r.member_id;
  END IF;

  UPDATE loyalty_redemptions
  SET status = 'cancelled',
      cancelled_at = now(),
      admin_notes = COALESCE(p_notes, admin_notes),
      refund_transaction_id = v_txn,
      fulfilled_by = p_staff_id
  WHERE id = p_redemption_id;

  RETURN QUERY SELECT 'cancelled'::TEXT, v_r.points_cost, v_balance;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Signup bonus
-- ----------------------------------------------------------------------------

-- Grant the signup bonus unless the member already has one. The member row is
-- locked before the check, so two sign-ins at once can't both grant it.
CREATE OR REPLACE FUNCTION loyalty_grant_signup_bonus(
  p_member_id UUID,
  p_points INTEGER,
  p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM loyalty_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM loyalty_transactions t
    WHERE t.member_id = p_member_id AND t.type = 'signup_bonus'
  ) THEN
    RETURN false;
  END IF;

  PERFORM loyalty_apply_points(p_member_id, p_points, 'signup_bonus', p_description);
  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Staff reviews
-- ----------------------------------------------------------------------------

-- Approve (crediting p_points) or reject a pending receipt. result is
-- 'approved', 'rejected', 'not_found' or 'already_reviewed'.
CREATE OR REPLACE FUNCTION loyalty_review_receipt(
  p_receipt_id UUID,
  p_approve BOOLEAN,
  p_points INTEGER,
  p_notes TEXT,
  p_staff_id UUID
)
RETURNS TABLE (result TEXT, awarded INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_r loyalty_receipts%ROWTYPE;
  v_points INTEGER;
  v_status TEXT;
BEGIN
  IF p_points IS NULL OR p_points < 0 THEN
    RAISE EXCEPTION 'points must be zero or more (got %)', p_points
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_r FROM loyalty_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, 0;
    RETURN;
  END IF;
  IF v_r.status <> 'pending' THEN
    RETURN QUERY SELECT 'already_reviewed'::TEXT, 0;
    RETURN;
  END IF;

  v_points := CASE WHEN p_approve THEN p_points ELSE 0 END;
  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;

  UPDATE loyalty_receipts
  SET status = v_status,
      points_awarded = v_points,
      admin_notes = p_notes,
      reviewed_by = p_staff_id,
      reviewed_at = now()
  WHERE id = p_receipt_id;

  IF v_points > 0 THEN
    PERFORM loyalty_apply_points(
      v_r.member_id, v_points, 'receipt_approved',
      format('Receipt approved (+%s pts)', v_points),
      NULL, p_receipt_id, p_staff_id
    );
  END IF;

  RETURN QUERY SELECT v_status, v_points;
END;
$$;

-- Set a UGC submission to approved or featured and credit p_points, but only
-- if its points_awarded is still what the reviewer saw (p_expected_points), so
-- two reviews at once can't both credit. result is the new status,
-- 'not_found' or 'changed'.
CREATE OR REPLACE FUNCTION loyalty_review_ugc(
  p_submission_id UUID,
  p_status ugc_status,
  p_points INTEGER,
  p_expected_points INTEGER,
  p_description TEXT,
  p_staff_id UUID
)
RETURNS TABLE (result TEXT, awarded INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_s ugc_submissions%ROWTYPE;
BEGIN
  IF p_points IS NULL OR p_points < 0 THEN
    RAISE EXCEPTION 'points must be zero or more (got %)', p_points
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_status NOT IN ('approved', 'featured') THEN
    RAISE EXCEPTION 'status must be approved or featured (got %)', p_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_s FROM ugc_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, 0;
    RETURN;
  END IF;
  IF v_s.points_awarded IS DISTINCT FROM p_expected_points THEN
    RETURN QUERY SELECT 'changed'::TEXT, 0;
    RETURN;
  END IF;

  UPDATE ugc_submissions
  SET status = p_status,
      reviewed_by = p_staff_id,
      reviewed_at = now(),
      rejection_reason = NULL,
      points_awarded = points_awarded + p_points,
      updated_at = now()
  WHERE id = p_submission_id;

  IF p_points > 0 AND v_s.loyalty_member_id IS NOT NULL THEN
    PERFORM loyalty_apply_points(
      v_s.loyalty_member_id, p_points, 'ugc_approved', p_description,
      NULL, NULL, p_staff_id
    );
  END IF;

  RETURN QUERY SELECT p_status::TEXT, p_points;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Service role only
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION loyalty_award_order(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_credit_online_order(JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_claim_pending_orders(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_redeem_reward(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_cancel_redemption(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_grant_signup_bonus(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_review_receipt(UUID, BOOLEAN, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_review_ugc(UUID, ugc_status, INTEGER, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION loyalty_award_order(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_credit_online_order(JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_claim_pending_orders(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_redeem_reward(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_cancel_redemption(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_grant_signup_bonus(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_review_receipt(UUID, BOOLEAN, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_review_ugc(UUID, ugc_status, INTEGER, INTEGER, TEXT, UUID) TO service_role;

COMMIT;
