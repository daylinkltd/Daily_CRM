-- ============================================================
-- 096 — Make the hr_operational_settings upsert actually upsert.
--
-- 051 created UNIQUE(workspace_id, setting_type, scope_type, scope_id).
-- A plain UNIQUE constraint is NULLS DISTINCT, and scope_id is NULL for
-- every WORKSPACE_DEFAULT row (051:52 says so explicitly). Two NULLs
-- never conflict, so the ON CONFLICT in /api/hr/settings could not match
-- an existing default row: every save INSERTed another copy, and the
-- GET on the same route returns all of them.
--
-- PostgREST infers the arbiter index from the onConflict column list, so
-- the fix has to keep an index on exactly those four columns — hence
-- NULLS NOT DISTINCT (PG15+) rather than partial indexes, which would
-- break inference.
--
-- Verified before writing: hr_operational_settings holds 0 rows across
-- all workspaces, so there are no existing duplicates to collapse first
-- and the new index cannot fail to build.
--
-- Idempotent; safe to re-run.
-- ============================================================

DO $$
DECLARE
    v_conname TEXT;
    v_version INT;
BEGIN
    SELECT current_setting('server_version_num')::int INTO v_version;
    IF v_version < 150000 THEN
        RAISE EXCEPTION
            'Migration 096 needs PostgreSQL 15+ for NULLS NOT DISTINCT (this server is %). Do not skip it — the duplicate-settings bug stays unfixed.',
            current_setting('server_version');
    END IF;

    -- Drop the old constraint by lookup: the inline UNIQUE from 051
    -- generates a name longer than the 63-char identifier limit, so the
    -- truncated form cannot be relied on literally.
    SELECT con.conname INTO v_conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'hr_operational_settings'
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname ORDER BY att.attname)
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = k.attnum
      ) = ARRAY['scope_id', 'scope_type', 'setting_type', 'workspace_id'];

    IF v_conname IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE public.hr_operational_settings DROP CONSTRAINT %I',
            v_conname
        );
    END IF;
END
$$;

-- NULLS NOT DISTINCT: one WORKSPACE_DEFAULT row per
-- (workspace, setting_type) instead of unlimited copies.
CREATE UNIQUE INDEX IF NOT EXISTS hr_operational_settings_scope_uniq
    ON public.hr_operational_settings (workspace_id, setting_type, scope_type, scope_id)
    NULLS NOT DISTINCT;

COMMENT ON INDEX public.hr_operational_settings_scope_uniq IS
    'NULLS NOT DISTINCT so WORKSPACE_DEFAULT rows (scope_id IS NULL) collide and the API upsert updates instead of duplicating.';
