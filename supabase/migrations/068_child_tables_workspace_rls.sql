-- ============================================================
-- 068: Workspace-scope the five child tables still on legacy
--      per-user ownership policies from migration 001.
--
-- contact_tags, contact_custom_values, contact_notes,
-- broadcast_recipients and messages were never migrated to the
-- workspace model (010/015): their policies still gate on the
-- creator's user_id (directly or via the parent row), so
-- teammates who didn't create the parent contact / broadcast /
-- conversation can't read or write them through the session
-- client, and the viewer role (065/066) isn't enforced.
--
-- None of these tables has a workspace_id column; the workspace
-- is resolved through the NOT NULL parent FK:
--   contact_tags.contact_id            -> contacts.workspace_id
--   contact_custom_values.contact_id   -> contacts.workspace_id
--   contact_notes.contact_id           -> contacts.workspace_id
--   broadcast_recipients.broadcast_id  -> broadcasts.workspace_id
--   messages.conversation_id           -> conversations.workspace_id
--
-- Pattern follows 066_viewer_read_only.sql: a FOR ALL policy
-- gated on is_active_workspace_writer() plus a FOR SELECT policy
-- gated on is_active_workspace_member(), permissive (OR'd), so
-- viewers keep read access while writes need a non-viewer role.
-- (FOR ALL's WITH CHECK defaults to USING, so inserts are covered.)
--
-- Ordering: safe to run before or after 066. The writer helper is
-- (re)created here with a role::text comparison so it doesn't
-- reference the 'viewer' enum value added in 065 — identical
-- behavior to 066's definition once 'viewer' exists, and it
-- doesn't fail if 065/066 haven't been applied yet.
--
-- messages also loses the migration-001 policy
-- "Service role can insert messages" WITH CHECK (true): it had no
-- TO clause, so it let ANY authenticated user insert into ANY
-- conversation. The service role bypasses RLS and never needed it;
-- webhook/system inserts are unaffected.
-- ============================================================


-- ---------------------------------------------------------------------------
-- 1. Helper: is_active_workspace_writer(workspace_id, user_id)
--    Same definition as 066 but 'viewer' is compared as text so this
--    migration doesn't depend on the enum value from 065.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_workspace_writer(
  p_workspace_id UUID,
  p_user_id      UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.user_id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_user_id
      AND wm.role::text <> 'viewer'
      AND p.status = 'active'
  )
  AND NOT public.is_owner_blocked(p_workspace_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_active_workspace_writer(UUID, UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. contact_tags (workspace via contacts)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage contact tags" ON public.contact_tags;

CREATE POLICY "Writers can manage contact tags" ON public.contact_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
        AND public.is_active_workspace_writer(contacts.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Active members can view contact tags" ON public.contact_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
        AND public.is_active_workspace_member(contacts.workspace_id, auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 3. contact_custom_values (workspace via contacts)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage custom values" ON public.contact_custom_values;

CREATE POLICY "Writers can manage custom values" ON public.contact_custom_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_custom_values.contact_id
        AND public.is_active_workspace_writer(contacts.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Active members can view custom values" ON public.contact_custom_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_custom_values.contact_id
        AND public.is_active_workspace_member(contacts.workspace_id, auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 4. contact_notes (workspace via contacts; was auth.uid() = user_id,
--    so teammates couldn't even READ each other's notes)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own notes" ON public.contact_notes;

CREATE POLICY "Writers can manage contact notes" ON public.contact_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_notes.contact_id
        AND public.is_active_workspace_writer(contacts.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Active members can view contact notes" ON public.contact_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_notes.contact_id
        AND public.is_active_workspace_member(contacts.workspace_id, auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 5. broadcast_recipients (workspace via broadcasts)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON public.broadcast_recipients;

CREATE POLICY "Writers can manage broadcast recipients" ON public.broadcast_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.broadcasts
      WHERE broadcasts.id = broadcast_recipients.broadcast_id
        AND public.is_active_workspace_writer(broadcasts.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Active members can view broadcast recipients" ON public.broadcast_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.broadcasts
      WHERE broadcasts.id = broadcast_recipients.broadcast_id
        AND public.is_active_workspace_member(broadcasts.workspace_id, auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 6. messages (workspace via conversations)
--    Also drops the wide-open INSERT policy from 001 (see header).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON public.messages;

CREATE POLICY "Writers can manage messages" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND public.is_active_workspace_writer(conversations.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Active members can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND public.is_active_workspace_member(conversations.workspace_id, auth.uid())
    )
  );
