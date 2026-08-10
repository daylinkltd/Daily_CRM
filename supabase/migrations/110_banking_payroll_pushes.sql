-- ============================================================
-- 110 — banking payroll pushes.
--
-- WHY. Payroll is calculated here, but the salary expense belongs in
-- the customer's core banking / accounting system (NDH), where the
-- statutory books live. When a cycle is processed or paid we push the
-- cycle TOTALS — never per-employee salary detail — to that system,
-- which turns them into a journal voucher.
--
-- The push must never be able to fail payroll: if the remote system is
-- unreachable, the cycle still processes here and the attempt is left
-- retryable. This table is that outbox — one row per (cycle, stage),
-- so an operator can see exactly which cycle reached the books and
-- retry the ones that did not.
--
-- Credentials are NOT here. They live in workspace_integrations with
-- provider = 'banking', secret encrypted by the application, matching
-- the Outlook/WhatsApp pattern.
--
-- Idempotent.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.banking_payroll_pushes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payroll_cycle_id UUID NOT NULL REFERENCES public.payroll_cycles(id) ON DELETE CASCADE,
  /** Which half of the payroll posting: the accrual or the payout. */
  stage            TEXT NOT NULL CHECK (stage IN ('processed', 'paid')),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'duplicate', 'failed')),
  /** Voucher number reported by the banking system on success. */
  voucher_no       TEXT,
  http_status      INTEGER,
  last_error       TEXT,
  attempts         INTEGER NOT NULL DEFAULT 0,
  /** Totals as sent, so a dispute can be settled without re-deriving them. */
  payload          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per cycle+stage: retries update in place rather than piling up.
  UNIQUE (payroll_cycle_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_banking_pushes_workspace
  ON public.banking_payroll_pushes (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_banking_pushes_retryable
  ON public.banking_payroll_pushes (workspace_id, status)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.banking_payroll_pushes ENABLE ROW LEVEL SECURITY;

-- Members may see whether payroll reached the books; only those who can
-- manage integrations may create or retry a push, since it writes into
-- the customer's statutory ledger.
DROP POLICY IF EXISTS banking_pushes_select ON public.banking_payroll_pushes;
CREATE POLICY banking_pushes_select ON public.banking_payroll_pushes
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS banking_pushes_admin ON public.banking_payroll_pushes;
CREATE POLICY banking_pushes_admin ON public.banking_payroll_pushes
  FOR ALL
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  )
  WITH CHECK (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  );

DROP TRIGGER IF EXISTS set_updated_at ON public.banking_payroll_pushes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.banking_payroll_pushes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
