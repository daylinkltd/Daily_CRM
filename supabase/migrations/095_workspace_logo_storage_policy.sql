-- ============================================================
-- 095 — Let owners and admins upload a workspace logo.
--
-- THE BUG: Settings -> Branding uploaded the company logo to the
-- `avatars` bucket at `{workspace_id}/company-logo-*.png`, but the only
-- INSERT policy on that bucket (migration 008) is:
--
--     auth.uid()::text = (storage.foldername(name))[1]
--
-- i.e. the first folder must be the UPLOADER'S user id. A workspace id
-- never matches, so every logo upload was rejected with "new row violates
-- row-level security policy".
--
-- Worse, the component threw on that error BEFORE updating the workspaces
-- row, so a failed logo upload also silently prevented the company name,
-- address, phone and website from saving. One broken policy made the whole
-- panel look like it did not persist anything.
--
-- A workspace logo is not a user avatar: it belongs to the organisation
-- and any owner or admin should be able to replace it, not just whoever
-- first uploaded it. So it gets its own path prefix and its own policies,
-- scoped to workspace membership rather than to a single user.
--
--     avatars/workspace-logos/{workspace_id}/logo-<timestamp>.<ext>
--
-- The existing avatar policies are untouched.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- Reads stay public: the bucket is public and the logo is rendered in the
-- app chrome and on documents.

DROP POLICY IF EXISTS "Workspace admins can upload a workspace logo" ON storage.objects;
CREATE POLICY "Workspace admins can upload a workspace logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'workspace-logos'
    -- The second folder is the workspace id, and the uploader must be an
    -- owner or admin OF THAT workspace — so one tenant cannot write a logo
    -- into another tenant's folder.
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Workspace admins can replace a workspace logo" ON storage.objects;
CREATE POLICY "Workspace admins can replace a workspace logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'workspace-logos'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Workspace admins can delete a workspace logo" ON storage.objects;
CREATE POLICY "Workspace admins can delete a workspace logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'workspace-logos'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );
