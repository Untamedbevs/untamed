-- ============================================================================
-- Untamed Beverages - Security audit run 1: RLS and identity-link hardening
--
-- Fixes these audit fingerprints (security-audit run-1, base commit fe5ca4e):
--   rls:scheduled_posts:no-row-level-security
--   rls:get_member_identity:public-execute
--   rls:ugc_submissions:owner-policy-self-approval
--   rls:ugc_submissions:public-policy-exposes-all-columns
--   rls:staff-policies:contractor_limited-not-excluded
--   identity-link-by-unverified-email (database trigger half only; the
--     app-side linkAuthUserToIdentitiesByEmail is fixed in application code)
--
-- How the app reaches the database (checked against src/ at fe5ca4e):
--   * Only three Supabase client factories exist: src/lib/supabase/admin.ts
--     (service role, bypasses RLS), client.ts (browser, public key) and
--     server.ts (cookie session, public key). src/app/api/auth/callback and
--     src/middleware.ts build public-key clients only to call auth.*.
--   * Every table read or write through a public-key client is on staff,
--     ideas, media, campaigns (admin/layout.tsx, admin/page.tsx) or the
--     caller's own loyalty_members row (portal/ClassicChrome.tsx). Every other
--     public-key client call is auth.* (getUser, signIn, verifyOtp, signOut).
--   * No code uses raw /rest/v1 calls or realtime channels.
-- So none of the tables or functions changed below is reached by anything
-- other than the service-role client, which is not affected by RLS policies
-- or by grants revoked from anon / authenticated.
--
-- Safe to re-run: ALTER ... IF EXISTS, DROP ... IF EXISTS before every CREATE,
-- CREATE OR REPLACE FUNCTION, and GRANT/REVOKE (no-ops when repeated). The
-- whole file runs in one transaction, so a failure leaves nothing half-applied.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. scheduled_posts: turn on RLS and remove anon/authenticated table access
--
-- Fixes: 00010 created scheduled_posts without RLS, the only public table
-- without it, so the public key could read, edit or delete the posting queue
-- that the cron publishes to the company Facebook and Instagram accounts.
--
-- Why it is safe: every scheduled_posts query in src goes through
-- createAdminClient() (service role):
--   src/app/api/admin/schedule/route.ts         (GET, POST, PUT, DELETE)
--   src/app/api/admin/schedule/batch/route.ts
--   src/app/api/admin/schedule/[id]/publish/route.ts
--   src/app/api/cron/publish-scheduled/route.ts
-- No browser or cookie-session client touches the table. No policy is added
-- on purpose: with RLS on and no policy, only the service role can use it.
-- ============================================================================
ALTER TABLE IF EXISTS public.scheduled_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.scheduled_posts') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.scheduled_posts FROM anon, authenticated;
  END IF;
END
$$;

