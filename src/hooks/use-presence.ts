"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  derivePresence,
  type PresenceRow,
  type PresenceStatus,
  type StoredPresence,
} from "@/lib/presence";

const RE_DERIVE_MS = 15_000;

type PresenceMap = Map<string, PresenceRow>;

interface UsePresenceResult {
  getPresence: (userId: string) => PresenceStatus;
  getRow: (userId: string) => PresenceRow | undefined;
  now: number;
}

export function usePresence(enabled = false): UsePresenceResult {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const [rows, setRows] = useState<PresenceMap>(() => new Map());
  const [now, setNow] = useState(() => Date.now());

  const active = enabled && !!workspaceId;

  useEffect(() => {
    if (!active || !workspaceId) return;

    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const applyRow = (row: {
      user_id: string;
      status: StoredPresence;
      last_seen_at: string;
    }) => {
      setRows((prev) => {
        const next = new Map(prev);
        next.set(row.user_id, {
          status: row.status,
          last_seen_at: row.last_seen_at,
        });
        return next;
      });
    };

    try {
      channel = supabase
        .channel(`presence:${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "member_presence",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as { user_id?: string };
              if (!old.user_id) return;
              setRows((prev) => {
                if (!prev.has(old.user_id!)) return prev;
                const next = new Map(prev);
                next.delete(old.user_id!);
                return next;
              });
              return;
            }
            applyRow(
              payload.new as {
                user_id: string;
                status: StoredPresence;
                last_seen_at: string;
              },
            );
          },
        )
        .subscribe();
    } catch {
      // Channel subscription catch
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("member_presence")
          .select("user_id, status, last_seen_at")
          .eq("workspace_id", workspaceId);

        if (cancelled) return;
        if (error) {
          // Table may not exist or workspace permissions failed — ignore silently
          return;
        }
        setRows((prev) => {
          const next = new Map(prev);
          for (const r of data ?? []) {
            const userId = r.user_id as string;
            const incoming: PresenceRow = {
              status: r.status as StoredPresence,
              last_seen_at: r.last_seen_at as string,
            };
            const existing = next.get(userId);
            if (
              !existing ||
              new Date(incoming.last_seen_at) >= new Date(existing.last_seen_at)
            ) {
              next.set(userId, incoming);
            }
          }
          return next;
        });
      } catch {
        // Table miss catch
      }
    })();

    const tick = setInterval(() => setNow(Date.now()), RE_DERIVE_MS);

    return () => {
      cancelled = true;
      clearInterval(tick);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [active, workspaceId]);

  const getRow = useCallback(
    (userId: string): PresenceRow | undefined => rows.get(userId),
    [rows],
  );

  const getPresence = useCallback(
    (userId: string): PresenceStatus => {
      const row = rows.get(userId);
      return derivePresence(row?.status, row?.last_seen_at, now);
    },
    [rows, now],
  );

  return { getPresence, getRow, now };
}
