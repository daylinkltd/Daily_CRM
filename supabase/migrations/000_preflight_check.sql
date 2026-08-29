-- ============================================================
-- PREFLIGHT — what is actually applied in this database?
--
-- Not a migration. Nothing here writes anything: paste it, read the
-- result, and it tells you exactly which migrations have landed and
-- which have not.
--
-- WHY THIS EXISTS. Migrations are pasted by hand, so "did 100 run?" has
-- only ever been answerable from memory — and memory was wrong at least
-- once: migration 122 failed on a missing `user_sessions`, which is
-- migration 100's table, long after everyone assumed single-device
-- sign-in was live. A failed paste leaves no trace, and several of
-- these features fail SILENTLY when their objects are absent (the
-- session guard treats an erroring RPC as "unknown" and lets the
-- request through), so nothing surfaces until something unrelated
-- trips over it.
--
-- Run this first, whenever a migration errors or a feature seems inert.
--
-- ONE statement on purpose: the Supabase SQL editor shows only the last
-- result set, so splitting this in two meant half the answer silently
-- disappeared — which is how the first run of this file reported the
-- column checks and hid the object table entirely.
-- ============================================================

WITH expected(migration, kind, object_name, what_breaks_without_it) AS (
  VALUES
    ('100', 'table',  'user_sessions',
       'Single-device sign-in. The guard fails OPEN, so two devices stay signed in.'),
    ('100', 'function','revoke_user_sessions',
       'Sign-out-everywhere, and the sign-out on password change/block.'),
    ('101', 'table',  'platform_activity_log',
       'The admin-only activity log every console screen reads.'),
    ('101', 'table',  'saas_admin_audit',
       'The audit trail of what platform admins did.'),
    ('101', 'table',  'platform_announcements',
       'Console announcements.'),
    ('102', 'function','enforce_membership_rules',
       'The seat ceiling. Members can be added past the paid seat count.'),
    ('103', 'table',  'coupons',
       'Checkout coupons.'),
    ('103', 'function','redeem_coupon',
       'Coupon redemption at checkout.'),
    ('105', 'table',  'platform_payments',
       'The revenue page and payment reconciliation.'),
    ('105', 'function','purge_workspace',
       'Deleting a tenant from the console.'),
    ('106', 'table',  'platform_message_templates',
       'Platform message templates.'),
    ('106', 'table',  'platform_outbound_messages',
       'The send log - "did that reset email go out?" becomes unanswerable.'),
    ('107', 'table',  'platform_settings',
       'Platform mailbox credentials. ALL product email stops.'),
    ('117', 'function','freeze_issued_official_documents',
       'Letter immutability, and unlocking an issued letter back to draft.'),
    ('118', 'function','tenant_seat_usage',
       'Pooled seats. A 5-seat plan still allows 5 people PER workspace.'),
    ('121', 'table',  'platform_email_codes',
       'One-time codes: two-factor, email verification, step-up.'),
    ('122', 'function','mark_session_two_factor_verified',
       'Two-step sign-in cannot be satisfied.')
),
objects AS (
  SELECT
    e.migration,
    e.object_name AS check_name,
    CASE
      WHEN e.kind = 'table'
        THEN CASE WHEN to_regclass('public.' || e.object_name) IS NULL
                  THEN '-- MISSING --' ELSE 'present' END
      ELSE CASE WHEN EXISTS (
             SELECT 1 FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = e.object_name)
           THEN 'present' ELSE '-- MISSING --' END
    END AS status,
    e.what_breaks_without_it AS impact
  FROM expected e
),
details AS (
  SELECT '119' AS migration, 'co-member profile reads' AS check_name,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies
            WHERE tablename = 'profiles'
              AND policyname = 'Users can view profiles of their workspace members')
         THEN 'present' ELSE '-- MISSING --' END AS status,
         'Teammate names render as "Unknown User" / "Team Member".' AS impact
  UNION ALL
  SELECT '119', 'Agent renamed to Team Member',
         CASE WHEN EXISTS (
           SELECT 1 FROM public.workspace_roles WHERE name = 'Agent' AND is_system)
         THEN '-- MISSING --' ELSE 'present' END,
         'The built-in staff role still reads "Agent".'
  UNION ALL
  SELECT '119', 'Team & Access permission seeded',
         CASE WHEN EXISTS (
           SELECT 1 FROM public.workspace_roles WHERE permissions ? 'team_members:create')
         THEN 'present' ELSE '-- MISSING --' END,
         'Who may add users is not configurable per role.'
  UNION ALL
  SELECT '122', 'two_factor_enabled on profiles',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_name = 'profiles' AND column_name = 'two_factor_enabled')
         THEN 'present' ELSE '-- MISSING --' END,
         'The two-step sign-in switch has nowhere to store its state.'
  UNION ALL
  SELECT '122', 'two_factor_verified_at on user_sessions',
         CASE WHEN to_regclass('public.user_sessions') IS NULL
                THEN '-- MISSING (run 100 first) --'
              WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_sessions' AND column_name = 'two_factor_verified_at')
                THEN 'present'
              ELSE '-- MISSING --' END,
         'A session can never be marked as having answered its code.'
)
SELECT status, migration, check_name, impact
  FROM (SELECT * FROM objects UNION ALL SELECT * FROM details) all_checks
 -- Missing things first: that is the list you act on.
 ORDER BY (status = 'present'), migration, check_name;
