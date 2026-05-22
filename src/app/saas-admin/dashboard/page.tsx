"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  ShieldAlert, Users, Building, Activity, Search,
  UserCheck, UserX, Trash2, Check, RefreshCw, Shield,
  Plus, Eye, EyeOff, UserCog, Ban, AlertTriangle,
  Mail, Phone, MessageSquare, ChevronDown, ChevronUp,
  Inbox, TrendingUp, Building2, Clock, CheckCircle2,
  Star, ArrowUpRight, Filter, Tag, Flag
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

// ── Types ───────────────────────────────────────────────────────────────────
interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  system_role: string | null;
  status: string | null;
  created_at: string;
}

interface WorkspaceDetail {
  id: string;
  name: string;
  plan: string;
  plan_limits: Record<string, unknown> | null;
  created_at: string;
  member_count: number;
}

interface Prospect {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  phone: string | null;
  team_size: string | null;
  plan_interest: string;
  message: string | null;
  status: "new" | "contacted" | "converted";
  created_at: string;
}

interface DealSource {
  id: string;
  name: string;
  created_at: string;
}

interface DealLostReason {
  id: string;
  name: string;
  created_at: string;
}

// ── Plan constants ──────────────────────────────────────────────────────────
const GROWTH_LIMITS = {
  max_members: 20,
  max_workspaces: 2,
  max_storage_gb: 5,
  channels: ["whatsapp", "instagram", "messenger", "email"],
  max_automations: null,
};

const ALL_CHANNELS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "messenger", label: "Messenger" },
  { id: "email", label: "Email" },
];

