"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  Users, Plus, Trash2, Shield, UserPlus, Check, Building,
  ChevronDown, ChevronRight, Eye, EyeOff, Key, Lock,
  AlertTriangle, Briefcase, Settings2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ProfileDetail {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  role_id: string | null;
  created_at: string;
  profile?: ProfileDetail;
  custom_role?: WorkspaceRole;
}

interface WorkspaceRole {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: Record<string, boolean>;
}

// All known permission keys and their display labels
const PERMISSION_LABELS: { key: string; label: string; group: string }[] = [
  { key: "inbox",              label: "Inbox",                  group: "Core" },
  { key: "contacts",           label: "Contacts",               group: "Core" },
  { key: "pipelines",          label: "Pipelines",              group: "Core" },
  { key: "broadcasts",         label: "Broadcasts",             group: "Engagement" },
  { key: "automations",        label: "Automations",            group: "Engagement" },
  { key: "integrations",       label: "Integrations",           group: "Advanced" },
  { key: "reports",            label: "Reports",                group: "Advanced" },
  { key: "settings_profile",   label: "Edit Own Profile",       group: "Settings" },
  { key: "settings_workspace", label: "Workspace Settings",     group: "Settings" },
  { key: "settings_templates", label: "Message Templates",      group: "Settings" },
  { key: "settings_tags",      label: "Tags",                   group: "Settings" },
];

const PERMISSION_GROUPS = ["Core", "Engagement", "Advanced", "Settings"];

