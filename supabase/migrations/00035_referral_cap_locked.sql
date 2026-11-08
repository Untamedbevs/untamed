-- Enforce the yearly referral cap atomically (security audit run-2).
--
-- creditConsumerReferral and creditPaidConversion used to count a referrer's
-- referral credits for the year and then credit in a separate call, so
-- credits landing at the same moment could each see 24 and all pass the cap
-- of 25. This function locks the referrer's member row, counts, and inserts
-- in one transaction, mirroring loyalty_apply_points (00028).
--
-- The app calls it first and falls back to the old count + loyalty_apply_points
-- path only while this function does not exist, so applying this migration
-- needs no app change and nothing breaks before it is applied.

CREATE OR REPLACE FUNCTION loyalty_apply_referral_points(
  p_member_id UUID,
  p_points INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_cap INTEGER
)
RETURNS TABLE (transaction_id UUID, new_balance INTEGER, capped BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_count INTEGER;
  v_txn UUID;
BEGIN
  IF p_type NOT IN ('referral_signup', 'referral_purchase') OR p_points <= 0 OR p_cap < 0 THEN
    RAISE EXCEPTION 'invalid referral credit'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(points_balance, 0) INTO v_balance
  FROM loyalty_members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'loyalty member % not found', p_member_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Same year boundary as the app: 1 January UTC.
  SELECT count(*) INTO v_count
  FROM loyalty_transactions
  WHERE member_id = p_member_id
    AND type = p_type
    AND points > 0
    AND created_at >= (date_trunc('year', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');

  IF v_count >= p_cap THEN
    RETURN QUERY SELECT NULL::UUID, v_balance, TRUE;
    RETURN;
  END IF;

  INSERT INTO loyalty_transactions (member_id, points, type, description)
  VALUES (p_member_id, p_points, p_type, p_description)
  RETURNING id INTO v_txn;

  UPDATE loyalty_members
  SET points_balance = v_balance + p_points
  WHERE id = p_member_id;

  RETURN QUERY SELECT v_txn, v_balance + p_points, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION loyalty_apply_referral_points(UUID, INTEGER, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION loyalty_apply_referral_points(UUID, INTEGER, TEXT, TEXT, INTEGER)
  TO service_role;
