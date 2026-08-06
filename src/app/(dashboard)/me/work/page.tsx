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

// Priority → badge palette, matching me/todos so the same HIGH/MEDIUM/LOW
// reads identically on both pages. Keys not in the map (non-priority
// badges) fall back to the outline default via the `?? ""` at the use
// site.
const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
};


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
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${DUE_STYLES[bucket]}`}>
      <CalendarClock className="size-3.5" />
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
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {item.title}
        </div>
        {item.subtitle && (
          <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <DueLabel dueDate={item.dueDate} />
          {item.badge && (
            <Badge variant="outline" className={`uppercase text-[9px] font-semibold tracking-wider px-1.5 py-0 ${PRIORITY_STYLES[item.badge as keyof typeof PRIORITY_STYLES] ?? ""}`}>
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
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
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
      <div className="p-1.5 flex-1">
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

export default function MyWorkPage() {
  const supabase = useMemo(() => createClient(), []);
  const { activeWorkspace, activeMember } = useWorkspace();
  const { user } = useAuth();

  const [sections, setSections] = useState<WorkSection[]>([]);
  const [urgentTodos, setUrgentTodos] = useState<PersonalTodo[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = activeWorkspace?.id;
  const memberId = activeMember?.id;
  const userId = user?.id;

  useEffect(() => {
    if (!workspaceId || !memberId) return;
    let cancelled = false;

    (async () => {
      try {
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

  // Split active sections into 2 balanced columns to prevent empty vertical voids
  const col1: WorkSection[] = [];
  const col2: WorkSection[] = [];
  active.forEach((section, idx) => {
    if (idx % 2 === 0) col1.push(section);
    else col2.push(section);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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

      {/* Urgent To-dos banner */}
      {!loading && urgentTodos.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              ⚡ Action Required: Your To-dos
            </p>
            <Link href="/me/todos" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Open list <ArrowRight className="size-3" />
            </Link>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {urgentTodos.slice(0, 5).map((todo) => (
              <li key={todo.id} className="flex items-center justify-between text-sm font-medium text-foreground bg-background/60 p-2 rounded-lg border border-amber-500/20">
                <span className="truncate">{todo.title}</span>
                <DueLabel dueDate={todo.due_date} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center shadow-sm">
          <Inbox className="mx-auto size-10 text-muted-foreground/60" />
          <p className="mt-4 text-base font-semibold text-foreground">Your plate is clear!</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Tasks, chats, deals, and requests assigned to you will automatically show up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <div className="space-y-5">
            {col1.map((section) => (
              <SectionCard key={section.key} section={section} />
            ))}
          </div>
          <div className="space-y-5">
            {col2.map((section) => (
              <SectionCard key={section.key} section={section} />
            ))}
          </div>
        </div>
      )}

      {/* Empty section badges strip */}
      {!loading && empty.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card/50 p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
            Clear Modules ({empty.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {empty.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 text-muted-foreground border border-border/40"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
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
