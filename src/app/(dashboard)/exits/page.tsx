'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Building,
  Laptop,
  DollarSign,
  FileText,
  AlertTriangle,
  Plus,
  ArrowRight,
  Sparkles,
  Calculator,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';

interface ExitClearance {
  id: string;
  clearance_type: 'MANAGER' | 'HR' | 'IT' | 'ASSET' | 'FINANCE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments?: string;
  asset_recovery_amount?: number;
}

interface FnFSettlement {
  id: string;
  prorated_salary: number;
  leave_encashment_amount: number;
  reimbursements_amount: number;
  total_earnings: number;
  notice_shortfall_recovery: number;
  approved_asset_recovery: number;
  total_deductions: number;
  net_settlement_amount: number;
  is_receivable: boolean;
  receivable_amount: number;
  status: 'DRAFT' | 'GENERATED' | 'APPROVED' | 'PAID';
  retryable_document_state: 'PENDING' | 'GENERATED' | 'FAILED';
  relieving_letter_url?: string;
  experience_letter_url?: string;
}

interface EmployeeExit {
  id: string;
  workspace_id: string;
  hr_employee_id: string;
  resignation_date: string;
  reason: string;
  requested_lwd: string;
  approved_lwd?: string;
  notice_days: number;
  served_days: number;
  shortfall_days: number;
  status: 'PENDING' | 'APPROVED' | 'CLEARANCE_IN_PROGRESS' | 'FNF_IN_PROGRESS' | 'PAYMENT_PENDING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  employee?: {
    id: string;
    employee_code: string;
    joining_date: string;
  };
  clearances?: ExitClearance[];
  fnf?: FnFSettlement[];
}

