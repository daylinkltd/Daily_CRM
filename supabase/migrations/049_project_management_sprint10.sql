-- supabase/migrations/049_project_management_sprint10.sql

-- ===========================================================================
-- Sprint 10 Architecture: Advanced Resource Planning & Capacity
-- ===========================================================================

-- 1. Add weekly_capacity to workspace_members to track available hours
ALTER TABLE public.workspace_members 
    ADD COLUMN IF NOT EXISTS weekly_capacity NUMERIC DEFAULT 40;
