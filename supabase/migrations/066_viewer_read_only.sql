-- ============================================================
-- 066: Enforce viewer read-only at the database layer.
--
-- Depends on 065_add_viewer_workspace_role.sql being COMMITTED
-- first ('viewer' cannot be referenced in the transaction that
-- adds it to the enum).
--
-- What this does:
--   1. New helper is_active_workspace_writer(): same as
--      is_active_workspace_member() (migration 015) but excludes
--      members whose role = 'viewer'.
--   2. Splits every "any active member can do everything" FOR ALL
--      policy on the CRM data tables into:
--        - a FOR ALL policy gated on the writer helper, and
--        - a FOR SELECT policy gated on plain active membership.
--      Policies are permissive (OR'd), so viewers keep read access
--      through the SELECT policy while INSERT/UPDATE/DELETE now
--      require a non-viewer role. (A FOR ALL policy's WITH CHECK
--      defaults to its USING clause, so inserts are covered.)
--   3. Fixes redeem_invitation() (migration 032), which collapsed
--      'viewer' invitations onto the 'member' role.
--
-- Tables from migrations 031/036/037 previously used the weaker
-- is_workspace_member() helper (no profile-active / owner-blocked
-- check); they are standardized onto the active-member helpers here.
--
-- NOT covered (pre-existing, tracked separately):
--   - contact_tags / contact_custom_values / contact_notes /
--     broadcast_recipients / messages still use legacy per-user
--     (contacts.user_id) ownership policies from migration 001.
--   - Feature-module tables (projects, payroll, HRMS, commerce,
--     retail — migrations 039+) still grant writes to any active
--     member and need the same split applied module by module.
-- ============================================================


-- ---------------------------------------------------------------------------
-- 1. Helper: is_active_workspace_writer(workspace_id, user_id)
--    Active member whose role can write (anything but 'viewer').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_workspace_writer(
  p_workspace_id UUID,
  p_user_id      UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.user_id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_user_id
      AND wm.role <> 'viewer'
      AND p.status = 'active'
  )
  AND NOT public.is_owner_blocked(p_workspace_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_active_workspace_writer(UUID, UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. Split data-table policies: writers manage, active members view.
-- ---------------------------------------------------------------------------

-- Contacts
DROP POLICY IF EXISTS "Active members can manage workspace contacts" ON public.contacts;
CREATE POLICY "Writers can manage workspace contacts" ON public.contacts
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace contacts" ON public.contacts
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Tags
DROP POLICY IF EXISTS "Active members can manage workspace tags" ON public.tags;
CREATE POLICY "Writers can manage workspace tags" ON public.tags
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace tags" ON public.tags
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Custom Fields
DROP POLICY IF EXISTS "Active members can manage workspace custom fields" ON public.custom_fields;
CREATE POLICY "Writers can manage workspace custom fields" ON public.custom_fields
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace custom fields" ON public.custom_fields
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Conversations
DROP POLICY IF EXISTS "Active members can manage workspace conversations" ON public.conversations;
CREATE POLICY "Writers can manage workspace conversations" ON public.conversations
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace conversations" ON public.conversations
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- WhatsApp Config
DROP POLICY IF EXISTS "Active members can manage workspace config" ON public.whatsapp_config;
CREATE POLICY "Writers can manage workspace config" ON public.whatsapp_config
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace config" ON public.whatsapp_config
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Message Templates
DROP POLICY IF EXISTS "Active members can manage workspace templates" ON public.message_templates;
CREATE POLICY "Writers can manage workspace templates" ON public.message_templates
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace templates" ON public.message_templates
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Pipelines
DROP POLICY IF EXISTS "Active members can manage workspace pipelines" ON public.pipelines;
CREATE POLICY "Writers can manage workspace pipelines" ON public.pipelines
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace pipelines" ON public.pipelines
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Pipeline Stages
DROP POLICY IF EXISTS "Active members can manage workspace pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Writers can manage workspace pipeline stages" ON public.pipeline_stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = pipeline_stages.pipeline_id
      AND public.is_active_workspace_writer(pipelines.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view workspace pipeline stages" ON public.pipeline_stages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = pipeline_stages.pipeline_id
      AND public.is_active_workspace_member(pipelines.workspace_id, auth.uid())
    )
  );

-- Deals
DROP POLICY IF EXISTS "Active members can manage workspace deals" ON public.deals;
CREATE POLICY "Writers can manage workspace deals" ON public.deals
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace deals" ON public.deals
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Broadcasts
DROP POLICY IF EXISTS "Active members can manage workspace broadcasts" ON public.broadcasts;
CREATE POLICY "Writers can manage workspace broadcasts" ON public.broadcasts
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace broadcasts" ON public.broadcasts
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Automations
DROP POLICY IF EXISTS "Active members can manage workspace automations" ON public.automations;
CREATE POLICY "Writers can manage workspace automations" ON public.automations
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace automations" ON public.automations
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Automation Steps
DROP POLICY IF EXISTS "Active members can manage workspace automation steps" ON public.automation_steps;
CREATE POLICY "Writers can manage workspace automation steps" ON public.automation_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_steps.automation_id
      AND public.is_active_workspace_writer(automations.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view workspace automation steps" ON public.automation_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_steps.automation_id
      AND public.is_active_workspace_member(automations.workspace_id, auth.uid())
    )
  );

-- Automation Logs (was FOR ALL despite the "view" name)
DROP POLICY IF EXISTS "Active members can view workspace automation logs" ON public.automation_logs;
CREATE POLICY "Writers can manage workspace automation logs" ON public.automation_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_logs.automation_id
      AND public.is_active_workspace_writer(automations.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view workspace automation logs" ON public.automation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_logs.automation_id
      AND public.is_active_workspace_member(automations.workspace_id, auth.uid())
    )
  );

