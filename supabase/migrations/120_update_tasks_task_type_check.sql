-- Migration 120: Expand tasks_task_type_check constraint to accept TASK, FEATURE, STORY, BUG
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_type_check CHECK (
    task_type IN ('PROJECT', 'GENERAL', 'SUPPORT', 'MEETING', 'TRAINING', 'ADMIN', 'TASK', 'FEATURE', 'STORY', 'BUG')
);
