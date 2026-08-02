-- ============================================================
-- 089 — Salary structures with a configurable breakdown, plus a fix to
--       the attendance policy resolver from 086.
--
-- PART 1 — BUG FIX. resolve_attendance_policy() reads the employee's
-- department from `hr_employees`. That table is dormant: it has zero
-- rows in production and no application code reads or writes it. The
-- live employee table is `employee_profiles`, keyed by
-- workspace_member_id (see the header of migration 077). As shipped,
-- DEPARTMENT-scoped attendance policies silently never matched anyone.
--
-- PART 2 — SALARY STRUCTURES. Compensation today is six flat NUMERIC
-- columns on employee_profiles (basic_salary, hra, special_allowance,
-- pf_deduction, professional_tax, tds_deduction) — no reusable slabs,
-- no percentage-of-basic derivation, no custom allowances, and no
-- history.
--
-- The tables from migration 052 (hr_salary_components,
-- hr_salary_structures, hr_salary_structure_components) were created
-- but never used by any code. Rather than add a fourth parallel model,
-- this migration extends them into a working one.
--
-- Model: a structure is a named slab ("Grade A", "Field Staff"). It
-- owns ordered components, each an EARNING or a DEDUCTION computed
-- either as a percentage of basic or as a fixed amount. Assigning a
-- structure plus a basic salary to an employee derives the whole
-- breakdown, so an allowance change is made once, not per person.
--
-- The six flat columns stay authoritative for payroll runs: the
-- processor and the ledger posting rule read them directly. A structure
-- computes values INTO those columns, so nothing downstream changes.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- PART 1 — point the resolver at the live employee table.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_attendance_policy(
    p_workspace_id        UUID,
    p_workspace_member_id UUID,
    p_date                DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_policy   public.hr_attendance_policies%ROWTYPE;
    v_override public.hr_attendance_day_overrides%ROWTYPE;
    v_dept_id  UUID;
BEGIN
    IF NOT public.is_active_workspace_member(p_workspace_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not a member of this workspace.';
    END IF;

    -- employee_profiles, not hr_employees: the latter is dormant and
    -- empty, which made DEPARTMENT scope dead code.
    SELECT department_id INTO v_dept_id
    FROM public.employee_profiles
    WHERE workspace_member_id = p_workspace_member_id
      AND workspace_id = p_workspace_id;

    SELECT * INTO v_policy FROM public.hr_attendance_policies
    WHERE workspace_id = p_workspace_id AND scope_type = 'MEMBER' AND scope_id = p_workspace_member_id;

    IF NOT FOUND AND v_dept_id IS NOT NULL THEN
        SELECT * INTO v_policy FROM public.hr_attendance_policies
        WHERE workspace_id = p_workspace_id AND scope_type = 'DEPARTMENT' AND scope_id = v_dept_id;
    END IF;

    IF NOT FOUND THEN
        SELECT * INTO v_policy FROM public.hr_attendance_policies
        WHERE workspace_id = p_workspace_id AND scope_type = 'WORKSPACE_DEFAULT';
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'source', 'implicit_default',
            'allowed_work_locations', jsonb_build_array('OFFICE', 'WFH', 'CLIENT_SITE'),
            'default_work_location', 'OFFICE',
            'require_location', true,
            'require_location_for', jsonb_build_array('OFFICE', 'CLIENT_SITE', 'FIELD'),
            'min_gps_accuracy_m', 100,
            'geofence', NULL,
            'block_outside_geofence', false,
            'require_timesheet_on_punch_out', false,
            'timesheet_template_id', NULL
        );
    END IF;

    SELECT * INTO v_override FROM public.hr_attendance_day_overrides
    WHERE workspace_member_id = p_workspace_member_id AND override_date = p_date;

    RETURN jsonb_build_object(
        'source', CASE WHEN v_override.id IS NOT NULL THEN 'day_override' ELSE v_policy.scope_type END,
        'policy_id', v_policy.id,
        'override_id', v_override.id,
        'allowed_work_locations',
            to_jsonb(COALESCE(v_override.allowed_work_locations, v_policy.allowed_work_locations)),
        'default_work_location', v_policy.default_work_location,
        'require_location', COALESCE(v_override.require_location, v_policy.require_location),
        'require_location_for', to_jsonb(v_policy.require_location_for),
        'min_gps_accuracy_m', COALESCE(v_override.min_gps_accuracy_m, v_policy.min_gps_accuracy_m),
        'geofence',
            CASE
              WHEN COALESCE(v_override.geofence_latitude, v_policy.geofence_latitude) IS NULL THEN NULL
              ELSE jsonb_build_object(
                'latitude',  COALESCE(v_override.geofence_latitude,  v_policy.geofence_latitude),
                'longitude', COALESCE(v_override.geofence_longitude, v_policy.geofence_longitude),
                'radius_m',  COALESCE(v_override.geofence_radius_m,  v_policy.geofence_radius_m),
                'label',     COALESCE(v_override.geofence_label,     v_policy.geofence_label)
              )
            END,
        'block_outside_geofence',
            COALESCE(v_override.block_outside_geofence, v_policy.block_outside_geofence),
        'require_timesheet_on_punch_out',
            COALESCE(v_override.require_timesheet_on_punch_out, v_policy.require_timesheet_on_punch_out),
        'timesheet_template_id',
            COALESCE(v_override.timesheet_template_id, v_policy.timesheet_template_id),
        'override_note', v_override.note
    );
END;
$$;

-- ------------------------------------------------------------
-- PART 2a — components: the individual heads of pay.
-- ------------------------------------------------------------
ALTER TABLE public.hr_salary_components
    ADD COLUMN IF NOT EXISTS code         TEXT,
    ADD COLUMN IF NOT EXISTS description  TEXT,
    -- Statutory heads (PF, ESI, professional tax, TDS) are governed by
    -- law rather than by the employer, so the UI treats them separately.
    ADD COLUMN IF NOT EXISTS is_statutory BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_taxable   BOOLEAN NOT NULL DEFAULT true,
    -- Maps this component onto one of the six flat payroll columns, so a
    -- structure can drive the existing payroll processor unchanged.
    -- NULL means the component is informational only.
    ADD COLUMN IF NOT EXISTS payroll_field TEXT,
    ADD COLUMN IF NOT EXISTS sort_order   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_salary_components_payroll_field_check') THEN
    ALTER TABLE public.hr_salary_components
      ADD CONSTRAINT hr_salary_components_payroll_field_check
      CHECK (payroll_field IS NULL OR payroll_field IN
        ('basic_salary', 'hra', 'special_allowance',
         'pf_deduction', 'professional_tax', 'tds_deduction'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_salary_component_code
    ON public.hr_salary_components (workspace_id, lower(code))
    WHERE code IS NOT NULL AND deleted_at IS NULL;

-- ------------------------------------------------------------
-- PART 2b — structures: named, reusable slabs.
-- ------------------------------------------------------------
ALTER TABLE public.hr_salary_structures
    ADD COLUMN IF NOT EXISTS code       TEXT,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true,
    -- Percentage of gross that must be basic. Many jurisdictions set a
    -- floor to stop employers shrinking basic to cut statutory dues.
    ADD COLUMN IF NOT EXISTS min_basic_percent NUMERIC NOT NULL DEFAULT 0
        CHECK (min_basic_percent >= 0 AND min_basic_percent <= 100),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_salary_structure_name
    ON public.hr_salary_structures (workspace_id, lower(name))
    WHERE deleted_at IS NULL;

-- Only one default structure per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_salary_structure_default
    ON public.hr_salary_structures (workspace_id)
    WHERE is_default AND deleted_at IS NULL;

-- ------------------------------------------------------------
-- PART 2c — the join carries the value, so the same component can sit
--           in two structures at different rates.
-- ------------------------------------------------------------
ALTER TABLE public.hr_salary_structure_components
    ADD COLUMN IF NOT EXISTS value_override   NUMERIC,
    ADD COLUMN IF NOT EXISTS calculation_type TEXT,
    ADD COLUMN IF NOT EXISTS sort_order       INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_structure_components_calc_check') THEN
    ALTER TABLE public.hr_salary_structure_components
      ADD CONSTRAINT hr_structure_components_calc_check
      CHECK (calculation_type IS NULL OR calculation_type IN ('PERCENTAGE_OF_BASIC', 'FIXED_AMOUNT'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- PART 2d — link employees to a structure. employee_profiles is the
--           live table; hr_employees.salary_structure_id is a bare UUID
--           with no FK on a table nothing writes, so it is left alone.
-- ------------------------------------------------------------
ALTER TABLE public.employee_profiles
    ADD COLUMN IF NOT EXISTS salary_structure_id UUID
        REFERENCES public.hr_salary_structures(id) ON DELETE SET NULL,
    -- Annual cost to company. The six flat columns remain the monthly
    -- figures payroll actually uses; this is the headline number.
    ADD COLUMN IF NOT EXISTS ctc_annual NUMERIC NOT NULL DEFAULT 0
        CHECK (ctc_annual >= 0),
    ADD COLUMN IF NOT EXISTS salary_effective_from DATE;

CREATE INDEX IF NOT EXISTS idx_employee_profiles_structure
    ON public.employee_profiles (salary_structure_id);

-- ------------------------------------------------------------
-- PART 2e — RLS. 079 repaired policies for these tables; re-assert them
--           so a workspace with none is not left wide open or empty.
-- ------------------------------------------------------------
ALTER TABLE public.hr_salary_components            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_structures            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_structure_components  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_salary_components_select ON public.hr_salary_components;
CREATE POLICY hr_salary_components_select ON public.hr_salary_components
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS hr_salary_components_manage ON public.hr_salary_components;
CREATE POLICY hr_salary_components_manage ON public.hr_salary_components
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    )
    WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

DROP POLICY IF EXISTS hr_salary_structures_select ON public.hr_salary_structures;
CREATE POLICY hr_salary_structures_select ON public.hr_salary_structures
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS hr_salary_structures_manage ON public.hr_salary_structures;
CREATE POLICY hr_salary_structures_manage ON public.hr_salary_structures
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    )
    WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

-- The join table has no workspace_id of its own; it inherits through
-- its parent structure.
DROP POLICY IF EXISTS hr_structure_components_select ON public.hr_salary_structure_components;
CREATE POLICY hr_structure_components_select ON public.hr_salary_structure_components
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.hr_salary_structures s
        WHERE s.id = structure_id
          AND public.is_active_workspace_member(s.workspace_id, auth.uid())
    ));

DROP POLICY IF EXISTS hr_structure_components_manage ON public.hr_salary_structure_components;
CREATE POLICY hr_structure_components_manage ON public.hr_salary_structure_components
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.hr_salary_structures s
        WHERE s.id = structure_id
          AND public.is_active_workspace_member(s.workspace_id, auth.uid())
          AND public.has_workspace_permission(s.workspace_id, auth.uid(), 'people_manage'::text)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.hr_salary_structures s
        WHERE s.id = structure_id
          AND public.is_active_workspace_member(s.workspace_id, auth.uid())
          AND public.has_workspace_permission(s.workspace_id, auth.uid(), 'people_manage'::text)
    ));