-- Media Folders (023)
DROP POLICY IF EXISTS "Active members can manage media folders" ON public.media_folders;
CREATE POLICY "Writers can manage media folders" ON public.media_folders
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view media folders" ON public.media_folders
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Media Files (023)
DROP POLICY IF EXISTS "Active members can manage media files" ON public.media_files;
CREATE POLICY "Writers can manage media files" ON public.media_files
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view media files" ON public.media_files
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Custom Forms (031 — previously the weaker is_workspace_member)
DROP POLICY IF EXISTS "Users can manage workspace custom forms" ON public.custom_forms;
CREATE POLICY "Writers can manage workspace custom forms" ON public.custom_forms
  FOR ALL TO authenticated USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace custom forms" ON public.custom_forms
  FOR SELECT TO authenticated USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage workspace custom form fields" ON public.custom_form_fields;
CREATE POLICY "Writers can manage workspace custom form fields" ON public.custom_form_fields
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.custom_forms
      WHERE custom_forms.id = custom_form_fields.form_id
      AND public.is_active_workspace_writer(custom_forms.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view workspace custom form fields" ON public.custom_form_fields
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.custom_forms
      WHERE custom_forms.id = custom_form_fields.form_id
      AND public.is_active_workspace_member(custom_forms.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage workspace custom form submissions" ON public.custom_form_submissions;
CREATE POLICY "Writers can manage workspace custom form submissions" ON public.custom_form_submissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.custom_forms
      WHERE custom_forms.id = custom_form_submissions.form_id
      AND public.is_active_workspace_writer(custom_forms.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view workspace custom form submissions" ON public.custom_form_submissions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.custom_forms
      WHERE custom_forms.id = custom_form_submissions.form_id
      AND public.is_active_workspace_member(custom_forms.workspace_id, auth.uid())
    )
  );

-- Chatbot Config (036 — previously the weaker is_workspace_member)
DROP POLICY IF EXISTS "Users can manage workspace chatbot config" ON public.chatbot_config;
CREATE POLICY "Writers can manage workspace chatbot config" ON public.chatbot_config
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace chatbot config" ON public.chatbot_config
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Quotation Builder (037 — previously the weaker is_workspace_member)
DROP POLICY IF EXISTS "Users can manage workspace service catalog" ON public.service_catalog;
CREATE POLICY "Writers can manage workspace service catalog" ON public.service_catalog
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace service catalog" ON public.service_catalog
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage workspace quotations" ON public.quotations;
CREATE POLICY "Writers can manage workspace quotations" ON public.quotations
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace quotations" ON public.quotations
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage workspace quotation sections" ON public.quotation_sections;
CREATE POLICY "Writers can manage workspace quotation sections" ON public.quotation_sections
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace quotation sections" ON public.quotation_sections
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage workspace quotation line items" ON public.quotation_line_items;
CREATE POLICY "Writers can manage workspace quotation line items" ON public.quotation_line_items
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace quotation line items" ON public.quotation_line_items
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 3. redeem_invitation: persist 'viewer' instead of collapsing to 'member'.
--    Full replacement of the migration 032 function; only the role
--    mapping block changed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS TEXT  -- the joined workspace_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_db_role public.workspace_role;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  -- Map AccountRole ('admin', 'agent', 'viewer') to workspace_role
  -- ('admin', 'member', 'viewer'). 'viewer' must survive distinctly —
  -- collapsing it onto 'member' silently granted write access.
  IF v_inv.role = 'admin' THEN
    v_db_role := 'admin';
  ELSIF v_inv.role = 'viewer' THEN
    v_db_role := 'viewer';
  ELSE
    v_db_role := 'member';
  END IF;

  -- Add the caller to workspace_members
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_inv.account_id, v_caller_id, v_db_role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Stamp the invitation as accepted
  UPDATE public.account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  RETURN v_inv.account_id::TEXT;
END;
$$;
