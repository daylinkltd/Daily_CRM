"use client";

/**
 * Employee Handbook — company details first, then a generated
 * 13-section handbook living inside the existing Policies machinery
 * (versioned content, publish flow, signed acknowledgements).
 *
 * Flow: HR fills Company Details → Generate → sections appear as
 * DRAFT policies → HR reviews/edits/publishes in Policies →
 * employees read & digitally sign each section → progress tracked
 * here. Regenerating only creates missing sections; edits are never
 * overwritten.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookMarked, Building2, Check, ChevronDown, ChevronRight, Loader2, Sparkles,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface SectionStatus {
  order: number;
  key: string;
  title: string;
  mandatory: boolean;
  policy_id: string | null;
  status: string | null;
  acknowledged: number;
}

interface DetailsForm {
  legal_name: string;
  brand_name: string;
  director_name: string;
  registered_address: string;
  website: string;
  contact_email: string;
  welcome_message: string;
  vision: string;
  mission: string;
  core_values: string;
  office_start: string;
  office_end: string;
  working_days: string;
  lunch_minutes: string;
  break_minutes: string;
  probation_months: string;
  notice_period_days: string;
  payroll_cycle: string;
  salary_day: string;
  casual_leave_days: string;
  sick_leave_days: string;
  earned_leave_days: string;
  posh_committee: string;
}

const BLANK: DetailsForm = {
  legal_name: "", brand_name: "", director_name: "", registered_address: "",
  website: "", contact_email: "", welcome_message: "", vision: "", mission: "",
  core_values: "", office_start: "09:30", office_end: "18:30",
  working_days: "Monday to Friday", lunch_minutes: "45", break_minutes: "15",
  probation_months: "3", notice_period_days: "30", payroll_cycle: "Monthly",
  salary_day: "7", casual_leave_days: "12", sick_leave_days: "6",
  earned_leave_days: "15", posh_committee: "",
};

const NUMERIC_FIELDS: (keyof DetailsForm)[] = [
  "lunch_minutes", "break_minutes", "probation_months", "notice_period_days",
  "salary_day", "casual_leave_days", "sick_leave_days", "earned_leave_days",
];

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  PENDING_APPROVAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PUBLISHED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  ARCHIVED: "bg-muted/10 text-muted-foreground border-border/20",
};

export default function HandbookPage() {
  const router = useRouter();
  const supabase = createClient();
  const { activeWorkspace, activeRole, activeMember, can } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const isAdmin = activeRole === "owner" || activeRole === "admin";
  const canView = can("people_view");

  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [sections, setSections] = useState<SectionStatus[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [form, setForm] = useState<DetailsForm>({ ...BLANK });
  const [hasDetails, setHasDetails] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/handbook?workspace_id=${workspaceId}`);
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "MIGRATION_078_PENDING") {
          setMigrationPending(true);
          return;
        }
        throw new Error(json.error || "Failed to load handbook status");
      }
      setSections(json.sections ?? []);
      setMemberCount(json.member_count ?? 0);
      setMissing(json.missing ?? []);
      const d = json.details;
      setHasDetails(!!d);
      setDetailsOpen(!d || (json.missing ?? []).length > 0);
      if (d) {
        setForm((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(prev) as (keyof DetailsForm)[]) {
            if (d[k] !== null && d[k] !== undefined) next[k] = String(d[k]);
          }
          return next;
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load handbook");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generated = useMemo(() => sections.filter((s) => s.policy_id).length, [sections]);

  async function handleSaveDetails() {
    if (!workspaceId || !activeMember?.id) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { workspace_id: workspaceId, updated_by: activeMember.id };
      for (const [k, v] of Object.entries(form)) {
        payload[k] = NUMERIC_FIELDS.includes(k as keyof DetailsForm)
          ? Number(v) || 0
          : v.trim() || null;
      }
      const { error } = await supabase.from("company_details").upsert(payload, { onConflict: "workspace_id" });
      if (error) throw error;
      toast.success("Company details saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!workspaceId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/hr/handbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate handbook");
      toast.success(
        json.created > 0
          ? `${json.created} section${json.created === 1 ? "" : "s"} generated as drafts`
          : "All sections already exist — nothing to generate"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate handbook");
    } finally {
      setGenerating(false);
    }
  }

  function field(label: string, key: keyof DetailsForm, props: { textarea?: boolean; placeholder?: string; type?: string } = {}) {
    const required = ["legal_name", "director_name", "vision", "mission", "core_values"].includes(key);
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
        {props.textarea ? (
          <Textarea
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={props.placeholder}
            rows={2}
          />
        ) : (
          <Input
            type={props.type ?? "text"}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={props.placeholder}
          />
        )}
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState icon={BookMarked} title="Access denied" description="You need HR access to view the handbook." />
      </div>
    );
  }

  return (
    <div className="p-(--page-padding-desktop) space-y-5">
      <PageHeader
        title="Employee Handbook"
        description="Company details feed a 13-section handbook. Sections publish through Policies and employees sign digitally."
        badge={
          generated > 0 ? (
            <span className="inline-flex h-6 items-center border border-emerald-500/20 bg-emerald-500/10 px-2 text-xs font-medium text-emerald-400">
              {generated}/13 sections
            </span>
          ) : undefined
        }
        actions={
          isAdmin ? (
            <Button onClick={handleGenerate} disabled={generating || migrationPending || missing.length > 0}>
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {generated > 0 ? "Generate Missing Sections" : "Generate Handbook"}
            </Button>
          ) : undefined
        }
      />

      {migrationPending ? (
        <EmptyState
          icon={BookMarked}
          title="Company details table not set up yet"
          description="Apply migration 078 to this database, then reload."
        />
      ) : (
        <>
          {/* ── company details ─────────────────────────── */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setDetailsOpen((o) => !o)}
            >
              <CardTitle className="flex items-center gap-2 text-base">
                {detailsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <Building2 className="size-4" />
                Company Details
                {hasDetails && missing.length === 0 && (
                  <span className="inline-flex h-5 items-center gap-1 border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-400">
                    <Check className="size-3" /> complete
                  </span>
                )}
                {missing.length > 0 && (
                  <span className="inline-flex h-5 items-center border border-yellow-500/20 bg-yellow-500/10 px-1.5 text-[11px] font-medium text-yellow-400">
                    {missing.length} required field{missing.length === 1 ? "" : "s"} missing
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            {detailsOpen && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {field("Legal name", "legal_name", { placeholder: "Daylink Tech Labs Private Limited" })}
                  {field("Brand name", "brand_name", { placeholder: "Daylink" })}
                  {field("Director name", "director_name")}
                  {field("Registered address", "registered_address")}
                  {field("Website", "website")}
                  {field("HR contact email", "contact_email")}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {field("Director's welcome message", "welcome_message", { textarea: true, placeholder: "Optional — a default is used if empty" })}
                  {field("Vision", "vision", { textarea: true })}
                  {field("Mission", "mission", { textarea: true })}
                  {field("Core values (one per line)", "core_values", { textarea: true, placeholder: "Ownership\nCraft\nClient trust" })}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {field("Office start", "office_start", { placeholder: "09:30" })}
                  {field("Office end", "office_end", { placeholder: "18:30" })}
                  {field("Working days", "working_days")}
                  {field("Lunch (min)", "lunch_minutes", { type: "number" })}
                  {field("Breaks (min)", "break_minutes", { type: "number" })}
                  {field("Probation (months)", "probation_months", { type: "number" })}
                  {field("Notice period (days)", "notice_period_days", { type: "number" })}
                  {field("Payroll cycle", "payroll_cycle")}
                  {field("Salary day of month", "salary_day", { type: "number" })}
                  {field("Casual leave / yr", "casual_leave_days", { type: "number" })}
                  {field("Sick leave / yr", "sick_leave_days", { type: "number" })}
                  {field("Earned leave / yr", "earned_leave_days", { type: "number" })}
                </div>
                {field("POSH committee (leave empty for the <10 employees Local Committee note)", "posh_committee", { textarea: true })}
                {isAdmin && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveDetails} disabled={saving}>
                      {saving ? <Loader2 className="animate-spin" /> : <Check />} Save Details
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* ── sections ────────────────────────────────── */}
          <Card>
            <CardContent>
              {loading ? (
                <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : generated === 0 ? (
                <EmptyState
                  icon={BookMarked}
                  title="Handbook not generated yet"
                  description={
                    missing.length > 0
                      ? "Complete the required company details above, save, then generate."
                      : "Company details are complete — generate the 13 sections as draft policies."
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acknowledged</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((s) => (
                      <TableRow key={s.key}>
                        <TableCell className="text-muted-foreground">{s.order}</TableCell>
                        <TableCell className="font-medium">
                          {s.title.replace(/^Handbook §\d+ — /, "")}
                          {s.mandatory && (
                            <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">mandatory</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.status ? (
                            <span className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${STATUS_CLASSES[s.status] ?? ""}`}>
                              {s.status.replace("_", " ").toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">not generated</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {s.policy_id ? `${s.acknowledged}/${memberCount}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.policy_id && (
                            <div className="flex items-center justify-end gap-1">
                              {isAdmin && (
                                <Button size="sm" variant="ghost" onClick={() => router.push(`/policies?edit=${s.policy_id}`)}>
                                  Manage
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => router.push(`/policies/${s.policy_id}/read`)}>
                                Read & Sign
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
