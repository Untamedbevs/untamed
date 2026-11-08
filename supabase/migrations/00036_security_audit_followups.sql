-- ============================================================================
-- Untamed Beverages - Security audit run 3 follow-ups
--
-- 1. email_segments: the staff read policy from 00029 still let
--    contractor_limited staff read saved audiences directly with their
--    session. Every other staff read policy excludes that role (00007, 00017,
--    00034).
-- 2. increment_visitor_pageviews(text) (00023) kept PostgreSQL's default
--    EXECUTE for PUBLIC, so the public key could bump any visitor's pageview
--    count and last_seen_at.
--
-- How the app reaches these (checked against src/):
--   * email_segments is read and written only by
--     src/app/api/admin/crm/segments/route.ts and [id]/route.ts, through
--     createAdminClient() (service role, bypasses RLS). No browser or
--     cookie-session client touches it, so the policy change affects only
--     direct reads with a staff session.
--   * increment_visitor_pageviews is called only by
--     src/app/api/tracking/pageview/route.ts, through createAdminClient()
--     (service role), which keeps EXECUTE below. That route also falls back
--     to a plain update if the call fails.
--
-- Safe to re-run: DROP POLICY IF EXISTS before CREATE, existence checks, and
-- GRANT/REVOKE (no-ops when repeated). One transaction, so a failure leaves
-- nothing half-applied.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. email_segments: same policy name as 00029, now excluding
--    contractor_limited.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.email_segments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Staff can read email segments" ON public.email_segments;
    CREATE POLICY "Staff can read email segments"
      ON public.email_segments FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.staff
          WHERE staff.auth_user_id = auth.uid()
            AND staff.is_active = true
            AND staff.role <> 'contractor_limited'
        )
      );
  END IF;
END
$$;

-- ============================================================================
-- 2. increment_visitor_pageviews(text): service role only.
-- ============================================================================
DO $$
BEGIN
  IF to_regprocedure('public.increment_visitor_pageviews(text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.increment_visitor_pageviews(text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.increment_visitor_pageviews(text) TO service_role;
  END IF;
END
$$;

COMMIT;
