"use client";

/**
 * Payroll — real cycles, payslips and postings.
 *
 * Replaces the shell page whose "Process Cycle" button was a toast:
 * processing now generates payslips from employee_profiles salary
 * fields (migration 077), deducts approved advances, and posts
 * DR Salary Expense / CR Salaries Payable; paying posts
 * DR Salaries Payable / CR Cash-Bank. Both run server-side in
 * /api/payroll/cycles/[id].
 *
 * Salaries are edited here too (Salaries dialog) so the module is
 * self-contained until the employee profile UI grows salary fields.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Banknote, ChevronDown, ChevronRight, Loader2, Play, Plus, Users, Wallet,
} from "lucide-react";

import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { IconAction } from "@/components/ui/icon-action";

interface Cycle {
  id: string;
  month: number;
  year: number;
  status: "draft" | "processed" | "paid";
  total_payout: number;
}

interface Payslip {
  id: string;
  workspace_member_id: string;
  total_earnings: number;
  total_deductions: number;
  advance_deduction: number;
  net_payable: number;
  status: string;
}

interface EmployeeSalary {
  workspace_member_id: string;
  employee_code: string | null;
  status: string;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  pf_deduction: number;
  professional_tax: number;
  tds_deduction: number;
  profile?: { full_name: string | null } | null;
}

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  processed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export default function PayrollAdminPage() {
  const supabase = createClient();
  const { activeWorkspace, can, defaultCurrency } = useWorkspace();
  const canManagePeople = can("people_manage");
  const workspaceId = activeWorkspace?.id;

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<Record<string, Payslip[]>>({});
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);

  // New-cycle dialog
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newMonth, setNewMonth] = useState(String(new Date().getMonth() === 0 ? 12 : new Date().getMonth()));
  const [newYear, setNewYear] = useState(String(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()));

  // Salaries dialog
  const [salariesOpen, setSalariesOpen] = useState(false);
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [salariesMissing, setSalariesMissing] = useState(false);
  const [savingSalaries, setSavingSalaries] = useState(false);

  // Pay dialog
  const [payCycle, setPayCycle] = useState<Cycle | null>(null);
  const [payMode, setPayMode] = useState("BANK");

  const fetchCycles = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payroll_cycles")
        .select("id, month, year, status, total_payout")
        .eq("workspace_id", workspaceId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      setCycles((data as Cycle[]) || []);
    } catch {
      toast.error("Failed to load payroll cycles");
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    void fetchCycles();
  }, [fetchCycles]);

  // Member names for payslip rows, loaded once.
  useEffect(() => {
    if (!workspaceId) return;
    void (async () => {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("id, user_id")
        .eq("workspace_id", workspaceId);
      const userIds = (members ?? []).map((m) => m.user_id);
      if (userIds.length === 0) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? "—"]));
      setMemberNames(new Map((members ?? []).map((m) => [m.id, nameByUser.get(m.user_id) ?? "—"])));
    })();
  }, [supabase, workspaceId]);

  const ytdPayout = useMemo(
    () =>
      cycles
        .filter((c) => c.year === new Date().getFullYear() && c.status !== "draft")
        .reduce((s, c) => s + Number(c.total_payout), 0),
    [cycles]
  );

  async function toggleExpand(cycle: Cycle) {
    if (expanded === cycle.id) {
      setExpanded(null);
      return;
    }
    setExpanded(cycle.id);
    if (!payslips[cycle.id]) {
      const { data } = await supabase
        .from("payslips")
        .select("id, workspace_member_id, total_earnings, total_deductions, advance_deduction, net_payable, status")
        .eq("payroll_cycle_id", cycle.id)
        .order("net_payable", { ascending: false });
      setPayslips((prev) => ({ ...prev, [cycle.id]: (data as Payslip[]) || [] }));
    }
  }

  async function handleCreateCycle() {
    if (!workspaceId) return;
    const month = Number(newMonth);
    const year = Number(newYear);
    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      toast.error("Pick a valid month and year");
      return;
    }
    const { error } = await supabase
      .from("payroll_cycles")
      .insert({ workspace_id: workspaceId, month, year, status: "draft" });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That cycle already exists" : error.message);
      return;
    }
    toast.success(`Cycle for ${format(new Date(year, month - 1), "MMMM yyyy")} created`);
    setNewCycleOpen(false);
    await fetchCycles();
  }

  async function handleProcess(cycle: Cycle) {
    setBusyId(cycle.id);
    try {
      const res = await fetch(`/api/payroll/cycles/${cycle.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to process cycle");
      toast.success(`Processed ${json.payslip_count} payslips — posted to accounting`);
      setPayslips((prev) => ({ ...prev, [cycle.id]: undefined as unknown as Payslip[] }));
      await fetchCycles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process cycle");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePay() {
    if (!payCycle) return;
    setBusyId(payCycle.id);
    try {
      const res = await fetch(`/api/payroll/cycles/${payCycle.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", payment_mode: payMode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to mark cycle paid");
      toast.success("Salaries paid — posted to accounting");
      setPayCycle(null);
      await fetchCycles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark cycle paid");
    } finally {
      setBusyId(null);
    }
  }

  async function openSalaries() {
    if (!workspaceId) return;
    setSalariesOpen(true);
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("workspace_member_id, employee_code, status, basic_salary, hra, special_allowance, pf_deduction, professional_tax, tds_deduction")
      .eq("workspace_id", workspaceId)
      .eq("status", "ACTIVE");
    if (error) {
      if (/column .* does not exist|schema cache/i.test(error.message)) {
        setSalariesMissing(true);
        return;
      }
      toast.error(error.message);
      return;
    }
    setSalariesMissing(false);
    setSalaries((data as EmployeeSalary[]) || []);
  }

  async function handleSaveSalaries() {
    if (!workspaceId) return;
    setSavingSalaries(true);
    try {
      for (const s of salaries) {
        const { error } = await supabase
          .from("employee_profiles")
          .update({
            basic_salary: Number(s.basic_salary) || 0,
            hra: Number(s.hra) || 0,
            special_allowance: Number(s.special_allowance) || 0,
            pf_deduction: Number(s.pf_deduction) || 0,
            professional_tax: Number(s.professional_tax) || 0,
            tds_deduction: Number(s.tds_deduction) || 0,
          })
          .eq("workspace_member_id", s.workspace_member_id)
          .eq("workspace_id", workspaceId);
        if (error) throw error;
      }
      toast.success("Salaries saved");
      setSalariesOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save salaries");
    } finally {
      setSavingSalaries(false);
    }
  }

  function setSalary(memberId: string, patch: Partial<EmployeeSalary>) {
    setSalaries((prev) =>
      prev.map((s) => (s.workspace_member_id === memberId ? { ...s, ...patch } : s))
    );
  }

  if (!canManagePeople) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState
          icon={Banknote}
          title="Access denied"
          description="You need people management permissions to view the Payroll module."
        />
      </div>
    );
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Payroll"
        description="Process monthly cycles, generate payslips, pay out — every step posts to accounting."
        badge={
          ytdPayout > 0 ? (
            <span className="inline-flex h-6 items-center border border-emerald-500/20 bg-emerald-500/10 px-2 text-xs font-medium text-emerald-400">
              {formatCurrency(ytdPayout, defaultCurrency, { decimals: 2 })} paid out {new Date().getFullYear()}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <IconAction label="Salaries" icon={<Users />} variant="outline" onClick={openSalaries} />
            <IconAction label="New Cycle" icon={<Plus />} onClick={() => setNewCycleOpen(true)} />
          </div>
        }
      />

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : cycles.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No payroll cycles yet"
              description="Set employee salaries first, then create a cycle for the month you want to pay."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Cycle</TableHead>
                  <TableHead className="text-right">Total Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((cycle) => {
                  const busy = busyId === cycle.id;
                  const slips = payslips[cycle.id];
                  return (
                    <Fragment key={cycle.id}>
                      <TableRow className="cursor-pointer" onClick={() => toggleExpand(cycle)}>
                        <TableCell>
                          {expanded === cycle.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(cycle.year, cycle.month - 1), "MMMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(cycle.total_payout), defaultCurrency, { decimals: 2 })}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${STATUS_CLASSES[cycle.status]}`}>
                            {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {cycle.status === "draft" && (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleProcess(cycle)}>
                              {busy ? <Loader2 className="animate-spin" /> : <Play />} Process
                            </Button>
                          )}
                          {cycle.status === "processed" && (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => setPayCycle(cycle)}>
                              {busy ? <Loader2 className="animate-spin" /> : <Wallet />} Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded === cycle.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            {!slips ? (
                              <div className="flex items-center justify-center p-4 text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" />
                              </div>
                            ) : slips.length === 0 ? (
                              <p className="p-4 text-sm text-muted-foreground">
                                No payslips yet — process the cycle to generate them.
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead className="text-right">Earnings</TableHead>
                                    <TableHead className="text-right">Deductions</TableHead>
                                    <TableHead className="text-right">Advance</TableHead>
                                    <TableHead className="text-right">Net Payable</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {slips.map((p) => (
                                    <TableRow key={p.id}>
                                      <TableCell>{memberNames.get(p.workspace_member_id) ?? "—"}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(Number(p.total_earnings), defaultCurrency, { decimals: 2 })}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{formatCurrency(Number(p.total_deductions), defaultCurrency, { decimals: 2 })}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{formatCurrency(Number(p.advance_deduction), defaultCurrency, { decimals: 2 })}</TableCell>
                                      <TableCell className="text-right font-medium">{formatCurrency(Number(p.net_payable), defaultCurrency, { decimals: 2 })}</TableCell>
                                      <TableCell className="text-muted-foreground">{p.status}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── new cycle ─────────────────────────────────────── */}
      <Dialog open={newCycleOpen} onOpenChange={setNewCycleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Payroll Cycle</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Month</label>
              <Select value={newMonth} onValueChange={(v) => v && setNewMonth(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => format(new Date(2000, Number(v || 1) - 1), "MMMM")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent searchPlaceholder="Search months...">
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {format(new Date(2000, i), "MMMM")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Year</label>
              <Input type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCycleOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCycle}><Plus /> Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── salaries editor ───────────────────────────────── */}
      <Dialog open={salariesOpen} onOpenChange={setSalariesOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Employee Salaries (monthly)</DialogTitle>
          </DialogHeader>
          {salariesMissing ? (
            <p className="text-sm text-muted-foreground">
              Salary fields are not set up in this database yet — apply migration 077 first.
            </p>
          ) : salaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active employees found.</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>HRA</TableHead>
                    <TableHead>Allowance</TableHead>
                    <TableHead>PF</TableHead>
                    <TableHead>Prof. Tax</TableHead>
                    <TableHead>TDS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaries.map((s) => (
                    <TableRow key={s.workspace_member_id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {memberNames.get(s.workspace_member_id) ?? s.employee_code ?? "—"}
                      </TableCell>
                      {(["basic_salary", "hra", "special_allowance", "pf_deduction", "professional_tax", "tds_deduction"] as const).map((f) => (
                        <TableCell key={f}>
                          <Input
                            className="w-24 text-right"
                            type="number" min="0"
                            value={String(s[f] ?? 0)}
                            onChange={(e) => setSalary(s.workspace_member_id, { [f]: Number(e.target.value) } as Partial<EmployeeSalary>)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalariesOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSalaries} disabled={savingSalaries || salariesMissing || salaries.length === 0}>
              {savingSalaries ? <Loader2 className="animate-spin" /> : <Users />} Save Salaries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── pay dialog ────────────────────────────────────── */}
      <Dialog open={!!payCycle} onOpenChange={(open) => !open && setPayCycle(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Pay {payCycle && format(new Date(payCycle.year, payCycle.month - 1), "MMMM yyyy")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pays out{" "}
              <span className="font-medium text-foreground">
                {payCycle && formatCurrency(Number(payCycle.total_payout), defaultCurrency, { decimals: 2 })}
              </span>{" "}
              and posts it against Salaries Payable.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Payment mode</label>
              <Select value={payMode} onValueChange={(v) => v && setPayMode(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => (v === "CASH" ? "Cash" : "Bank transfer")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent searchable={false}>
                  <SelectItem value="BANK">Bank transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayCycle(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={busyId === payCycle?.id}>
              {busyId === payCycle?.id ? <Loader2 className="animate-spin" /> : <Wallet />} Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
