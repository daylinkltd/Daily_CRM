-- supabase/migrations/056_enterprise_attendance_and_breaks.sql
-- ===========================================================================
-- Enterprise HRMS Attendance, Breaks, Overtime & Regularization Schema
-- ===========================================================================

-- 1. Extend Core Attendance Table
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS work_location TEXT DEFAULT 'OFFICE' CHECK (work_location IN ('OFFICE', 'WFH', 'CLIENT_SITE', 'FIELD_WORK')),
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS device_info TEXT,
  ADD COLUMN IF NOT EXISTS shift_id UUID,
  ADD COLUMN IF NOT EXISTS half_day_type TEXT CHECK (half_day_type IN ('FIRST_HALF', 'SECOND_HALF')),
  ADD COLUMN IF NOT EXISTS break_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_productive_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_exit_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

-- 2. Break Logs Table (Multiple Breaks per Day)
CREATE TABLE IF NOT EXISTS public.hr_attendance_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    break_type TEXT NOT NULL DEFAULT 'LUNCH' CHECK (break_type IN ('LUNCH', 'TEA', 'PERSONAL', 'MEETING', 'OFFICIAL')),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_minutes NUMERIC DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_breaks_attendance ON public.hr_attendance_breaks(attendance_id);

CREATE POLICY "Active members can manage hr_attendance_breaks" ON public.hr_attendance_breaks
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.hr_attendance_breaks ENABLE ROW LEVEL SECURITY;

-- 3. Regularization & Correction Requests Table
CREATE TABLE IF NOT EXISTS public.hr_attendance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('MISSED_PUNCH', 'CORRECTION', 'HALF_DAY', 'EARLY_EXIT', 'OVERTIME', 'WFH', 'ON_DUTY')),
    attendance_date DATE NOT NULL,
    requested_punch_in TIMESTAMPTZ,
    requested_punch_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    approval_comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_requests_workspace ON public.hr_attendance_requests(workspace_id, status);

CREATE POLICY "Active members can manage hr_attendance_requests" ON public.hr_attendance_requests
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.hr_attendance_requests ENABLE ROW LEVEL SECURITY;
