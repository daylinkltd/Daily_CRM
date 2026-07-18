-- Add logo_url column to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS logo_url TEXT;
