"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Plus,
  BookOpen,
  FolderOpen,
  Check,
  Trash2,
  Copy,
  MessageCircle,
  Mail,
  Smartphone,
  FileText,
  Bell,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsPanelHead } from "./settings-panel-head";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkActionBar, SelectRowCheckbox } from "@/components/ui/bulk-action-bar";
import {
  TEMPLATE_MODULES,
  TEMPLATE_MODULE_LABELS,
  TEMPLATE_CHANNELS,
  TEMPLATE_CHANNEL_LABELS,
  extractVariables,
  needsAggregatorApproval,
  smsSegments,
  type TemplateRow,
  type TemplateModule,
  type TemplateChannel,
} from "@/lib/templates/catalog";

const CHANNEL_ICONS: Record<TemplateChannel, typeof Mail> = {
  whatsapp: MessageCircle,
  email: Mail,
  sms: Smartphone,
  document: FileText,
  internal: Bell,
};

const ALL = "all";

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

const BLANK_DRAFT = {
  id: null as string | null,
  module: "crm" as TemplateModule,
  channel: "whatsapp" as TemplateChannel,
  category: "",
  name: "",
  description: "",
  subject: "",
  body: "",
};

export function TemplateLibraryPanel() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can("settings_templates") || can("settings_workspace");

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [view, setView] = useState<"mine" | "library">("mine");
  const [moduleFilter, setModuleFilter] = useState<TemplateModule | typeof ALL>(ALL);
  const [channelFilter, setChannelFilter] = useState<TemplateChannel | typeof ALL>(ALL);
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      // One query returns both the library (workspace_id IS NULL) and this
      // workspace's own rows; RLS already limits it to those two sets.
      // `message_templates` is fetched alongside it: that table is Meta's
      // submission record for WhatsApp and cannot be folded into
      // `templates` without breaking the send path, but the point of this
      // page is that every template in the product is visible in one
      // place, so they are merged for display.
      const [{ data, error }, metaRes] = await Promise.all([
        supabase.from("templates").select("*").is("deleted_at", null).order("name"),
        supabase
          .from("message_templates")
          .select("id, name, category, language, body_text, footer_text, status")
          .eq("workspace_id", activeWorkspace.id)
          .order("name"),
      ]);
      if (error) throw error;

      const unified = (data as TemplateRow[] | null) || [];
      const meta: TemplateRow[] = (metaRes.data || []).map((m) => ({
        id: `meta:${m.id}`,
        workspace_id: activeWorkspace.id,
        module: "crm",
        channel: "whatsapp",
        category: (m.category as string) || "WhatsApp",
        name: m.name as string,
        description: "Submitted to Meta for approval.",
        subject: null,
        body: [m.body_text, m.footer_text].filter(Boolean).join("\n\n"),
        variables: null,
        tags: ["meta"],
        requires_approval: true,
        approval_status: ((m.status as string) || "").toUpperCase() || null,
        is_system: false,
        is_active: true,
        source_template_id: null,
        usage_count: 0,
      }));

      setTemplates([...unified, ...meta]);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load templates"));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const mine = useMemo(() => templates.filter((t) => t.workspace_id !== null), [templates]);
  const library = useMemo(() => templates.filter((t) => t.workspace_id === null), [templates]);

  /** Library rows already copied into this workspace, so the card can say so. */
  const adoptedSourceIds = useMemo(
    () => new Set(mine.map((t) => t.source_template_id).filter(Boolean) as string[]),
    [mine]
  );

  const visible = useMemo(() => {
    const pool = view === "mine" ? mine : library;
    const q = search.trim().toLowerCase();
    return pool.filter((t) => {
      if (moduleFilter !== ALL && t.module !== moduleFilter) return false;
      if (channelFilter !== ALL && t.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
      );
    });
  }, [view, mine, library, moduleFilter, channelFilter, search]);

  const selection = useRowSelection(visible, (t) => t.id);

  /** Count per module for the tab badges, within the current view. */
  const moduleCounts = useMemo(() => {
    const pool = view === "mine" ? mine : library;
    const counts = new Map<string, number>();
    for (const t of pool) counts.set(t.module, (counts.get(t.module) || 0) + 1);
    return counts;
  }, [view, mine, library]);

  const openNew = () => {
    setDraft(BLANK_DRAFT);
    setEditorOpen(true);
  };

  const openEdit = (t: TemplateRow) => {
    setDraft({
      id: t.id,
      module: t.module,
      channel: t.channel,
      category: t.category || "",
      name: t.name,
      description: t.description || "",
      subject: t.subject || "",
      body: t.body,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    if (!draft.name.trim()) {
      toast.error("Give the template a name.");
      return;
    }
    if (!draft.body.trim()) {
      toast.error("The template body cannot be empty.");
      return;
    }
    if (draft.channel === "email" && !draft.subject.trim()) {
      toast.error("An email template needs a subject line.");
      return;
    }

    setSaving(true);
    try {
      // Variables are derived from the text rather than typed by hand, so
      // they can never drift out of sync with the body.
      const variables = extractVariables(draft.subject, draft.body);
      const payload = {
        workspace_id: activeWorkspace.id,
        module: draft.module,
        channel: draft.channel,
        category: draft.category.trim() || null,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        subject: draft.channel === "email" ? draft.subject.trim() : null,
        body: draft.body,
        variables,
        requires_approval: needsAggregatorApproval(draft.channel),
        approval_status: needsAggregatorApproval(draft.channel) ? "DRAFT" : null,
        is_system: false,
      };

      const { error } = draft.id
        ? await supabase.from("templates").update(payload).eq("id", draft.id)
        : await supabase.from("templates").insert(payload);
      if (error) throw error;

      toast.success(draft.id ? "Template updated." : "Template created.");
      setEditorOpen(false);
      await fetchTemplates();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save template"));
    } finally {
      setSaving(false);
    }
  };

  const handleAdopt = async (t: TemplateRow) => {
    if (!activeWorkspace?.id) return;
    setAdoptingId(t.id);
    try {
      const { error } = await supabase.rpc("adopt_library_template", {
        p_workspace_id: activeWorkspace.id,
        p_template_id: t.id,
      });
      if (error) throw error;
      toast.success(`"${t.name}" added to your templates.`);
      await fetchTemplates();
      setView("mine");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add template"));
    } finally {
      setAdoptingId(null);
    }
  };

  /** Meta rows live in another table and are not editable here. */
  const bulkTargets = () =>
    selection.selectedRows.filter((t) => !t.id.startsWith("meta:") && t.workspace_id !== null);

  const handleBulkDelete = async () => {
    const targets = bulkTargets();
    if (targets.length === 0) {
      toast.error("Only your own templates can be deleted — library and WhatsApp rows cannot.");
      return;
    }
    if (!confirm(`Delete ${targets.length} template${targets.length === 1 ? "" : "s"}?`)) return;
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from("templates")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", targets.map((t) => t.id));
      if (error) throw error;
      toast.success(`Deleted ${targets.length} template${targets.length === 1 ? "" : "s"}.`);
      selection.clear();
      await fetchTemplates();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete templates"));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkAdopt = async () => {
    if (!activeWorkspace?.id) return;
    const targets = selection.selectedRows.filter((t) => t.workspace_id === null);
    if (targets.length === 0) {
      toast.error("Select library templates to add.");
      return;
    }
    setBulkBusy(true);
    try {
      // Sequential: each call allocates a de-duplicated name, so running
      // them in parallel would race on the uniqueness check.
      for (const t of targets) {
        const { error } = await supabase.rpc("adopt_library_template", {
          p_workspace_id: activeWorkspace.id,
          p_template_id: t.id,
        });
        if (error) throw error;
      }
      toast.success(`Added ${targets.length} template${targets.length === 1 ? "" : "s"}.`);
      selection.clear();
      await fetchTemplates();
      setView("mine");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add templates"));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = async (t: TemplateRow) => {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    try {
      // Soft delete: the row may be referenced by a sent message's history.
      const { error } = await supabase
        .from("templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) throw error;
      toast.success("Template deleted.");
      await fetchTemplates();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete template"));
    }
  };

  const draftVariables = extractVariables(draft.subject, draft.body);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <SettingsPanelHead
        title="Templates"
        description="Every reusable message and document in one place — WhatsApp, email, SMS, HR letters and internal notifications. Start from the ready-made library or write your own."
        action={
          canManage ? (
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="size-4" /> New template
            </Button>
          ) : null
        }
      />

      {/* My Templates / Library */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setView("mine")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
            view === "mine"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FolderOpen className="size-3.5" /> My templates ({mine.length})
        </button>
        <button
          type="button"
          onClick={() => setView("library")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
            view === "library"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="size-3.5" /> Library ({library.length})
        </button>
      </div>

      {/* Module tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setModuleFilter(ALL)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
            moduleFilter === ALL
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          All modules
        </button>
        {TEMPLATE_MODULES.map((m) => {
          const count = moduleCounts.get(m) || 0;
          if (count === 0 && moduleFilter !== m) return null;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setModuleFilter(m)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                moduleFilter === m
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {TEMPLATE_MODULE_LABELS[m]} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Channel + search */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, content or category…"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Select
          value={channelFilter}
          onValueChange={(v) => setChannelFilter(v as TemplateChannel | typeof ALL)}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All channels</SelectItem>
            {TEMPLATE_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {TEMPLATE_CHANNEL_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            {view === "mine" ? "No templates here yet" : "Nothing matches those filters"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view === "mine"
              ? "Browse the library to add a ready-made one, or create your own."
              : "Try a different module or channel."}
          </p>
          {view === "mine" && (
            <Button variant="outline" onClick={() => setView("library")} className="mt-4 gap-1.5">
              <BookOpen className="size-4" /> Browse the library
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => {
            const Icon = CHANNEL_ICONS[t.channel];
            const adopted = adoptedSourceIds.has(t.id);
            return (
              <div
                key={t.id}
                className="flex flex-col rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {canManage && (
                      <SelectRowCheckbox
                        checked={selection.isSelected(t.id)}
                        onToggle={(o) => selection.toggle(t.id, o)}
                        label={`Select ${t.name}`}
                      />
                    )}
                    <Icon className="size-3.5 shrink-0 text-primary" />
                    <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {TEMPLATE_MODULE_LABELS[t.module]}
                  </Badge>
                </div>

                {t.description && (
                  <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                )}

                <p className="mb-2.5 line-clamp-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed text-muted-foreground">
                  {t.subject ? `${t.subject}\n` : ""}
                  {t.body.replace(/<[^>]+>/g, " ").slice(0, 220)}
                </p>

                <div className="mb-2.5 flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {TEMPLATE_CHANNEL_LABELS[t.channel]}
                  </Badge>
                  {t.category && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t.category}
                    </Badge>
                  )}
                  {t.channel === "sms" && (
                    <Badge variant="secondary" className="text-[10px]">
                      {smsSegments(t.body)} SMS
                    </Badge>
                  )}
                  {(t.variables?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t.variables!.length} fields
                    </Badge>
                  )}
                  {t.approval_status && (
                    <Badge
                      className={cn(
                        "text-[10px]",
                        t.approval_status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : t.approval_status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {t.approval_status}
                    </Badge>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1.5 pt-1">
                  {view === "library" ? (
                    <Button
                      size="sm"
                      variant={adopted ? "outline" : "default"}
                      disabled={!canManage || adoptingId === t.id}
                      onClick={() => handleAdopt(t)}
                      className="h-7 flex-1 gap-1.5 text-xs"
                    >
                      {adoptingId === t.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : adopted ? (
                        <Check className="size-3" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {adopted ? "Added — add again" : "Use this"}
                    </Button>
                  ) : t.id.startsWith("meta:") ? (
                    <Link
                      href="/settings?tab=whatsapp-templates"
                      className="flex-1"
                    >
                      <Button size="sm" variant="outline" className="h-7 w-full text-xs">
                        Manage in WhatsApp approvals
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(t)}
                        disabled={!canManage}
                        className="h-7 flex-1 text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(t)}
                        disabled={!canManage || t.id.startsWith("meta:")}
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BulkActionBar
        count={selection.selectedCount}
        hiddenCount={selection.hiddenSelectedCount}
        onClear={selection.clear}
        busy={bulkBusy}
        noun="template"
      >
        {view === "library" ? (
          <Button size="sm" variant="outline" onClick={handleBulkAdopt} disabled={bulkBusy} className="h-7 gap-1.5 text-xs">
            <Copy className="size-3.5" /> Add to my templates
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handleBulkDelete} disabled={bulkBusy} className="h-7 gap-1.5 text-xs text-destructive">
            <Trash2 className="size-3.5" /> Delete
          </Button>
        )}
      </BulkActionBar>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Wrap a placeholder in double braces, like {"{{contact_name}}"} — they are detected
              automatically and filled in when the template is used.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Module</Label>
                <Select
                  value={draft.module}
                  onValueChange={(v) => setDraft((d) => ({ ...d, module: v as TemplateModule }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_MODULES.map((m) => (
                      <SelectItem key={m} value={m}>{TEMPLATE_MODULE_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Channel</Label>
                <Select
                  value={draft.channel}
                  onValueChange={(v) => setDraft((d) => ({ ...d, channel: v as TemplateChannel }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>{TEMPLATE_CHANNEL_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Payment reminder — overdue"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Input
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  placeholder="Receivables"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="When to use this template"
              />
            </div>

            {draft.channel === "email" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Subject</Label>
                <Input
                  value={draft.subject}
                  onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  placeholder="Invoice {{invoice_number}} from {{company_name}}"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message body</Label>
              {/* `plain` is required: this text is sent verbatim to Meta,
                  an SMS gateway or an email body. The rich-text editor
                  would wrap it in HTML the channel cannot render. */}
              <Textarea
                plain
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                rows={9}
                className="font-mono text-xs"
                placeholder="Hi {{contact_name}}, …"
              />
              {draft.channel === "sms" && draft.body && (
                <p className="text-[11px] text-muted-foreground">
                  {draft.body.length} characters · {smsSegments(draft.body)} SMS segment
                  {smsSegments(draft.body) === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {draftVariables.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Detected fields</Label>
                <div className="flex flex-wrap gap-1">
                  {draftVariables.map((v) => (
                    <Badge key={v} variant="secondary" className="font-mono text-[10px]">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {needsAggregatorApproval(draft.channel) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  WhatsApp templates must be approved by Meta before they can be sent outside the
                  24-hour service window. This saves as a draft; submit it for approval from the
                  WhatsApp settings page.
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {draft.id ? "Save changes" : "Create template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
