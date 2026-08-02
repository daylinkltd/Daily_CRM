-- ============================================================
-- 090 — Shared work locations registry.
--
-- Geofences were configured by pasting coordinates into whichever
-- policy needed them, so the head office was re-entered for every
-- department and every per-person exception. Move the office once and
-- every copy is stale.
--
-- A work location is now a named place owned by the workspace — an
-- office, a client site, a warehouse — with its own centre and default
-- radius. Attendance policies and day exceptions point at one instead
-- of carrying their own coordinates.
--
-- The existing geofence_* columns on hr_attendance_policies and
-- hr_attendance_day_overrides are kept: a policy may still pin an
-- ad-hoc point without registering it. location_id takes precedence
-- when set, so the registry is the single source of truth for anything
-- reused.
--
-- Idempotent; safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.work_locations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'OFFICE'
         CHECK (type IN ('OFFICE', 'CLIENT_SITE', 'WAREHOUSE', 'BRANCH', 'OTHER')),

    address TEXT,
    -- Client sites belong to a CRM contact, so the location list can be
    -- filtered to "sites for this customer".
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

    latitude  DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    -- Default fence size; a policy may override it.
    radius_m  INTEGER NOT NULL DEFAULT 100 CHECK (radius_m > 0),

    -- Exactly one location per workspace can be the default, used to
    -- prefill new policies.
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    notes      TEXT,

    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- A location without coordinates cannot be geofenced; allow it to
    -- exist as an address-only record but never half a coordinate pair.
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_work_locations_workspace
    ON public.work_locations (workspace_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_work_location_name
    ON public.work_locations (workspace_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_work_location_default
    ON public.work_locations (workspace_id)
    WHERE is_default AND deleted_at IS NULL;

ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;

-- Members read: the punch screen names the place they are standing in.
DROP POLICY IF EXISTS work_locations_select ON public.work_locations;
CREATE POLICY work_locations_select ON public.work_locations
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS work_locations_manage ON public.work_locations;
CREATE POLICY work_locations_manage ON public.work_locations
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    )
    WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

DROP TRIGGER IF EXISTS set_updated_at ON public.work_locations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- Point policies and day exceptions at the registry.
-- ------------------------------------------------------------
ALTER TABLE public.hr_attendance_policies
    ADD COLUMN IF NOT EXISTS location_id UUID
        REFERENCES public.work_locations(id) ON DELETE SET NULL;

ALTER TABLE public.hr_attendance_day_overrides
    ADD COLUMN IF NOT EXISTS location_id UUID
        REFERENCES public.work_locations(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Resolver: a referenced location wins over inline coordinates, and a
-- day exception's location wins over the policy's.
--
-- Also still reading employee_profiles for the department (fixed in
-- 089 — hr_employees is dormant and empty).
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
    v_loc      public.work_locations%ROWTYPE;
    v_dept_id  UUID;
    v_geofence JSONB;
BEGIN
    IF NOT public.is_active_workspace_member(p_workspace_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not a member of this workspace.';
    END IF;

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

    -- Most specific location wins: day exception, then policy, then the
    -- inline coordinates either of them may carry.
    SELECT * INTO v_loc FROM public.work_locations
    WHERE id = COALESCE(v_override.location_id, v_policy.location_id)
      AND deleted_at IS NULL;

    IF FOUND AND v_loc.latitude IS NOT NULL THEN
        v_geofence := jsonb_build_object(
            'latitude',  v_loc.latitude,
            'longitude', v_loc.longitude,
            'radius_m',  COALESCE(v_override.geofence_radius_m, v_policy.geofence_radius_m, v_loc.radius_m),
            'label',     v_loc.name,
            'location_id', v_loc.id
        );
    ELSIF COALESCE(v_override.geofence_latitude, v_policy.geofence_latitude) IS NOT NULL THEN
        v_geofence := jsonb_build_object(
            'latitude',  COALESCE(v_override.geofence_latitude,  v_policy.geofence_latitude),
            'longitude', COALESCE(v_override.geofence_longitude, v_policy.geofence_longitude),
            'radius_m',  COALESCE(v_override.geofence_radius_m,  v_policy.geofence_radius_m),
            'label',     COALESCE(v_override.geofence_label,     v_policy.geofence_label),
            'location_id', NULL
        );
    ELSE
        v_geofence := NULL;
    END IF;

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
        'geofence', v_geofence,
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
-- Adopt any geofence a workspace already configured on its default
-- policy as a registered location, so the registry starts populated
-- rather than empty next to a policy that still works.
-- ------------------------------------------------------------
INSERT INTO public.work_locations (workspace_id, name, type, latitude, longitude, radius_m, is_default)
SELECT p.workspace_id,
       COALESCE(NULLIF(p.geofence_label, ''), 'Head Office'),
       'OFFICE',
       p.geofence_latitude,
       p.geofence_longitude,
       p.geofence_radius_m,
       true
FROM public.hr_attendance_policies p
WHERE p.scope_type = 'WORKSPACE_DEFAULT'
  AND p.geofence_latitude IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.work_locations w
      WHERE w.workspace_id = p.workspace_id AND w.deleted_at IS NULL
  );

UPDATE public.hr_attendance_policies p
SET location_id = w.id
FROM public.work_locations w
WHERE w.workspace_id = p.workspace_id
  AND w.is_default
  AND w.deleted_at IS NULL
  AND p.scope_type = 'WORKSPACE_DEFAULT'
  AND p.location_id IS NULL
  AND p.geofence_latitude IS NOT NULL;
