"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./use-auth";

export interface WorkspacePlanLimits {
  max_members: number | null;
  max_workspaces: number | null;
  max_storage_gb: number | null;
  channels: string[];
  max_automations: number | null;
  max_messages?: number | null;
}

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  plan_limits: WorkspacePlanLimits;
  created_at: string;
  logo_url?: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  role_id: string | null;
  created_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

/** ABAC permission keys — keep in sync with DB workspace_roles.permissions JSONB */
export interface WorkspacePermissions {
  inbox: boolean;
  contacts: boolean;
  pipelines: boolean;
  broadcasts: boolean;
  automations: boolean;
  integrations: boolean;
  settings_profile: boolean;
  settings_workspace: boolean;
  settings_templates: boolean;
  settings_tags: boolean;
  reports: boolean;
  manage_users: boolean;
  manage_roles: boolean;
  manage_workspaces: boolean;
  projects_view: boolean;
  projects_manage: boolean;
  people_view: boolean;
  people_manage: boolean;
  attendance_manage: boolean;
  leave_approve: boolean;
}

export const DEFAULT_MEMBER_PERMISSIONS: WorkspacePermissions = {
  inbox: true,
  contacts: true,
  pipelines: true,
  broadcasts: true,
  automations: false,
  integrations: false,
  settings_profile: true,
  settings_workspace: false,
  settings_templates: false,
  settings_tags: false,
  reports: false,
  manage_users: false,
  manage_roles: false,
  manage_workspaces: false,
  projects_view: true,
  projects_manage: false,
  people_view: true,
  people_manage: false,
  attendance_manage: false,
  leave_approve: false,
};

export const OWNER_PERMISSIONS: WorkspacePermissions = {
  inbox: true,
  contacts: true,
  pipelines: true,
  broadcasts: true,
  automations: true,
  integrations: true,
  settings_profile: true,
  settings_workspace: true,
  settings_templates: true,
  settings_tags: true,
  reports: true,
  manage_users: true,
  manage_roles: true,
  manage_workspaces: true,
  projects_view: true,
  projects_manage: true,
  people_view: true,
  people_manage: true,
  attendance_manage: true,
  leave_approve: true,
};

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeMember: { id: string } | null;
  activeRole: "owner" | "admin" | "member" | null;
  permissions: WorkspacePermissions;
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  /** True if the current user has a given permission key */
  can: (key: keyof WorkspacePermissions) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [activeMember, setActiveMember] = useState<{ id: string } | null>(null);
  const [activeRole, setActiveRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [permissions, setPermissions] = useState<WorkspacePermissions>(DEFAULT_MEMBER_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (authLoading) {
      return;
    }
    setLoading(true);
    if (!user?.id) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setActiveMember(null);
      setActiveRole(null);
      setPermissions(DEFAULT_MEMBER_PERMISSIONS);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    try {
      const { data: memberData, error } = await supabase
        .from("workspace_members")
        .select(`
          id,
          workspace_id,
          role,
          role_id,
          workspaces (
            id,
            name,
            plan,
            plan_limits,
            created_at,
            logo_url
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        console.error("[WorkspaceProvider] error fetching memberships:", error);
        return;
      }

      if (memberData && memberData.length > 0) {
        const fetchedWorkspaces: Workspace[] = [];
        const roleMap: Record<string, "owner" | "admin" | "member"> = {};
        const roleIdMap: Record<string, string | null> = {};
        const memberMap: Record<string, { id: string }> = {};

        memberData.forEach((item: any) => {
          if (item.workspaces) {
            const ws = item.workspaces as unknown as Workspace;
            fetchedWorkspaces.push(ws);
            roleMap[ws.id] = item.role;
            roleIdMap[ws.id] = item.role_id ?? null;
            memberMap[ws.id] = { id: item.id };
          }
        });

        setWorkspaces(fetchedWorkspaces);

        const savedActiveId =
          typeof window !== "undefined"
            ? localStorage.getItem("crm_active_workspace_id")
            : null;
        const matchedWorkspace = fetchedWorkspaces.find((w) => w.id === savedActiveId);

        const chosenWorkspace = matchedWorkspace ?? fetchedWorkspaces[0];
        setActiveWorkspace(chosenWorkspace);
        const chosenRole = roleMap[chosenWorkspace.id];
        setActiveRole(chosenRole);
        setActiveMember(memberMap[chosenWorkspace.id] || null);

        if (!matchedWorkspace && typeof window !== "undefined") {
          localStorage.setItem("crm_active_workspace_id", chosenWorkspace.id);
        }

        // Fetch ABAC permissions for this workspace
        await loadPermissions(supabase, chosenWorkspace.id, chosenRole);
      } else {
        setWorkspaces([]);
        setActiveWorkspace(null);
        setActiveMember(null);
        setActiveRole(null);
        setPermissions(DEFAULT_MEMBER_PERMISSIONS);
      }
    } catch (err) {
      console.error("[WorkspaceProvider] exception:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  const loadPermissions = async (
    supabase: ReturnType<typeof createClient>,
    workspaceId: string,
    role: "owner" | "admin" | "member" | null
  ) => {
    // Owners & Admins always get all permissions — no DB call needed
    if (role === "owner" || role === "admin") {
      setPermissions(OWNER_PERMISSIONS);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc("get_user_permissions", { p_workspace_id: workspaceId })
        .single();

      if (error || !data) {
        setPermissions(DEFAULT_MEMBER_PERMISSIONS);
        return;
      }

      setPermissions({ ...DEFAULT_MEMBER_PERMISSIONS, ...(data as WorkspacePermissions) });
    } catch {
      setPermissions(DEFAULT_MEMBER_PERMISSIONS);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const matched = workspaces.find((w) => w.id === workspaceId);
      if (matched) {
        setActiveWorkspace(matched);
        // Note: activeMember/activeRole reload on fetchWorkspaces. 
        // For a full context switch, reload is standard in this app.
        if (typeof window !== "undefined") {
          localStorage.setItem("crm_active_workspace_id", workspaceId);
        }
        window.location.reload();
      }
    },
    [workspaces]
  );

  const refreshWorkspaces = useCallback(async () => {
    setLoading(true);
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  const createWorkspace = useCallback(
    async (name: string): Promise<Workspace | null> => {
      if (!user?.id) return null;
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .rpc("create_workspace_for_user", { p_name: name.trim() })
          .single();

        if (error) {
          console.error("[WorkspaceProvider] error creating workspace:", error);
          throw new Error(error.message || "Failed to create workspace");
        }

        const wsData = data as Workspace;
        await fetchWorkspaces();
        setActiveWorkspace(wsData);
        if (typeof window !== "undefined") {
          localStorage.setItem("crm_active_workspace_id", wsData.id);
        }
        return wsData;
      } catch (err: any) {
        console.error("[WorkspaceProvider] exception during workspace creation:", err);
        throw err;
      }
    },
    [user?.id, fetchWorkspaces]
  );

  const can = useCallback(
    (key: keyof WorkspacePermissions) => permissions[key] === true,
    [permissions]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeMember,
        activeRole,
        permissions,
        loading,
        switchWorkspace,
        refreshWorkspaces,
        createWorkspace,
        can,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
