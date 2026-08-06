-- ============================================================
-- 108 — restore co-member profile visibility
-- ============================================================
--
-- SYMPTOM: after the Daylink staff import, HR pages showed "Unknown
-- User" and attendance showed "Team Member" for everyone except the
-- viewer themself.
--
-- ROOT CAUSE, verified empirically with a real member JWT: as the
-- workspace owner, all 30 workspace_members rows are visible but only
-- ONE profiles row is — the caller's own. The co-member SELECT policy
-- that migration 035 defines exists in the repo but is NOT present in
-- this database (035 evidently never ran here, or a later change dropped
-- it), so profiles fell back to the 001 own-row-only policy. Every page
-- that resolves teammate names client-side — HR employees, attendance,
-- leave, workloads, project activity — rendered its fallback string.
--
-- This re-asserts 035's policy verbatim in intent: a user may read the
-- profile (name, email, avatar) of anyone who shares at least one
-- workspace with them. Nothing broader — profiles of strangers on other
-- tenants stay invisible, and only SELECT is granted.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Users can view profiles of their workspace members" ON public.profiles;

CREATE POLICY "Users can view profiles of their workspace members"
ON public.profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm1
        JOIN public.workspace_members wm2
          ON wm2.workspace_id = wm1.workspace_id
       WHERE wm1.user_id = auth.uid()
         AND wm2.user_id = public.profiles.user_id
    )
);

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT policyname FROM pg_policies
--  WHERE tablename = 'profiles' AND cmd = 'SELECT';
--   -- expect BOTH: "Users can view own profile"
--   --          AND "Users can view profiles of their workspace members"
--
-- Behavioural check (impersonate any member in the SQL editor):
--   SELECT count(*) FROM public.profiles p
--    WHERE EXISTS (SELECT 1 FROM public.workspace_members wm
--                   WHERE wm.user_id = p.user_id
--                     AND wm.workspace_id = 'ab6095d0-aa86-4328-934b-d56f26d8d7d8');
--   -- as the service role this counts all 30; after the policy, a
--   -- signed-in member's own query returns the same 30 instead of 1.
-- ============================================================
