-- ── 062_profile_name_fallback.sql — Never create nameless profiles
--
-- Invited members who signed up without `full_name` in their auth
-- user_metadata got a profile row with full_name = '' from the
-- handle_new_user trigger (001), which surfaced as a literal "User"
-- row in Settings → Members. Fall back to the email local part at
-- insert time, and backfill existing empty rows the same way
-- (preferring any full_name that later landed in user_metadata).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      ''
    ),
    NEW.email
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Backfill: profiles whose full_name is empty/blank. Prefer the name
-- the user gave at signup (auth user_metadata), else email local part.
UPDATE public.profiles p
SET full_name = COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(split_part(COALESCE(p.email, u.email, ''), '@', 1), ''),
      p.full_name
    )
FROM auth.users u
WHERE u.id = p.user_id
  AND TRIM(COALESCE(p.full_name, '')) = '';
