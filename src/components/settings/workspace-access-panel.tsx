'use client';

// ============================================================
// Settings → Members → Workspace access
//
// Who can see which workspace, and as what. One grid: people down the
// side, the tenant's workspaces across the top, a role in every cell.
//
// This exists because roles are per workspace by design — the same
// person can run workspace A as an admin and only read workspace B —
// but nothing in the product ever showed that. Access was managed one
// workspace at a time from inside it, so the question "what can this
// person reach?" had no answer short of switching into every workspace
// in turn.
//
// Owner only. An admin of one workspace has no business granting
// themselves a role in another.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Network } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { SettingsPanelHead } from './settings-panel-head';

interface AccessRow { member_id: string; workspace_id: string; role: string; role_id: string | null }
interface Person {
  user_id: string;
  full_name: string;
  email: string | null;
  isSelf: boolean;
  access: AccessRow[];
}
interface WorkspaceRow { id: string; name: string }
interface RoleRow { id: string; workspace_id: string; name: string; is_system: boolean }

const NO_ACCESS = 'none';

export function WorkspaceAccessPanel() {
  const { isOwner } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeWorkspace?.id || !isOwner) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/workspace/access?workspace_id=${activeWorkspace.id}`,
        { cache: 'no-store' },
      );
      const payload = await res.json();
      if (!res.ok) { toast.error(payload.error || 'Could not load workspace access'); return; }
      setWorkspaces(payload.workspaces ?? []);
      setPeople(payload.people ?? []);
      setRoles(payload.roles ?? []);
      setSeatsUsed(payload.seatsUsed ?? 0);
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, isOwner]);

  useEffect(() => { void load(); }, [load]);

  const seatMax = useMemo(() => {
    const limits = (activeWorkspace?.plan_limits ?? {}) as { max_members?: number | null };
    const n = Number(limits.max_members);
    return n && n < 999999 ? n : null;
  }, [activeWorkspace?.plan_limits]);

  /** Roles belong to a workspace, so each column offers its own. */
  const rolesFor = useCallback(
    (workspaceId: string) =>
      roles.filter((r) => r.workspace_id === workspaceId && r.name !== 'Owner'),
    [roles],
  );

  async function setAccess(person: Person, workspaceId: string, value: string) {
    const cell = `${person.user_id}:${workspaceId}`;
    setBusyCell(cell);

    // The value is a workspace_roles id, or NO_ACCESS. The enum role is
    // derived from the chosen role's name so the legacy column and the
    // matrix cannot disagree.
    const chosen = roles.find((r) => r.id === value);
    const enumRole = !chosen
      ? null
      : chosen.name === 'Admin'
        ? 'admin'
        : chosen.name === 'Viewer'
          ? 'viewer'
          : 'member';

    try {
      const res = await fetch('/api/workspace/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspace!.id,
          target_workspace_id: workspaceId,
          user_id: person.user_id,
          role: value === NO_ACCESS ? null : enumRole,
          role_id: value === NO_ACCESS ? null : value,
        }),
      });
      const payload = await res.json();
      if (!res.ok) { toast.error(payload.error || 'Could not update access'); return; }

      const wsName = workspaces.find((w) => w.id === workspaceId)?.name ?? 'that workspace';
      toast.success(
        value === NO_ACCESS
          ? `${person.full_name} can no longer see ${wsName}.`
          : `${person.full_name} is now ${chosen?.name} in ${wsName}.`,
      );
      await load();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusyCell(null);
    }
  }

  if (!isOwner) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  // A single workspace has no matrix to draw — the roster above already
  // says everything there is to say.
  if (workspaces.length < 2) return null;

  return (
    <section className="space-y-4">
      <SettingsPanelHead
        title="Workspace access"
        description="Who can open which workspace, and what they can do once inside. A role is per workspace — the same person can run one and only read another."
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Network className="size-4 text-primary" />
        <span>
          {seatsUsed} {seatsUsed === 1 ? 'person' : 'people'} across {workspaces.length} workspaces
        </span>
        {seatMax && (
          <Badge variant="outline" className="text-[10px]">
            {seatsUsed} of {seatMax} seats
          </Badge>
        )}
        <span className="text-muted-foreground/70">
          · One person is one seat, however many workspaces they work in.
        </span>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Person</th>
                {workspaces.map((w) => (
                  <th key={w.id} className="px-3 py-3 font-semibold">
                    {w.name}
                    {w.id === activeWorkspace?.id && (
                      <span className="ml-1.5 text-[10px] normal-case text-primary">current</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.user_id} className="border-b border-border/50">
                  <td className="px-4 py-2.5">
                    <span className="block font-medium text-foreground">{person.full_name}</span>
                    {person.email && (
                      <span className="block text-xs text-muted-foreground">{person.email}</span>
                    )}
                  </td>
                  {workspaces.map((w) => {
                    const row = person.access.find((a) => a.workspace_id === w.id);
                    const isOwnerCell = row?.role === 'owner';
                    const cell = `${person.user_id}:${w.id}`;
                    const options = rolesFor(w.id);

                    // The owner's own row is fixed everywhere: revoking
                    // it would orphan the workspace it belongs to.
                    if (isOwnerCell || person.isSelf) {
                      return (
                        <td key={w.id} className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {isOwnerCell ? 'Owner' : row ? 'Member' : 'No access'}
                          </Badge>
                        </td>
                      );
                    }

                    return (
                      <td key={w.id} className="px-3 py-2.5">
                        <Select
                          value={row?.role_id ?? NO_ACCESS}
                          onValueChange={(v) => v && setAccess(person, w.id, v as string)}
                        >
                          <SelectTrigger
                            className="h-8 w-36 bg-muted text-xs"
                            disabled={busyCell === cell}
                          >
                            <SelectValue placeholder="No access" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_ACCESS}>No access</SelectItem>
                            {options.map((r) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
