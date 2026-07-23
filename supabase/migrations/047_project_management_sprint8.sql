-- supabase/migrations/047_project_management_sprint8.sql

-- ===========================================================================
-- Sprint 8 Architecture: Timeline / Gantt Charts
-- ===========================================================================

-- 1. Add start_date to tasks table to support Gantt charts
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date DATE;
