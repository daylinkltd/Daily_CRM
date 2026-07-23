-- supabase/seed_hr_demo.sql
-- This seed script populates a workspace with realistic demo data for the People & Projects module
-- Run this AFTER executing the 039_people_and_projects.sql migration

-- Ensure we target a specific workspace or generate a new one if necessary.
-- For a generalized seed, we'll assume a dummy workspace ID (or you can replace it with your own).
DO $$
DECLARE
    v_workspace_id UUID := '00000000-0000-0000-0000-000000000001'; -- Replace with actual workspace ID if needed
    v_user_1 UUID := gen_random_uuid();
    v_user_2 UUID := gen_random_uuid();
    v_user_3 UUID := gen_random_uuid();
    v_member_1 UUID := gen_random_uuid();
    v_member_2 UUID := gen_random_uuid();
    v_member_3 UUID := gen_random_uuid();
    v_dept_eng UUID := gen_random_uuid();
    v_dept_hr UUID := gen_random_uuid();
    v_dept_sales UUID := gen_random_uuid();
    v_proj_crm UUID := gen_random_uuid();
    v_proj_gst UUID := gen_random_uuid();
BEGIN
    -- Only run if there is at least one workspace to attach to, otherwise create a dummy one
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = v_workspace_id) THEN
        -- Dummy Workspace (Warning: Depends on existing schemas, adjust as needed)
        INSERT INTO public.workspaces (id, name) VALUES (v_workspace_id, 'Daylink Demo') ON CONFLICT DO NOTHING;
    END IF;

    -- 1. Departments
    INSERT INTO public.departments (id, workspace_id, name, description)
    VALUES 
        (v_dept_eng, v_workspace_id, 'Engineering', 'Software Development & IT'),
        (v_dept_hr, v_workspace_id, 'HR', 'Human Resources & Talent'),
        (v_dept_sales, v_workspace_id, 'Sales', 'Client Acquisition & CRM')
    ON CONFLICT DO NOTHING;

    -- 2. Mock Users & Workspace Members (Assumes auth.users exist or we bypass constraints for local testing)
    -- In a real seed, these should reference valid auth.users. 
    -- For safety, we will just insert into workspace_members (ensure triggers don't break).
    INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
    VALUES 
        (v_member_1, v_workspace_id, v_user_1, 'admin'),
        (v_member_2, v_workspace_id, v_user_2, 'member'),
        (v_member_3, v_workspace_id, v_user_3, 'member')
    ON CONFLICT DO NOTHING;

    -- 3. Employee Profiles
    INSERT INTO public.employee_profiles (workspace_member_id, workspace_id, department_id, employee_code, status, employment_type)
    VALUES 
        (v_member_1, v_workspace_id, v_dept_eng, 'EMP-001', 'ACTIVE', 'Full-Time'),
        (v_member_2, v_workspace_id, v_dept_hr, 'EMP-002', 'ACTIVE', 'Contractor'),
        (v_member_3, v_workspace_id, v_dept_sales, 'EMP-003', 'PROBATION', 'Full-Time')
    ON CONFLICT (workspace_member_id) DO UPDATE 
    SET department_id = EXCLUDED.department_id, status = EXCLUDED.status;

    -- 4. Projects
    INSERT INTO public.projects (id, workspace_id, name, manager_workspace_member_id, status, project_source)
    VALUES 
        (v_proj_crm, v_workspace_id, 'CRM Revamp', v_member_1, 'active', 'MANUAL'),
        (v_proj_gst, v_workspace_id, 'GST Module', v_member_1, 'active', 'MANUAL')
    ON CONFLICT DO NOTHING;

    -- 5. Tasks (General & Project)
    INSERT INTO public.tasks (workspace_id, project_id, assigned_workspace_member_id, title, task_type, status, sort_order)
    VALUES 
        -- General Tasks
        (v_workspace_id, NULL, v_member_1, 'Team Meeting', 'MEETING', 'TODO', 1),
        (v_workspace_id, NULL, v_member_2, 'Documentation', 'GENERAL', 'IN_PROGRESS', 2),
        (v_workspace_id, NULL, v_member_1, 'Code Review', 'GENERAL', 'REVIEW', 3),
        
        -- Project Tasks
        (v_workspace_id, v_proj_crm, v_member_1, 'Authentication', 'PROJECT', 'DONE', 1),
        (v_workspace_id, v_proj_crm, v_member_1, 'Dashboard', 'PROJECT', 'IN_PROGRESS', 2),
        (v_workspace_id, v_proj_gst, v_member_3, 'Reports', 'PROJECT', 'TODO', 1)
    ON CONFLICT DO NOTHING;

END $$;
