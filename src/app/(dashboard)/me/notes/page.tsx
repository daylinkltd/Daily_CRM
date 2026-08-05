"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  NotebookPen,
  Trash2,
  Pin,
  PinOff,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { IconAction } from "@/components/ui/icon-action";
import { assertAffected } from "@/lib/supabase/affected-rows";
import { sortNotes, notePreview, type PersonalNote } from "@/lib/personal/todos";

/**
 * Private rich-text notes for the signed-in member.
 *
 * The body goes through the app's `Textarea`, which renders
 * `RichTextEditor` by default — so formatting, sanitising and localStorage
 * draft recovery all come for free rather than being reimplemented here.
 */
export default function MyNotesPage() {
  // Memoised: createClient() returns a new object each render, which would
  // rebuild every useCallback below it and re-fire their effects.
  const supabase = useMemo(() => createClient(), []);
  const { activeWorkspace, activeMember } = useWorkspace();

  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const dirty =
    selected !== null &&
    (draftTitle !== selected.title || draftBody !== selected.body_html);

  const workspaceId = activeWorkspace?.id;
  const memberId = activeMember?.id;

  // See the to-dos page: fetching inside the effect keeps the React
  // Compiler able to verify the memoization.
  useEffect(() => {
    if (!workspaceId || !memberId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("personal_notes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("workspace_member_id", memberId);

      if (cancelled) return;
      if (error) {
        toast.error(
          /does not exist|schema cache/i.test(error.message)
            ? "Notes need migration 098 applied first."
            : `Could not load notes: ${error.message}`,
        );
        setNotes([]);
      } else {
        setNotes((data ?? []) as PersonalNote[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, workspaceId, memberId]);

  const openNote = (note: PersonalNote) => {
    setSelectedId(note.id);
    setDraftTitle(note.title);
    setDraftBody(note.body_html);
  };

  const newNote = async () => {
    if (!workspaceId || !memberId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("personal_notes")
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      toast.error(`Could not create note: ${error.message}`);
      return;
    }
    const note = data as PersonalNote;
    setNotes((prev) => [note, ...prev]);
    openNote(note);
  };

  const saveNote = async () => {
    if (!selected) return;
    setSaving(true);
    const result = await supabase
      .from("personal_notes")
      .update({ title: draftTitle.trim() || "Untitled note", body_html: draftBody })
      .eq("id", selected.id)
      .select();
    setSaving(false);

    try {
      const [row] = assertAffected(result, "that note", "save");
      setNotes((prev) =>
        prev.map((n) => (n.id === selected.id ? (row as PersonalNote) : n)),
      );
      toast.success("Note saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that note");
    }
  };

  const togglePin = async (note: PersonalNote) => {
    const result = await supabase
      .from("personal_notes")
      .update({ is_pinned: !note.is_pinned })
      .eq("id", note.id)
      .select();

    try {
      const [row] = assertAffected(result, "that note");
      setNotes((prev) => prev.map((n) => (n.id === note.id ? (row as PersonalNote) : n)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update that note");
    }
  };

  const deleteNote = async (note: PersonalNote) => {
    const snapshot = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (selectedId === note.id) setSelectedId(null);

    const result = await supabase
      .from("personal_notes")
      .delete()
      .eq("id", note.id)
      .select();

    try {
      assertAffected(result, "that note", "delete");
    } catch (err) {
      setNotes(snapshot);
      toast.error(err instanceof Error ? err.message : "Could not delete that note");
    }
  };

  const ordered = sortNotes(notes);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Notes"
        description={`${notes.length} ${notes.length === 1 ? "note" : "notes"} · visible only to you`}
        actions={
          <Button onClick={() => void newNote()} disabled={saving} size="sm">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New note
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <NotebookPen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No notes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Jot down anything — meeting notes, a plan, a reminder to yourself.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* List */}
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {ordered.map((note) => {
              const preview = notePreview(note.body_html, 80);
              return (
                <div
                  key={note.id}
                  className={`flex items-start gap-2 px-3 py-2.5 ${
                    note.id === selectedId ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openNote(note)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      {note.is_pinned && <Pin className="size-3 shrink-0 text-primary" />}
                      <span className="truncate text-sm font-medium text-foreground">
                        {note.title}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {preview || "Empty note"}
                    </div>
                  </button>
                  <IconAction
                    label={note.is_pinned ? "Unpin" : "Pin"}
                    icon={
                      note.is_pinned ? (
                        <PinOff className="size-4" />
                      ) : (
                        <Pin className="size-4" />
                      )
                    }
                    onClick={() => void togglePin(note)}
                  />
                  <IconAction
                    label="Delete"
                    icon={<Trash2 className="size-4" />}
                    destructive
                    onClick={() => void deleteNote(note)}
                  />
                </div>
              );
            })}
          </div>

          {/* Editor */}
          <div className="rounded-lg border border-border bg-card p-4">
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Note title"
                    className="flex-1 bg-background font-medium"
                    maxLength={200}
                  />
                  <Button
                    onClick={() => void saveNote()}
                    disabled={saving || !dirty}
                    size="sm"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save
                  </Button>
                </div>
                {/* Rich by default — Textarea renders RichTextEditor unless
                    `plain` is passed, which also brings draft recovery. */}
                <Textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  placeholder="Start writing…"
                  rows={16}
                />
                {dirty && (
                  <p className="text-xs text-muted-foreground">Unsaved changes</p>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Pick a note on the left, or create a new one.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
