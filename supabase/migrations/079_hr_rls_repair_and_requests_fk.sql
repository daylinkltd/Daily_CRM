-- ============================================================
-- 079 — HR module repair.
--
-- 1. RLS lockout: migration 052 enabled RLS on 19 tables but only
--    wrote policies for 5. With RLS on and no PERMISSIVE policy,
--    Postgres returns ZERO rows to every non-service-role caller —
--    which is why Performance, Recruitment (candidates/applications/
--    interviews/offers), salary structures and approvals render
--    permanently empty and every insert fails. Each table gets the
--    same pattern 052 used elsewhere: members read, people_manage
--    admins write. Child tables without workspace_id scope through
--    their parent.
--
-- 2. hr_employee_requests.hr_employee_id references hr_employees —
--    a table nothing in the app ever writes — so every employee
--    self-service request failed its FK. The column is repointed to
--    workspace_members(id), which is what the UI actually sends.
--    Both tables are empty in production, so this is data-safe.
--    Also adds the missing UPDATE policy so admins can approve or
--    reject requests.
--
-- Idempotent; validated in Docker.
-- ============================================================

-- ------------------------------------------------------------
-- 1a. Workspace-scoped tables: member read + admin write.
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_employee_history',
    'hr_shift_assignments',
    'hr_candidates',
    'hr_job_applications',
    'hr_interviews',
    'hr_offer_letters',
    'hr_review_cycles',
    'hr_performance_goals',
    'hr_performance_reviews',
    'hr_employee_promotions',
    'hr_salary_components',
    'hr_salary_structures',
    'hr_onboarding_tasks',
    'hr_onboarding_employee_tasks',
    'hr_audit_logs',
    'hr_approval_workflows',
    'hr_approval_instances'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Active members can view %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Active members can view %s" ON public.%I FOR SELECT
       USING (public.is_active_workspace_member(workspace_id, auth.uid()))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Admins manage %s" ON public.%I FOR ALL
       USING (public.is_active_workspace_member(workspace_id, auth.uid())
              AND public.has_workspace_permission(workspace_id, auth.uid(), ''people_manage''::text))
       WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid())
              AND public.has_workspace_permission(workspace_id, auth.uid(), ''people_manage''::text))', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 1b. Child tables without workspace_id: scope via parent.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Members via parent hr_salary_structure_components"
  ON public.hr_salary_structure_components;
CREATE POLICY "Members via parent hr_salary_structure_components"
  ON public.hr_salary_structure_components FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hr_salary_structures s
    WHERE s.id = hr_salary_structure_components.structure_id
      AND public.is_active_workspace_member(s.workspace_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hr_salary_structures s
    WHERE s.id = hr_salary_structure_components.structure_id
      AND public.is_active_workspace_member(s.workspace_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Members via parent hr_approval_steps" ON public.hr_approval_steps;
CREATE POLICY "Members via parent hr_approval_steps"
  ON public.hr_approval_steps FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hr_approval_instances i
    WHERE i.id = hr_approval_steps.instance_id
      AND public.is_active_workspace_member(i.workspace_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hr_approval_instances i
    WHERE i.id = hr_approval_steps.instance_id
      AND public.is_active_workspace_member(i.workspace_id, auth.uid())
  ));

-- ------------------------------------------------------------
-- 2. Employee self-service requests: repoint the dead FK and let
--    admins act on requests.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_con TEXT;
BEGIN
  -- hr_employee_id → workspace_members(id)
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.hr_employee_requests'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%hr_employee_id%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.hr_employee_requests DROP CONSTRAINT %I', v_con);
  END IF;

  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.hr_employee_requests'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%assigned_to_employee_id%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.hr_employee_requests DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE public.hr_employee_requests
  ADD CONSTRAINT hr_employee_requests_member_fk
  FOREIGN KEY (hr_employee_id) REFERENCES public.workspace_members(id) ON DELETE CASCADE;

ALTER TABLE public.hr_employee_requests
  ADD CONSTRAINT hr_employee_requests_assignee_fk
  FOREIGN KEY (assigned_to_employee_id) REFERENCES public.workspace_members(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Admins update hr_employee_requests" ON public.hr_employee_requests;
CREATE POLICY "Admins update hr_employee_requests" ON public.hr_employee_requests
  FOR UPDATE
  USING (public.is_active_workspace_member(workspace_id, auth.uid())
         AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid())
         AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text));
