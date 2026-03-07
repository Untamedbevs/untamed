-- ================================================================
-- FIX CORRUPTED AUTH USERS
-- Run this in the Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard → your Untamed project → SQL Editor
-- ================================================================

-- Step 1: Clear the staff FK references so we don't hit constraint errors
UPDATE public.staff SET auth_user_id = NULL
WHERE email IN (
  'lee.thaxton@untamedbeverages.com',
  'carol.thaxton@untamedbeverages.com',
  'bruce.carr@untamedbeverages.com',
  'cindy.carr@untamedbeverages.com',
  'joe.colella@untamedbeverages.com',
  'sheila.colella@untamedbeverages.com'
);

-- Step 2: Delete any orphaned auth data for these emails
DELETE FROM auth.mfa_factors
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'lee.thaxton@untamedbeverages.com',
    'carol.thaxton@untamedbeverages.com',
    'bruce.carr@untamedbeverages.com',
    'cindy.carr@untamedbeverages.com',
    'joe.colella@untamedbeverages.com',
    'sheila.colella@untamedbeverages.com'
  )
);

DELETE FROM auth.sessions
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'lee.thaxton@untamedbeverages.com',
    'carol.thaxton@untamedbeverages.com',
    'bruce.carr@untamedbeverages.com',
    'cindy.carr@untamedbeverages.com',
    'joe.colella@untamedbeverages.com',
    'sheila.colella@untamedbeverages.com'
  )
);

DELETE FROM auth.refresh_tokens
WHERE session_id IN (
  SELECT id FROM auth.sessions WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN (
      'lee.thaxton@untamedbeverages.com',
      'carol.thaxton@untamedbeverages.com',
      'bruce.carr@untamedbeverages.com',
      'cindy.carr@untamedbeverages.com',
      'joe.colella@untamedbeverages.com',
      'sheila.colella@untamedbeverages.com'
    )
  )
);

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'lee.thaxton@untamedbeverages.com',
    'carol.thaxton@untamedbeverages.com',
    'bruce.carr@untamedbeverages.com',
    'cindy.carr@untamedbeverages.com',
    'joe.colella@untamedbeverages.com',
    'sheila.colella@untamedbeverages.com'
  )
);

DELETE FROM auth.users
WHERE email IN (
  'lee.thaxton@untamedbeverages.com',
  'carol.thaxton@untamedbeverages.com',
  'bruce.carr@untamedbeverages.com',
  'cindy.carr@untamedbeverages.com',
  'joe.colella@untamedbeverages.com',
  'sheila.colella@untamedbeverages.com'
);

-- Step 3: Verify cleanup - should return 0 rows
SELECT id, email FROM auth.users
WHERE email IN (
  'lee.thaxton@untamedbeverages.com',
  'carol.thaxton@untamedbeverages.com',
  'bruce.carr@untamedbeverages.com',
  'cindy.carr@untamedbeverages.com',
  'joe.colella@untamedbeverages.com',
  'sheila.colella@untamedbeverages.com'
);
