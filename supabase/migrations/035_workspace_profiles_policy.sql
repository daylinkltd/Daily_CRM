-- ── 035_workspace_profiles_policy.sql — Allow workspace members to view other member profiles
--
-- Adds a SELECT policy to public.profiles table so users can view the profile details
-- (full_name, email, avatar_url) of any other user who shares at least one workspace with them.

DROP POLICY IF EXISTS "Users can view profiles of their workspace members" ON public.profiles;

CREATE POLICY "Users can view profiles of their workspace members"
ON public.profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm1
        WHERE wm1.user_id = auth.uid()
          AND EXISTS (
              SELECT 1 FROM public.workspace_members wm2
              WHERE wm2.workspace_id = wm1.workspace_id
                AND wm2.user_id = public.profiles.user_id
          )
    )
);