-- ============================================================================
-- 2. get_member_identity(uuid): service role only
--
-- Fixes: 00015 created this SECURITY DEFINER lookup without revoking the
-- default EXECUTE, so anyone with the public key could call
-- /rest/v1/rpc/get_member_identity with any auth user id and read that
-- member's email, first name, points balance and distributor details.
--
-- Why it is safe: nothing calls it. `grep -rn get_member_identity` over the
-- repo (excluding node_modules) finds only its definition in
-- 00015_end_user_auth.sql:80; resolve-member.ts reads loyalty_members
-- directly with the service-role client. The function is kept (not dropped)
-- and granted to service_role, matching the 00028/00032 pattern.
-- ============================================================================
DO $$
BEGIN
  IF to_regprocedure('public.get_member_identity(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_member_identity(UUID) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_member_identity(UUID) TO service_role;
  END IF;
END
$$;

-- ============================================================================
-- 3. ugc_submissions / ugc_submission_assets: remove owner writes and the
--    public read policies
--
-- Fixes:
--   * The owner INSERT/UPDATE policies (00016) only pinned auth_user_id, so a
--     signed-in user could insert or update their own row straight to
--     status 'featured', is_public true, contributor_type 'staff', etc., and
--     attach any asset URL, which then shows on the public /community gallery.
--   * The public SELECT policies (no TO clause, row filter only) let anyone
--     with the public key read every column of gallery rows, including
--     contributor_email, consent_signature, auth_user_id and member ids.
--
-- Why it is safe: every .from('ugc_submissions') and
-- .from('ugc_submission_assets') call in src uses createAdminClient():
--   src/app/api/portal/ugc/route.ts                member upload + list
--   src/app/api/portal/ugc/[id]/route.ts           member view + delete
--   src/app/api/admin/ugc/route.ts                 staff list
--   src/app/api/admin/ugc/[id]/route.ts            staff review
--   src/app/api/admin/ugc/[id]/retry-processing/route.ts
--   src/app/api/ugc/processing-complete/route.ts   video webhook
--   src/app/api/community/posts/route.ts           public gallery API
--   src/app/portal/page.tsx, src/app/portal/_preview/HomePreview.tsx
--   src/lib/video/mediaconvert.ts
--   src/lib/crm/blast-filters.ts
--   src/lib/referral-hq/progress.ts loadMemberHq(admin, ...), called only
--     with createAdminClient() from HomePreview.tsx and ReferralsPreview.tsx
-- The /community page reads through /api/community/posts (service role), so
-- dropping the public SELECT policies does not change the gallery.
-- The owner SELECT and owner DELETE (pending only) policies are kept.
-- ============================================================================
DROP POLICY IF EXISTS "Owners can create own ugc submissions" ON public.ugc_submissions;
DROP POLICY IF EXISTS "Owners can update own pending ugc submissions" ON public.ugc_submissions;
DROP POLICY IF EXISTS "Owners can create own ugc assets" ON public.ugc_submission_assets;

DROP POLICY IF EXISTS "Public can read approved public ugc submissions" ON public.ugc_submissions;
DROP POLICY IF EXISTS "Public can read approved public ugc assets" ON public.ugc_submission_assets;

-- ============================================================================
-- 4. Staff policies from 00013, 00014 and 00016: exclude contractor_limited
--
-- Fixes: these policies checked only staff.is_active, so an active
-- contractor_limited user (who signs in with the browser client and holds a
-- JWT) could read referral participant and invitee emails, email recipients
-- and bodies, and read or rewrite any UGC submission directly over PostgREST,
-- although the app blocks that role from all of these (resolveMemberDataStaff,
-- RESTRICTED_ROLES in the admin ugc routes). The SELECT policies are
-- recreated with their original names plus the 00007 condition
-- staff.role <> 'contractor_limited'. The two staff UPDATE policies on the
-- UGC tables are dropped.
--
-- Why it is safe: no public-key client reads or writes any of these tables.
-- Every .from() on referral_participants, referral_code_history,
-- referral_events, referral_rewards_earned, referral_invites,
-- messaging_campaigns, scheduled_messages, email_messages,
-- email_suppressions and email_webhook_events is in a server route or lib
-- that uses createAdminClient() (00014's own header says the same for the
-- email tables). The UGC tables are covered in section 3; staff review goes
-- through the service-role routes and the service-role-only
-- loyalty_review_ugc RPC (00032), so the staff UPDATE policies are unused.
--
-- Left unchanged on purpose: "Staff can read/update distributor leads" (the
-- app lets every staff role, including contractor_limited, use the retail
-- routes via resolveStaff), "Staff can read all reward tiers" (program
-- config, no member data) and "Admins can delete ugc submissions" (already
-- limited to super_admin/admin).
-- ============================================================================

-- ----- 00013 referral tables -----
DROP POLICY IF EXISTS "Staff can read referral participants" ON public.referral_participants;
CREATE POLICY "Staff can read referral participants"
  ON public.referral_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read referral code history" ON public.referral_code_history;
CREATE POLICY "Staff can read referral code history"
  ON public.referral_code_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read referral events" ON public.referral_events;
CREATE POLICY "Staff can read referral events"
  ON public.referral_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read referral rewards earned" ON public.referral_rewards_earned;
CREATE POLICY "Staff can read referral rewards earned"
  ON public.referral_rewards_earned FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read referral invites" ON public.referral_invites;
CREATE POLICY "Staff can read referral invites"
  ON public.referral_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- ----- 00014 messaging / email tables -----
DROP POLICY IF EXISTS "Staff can read messaging campaigns" ON public.messaging_campaigns;
CREATE POLICY "Staff can read messaging campaigns"
  ON public.messaging_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Staff can read scheduled messages"
  ON public.scheduled_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read email messages" ON public.email_messages;
CREATE POLICY "Staff can read email messages"
  ON public.email_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read email suppressions" ON public.email_suppressions;
CREATE POLICY "Staff can read email suppressions"
  ON public.email_suppressions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- email_webhook_events holds recipient_email and the raw SES payload.
DROP POLICY IF EXISTS "Staff can read email webhook events" ON public.email_webhook_events;
CREATE POLICY "Staff can read email webhook events"
  ON public.email_webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- ----- 00016 UGC tables -----
DROP POLICY IF EXISTS "Staff can read all ugc submissions" ON public.ugc_submissions;
CREATE POLICY "Staff can read all ugc submissions"
  ON public.ugc_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

DROP POLICY IF EXISTS "Staff can read all ugc assets" ON public.ugc_submission_assets;
CREATE POLICY "Staff can read all ugc assets"
  ON public.ugc_submission_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- No public-key client updates either UGC table (see section 3), so the
-- staff UPDATE policies are removed rather than narrowed.
DROP POLICY IF EXISTS "Staff can update ugc submissions" ON public.ugc_submissions;
DROP POLICY IF EXISTS "Staff can update ugc assets" ON public.ugc_submission_assets;

-- ============================================================================
-- 5. Identity linking: only link confirmed email addresses
--
-- Fixes: the 00015 trigger stamped auth_user_id onto every loyalty_members
-- and distributor_leads row with a matching email as soon as an auth.users
-- row was inserted, confirmed or not. An unconfirmed sign-up with a
-- customer's email (possible if public sign-up is enabled in Supabase Auth)
-- could therefore claim that customer's member row and points.
--
-- Change:
--   * The function now returns without linking unless
--     NEW.email_confirmed_at IS NOT NULL.
--   * A new AFTER UPDATE OF email_confirmed_at trigger runs the same linking
--     when a user goes from unconfirmed to confirmed.
--   * Matching stays exact: lower(email) = lower(NEW.email). The trigger
--     never used a pattern match (the ILIKE in link-identities.ts is app
--     code and is fixed there).
--   * A unique_violation on loyalty_members.auth_user_id (UNIQUE) is caught
--     and logged instead of aborting the auth transaction, so a data
--     oddity (for example two member rows whose emails differ only by case)
--     can never block a sign-in or confirmation. That case is left unlinked;
--     the app-side ensureMemberForAuthUser still runs on portal sign-in.
--   * SECURITY DEFINER and SET search_path = public are kept as in 00015.
--
-- Why it is safe:
--   * CREATE OR REPLACE keeps the same function, so the existing
--     link_auth_user_to_identities_trigger (AFTER INSERT) keeps calling it
--     and is not touched here.
--   * The app's own sign-up path creates users already confirmed
--     (src/lib/auth/send-portal-magic-link.ts, admin.createUser with
--     email_confirm: true).
--     Whether GoTrue sets email_confirmed_at in the INSERT or in a follow-up
--     UPDATE, one of the two triggers links the rows, so members created by
--     the app are linked exactly as before.
--   * Magic-link and OTP sign-ups that start unconfirmed are linked when
--     GoTrue confirms them, and the portal callback
--     (src/app/portal/auth/callback/route.ts) and resolveMember also link
--     through the service-role client, so portal sign-in never depends on
--     the trigger alone.
--   * The UPDATE trigger only fires when email_confirmed_at is in the
--     UPDATE's column list, and its WHEN clause limits it to the
--     NULL -> NOT NULL transition, so routine auth.users updates
--     (last_sign_in_at, tokens) do no extra work.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.link_auth_user_to_identities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Only a confirmed address proves the user owns that mailbox.
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  user_email := lower(NEW.email);
  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    UPDATE loyalty_members
      SET auth_user_id = NEW.id, updated_at = now()
      WHERE lower(email) = user_email
        AND auth_user_id IS NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'link_auth_user_to_identities: loyalty_members not linked for auth user % (unique_violation)', NEW.id;
  END;

  UPDATE distributor_leads
    SET auth_user_id = NEW.id, updated_at = now()
    WHERE lower(email) = user_email
      AND auth_user_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_auth_user_to_identities_on_confirm_trigger ON auth.users;
CREATE TRIGGER link_auth_user_to_identities_on_confirm_trigger
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.link_auth_user_to_identities();

COMMIT;
