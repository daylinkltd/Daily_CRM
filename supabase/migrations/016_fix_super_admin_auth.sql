-- supabase/migrations/016_fix_super_admin_auth.sql
--
-- The migration 014 used pgcrypto.crypt() to insert into auth.users,
-- but this sometimes fails silently or produces an incompatible hash.
-- This migration safely deletes any broken auth user record for info@daylink.in
-- and leaves the profile row clean so the seed-admin API route can recreate it
-- via the Admin SDK (which produces correct Argon2/bcrypt hashes).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find the user_id from profiles (may or may not have a matching auth.users row)
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE email = 'info@daylink.in'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Remove from auth.identities first (FK constraint)
    DELETE FROM auth.identities WHERE user_id::text = v_user_id::text;
    
    -- Remove from auth.sessions
    DELETE FROM auth.sessions WHERE user_id::text = v_user_id::text;
    
    -- Remove from auth.refresh_tokens  
    DELETE FROM auth.refresh_tokens WHERE user_id::text = v_user_id::text;
    
    -- Remove the auth.users row
    DELETE FROM auth.users WHERE id::text = v_user_id::text;
    
    -- Also delete the profile so the trigger can recreate it cleanly
    DELETE FROM public.profiles WHERE user_id::text = v_user_id::text;
    
    RAISE NOTICE 'Cleaned up broken super_admin auth records for user_id: %', v_user_id;
  ELSE
    RAISE NOTICE 'No existing super_admin profile found — nothing to clean up.';
  END IF;
END;
$$;