const STATUS_CONFIG = {
  new: { label: "New", color: "text-sky-400", bg: "bg-sky-500/15", border: "border-sky-500/25", dot: "bg-sky-400" },
  contacted: { label: "Contacted", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/25", dot: "bg-amber-400" },
  converted: { label: "Converted", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/25", dot: "bg-emerald-400" },
};

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceDetail[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectFilter, setProspectFilter] = useState<"all" | "new" | "contacted" | "converted">("all");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeTab, setActiveTab] = useState<"tenants" | "prospects" | "sources" | "reasons">("tenants");
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null);

  // Global Config state
  const [sources, setSources] = useState<DealSource[]>([]);
  const [reasons, setReasons] = useState<DealLostReason[]>([]);
  const [newSourceName, setNewSourceName] = useState("");
  const [newReasonName, setNewReasonName] = useState("");
  const [isSubmittingSource, setIsSubmittingSource] = useState(false);
  const [isSubmittingReason, setIsSubmittingReason] = useState(false);

  // Create Owner form state
  const [showCreateOwner, setShowCreateOwner] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerOrg, setOwnerOrg] = useState("");
  const [showOwnerPass, setShowOwnerPass] = useState(false);
  const [createOwnerLoading, setCreateOwnerLoading] = useState(false);

  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState<"growth" | "custom">("growth");
  const [customLimits, setCustomLimits] = useState({
    max_members: 20,
    max_workspaces: 2,
    max_storage_gb: 5,
    channels: ["whatsapp", "instagram", "messenger", "email"],
    max_automations: "" as string | number | null,
  });

  // Danger zone
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  const showSuccess = (msg: string) => { setActionSuccess(msg); setTimeout(() => setActionSuccess(""), 6000); };
  const showError = (msg: string) => { setActionError(msg); setTimeout(() => setActionError(""), 6000); };

  // ── Fetch all data via admin API (bypasses RLS) ──────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setActionError("");
    try {
      const [res, sourcesRes, reasonsRes] = await Promise.all([
        fetch("/api/saas-admin/dashboard-data"),
        fetch("/api/saas-admin/deal-sources"),
        fetch("/api/saas-admin/lost-reasons")
      ]);
      
      if (!res.ok) {
        const j = await res.json();
        showError(j.error || "Failed to load dashboard data.");
        return;
      }
      const { profiles, workspaces: ws, prospects: pr, errors } = await res.json();
      setUsers(profiles || []);
      setWorkspaces(ws || []);
      setProspects(pr || []);
      if (errors?.workspaces) showError("Workspace error: " + errors.workspaces);
      
      if (sourcesRes.ok) setSources(await sourcesRes.json());
      if (reasonsRes.ok) setReasons(await reasonsRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && profile?.system_role === "super_admin") fetchData();
  }, [profile, authLoading, fetchData]);

  // ── Create Owner ───────────────────────────────────────────────────────
  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateOwnerLoading(true);
    try {
      const planLimits = selectedPlan === "custom"
        ? {
            max_members: Number(customLimits.max_members) || 20,
            max_workspaces: Number(customLimits.max_workspaces) || 2,
            max_storage_gb: Number(customLimits.max_storage_gb) || 5,
            channels: customLimits.channels,
            max_automations:
              customLimits.max_automations === "" || customLimits.max_automations === "unlimited"
                ? null
                : Number(customLimits.max_automations),
          }
        : GROWTH_LIMITS;

      const res = await fetch("/api/saas-admin/create-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: ownerName,
          email: ownerEmail,
          password: ownerPassword,
          org_name: ownerOrg,
          plan: selectedPlan,
          plan_limits: planLimits,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || "Failed to create owner."); return; }
      showSuccess(`Owner "${ownerEmail}" created on ${selectedPlan} plan with workspace "${ownerOrg}"!`);
      setOwnerName(""); setOwnerEmail(""); setOwnerPassword(""); setOwnerOrg("");
      setSelectedPlan("growth");
      setShowCreateOwner(false);
      fetchData();
    } finally { setCreateOwnerLoading(false); }
  };

  const toggleChannel = (ch: string) => {
    setCustomLimits(prev => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter(c => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  // ── User actions ──────────────────────────────────────────────────────
  const handleBlockUser = async (userId: string, currentStatus: string | null, email: string) => {
    const action = currentStatus === "blocked" ? "unblock" : "block";
    if (!confirm(`${action === "block" ? "Block" : "Unblock"} account for ${email}?`)) return;
    const res = await fetch(`/api/saas-admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) { showError(json.error); return; }
    showSuccess(`${email} is now ${json.status}.`);
    fetchData();
  };

  const handleToggleSystemRole = async (userId: string, currentRole: string | null, email: string) => {
    const nextRole = currentRole === "super_admin" ? "user" : "super_admin";
    if (email === profile?.email) { alert("You cannot modify your own system role."); return; }
    if (!confirm(`Change system role of ${email} to "${nextRole}"?`)) return;
    const { error } = await supabase.from("profiles").update({ system_role: nextRole }).eq("id", userId);
    if (error) { showError("Failed to update system role."); return; }
    showSuccess(`System role for ${email} set to "${nextRole}".`);
    fetchData();
  };

  const handleDeleteWorkspace = async (wsId: string, name: string) => {
    if (!confirm(`PERMANENTLY DELETE workspace "${name}"?\n\nAll contacts, conversations, pipelines, broadcasts, and automations for this tenant will be irreversibly deleted.`)) return;
    const res = await fetch(`/api/saas-admin/workspace?id=${wsId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      showError(json.error || "Failed to delete workspace.");
      return;
    }
    showSuccess(`Deleted workspace "${name}".`);
    fetchData();
  };

  const handleDeleteOwner = async (userId: string, email: string) => {
    if (!confirm(`PERMANENTLY DELETE owner account "${email}"?\n\nThis will delete all their workspaces, team members data, contacts, conversations, and CRM records. This action is IRREVERSIBLE.`)) return;
    const res = await fetch(`/api/saas-admin/users/${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (!res.ok) { showError(json.error || "Failed to delete owner."); return; }
    showSuccess(`Owner account "${email}" and all associated data deleted.`);
    fetchData();
  };

  // ── Delete all tenants ───────────────────────────────────────────────
  const handleDeleteAllTenants = async () => {
    if (deleteConfirmText !== "DELETE") { showError('Type "DELETE" to confirm.'); return; }
    setDeleteAllLoading(true);
    try {
      const res = await fetch("/api/saas-admin/tenants", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showError(json.error || "Failed to delete tenants."); return; }
      showSuccess(`Deleted ${json.deleted} tenant(s). Platform cleared.`);
      setDeleteConfirmText("");
      setShowDangerZone(false);
      fetchData();
    } finally { setDeleteAllLoading(false); }
  };

  // ── Update prospect status ───────────────────────────────────────────
  const handleProspectStatus = async (id: string, status: Prospect["status"]) => {
    const res = await fetch("/api/prospects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) { showError("Failed to update prospect status."); return; }
    setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    showSuccess("Prospect status updated.");
  };

  // ── Filtered lists ────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const t = userSearch.toLowerCase();
    return u.email.toLowerCase().includes(t) || (u.full_name?.toLowerCase().includes(t) ?? false);
  });
  const filteredWorkspaces = workspaces.filter(w =>
    w.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  );
  const filteredProspects = prospects
    .filter(p => prospectFilter === "all" || p.status === prospectFilter)
    .filter(p => {
      const t = prospectSearch.toLowerCase();
      return !t || p.email.toLowerCase().includes(t) || p.full_name.toLowerCase().includes(t) || p.company_name.toLowerCase().includes(t);
    });

  const newCount = prospects.filter(p => p.status === "new").length;
  const contactedCount = prospects.filter(p => p.status === "contacted").length;
  const convertedCount = prospects.filter(p => p.status === "converted").length;

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Delete this source? This will remove it globally.")) return;
    try {
      const res = await fetch(`/api/saas-admin/deal-sources?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete source");
      setSources(sources.filter(s => s.id !== id));
      showSuccess("Source deleted");
    } catch (error: any) {
      showError(error.message);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    setIsSubmittingSource(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('deal_sources').insert({ name: newSourceName.trim() }).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        setSources([data, ...sources]);
        setNewSourceName("");
        showSuccess("Source added");
      }
    } catch (err: any) {
      showError(err.message || "Failed to add source");
    } finally {
      setIsSubmittingSource(false);
    }
  };

  const handleDeleteReason = async (id: string) => {
    if (!confirm("Delete this lost reason? This will remove it globally.")) return;
    try {
      const res = await fetch(`/api/saas-admin/lost-reasons?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete reason");
      setReasons(reasons.filter(r => r.id !== id));
      showSuccess("Reason deleted");
    } catch (error: any) {
      showError(error.message);
    }
  };

  const handleAddReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReasonName.trim()) return;
    setIsSubmittingReason(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('deal_lost_reasons').insert({ name: newReasonName.trim() }).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        setReasons([data, ...reasons]);
        setNewReasonName("");
        showSuccess("Reason added");
      }
    } catch (err: any) {
      showError(err.message || "Failed to add reason");
    } finally {
      setIsSubmittingReason(false);
    }
  };

  return (
    <div className="space-y-7 pb-12 animate-in fade-in duration-300">
      <div className="absolute top-10 right-10 h-96 w-96 rounded-full bg-[#00aef0]/5 blur-[160px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#00aef0] uppercase tracking-widest mb-1.5">
            <Shield className="h-4 w-4 animate-pulse" /> Global Platform Admin Control
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">SaaS System Administrator</h1>
          <p className="text-sm text-slate-400 mt-1">Monitor tenants, manage owners, and review prospects.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowCreateOwner(!showCreateOwner)}
            className="bg-[#00aef0] hover:bg-[#008ec4] text-white font-semibold flex items-center gap-2 shadow-lg shadow-[#00aef0]/20">
            <Plus className="h-4 w-4" /> Create Owner
          </Button>
          <Button onClick={fetchData} disabled={loading}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#00aef0]" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Create Owner Panel */}
      {showCreateOwner && (
        <div className="rounded-xl border border-[#00aef0]/30 bg-[#00aef0]/5 p-6 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00aef0]/15 text-[#00aef0]">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create New Owner Account</h2>
              <p className="text-xs text-slate-400">Creates auth account + root workspace with plan limits</p>
            </div>
          </div>

          <form onSubmit={handleCreateOwner} className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Full Name *</Label>
                <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Jane Smith" required
                  className="bg-slate-950 border-slate-700 focus:border-[#00aef0] text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Organisation Name *</Label>
                <Input value={ownerOrg} onChange={e => setOwnerOrg(e.target.value)} placeholder="Acme Corp" required
                  className="bg-slate-950 border-slate-700 focus:border-[#00aef0] text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Email Address *</Label>
                <Input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="owner@acme.com" required
                  className="bg-slate-950 border-slate-700 focus:border-[#00aef0] text-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Password *</Label>
                <div className="relative">
                  <Input type={showOwnerPass ? "text" : "password"} value={ownerPassword}
                    onChange={e => setOwnerPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8}
                    className="bg-slate-950 border-slate-700 focus:border-[#00aef0] text-white text-sm pr-10" />
                  <button type="button" onClick={() => setShowOwnerPass(!showOwnerPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showOwnerPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Plan selector */}
            <div className="space-y-3">
              <Label className="text-xs text-slate-400 uppercase tracking-widest font-bold">Plan *</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["growth", "custom"] as const).map(p => (
                  <button key={p} type="button" onClick={() => setSelectedPlan(p)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedPlan === p
                        ? "border-[#00aef0] bg-[#00aef0]/10 text-white"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}>
                    <div className="font-bold text-sm">{p === "growth" ? "Growth — $20/mo" : "Custom Solution"}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {p === "growth" ? "20 members · 2 workspaces · All channels" : "Configure limits below"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedPlan === "growth" && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Growth Plan Limits (Fixed)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Team Members", value: "20" },
                    { label: "Workspaces", value: "2" },
                    { label: "Storage", value: "5 GB" },
                    { label: "Automations", value: "Unlimited" },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <div className="text-lg font-extrabold text-white">{item.value}</div>
                      <div className="text-[10px] text-slate-400">{item.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">Channels: WhatsApp · Instagram · Messenger · Email</p>
              </div>
            )}

            {selectedPlan === "custom" && (
              <div className="rounded-lg border border-[#00aef0]/20 bg-slate-950/60 p-4 space-y-4">
                <p className="text-xs font-bold text-[#00aef0] uppercase tracking-widest">Custom Plan Limits</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Max Members</Label>
                    <Input type="number" min={1} value={customLimits.max_members}
                      onChange={e => setCustomLimits(p => ({ ...p, max_members: Number(e.target.value) }))}
                      className="bg-slate-900 border-slate-700 text-white text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Max Workspaces</Label>
                    <Input type="number" min={1} value={customLimits.max_workspaces}
                      onChange={e => setCustomLimits(p => ({ ...p, max_workspaces: Number(e.target.value) }))}
                      className="bg-slate-900 border-slate-700 text-white text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Storage (GB)</Label>
                    <Input type="number" min={1} value={customLimits.max_storage_gb}
                      onChange={e => setCustomLimits(p => ({ ...p, max_storage_gb: Number(e.target.value) }))}
                      className="bg-slate-900 border-slate-700 text-white text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Max Automations</Label>
                    <Input placeholder="unlimited" value={customLimits.max_automations ?? ""}
                      onChange={e => setCustomLimits(p => ({ ...p, max_automations: e.target.value }))}
                      className="bg-slate-900 border-slate-700 text-white text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Allowed Channels</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CHANNELS.map(ch => (
                      <button key={ch.id} type="button" onClick={() => toggleChannel(ch.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          customLimits.channels.includes(ch.id)
                            ? "bg-[#00aef0]/15 border-[#00aef0]/40 text-[#00aef0]"
                            : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}>
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={createOwnerLoading}
                className="bg-[#00aef0] hover:bg-[#008ec4] text-white font-semibold">
                {createOwnerLoading ? "Creating..." : "Create Owner + Workspace"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreateOwner(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* Banners */}
      {actionSuccess && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400 text-sm animate-in slide-in-from-top duration-300">
          <Check className="h-5 w-5 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-rose-400 text-sm animate-in slide-in-from-top duration-300">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span className="font-semibold">{actionError}</span>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<Building className="h-5 w-5" />} label="Active Tenants" value={loading ? null : workspaces.length} sub="Total workspaces" accent="#00aef0" />
        <MetricCard icon={<Users className="h-5 w-5" />} label="Platform Users" value={loading ? null : users.length} sub="Registered accounts" accent="#a855f7" />
        <MetricCard icon={<Inbox className="h-5 w-5" />} label="Prospects" value={loading ? null : prospects.length}
          badge={newCount > 0 ? `${newCount} new` : undefined}
          sub="Sales submissions" accent="#10b981" />
        <MetricCard icon={<TrendingUp className="h-5 w-5" />} label="Converted" value={loading ? null : convertedCount} sub="Closed deals" accent="#f59e0b" />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-slate-900/60 border border-slate-800 rounded-xl w-fit flex-wrap">
        {([
          { key: "tenants", label: "Tenants & Users", icon: Building },
          { key: "prospects", label: `Prospects${newCount > 0 ? ` · ${newCount} new` : ""}`, icon: Inbox },
          { key: "sources", label: "Deal Sources", icon: Tag },
          { key: "reasons", label: "Lost Reasons", icon: Flag },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-[#00aef0] text-white shadow-lg shadow-[#00aef0]/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}>
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TENANTS TAB ── */}
      {activeTab === "tenants" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
          {/* Workspaces */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-6 flex flex-col h-[520px] shadow-lg">
            <div className="flex items-center justify-between gap-4 mb-5 shrink-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2"><Building className="h-4 w-4 text-[#00aef0]" /> Tenants Directory</h2>
                <p className="text-xs text-slate-400 mt-0.5">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} on platform</p>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <Input placeholder="Search..." value={workspaceSearch} onChange={e => setWorkspaceSearch(e.target.value)}
                  className="bg-slate-950 border-slate-800 pl-9 focus-visible:border-[#00aef0] h-8 text-xs text-white" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {loading ? <Skeleton /> : filteredWorkspaces.length === 0
                ? <Empty text="No workspaces found." />
                : filteredWorkspaces.map(ws => (
                  <div key={ws.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800/60 bg-slate-950/40 hover:border-slate-700 transition-all group">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-slate-200 group-hover:text-white truncate">{ws.name}</h4>
                        <PlanBadge plan={ws.plan} />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />{ws.member_count} member{ws.member_count !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{new Date(ws.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteWorkspace(ws.id, ws.name)}
                      className="text-rose-400/40 hover:text-rose-400 hover:bg-rose-500/10 h-8 w-8 rounded-lg border border-transparent hover:border-rose-500/20 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>

          {/* Users */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-6 flex flex-col h-[520px] shadow-lg">
            <div className="flex items-center justify-between gap-4 mb-5 shrink-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2"><Users className="h-4 w-4 text-[#00aef0]" /> User Privileges</h2>
                <p className="text-xs text-slate-400 mt-0.5">{users.length} account{users.length !== 1 ? "s" : ""} registered</p>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <Input placeholder="Search..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  className="bg-slate-950 border-slate-800 pl-9 focus-visible:border-[#00aef0] h-8 text-xs text-white" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {loading ? <Skeleton /> : filteredUsers.length === 0
                ? <Empty text="No users found." />
                : filteredUsers.map(u => {
                  const isSuperAdmin = u.system_role === "super_admin";
                  const isBlocked = u.status === "blocked";
                  const isCurrent = u.email === profile?.email;
                  const displayName = u.full_name || "CRM Member";
                  return (
                    <div key={u.id} className={`flex items-center justify-between p-3 rounded-xl border bg-slate-950/40 hover:bg-slate-950/70 transition-all group ${isBlocked ? "border-rose-500/20 opacity-60" : "border-slate-800/60 hover:border-slate-700"}`}>
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <Avatar className="h-8 w-8 shrink-0 border border-slate-800">
                          {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={displayName} /> : null}
                          <AvatarFallback className="bg-[#00aef0]/10 text-xs font-bold text-[#00aef0]">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-xs text-slate-200 truncate">{displayName}</h4>
                            {isCurrent && <span className="text-[8px] bg-slate-800 text-[#00aef0] px-1.5 py-0.5 rounded-full font-bold uppercase">You</span>}
                            {isBlocked && <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Blocked</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full border ${
                          isSuperAdmin ? "bg-[#00aef0]/15 text-[#00aef0] border-[#00aef0]/25" : "bg-slate-800 text-slate-500 border-slate-700"
                        }`}>{u.system_role || "user"}</span>
                        {!isCurrent && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleBlockUser(u.user_id, u.status, u.email)}
                              title={isBlocked ? "Unblock" : "Block"}
                              className={`h-7 w-7 rounded-lg border border-transparent ${
                                isBlocked ? "text-emerald-400 hover:bg-emerald-500/10" : "text-amber-400 hover:bg-amber-500/10"
                              }`}>
                              {isBlocked ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleSystemRole(u.id, u.system_role, u.email)}
                              title={isSuperAdmin ? "Demote" : "Promote"}
                              className={`h-7 w-7 rounded-lg border border-transparent ${
                                isSuperAdmin ? "text-amber-400 hover:bg-amber-500/10" : "text-[#00aef0] hover:bg-[#00aef0]/10"
                              }`}>
                              {isSuperAdmin ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </Button>
                            {!isSuperAdmin && (
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteOwner(u.user_id, u.email)}
                                title="Delete Account"
                                className="h-7 w-7 rounded-lg border border-transparent text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── PROSPECTS TAB ── */}
      {activeTab === "prospects" && (
        <div className="space-y-5">
          {/* Prospect Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "New Leads", count: newCount, status: "new" as const, icon: Inbox, desc: "Awaiting first contact" },
              { label: "Contacted", count: contactedCount, status: "contacted" as const, icon: MessageSquare, desc: "In conversation" },
              { label: "Converted", count: convertedCount, status: "converted" as const, icon: Star, desc: "Closed as clients" },
            ].map(s => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <button
                  key={s.status}
                  onClick={() => setProspectFilter(prospectFilter === s.status ? "all" : s.status)}
                  className={`relative overflow-hidden rounded-xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                    prospectFilter === s.status
                      ? `${cfg.bg} ${cfg.border} border`
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                      <p className={`text-3xl font-extrabold mt-1 ${prospectFilter === s.status ? cfg.color : "text-white"}`}>{s.count}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{s.desc}</p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.bg} ${cfg.color}`}>
                      <s.icon className="h-5 w-5" />
                    </div>
                  </div>
                  {prospectFilter === s.status && (
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${cfg.dot}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Prospects List */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden shadow-lg">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 p-5 border-b border-slate-800/60">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-white">Contact Sales Requests</h2>
                {prospectFilter !== "all" && (
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_CONFIG[prospectFilter].bg} ${STATUS_CONFIG[prospectFilter].color} ${STATUS_CONFIG[prospectFilter].border}`}>
                    {STATUS_CONFIG[prospectFilter].label}
                  </span>
                )}
                {prospectFilter !== "all" && (
                  <button onClick={() => setProspectFilter("all")}
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors">
                    Clear filter
                  </button>
                )}
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <Input placeholder="Search by name, email, company..." value={prospectSearch}
                  onChange={e => setProspectSearch(e.target.value)}
                  className="bg-slate-950 border-slate-800 pl-9 focus-visible:border-[#00aef0] h-8 text-xs text-white" />
              </div>
            </div>

            {/* Prospect rows */}
            {loading ? (
              <div className="p-6"><Skeleton /></div>
            ) : filteredProspects.length === 0 ? (
              <div className="p-16 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 border border-slate-800 mb-4">
                  <Inbox className="h-7 w-7 text-slate-600" />
                </div>
                <p className="text-slate-400 font-semibold">
                  {prospectFilter !== "all" ? `No ${prospectFilter} prospects` : "No prospects yet"}
                </p>
                <p className="text-slate-600 text-sm mt-1">
                  {prospectFilter !== "all"
                    ? "Try clearing the filter to see all prospects"
                    : "Submissions will appear here when someone fills the Contact Sales form"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {filteredProspects.map(p => {
                  const cfg = STATUS_CONFIG[p.status];
                  const isExpanded = expandedProspect === p.id;
                  const timeAgo = getTimeAgo(p.created_at);

                  return (
                    <div key={p.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Compact row */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        {/* Status dot */}
                        <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />

                        {/* Avatar + Name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${cfg.bg} ${cfg.color}`}>
                            {p.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-white truncate">{p.full_name}</span>
                              <span className="text-[10px] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full shrink-0">{p.company_name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-400 truncate">{p.email}</span>
                              {p.phone && <span className="text-[11px] text-slate-500">· {p.phone}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Plan badge */}
                        <PlanBadge plan={p.plan_interest} size="sm" />

                        {/* Team size */}
                        {p.team_size && (
                          <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                            <Users className="h-3 w-3" /> {p.team_size}
                          </span>
                        )}

                        {/* Time */}
                        <span className="hidden md:block text-[11px] text-slate-600 shrink-0 w-20 text-right">{timeAgo}</span>

                        {/* Status switcher */}
                        <div className="flex items-center gap-1 shrink-0">
                          {(["new", "contacted", "converted"] as Prospect["status"][]).map(s => {
                            const sc = STATUS_CONFIG[s];
                            return (
                              <button
                                key={s}
                                onClick={e => { e.stopPropagation(); if (p.status !== s) handleProspectStatus(p.id, s); }}
                                title={sc.label}
                                className={`h-6 w-6 rounded-full border transition-all flex items-center justify-center ${
                                  p.status === s
                                    ? `${sc.bg} ${sc.border} ${sc.color}`
                                    : "border-slate-700 text-slate-600 hover:border-slate-600 hover:text-slate-400"
                                }`}
                              >
                                <div className={`h-2 w-2 rounded-full ${p.status === s ? sc.dot : "bg-slate-700"}`} />
                              </button>
                            );
                          })}
                        </div>

                        {/* Expand toggle */}
                        <button
                          onClick={() => setExpandedProspect(isExpanded ? null : p.id)}
                          className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-5 pb-5 animate-in slide-in-from-top duration-150">
                          <div className="ml-12 pl-3 border-l border-slate-800 space-y-4">
                            {/* Contact details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <DetailItem icon={Mail} label="Email" value={p.email} link={`mailto:${p.email}`} />
                              <DetailItem icon={Phone} label="Phone" value={p.phone || "—"} link={p.phone ? `tel:${p.phone}` : undefined} />
                              <DetailItem icon={Users} label="Team Size" value={p.team_size || "—"} />
                              <DetailItem icon={Clock} label="Submitted" value={new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
                            </div>

                            {/* Message */}
                            {p.message && (
                              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Message</p>
                                <p className="text-sm text-slate-300 leading-relaxed">{p.message}</p>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-3">
                              <a href={`mailto:${p.email}?subject=Re: Daily CRM ${p.plan_interest === "custom" ? "Custom Solution" : "Growth Plan"} Inquiry`}
                                className="flex items-center gap-1.5 rounded-lg bg-[#00aef0]/10 hover:bg-[#00aef0]/20 border border-[#00aef0]/20 text-[#00aef0] px-3 py-1.5 text-xs font-semibold transition-all">
                                <Mail className="h-3.5 w-3.5" /> Reply via Email <ArrowUpRight className="h-3 w-3 opacity-60" />
                              </a>
                              <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DANGER ZONE ── */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 overflow-hidden">
        <button
          onClick={() => setShowDangerZone(!showDangerZone)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-rose-500/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <div>
              <h3 className="text-sm font-bold text-rose-400">Danger Zone</h3>
              <p className="text-xs text-slate-500">Destructive platform-wide operations</p>
            </div>
          </div>
          {showDangerZone ? <ChevronUp className="h-4 w-4 text-rose-400" /> : <ChevronDown className="h-4 w-4 text-rose-400" />}
        </button>
        {showDangerZone && (
          <div className="border-t border-rose-500/20 p-5 space-y-4 animate-in slide-in-from-top duration-200">
            <div>
              <h4 className="text-sm font-bold text-rose-400 mb-1">Delete All Tenants</h4>
              <p className="text-xs text-slate-400 mb-4">
                Permanently deletes ALL non-admin owner accounts, their workspaces, members, contacts, conversations, and all associated CRM data.
                The SaaS admin account will not be affected.{" "}
                <strong className="text-rose-400">This cannot be undone.</strong>
              </p>
              <div className="flex items-center gap-3">
                <Input
                  placeholder='Type "DELETE" to confirm'
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  className="bg-slate-950 border-rose-500/30 text-white focus:border-rose-500 text-sm max-w-xs"
                />
                <Button
                  onClick={handleDeleteAllTenants}
                  disabled={deleteConfirmText !== "DELETE" || deleteAllLoading}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteAllLoading ? "Deleting..." : "Delete All Tenants"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SOURCES TAB ── */}
      {activeTab === "sources" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Tag className="h-6 w-6 text-[#00aef0]" />
              Deal Sources
            </h2>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/50">
              <form onSubmit={handleAddSource} className="flex items-end gap-3 max-w-lg">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs text-slate-400">New Deal Source</Label>
                  <Input 
                    placeholder="e.g. Inbound, Outbound, Referral" 
                    value={newSourceName} 
                    onChange={e => setNewSourceName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
                <Button type="submit" disabled={isSubmittingSource || !newSourceName.trim()} className="bg-[#00aef0] hover:bg-[#009bd6] text-white">
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </form>
            </div>
            {sources.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No deal sources found.</div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {sources.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                        <Tag className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="text-sm font-medium text-white">{s.name}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSource(s.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LOST REASONS TAB ── */}
      {activeTab === "reasons" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Flag className="h-6 w-6 text-rose-500" />
              Lost Reasons
            </h2>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/50">
              <form onSubmit={handleAddReason} className="flex items-end gap-3 max-w-lg">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs text-slate-400">New Lost Reason</Label>
                  <Input 
                    placeholder="e.g. Price too high, Timing, Competitor" 
                    value={newReasonName} 
                    onChange={e => setNewReasonName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
                <Button type="submit" disabled={isSubmittingReason || !newReasonName.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </form>
            </div>
            {reasons.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No lost reasons found.</div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {reasons.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-4 hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                        <Flag className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="text-sm font-medium text-white">{r.name}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteReason(r.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────

function PlanBadge({ plan, size = "md" }: { plan: string; size?: "sm" | "md" }) {
  const isCustom = plan === "custom";
  const base = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[9px] px-2 py-0.5";
  return (
    <span className={`${base} font-bold uppercase tracking-wider rounded-full border shrink-0 ${
      isCustom
        ? "bg-purple-500/15 text-purple-400 border-purple-500/25"
        : "bg-[#00aef0]/10 text-[#00aef0] border-[#00aef0]/20"
    }`}>
      {isCustom ? "Custom" : "Growth"}
    </span>
  );
}

function DetailItem({ icon: Icon, label, value, link }: { icon: any; label: string; value: string; link?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">{label}</p>
      {link ? (
        <a href={link} className="text-xs text-[#00aef0] hover:underline flex items-center gap-1">
          <Icon className="h-3 w-3" /> {value}
        </a>
      ) : (
        <p className="text-xs text-slate-300 flex items-center gap-1"><Icon className="h-3 w-3 text-slate-600" /> {value}</p>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, text, sub, accent, badge }: {
  icon: React.ReactNode; label: string; value: number | null;
  text?: string; sub: string; accent: string; badge?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-all group">
      <div className="absolute top-0 right-0 h-20 w-20 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: accent + "08" }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
            {badge && <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/25">{badge}</span>}
          </div>
          <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-white">
            {value === null
              ? (text || <div className="h-7 w-12 bg-slate-800 animate-pulse rounded" />)
              : value}
          </h3>
          <p className="text-[10px] text-slate-600 mt-1">{sub}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-slate-900/60 border border-slate-800" />)}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
        <Inbox className="h-5 w-5 text-slate-700" />
      </div>
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
