-- ============================================================
-- 091 — Attendance opt-in per employee.
--
-- The punch controls render in the global header for everyone with HR
-- module access, so a director, a contractor or a client-facing user who
-- never clocks in still sees "Punch In". There was no per-person switch
-- for it — the attendance policy from 086 controls HOW someone punches,
-- not WHETHER they punch at all.
--
-- Default TRUE so behaviour is unchanged for existing staff; HR turns it
-- off for the people it does not apply to.
--
-- Idempotent; safe to re-run.
-- ============================================================

ALTER TABLE public.employee_profiles
    ADD COLUMN IF NOT EXISTS attendance_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.employee_profiles.attendance_enabled IS
    'Whether this person clocks in and out. False hides the punch controls entirely.';

-- The punch UI asks this on every load for the signed-in member only, so
-- the lookup is by workspace_member_id.
CREATE INDEX IF NOT EXISTS idx_employee_profiles_attendance_enabled
    ON public.employee_profiles (workspace_id, attendance_enabled);
