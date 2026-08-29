"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Plus, ListChecks, Trash2, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { IconAction } from "@/components/ui/icon-action";
import { assertAffected } from "@/lib/supabase/affected-rows";
import { dueBucket } from "@/lib/personal/my-work";
import {
  sortTodos,
  countTodos,
  isOpen,
  TODO_PRIORITIES,
  type PersonalTodo,
  type TodoPriority,
} from "@/lib/personal/todos";
import { NativeSelect } from "@/components/ui/native-select";

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  HIGH: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

const DUE_STYLES: Record<string, string> = {
  overdue: "text-rose-600 dark:text-rose-400 font-semibold",
  today: "text-amber-600 dark:text-amber-400 font-semibold",
  soon: "text-muted-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

/**
 * A private checklist for the signed-in member.
 *
 * Deliberately not assignable: delegated work belongs in project tasks,
 * which already carry assignment, comments and time logging. This is the
 * personal scratchpad that sits alongside them.
 */
export default function MyTodosPage() {
  // Memoised: createClient() returns a new object each render, which would
  // rebuild every useCallback below it and re-fire their effects.
  const supabase = useMemo(() => createClient(), []);
  const { activeWorkspace, activeMember } = useWorkspace();

  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");

  const workspaceId = activeWorkspace?.id;
  const memberId = activeMember?.id;

  // Fetch inside the effect, not via a useCallback the effect depends on —
  // that indirection trips react-hooks/set-state-in-effect. `cancelled`
  // stops a late response from a previous workspace landing here.
  useEffect(() => {
    if (!workspaceId || !memberId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("personal_todos")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("workspace_member_id", memberId);

      if (cancelled) return;
      if (error) {
        // The table arrives with migration 098; say so rather than showing
        // an empty list that looks like "you have no to-dos".
        toast.error(
          /does not exist|schema cache/i.test(error.message)
            ? "To-dos need migration 098 applied first."
            : `Could not load to-dos: ${error.message}`,
        );
        setTodos([]);
      } else {
        setTodos((data ?? []) as PersonalTodo[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, workspaceId, memberId]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !workspaceId || !memberId) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("personal_todos")
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        title: title.trim(),
        priority,
        due_date: dueDate || null,
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      toast.error(`Could not add: ${error.message}`);
      return;
    }
    setTodos((prev) => [...prev, data as PersonalTodo]);
    setTitle("");
    setDueDate("");
    setPriority("MEDIUM");
  };

  const toggleTodo = async (todo: PersonalTodo) => {
    const completed_at = isOpen(todo) ? new Date().toISOString() : null;

    // Optimistic, but reverted if the write turns out to have matched
    // nothing — an UPDATE filtered away by RLS still reports success.
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed_at } : t)),
    );

    const result = await supabase
      .from("personal_todos")
      .update({ completed_at })
      .eq("id", todo.id)
      .select();

    try {
      assertAffected(result, "that to-do");
    } catch (err) {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed_at: todo.completed_at } : t,
        ),
      );
      toast.error(err instanceof Error ? err.message : "Could not update that to-do");
    }
  };

  const deleteTodo = async (todo: PersonalTodo) => {
    const snapshot = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));

    const result = await supabase
      .from("personal_todos")
      .delete()
      .eq("id", todo.id)
      .select();

    try {
      assertAffected(result, "that to-do", "delete");
    } catch (err) {
      setTodos(snapshot);
      toast.error(err instanceof Error ? err.message : "Could not delete that to-do");
    }
  };

  const counts = countTodos(todos);
  const open = sortTodos(todos.filter(isOpen));
  const done = todos.filter((t) => !isOpen(t));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My To-dos"
        description={
          counts.overdue > 0
            ? `${counts.open} open · ${counts.overdue} overdue`
            : counts.dueToday > 0
              ? `${counts.open} open · ${counts.dueToday} due today`
              : `${counts.open} open`
        }
      />

      <form
        onSubmit={addTodo}
        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="flex-1 bg-background"
          maxLength={500}
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-auto bg-background"
          aria-label="Due date"
        />
        <NativeSelect
          value={priority}
          onChange={(e) => setPriority(e.target.value as TodoPriority)}
          aria-label="Priority"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          {TODO_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={saving || !title.trim()} size="sm">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : open.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <ListChecks className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Nothing on your list</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add something above. Only you can see these.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {open.map((todo) => {
            const bucket = dueBucket(todo.due_date);
            return (
              <div key={todo.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => void toggleTodo(todo)}
                  aria-label={`Mark "${todo.title}" done`}
                  className="mt-0.5 size-4 rounded border-border text-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{todo.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[todo.priority]}`}>
                      {todo.priority}
                    </Badge>
                    {todo.due_date && (
                      <span className={`inline-flex items-center gap-1 text-xs ${DUE_STYLES[bucket]}`}>
                        <CalendarClock className="size-3" />
                        {bucket === "overdue"
                          ? `Overdue · ${todo.due_date}`
                          : bucket === "today"
                            ? "Due today"
                            : `Due ${todo.due_date}`}
                      </span>
                    )}
                  </div>
                </div>
                <IconAction
                  icon={<Trash2 className="size-4" />}
                  label="Delete"
                  destructive
                  onClick={() => void deleteTodo(todo)}
                />
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showDone ? "Hide" : "Show"} completed ({done.length})
          </button>
          {showDone && (
            <div className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {done.map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => void toggleTodo(todo)}
                    aria-label={`Reopen "${todo.title}"`}
                    className="size-4 rounded border-border text-primary"
                  />
                  <span className="flex-1 text-sm text-muted-foreground line-through">
                    {todo.title}
                  </span>
                  <IconAction
                    icon={<Trash2 className="size-4" />}
                    label="Delete"
                    destructive
                    onClick={() => void deleteTodo(todo)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
