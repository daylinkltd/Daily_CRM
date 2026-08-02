"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Save, Wallet, History, Info, AlertTriangle } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  computeSalaryBreakdown,
  basicForTargetGross,
  validateStructure,
  round2,
  type SalaryComponent,
  type PayrollField,
} from "@/lib/hr/salary";
import { assertAffected } from "@/lib/supabase/affected-rows";

const NONE = "none";

interface StructureRow {
  id: string;
  name: string;
  min_basic_percent: number | null;
}

interface RevisionRow {
  id: string;
  effective_from: string;
  ctc_annual: number;
  reason: string | null;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    // An unrecognised currency code must not blank the whole payslip.
    return `${currency} ${n.toFixed(2)}`;
  }
};

/**
 * Compensation for one employee.
 *
 * A structure supplies the shape (which allowances, at what rates); the
 * basic salary supplies the scale. The computed values are written to
 * the six flat columns on employee_profiles that the payroll processor
 * and the ledger posting rule actually read, so assigning a structure
 * changes nothing downstream.
 */
export function EmployeeCompensationTab({
  workspaceMemberId,
  canEdit,
}: {
  workspaceMemberId: string;
  canEdit: boolean;
}) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const currency = (activeWorkspace as { default_currency?: string } | null)?.default_currency || "INR";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);

  const [structureId, setStructureId] = useState<string>(NONE);
  const [basic, setBasic] = useState("0");
  const [targetGross, setTargetGross] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id || !workspaceMemberId) return;
    setLoading(true);
    try {
      const [structRes, empRes, revRes] = await Promise.all([
        supabase
          .from("hr_salary_structures")
          .select("id, name, min_basic_percent")
          .eq("workspace_id", activeWorkspace.id)
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("employee_profiles")
          .select("basic_salary, salary_structure_id, ctc_annual, salary_effective_from")
          .eq("workspace_member_id", workspaceMemberId)
          .maybeSingle(),
        supabase
          .from("hr_salary_revisions")
          .select("id, effective_from, ctc_annual, reason")
          .eq("workspace_member_id", workspaceMemberId)
          .order("effective_from", { ascending: false })
          .limit(10),
      ]);

      setStructures((structRes.data as StructureRow[] | null) || []);
      setRevisions((revRes.data as RevisionRow[] | null) || []);

      const emp = empRes.data;
      if (emp) {
        setBasic(String(emp.basic_salary ?? 0));
        setStructureId(emp.salary_structure_id || NONE);
        if (emp.salary_effective_from) setEffectiveFrom(emp.salary_effective_from);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load compensation"));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, workspaceMemberId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Components belong to the selected structure, so they reload on change.
  useEffect(() => {
    if (structureId === NONE || !activeWorkspace?.id) {
      setComponents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("hr_salary_structure_components")
        .select(
          "sort_order, value_override, calculation_type, hr_salary_components(id, name, code, type, calculation_type, value_number, is_statutory, payroll_field, sort_order)"
        )
        .eq("structure_id", structureId);
      if (cancelled) return;

      type JoinRow = {
        sort_order: number | null;
        value_override: number | null;
        calculation_type: string | null;
        hr_salary_components: SalaryComponent | SalaryComponent[] | null;
      };

      const mapped: SalaryComponent[] = ((data as JoinRow[] | null) || [])
        .map((row) => {
          // PostgREST returns an object for a to-one embed but an array
          // when it cannot prove cardinality.
          const c = Array.isArray(row.hr_salary_components)
            ? row.hr_salary_components[0]
            : row.hr_salary_components;
          if (!c) return null;
          return {
            ...c,
            // The join row may override the component's own rate, so the
            // same head can sit in two structures at different values.
            value_number: row.value_override ?? c.value_number,
            calculation_type: (row.calculation_type ||
              c.calculation_type) as SalaryComponent["calculation_type"],
            sort_order: row.sort_order ?? c.sort_order,
          } as SalaryComponent;
        })
        .filter((c): c is SalaryComponent => c !== null);

      setComponents(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [structureId, activeWorkspace?.id, supabase]);

  const basicNumber = Number(basic) || 0;
  const breakdown = useMemo(
    () => computeSalaryBreakdown(components, basicNumber),
    [components, basicNumber]
  );

  const selectedStructure = structures.find((s) => s.id === structureId);
  const problems = useMemo(
    () =>
      components.length > 0
        ? validateStructure(components, selectedStructure?.min_basic_percent ?? 0)
        : [],
    [components, selectedStructure]
  );

  const applyTargetGross = () => {
    const target = Number(targetGross);
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("Enter the monthly gross you want to work back from.");
      return;
    }
    const derived = basicForTargetGross(components, target);
    setBasic(String(derived));
    toast.success(`Basic set to ${money(derived, currency)} to reach that gross.`);
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    if (basicNumber < 0) {
      toast.error("Basic salary cannot be negative.");
      return;
    }

    setSaving(true);
    try {
      // Write the derived values into the six flat columns payroll reads.
      const fields = breakdown.payrollFields;
      const patch: Record<string, unknown> = {
        salary_structure_id: structureId === NONE ? null : structureId,
        ctc_annual: breakdown.ctcAnnual,
        salary_effective_from: effectiveFrom,
      };
      if (structureId === NONE) {
        // No structure: basic is entered directly and nothing is derived.
        patch.basic_salary = round2(basicNumber);
      } else {
        (Object.keys(fields) as PayrollField[]).forEach((f) => {
          patch[f] = fields[f];
        });
      }

      // Must be verified BEFORE the revision row is written: reporting a
      // zero-row update as success also logged a pay revision, so the
      // history showed a raise that was never actually applied.
      const result = await supabase
        .from("employee_profiles")
        .update(patch)
        .eq("workspace_member_id", workspaceMemberId)
        .select("workspace_member_id");
      assertAffected(result, "this employee's compensation", "save");

      // Record the revision so a pay change is auditable.
      const { error: revError } = await supabase.from("hr_salary_revisions").insert({
        workspace_id: activeWorkspace.id,
        workspace_member_id: workspaceMemberId,
        effective_from: effectiveFrom,
        structure_id: structureId === NONE ? null : structureId,
        ctc_annual: breakdown.ctcAnnual,
        breakdown_json: {
          basic: breakdown.basic,
          earnings: breakdown.earnings,
          deductions: breakdown.deductions,
          gross_monthly: breakdown.grossMonthly,
          net_monthly: breakdown.netMonthly,
        },
        reason: reason || null,
      });
      // A failed history write must not read as a failed salary change —
      // the salary itself is already saved.
      if (revError) {
        toast.warning("Salary saved, but the revision history entry could not be written.");
      } else {
        toast.success("Compensation saved.");
      }

      setReason("");
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save compensation"));
    } finally {
      setSaving(false);
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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" /> Salary structure
            </CardTitle>
            <CardDescription>
              Pick a slab and set the basic. Allowances and deductions are derived from the slab.
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="shrink-0 gap-1.5">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Structure</Label>
              <Select value={structureId} onValueChange={setStructureId} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None — enter basic only</SelectItem>
                  {structures.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {structures.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No structures yet —{" "}
                  <Link href="/settings?tab=hr" className="text-primary underline">
                    create one in HR settings
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Monthly basic salary</Label>
              <Input
                type="number"
                min={0}
                value={basic}
                onChange={(e) => setBasic(e.target.value)}
                disabled={!canEdit}
                className="font-mono"
              />
            </div>
          </div>

          {components.length > 0 && canEdit && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <Label className="text-xs font-semibold">Work back from a monthly gross</Label>
                <Input
                  type="number"
                  min={0}
                  value={targetGross}
                  onChange={(e) => setTargetGross(e.target.value)}
                  placeholder="e.g. 50000"
                  className="font-mono"
                />
              </div>
              <Button type="button" variant="outline" onClick={applyTargetGross}>
                Set basic
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Effective from</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for change</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Annual increment"
                disabled={!canEdit}
              />
            </div>
          </div>

          {problems.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              {problems.map((p) => (
                <p key={p} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {p}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {components.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly breakdown</CardTitle>
            <CardDescription>
              What this employee earns and what is deducted, at the basic above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Earnings
                </p>
                <dl className="space-y-1.5">
                  {breakdown.earnings.map((l) => (
                    <div key={l.component_id} className="flex items-baseline justify-between gap-3 text-sm">
                      <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span className="truncate">{l.name}</span>
                        {l.calculation_type === "PERCENTAGE_OF_BASIC" && (
                          <Badge variant="secondary" className="text-[10px]">{l.rate}%</Badge>
                        )}
                      </dt>
                      <dd className="shrink-0 font-mono font-medium">{money(l.amount, currency)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
                    <dt>Gross</dt>
                    <dd className="font-mono">{money(breakdown.grossMonthly, currency)}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Deductions
                </p>
                <dl className="space-y-1.5">
                  {breakdown.deductions.length === 0 && (
                    <p className="text-sm text-muted-foreground">None</p>
                  )}
                  {breakdown.deductions.map((l) => (
                    <div key={l.component_id} className="flex items-baseline justify-between gap-3 text-sm">
                      <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span className="truncate">{l.name}</span>
                        {l.is_statutory && (
                          <Badge variant="secondary" className="text-[10px]">Statutory</Badge>
                        )}
                      </dt>
                      <dd className="shrink-0 font-mono font-medium">-{money(l.amount, currency)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
                    <dt>Total deductions</dt>
                    <dd className="font-mono">-{money(breakdown.totalDeductions, currency)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Net monthly</p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {money(breakdown.netMonthly, currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Gross monthly</p>
                <p className="font-mono text-lg font-semibold text-foreground">
                  {money(breakdown.grossMonthly, currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Annual CTC</p>
                <p className="font-mono text-lg font-semibold text-foreground">
                  {money(breakdown.ctcAnnual, currency)}
                </p>
              </div>
            </div>

            <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" />
              Annual CTC here is gross annualised. Employer-side contributions are not modelled,
              so it is not &ldquo;gross plus employer PF&rdquo;.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" /> Revision history
          </CardTitle>
          <CardDescription>Every recorded change to this employee&rsquo;s pay.</CardDescription>
        </CardHeader>
        <CardContent>
          {revisions.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No salary revisions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {revisions.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.effective_from}</p>
                    {r.reason && <p className="truncate text-xs text-muted-foreground">{r.reason}</p>}
                  </div>
                  <p className="shrink-0 font-mono text-sm">{money(r.ctc_annual, currency)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
