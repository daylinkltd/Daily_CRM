'use client';

// ============================================================
// MembersTab — Settings → Members
//
// Two stacked sections:
//   1. Roster   — every member of the account. Admin+ can change a
//                 teammate's role inline and remove them. Owner row
//                 is non-editable everywhere (transfer is its own
//                 separate flow, deferred to a later PR).
//   2. Pending  — outstanding invite links. Admin+ can revoke. The
//                 plaintext URL is gone after the create dialog
//                 closes, so we surface a "revoke + new link" hint
//                 rather than pretending we can resurface it.
//
// Role-gating
//   The tab itself is reachable by any member; the mutation controls
//   need `canManageMembers` — owner/admin by role, or any role the
//   owner has granted Team & Access (`team_members:*`) in the matrix.
//   Everyone else sees the roster read-only. The member APIs check the
//   same permission, so this only decides what is on screen.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  MailX,
  Plus,
  Trash2,
  UsersRound,
} from 'lucide-react';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { usePresence } from '@/hooks/use-presence';
import type { AccountRole } from '@/lib/auth/roles';
import { presenceLabel, summarize } from '@/lib/presence';
import {
  PRESENCE_DOT_CLASS,
  PresenceDot,
} from '@/components/presence/presence-dot';
import { createClient } from '@/lib/supabase/client';
import { InviteMemberDialog } from './invite-member-dialog';
import { WorkspaceAccessPanel } from './workspace-access-panel';
import { useWorkspace } from '@/hooks/use-workspace';
import { SettingsPanelHead } from './settings-panel-head';
import { ROLE_META } from './role-meta';
import {
  builtInRoleNameForEnum,
  enumRoleForRoleName,
  sortRoles,
  WORKSPACE_ROLE_COLUMNS,
  type WorkspaceRoleRow,
} from './workspace-role';
import { IconAction } from "@/components/ui/icon-action";

interface Member {
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  /** Legacy enum role — still written for compatibility. */
  role: AccountRole;
  /** The assigned `workspace_roles` row, or null for the enum default. */
  role_id: string | null;
  role_name: string | null;
  joined_at: string;
}

interface Invitation {
  id: string;
  role: 'admin' | 'agent' | 'viewer';
  label: string | null;
  created_at: string;
  expires_at: string;
}

// The inline dropdown lists every `workspace_roles` row for the active
// workspace (built-ins + custom), not the old hardcoded enum. The built-in
// Owner row is excluded — promotions go through the (deferred) Transfer
// Ownership flow, and the API refuses to assign it anyway.
//
// Per-role chip metadata (icon / label / colour) lives in the shared
// ROLE_META module so this roster and the Overview identity chip can't
// drift. The colour scale runs amber (owner — scarce, immutable) →
// primary (admin) → muted (agent / viewer).

