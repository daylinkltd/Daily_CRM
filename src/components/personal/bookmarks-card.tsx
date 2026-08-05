"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Bookmark, Plus, Trash2, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconAction } from "@/components/ui/icon-action";
import { assertAffected } from "@/lib/supabase/affected-rows";
import {
  isInternalHref,
  normalizeBookmarkHref,
  type PersonalBookmark,
} from "@/lib/personal/todos";

/**
 * Private quick links — an in-app path or an external URL.
 *
 * External links get `rel="noreferrer noopener"`, and the href is
 * normalised through `normalizeBookmarkHref`, which rejects
 * `javascript:` / `data:` outright. These render as anchors, so accepting
 * those schemes would be a stored-XSS hole in the member's own dashboard.
 */
export function BookmarksCard() {
  // Memoised: createClient() returns a new object each render, which would
  // rebuild every useCallback below it and re-fire their effects.
  const supabase = useMemo(() => createClient(), []);
  const { activeWorkspace, activeMember } = useWorkspace();

  const [bookmarks, setBookmarks] = useState<PersonalBookmark[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  // The fetch lives inside the effect rather than in a useCallback the
  // effect depends on: that indirection defeats the React Compiler's
  // memoization check and trips react-hooks/set-state-in-effect. The
  // `cancelled` flag also stops a late response from a previous workspace
  // overwriting the current one.
  const workspaceId = activeWorkspace?.id;
  const memberId = activeMember?.id;

  useEffect(() => {
    if (!workspaceId || !memberId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("personal_bookmarks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("workspace_member_id", memberId)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      if (error) {
        // Table arrives with migration 098. Hide the card rather than nag
        // on a page the member did not come here to debug.
        if (/does not exist|schema cache/i.test(error.message)) setUnavailable(true);
        return;
      }
      setBookmarks((data ?? []) as PersonalBookmark[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, workspaceId, memberId]);

  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeBookmarkHref(href);
    if (!normalized) {
      toast.error("That doesn't look like a link. Try /invoices or example.com");
      return;
    }
    if (!workspaceId || !memberId) return;

    const { data, error } = await supabase
      .from("personal_bookmarks")
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        label: label.trim() || normalized,
        href: normalized,
        sort_order: bookmarks.length,
      })
      .select()
      .single();

    if (error) {
      toast.error(`Could not save: ${error.message}`);
      return;
    }
    setBookmarks((prev) => [...prev, data as PersonalBookmark]);
    setLabel("");
    setHref("");
    setAdding(false);
  };

  const remove = async (bookmark: PersonalBookmark) => {
    const snapshot = bookmarks;
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));

    const result = await supabase
      .from("personal_bookmarks")
      .delete()
      .eq("id", bookmark.id)
      .select();

    try {
      assertAffected(result, "that bookmark", "delete");
    } catch (err) {
      setBookmarks(snapshot);
      toast.error(err instanceof Error ? err.message : "Could not delete that bookmark");
    }
  };

  if (unavailable) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bookmark className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Quick links</h3>
        </div>
        <IconAction
          label={adding ? "Cancel" : "Add link"}
          icon={adding ? <X className="size-4" /> : <Plus className="size-4" />}
          onClick={() => setAdding((v) => !v)}
        />
      </div>

      {adding && (
        <form onSubmit={addBookmark} className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="bg-background sm:w-40"
            maxLength={100}
          />
          <Input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/invoices or example.com"
            className="flex-1 bg-background"
          />
          <Button type="submit" size="sm" disabled={!href.trim()}>
            Save
          </Button>
        </form>
      )}

      {bookmarks.length === 0 ? (
        <p className="px-4 py-5 text-xs text-muted-foreground">
          No quick links yet. Save a page you keep coming back to.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {bookmarks.map((bookmark) => {
            const internal = isInternalHref(bookmark.href);
            return (
              <li key={bookmark.id} className="flex items-center gap-2 px-3 py-2">
                {internal ? (
                  <Link
                    href={bookmark.href}
                    className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
                  >
                    {bookmark.label}
                  </Link>
                ) : (
                  <a
                    href={bookmark.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-foreground hover:underline"
                  >
                    <span className="truncate">{bookmark.label}</span>
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                  </a>
                )}
                <IconAction
                  label="Remove"
                  icon={<Trash2 className="size-4" />}
                  destructive
                  onClick={() => void remove(bookmark)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
