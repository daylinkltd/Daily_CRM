-- ── 038_workspace_branding.sql — Company branding fields for quotations
--

-- Add company branding fields to workspaces table
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_tagline TEXT,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS company_website TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT;

-- Allow public read access to logos (for quotation sharing)
-- Storage bucket policy will handle the actual file security