-- ------------------------------------------------------------
-- PART 2f — salary revision history, so a change is auditable.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_salary_revisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    structure_id        UUID REFERENCES public.hr_salary_structures(id) ON DELETE SET NULL,
    ctc_annual          NUMERIC NOT NULL DEFAULT 0,
    breakdown_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason              TEXT,
    created_by          UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_revisions_member
    ON public.hr_salary_revisions (workspace_member_id, effective_from DESC);

ALTER TABLE public.hr_salary_revisions ENABLE ROW LEVEL SECURITY;

-- Pay is sensitive: only people who can manage people may read the
-- history, unlike most tables where any member can read.
DROP POLICY IF EXISTS hr_salary_revisions_select ON public.hr_salary_revisions;
CREATE POLICY hr_salary_revisions_select ON public.hr_salary_revisions
    FOR SELECT USING (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

DROP POLICY IF EXISTS hr_salary_revisions_insert ON public.hr_salary_revisions;
CREATE POLICY hr_salary_revisions_insert ON public.hr_salary_revisions
    FOR INSERT WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

-- ------------------------------------------------------------
-- PART 2g — seed a starter set of components per workspace that has
--           none. Percentages reflect common Indian practice and are
--           fully editable; nothing here is enforced.
-- ------------------------------------------------------------
INSERT INTO public.hr_salary_components
    (workspace_id, name, code, type, calculation_type, value_number,
     is_statutory, is_taxable, payroll_field, sort_order, description)
SELECT w.id, c.name, c.code, c.type, c.calc, c.value,
       c.statutory, c.taxable, c.field, c.sort, c.description
FROM public.workspaces w
CROSS JOIN (VALUES
    ('Basic Salary',        'BASIC',   'EARNING',   'PERCENTAGE_OF_BASIC', 100, false, true,  'basic_salary',      10, 'The base on which most other heads are calculated.'),
    ('House Rent Allowance','HRA',     'EARNING',   'PERCENTAGE_OF_BASIC', 40,  false, true,  'hra',               20, 'Commonly 40-50% of basic.'),
    ('Conveyance Allowance','CONV',    'EARNING',   'FIXED_AMOUNT',        1600, false, true, 'special_allowance', 30, 'Fixed travel allowance.'),
    ('Medical Allowance',   'MED',     'EARNING',   'FIXED_AMOUNT',        1250, false, true, 'special_allowance', 40, 'Fixed medical allowance.'),
    ('Special Allowance',   'SPL',     'EARNING',   'PERCENTAGE_OF_BASIC', 20,  false, true,  'special_allowance', 50, 'Balancing head to reach the agreed gross.'),
    ('Provident Fund',      'PF',      'DEDUCTION', 'PERCENTAGE_OF_BASIC', 12,  true,  false, 'pf_deduction',      60, 'Employee contribution, usually 12% of basic.'),
    ('Professional Tax',    'PT',      'DEDUCTION', 'FIXED_AMOUNT',        200, true,  false, 'professional_tax',  70, 'State levy; varies by state and slab.'),
    ('Income Tax (TDS)',    'TDS',     'DEDUCTION', 'FIXED_AMOUNT',        0,   true,  false, 'tds_deduction',     80, 'Set per employee from their declaration.')
) AS c(name, code, type, calc, value, statutory, taxable, field, sort, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.hr_salary_components x WHERE x.workspace_id = w.id
);