// ─── WorkspaceSettings Component ──────────────────────────────────────────────
export function WorkspaceSettings() {
  const { activeWorkspace, activeRole, refreshWorkspaces, createWorkspace, can } = useWorkspace();
  const { user: currentUser } = useAuth();
  const supabase = createClient();

  const isOwner = activeRole === "owner";
  const canManageUsers = isOwner || can("manage_users");
  const canManageWorkspace = isOwner || can("settings_workspace");

  // ── Workspace name ─────────────────────────────────────────────────────────
  const [workspaceName, setWorkspaceName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [saveNameSuccess, setSaveNameSuccess] = useState(false);

  // ── Members ────────────────────────────────────────────────────────────────
  const [rawMembers, setRawMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // ── Create user form ────────────────────────────────────────────────────────
  const [createTab, setCreateTab] = useState<"new" | "existing">("new");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState<string>("");
  const [newUserWorkspaceRole, setNewUserWorkspaceRole] = useState<"admin" | "member">("member");
  const [showPassword, setShowPassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // ── Custom role builder ────────────────────────────────────────────────────
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSION_LABELS.map((p) => [p.key, false]))
  );
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [roleSuccess, setRoleSuccess] = useState("");
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  // ── Create workspace ───────────────────────────────────────────────────────
  const [newWsName, setNewWsName] = useState("");
  const [createWsLoading, setCreateWsLoading] = useState(false);
  const [createWsSuccess, setCreateWsSuccess] = useState("");

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    const { data } = await supabase
      .from("workspace_roles")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("is_system", { ascending: false });
    if (data) setRoles(data);
  }, [activeWorkspace?.id, supabase]);

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoadingMembers(true);
    try {
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, role_id, created_at")
        .eq("workspace_id", activeWorkspace.id);

      if (!memberData?.length) { setRawMembers([]); return; }

      const userIds = memberData.map((m) => m.user_id);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds);

      const joined = memberData.map((m) => {
        const profile = profileData?.find((p) => p.user_id === m.user_id);
        return { ...m, profile };
      });

      setRawMembers(joined);
    } finally {
      setLoadingMembers(false);
    }
  }, [activeWorkspace?.id, supabase]);

  // Compute mapped members with their custom roles in-memory
  const members = useMemo(() => {
    const mapped: MemberWithProfile[] = rawMembers.map((m) => {
      const custom_role = roles.find((r) => r.id === m.role_id);
      return { ...m, role: m.role as "owner" | "admin" | "member", profile: m.profile, custom_role };
    });

    const order = { owner: 0, admin: 1, member: 2 };
    const sorted = [...mapped].sort((a, b) => order[a.role] - order[b.role]);
    return sorted;
  }, [rawMembers, roles]);

  // Fetch roles on workspace change
  useEffect(() => {
    if (activeWorkspace) {
      setWorkspaceName(activeWorkspace.name);
      fetchRoles();
    }
  }, [activeWorkspace?.id, fetchRoles]);

  // Fetch members when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      fetchMembers();
    }
  }, [activeWorkspace?.id, fetchMembers]);

  // ── Workspace name update ──────────────────────────────────────────────────
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageWorkspace || !activeWorkspace?.id || !workspaceName.trim()) return;
    setIsSavingName(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: workspaceName.trim() })
      .eq("id", activeWorkspace.id);
    if (!error) { setSaveNameSuccess(true); await refreshWorkspaces(); setTimeout(() => setSaveNameSuccess(false), 3000); }
    setIsSavingName(false);
  };

  // ── Create/invite user ─────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers || !activeWorkspace?.id) return;
    setCreateLoading(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const payload: Record<string, unknown> = {
        workspace_id: activeWorkspace.id,
        email: newUserEmail.trim(),
        workspace_role: newUserWorkspaceRole,
        role_id: newUserRoleId || undefined,
      };
      if (createTab === "new") {
        payload.full_name = newUserName.trim();
        payload.password = newUserPassword;
      }

      const res = await fetch("/api/workspace/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || "Failed to add user.");
      } else {
        const msg = json.is_new_user
          ? `Created and added ${newUserEmail.trim()} to the workspace!`
          : `Added existing user ${newUserEmail.trim()} to the workspace!`;
        setCreateSuccess(msg);
        setNewUserName(""); setNewUserEmail(""); setNewUserPassword("");
        setNewUserRoleId(""); setNewUserWorkspaceRole("member");
        fetchMembers();
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!canManageUsers || !activeWorkspace?.id) return;
    if (!confirm(`Remove ${email} from this workspace?`)) return;
    const res = await fetch("/api/workspace/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: activeWorkspace.id, member_id: memberId }),
    });
    if (res.ok) fetchMembers();
  };

  // ── Change role ────────────────────────────────────────────────────────────
  const handleChangeRole = async (memberId: string, newRole: "admin" | "member", roleId?: string) => {
    if (!canManageUsers || !activeWorkspace?.id) return;
    const res = await fetch("/api/workspace/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        member_id: memberId,
        workspace_role: newRole,
        role_id: roleId || null,
      }),
    });
    if (res.ok) fetchMembers();
  };

  // ── Create custom role ─────────────────────────────────────────────────────
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !activeWorkspace?.id || !roleName.trim()) return;
    setRoleLoading(true);
    setRoleError("");
    setRoleSuccess("");

    const res = await fetch("/api/workspace/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: roleName.trim(),
        description: roleDesc.trim() || undefined,
        permissions: rolePerms,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setRoleError(json.error || "Failed to create role.");
    } else {
      setRoleSuccess(`Role "${roleName.trim()}" created!`);
      setRoleName(""); setRoleDesc("");
      setRolePerms(Object.fromEntries(PERMISSION_LABELS.map((p) => [p.key, false])));
      fetchRoles();
      setTimeout(() => setRoleSuccess(""), 4000);
    }
    setRoleLoading(false);
  };

  // ── Delete role ────────────────────────────────────────────────────────────
  const handleDeleteRole = async (roleId: string, name: string) => {
    if (!isOwner || !activeWorkspace?.id) return;
    if (!confirm(`Delete role "${name}"? Members using it will revert to base permissions.`)) return;
    const res = await fetch("/api/workspace/roles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: activeWorkspace.id, role_id: roleId }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    fetchRoles();
  };

  // ── Create workspace ───────────────────────────────────────────────────────
  const handleCreateNewWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !isOwner) return;
    setCreateWsLoading(true);
    const ws = await createWorkspace(newWsName.trim());
    if (ws) { setCreateWsSuccess(`Workspace "${newWsName}" created!`); setNewWsName(""); setTimeout(() => setCreateWsSuccess(""), 5000); }
    setCreateWsLoading(false);
  };

  if (!activeWorkspace) return null;

  const selectableRoles = roles.filter((r) => !r.is_system || r.name !== "Owner");

  return (
    <div className="space-y-6">
      {/* ── 1. WORKSPACE DETAILS ─────────────────────────────────────────── */}
      <Section icon={<Building className="h-5 w-5" />} title="Workspace Details" subtitle="Update name and workspace parameters">
        <form onSubmit={handleUpdateName} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-300">Workspace Name</Label>
            <div className="flex gap-3">
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                disabled={!canManageWorkspace || isSavingName}
                className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white"
              />
              {canManageWorkspace && (
                <Button type="submit" disabled={isSavingName || workspaceName.trim() === activeWorkspace.name}
                  className="bg-[#00aef0] hover:bg-[#008ec4] text-white shrink-0">
                  {isSavingName ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
            {saveNameSuccess && <p className="flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3 w-3" /> Saved!</p>}
            {!canManageWorkspace && <p className="text-[11px] text-slate-500 italic">Only owners and admins can rename workspaces.</p>}
          </div>
        </form>
      </Section>

      {/* ── 2. ROLES MANAGEMENT (owner only) ─────────────────────────────── */}
      {isOwner && (
        <Section icon={<Key className="h-5 w-5" />} title="Role Management" subtitle="Define custom roles with granular feature access">
          {/* Existing roles list */}
          <div className="space-y-2 mb-6">
            {roles.map((role) => (
              <div key={role.id} className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md ${role.is_system ? "bg-[#00aef0]/10 text-[#00aef0]" : "bg-violet-500/10 text-violet-400"}`}>
                      {role.is_system ? <Shield className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">{role.name}</p>
                      {role.description && <p className="text-xs text-slate-400">{role.description}</p>}
                    </div>
                    {role.is_system && (
                      <span className="text-[9px] uppercase tracking-widest font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">System</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!role.is_system && (
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); handleDeleteRole(role.id, role.name); }}
                        className="flex h-7 w-7 items-center justify-center rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {expandedRoleId === role.id
                      ? <ChevronDown className="h-4 w-4 text-slate-400" />
                      : <ChevronRight className="h-4 w-4 text-slate-400" />
                    }
                  </div>
                </button>

                {expandedRoleId === role.id && (
                  <div className="px-4 pb-4 border-t border-slate-800/50">
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PERMISSION_LABELS.map((p) => {
                        const enabled = role.permissions[p.key] === true;
                        return (
                          <div key={p.key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium ${enabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-900 text-slate-600 border border-slate-800"}`}>
                            {enabled ? <Check className="h-3 w-3 shrink-0" /> : <Lock className="h-3 w-3 shrink-0" />}
                            {p.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Create new role form */}
          <form onSubmit={handleCreateRole} className="space-y-5 max-w-2xl rounded-xl border border-dashed border-slate-700 p-5 bg-slate-950/30">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#00aef0]" /> Create Custom Role
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 font-medium">Role Name *</Label>
                <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Sales Agent" required
                  className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 font-medium">Description</Label>
                <Input value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="Optional description"
                  className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white text-sm" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Permissions</Label>
              {PERMISSION_GROUPS.map((group) => (
                <div key={group}>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{group}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PERMISSION_LABELS.filter((p) => p.group === group).map((p) => {
                      const checked = rolePerms[p.key] === true;
                      return (
                        <label key={p.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                          checked
                            ? "bg-[#00aef0]/10 border-[#00aef0]/30 text-[#00aef0]"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600"
                        }`}>
                          <input type="checkbox" checked={checked} onChange={(e) => setRolePerms({ ...rolePerms, [p.key]: e.target.checked })}
                            className="sr-only" />
                          <div className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${checked ? "bg-[#00aef0] border-[#00aef0]" : "border-slate-600"}`}>
                            {checked && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {roleError && <Alert variant="error">{roleError}</Alert>}
            {roleSuccess && <Alert variant="success">{roleSuccess}</Alert>}

            <Button type="submit" disabled={roleLoading || !roleName.trim()}
              className="bg-[#00aef0] hover:bg-[#008ec4] text-white font-medium shadow-md shadow-[#00aef0]/10">
              {roleLoading ? "Creating..." : "Create Role"}
            </Button>
          </form>
        </Section>
      )}

      {/* ── 3. TEAM MEMBERS ──────────────────────────────────────────────── */}
      <Section icon={<Users className="h-5 w-5" />} title="Team Members"
        subtitle="Manage who has access and their permissions"
        badge={activeRole ? <RoleBadge role={activeRole} /> : null}
      >
        {loadingMembers ? (
          <MembersSkeleton />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full border-collapse text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Permissions</th>
                  <th className="py-3 px-4">Joined</th>
                  {canManageUsers && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {members.map((member) => {
                  const isSelf = member.user_id === currentUser?.id;
                  const displayName = member.profile?.full_name || "Team Member";
                  const email = member.profile?.email || "—";
                  const roleName = member.custom_role?.name || member.role;

                  return (
                    <tr key={member.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            {member.profile?.avatar_url
                              ? <AvatarImage src={member.profile.avatar_url} alt={displayName} />
                              : null}
                            <AvatarFallback className="bg-[#00aef0]/10 text-xs font-semibold text-[#00aef0]">
                              {displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{displayName}</span>
                          {isSelf && <span className="text-[10px] bg-slate-800 text-slate-400 font-semibold px-1.5 py-0.5 rounded">You</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{email}</td>
                      <td className="py-3.5 px-4">
                        {canManageUsers && !isSelf && member.role !== "owner" ? (
                          <Select
                            value={member.role_id || member.role}
                            onValueChange={(val) => {
                              const foundRole = roles.find((r) => r.id === val);
                              const workspaceRole = foundRole
                                ? (foundRole.is_system && foundRole.name === "Admin" ? "admin" : "member")
                                : (val as "admin" | "member");
                              handleChangeRole(member.id, workspaceRole, foundRole?.id);
                            }}
                          >
                            <SelectTrigger className="w-36 h-8 bg-slate-950 border-slate-800 focus:ring-[#00aef0] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                              <SelectItem value="member" className="text-xs">Member</SelectItem>
                              {selectableRoles.map((r) => (
                                <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 capitalize text-xs font-semibold">
                            {member.role === "owner" && <Shield className="h-3 w-3 text-[#00aef0]" />}
                            {roleName}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {member.custom_role ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(member.custom_role.permissions)
                              .filter(([, v]) => v)
                              .slice(0, 3)
                              .map(([k]) => (
                                <span key={k} className="text-[10px] bg-[#00aef0]/10 text-[#00aef0] px-1.5 py-0.5 rounded font-medium capitalize">
                                  {k.replace(/_/g, " ")}
                                </span>
                              ))}
                            {Object.values(member.custom_role.permissions).filter(Boolean).length > 3 && (
                              <span className="text-[10px] text-slate-500">+{Object.values(member.custom_role.permissions).filter(Boolean).length - 3} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">System defaults</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs">{new Date(member.created_at).toLocaleDateString()}</td>
                      {canManageUsers && (
                        <td className="py-3.5 px-4 text-right">
                          {!isSelf && member.role !== "owner" ? (
                            <Button variant="ghost" size="icon"
                              onClick={() => handleRemoveMember(member.id, email)}
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── 4. ADD / CREATE USER (owner/admin) ────────────────────────────── */}
      {canManageUsers && (
        <Section icon={<UserPlus className="h-5 w-5" />} title="Add Team Member"
          subtitle={isOwner ? "Create a new account or add an existing user to this workspace" : "Add an existing user by email"}>
          {isOwner ? (
            <div className="max-w-2xl">
              <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 w-fit mb-5">
                {[
                  { key: "new", label: "Create New User" },
                  { key: "existing", label: "Add Existing User" },
                ].map(({ key, label }) => (
                  <button key={key} type="button"
                    onClick={() => setCreateTab(key as "new" | "existing")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      createTab === key
                        ? "bg-[#00aef0] text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >{label}</button>
                ))}
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                {createTab === "new" && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-300">Full Name</Label>
                    <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Jane Doe" required
                      className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-300">Email Address *</Label>
                    <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="agent@company.com" required
                      className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white" />
                  </div>

                  {createTab === "new" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-300">Password *</Label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Min 8 characters" required minLength={8}
                          className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-300">Workspace Role</Label>
                    <Select value={newUserWorkspaceRole} onValueChange={(v) => setNewUserWorkspaceRole(v as "admin" | "member")}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 focus:ring-[#00aef0] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-300">Custom Role (optional)</Label>
                    <Select value={newUserRoleId} onValueChange={(v) => setNewUserRoleId(v ?? "")}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 focus:ring-[#00aef0] text-white">
                        <SelectValue placeholder="Select role template..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="">None (use base role)</SelectItem>
                        {selectableRoles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {createError && <Alert variant="error">{createError}</Alert>}
                {createSuccess && <Alert variant="success">{createSuccess}</Alert>}

                <Button type="submit" disabled={createLoading}
                  className="bg-[#00aef0] hover:bg-[#008ec4] text-white font-medium shadow-md shadow-[#00aef0]/10">
                  {createLoading
                    ? "Processing..."
                    : createTab === "new" ? "Create & Add User" : "Add to Workspace"}
                </Button>
              </form>
            </div>
          ) : (
            /* Admin: add existing user only */
            <form onSubmit={handleCreateUser} className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-300">Email Address</Label>
                <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@company.com" required
                  className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white" />
              </div>
              {createError && <Alert variant="error">{createError}</Alert>}
              {createSuccess && <Alert variant="success">{createSuccess}</Alert>}
              <Button type="submit" disabled={createLoading}
                className="bg-[#00aef0] hover:bg-[#008ec4] text-white font-medium">
                {createLoading ? "Adding..." : "Add to Workspace"}
              </Button>
            </form>
          )}
        </Section>
      )}

      {/* ── 5. CREATE WORKSPACE (owner only) ─────────────────────────────── */}
      {isOwner && (
        <Section icon={<Briefcase className="h-5 w-5" />} title="Create Additional Workspace"
          subtitle="Launch a separate CRM tenant under your account">
          <form onSubmit={handleCreateNewWorkspace} className="space-y-4 max-w-lg">
            <div className="flex gap-3">
              <Input value={newWsName} onChange={(e) => setNewWsName(e.target.value)}
                placeholder="e.g. Enterprise Sales, Europe"
                className="bg-slate-950 border-slate-800 focus:border-[#00aef0] text-white" required />
              <Button type="submit" disabled={createWsLoading || !newWsName.trim()}
                className="bg-[#00aef0] hover:bg-[#008ec4] text-white shrink-0">
                {createWsLoading ? "Creating..." : "Create"}
              </Button>
            </div>
            {createWsSuccess && <p className="flex items-center gap-1.5 text-xs text-emerald-400"><Check className="h-3 w-3" /> {createWsSuccess}</p>}
          </form>
        </Section>
      )}

      {/* Read-only notice for members */}
      {!canManageUsers && !isOwner && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Read-only Access</p>
            <p className="text-xs text-slate-400 mt-1">Your current role does not include workspace management permissions. Contact your workspace owner or admin.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────
function Section({
  icon, title, subtitle, children, badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00aef0]/15 text-[#00aef0]">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="capitalize text-xs font-semibold text-[#00aef0] bg-[#00aef0]/10 px-2 py-0.5 rounded border border-[#00aef0]/20">
      {role}
    </span>
  );
}

function Alert({ variant, children }: { variant: "error" | "success"; children: React.ReactNode }) {
  const cls = variant === "error"
    ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  return (
    <p className={`text-xs font-medium p-2.5 rounded border flex items-center gap-1.5 ${cls}`}>
      {variant === "success" && <Check className="h-4 w-4 shrink-0" />}
      {children}
    </p>
  );
}

function MembersSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-slate-800/40" />
      ))}
    </div>
  );
}
