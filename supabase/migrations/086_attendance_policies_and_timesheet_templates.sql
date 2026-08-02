-- ============================================================
-- 086 — Attendance policy, geofencing, per-day overrides and
--       per-employee timesheet templates.
--
-- Context: no attendance row has ever recorded a location — the punch
-- flow swallowed every geolocation failure and stored NULL, and the map
-- modal displayed a hardcoded Bengaluru coordinate in its place, so a
-- punch from anywhere appeared to be from Bengaluru.
--
-- This adds the HR-controlled policy the punch flow enforces:
--   * which work locations an employee may choose (on-site only, WFH
--     allowed, etc.) — the punch UI offers exactly these and no more,
--   * whether GPS is required and how accurate it must be,
--   * a geofence (centre + radius) per policy,
--   * per-employee overrides and per-DAY exceptions ("WFH just today"),
--   * whether punching out requires a timesheet, and which template.
--
-- Resolution order, most specific first:
--   day override -> employee policy -> workspace default.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Work-location vocabulary shared by policy and attendance.
--    Matches the existing attendance.work_location values.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_work_location') THEN
    CREATE TYPE public.hr_work_location AS ENUM ('OFFICE', 'WFH', 'CLIENT_SITE', 'FIELD');
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Attendance policies.
--    scope_type WORKSPACE_DEFAULT has scope_id NULL; MEMBER scopes to
--    workspace_members.id. Keyed on workspace_members rather than
--    hr_employees because that is what attendance rows carry, and
--    hr_employees is an optional extension most workspaces have not
--    populated.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_attendance_policies (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

    scope_type TEXT NOT NULL DEFAULT 'WORKSPACE_DEFAULT'
               CHECK (scope_type IN ('WORKSPACE_DEFAULT', 'DEPARTMENT', 'MEMBER')),
    scope_id   UUID,

    name TEXT,

    -- Work location control. The punch UI renders exactly these options,
    -- so an on-site-only employee is never offered WFH.
    allowed_work_locations public.hr_work_location[] NOT NULL
                           DEFAULT ARRAY['OFFICE']::public.hr_work_location[],
    default_work_location  public.hr_work_location NOT NULL DEFAULT 'OFFICE',

    -- GPS enforcement. WFH punches skip location entirely (see
    -- require_location_for below) — there is no office to be near.
    require_location      BOOLEAN NOT NULL DEFAULT true,
    require_location_for  public.hr_work_location[] NOT NULL
                          DEFAULT ARRAY['OFFICE', 'CLIENT_SITE', 'FIELD']::public.hr_work_location[],
    -- Reject a fix coarser than this; the wifi/IP fix that caused the
    -- original bug reports accuracy in the thousands of metres.
    min_gps_accuracy_m    INTEGER NOT NULL DEFAULT 100 CHECK (min_gps_accuracy_m > 0),

    -- Geofence. NULL centre means "record location but do not enforce".
    geofence_latitude   DOUBLE PRECISION,
    geofence_longitude  DOUBLE PRECISION,
    geofence_radius_m   INTEGER NOT NULL DEFAULT 100 CHECK (geofence_radius_m > 0),
    geofence_label      TEXT,
    -- When false an out-of-fence punch is recorded and flagged for HR
    -- rather than blocked, which is what most teams actually want.
    block_outside_geofence BOOLEAN NOT NULL DEFAULT false,

    -- Punch-out flow.
    require_timesheet_on_punch_out BOOLEAN NOT NULL DEFAULT false,
    timesheet_template_id          UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (default_work_location = ANY (allowed_work_locations)),
    CHECK (
        (scope_type = 'WORKSPACE_DEFAULT' AND scope_id IS NULL)
        OR (scope_type <> 'WORKSPACE_DEFAULT' AND scope_id IS NOT NULL)
    )
);

-- One policy per scope. Two partial indexes because NULL scope_id never
-- conflicts in a plain UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_policy_workspace_default
    ON public.hr_attendance_policies (workspace_id)
    WHERE scope_type = 'WORKSPACE_DEFAULT';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_policy_scoped
    ON public.hr_attendance_policies (workspace_id, scope_type, scope_id)
    WHERE scope_type <> 'WORKSPACE_DEFAULT';

CREATE INDEX IF NOT EXISTS idx_attendance_policies_workspace
    ON public.hr_attendance_policies (workspace_id);

ALTER TABLE public.hr_attendance_policies ENABLE ROW LEVEL SECURITY;

-- Members read (the punch UI needs their own policy); only HR writes.
DROP POLICY IF EXISTS hr_attendance_policies_select ON public.hr_attendance_policies;
CREATE POLICY hr_attendance_policies_select ON public.hr_attendance_policies
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS hr_attendance_policies_manage ON public.hr_attendance_policies;
CREATE POLICY hr_attendance_policies_manage ON public.hr_attendance_policies
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    )
    WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

