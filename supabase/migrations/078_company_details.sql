-- ============================================================
-- 078 — company details (one row per workspace).
--
-- The employee handbook is generated from these fields (director's
-- welcome, vision/mission, office timings, probation, leave quotas,
-- payroll dates…), so HR fills this in once before generating.
-- Other HR documents (offer letters, policies) can read from the
-- same row later.
--
-- Additive and idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_details (
  workspace_id        UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,

  legal_name          TEXT,
  brand_name          TEXT,
  director_name       TEXT,
  registered_address  TEXT,
  cin                 TEXT,
  website             TEXT,
  contact_email       TEXT,
  contact_phone       TEXT,

  welcome_message     TEXT,
  vision              TEXT,
  mission             TEXT,
  -- One value per line; the handbook renders them as a list.
  core_values         TEXT,

  office_start        TEXT NOT NULL DEFAULT '09:30',
  office_end          TEXT NOT NULL DEFAULT '18:30',
  working_days        TEXT NOT NULL DEFAULT 'Monday to Friday',
  lunch_minutes       INTEGER NOT NULL DEFAULT 45 CHECK (lunch_minutes >= 0),
  break_minutes       INTEGER NOT NULL DEFAULT 15 CHECK (break_minutes >= 0),

  probation_months    INTEGER NOT NULL DEFAULT 3 CHECK (probation_months >= 0),
  notice_period_days  INTEGER NOT NULL DEFAULT 30 CHECK (notice_period_days >= 0),

  payroll_cycle       TEXT NOT NULL DEFAULT 'Monthly',
  salary_day          INTEGER NOT NULL DEFAULT 7 CHECK (salary_day BETWEEN 1 AND 28),

  casual_leave_days   INTEGER NOT NULL DEFAULT 12 CHECK (casual_leave_days >= 0),
  sick_leave_days     INTEGER NOT NULL DEFAULT 6 CHECK (sick_leave_days >= 0),
  earned_leave_days   INTEGER NOT NULL DEFAULT 15 CHECK (earned_leave_days >= 0),

  -- POSH: ICC details once constituted; below 10 employees the
  -- district Local Committee handles complaints.
  posh_committee      TEXT,

  updated_by          UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.company_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_details_members ON public.company_details;
CREATE POLICY company_details_members ON public.company_details
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at ON public.company_details;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
