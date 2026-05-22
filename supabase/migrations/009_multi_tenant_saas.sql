-- 009_multi_tenant_saas.sql

-- Create workspaces table
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workspace_members table
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.workspace_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Policies for Workspaces
CREATE POLICY "Users can view workspaces they belong to" 
ON public.workspaces FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = public.workspaces.id AND user_id = auth.uid()));

-- Policies for Members
CREATE POLICY "Users can view members of their workspaces" 
ON public.workspace_members FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = public.workspace_members.workspace_id AND wm.user_id = auth.uid()));

-- Global roles for users (SaaS Admin vs Tenant Admin)
ALTER TABLE public.profiles ADD COLUMN system_role TEXT DEFAULT 'user';

-- Trigger to automatically create a workspace for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace() 
RETURNS TRIGGER AS $$
DECLARE
    new_workspace_id UUID;
BEGIN
    INSERT INTO public.workspaces (name) VALUES (NEW.email || '''s Workspace') RETURNING id INTO new_workspace_id;
    INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (new_workspace_id, NEW.id, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_workspace
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();
