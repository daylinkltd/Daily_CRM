-- ============================================================================
-- BIDIRECTIONAL NDH SYNC - OUTBOUND SIDE (this CRM -> NDH)
-- ============================================================================
--
-- Generalizes the existing payroll-only push (banking.ts / banking_payroll_
-- pushes, migration 110) to the rest of Accounting/HR: employee profile
-- changes, attendance, leave, and expense-claim decisions.
--
-- banking_payroll_pushes itself is left untouched - the live payroll
-- integration keeps working exactly as it does today. This is a SIBLING
-- outbox table for everything else, same pattern (write the attempt before
-- sending, record the outcome after), so nothing about the proven payroll
-- path is touched by this migration.
--
-- Loop prevention: employee_profiles/attendance/leave_requests/
-- expense_claims each gain synced_from_ndh - a row NDH itself just wrote
-- (via this app's own generic /api/v1/[resource] API) is tagged, and the
-- trigger below skips enqueueing an outbound push for that same write. Without
-- this a bidirectional sync free-loops on its own writes.
-- ============================================================================

ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS synced_from_ndh BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS synced_from_ndh BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS synced_from_ndh BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS synced_from_ndh BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.hr_sync_pushes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_table TEXT NOT NULL,
    entity_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'duplicate', 'failed')),
    http_status INTEGER,
    last_error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_sync_pushes_workspace
    ON public.hr_sync_pushes (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hr_sync_pushes_retryable
    ON public.hr_sync_pushes (workspace_id, status)
    WHERE status IN ('pending', 'failed');

ALTER TABLE public.hr_sync_pushes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_sync_pushes_select ON public.hr_sync_pushes;
CREATE POLICY hr_sync_pushes_select ON public.hr_sync_pushes
    FOR SELECT
    USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS hr_sync_pushes_admin ON public.hr_sync_pushes;
CREATE POLICY hr_sync_pushes_admin ON public.hr_sync_pushes
    FOR ALL
    USING (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
    )
    WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
    );

DROP TRIGGER IF EXISTS set_updated_at ON public.hr_sync_pushes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hr_sync_pushes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Enqueue triggers.
--
-- These tables are written CLIENT-SIDE under RLS (no server route to hook a
-- synchronous push into - onboard-employee-form.tsx, punch-action.tsx and the
-- leave page all call Supabase directly), so the trigger is the only
-- reliable interception point regardless of which UI wrote the row.
--
-- ON CONFLICT (event_type, entity_id) DO UPDATE so a burst of edits to the
-- same row collapses into one still-pending push carrying the latest data,
-- rather than piling up one row per keystroke-adjacent save.
-- ----------------------------------------------------------------------------

-- employee_profiles itself has no name/email - those live on profiles,
-- joined through workspace_members - so the raw to_jsonb(NEW) alone is
-- missing the one field NDH's hr_employees actually requires (full_name
-- NOT NULL). Joined in here rather than left for the receiver to fetch
-- separately, since the receiver has no other path back to this
-- workspace's profiles table.
CREATE OR REPLACE FUNCTION public.enqueue_employee_profile_sync() RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
BEGIN
  IF NEW.synced_from_ndh THEN
    RETURN NEW;
  END IF;
  SELECT p.full_name, p.email INTO v_full_name, v_email
  FROM public.workspace_members wm
  JOIN public.profiles p ON p.user_id = wm.user_id
  WHERE wm.id = NEW.workspace_member_id;

  INSERT INTO public.hr_sync_pushes (workspace_id, event_type, entity_table, entity_id, payload)
  VALUES (
    NEW.workspace_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'employee.created' ELSE 'employee.updated' END,
    'employee_profiles',
    NEW.workspace_member_id,
    to_jsonb(NEW) || jsonb_build_object('full_name', v_full_name, 'email', v_email)
  )
  ON CONFLICT (event_type, entity_id) DO UPDATE
    SET payload = EXCLUDED.payload, status = 'pending', updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employee_profiles_sync ON public.employee_profiles;
CREATE TRIGGER employee_profiles_sync
  AFTER INSERT OR UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_employee_profile_sync();

CREATE OR REPLACE FUNCTION public.enqueue_attendance_sync() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.synced_from_ndh THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.hr_sync_pushes (workspace_id, event_type, entity_table, entity_id, payload)
  VALUES (NEW.workspace_id, 'attendance.punched', 'attendance', NEW.id, to_jsonb(NEW))
  ON CONFLICT (event_type, entity_id) DO UPDATE
    SET payload = EXCLUDED.payload, status = 'pending', updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_sync ON public.attendance;
CREATE TRIGGER attendance_sync
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_attendance_sync();

-- entity_id here is a SYNTHETIC key (the leave request id + its status),
-- not just the row id - "requested" and "approved" are two distinct events
-- for the same row, and the plain (event_type, entity_id) unique constraint
-- would otherwise let the approval overwrite the still-unsent request event.
CREATE OR REPLACE FUNCTION public.enqueue_leave_request_sync() RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  IF NEW.synced_from_ndh THEN
    RETURN NEW;
  END IF;
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'leave.requested'
    WHEN NEW.status = 'approved' THEN 'leave.approved'
    WHEN NEW.status = 'rejected' THEN 'leave.rejected'
    ELSE NULL
  END;
  IF v_event_type IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.hr_sync_pushes (workspace_id, event_type, entity_table, entity_id, payload)
  VALUES (NEW.workspace_id, v_event_type, 'leave_requests', NEW.id, to_jsonb(NEW))
  ON CONFLICT (event_type, entity_id) DO UPDATE
    SET payload = EXCLUDED.payload, status = 'pending', updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leave_requests_sync ON public.leave_requests;
CREATE TRIGGER leave_requests_sync
  AFTER INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_leave_request_sync();

-- expense_claims already has a server route for approve/reject/reimburse
-- (POST /api/expenses/[id]); this trigger only covers the CLIENT-DIRECT
-- creation (the initial 'pending' insert) - the route pushes the decision
-- events itself, synchronously, the same way payroll already does.
CREATE OR REPLACE FUNCTION public.enqueue_expense_claim_created_sync() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.synced_from_ndh THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.hr_sync_pushes (workspace_id, event_type, entity_table, entity_id, payload)
  VALUES (NEW.workspace_id, 'expense.created', 'expense_claims', NEW.id, to_jsonb(NEW))
  ON CONFLICT (event_type, entity_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expense_claims_created_sync ON public.expense_claims;
CREATE TRIGGER expense_claims_created_sync
  AFTER INSERT ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_expense_claim_created_sync();