DROP TRIGGER IF EXISTS set_updated_at ON public.hr_attendance_policies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hr_attendance_policies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3. Per-day exceptions. "Ravi works from home on Thursday", or
--    "the team punches in at the client site today, 500m radius".
--    Every column is nullable: NULL means "inherit from the policy".
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_attendance_day_overrides (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    override_date       DATE NOT NULL,

    allowed_work_locations public.hr_work_location[],
    require_location       BOOLEAN,
    min_gps_accuracy_m     INTEGER CHECK (min_gps_accuracy_m IS NULL OR min_gps_accuracy_m > 0),

    geofence_latitude      DOUBLE PRECISION,
    geofence_longitude     DOUBLE PRECISION,
    geofence_radius_m      INTEGER CHECK (geofence_radius_m IS NULL OR geofence_radius_m > 0),
    geofence_label         TEXT,
    block_outside_geofence BOOLEAN,

    require_timesheet_on_punch_out BOOLEAN,
    timesheet_template_id          UUID,

    note       TEXT,
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workspace_member_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_day_overrides_lookup
    ON public.hr_attendance_day_overrides (workspace_id, override_date);

ALTER TABLE public.hr_attendance_day_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_attendance_day_overrides_select ON public.hr_attendance_day_overrides;
CREATE POLICY hr_attendance_day_overrides_select ON public.hr_attendance_day_overrides
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS hr_attendance_day_overrides_manage ON public.hr_attendance_day_overrides;
CREATE POLICY hr_attendance_day_overrides_manage ON public.hr_attendance_day_overrides
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    )
    WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

DROP TRIGGER IF EXISTS set_updated_at ON public.hr_attendance_day_overrides;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hr_attendance_day_overrides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 4. Timesheet templates. Which questions a given employee answers at
--    punch-out: a developer gets project + ticket fields, a salesperson
--    gets CRM contacts and deals. `fields_json` is an ordered array of
--    field descriptors; `role_preset` marks the ready-made library rows.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_timesheet_templates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL workspace_id = built-in library template, readable by everyone
    -- and writable by no one from the client.
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

    name        TEXT NOT NULL,
    description TEXT,
    role_preset TEXT,
    icon        TEXT DEFAULT 'ClipboardList',

    fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,

    is_system  BOOLEAN NOT NULL DEFAULT false,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CHECK (jsonb_typeof(fields_json) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_timesheet_templates_workspace
    ON public.hr_timesheet_templates (workspace_id);

ALTER TABLE public.hr_timesheet_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_timesheet_templates_select ON public.hr_timesheet_templates;
CREATE POLICY hr_timesheet_templates_select ON public.hr_timesheet_templates
    FOR SELECT USING (
        workspace_id IS NULL
        OR public.is_active_workspace_member(workspace_id, auth.uid())
    );

-- Library rows (workspace_id IS NULL) are deliberately not writable here.
DROP POLICY IF EXISTS hr_timesheet_templates_manage ON public.hr_timesheet_templates;
CREATE POLICY hr_timesheet_templates_manage ON public.hr_timesheet_templates
    FOR ALL USING (
        workspace_id IS NOT NULL
        AND public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    )
    WITH CHECK (
        workspace_id IS NOT NULL
        AND public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

DROP TRIGGER IF EXISTS set_updated_at ON public.hr_timesheet_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hr_timesheet_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Deferred FKs: the policy tables are created before the template table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hr_attendance_policies_timesheet_template_fk'
  ) THEN
    ALTER TABLE public.hr_attendance_policies
      ADD CONSTRAINT hr_attendance_policies_timesheet_template_fk
      FOREIGN KEY (timesheet_template_id)
      REFERENCES public.hr_timesheet_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hr_attendance_day_overrides_timesheet_template_fk'
  ) THEN
    ALTER TABLE public.hr_attendance_day_overrides
      ADD CONSTRAINT hr_attendance_day_overrides_timesheet_template_fk
      FOREIGN KEY (timesheet_template_id)
      REFERENCES public.hr_timesheet_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Record what the punch flow actually observed, so HR can audit a
