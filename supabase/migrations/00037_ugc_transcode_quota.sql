-- Enforce the per-member daily video (MediaConvert) cap atomically
-- (security audit run-3).
--
-- POST /api/portal/ugc used to count the member's video asset rows from the
-- last 24 hours and then insert in a separate call. The member can delete
-- their own pending submissions (the asset rows go with them through
-- ON DELETE CASCADE), and concurrent requests all read the same count, so
-- both reset or skip the cap of 20 while the MediaConvert jobs keep running.
--
-- ugc_transcode_log records one row per transcode slot handed out. Members
-- cannot read, write or delete it (RLS on, no policies, no grants), so
-- deleting a submission no longer gives slots back. ugc_reserve_video_slots
-- takes a per-member advisory lock, counts the last 24 hours and inserts the
-- new slots only when the total stays within the cap.
--
-- The app calls the function first and falls back to the old count only while
-- the function does not exist, so applying this migration needs no app change
-- and nothing breaks before it is applied. Videos submitted before this
-- migration is applied are not in the log, so each member's first 24 hours
-- after it is applied start from zero.

CREATE TABLE IF NOT EXISTS ugc_transcode_log (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ugc_transcode_log_user_created
  ON ugc_transcode_log (auth_user_id, created_at);

ALTER TABLE ugc_transcode_log ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (which bypasses RLS) and the
-- SECURITY DEFINER function below touch this table.
REVOKE ALL ON TABLE ugc_transcode_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE ugc_transcode_log_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION ugc_reserve_video_slots(
  p_auth_user_id UUID,
  p_count INTEGER,
  p_max INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  IF p_auth_user_id IS NULL OR p_count IS NULL OR p_max IS NULL
     OR p_count < 0 OR p_max < 0 THEN
    RAISE EXCEPTION 'invalid video slot reservation'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_count = 0 THEN
    RETURN TRUE;
  END IF;

  -- Serialize reservations for one member. Released at the end of the
  -- transaction (each PostgREST RPC call is its own transaction), so the count
  -- below sees every reservation committed before this one.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ugc_reserve_video_slots:' || p_auth_user_id::text, 0)
  );

  SELECT count(*) INTO v_used
  FROM public.ugc_transcode_log
  WHERE auth_user_id = p_auth_user_id
    AND created_at > now() - interval '24 hours';

  IF v_used + p_count > p_max THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ugc_transcode_log (auth_user_id)
  SELECT p_auth_user_id FROM generate_series(1, p_count);

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION ugc_reserve_video_slots(UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ugc_reserve_video_slots(UUID, INTEGER, INTEGER)
  TO service_role;
