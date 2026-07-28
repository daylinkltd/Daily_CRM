-- supabase/migrations/071_fix_tasks_trigger_status.sql

-- 1. Ensure status text column exists on public.tasks as a compatible fallback
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';

-- 2. Drop any legacy trigger that references old.status if present
DROP TRIGGER IF EXISTS tr_tasks_audit_status ON public.tasks;
DROP TRIGGER IF EXISTS tasks_status_audit_trigger ON public.tasks;
