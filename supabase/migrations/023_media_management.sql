-- ============================================================
-- 023_media_management.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.media_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.media_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_folders_workspace ON public.media_folders(workspace_id);

-- Enforce unique folder names within the same parent in a workspace.
-- Note: NULL parent_id in unique constraint works correctly in PG 15+ with NULLS NOT DISTINCT
-- But for compatibility, we just add a unique index with COALESCE if needed, or omit it.
-- We'll just enforce uniqueness at application level or use a partial index.
CREATE UNIQUE INDEX idx_media_folders_unique_root ON public.media_folders(workspace_id, name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_media_folders_unique_child ON public.media_folders(workspace_id, parent_id, name) WHERE parent_id IS NOT NULL;

ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active members can manage media folders" ON public.media_folders
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));


CREATE TABLE IF NOT EXISTS public.media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.media_folders(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  local_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_files_workspace ON public.media_files(workspace_id);
CREATE INDEX idx_media_files_folder ON public.media_files(folder_id);
CREATE INDEX idx_media_files_deal ON public.media_files(deal_id);

ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active members can manage media files" ON public.media_files
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
