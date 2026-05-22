-- ── 019: Prospects table + tenant plan limits ─────────────────────────────

-- 1. Prospects: stores Contact Sales form submissions from the landing page
CREATE TABLE IF NOT EXISTS public.prospects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text NOT NULL,
  company_name  text NOT NULL,
  email         text NOT NULL,
  phone         text,
  team_size     text,
  plan_interest text DEFAULT 'growth',
  message       text,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: only super_admin can read; inserts are public (no auth required for landing page)
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_prospects"
  ON public.prospects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND system_role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND system_role = 'super_admin'
    )
  );

-- Allow anyone (anon) to insert a prospect (the public Contact Sales form)
CREATE POLICY "public_insert_prospects"
  ON public.prospects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 2. Add plan columns to workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'growth',
  ADD COLUMN IF NOT EXISTS plan_limits jsonb NOT NULL DEFAULT '{
    "max_members": 20,
    "max_workspaces": 2,
    "max_storage_gb": 5,
    "channels": ["whatsapp", "instagram", "messenger", "email"],
    "max_automations": null
  }'::jsonb;

-- Index for fast prospect status queries
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_created ON public.prospects(created_at DESC);
