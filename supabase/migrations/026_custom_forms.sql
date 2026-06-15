-- ── 026: Custom Forms and Submissions ───────────────────────────────

-- 1. Create custom_forms Table
CREATE TABLE IF NOT EXISTS public.custom_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create custom_form_fields Table
CREATE TABLE IF NOT EXISTS public.custom_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, email, phone, textarea, select, checkbox
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  options JSONB, -- JSON array of strings e.g. ["Sales", "Support"]
  mapping_type TEXT NOT NULL DEFAULT 'none', -- contact_field, contact_custom_field, deal_field, none
  mapping_key TEXT, -- name, phone, email, company, custom_field_id, or deal_field key (title, value, etc.)
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create custom_form_submissions Table
CREATE TABLE IF NOT EXISTS public.custom_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  submitted_values JSONB NOT NULL, -- raw key-value submission matching { [field_id]: value }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.custom_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_form_submissions ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies
DROP POLICY IF EXISTS "Users can manage workspace custom forms" ON public.custom_forms;
CREATE POLICY "Users can manage workspace custom forms" ON public.custom_forms
  FOR ALL TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage workspace custom form fields" ON public.custom_form_fields;
CREATE POLICY "Users can manage workspace custom form fields" ON public.custom_form_fields
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.custom_forms
      WHERE custom_forms.id = custom_form_fields.form_id
      AND public.is_workspace_member(custom_forms.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage workspace custom form submissions" ON public.custom_form_submissions;
CREATE POLICY "Users can manage workspace custom form submissions" ON public.custom_form_submissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.custom_forms
      WHERE custom_forms.id = custom_form_submissions.form_id
      AND public.is_workspace_member(custom_forms.workspace_id, auth.uid())
    )
  );

-- 6. Trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.custom_forms;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.custom_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