function fmtDate(iso: string): string {
  // Match the rest of the dashboard's locale-light formatting.
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtExpiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `expires in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return `expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function MembersTab() {
  const { user, accountId, accountRole, canManageMembers: canManageByRole } = useAuth();
  const { getPresence, getRow, now } = usePresence();
  const { activeWorkspace, can } = useWorkspace();
  // Owner/admin by role, OR any role granted Team & Access in the
  // matrix — that is the point of the permission. The member APIs
  // check the same thing, so this only decides what is on screen.
  const canManageMembers = canManageByRole || can('manage_users');
  const supabase = createClient();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<WorkspaceRoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  // Password dialog. `pwGenerated` holds a server-minted credential for
  // the one render it is ever visible in — it is never persisted.
  const [passwordMember, setPasswordMember] = useState<Member | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwGenerated, setPwGenerated] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);
  const [pendingMemberAction, setPendingMemberAction] = useState<string | null>(
    null,
  );

  const loadEverything = useCallback(async () => {
    try {
      const targetWorkspaceId = activeWorkspace?.id || accountId;
      const membersUrl = targetWorkspaceId
        ? `/api/account/members?workspace_id=${targetWorkspaceId}`
        : '/api/account/members';
      const invitesUrl = targetWorkspaceId
        ? `/api/account/invitations?workspace_id=${targetWorkspaceId}`
        : '/api/account/invitations';

      const [mres, ires, rolesRes] = await Promise.all([
        fetch(membersUrl, { cache: 'no-store' }),
        canManageMembers
          ? fetch(invitesUrl, { cache: 'no-store' })
          : Promise.resolve(null),
        // Roles for the ACTIVE workspace only — RLS scopes the table and
        // the filter makes it explicit, so another tenant's roles can
        // never reach the dropdown.
        accountId
          ? supabase
              .from('workspace_roles')
              .select(WORKSPACE_ROLE_COLUMNS)
              .eq('workspace_id', accountId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (rolesRes && !rolesRes.error) {
        setRoles(sortRoles((rolesRes.data ?? []) as WorkspaceRoleRow[]));
      }

      if (!mres.ok) {
        const payload = await mres.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to load members');
        return;
      }
      const mdata = (await mres.json()) as { members: Member[] };
      setMembers(mdata.members);

      if (ires) {
        if (!ires.ok) {
          const payload = await ires.json().catch(() => ({}));
          toast.error(payload.error || 'Failed to load invitations');
          return;
        }
        const idata = (await ires.json()) as { invitations: Invitation[] };
        setInvitations(idata.invitations);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      console.error('[MembersTab] load error:', err);
      toast.error('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [canManageMembers, accountId, supabase]);

  useEffect(() => {
    void loadEverything();
  }, [loadEverything]);

  // Every workspace role except the built-in Owner — assigning that one
  // would hand out the owner bypass, so promotions stay in the
  // transfer-ownership flow (the API rejects it too).
  const assignableRoles = useMemo(
    () => roles.filter((r) => !(r.is_system && r.name === 'Owner')),
    [roles],
  );

  /**
   * Assign a `workspace_roles` row to a member. We send BOTH the new
   * `role_id` (what the CRUD matrix consults) and the matching legacy
   * enum `role`, so everything still reading the enum — the sidebar
   * gates, `RequireRole`, the owner/admin DB bypass — stays coherent.
   */
  async function handleRoleChange(member: Member, nextRoleId: string) {
    if (member.role_id === nextRoleId) return;
    const target = roles.find((r) => r.id === nextRoleId);
    if (!target) return;
    const nextRole = enumRoleForRoleName(target.name);

    // Optimistic update — flip the dropdown immediately so the UI
    // feels snappy. If the server PATCH fails we revert below so
    // the dropdown doesn't lie about the persisted state.
    const previous = {
      role: member.role,
      role_id: member.role_id,
      role_name: member.role_name,
    };
    setPendingMemberAction(member.user_id);
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === member.user_id
          ? {
              ...m,
              role: nextRole,
              role_id: target.id,
              role_name: target.name,
            }
          : m,
      ),
    );
    try {
      const targetWorkspaceId = activeWorkspace?.id || accountId;
      const patchUrl = targetWorkspaceId
        ? `/api/account/members/${member.user_id}?workspace_id=${targetWorkspaceId}`
        : `/api/account/members/${member.user_id}`;
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole, role_id: target.id }),
      });
      if (!res.ok) {
        // Revert the optimistic flip. The toast on its own wasn't
        // enough — the dropdown was left showing the new role
        // forever, so the next interaction operated on a wrong
        // baseline (re-trying the same change would no-op via the
        // `member.role === nextRole` guard at the top).
        setMembers((prev) =>
          prev.map((m) =>
            m.user_id === member.user_id ? { ...m, ...previous } : m,
          ),
        );
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to update role');
        return;
      }
      toast.success(`Updated ${member.full_name || 'member'} to ${target.name}`);
    } catch (err) {
      // Same revert on network failure.
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id ? { ...m, ...previous } : m,
        ),
      );
      console.error('[MembersTab] role change error:', err);
      toast.error('Could not reach the server');
    } finally {
      setPendingMemberAction(null);
    }
  }

  async function handleRemove() {
    if (!removingMember) return;
    setPendingMemberAction(removingMember.user_id);
    try {
      const targetWorkspaceId = activeWorkspace?.id || accountId;
      const deleteUrl = targetWorkspaceId
        ? `/api/account/members/${removingMember.user_id}?workspace_id=${targetWorkspaceId}`
        : `/api/account/members/${removingMember.user_id}`;
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to remove member');
        return;
      }
      toast.success(`Removed ${removingMember.full_name || 'member'}`);
      setMembers((prev) =>
        prev.filter((m) => m.user_id !== removingMember.user_id),
      );
      setRemovingMember(null);
    } catch (err) {
      console.error('[MembersTab] remove error:', err);
      toast.error('Could not reach the server');
    } finally {
      setPendingMemberAction(null);
    }
  }

  async function handleRevoke(invite: Invitation) {
    try {
      const res = await fetch(`/api/account/invitations/${invite.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to revoke invitation');
        return;
      }
      toast.success('Invitation revoked');
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      console.error('[MembersTab] revoke error:', err);
      toast.error('Could not reach the server');
    }
  }

  function openPasswordDialog(member: Member) {
    setPwValue('');
    setPwError(null);
    setPwGenerated(null);
    setPwCopied(false);
    setPasswordMember(member);
  }

  /** set | generate | email_reset — all through one server route that
   *  re-checks rank, so this UI gating is convenience, not security. */
  async function handlePassword(mode: 'set' | 'generate' | 'email_reset') {
    if (!passwordMember || !accountId) return;
    if (mode === 'set' && pwValue.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    setPwBusy(true);
    setPwError(null);
    try {
      const res = await fetch('/api/workspace/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: accountId,
          user_id: passwordMember.user_id,
          mode,
          ...(mode === 'set' ? { password: pwValue } : {}),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(payload.error || 'Failed to update password');
        return;
      }
      if (mode === 'email_reset') {
        toast.success(`Reset link emailed to ${passwordMember.email}`);
        setPasswordMember(null);
      } else if (mode === 'generate') {
        // Stay open: this is the only moment the credential exists
        // outside the hash. The admin copies it here or never.
        setPwGenerated(payload.password as string);
      } else {
        toast.success(
          `Password updated for ${passwordMember.full_name || 'member'} — their devices were signed out`,
        );
        setPasswordMember(null);
      }
    } catch (err) {
      console.error('[MembersTab] password error:', err);
      setPwError('Could not reach the server');
    } finally {
      setPwBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="Team members"
        description="People with access to this account. Roles control what each teammate can do."
        action={
          canManageMembers ? (
            <IconAction label="Invite member" icon={<Plus className="size-4" />} onClick={() => setInviteOpen(true)} />
          ) : null
        }
      />

      {/* Seats. Members ARE the billing unit, so the roster page says so
          plainly: how many seats exist, how many are filled, and where to
          buy more when they are gone. Buried in a dialog, the seat wall
          reads as a bug; stated here, it reads as the plan working. */}
      {(() => {
        const limits = (activeWorkspace?.plan_limits ?? {}) as {
          max_members?: number | null;
        };
        const seatMax = Number(limits.max_members) || null;
        if (!seatMax || seatMax >= 999999) return null;
        const used = members.length;
        const full = used >= seatMax;
        return (
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
              full ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-background/40'
            }`}
          >
            <div className="min-w-0">
              <span className="block text-sm font-bold text-foreground">
                {used} of {seatMax} seats in use
              </span>
              <span className="block text-xs text-muted-foreground">
                {full
                  ? 'Every paid seat is taken. Add seats to invite more people.'
                  : `${seatMax - used} seat${seatMax - used === 1 ? '' : 's'} free.`}
              </span>
              <div className="mt-2 h-1.5 w-48 max-w-full rounded-full bg-card">
                <div
                  className={`h-1.5 rounded-full ${full ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, Math.round((used / seatMax) * 100))}%` }}
                />
              </div>
            </div>
            {full && canManageMembers && (
              <Button
                onClick={() => {
                  window.location.href = '/settings?tab=billing';
                }}
                className="bg-primary font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Add seats
              </Button>
            )}
          </div>
        );
      })()}

      {/* Live presence summary across the roster. Updates without a
          full refresh as heartbeats and the local re-derive tick land. */}
      {members.length > 0 &&
        (() => {
          const counts = summarize(members.map((m) => getPresence(m.user_id)));
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <PresenceDot status="online" />
                {counts.online} online
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PresenceDot status="away" />
                {counts.away} away
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PresenceDot status="offline" />
                {counts.offline} offline
              </span>
              <span className="text-muted-foreground/70">
                · {members.length} member{members.length === 1 ? '' : 's'}
              </span>
            </div>
          );
        })()}

      {/* Roster */}
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {members.map((member) => {
              const roleMeta = ROLE_META[member.role];
              const RoleIcon = roleMeta.icon;
              const isSelf = member.user_id === user?.id;
              const isOwnerRow = member.role === 'owner';
              const isBusy = pendingMemberAction === member.user_id;
              const presence = getPresence(member.user_id);
              const presenceRow = getRow(member.user_id);
              const presenceText = presenceLabel(
                presence,
                presenceRow?.last_seen_at ?? null,
                now,
              );

              // Members created before `role_id` existed fall back to the
              // built-in role their enum value maps to, so the dropdown
              // isn't blank for them.
              const fallbackName = builtInRoleNameForEnum(member.role);
              const selectedRoleId =
                member.role_id ??
                roles.find((r) => r.is_system && r.name === fallbackName)?.id ??
                '';
              const displayRoleName =
                member.role_name ?? fallbackName ?? roleMeta.label;

              return (
                <li
                  key={member.user_id}
                  // Mobile: stack identity (avatar+name+email) above the
                  // role/remove actions so the role dropdown's fixed
                  // 128px width doesn't force the name into a 50-pixel
                  // truncation. Desktop (sm+): everything inline as
                  // before.
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Avatar className="size-9 shrink-0">
                            {member.avatar_url ? (
                              <AvatarImage
                                src={member.avatar_url}
                                alt={member.full_name || 'Member'}
                              />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                              {(member.full_name || member.email || 'U')
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                            {/* role+label so screen readers announce
                                presence — the hover tooltip alone isn't
                                reachable by keyboard/AT on a non-focusable
                                avatar. */}
                            <AvatarBadge
                              role="img"
                              aria-label={presenceText}
                              className={PRESENCE_DOT_CLASS[presence]}
                            />
                          </Avatar>
                        }
                      />
                      <TooltipContent>{presenceText}</TooltipContent>
                    </Tooltip>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {member.full_name || 'Unnamed'}
                        </span>
                        {isSelf && (
                          <Badge className="bg-muted text-muted-foreground border-border text-[10px] uppercase tracking-wide">
                            You
                          </Badge>
                        )}
                      </div>
                      {member.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Joined date stays desktop-only. The mobile row's
                      vertical density makes the joined date noise. */}
                  <div className="hidden sm:block text-right text-xs text-muted-foreground">
                    Joined {fmtDate(member.joined_at)}
                  </div>

                  {/* Actions cluster. On mobile this is its own row
                      below the identity block; on desktop it sits
                      inline. Items align to the start on mobile so the
                      role dropdown lines up under the avatar. */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Role display / editor. Inline Select is admin+
                        only AND not allowed on the owner row (owner
                        changes go through transfer, which lands later).
                        Options come from `workspace_roles`, so a custom
                        role created in Settings → Roles is assignable
                        here immediately. */}
                    {canManageMembers &&
                    !isOwnerRow &&
                    !isSelf &&
                    assignableRoles.length > 0 ? (
                      <Select
                        value={selectedRoleId}
                        onValueChange={(v) =>
                          // Base UI Select can emit null on clear. We
                          // don't expose a clear affordance, so the
                          // guard is defensive — but the typed
                          // signature requires it.
                          v && handleRoleChange(member, v as string)
                        }
                      >
                        <SelectTrigger
                          className="w-40 bg-muted border-border text-foreground"
                          disabled={isBusy}
                        >
                          <SelectValue placeholder="No role assigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${roleMeta.className}`}
                      >
                        <RoleIcon className="size-3.5" />
                        {displayRoleName}
                      </span>
                    )}

                    {/* Remove. Admin+ only; never on the owner row;
                        never on yourself. Pre-polish styling was
                        neutral-default + red-on-hover — the
                        destructive intent was invisible until the
                        user moused over. Now red is the default
                        state with a darker shade on hover so the
                        affordance reads at-a-glance. */}
                    {/* Password control. Rank-gated like the server:
                        the owner reaches everyone below them, an admin
                        only members/viewers. The route re-checks. */}
                    {canManageMembers &&
                      !isOwnerRow &&
                      !isSelf &&
                      (accountRole === 'owner' || member.role !== 'admin') && (
                        <IconAction
                          label="Password"
                          icon={<KeyRound className="size-4" />}
                          variant="outline"
                          onClick={() => openPasswordDialog(member)}
                          disabled={isBusy}
                        />
                      )}

                    {canManageMembers && !isOwnerRow && !isSelf && (
                      <IconAction
                        label="Delete"
                        icon={<Trash2 className="size-4" />}
                        variant="outline"
                        onClick={() => setRemovingMember(member)}
                        disabled={isBusy}
                        className="border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-200"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Pending invitations — admin+ only */}
      {canManageMembers && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <UsersRound className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Pending invitations
            </h3>
            <Badge className="bg-muted text-muted-foreground border-border">
              {invitations.length}
            </Badge>
          </div>
          {/* P10 — make the no-resend design explicit. Admins were
              confused why the pending list shows roles + expiry but
              no "copy link again" button. Stating the constraint up
              front (rather than letting the user discover it by
              looking for a button) keeps it from feeling like a bug. */}
          {invitations.length > 0 ? (
            <p className="mb-3 text-xs text-muted-foreground">
              The plaintext invite URL is only shown once at creation
              for security — to re-share, revoke the invite below and
              create a new one.
            </p>
          ) : null}

          {invitations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Mail className="size-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No pending invitations.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click <span className="text-muted-foreground">Invite member</span>{' '}
                  above to generate a shareable link.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {invitations.map((inv) => {
                    const inviteRoleMeta = ROLE_META[inv.role];
                    const InviteRoleIcon = inviteRoleMeta.icon;
                    return (
                    <li
                      key={inv.id}
                      className="flex items-center gap-4 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {inv.label || 'Untitled invite'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${inviteRoleMeta.className}`}
                          >
                            <InviteRoleIcon className="size-3" />
                            {inviteRoleMeta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Created {fmtDate(inv.created_at)} · {fmtExpiresIn(inv.expires_at)}
                        </p>
                      </div>

                      {/* Revoke: red default state, mirrors the
                          members-tab Remove button. Pre-polish version
                          read as a neutral secondary button until
                          hover. */}
                      <IconAction label="Revoke" icon={<MailX className="size-4" />} variant="outline"
                        onClick={() => handleRevoke(inv)}
                        className="border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-200" />
                    </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Cross-workspace access. Renders nothing unless the viewer owns
          more than one workspace. */}
      <WorkspaceAccessPanel />

      {/* Password dialog — set a chosen password, mint a random one, or
          fall back to the email flow. A generated credential is shown
          exactly once. */}
      <Dialog
        open={passwordMember !== null}
        onOpenChange={(open) => {
          if (!open) setPasswordMember(null);
        }}
      >
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-popover-foreground">
              <KeyRound className="size-4 text-primary" />
              Change password
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {passwordMember?.full_name || passwordMember?.email || 'This member'} will be
              signed out of all devices when the password changes.
            </DialogDescription>
          </DialogHeader>

          {pwGenerated ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                New password set. Copy it now — it is shown{' '}
                <span className="font-semibold text-foreground">only once</span> and never
                stored in plain text.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm text-foreground select-all">
                  {pwGenerated}
                </code>
                <IconAction
                  label={pwCopied ? 'Copied' : 'Copy'}
                  icon={
                    pwCopied ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <Copy className="size-4" />
                    )
                  }
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pwGenerated);
                      setPwCopied(true);
                    } catch {
                      // Clipboard can be blocked; the value stays
                      // visible and select-all-able above.
                    }
                  }}
                />
              </div>
              <DialogFooter className="bg-popover border-border">
                <Button
                  onClick={() => setPasswordMember(null)}
                  className="bg-primary text-primary-foreground hover:bg-primary-hover"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {pwError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  {pwError}
                </div>
              )}

              <div className="space-y-2">
                <Input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="New password (min 8 characters)"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  className="bg-muted border-border font-mono text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Type a password and set it, or let us generate a strong one for you.
                </p>
              </div>

              <DialogFooter className="bg-popover border-border flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  disabled={pwBusy || !passwordMember?.email}
                  onClick={() => handlePassword('email_reset')}
                  className="border-border text-foreground"
                >
                  <Mail className="mr-1.5 size-3.5" /> Email reset link
                </Button>
                <Button
                  variant="outline"
                  disabled={pwBusy}
                  onClick={() => handlePassword('generate')}
                  className="border-border text-foreground"
                >
                  Generate random
                </Button>
                <Button
                  disabled={pwBusy || pwValue.length < 8}
                  onClick={() => handlePassword('set')}
                  className="bg-primary text-primary-foreground hover:bg-primary-hover"
                >
                  {pwBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  Set password
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={loadEverything}
      />

      <Dialog
        open={removingMember !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingMember(null);
        }}
      >
        <DialogContent className="bg-popover border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-popover-foreground">
              <AlertTriangle className="size-4 text-amber-400" />
              Remove member
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Remove{' '}
              <span className="font-medium text-muted-foreground">
                {removingMember?.full_name || 'this teammate'}
              </span>{' '}
              from the account? They&apos;ll be signed out of this account
              and given a fresh personal account on their next sign-in. Their
              login isn&apos;t deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setRemovingMember(null)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemove}
              disabled={!!pendingMemberAction}
              className="bg-red-600 hover:bg-red-700 text-foreground"
            >
              {pendingMemberAction ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
