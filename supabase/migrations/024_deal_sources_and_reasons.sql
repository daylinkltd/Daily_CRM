-- ── 024: Deal Sources and Lost Reasons ───────────────────────────────

-- 1. Create deal_sources table
CREATE TABLE IF NOT EXISTS public.deal_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow all authenticated users to read and insert (since sources are global)
ALTER TABLE public.deal_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read sources" ON public.deal_sources;
CREATE POLICY "Allow authenticated read sources" ON public.deal_sources FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert sources" ON public.deal_sources;
CREATE POLICY "Allow authenticated insert sources" ON public.deal_sources FOR INSERT TO authenticated WITH CHECK (true);

-- 2. Create deal_lost_reasons table
CREATE TABLE IF NOT EXISTS public.deal_lost_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.deal_lost_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read reasons" ON public.deal_lost_reasons;
CREATE POLICY "Allow authenticated read reasons" ON public.deal_lost_reasons FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert reasons" ON public.deal_lost_reasons;
CREATE POLICY "Allow authenticated insert reasons" ON public.deal_lost_reasons FOR INSERT TO authenticated WITH CHECK (true);


-- 3. Alter deals table to add foreign keys
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.deal_sources(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lost_reason_id UUID REFERENCES public.deal_lost_reasons(id) ON DELETE SET NULL;
