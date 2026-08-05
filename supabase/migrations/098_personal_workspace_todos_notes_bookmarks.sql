-- ============================================================
-- 098 — Personal productivity for the My Workspace module.
--
-- Todos, notes and bookmarks that belong to ONE member, not to the
-- workspace. Three deliberate design choices:
--
-- 1. PRIVATE BY OWNER, not by workspace. Every other table in this
--    schema is readable by any active member of the workspace
--    (is_active_workspace_member). That is wrong for a personal
--    scratchpad, so the policies below require the row's
--    workspace_member_id to BE the caller. A colleague — including an
--    owner or admin — cannot read your notes through the API.
--
--    Note this is the one place where owners do not get everything.
--    That is the point; "my private notes" that the boss can read is a
--    misfeature, not a permission model.
--
-- 2. NOT in src/lib/auth/resources.ts, on purpose. Adding them would
--    generate RESTRICTIVE CRUD policies (migration 074) and a module
--    gate (073), which would mean a member needs a workspace permission
--    granted by an admin before they could write their own todo list.
--    Being a member IS the entitlement here. It also keeps them off the
--    public v1 API, which is correct: these are not workspace data.
--
-- 3. Todos are not assignable. Delegated work lives in `tasks`, which
--    already has assignment, comments, watchers and time logging. A
--    second assignable task table would split "work assigned to me"
--    across two places, which is the exact problem the My Work page
--    exists to solve.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Todos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    -- The owner. NOT NULL and cascading: a removed member's private list
    -- has no meaning to anyone else, so it goes with them.
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),

    due_date DATE,
    -- Separate from due_date so "due Friday, nudge me Thursday 9am" works.
    -- Surfaced in-app only; there is no scheduled-job infrastructure to
    -- send mail or push from, and a column that implies a notification
    -- nobody sends would be a lie.
    remind_at TIMESTAMPTZ,

    -- NULL = still open. A timestamp rather than a boolean so "what did I
    -- finish this week" is answerable without an audit table.
    completed_at TIMESTAMPTZ,

    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_todos_owner
    ON public.personal_todos (workspace_member_id, completed_at, due_date);
CREATE INDEX IF NOT EXISTS idx_personal_todos_workspace
    ON public.personal_todos (workspace_id);

-- ------------------------------------------------------------
-- Notes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,

    title TEXT NOT NULL DEFAULT 'Untitled note',
    -- HTML from the app's RichTextEditor, sanitised client-side by
    -- sanitizeHtml before it ever gets here.
    body_html TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_notes_owner
    ON public.personal_notes (workspace_member_id, is_pinned, updated_at DESC);

-- ------------------------------------------------------------
-- Bookmarks — quick links to anywhere, internal or external.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,

    label TEXT NOT NULL,
    -- Either an in-app path ('/invoices/abc') or an absolute URL. Stored
    -- as one column because the distinction is presentational: the UI
    -- checks for a leading '/' to decide whether to open a new tab.
    href TEXT NOT NULL,

    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_bookmarks_owner
    ON public.personal_bookmarks (workspace_member_id, sort_order);

-- ------------------------------------------------------------
-- updated_at maintenance (function from 001).
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at ON public.personal_todos;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.personal_todos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.personal_notes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.personal_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- RLS — owner only, on all four operations.
--
-- WITH CHECK matters as much as USING here: without it a member could
-- INSERT a row carrying someone else's workspace_member_id, or UPDATE
-- their own row to hand it to another member.
-- ------------------------------------------------------------
ALTER TABLE public.personal_todos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bookmarks ENABLE ROW LEVEL SECURITY;

-- Written out three times rather than generated in a DO block: this file
-- cannot be dry-run from the app, and plain statements fail obviously
-- instead of subtly.

DROP POLICY IF EXISTS "Owner can manage own personal_todos" ON public.personal_todos;
CREATE POLICY "Owner can manage own personal_todos" ON public.personal_todos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.id = personal_todos.workspace_member_id
              AND wm.workspace_id = personal_todos.workspace_id
              AND wm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.id = personal_todos.workspace_member_id
              AND wm.workspace_id = personal_todos.workspace_id
              AND wm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can manage own personal_notes" ON public.personal_notes;
CREATE POLICY "Owner can manage own personal_notes" ON public.personal_notes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.id = personal_notes.workspace_member_id
              AND wm.workspace_id = personal_notes.workspace_id
              AND wm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.id = personal_notes.workspace_member_id
              AND wm.workspace_id = personal_notes.workspace_id
              AND wm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can manage own personal_bookmarks" ON public.personal_bookmarks;
CREATE POLICY "Owner can manage own personal_bookmarks" ON public.personal_bookmarks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.id = personal_bookmarks.workspace_member_id
              AND wm.workspace_id = personal_bookmarks.workspace_id
              AND wm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.id = personal_bookmarks.workspace_member_id
              AND wm.workspace_id = personal_bookmarks.workspace_id
              AND wm.user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.personal_todos IS
    'Private per-member checklist. Owner-only RLS — not readable by other members, including owners and admins. Deliberately absent from resources.ts so no workspace permission is required.';
COMMENT ON TABLE public.personal_notes IS
    'Private per-member rich-text notes. Owner-only RLS; body_html is sanitised client-side.';
COMMENT ON TABLE public.personal_bookmarks IS
    'Private per-member quick links. href is an in-app path or an absolute URL.';
