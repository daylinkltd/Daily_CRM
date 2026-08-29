"use client";

// Teammate display names, fetched once per workspace and shared.
//
// Pages used to resolve these with a client-side `profiles` query,
// which RLS answers with only the caller's own row — hence "Unknown
// User" across HR and "Team Member" across timesheets. This hook reads
// the server directory instead, so the name a page shows does not
// depend on which policies happen to be live.

import { useCallback, useEffect, useMemo, useState } from "react";

import { useWorkspace } from "@/hooks/use-workspace";

export interface DirectoryEntry {
  member_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

/** One in-flight request per workspace, shared by every mounted caller. */
const cache = new Map<string, Promise<DirectoryEntry[]>>();

async function loadDirectory(workspaceId: string): Promise<DirectoryEntry[]> {
  const res = await fetch(
    `/api/workspace/directory?workspace_id=${encodeURIComponent(workspaceId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("directory unavailable");
  const json = (await res.json()) as { entries?: DirectoryEntry[] };
  return json.entries ?? [];
}

export function useMemberDirectory() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // `version` re-runs the effect on an explicit refresh without the
  // effect itself setting state synchronously — every state write below
  // happens in a promise callback, after the render has committed.
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    if (workspaceId) cache.delete(workspaceId);
    setVersion((v) => v + 1);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    let promise = cache.get(workspaceId);
    if (!promise) {
      promise = loadDirectory(workspaceId);
      cache.set(workspaceId, promise);
    }

    promise
      .then((list) => {
        if (!cancelled) {
          setEntries(list);
          setLoading(false);
        }
      })
      .catch(() => {
        // A failed directory must not blank out a page — callers fall
        // back to whatever name they already had.
        cache.delete(workspaceId);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, version]);

  const byUserId = useMemo(
    () => new Map(entries.map((e) => [e.user_id, e])),
    [entries],
  );
  const byMemberId = useMemo(
    () => new Map(entries.map((e) => [e.member_id, e])),
    [entries],
  );

  /** Name for a user id or member id, with the caller's own fallback. */
  const nameFor = useCallback(
    (id: string | null | undefined, fallback = "Workspace Member"): string => {
      if (!id) return fallback;
      return byUserId.get(id)?.full_name ?? byMemberId.get(id)?.full_name ?? fallback;
    },
    [byUserId, byMemberId],
  );

  return { entries, byUserId, byMemberId, nameFor, loading, refresh };
}
