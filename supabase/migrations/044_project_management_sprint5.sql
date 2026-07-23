-- supabase/migrations/044_project_management_sprint5.sql

-- ===========================================================================
-- Sprint 5 Architecture: Timesheets & Time Tracking Configuration
-- ===========================================================================

-- 1. Project-level Billing Configuration
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS default_billable_time BOOLEAN DEFAULT true;

-- 2. Time Logs Future-Proofing (Approvals & Invoicing)
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS invoice_id UUID; -- Assuming an invoices table will be created later

-- We already have Row Level Security enabled for time_logs from 039_people_and_projects.sql
