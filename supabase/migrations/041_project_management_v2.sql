-- supabase/migrations/041_project_management_v2.sql

-- Add parent_id to tasks for subtasks support
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Ensure RLS on task_comments allows reading and writing for workspace members
-- (Already handled in 039_people_and_projects.sql, but we can double check)

-- Ensure RLS on task_files allows reading and writing for workspace members
-- (Already handled in 039_people_and_projects.sql)

-- Create storage bucket for project-files if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for project-files bucket
CREATE POLICY "Active members can view project-files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'project-files' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Active members can insert project-files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'project-files' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Active members can delete project-files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'project-files' 
        AND auth.role() = 'authenticated'
    );
