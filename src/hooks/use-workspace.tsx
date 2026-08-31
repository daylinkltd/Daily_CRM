"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { withDerivedLegacyPermissions } from "@/lib/auth/legacy-permissions";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import {
  applyPlatformFlags,
  applyWorkspaceModules,
  deriveModuleAccess,
  type ModuleAccess,
  type PlatformModuleFlags,
} from "@/lib/auth/modules";
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
  /** Workspace default currency (ISO-4217, migration 033). */
  default_currency?: string | null;
  /** Company identity, edited in Settings -> Branding. Selected here
   *  because the setup checklist reads them from context — without them
   *  it reported a saved address as still missing. */
  company_name?: string | null;
  company_address?: string | null;
  /** Modules this business chose to use. Null/empty means all of them. */
  enabled_modules?: string[] | null;
  business_type?: string | null;
  team_size?: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
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
  [key: string]: boolean;
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

/** The bits of `employee_profiles` the shell needs to gate on. */
export interface EmployeeProfileSummary {
  workspace_member_id: string;
  employee_code: string | null;
  status: string | null;
  designation_id: string | null;
  department_id: string | null;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeMember: { id: string } | null;
  /**
   * The member's HR record, or null when they are a member but not staff.
   * Null is the normal case for a solo owner or an external collaborator.
   */
  employeeProfile: EmployeeProfileSummary | null;
  /**
   * True when an employee_profiles row exists for this member. Gates the
   * employee-only self-service pages (payslips, leave, attendance,
   * requests, documents, handbook), which are meaningless without one.
   */
  isEmployee: boolean;
  activeRole: "owner" | "admin" | "member" | "viewer" | null;
  permissions: WorkspacePermissions;
  /**
   * Per-app-module access for the current member, derived from their enum
   * role + custom-role permissions JSONB. Owners/admins get every module.
   * See `deriveModuleAccess` in `@/lib/auth/modules`.
   */
  moduleAccess: ModuleAccess;
  /** Active workspace's default currency (ISO-4217, falls back to USD). */
  defaultCurrency: string;
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  /** True if the current user has a given permission key */
  can: (key: keyof WorkspacePermissions | string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [activeMember, setActiveMember] = useState<{ id: string } | null>(null);
  const [employeeProfile, setEmployeeProfile] =
    useState<EmployeeProfileSummary | null>(null);
  const [activeRole, setActiveRole] = useState<"owner" | "admin" | "member" | "viewer" | null>(null);
  const [permissions, setPermissions] = useState<WorkspacePermissions>(DEFAULT_MEMBER_PERMISSIONS);
  // Raw `workspace_roles.permissions` JSONB for the active member's custom
  // role (null when they have no custom role assigned). Kept separate from
  // `permissions` because module access is derived from the raw booleans —
  // see `moduleAccess` below.
  const [rolePermissions, setRolePermissions] = useState<Record<string, unknown> | null>(null);
  // Platform-level module flags for the active workspace, set from the
  // SaaS admin console. null = no row / not yet loaded, which fails open.
  const [platformFlags, setPlatformFlags] = useState<PlatformModuleFlags | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (authLoading) {
      return;
    }
    setLoading(true);

    const isDemo = typeof window !== "undefined" && localStorage.getItem("crm_demo_mode") === "true";
    if (isDemo) {
      const demoWs: Workspace = {
        id: "ws_demo",
        name: "Daily CRM Workspace",
        plan: "business",
        plan_limits: { max_members: 10, max_workspaces: 1, max_storage_gb: 50, channels: ["whatsapp", "social"], max_automations: 100 },
        created_at: new Date().toISOString(),
      };
      setWorkspaces([demoWs]);
      setActiveWorkspace(demoWs);
      setActiveRole("owner");
      setPermissions(OWNER_PERMISSIONS);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setActiveMember(null);
      setEmployeeProfile(null);
      setActiveRole(null);
      setPermissions(DEFAULT_MEMBER_PERMISSIONS);
      setRolePermissions(null);
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
            logo_url,
            default_currency,
            company_name,
            company_address,
            enabled_modules,
            business_type,
            team_size
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        console.error("[WorkspaceProvider] error fetching memberships:", error);
        return;
      }

      if (memberData && memberData.length > 0) {
        const fetchedWorkspaces: Workspace[] = [];
        const roleMap: Record<string, "owner" | "admin" | "member" | "viewer"> = {};
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
        await loadPermissions(
          supabase,
          chosenWorkspace.id,
          chosenRole,
          roleIdMap[chosenWorkspace.id] ?? null,
        );

        await loadEmployeeProfile(
          supabase,
          chosenWorkspace.id,
          memberMap[chosenWorkspace.id]?.id ?? null,
        );
      } else {
        setWorkspaces([]);
        setActiveWorkspace(null);
        setActiveMember(null);
        setEmployeeProfile(null);
        setActiveRole(null);
        setPermissions(DEFAULT_MEMBER_PERMISSIONS);
        setRolePermissions(null);
      }
    } catch (err) {
      console.error("[WorkspaceProvider] exception:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  /**
   * Does this member have an HR employee record?
   *
   * Drives the employee-only half of the My Workspace module. A workspace
   * owner who runs the business alone, an external collaborator, or an
   * agency user is a member without being staff — showing them "My
   * Payslips" and a staff handbook is noise at best, and at worst implies
   * an employment relationship that doesn't exist.
   *
   * `employee_profiles` is the live table and it has NO `id` column — it
   * is keyed by `workspace_member_id`. (`hr_employees` is dormant and
   * empty; do not use it.)
   */
  const loadEmployeeProfile = async (
    supabase: ReturnType<typeof createClient>,
    workspaceId: string,
    memberId: string | null,
  ) => {
    if (!memberId) {
      setEmployeeProfile(null);
      return;
    }
    const { data } = await supabase
      .from("employee_profiles")
      .select("workspace_member_id, employee_code, status, designation_id, department_id")
      .eq("workspace_id", workspaceId)
      .eq("workspace_member_id", memberId)
      .maybeSingle();

    setEmployeeProfile((data as EmployeeProfileSummary | null) ?? null);
  };

  const loadPermissions = async (
    supabase: ReturnType<typeof createClient>,
    workspaceId: string,
    role: "owner" | "admin" | "member" | "viewer" | null,
    roleId: string | null
  ) => {
    // Platform flags load for EVERY role — including owner — because the
    // console's kill switch outranks the owner/admin bypass below. A
    // missing row (or a select blocked by RLS pre-migration-104) leaves
    // null, and null fails open.
    supabase
      .from("saas_workspace_feature_flags")
      .select("enable_crm, enable_hr, enable_retail, enable_projects")
      .eq("workspace_id", workspaceId)
      .maybeSingle()
      .then(({ data }) => setPlatformFlags((data as PlatformModuleFlags) ?? null));

    // Owners & Admins always get all permissions — no DB call needed.
    // Their module access is derived from the enum role alone, so the raw
    // role JSONB can stay null (the owner/admin bypass ignores it).
    if (role === "owner" || role === "admin") {
      setPermissions(OWNER_PERMISSIONS);
      setRolePermissions(null);
      return;
    }

    // Fetch the member's custom-role permissions JSONB directly. RLS scopes
    // workspace_roles to the caller's workspace, and we filter on both id and
    // workspace_id, so this can never read another tenant's role. Module
    // access is derived from these raw booleans (module_crm/hr/retail/projects).
    if (roleId) {
      const { data: roleRow } = await supabase
        .from("workspace_roles")
        .select("permissions")
        .eq("id", roleId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      setRolePermissions(
        (roleRow?.permissions as Record<string, unknown> | undefined) ?? null,
      );
    } else {
      // No custom role assigned → module access falls back to the default.
      setRolePermissions(null);
    }

    try {
      const { data, error } = await supabase
        .rpc("get_user_permissions", { p_workspace_id: workspaceId })
        .single();

      if (error || !data) {
        setPermissions(DEFAULT_MEMBER_PERMISSIONS);
        return;
      }

      // The seeded roles carry only CRUD keys, so the coarse keys the HR
      // UI gates on (people_manage, attendance_manage, leave_approve) are
      // absent and the defaults below would deny them forever. Derive them
      // from the CRUD keys that ARE granted.
      setPermissions(
        withDerivedLegacyPermissions({
          ...DEFAULT_MEMBER_PERMISSIONS,
          ...(data as WorkspacePermissions),
        }) as WorkspacePermissions
      );
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

  // Three authorities, narrowest wins, applied outermost-last:
  //   role        — who on the team may see this module
  //   platform    — what we allow this tenant to have at all
  //   workspace   — which of those this business actually uses
  //
  // The workspace layer is applied last and does NOT bypass for owners:
  // a module the business switched off is off for the person who
  // switched it off too, and they turn it back on where they turned it
  // off (Settings → Modules).
  const moduleAccess = useMemo(
    () =>
      applyWorkspaceModules(
        applyPlatformFlags(deriveModuleAccess(activeRole, rolePermissions), platformFlags),
        activeWorkspace?.enabled_modules,
      ),
    [activeRole, rolePermissions, platformFlags, activeWorkspace?.enabled_modules]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeMember,
        employeeProfile,
        isEmployee: employeeProfile !== null,
        activeRole,
        permissions,
        moduleAccess,
        defaultCurrency: activeWorkspace?.default_currency || DEFAULT_CURRENCY,
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

/**
 * Convenience hook returning just the current member's per-module access
 * `{ crm, hr, retail, projects }`. Owner/admin get every module; a member
 * with no custom role falls back to DEFAULT_MODULE_ACCESS (CRM only).
 */
export function useModuleAccess(): ModuleAccess {
  return useWorkspace().moduleAccess;
}
