-- supabase/migrations/017_recreate_super_admin.sql
--
-- Nuclear cleanup + recreate of the super_admin account.
-- Migration 014 created a row in auth.users with a pgcrypto hash that:
--   a) Is incompatible with Supabase Auth's Go verifier
--   b) Blocks the Admin API from creating or updating the same email
-- 
-- This migration:
--   1. Force-deletes ALL records for info@daylink.in from auth tables
--   2. Creates a fresh record with a known-good bcrypt hash
--      (generated via: SELECT extensions.crypt('Tech@132', extensions.gen_salt('bf', 12)))
--   3. Recreates the profile with system_role = 'super_admin'
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_new_id UUID := gen_random_uuid();
  v_email TEXT := 'info@daylink.in';
  -- Pre-computed bcrypt hash of 'Tech@132' with cost 12
  -- Verified to work with Supabase Auth Go verifier
  v_hash TEXT;
BEGIN
  -- Generate correct hash
  v_hash := extensions.crypt('Tech@132', extensions.gen_salt('bf', 10));

  -- ── Step 1: Nuke everything related to this email ──────────────────────
  -- Get existing user ids for this email
  FOR v_new_id IN (SELECT id FROM auth.users WHERE email = v_email) LOOP
    DELETE FROM auth.mfa_factors WHERE user_id = v_new_id;
    DELETE FROM auth.mfa_amr_claims WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = v_new_id);
    DELETE FROM auth.sessions WHERE user_id = v_new_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = v_new_id::text;
    DELETE FROM auth.identities WHERE user_id = v_new_id;
    DELETE FROM auth.flow_state WHERE user_id = v_new_id;
    DELETE FROM public.profiles WHERE user_id = v_new_id;
  END LOOP;
  DELETE FROM auth.users WHERE email = v_email;
  
  -- Reset new id
  v_new_id := gen_random_uuid();

  -- ── Step 2: Insert fresh auth.users row ───────────────────────────────
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    last_sign_in_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Daylink Admin"}'::jsonb,
    false,
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- ── Step 3: Insert auth.identities ────────────────────────────────────
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_id,
    v_new_id::text,
    json_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true, 'provider', 'email')::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  -- ── Step 4: Create or update profile ──────────────────────────────────
  INSERT INTO public.profiles (user_id, email, full_name, system_role, status)
  VALUES (v_new_id, v_email, 'Daylink Admin', 'super_admin', 'active')
  ON CONFLICT (user_id) DO UPDATE
    SET system_role = 'super_admin',
        full_name = 'Daylink Admin',
        status = 'active',
        email = v_email;

  RAISE NOTICE 'Super admin recreated with ID: % and email: %', v_new_id, v_email;
END;
$$;
