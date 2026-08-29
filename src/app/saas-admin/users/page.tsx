"use client";

import { useState } from "react";
import { Users, MonitorSmartphone, ShieldOff, Shield, KeyRound, KeySquare, LogOut, Lock, Unlock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  ConsoleCard,
  LoadingRow,
  Pager,
  SearchBox,
  useConsoleData,
} from "@/components/saas-admin/console-ui";
import { NativeSelect } from "@/components/ui/native-select";

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string;
  status: string | null;
  system_role: string | null;
  single_workspace_only?: boolean;
  created_at: string;
  workspaces: { id: string; name: string; role: string }[];
  activeSession: { last_seen_at: string; user_agent: string | null } | null;
}

interface UserList {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, reload } = useConsoleData<UserList>(
    `/api/saas-admin/users/list?q=${encodeURIComponent(q)}&status=${status}&page=${page}`,
  );

  const act = async (userId: string, body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(userId);
    try {
      const res = await fetch(`/api/saas-admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      toast.success("Done");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  // Separate from act(): the response carries a one-time credential that
  // must be surfaced, not swallowed by a generic "Done" toast. The
  // pre-filled prompt doubles as the copy surface (matches the
  // type-to-confirm prompt used for deletes).
  const setRandomPassword = async (u: UserRow) => {
    if (
      !window.confirm(
        `Set a NEW random password for ${u.email}? Their devices will be signed out and the old password stops working immediately.`,
      )
    )
      return;
    setBusy(u.user_id);
    try {
      const res = await fetch(`/api/saas-admin/users/${u.user_id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_password" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      window.prompt(
        `New password for ${u.email} — copy it now, it is shown only once:`,
        json.password as string,
      );
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Users
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Name or email…" />
          <NativeSelect
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </NativeSelect>
        </div>
      </div>

      <ConsoleCard>
        {loading && !data ? (
          <LoadingRow label="Loading users…" />
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2.5 pr-4">User</th>
                    <th className="pb-2.5 pr-4">Workspaces</th>
                    <th className="pb-2.5 pr-4">Device</th>
                    <th className="pb-2.5 pr-4">Status</th>
                    <th className="pb-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.users ?? []).map((u) => {
                    const blocked = u.status === "blocked";
                    const isAdmin = u.system_role === "super_admin";
                    return (
                      <tr key={u.user_id} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                        <td className="py-3 pr-4">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            {u.full_name ?? "—"}
                            {isAdmin && <Badge tone="info">admin</Badge>}
                            {u.single_workspace_only && <Badge tone="warn">1 workspace</Badge>}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">{u.email}</span>
                        </td>
                        <td className="py-3 pr-4">
                          {u.workspaces.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.workspaces.slice(0, 3).map((w) => (
                                <Badge key={w.id} tone="neutral">{w.name} · {w.role}</Badge>
                              ))}
                              {u.workspaces.length > 3 && (
                                <Badge tone="neutral">+{u.workspaces.length - 3}</Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {u.activeSession ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-400"
                              title={u.activeSession.user_agent ?? undefined}
                            >
                              <MonitorSmartphone className="h-3.5 w-3.5" />
                              {new Date(u.activeSession.last_seen_at).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Signed out</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={blocked ? "bad" : "good"}>{blocked ? "blocked" : "active"}</Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.activeSession && (
                              <IconButton
                                title="Sign out of all devices"
                                disabled={busy === u.user_id}
                                onClick={() => act(u.user_id, { action: "revoke_sessions" })}
                              >
                                <LogOut className="h-3.5 w-3.5" />
                              </IconButton>
                            )}
                            <IconButton
                              title={u.single_workspace_only
                                ? "Allow joining multiple workspaces"
                                : "Restrict to one workspace"}
                              disabled={busy === u.user_id}
                              onClick={() =>
                                act(
                                  u.user_id,
                                  {
                                    action: "set_single_workspace",
                                    single_workspace_only: !u.single_workspace_only,
                                  },
                                  u.single_workspace_only
                                    ? `Allow ${u.email} to join multiple workspaces again?`
                                    : `Restrict ${u.email} to a single workspace? Existing memberships are kept; new joins are blocked.`,
                                )
                              }
                            >
                              {u.single_workspace_only
                                ? <Lock className="h-3.5 w-3.5 text-amber-400" />
                                : <Unlock className="h-3.5 w-3.5" />}
                            </IconButton>
                            <IconButton
                              title="Send password reset"
                              disabled={busy === u.user_id}
                              onClick={() =>
                                act(u.user_id, { action: "send_password_reset" },
                                  `Send a password reset link to ${u.email}?`)
                              }
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton
                              title="Set a new random password"
                              disabled={busy === u.user_id}
                              onClick={() => setRandomPassword(u)}
                            >
                              <KeySquare className="h-3.5 w-3.5 text-amber-400" />
                            </IconButton>
                            {!isAdmin && (
                              <IconButton
                                title="Delete account permanently"
                                tone="bad"
                                disabled={busy === u.user_id}
                                onClick={() => {
                                  // Browser prompt as the type-to-confirm
                                  // surface; the API re-checks the email
                                  // match, so bypassing this UI gains
                                  // nothing.
                                  const typed = window.prompt(
                                    `Delete ${u.email} permanently?\n\nTheir memberships and profile are removed and they can no longer sign in. Type the email exactly to confirm:`,
                                  );
                                  if (typed === null) return;
                                  act(u.user_id, { action: "delete_user", confirm_email: typed });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </IconButton>
                            )}
                            <IconButton
                              title={blocked ? "Unblock" : "Block"}
                              tone={blocked ? "good" : "bad"}
                              disabled={busy === u.user_id}
                              onClick={() =>
                                act(
                                  u.user_id,
                                  { action: "set_status", status: blocked ? "active" : "blocked" },
                                  blocked
                                    ? `Unblock ${u.email}?`
                                    : `Block ${u.email}? They are signed out immediately and cannot sign back in.`,
                                )
                              }
                            >
                              {blocked ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(data?.users ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No users match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </ConsoleCard>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "good" | "bad";
}) {
  const toneCls =
    tone === "bad"
      ? "hover:border-rose-500 hover:text-rose-400"
      : tone === "good"
        ? "hover:border-emerald-500 hover:text-emerald-400"
        : "hover:border-primary hover:text-primary";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border border-border p-2 text-muted-foreground transition-colors disabled:opacity-40 ${toneCls}`}
    >
      {children}
    </button>
  );
}
