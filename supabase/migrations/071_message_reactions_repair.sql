-- ============================================================
-- 071_message_reactions_repair.sql
--
-- Emoji reactions failed with:
--   "there is no unique or exclusion constraint matching the
--    ON CONFLICT specification"
--
-- Why: message_reactions exists in production but WITHOUT the
-- UNIQUE (message_id, actor_type, actor_id) constraint that
-- migration 028 declares. The table was created by the ad-hoc DDL in
-- /api/admin/setup-db, whose CREATE TABLE omitted the constraint —
-- so 028's `CREATE TABLE IF NOT EXISTS` then found the table already
-- present and skipped it, constraint included. The route's SQL is
-- corrected in the same commit as this migration.
--
-- Also replaces 028's per-user RLS policies with workspace-scoped
-- ones, matching migrations 066/068: a reaction belongs to the
-- workspace's conversation, not to whoever happens to have created
-- the conversation row, so teammates must be able to see it.
--
-- Idempotent.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. De-duplicate before adding the constraint.
--    Keeps the most recent reaction per (message, actor).
-- ---------------------------------------------------------------
DELETE FROM public.message_reactions r
USING public.message_reactions keep
WHERE r.message_id = keep.message_id
  AND r.actor_type = keep.actor_type
  AND r.actor_id IS NOT DISTINCT FROM keep.actor_id
  AND (
    r.created_at < keep.created_at
    OR (r.created_at = keep.created_at AND r.id < keep.id)
  );

-- ---------------------------------------------------------------
-- 2. The constraint the upsert needs.
-- ---------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.message_reactions
    ADD CONSTRAINT message_reactions_message_actor_key
    UNIQUE (message_id, actor_type, actor_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;   -- constraint/index already present
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------
-- 3. Workspace-scoped RLS.
--
-- 028 gated on conversations.user_id = auth.uid(), which hides a
-- teammate's reactions (and blocks writing to a conversation someone
-- else opened). Scope through the conversation's workspace instead.
-- ---------------------------------------------------------------
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see reactions on their conversations" ON public.message_reactions;
DROP POLICY IF EXISTS "Users insert reactions on their conversations" ON public.message_reactions;
DROP POLICY IF EXISTS "Users delete their own agent reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Members view workspace reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Writers manage workspace reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Writers update workspace reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Writers delete own agent reactions" ON public.message_reactions;

CREATE POLICY "Members view workspace reactions" ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_member(c.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Writers manage workspace reactions" ON public.message_reactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_writer(c.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Writers update workspace reactions" ON public.message_reactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_writer(c.workspace_id, auth.uid())
    )
  );

-- Agents remove only their own reactions; customer reactions are
-- managed by the webhook with the service role.
CREATE POLICY "Writers delete own agent reactions" ON public.message_reactions
  FOR DELETE USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_writer(c.workspace_id, auth.uid())
    )
  );
