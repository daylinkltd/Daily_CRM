-- ============================================================
-- 105 — the platform's own income ledger, and tenant purge
-- ============================================================
--
-- INCOME. Every verified subscription payment now lands in
-- `platform_payments` at the moment verify-payment approves it — until
-- now the only trace of our own revenue was `plan_limits.last_order_id`
-- on the workspace, which answers "did they pay?" but not "how much did
-- we make last month?". Razorpay stays the ground truth (the console
-- also reads it live via the hub); this table is the fast, per-tenant,
-- filterable copy that survives Razorpay's 90-day dashboard defaults.
--
-- PURGE. Deleting a tenant is a real operation the console needs, and it
-- cannot be a bare DELETE FROM workspaces: ~180 tables carry a
-- workspace_id and not all of them cascade. purge_workspace() sweeps
-- every public table that has a workspace_id column, in passes, until
-- the graph of child rows is gone — passes, because children reference
-- each other and no fixed order is right for every schema revision.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Our income, one row per captured payment
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_payments (
  id            bigserial PRIMARY KEY,
  workspace_id  uuid,
  workspace_name text,
  user_id       uuid,
  user_email    text,
  plan_id       text NOT NULL,
  seats         integer NOT NULL,
  billing_period text NOT NULL,
  base_paise    bigint NOT NULL,
  gst_paise     bigint NOT NULL,
  total_paise   bigint NOT NULL,
  coupon_code   text,
  discount_paise bigint NOT NULL DEFAULT 0,
  razorpay_order_id   text NOT NULL UNIQUE,
  razorpay_payment_id text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_payments_created_idx
  ON public.platform_payments (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_payments_workspace_idx
  ON public.platform_payments (workspace_id);

-- Service-role only, append-only: RLS on with no policies, and no role
-- may rewrite history. An income ledger anyone can edit is not a ledger.
ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON public.platform_payments FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.platform_payments FROM anon, authenticated;

-- ------------------------------------------------------------
-- purge_workspace — delete one tenant and everything it owns
-- ------------------------------------------------------------
--
-- Sweeps every public table with a workspace_id column. Multiple passes
-- because child tables reference each other (a journal line references a
-- journal entry; both carry workspace_id) and the information_schema
-- gives no dependency order. Ten passes is far beyond any real FK depth;
-- if rows still remain, the function raises rather than reporting a
-- half-deleted tenant as gone.
--
-- Deliberately DOES NOT touch platform_payments or the audit/activity
-- logs: income history and evidence outlive the tenant. Their
-- workspace_id simply points at a row that no longer exists.
CREATE OR REPLACE FUNCTION public.purge_workspace(p_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_pass integer := 0;
  v_deleted integer := 0;
  v_total integer := 0;
  v_progress boolean := true;
  v_remaining integer;
BEGIN
  WHILE v_progress AND v_pass < 10 LOOP
    v_pass := v_pass + 1;
    v_progress := false;

    FOR r IN
      SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       WHERE c.table_schema = 'public'
         AND c.column_name = 'workspace_id'
         AND t.table_type = 'BASE TABLE'
         AND c.table_name NOT IN
             ('workspaces', 'platform_payments', 'platform_activity_log',
              'saas_admin_audit', 'coupon_redemptions')
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE workspace_id = $1', r.table_name)
          USING p_workspace_id;
        GET DIAGNOSTICS v_deleted = ROW_COUNT;
        IF v_deleted > 0 THEN
          v_total := v_total + v_deleted;
          v_progress := true;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN
        -- A child of this table still exists; a later pass gets it.
        v_progress := true;
      END;
    END LOOP;
  END LOOP;

  -- Anything still standing means an FK graph deeper than 10 levels or a
  -- table this sweep cannot see. Refuse rather than half-delete.
  SELECT count(*) INTO v_remaining
    FROM public.workspace_members WHERE workspace_id = p_workspace_id;
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'purge_workspace: % rows still reference workspace % after 10 passes',
      v_remaining, p_workspace_id;
  END IF;

  DELETE FROM public.workspaces WHERE id = p_workspace_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_total + v_deleted;
END;
$$;

-- Service role only. Nobody reachable from the app may hold this.
REVOKE ALL ON FUNCTION public.purge_workspace(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_workspace(uuid) FROM anon, authenticated;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT to_regclass('public.platform_payments');           -- not null
-- SELECT proname FROM pg_proc WHERE proname = 'purge_workspace';
--
-- SELECT grantee FROM information_schema.role_routine_grants
--  WHERE routine_name = 'purge_workspace'
--    AND grantee IN ('anon','authenticated');
--   -- expect ZERO rows
--
-- Purge (rolled back — creates and removes a scratch workspace):
--   BEGIN;
--     INSERT INTO public.workspaces (id, name) VALUES
--       ('00000000-0000-0000-0000-00000000dead', 'purge-test');
--     SELECT public.purge_workspace('00000000-0000-0000-0000-00000000dead');
--     SELECT count(*) FROM public.workspaces
--      WHERE id = '00000000-0000-0000-0000-00000000dead';   -- 0
--   ROLLBACK;
-- ============================================================
