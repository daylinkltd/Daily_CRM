"use client";

/**
 * Expense claims — submit, approve, reimburse.
 *
 * Replaces the read-only shell whose Submit button had no handler.
 * Members submit and see their own claims; admins additionally see
 * everyone's and drive the state machine (approve/reject pending,
 * reimburse approved). Reimbursement posts DR General Expenses /
 * CR Cash-Bank through /api/expenses/[id], which also blocks
 * self-approval.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Receipt, Plus, Loader2, Check, X, Banknote } from "lucide-react";

import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const CATEGORIES = ["Travel", "Meals", "Office Supplies", "Client Meeting", "Other"] as const;

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  reimbursed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

interface Claim {
  id: string;
  workspace_member_id: string;
  category: string;
  amount: number;
  description: string | null;
  receipt_url: string | null;
  status: string;
  created_at: string;
}

export default function ExpensesPage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember, activeRole, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const isAdmin = activeRole === "owner" || activeRole === "admin";

  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string>("Travel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const fetchClaims = useCallback(async () => {
    if (!workspaceId || !activeMember?.id) return;
    setLoading(true);
    try {
      // Admins review the whole workspace; members see their own.
      let query = supabase
        .from("expense_claims")
        .select("id, workspace_member_id, category, amount, description, receipt_url, status, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (!isAdmin) query = query.eq("workspace_member_id", activeMember.id);
      const { data, error } = await query;
      if (error) throw error;
      setClaims((data as Claim[]) || []);
    } catch {
      toast.error("Failed to load expense claims");
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId, activeMember?.id, isAdmin]);

  useEffect(() => {
    void fetchClaims();
  }, [fetchClaims]);

  useEffect(() => {
    if (!workspaceId || !isAdmin) return;
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
  }, [supabase, workspaceId, isAdmin]);

  const pendingTotal = useMemo(
    () => claims.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0),
    [claims]
  );

  async function handleSubmit() {
    if (!workspaceId || !activeMember?.id) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("expense_claims").insert({
        workspace_id: workspaceId,
        workspace_member_id: activeMember.id,
        category,
        amount: amt,
        description: description.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Expense claim submitted");
      setSubmitOpen(false);
      setAmount("");
      setDescription("");
      await fetchClaims();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  }

  async function act(claim: Claim, action: "approve" | "reject" | "reimburse") {
    setBusyId(claim.id);
    try {
      const res = await fetch(`/api/expenses/${claim.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payment_mode: "BANK" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to ${action} claim`);
      toast.success(
        action === "reimburse" ? "Reimbursed and posted to accounting" : `Claim ${action}d`
      );
      await fetchClaims();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} claim`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title={isAdmin ? "Expense Claims" : "My Expense Claims"}
        description={
          isAdmin
            ? "Review, approve and reimburse claims — reimbursements post to accounting."
            : "Submit expenses for reimbursement."
        }
        badge={
          isAdmin && pendingTotal > 0 ? (
            <span className="inline-flex h-6 items-center border border-yellow-500/20 bg-yellow-500/10 px-2 text-xs font-medium text-yellow-400">
              {formatCurrency(pendingTotal, defaultCurrency, { decimals: 2 })} pending approval
            </span>
          ) : undefined
        }
        actions={
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus /> Submit Claim
          </Button>
        }
      />

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : claims.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expense claims yet"
              description="Submit a claim and it will appear here for approval."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  {isAdmin && <TableHead>Employee</TableHead>}
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => {
                  const busy = busyId === c.id;
                  const own = c.workspace_member_id === activeMember?.id;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(c.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>{memberNames.get(c.workspace_member_id) ?? "—"}</TableCell>
                      )}
                      <TableCell className="font-medium">
                        {c.category}
                        {c.description && (
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">{c.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(c.amount), defaultCurrency, { decimals: 2 })}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${STATUS_CLASSES[c.status] ?? ""}`}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {c.status === "pending" && (
                              <>
                                <IconAction label="Approve" icon={<Check />} variant="outline" disabled={busy || own}
                                  title={own ? "You cannot approve your own claim" : undefined}
                                  onClick={() => act(c, "approve")} />
                                <IconAction
                                  label="Reject claim"
                                  icon={<X />}
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => act(c, "reject")}
                                />
                              </>
                            )}
                            {c.status === "approved" && (
                              <Button
                                size="sm" variant="outline" disabled={busy || own}
                                title={own ? "You cannot reimburse your own claim" : undefined}
                                onClick={() => act(c, "reimburse")}
                              >
                                {busy ? <Loader2 className="animate-spin" /> : <Banknote />} Reimburse
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── submit dialog ─────────────────────────────────── */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Expense Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent searchable={false}>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Amount</label>
                <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea plain
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this expense for?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !amount}>
              {submitting ? <Loader2 className="animate-spin" /> : <Plus />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
