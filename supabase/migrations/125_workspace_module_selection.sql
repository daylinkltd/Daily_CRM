-- ============================================================
-- 125 — a workspace records which modules it actually uses
--
-- THE PROBLEM. The product grows modules, and every workspace gets all
-- of them. A restaurant's sidebar carries a project tracker; a
-- freelance designer's carries a bar till. New customers read that as
-- "this is somebody else's software", and the modules they DO need are
-- harder to find for being surrounded by ones they do not.
--
-- Two authorities already narrow module access and neither answers this
-- question:
--
--   saas_workspace_feature_flags  — what WE allow a tenant to have.
--                                   A kill switch we operate, not them.
--   workspace_roles.permissions   — who on the team sees each module.
--                                   Assumes the module is wanted at all.
--
-- Missing is the customer's own answer: which of these does this
-- business use? That is what `enabled_modules` records.
--
-- NULL MEANS EVERYTHING. Every existing workspace has no selection, and
-- must not lose its sidebar the moment this ships. The application
-- treats null and empty identically — an empty array would otherwise
-- hide every module including the navigation needed to undo it.
--
-- business_type and team_size are stored alongside, not to gate
-- anything, but because they are the input the recommendation came
-- from: without them, Settings → Modules can only show what was chosen,
-- never why, and cannot re-recommend when someone's business changes.
-- ============================================================

BEGIN;

ALTER TABLE public.workspaces
  -- Deliberately text[] and NOT a foreign key or enum: module keys live
  -- in the application (src/lib/auth/modules.ts) and a new module must
  -- not need a migration to become selectable. Unknown keys are ignored
  -- when access is resolved, so a removed module degrades quietly.
  ADD COLUMN IF NOT EXISTS enabled_modules text[],
  ADD COLUMN IF NOT EXISTS business_type   text,
  ADD COLUMN IF NOT EXISTS team_size       text;

COMMENT ON COLUMN public.workspaces.enabled_modules IS
  'Modules this business chose to use. NULL or empty means all of them — every workspace predating this feature is in that state.';
COMMENT ON COLUMN public.workspaces.business_type IS
  'Answer to "what kind of business is this", from BUSINESS_TYPES. Kept so the recommendation can be explained and revisited, not to gate anything.';

-- ------------------------------------------------------------
-- Setting the selection.
--
-- A function rather than an UPDATE policy for two reasons: the
-- owner/admin test is stated once here instead of being reconstructed
-- in RLS, and the empty-selection rule is enforced where it cannot be
-- forgotten. Turning everything off would hide the settings page that
-- turns it back on, so an empty array is stored as NULL — which the app
-- already reads as "all modules".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_workspace_modules(
  p_workspace uuid,
  p_modules   text[],
  p_business_type text DEFAULT NULL,
  p_team_size     text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text;
  v_final text[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_permitted: sign in first';
  END IF;

  SELECT wm.role INTO v_role
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace
     AND wm.user_id = v_actor
     AND wm.role IN ('owner', 'admin');

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not_permitted: only an owner or admin can change modules';
  END IF;

  -- Empty means "not chosen", never "none". See the header.
  v_final := CASE
               WHEN p_modules IS NULL OR cardinality(p_modules) = 0 THEN NULL
               ELSE p_modules
             END;

  UPDATE public.workspaces
     SET enabled_modules = v_final,
         business_type   = COALESCE(p_business_type, business_type),
         team_size       = COALESCE(p_team_size, team_size),
         updated_at      = now()
   WHERE id = p_workspace;

  RETURN v_final;
END;
$$;

REVOKE ALL ON FUNCTION public.set_workspace_modules(uuid, text[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_workspace_modules(uuid, text[], text, text) TO authenticated;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- Replace <ws> with a workspace id you own or administer.
--
-- 1. The columns exist and every existing workspace is untouched:
-- SELECT count(*) FILTER (WHERE enabled_modules IS NULL) AS unset,
--        count(*)                                        AS total
--   FROM public.workspaces;
--   -- expect unset = total immediately after running this
--
-- 2. Set a selection and read it back:
-- SELECT public.set_workspace_modules('<ws>',
--          ARRAY['crm','retail','accounting'], 'retail_shop', 'small');
-- SELECT enabled_modules, business_type, team_size
--   FROM public.workspaces WHERE id = '<ws>';
--
-- 3. An empty selection must come back as NULL, not as an empty array —
--    otherwise the sidebar would have no way back to settings:
-- SELECT public.set_workspace_modules('<ws>', ARRAY[]::text[]);
--   -- expect NULL
--
-- 4. Put it back to everything (NULL) or to a real selection before
--    you leave:
-- SELECT public.set_workspace_modules('<ws>',
--          ARRAY['crm','retail','accounting']);
--
-- 5. A member who is neither owner nor admin is refused:
--    (sign in as one and run step 2 — expect 'not_permitted')
-- ============================================================
