-- ============================================================================
-- Link member and lead records only to login accounts the app created.
--
-- Supabase's public sign-up endpoint is reachable with the public key, and
-- the project's "Allow new users to sign up" setting can't be changed from
-- the app. A sign-up made there with a customer's address and a password of
-- the signer's choosing becomes confirmed as soon as the customer clicks
-- Supabase's own confirmation email (or at once if "Confirm email" is off).
-- Until now, a confirmed address was the only thing checked before linking
-- that customer's loyalty_members and distributor_leads rows (and so their
-- points) to the account.
--
-- The app now marks every account it creates with
-- raw_app_meta_data.untamed_portal = true (src/lib/auth/app-account.ts).
-- Only the service role can write app metadata. This migration:
--   1. makes link_auth_user_to_identities() (the insert and on-confirm
--      triggers from 00015 / 00034) skip unmarked accounts, matching the
--      app-side check in src/lib/auth/link-identities.ts, and
--   2. marks the existing confirmed accounts that are already linked to a
--      member, lead or staff row, so current members keep working.
--
-- Unconfirmed or unlinked accounts are left unmarked. If their owner asks for
-- a portal sign-in link, the app replaces them with a fresh, marked account.
--
-- Safe to re-run: CREATE OR REPLACE, and the backfill only adds the flag.
-- ============================================================================

BEGIN;

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

  -- Only accounts the app created (never Supabase public sign-ups).
  IF coalesce(NEW.raw_app_meta_data->>'untamed_portal', '') <> 'true' THEN
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

UPDATE auth.users u
  SET raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"untamed_portal": true}'::jsonb
  WHERE u.email_confirmed_at IS NOT NULL
    AND coalesce(u.raw_app_meta_data->>'untamed_portal', '') <> 'true'
    AND (
      EXISTS (SELECT 1 FROM public.loyalty_members m WHERE m.auth_user_id = u.id)
      OR EXISTS (SELECT 1 FROM public.distributor_leads d WHERE d.auth_user_id = u.id)
      OR EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_user_id = u.id)
    );

COMMIT;
