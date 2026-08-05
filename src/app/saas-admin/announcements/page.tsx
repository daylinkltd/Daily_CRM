"use client";

import { useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  ConsoleCard,
  LoadingRow,
  useConsoleData,
} from "@/components/saas-admin/console-ui";

interface Announcement {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
  published: boolean;
  starts_at: string;
  ends_at: string | null;
  dismissible: boolean;
  created_at: string;
}

const LEVEL_TONE = { info: "info", warning: "warn", critical: "bad" } as const;

export default function AnnouncementsPage() {
  const { data, loading, error, reload } = useConsoleData<{ announcements: Announcement[] }>(
    "/api/saas-admin/announcements",
  );

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<Announcement["level"]>("info");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const create = async (publish: boolean) => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are both required.");
      return;
    }
    setBusy("create");
    try {
      const res = await fetch("/api/saas-admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          level,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          published: publish,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      toast.success(publish ? "Published" : "Saved as draft");
      setTitle(""); setBody(""); setLevel("info"); setEndsAt(""); setCreating(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(null);
    }
  };

  const setPublished = async (a: Announcement, published: boolean) => {
    setBusy(a.id);
    try {
      const res = await fetch("/api/saas-admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, published }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm(`Delete "${a.title}"? Tenants stop seeing it immediately.`)) return;
    setBusy(a.id);
    try {
      const res = await fetch(`/api/saas-admin/announcements?id=${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      toast.success("Deleted");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> Announcements
        </h1>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> New announcement
        </button>
      </div>

      {creating && (
        <ConsoleCard title="New announcement">
          <div className="space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title — shown in the banner"
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message. Keep it to two sentences — this interrupts people."
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <div className="flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Level</span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Announcement["level"])}
                  className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical (not dismissible)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Ends (optional)
                </span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </label>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  disabled={busy === "create"}
                  onClick={() => create(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy === "create"}
                  onClick={() => create(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                >
                  Publish now
                </button>
              </div>
            </div>
          </div>
        </ConsoleCard>
      )}

      <ConsoleCard>
        {loading && !data ? (
          <LoadingRow label="Loading announcements…" />
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : (data?.announcements ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing yet. Announcements appear as a banner inside every tenant&apos;s dashboard.
          </p>
        ) : (
          <div className="space-y-3">
            {(data?.announcements ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-foreground">{a.title}</span>
                    <Badge tone={LEVEL_TONE[a.level]}>{a.level}</Badge>
                    <Badge tone={a.published ? "good" : "neutral"}>
                      {a.published ? "live" : "draft"}
                    </Badge>
                    {a.ends_at && (
                      <span className="text-[11px] text-muted-foreground">
                        until {new Date(a.ends_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => setPublished(a, !a.published)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {a.published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => remove(a)}
                    aria-label="Delete announcement"
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:border-rose-500 hover:text-rose-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ConsoleCard>
    </div>
  );
}