--    location instead of trusting a coordinate with no provenance.
-- ------------------------------------------------------------
ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS punch_in_accuracy_m      DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS punch_out_accuracy_m     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS punch_in_distance_m      DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS punch_out_distance_m     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS punch_in_geofence_status TEXT,
    ADD COLUMN IF NOT EXISTS punch_out_geofence_status TEXT,
    ADD COLUMN IF NOT EXISTS location_exempt_reason   TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punch_in_geofence_status_check') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_punch_in_geofence_status_check
      CHECK (punch_in_geofence_status IS NULL OR punch_in_geofence_status IN
             ('INSIDE', 'OUTSIDE', 'INCONCLUSIVE', 'NOT_ENFORCED', 'EXEMPT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punch_out_geofence_status_check') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_punch_out_geofence_status_check
      CHECK (punch_out_geofence_status IS NULL OR punch_out_geofence_status IN
             ('INSIDE', 'OUTSIDE', 'INCONCLUSIVE', 'NOT_ENFORCED', 'EXEMPT'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. Resolve the effective policy for one employee on one date.
--    SECURITY DEFINER so the punch UI gets a single authoritative
--    answer; it still checks membership itself.
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

    -- Department comes from the optional hr_employees extension row; most
    -- workspaces have none, in which case DEPARTMENT scope simply never matches.
    SELECT department_id INTO v_dept_id
    FROM public.hr_employees
    WHERE workspace_member_id = p_workspace_member_id AND workspace_id = p_workspace_id;

    -- Most specific policy wins: member, then department, then default.
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

    -- No policy configured at all: permissive default that still records
    -- location, so behaviour is unchanged until HR opts in.
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

GRANT EXECUTE ON FUNCTION public.resolve_attendance_policy(UUID, UUID, DATE) TO authenticated;

-- Drop the earlier signature if a draft of this migration created one.
DROP FUNCTION IF EXISTS public.resolve_attendance_policy(UUID, UUID, DATE, TEXT);

-- ------------------------------------------------------------
-- 7. Built-in timesheet template library (workspace_id IS NULL).
--    Stable UUIDs so re-running is a no-op and workspaces can reference
--    them directly.
-- ------------------------------------------------------------
INSERT INTO public.hr_timesheet_templates (id, workspace_id, name, description, role_preset, icon, is_system, fields_json)
VALUES
  ('a1000000-0000-4000-8000-000000000001', NULL, 'Software Developer', 'Project, ticket and build activity for engineering roles.', 'DEVELOPER', 'Code2', true,
   '[{"key":"project_id","label":"Project","type":"reference","source":"projects","required":true},
     {"key":"ticket_ids","label":"Tasks / Tickets worked on","type":"reference_multi","source":"tasks","required":true},
     {"key":"hours","label":"Hours spent","type":"number","required":true,"min":0,"max":24},
     {"key":"work_done","label":"What did you build or fix?","type":"textarea","required":true},
     {"key":"blockers","label":"Blockers","type":"textarea","required":false}]'::jsonb),

  ('a1000000-0000-4000-8000-000000000002', NULL, 'Sales Executive', 'CRM contacts, deals and follow-ups for sales roles.', 'SALES', 'PhoneCall', true,
   '[{"key":"contact_ids","label":"Contacts engaged","type":"reference_multi","source":"contacts","required":true},
     {"key":"deal_ids","label":"Deals progressed","type":"reference_multi","source":"pipelines","required":false},
     {"key":"calls_made","label":"Calls made","type":"number","required":true,"min":0},
     {"key":"meetings_held","label":"Meetings held","type":"number","required":false,"min":0},
     {"key":"work_done","label":"Summary of the day","type":"textarea","required":true},
     {"key":"next_steps","label":"Next steps","type":"textarea","required":false}]'::jsonb),

  ('a1000000-0000-4000-8000-000000000003', NULL, 'Support / Helpdesk', 'Ticket queue and resolution activity for support roles.', 'SUPPORT', 'LifeBuoy', true,
   '[{"key":"ticket_ids","label":"Tasks / Tickets handled","type":"reference_multi","source":"tasks","required":true},
     {"key":"tickets_resolved","label":"Tickets resolved","type":"number","required":true,"min":0},
     {"key":"first_response_breaches","label":"SLA breaches","type":"number","required":false,"min":0},
     {"key":"work_done","label":"Summary","type":"textarea","required":true}]'::jsonb),

  ('a1000000-0000-4000-8000-000000000004', NULL, 'Field Executive', 'Site visits and travel for field roles.', 'FIELD', 'MapPin', true,
   '[{"key":"visits","label":"Sites / clients visited","type":"textarea","required":true},
     {"key":"contact_ids","label":"Contacts met","type":"reference_multi","source":"contacts","required":false},
     {"key":"distance_km","label":"Distance travelled (km)","type":"number","required":false,"min":0},
     {"key":"work_done","label":"Outcome of visits","type":"textarea","required":true}]'::jsonb),

  ('a1000000-0000-4000-8000-000000000005', NULL, 'Retail / Store Staff', 'Counter sales and stock activity for retail roles.', 'RETAIL', 'Store', true,
   '[{"key":"orders_handled","label":"Orders handled","type":"number","required":true,"min":0},
     {"key":"stock_tasks","label":"Stock / inventory tasks","type":"textarea","required":false},
     {"key":"work_done","label":"Summary of the shift","type":"textarea","required":true}]'::jsonb),

  ('a1000000-0000-4000-8000-000000000006', NULL, 'Simple Daily Summary', 'One free-text summary. The lightest possible timesheet.', 'GENERAL', 'ClipboardList', true,
   '[{"key":"work_done","label":"What did you work on today?","type":"textarea","required":true},
     {"key":"hours","label":"Hours worked","type":"number","required":false,"min":0,"max":24}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
