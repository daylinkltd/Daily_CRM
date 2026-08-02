"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { A4DocumentPreview } from "@/components/documents/a4-document-preview";
import { interpolateVariables } from "@/lib/documents/variable-engine";
import { generateDocumentNumber } from "@/lib/documents/numbering-generator";
import {
  FileText,
  Save,
  Loader2,
  Printer,
  UserCheck,
  CheckCircle2,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function IssueNewDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get("templateId");

  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Workspace Data
  const [templates, setTemplates] = useState<any[]>([]);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [letterhead, setLetterhead] = useState<any | null>(null);

  // Document Fields
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateIdParam || "");
  const [selectedSignatoryId, setSelectedSignatoryId] = useState<string>("");
  const [title, setTitle] = useState("Official Employment Offer Letter");
  const [docNumber, setDocNumber] = useState(generateDocumentNumber("HR", 1));
  const [recipientName, setRecipientName] = useState("Alex Morgan");
  const [recipientEmail, setRecipientEmail] = useState("alex@example.com");

  // Dynamic Variable Inputs
  const [employeeDesignation, setEmployeeDesignation] = useState("Senior Software Engineer");
  const [employeeJoiningDate, setEmployeeJoiningDate] = useState("2026-09-01");
  const [employeeSalary, setEmployeeSalary] = useState("$120,000 / Year");

  // Template Body
  const [rawHtml, setRawHtml] = useState(`
<h2>Employment Offer Letter</h2>
<p>Date: {{today}}</p>
<p>To,</p>
<p><strong>{{employee.name}}</strong><br/>
Email: {{employee.email}}</p>

<p>Dear <strong>{{employee.name}}</strong>,</p>
<p>We are pleased to offer you the position of <strong>{{employee.designation}}</strong> at <strong>{{company.name}}</strong> starting on <strong>{{employee.joining_date}}</strong>.</p>
<p>Your annual remuneration (CTC) will be <strong>{{employee.salary}}</strong> as discussed during the evaluation process.</p>

<p>Sincerely,</p>
<p><strong>{{company.name}}</strong></p>
  `.trim());

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      // 1. Templates
      const { data: tpls } = await supabase
        .from("document_templates")
        .select("*")
        .eq("workspace_id", activeWorkspace.id);
      setTemplates(tpls || []);

      // 2. Signatories
      const { data: sigs } = await supabase
        .from("company_signatories")
        .select("*")
        .eq("workspace_id", activeWorkspace.id);
      setSignatories(sigs || []);
      if (sigs && sigs.length > 0) {
        const defaultSig = sigs.find((s) => s.is_default) || sigs[0];
        setSelectedSignatoryId(defaultSig.id);
      }

      // 3. Letterhead
      const { data: lh } = await supabase
        .from("company_letterhead_configs")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .maybeSingle();
      setLetterhead(lh || null);

      // If template ID passed, load template body
      if (templateIdParam && tpls) {
        const found = tpls.find((t) => t.id === templateIdParam);
        if (found) {
          setTitle(found.name);
          setRawHtml(found.body_html);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load document resources.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, templateIdParam, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Context Data for Variable Interpolation. Parameterised on the document
  // number because the real number is only allocated when the document is
  // issued — the preview shows a provisional one.
  const buildContextData = (documentNumber: string) => ({
    employee: {
      name: recipientName,
      email: recipientEmail,
      designation: employeeDesignation,
      joining_date: employeeJoiningDate,
      salary: employeeSalary,
    },
    company: {
      name: letterhead?.company_name || activeWorkspace?.name || "Company Name",
      tagline: letterhead?.tagline || "",
    },
    today: new Date().toLocaleDateString(),
    document: {
      number: documentNumber,
      title,
    },
  });

  const finalHtml = interpolateVariables(rawHtml, buildContextData(docNumber));
  const activeSignatory = signatories.find((s) => s.id === selectedSignatoryId) || null;

  const handleIssueDocument = async (status: "Draft" | "Issued" = "Issued") => {
    if (!activeWorkspace?.id || !title.trim() || !recipientName.trim()) {
      toast.error("Please fill in document title and recipient name.");
      return;
    }

    setSaving(true);
    try {
      // Allocate the number atomically at issue time. Doing it in the DB is
      // what makes it unique — the client-side formatter has no counter and
      // returned the same number for every document.
      const { data: allocatedNumber, error: numberError } = await supabase.rpc(
        "next_document_number",
        { p_workspace_id: activeWorkspace.id, p_prefix: "HR" }
      );
      if (numberError) throw numberError;

      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        workspace_id: activeWorkspace.id,
        template_id: selectedTemplateId || null,
        document_number: allocatedNumber,
        issued_by: user?.id ?? null,
        title,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        status,
        // Re-interpolated so the stored body carries the number actually
        // allocated, not the provisional one shown in the preview.
        body_html: interpolateVariables(rawHtml, buildContextData(allocatedNumber as string)),

        // Immutable Snapshots
        template_snapshot_json: { rawHtml, templateId: selectedTemplateId },
        letterhead_snapshot_json: letterhead,
        signatory_snapshot_json: activeSignatory,

        signatory_id: selectedSignatoryId || null,
        issued_date: new Date().toISOString().split("T")[0],
      };

      const { data: newDoc, error } = await supabase
        .from("official_documents")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast.success(status === "Issued" ? "Official document issued successfully!" : "Document saved as draft!");
      router.push(`/documents/${newDoc.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to issue document.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading Document Generator...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-foreground">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-xs gap-1">
          <ArrowLeft className="size-3.5" /> Back to Vault
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleIssueDocument("Draft")}
            disabled={saving}
            className="text-xs h-9"
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleIssueDocument("Issued")}
            disabled={saving}
            className="bg-primary text-primary-foreground text-xs h-9 font-semibold gap-1.5 shadow-xs"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Issue Official Document
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Control Panel */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-card border-border shadow-xs rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Document &amp; Recipient Details</h3>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Document Title *</Label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Document Number</Label>
                <Input
                  type="text"
                  value={docNumber}
                  readOnly
                  disabled
                  className="bg-muted text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Assigned automatically when the document is issued.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Signatory</Label>
                <select
                  value={selectedSignatoryId}
                  onChange={(e) => setSelectedSignatoryId(e.target.value)}
                  className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2"
                >
                  <option value="">No Signatory</option>
                  {signatories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.designation})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recipient Full Name *</Label>
                <Input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recipient Email</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>
            </div>

            <h4 className="text-xs font-bold text-foreground pt-2">Dynamic Handlebar Variables</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Designation</Label>
                <Input
                  type="text"
                  value={employeeDesignation}
                  onChange={(e) => setEmployeeDesignation(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Joining Date</Label>
                <Input
                  type="date"
                  value={employeeJoiningDate}
                  onChange={(e) => setEmployeeJoiningDate(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Salary / Compensation</Label>
              <Input
                type="text"
                value={employeeSalary}
                onChange={(e) => setEmployeeSalary(e.target.value)}
                className="bg-background text-xs"
              />
            </div>
          </Card>
        </div>

        {/* Right Live A4 Canvas Preview */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Document Canvas</span>
            <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
              <Sparkles className="size-3" /> Realtime Preview
            </span>
          </div>

          <div className="bg-muted/40 p-4 rounded-2xl border border-border overflow-auto max-h-[750px]">
            <A4DocumentPreview
              letterhead={letterhead}
              bodyHtml={finalHtml}
              documentNumber={docNumber}
              date={new Date().toLocaleDateString()}
              recipientName={recipientName}
              signatory={activeSignatory}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
