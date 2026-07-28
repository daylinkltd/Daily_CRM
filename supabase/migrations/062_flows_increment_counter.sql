-- ============================================================
-- 062_flows_increment_counter.sql
--
-- Atomic increment of flows.execution_count + refresh of
-- last_executed_at. Called via PostgREST RPC from the Flows
-- engine (src/lib/flows/engine.ts, startNewRun) — the engine has
-- called this RPC since it shipped, but the function was never
-- created, so every run start logged a non-fatal
-- "execution_count rpc error" and the builder UI's run counter
-- stayed at 0.
--
-- Mirrors increment_automation_execution_count (migration 007):
-- atomic UPDATE instead of read-modify-write so two concurrent
-- webhooks starting runs on the same flow can't lose a count.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_flow_execution_count(p_flow_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE flows
  SET
    execution_count = execution_count + 1,
    last_executed_at = NOW()
  WHERE id = p_flow_id;
$$;

-- Only the service role needs to call this (the engine uses the
-- service-role client). Explicitly lock anon / authenticated out so
-- an authenticated user can't juice someone else's counter via RPC.
REVOKE ALL ON FUNCTION increment_flow_execution_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_flow_execution_count(UUID) FROM anon;
REVOKE ALL ON FUNCTION increment_flow_execution_count(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_flow_execution_count(UUID) TO service_role;
