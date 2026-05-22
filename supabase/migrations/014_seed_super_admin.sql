-- supabase/migrations/014_seed_super_admin.sql
--
-- Safely seeds the fixed SaaS super_admin credentials: info@daylink.in / Tech@132
-- This enables login at /saas-admin/login out of the box without manual Supabase dashboard setup.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_email TEXT := 'info@daylink.in';
    v_password TEXT := 'Tech@132';
    v_existing_id UUID;
BEGIN
    -- Check if user already exists
    SELECT id INTO v_existing_id FROM auth.users WHERE email = v_email;

    IF v_existing_id IS NOT NULL THEN
        -- Promote existing user
        UPDATE public.profiles
        SET system_role = 'super_admin'
        WHERE user_id = v_existing_id;
        
        -- Optionally update password if needed
        UPDATE auth.users
        SET encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf'))
        WHERE id = v_existing_id;
        
        RAISE NOTICE 'Admin user already exists. Promoted to super_admin.';
    ELSE
        -- Insert into auth.users (will cascade to profiles due to trigger)
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            v_email,
            extensions.crypt(v_password, extensions.gen_salt('bf')),
            now(),
            now(),
            now()
        );

        -- Insert into auth.identities
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
            v_user_id,
            v_user_id::text,
            format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)::jsonb,
            'email',
            now(),
            now(),
            now()
        );

        -- Wait a moment to ensure trigger completes (optional, usually instant in postgres)
        
        -- Promote to super_admin
        UPDATE public.profiles
        SET system_role = 'super_admin',
            full_name = 'Daylink Admin'
        WHERE user_id = v_user_id;

        RAISE NOTICE 'Created new super_admin user.';
    END IF;
END;
$$;
