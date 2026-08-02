"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, FileText, Send, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { interpolateVariables } from "@/lib/documents/variable-engine";
import { extractVariables } from "@/lib/templates/catalog";
import { sanitizeHtml } from "@/lib/markdown-utils";
import { IconAction } from "@/components/ui/icon-action";

interface LetterTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  body: string;
  variables: string[] | null;
  workspace_id: string | null;
}

interface IssuedDocument {
  id: string;
  document_number: string;
  title: string;
  status: string;
  issued_date: string;
}

/** Employee context the letters can draw on without being typed in. */
export interface EmployeeLetterContext {
  employee_name: string;
  employee_code: string | null;
  designation: string | null;
  department: string | null;
  joining_date: string | null;
  email: string | null;
  salary: string | null;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

/**
 * Issue an HR letter for this employee from the document template
 * library — offer letter, appointment letter, promotion, experience
 * certificate and the rest.
 *
 * The templates are seeded by migration 088 as `templates` rows with
 * module 'hr' and channel 'document'. Issuing one writes an
 * `official_documents` row, so it inherits the numbering, the letterhead
 * and signatory snapshots, and the immutability trigger from the
 * documents platform rather than reimplementing any of it.
 */
export function EmployeeLettersTab({
  workspaceMemberId,
  context,
  canEdit,
}: {
  workspaceMemberId: string;
  context: EmployeeLetterContext;
  canEdit: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [issued, setIssued] = useState<IssuedDocument[]>([]);
  const [signatories, setSignatories] = useState<{ id: string; name: string; designation: string }[]>([]);
  const [letterhead, setLetterhead] = useState<Record<string, unknown> | null>(null);

  const [active, setActive] = useState<LetterTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatoryId, setSignatoryId] = useState<string>("");
  const [issuing, setIssuing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const [tplRes, docRes, sigRes, lhRes] = await Promise.all([
        supabase
          .from("templates")
          .select("id, name, description, category, body, variables, workspace_id")
          .eq("module", "hr")
          .eq("channel", "document")
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("official_documents")
          .select("id, document_number, title, status, issued_date")
          .eq("workspace_id", activeWorkspace.id)
          .eq("linked_entity_type", "Employee")
          .eq("linked_entity_id", workspaceMemberId)
          .is("deleted_at", null)
          .order("issued_date", { ascending: false }),
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
      ]);

      setTemplates((tplRes.data as LetterTemplate[] | null) || []);
      setIssued((docRes.data as IssuedDocument[] | null) || []);
      setSignatories(sigRes.data || []);
      setLetterhead((lhRes.data as Record<string, unknown> | null) || null);
      if (sigRes.data?.[0]) setSignatoryId(sigRes.data[0].id);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load letter templates"));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, workspaceMemberId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Values the employee record already answers, so they are not asked for. */
  const knownValues = useMemo<Record<string, string>>(() => {
    const company = (letterhead?.company_name as string) || activeWorkspace?.name || "";
    return {
      today: new Date().toLocaleDateString(),
      employee_name: context.employee_name,
      employee_code: context.employee_code || "",
      designation: context.designation || "",
      department: context.department || "",
      joining_date: context.joining_date || "",
      salary: context.salary || "",
      company_name: company,
      signatory_name: signatories.find((s) => s.id === signatoryId)?.name || "",
      signatory_designation: signatories.find((s) => s.id === signatoryId)?.designation || "",
    };
  }, [context, letterhead, activeWorkspace?.name, signatories, signatoryId]);

  /** Tokens the template needs that the employee record cannot answer. */
  const missingFields = useMemo(() => {
    if (!active) return [];
    const needed = active.variables?.length
      ? active.variables
      : extractVariables(active.body);
    return needed.filter((v) => !knownValues[v]);
  }, [active, knownValues]);

  const previewHtml = useMemo(() => {
    if (!active) return "";
    return interpolateVariables(active.body, { ...knownValues, ...fieldValues });
  }, [active, knownValues, fieldValues]);

  const openTemplate = (t: LetterTemplate) => {
    setActive(t);
    setFieldValues({});
  };

  const handleIssue = async (status: "Draft" | "Issued") => {
    if (!activeWorkspace?.id || !active) return;

    const stillMissing = missingFields.filter((f) => !fieldValues[f]?.trim());
    if (status === "Issued" && stillMissing.length > 0) {
      toast.error(`Fill in ${stillMissing.slice(0, 3).join(", ")} before issuing.`);
      return;
    }

    setIssuing(true);
    try {
      // Numbering is allocated in the database — the client has no counter
      // and would otherwise repeat the same number for every letter.
      const { data: number, error: numberError } = await supabase.rpc("next_document_number", {
        p_workspace_id: activeWorkspace.id,
        p_prefix: "HR",
      });
      if (numberError) throw numberError;

      const { data: { user } } = await supabase.auth.getUser();
      const signatory = signatories.find((s) => s.id === signatoryId) || null;

      const { data: doc, error } = await supabase
        .from("official_documents")
        .insert({
          workspace_id: activeWorkspace.id,
          document_number: number,
          title: active.name,
          linked_entity_type: "Employee",
          linked_entity_id: workspaceMemberId,
          recipient_name: context.employee_name,
          recipient_email: context.email,
          status,
          body_html: interpolateVariables(active.body, { ...knownValues, ...fieldValues }),
          template_snapshot_json: { template_id: active.id, name: active.name, body: active.body },
          letterhead_snapshot_json: letterhead,
          signatory_snapshot_json: signatory,
          signatory_id: signatoryId || null,
          issued_by: user?.id ?? null,
          issued_date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();
      if (error) throw error;

      toast.success(status === "Issued" ? "Letter issued." : "Saved as a draft.");
      setActive(null);
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to issue the letter"));
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 text-primary" /> Issue a letter
          </CardTitle>
          <CardDescription>
            Offer letters, appointment letters, promotions, certificates and more — filled in from
            this employee&rsquo;s record and issued on your company letterhead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No HR letter templates found. They are seeded with the template library —{" "}
              <Link href="/settings?tab=templates" className="text-primary underline">
                check Settings &rarr; Templates
              </Link>
              .
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => openTemplate(t)}
                  className="flex flex-col items-start rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 disabled:opacity-60"
                >
                  <div className="mb-1 flex w-full items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{t.name}</span>
                    {t.workspace_id === null && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">Library</Badge>
                    )}
                  </div>
                  {t.description && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Letters issued to this employee</CardTitle>
        </CardHeader>
        <CardContent>
          {issued.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nothing issued yet.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {issued.map((d) => (
                <Link
                  key={d.id}
                  href={`/documents/${d.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {d.document_number} · {d.issued_date}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(active)} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{active?.name}</DialogTitle>
            <DialogDescription>
              Details already on the employee record are filled in automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {signatories.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Signed by</Label>
                <Select value={signatoryId} onValueChange={setSignatoryId}>
                  <SelectTrigger><SelectValue placeholder="Select a signatory…" /></SelectTrigger>
                  <SelectContent>
                    {signatories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {missingFields.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold">Details this letter still needs</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {missingFields.map((f) => (
                    <div key={f} className="space-y-1.5">
                      <Label className="text-xs capitalize">{f.replace(/_/g, " ")}</Label>
                      <Input
                        value={fieldValues[f] || ""}
                        onChange={(e) =>
                          setFieldValues((prev) => ({ ...prev, [f]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold">Preview</p>
              <div
                className="prose prose-sm max-w-none rounded-lg border border-border bg-white p-6 text-slate-800 dark:bg-slate-50"
                // Sanitised on the way in: template bodies are workspace
                // authored, and interpolated values are HTML-escaped by the
                // variable engine.
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
              />
            </div>

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" />
              Issuing records the letter against this employee with its own number, and freezes
              the content — an issued letter cannot be edited afterwards.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button
              variant="outline"
              onClick={() => handleIssue("Draft")}
              disabled={issuing}
            >
              Save as draft
            </Button>
            <IconAction label="Issue letter" icon={issuing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} onClick={() => handleIssue("Issued")} disabled={issuing} className="gap-1.5" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
