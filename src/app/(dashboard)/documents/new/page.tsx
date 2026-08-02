"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { A4DocumentPreview } from "@/components/documents/a4-document-preview";
import { interpolateVariables } from "@/lib/documents/variable-engine";
import { extractVariables } from "@/lib/templates/catalog";
import {
  FileText,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Search,
  Check,
  PencilLine,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface DocTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  body: string;
  variables: string[] | null;
  workspace_id: string | null;
}

interface Signatory {
  id: string;
  name: string;
  designation: string;
}

interface RecipientOption {
  workspace_member_id: string;
  name: string;
  email: string | null;
  designation: string | null;
  department: string | null;
  joining_date: string | null;
  employee_code: string | null;
}

const BLANK_BODY = `<h2>Document Title</h2>
<p>Date: {{today}}</p>
<p>To,</p>
<p><strong>{{employee_name}}</strong></p>
<p>Write the body of your document here.</p>
<p>Sincerely,<br/>{{signatory_name}}</p>`;

/**
 * Turn a variable token into a human label: `employee_name` -> "Employee
 * name", `company.address` -> "Company address". The templates are
 * authored with snake_case tokens but the people filling them in are not
 * developers.
 */
function humanLabel(token: string): string {
  const words = token.replace(/\./g, " ").replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Fields that suit a date picker rather than free text. */
const DATE_HINTS = ["date", "_from", "_till", "_until", "deadline", "expiry"];
const LONG_HINTS = ["summary", "description", "details", "reason", "remark", "conduct", "scope", "note"];

function inputKindFor(token: string): "date" | "long" | "text" {
  const t = token.toLowerCase();
  if (t === "today") return "date";
  if (DATE_HINTS.some((h) => t.includes(h))) return "date";
  if (LONG_HINTS.some((h) => t.includes(h))) return "long";
  return "text";
}

export default function IssueNewDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get("templateId");
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [letterhead, setLetterhead] = useState<Record<string, unknown> | null>(null);

  const [templateId, setTemplateId] = useState<string>(templateIdParam || "");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(BLANK_BODY);
  const [bodyDirty, setBodyDirty] = useState(false);

  const [recipientMemberId, setRecipientMemberId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [signatoryId, setSignatoryId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const [tplRes, sigRes, lhRes, empRes] = await Promise.all([
        // The unified template library (migration 088) — the same place
        // Settings -> Templates manages. `document_templates` from 084 is
        // not read here: it was a second, empty store for the same idea.
        supabase
          .from("templates")
          .select("id, name, description, category, body, variables, workspace_id")
          .eq("channel", "document")
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("company_signatories")
          .select("id, name, designation")
          .eq("workspace_id", activeWorkspace.id)
          .is("deleted_at", null)
          .order("priority"),
        supabase
          .from("company_letterhead_configs")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .maybeSingle(),
        supabase
          .from("employee_profiles")
          .select("workspace_member_id, employee_code, joining_date, department_id, designation_id")
          .eq("workspace_id", activeWorkspace.id),
      ]);

      setTemplates((tplRes.data as DocTemplate[] | null) || []);
      setSignatories(sigRes.data || []);
      setLetterhead((lhRes.data as Record<string, unknown> | null) || null);
      if (sigRes.data?.[0]) setSignatoryId(sigRes.data[0].id);

      // Recipients: employees, with names resolved separately because
      // workspace_members.user_id points at auth.users, so a nested
      // profiles embed is impossible.
      const emps = empRes.data || [];
      if (emps.length > 0) {
        const memberIds = emps.map((e) => e.workspace_member_id).filter(Boolean);
        const [{ data: members }, { data: depts }, { data: desigs }] = await Promise.all([
          supabase.from("workspace_members").select("id, user_id").in("id", memberIds),
          supabase.from("departments").select("id, name").eq("workspace_id", activeWorkspace.id),
          supabase.from("designations").select("id, title").eq("workspace_id", activeWorkspace.id),
        ]);
        const userIds = (members || []).map((m) => m.user_id).filter(Boolean);
        const { data: profiles } = userIds.length
          ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };

        const profByUser = new Map((profiles || []).map((p) => [p.user_id, p]));
        const memberById = new Map((members || []).map((m) => [m.id, m]));
        const deptById = new Map((depts || []).map((d) => [d.id, d.name]));
        const desigById = new Map((desigs || []).map((d) => [d.id, d.title]));

        setRecipients(
          emps.map((e) => {
            const m = memberById.get(e.workspace_member_id);
            const p = m ? profByUser.get(m.user_id) : null;
            return {
              workspace_member_id: e.workspace_member_id,
              name: p?.full_name || p?.email?.split("@")[0] || "Unnamed employee",
              email: p?.email ?? null,
              designation: e.designation_id ? desigById.get(e.designation_id) ?? null : null,
              department: e.department_id ? deptById.get(e.department_id) ?? null : null,
              joining_date: e.joining_date ?? null,
              employee_code: e.employee_code ?? null,
            };
          })
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the document generator");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeTemplate = templates.find((t) => t.id === templateId) || null;

  /** Applying a template replaces the body unless it has been hand-edited. */
  const applyTemplate = (t: DocTemplate | null) => {
    setTemplateId(t?.id || "");
    setFieldValues({});
    if (!t) {
      if (!bodyDirty) setBody(BLANK_BODY);
      return;
    }
    setBody(t.body);
    setBodyDirty(false);
    if (!title.trim()) setTitle(t.name);
  };

  const selectedRecipient = recipients.find((r) => r.workspace_member_id === recipientMemberId) || null;

  /** Everything the app can answer without asking. */
  const knownValues = useMemo<Record<string, string>>(() => {
    const sig = signatories.find((s) => s.id === signatoryId);
    return {
      today: new Date().toLocaleDateString(),
      employee_name: recipientName,
      recipient_name: recipientName,
      company_name:
        (letterhead?.company_name as string) || activeWorkspace?.name || "",
      company_address: (letterhead?.company_address as string) || "",
      company_tax_id: (letterhead?.tax_id as string) || "",
      employee_code: selectedRecipient?.employee_code || "",
      designation: selectedRecipient?.designation || "",
      department: selectedRecipient?.department || "",
      joining_date: selectedRecipient?.joining_date || "",
      signatory_name: sig?.name || "",
      signatory_designation: sig?.designation || "",
    };
  }, [recipientName, letterhead, activeWorkspace?.name, signatories, signatoryId, selectedRecipient]);

  /** Every token in the body, minus the ones the app already answers. */
  const askFields = useMemo(() => {
    const tokens = extractVariables(body);
    return tokens.filter((t) => !knownValues[t]);
  }, [body, knownValues]);

  const mergedValues = useMemo(
    () => ({ ...knownValues, ...fieldValues }),
    [knownValues, fieldValues]
  );

  const previewHtml = useMemo(
    () => interpolateVariables(body, mergedValues),
    [body, mergedValues]
  );

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  // Split so a workspace's own copy of a library template is not shown as
  // a second, identical-looking row. Adopting a library template
  // deliberately makes a copy, so the same name appearing twice is normal
  // — the grouping is what makes it legible.
  const ownTemplates = useMemo(
    () => filteredTemplates.filter((t) => t.workspace_id !== null),
    [filteredTemplates]
  );
  const libraryTemplates = useMemo(
    () => filteredTemplates.filter((t) => t.workspace_id === null),
    [filteredTemplates]
  );

  const handleIssue = async (status: "Draft" | "Issued") => {
    if (!activeWorkspace?.id) return;
    if (!title.trim()) {
      toast.error("Give the document a title.");
      return;
    }
    if (!recipientName.trim()) {
      toast.error("Choose or type who this document is for.");
      return;
    }
    const unfilled = askFields.filter((f) => !fieldValues[f]?.trim());
    if (status === "Issued" && unfilled.length > 0) {
      toast.error(`Fill in ${unfilled.slice(0, 3).map(humanLabel).join(", ")} before issuing.`);
      return;
    }

    setSaving(true);
    try {
      const { data: allocatedNumber, error: numberError } = await supabase.rpc(
        "next_document_number",
        { p_workspace_id: activeWorkspace.id, p_prefix: "HR" }
      );
      if (numberError) throw numberError;

      const { data: { user } } = await supabase.auth.getUser();
      const signatory = signatories.find((s) => s.id === signatoryId) || null;

      const { data: newDoc, error } = await supabase
        .from("official_documents")
        .insert({
          workspace_id: activeWorkspace.id,
          document_number: allocatedNumber,
          title: title.trim(),
          linked_entity_type: recipientMemberId ? "Employee" : "Custom",
          linked_entity_id: recipientMemberId || null,
          recipient_name: recipientName.trim(),
          recipient_email: recipientEmail.trim() || null,
          status,
          // Re-interpolated with the number actually allocated.
          body_html: interpolateVariables(body, {
            ...mergedValues,
            document_number: allocatedNumber,
          }),
          template_snapshot_json: { template_id: templateId || null, body },
          letterhead_snapshot_json: letterhead,
          signatory_snapshot_json: signatory,
          signatory_id: signatoryId || null,
          issued_by: user?.id ?? null,
          issued_date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();
      if (error) throw error;

      toast.success(status === "Issued" ? "Official document issued." : "Saved as a draft.");
      router.push(`/documents/${newDoc.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue the document");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-xs text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading document generator…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-foreground">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 text-xs">
          <ArrowLeft className="size-3.5" /> Back to vault
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleIssue("Draft")}
            disabled={saving}
            className="h-9 text-xs"
          >
            Save as draft
          </Button>
          <Button
            onClick={() => handleIssue("Issued")}
            disabled={saving}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Issue official document
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          {/* Step 1 — template */}
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                1
              </span>
              <h2 className="text-sm font-semibold">Choose a template</h2>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search offer letter, relieving, promotion…"
                className="h-9 pl-8 text-xs"
              />
            </div>

            <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => applyTemplate(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                  templateId === ""
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                )}
              >
                <PencilLine className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium">Blank document</span>
                {templateId === "" && <Check className="ml-auto size-3.5 text-primary" />}
              </button>

              {[
                { label: "Your templates", items: ownTemplates },
                { label: "Ready-made library", items: libraryTemplates },
              ].map(({ label, items }) =>
                items.length === 0 ? null : (
                  <div key={label} className="space-y-1.5">
                    <p className="px-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    {items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          templateId === t.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5 shrink-0 text-primary" />
                          <span className="truncate text-xs font-medium">{t.name}</span>
                          {templateId === t.id && (
                            <Check className="ml-auto size-3.5 shrink-0 text-primary" />
                          )}
                        </div>
                        {t.description && (
                          <p className="mt-0.5 line-clamp-1 pl-5 text-[11px] text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )
              )}

              {filteredTemplates.length === 0 && (
                <p className="py-4 text-center text-[11px] text-muted-foreground">
                  Nothing matches. Manage templates in{" "}
                  <Link href="/settings?tab=templates" className="text-primary underline">
                    Settings &rarr; Templates
                  </Link>
                  .
                </p>
              )}
            </div>
          </Card>

          {/* Step 2 — who it is for */}
          <Card className="space-y-3 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                2
              </span>
              <h2 className="text-sm font-semibold">Who is it for?</h2>
            </div>

            {recipients.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  <Users className="mr-1 inline size-3" /> Pick an employee
                </Label>
                <select
                  value={recipientMemberId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRecipientMemberId(id);
                    const r = recipients.find((x) => x.workspace_member_id === id);
                    if (r) {
                      setRecipientName(r.name);
                      setRecipientEmail(r.email || "");
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                >
                  <option value="">Someone else (type below)</option>
                  {recipients.map((r) => (
                    <option key={r.workspace_member_id} value={r.workspace_member_id}>
                      {r.name}
                      {r.designation ? ` — ${r.designation}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Choosing an employee fills their designation, department and joining date automatically.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recipient name *</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recipient email</Label>
                <Input
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Document title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Signed by</Label>
                <select
                  value={signatoryId}
                  onChange={(e) => setSignatoryId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                >
                  <option value="">No signatory</option>
                  {signatories.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              The document number is assigned automatically when you issue it.
            </p>
          </Card>

          {/* Step 3 — the fields this template needs */}
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                3
              </span>
              <h2 className="text-sm font-semibold">Fill in the details</h2>
            </div>

            {askFields.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                This document needs nothing more — everything is filled in already.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {askFields.map((f) => {
                  const kind = inputKindFor(f);
                  return (
                    <div
                      key={f}
                      className={cn("space-y-1.5", kind === "long" && "col-span-2")}
                    >
                      <Label className="text-xs font-semibold">{humanLabel(f)}</Label>
                      {kind === "long" ? (
                        <Textarea
                          plain
                          rows={3}
                          value={fieldValues[f] || ""}
                          onChange={(e) =>
                            setFieldValues((p) => ({ ...p, [f]: e.target.value }))
                          }
                          className="text-xs"
                        />
                      ) : (
                        <Input
                          type={kind === "date" ? "date" : "text"}
                          value={fieldValues[f] || ""}
                          onChange={(e) =>
                            setFieldValues((p) => ({ ...p, [f]: e.target.value }))
                          }
                          className="text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Body */}
          <Card className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Document body</h2>
              {activeTemplate && bodyDirty && (
                <button
                  type="button"
                  onClick={() => {
                    setBody(activeTemplate.body);
                    setBodyDirty(false);
                  }}
                  className="text-[11px] text-primary underline"
                >
                  Reset to template
                </button>
              )}
            </div>
            {/* `plain`: this is HTML source, so the rich-text editor would
                wrap it in more HTML. */}
            <Textarea
              plain
              rows={10}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setBodyDirty(true);
              }}
              className="font-mono text-[11px]"
            />
            <p className="text-[10px] text-muted-foreground">
              Anything in double braces, like {"{{employee_name}}"}, becomes a field above.
            </p>
          </Card>
        </div>

        {/* Live preview */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Live document canvas
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
              <Sparkles className="size-3" /> Realtime preview
            </span>
          </div>

          <div className="max-h-[750px] overflow-auto rounded-2xl border border-border bg-muted/40 p-4">
            <A4DocumentPreview
              letterhead={letterhead}
              bodyHtml={previewHtml}
              documentNumber="Assigned on issue"
              date={new Date().toLocaleDateString()}
              recipientName={recipientName}
              signatory={signatories.find((s) => s.id === signatoryId) || null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
