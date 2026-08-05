"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Inbox, CalendarClock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  loadMyWork,
  partitionSections,
  countOutstanding,
  dueBucket,
  type WorkSection,
  type WorkItem,
} from "@/lib/personal/my-work";
import { needsAttention, type PersonalTodo } from "@/lib/personal/todos";
import { BookmarksCard } from "@/components/personal/bookmarks-card";

const MODULE_STYLES: Record<string, string> = {
  Projects: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  CRM: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  HR: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

const DUE_STYLES: Record<string, string> = {
  overdue: "text-rose-600 dark:text-rose-400 font-semibold",
  today: "text-amber-600 dark:text-amber-400 font-semibold",
  soon: "text-muted-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

function DueLabel({ dueDate }: { dueDate?: string | null }) {
  if (!dueDate) return null;
  const bucket = dueBucket(dueDate);
  const label =
    bucket === "overdue"
      ? `Overdue · ${dueDate.slice(0, 10)}`
      : bucket === "today"
        ? "Due today"
        : `Due ${dueDate.slice(0, 10)}`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${DUE_STYLES[bucket]}`}>
      <CalendarClock className="size-3" />
      {label}
    </span>
  );
}

function ItemRow({ item }: { item: WorkItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-start justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
        {item.subtitle && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <DueLabel dueDate={item.dueDate} />
          {item.badge && (
            <Badge variant="outline" className="text-[10px] font-medium">
              {item.badge}
            </Badge>
          )}
        </div>
      </div>
      <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function SectionCard({ section }: { section: WorkSection }) {
  const hidden = section.total - section.items.length;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
          <Badge
            variant="outline"
            className={`text-[10px] ${MODULE_STYLES[section.module] ?? ""}`}
          >
            {section.module}
          </Badge>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {section.total}
        </span>
      </div>
      <div className="p-1.5">
        {section.items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
        {hidden > 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            + {hidden} more not shown
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Everything the signed-in member is responsible for, gathered from every
 * module they can reach — tasks, projects, chats, deals, HR requests,
 * direct reports and pending policy sign-offs.
 *
 * Read-only by design: each row deep-links to the module that owns the
 * record, so there is one place to edit it and no second source of truth.
 */
export default function MyWorkPage() {
  // Memoised: createClient() returns a new object each render, which would
  // rebuild every useCallback below it and re-fire their effects.
  const supabase = useMemo(() => createClient(), []);
  const { activeWorkspace, activeMember } = useWorkspace();
  const { user } = useAuth();

  const [sections, setSections] = useState<WorkSection[]>([]);
  const [urgentTodos, setUrgentTodos] = useState<PersonalTodo[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = activeWorkspace?.id;
  const memberId = activeMember?.id;
  const userId = user?.id;

  // Fetch inside the effect rather than via a useCallback it depends on —
  // that indirection trips react-hooks/set-state-in-effect. `cancelled`
  // stops a late response from a previous workspace landing here.
  useEffect(() => {
    if (!workspaceId || !memberId) return;
    let cancelled = false;

    (async () => {
      try {
        // deals.assigned_to references profiles(id), which is neither the
        // member id nor the auth user id — so it needs its own lookup.
        let profileId: string | null = null;
        if (userId) {
          const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
          profileId = (data?.id as string | undefined) ?? null;
        }

        const loaded = await loadMyWork(supabase, {
          workspaceId,
          memberId,
          userId: userId ?? null,
          profileId,
        });

        // Own to-dos that are late or due today. A missing table (migration
        // 098 not applied) just means no strip — not a broken page.
        const { data: todoRows } = await supabase
          .from("personal_todos")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("workspace_member_id", memberId)
          .is("completed_at", null);

        if (cancelled) return;
        setSections(loaded);
        setUrgentTodos(needsAttention((todoRows ?? []) as PersonalTodo[]));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, workspaceId, memberId, userId]);

  const { active, empty } = partitionSections(sections);
  const outstanding = countOutstanding(sections);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Work"
        description={
          loading
            ? "Gathering everything assigned to you…"
            : outstanding === 0
              ? "Nothing is assigned to you right now."
              : `${outstanding} open ${outstanding === 1 ? "item" : "items"} across your modules.`
        }
      />

      {/* Own to-dos that are late or due today, above the assigned work —
          these are the ones nobody else is going to chase. */}
      {!loading && urgentTodos.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Your to-dos need attention
            </p>
            <Link href="/me/todos" className="text-xs font-medium text-primary hover:underline">
              Open list
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {urgentTodos.slice(0, 5).map((todo) => (
              <li key={todo.id} className="flex items-center gap-2 text-sm text-foreground">
                <span className="truncate">{todo.title}</span>
                <DueLabel dueDate={todo.due_date} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Your plate is clear</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks, chats, deals and requests assigned to you will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((section) => (
            <SectionCard key={section.key} section={section} />
          ))}
        </div>
      )}

      {/* Empty sections are listed compactly rather than hidden, so it is
          clear the check ran and found nothing — not that it was skipped. */}
      {!loading && empty.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nothing waiting
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {empty.map((s) => (
              <span key={s.key} className="text-xs text-muted-foreground">
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && <BookmarksCard />}
    </div>
  );
}