export default function ExitManagementPage() {
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canManage = can('people_manage');
  const [exits, setExits] = useState<EmployeeExit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExit, setSelectedExit] = useState<EmployeeExit | null>(null);

  // Modals state
  const [resignationModalOpen, setResignationModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);

  // Forms state
  const [resignationForm, setResignationForm] = useState({
    requestedLWD: '',
    reason: '',
    noticeDays: 30,
  });

  const [decisionForm, setDecisionForm] = useState({
    approvedLWD: '',
    waivedDays: 0,
    status: 'APPROVED' as 'APPROVED' | 'REJECTED',
  });

  const fetchExits = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/exits?workspaceId=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.exits || [];
        setExits(list);
        if (list.length > 0 && !selectedExit) {
          setSelectedExit(list[0]);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load exit records');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, selectedExit]);

  useEffect(() => {
    fetchExits();
  }, [fetchExits]);

  const handleSubmitResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !resignationForm.requestedLWD) {
      toast.error('Requested Last Working Day (LWD) is required');
      return;
    }

    try {
      const res = await fetch('/api/hr/exits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_RESIGNATION',
          workspaceId: activeWorkspace.id,
          employeeId: activeMember?.id || 'emp_default',
          requestedLWD: resignationForm.requestedLWD,
          reason: resignationForm.reason,
          noticeDays: resignationForm.noticeDays,
        }),
      });

      if (res.ok) {
        toast.success('Resignation request submitted successfully!');
        setResignationModalOpen(false);
        setResignationForm({ requestedLWD: '', reason: '', noticeDays: 30 });
        fetchExits();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit resignation');
      }
    } catch (err) {
      toast.error('Error submitting resignation');
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !selectedExit) return;

    try {
      const res = await fetch('/api/hr/exits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DECIDE_RESIGNATION',
          exitId: selectedExit.id,
          workspaceId: activeWorkspace.id,
          status: decisionForm.status,
          approvedLWD: decisionForm.approvedLWD || selectedExit.requested_lwd,
          waivedDays: decisionForm.waivedDays,
        }),
      });

      if (res.ok) {
        toast.success(`Resignation request ${decisionForm.status.toLowerCase()}!`);
        setDecisionModalOpen(false);
        fetchExits();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to process decision');
      }
    } catch (err) {
      toast.error('Error submitting decision');
    }
  };

  const handleActionClearance = async (clearanceType: string, status: 'APPROVED' | 'REJECTED', assetRecoveryAmount: number = 0) => {
    if (!activeWorkspace?.id || !selectedExit) return;

    try {
      const res = await fetch('/api/hr/exits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACTION_CLEARANCE',
          exitId: selectedExit.id,
          workspaceId: activeWorkspace.id,
          clearanceType,
          status,
          assetRecoveryAmount,
          approvedByMemberId: activeMember?.id,
        }),
      });

      if (res.ok) {
        toast.success(`${clearanceType} clearance sign-off updated!`);
        fetchExits();
      } else {
        toast.error('Failed to update clearance');
      }
    } catch (err) {
      toast.error('Error updating clearance');
    }
  };

  const handleGenerateFnF = async () => {
    if (!activeWorkspace?.id || !selectedExit) return;

    try {
      const res = await fetch('/api/hr/exits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_FNF',
          workspaceId: activeWorkspace.id,
          exitId: selectedExit.id,
        }),
      });

      if (res.ok) {
        toast.success('Full & Final (F&F) settlement calculated successfully!');
        fetchExits();
      } else {
        toast.error('Failed to calculate F&F statement');
      }
    } catch (err) {
      toast.error('Error generating F&F');
    }
  };

  const handleApproveFnF = async () => {
    if (!activeWorkspace?.id || !selectedExit) return;

    try {
      const res = await fetch('/api/hr/exits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE_FNF',
          workspaceId: activeWorkspace.id,
          exitId: selectedExit.id,
        }),
      });

      if (res.ok) {
        toast.success('F&F Settlement Approved & Exit Completed! Relieving letters generated.');
        fetchExits();
      } else {
        toast.error('Failed to approve F&F settlement');
      }
    } catch (err) {
      toast.error('Error approving F&F settlement');
    }
  };

  const getExitStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">PENDING APPROVAL</Badge>;
      case 'APPROVED':
      case 'NOTICE_PERIOD':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">NOTICE PERIOD</Badge>;
      case 'CLEARANCE_IN_PROGRESS':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">CLEARANCE IN PROGRESS</Badge>;
      case 'FNF_IN_PROGRESS':
        return <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/30">F&F IN PROGRESS</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" className="bg-emerald-600 text-white">EXIT COMPLETED</Badge>;
      default:
        return <Badge variant="destructive">{status}</Badge>;
    }
  };

  const currentFnf = selectedExit?.fnf && selectedExit.fnf.length > 0 ? selectedExit.fnf[0] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LogOut className="size-6 text-primary" />
            Exit Management, Clearance & Full & Final (F&F) Settlement
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage resignations, notice periods, 5-stage departmental clearance, F&F payouts/receivables, and relieving documents.
          </p>
        </div>

        <Button onClick={() => setResignationModalOpen(true)} className="font-bold">
          <Plus className="size-4 mr-1.5" />
          Submit Resignation Request
        </Button>
      </div>

      {/* Main Layout Grid */}
      {loading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading exit records...</Card>
      ) : exits.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted-foreground space-y-2">
          <LogOut className="size-8 mx-auto opacity-30" />
          <p className="font-semibold text-sm">No exit or resignation records</p>
          <p>Submit a resignation request to initiate notice period tracking and clearance workflows.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exits List (Left Column) */}
          <Card className="lg:col-span-1 bg-card border-border shadow-xs flex flex-col justify-between">
            <CardHeader className="py-4 px-5 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Resignation Requests</span>
                <Badge variant="secondary" className="text-xs">{exits.length}</Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-border overflow-y-auto max-h-[600px]">
              {exits.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedExit(item)}
                  className={`p-4 cursor-pointer transition-colors space-y-2 ${
                    selectedExit?.id === item.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">
                      {item.employee?.employee_code || `Emp #${item.hr_employee_id.slice(0, 6)}`}
                    </span>
                    {getExitStatusBadge(item.status)}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-1 italic">"{item.reason}"</p>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 font-mono">
                    <span>LWD: {item.approved_lwd || item.requested_lwd}</span>
                    <span>Notice: {item.notice_days}d</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Selected Exit Details & Clearance Matrix (Right Column) */}
          {selectedExit && (
            <div className="lg:col-span-2 space-y-6">
              {/* Exit Overview Card */}
              <Card className="bg-card border-border p-5 rounded-xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                  <div>
                    <h3 className="font-bold text-base text-foreground">
                      Resignation Intimation — {selectedExit.employee?.employee_code || `Emp #${selectedExit.hr_employee_id.slice(0, 6)}`}
                    </h3>
                    <p className="text-xs text-muted-foreground">Submitted on {selectedExit.resignation_date}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedExit.status === 'PENDING' && canManage && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setDecisionForm({ ...decisionForm, approvedLWD: selectedExit.requested_lwd });
                          setDecisionModalOpen(true);
                        }}
                        className="text-xs font-bold bg-primary"
                      >
                        Approve / Action Resignation
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Requested LWD</span>
                    <span className="font-bold text-foreground">{selectedExit.requested_lwd}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Approved LWD</span>
                    <span className="font-bold text-foreground">{selectedExit.approved_lwd || 'PENDING'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Served Days</span>
                    <span className="font-bold text-foreground">{selectedExit.served_days} days</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Shortfall Days</span>
                    <span className="font-bold text-red-500">{selectedExit.shortfall_days} days</span>
                  </div>
                </div>

                <Tabs defaultValue="CLEARANCE" className="space-y-4">
                  <TabsList className="bg-muted/50 p-1 text-xs">
                    <TabsTrigger value="CLEARANCE" className="text-xs font-semibold">5-Stage Clearance Matrix</TabsTrigger>
                    <TabsTrigger value="FNF" className="text-xs font-semibold">F&F Settlement Payout</TabsTrigger>
                  </TabsList>

                  {/* 5-Stage Clearance Matrix Tab */}
                  <TabsContent value="CLEARANCE" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Departmental Clearance Sign-offs
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['MANAGER', 'HR', 'IT', 'ASSET', 'FINANCE'].map((type) => {
                        const clr = (selectedExit.clearances || []).find((c) => c.clearance_type === type);
                        const isApproved = clr?.status === 'APPROVED';

                        return (
                          <div key={type} className="p-3 bg-background border border-border rounded-lg text-xs space-y-2">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1.5">
                                {type === 'IT' && <Laptop className="size-3.5 text-purple-500" />}
                                {type === 'ASSET' && <Building className="size-3.5 text-blue-500" />}
                                {type === 'FINANCE' && <DollarSign className="size-3.5 text-emerald-500" />}
                                {type} Clearance
                              </span>

                              {isApproved ? (
                                <Badge variant="default" className="bg-emerald-600 text-[10px]">APPROVED</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">PENDING</Badge>
                              )}
                            </div>

                            {clr?.asset_recovery_amount ? (
                              <p className="text-[11px] font-bold text-red-500">
                                Asset Recovery Charge: ₹{clr.asset_recovery_amount}
                              </p>
                            ) : null}

                            {!isApproved && canManage && (
                              <div className="pt-1 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleActionClearance(type, 'APPROVED')}
                                  className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                                >
                                  Sign Off
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  {/* F&F Settlement Tab */}
                  <TabsContent value="FNF" className="space-y-4">
                    {!currentFnf ? (
                      <div className="p-6 text-center text-xs space-y-3 bg-muted/20 border border-border rounded-xl">
                        <Calculator className="size-8 mx-auto opacity-30 text-primary" />
                        <p className="font-semibold text-foreground">F&F Settlement Statement Not Calculated Yet</p>
                        {canManage && (
                          <Button onClick={handleGenerateFnF} className="text-xs font-bold">
                            Calculate F&F Settlement Statement
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Earnings vs Deductions Breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Card className="bg-card border-border p-4 space-y-2 text-xs">
                            <h4 className="font-bold text-emerald-600 uppercase text-[11px]">Payable Earnings</h4>
                            <div className="space-y-1 font-mono">
                              <div className="flex justify-between"><span>Prorated Salary:</span><span>₹{currentFnf.prorated_salary?.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span>Leave Encashment:</span><span>₹{currentFnf.leave_encashment_amount?.toLocaleString()}</span></div>
                              <div className="flex justify-between border-t pt-1 font-bold"><span>Total Earnings:</span><span className="text-emerald-600">₹{currentFnf.total_earnings?.toLocaleString()}</span></div>
                            </div>
                          </Card>

                          <Card className="bg-card border-border p-4 space-y-2 text-xs">
                            <h4 className="font-bold text-red-500 uppercase text-[11px]">Applicable Deductions</h4>
                            <div className="space-y-1 font-mono">
                              <div className="flex justify-between"><span>Notice Recovery:</span><span>₹{currentFnf.notice_shortfall_recovery?.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span>Asset Recovery:</span><span>₹{currentFnf.approved_asset_recovery?.toLocaleString()}</span></div>
                              <div className="flex justify-between border-t pt-1 font-bold"><span>Total Deductions:</span><span className="text-red-500">₹{currentFnf.total_deductions?.toLocaleString()}</span></div>
                            </div>
                          </Card>
                        </div>

                        {/* Net Result */}
                        <div className="p-4 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Net Settlement Result</span>
                            {currentFnf.is_receivable ? (
                              <h3 className="text-lg font-bold text-red-500">
                                ₹{currentFnf.receivable_amount?.toLocaleString()} (COMPANY RECEIVABLE RECOVERY)
                              </h3>
                            ) : (
                              <h3 className="text-lg font-bold text-emerald-600">
                                ₹{currentFnf.net_settlement_amount?.toLocaleString()} (NET PAYABLE TO EMPLOYEE)
                              </h3>
                            )}
                          </div>

                          {currentFnf.status !== 'APPROVED' && canManage ? (
                            <Button onClick={handleApproveFnF} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                              Approve F&F & Issue Letters
                            </Button>
                          ) : (
                            <Badge variant="default" className="bg-emerald-600 text-xs font-bold px-3 py-1">
                              F&F APPROVED & COMPLETED
                            </Badge>
                          )}
                        </div>

                        {/* Generated Exit Documents */}
                        {currentFnf.status === 'APPROVED' && (
                          <div className="p-4 border border-border rounded-xl bg-background space-y-2">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <FileText className="size-4 text-primary" />
                              Automated Exit Documents Issued
                            </span>
                            <div className="flex items-center gap-3 pt-1">
                              <Button variant="outline" size="sm" className="text-xs font-semibold gap-1.5 h-8">
                                <Download className="size-3.5 text-primary" /> Download Relieving Letter
                              </Button>
                              <Button variant="outline" size="sm" className="text-xs font-semibold gap-1.5 h-8">
                                <Download className="size-3.5 text-primary" /> Download Experience Certificate
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Submit Resignation Modal */}
      <Dialog open={resignationModalOpen} onOpenChange={setResignationModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <LogOut className="size-4 text-primary" />
              Submit Resignation Intimation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Intimate official resignation and select your requested Last Working Day (LWD).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitResignation} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Requested Last Working Day (LWD)</Label>
              <Input
                type="date"
                value={resignationForm.requestedLWD}
                onChange={(e) => setResignationForm({ ...resignationForm, requestedLWD: e.target.value })}
                className="bg-background text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Resignation Reason & Notes</Label>
              <Textarea
                value={resignationForm.reason}
                onChange={(e) => setResignationForm({ ...resignationForm, reason: e.target.value })}
                placeholder="Enter detailed reason for career move or personal intimation..."
                className="bg-background text-xs min-h-[90px]"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setResignationModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Submit Resignation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* HR Decision Modal */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="size-4 text-primary" />
              Action Resignation Request
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Approve or reject resignation request and confirm the approved LWD and notice period waiver days.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDecisionSubmit} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Decision</Label>
              <Select
                value={decisionForm.status}
                onValueChange={(val: any) => setDecisionForm({ ...decisionForm, status: val })}
              >
                <SelectTrigger className="bg-background text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">APPROVE — Initiate Notice Period & Clearance</SelectItem>
                  <SelectItem value="REJECTED">REJECT — Decline Resignation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Approved LWD</Label>
                <Input
                  type="date"
                  value={decisionForm.approvedLWD}
                  onChange={(e) => setDecisionForm({ ...decisionForm, approvedLWD: e.target.value })}
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Notice Waived Days</Label>
                <Input
                  type="number"
                  value={decisionForm.waivedDays}
                  onChange={(e) => setDecisionForm({ ...decisionForm, waivedDays: Number(e.target.value) })}
                  className="bg-background text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDecisionModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Confirm Decision
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
