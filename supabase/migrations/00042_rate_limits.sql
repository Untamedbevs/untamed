-- ============================================================================
-- Rate limits for public endpoints (lead form, creator applications, sign-in
-- emails, large uploads).
--
-- Serverless functions don't share memory, so the count lives here.
-- rate_limit_take() takes a per-key lock, counts the key's hits inside the
-- window and records one more only when the total stays under the limit, so
-- requests arriving at the same moment can't all slip through.
--
-- Keys are keyed hashes of an IP address or email (src/lib/security/rate-limit.ts),
-- never the raw value. Rows older than two days are pruned as the function
-- runs. Only the service role can use the table or the function.
--
-- Safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_bucket_key_created
  ON rate_limit_hits (bucket, key, created_at);

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE rate_limit_hits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE rate_limit_hits_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION rate_limit_take(
  p_bucket TEXT,
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_limit <= 0 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('rate_limit:' || p_bucket || ':' || p_key, 0));

  SELECT count(*) INTO v_count
    FROM rate_limit_hits
    WHERE bucket = p_bucket
      AND key = p_key
      AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO rate_limit_hits (bucket, key) VALUES (p_bucket, p_key);

  -- Occasional pruning keeps the table small without a separate job.
  IF random() < 0.02 THEN
    DELETE FROM rate_limit_hits WHERE created_at < now() - INTERVAL '2 days';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION rate_limit_take(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rate_limit_take(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

COMMIT;
