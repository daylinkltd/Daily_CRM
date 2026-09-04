'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Building,
  DollarSign,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  Layers,
  Sparkles,
  TrendingUp,
  FileCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';

interface DepartmentBudgetMetric {
  departmentId: string;
  departmentName: string;
  budgetedHeadcount: number;
  currentHeadcount: number;
  openVacancies: number;
  availableSeats: number;
  approvedSalaryBudget: number;
  committedSalaryBudget: number;
  remainingSalaryBudget: number;
}

interface ManpowerRequisition {
  id: string;
  department_id: string;
  position_title: string;
  requested_vacancies: number;
  target_hiring_date: string;
  justification: string;
  estimated_salary: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  department?: {
    id: string;
    name: string;
  };
}

export default function HeadcountBudgetingPage() {
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canManage = can('people_manage');

  const [departments, setDepartments] = useState<DepartmentBudgetMetric[]>([]);
  const [requisitions, setRequisitions] = useState<ManpowerRequisition[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<DepartmentBudgetMetric | null>(null);

  // Form states
  const [reqForm, setReqForm] = useState({
    departmentId: '',
    positionTitle: '',
    requestedVacancies: 1,
    targetHiringDate: '',
    justification: '',
    estimatedSalary: 60000,
  });

  const [budgetForm, setBudgetForm] = useState({
    budgetedHeadcount: 5,
    approvedSalaryBudget: 500000,
  });

  const fetchBudgets = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/budgeting?workspaceId=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
        setRequisitions(data.requisitions || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load headcount budget metrics');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !reqForm.departmentId || !reqForm.positionTitle) {
      toast.error('Department and Position Title are required');
      return;
    }

    try {
      const res = await fetch('/api/hr/budgeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_REQUISITION',
          workspaceId: activeWorkspace.id,
          departmentId: reqForm.departmentId,
          positionTitle: reqForm.positionTitle,
          requestedVacancies: reqForm.requestedVacancies,
          targetHiringDate: reqForm.targetHiringDate || new Date().toISOString().split('T')[0],
          justification: reqForm.justification,
          estimatedSalary: reqForm.estimatedSalary,
        }),
      });

      if (res.ok) {
        toast.success('Manpower requisition submitted successfully!');
        setReqModalOpen(false);
        setReqForm({
          departmentId: '',
          positionTitle: '',
          requestedVacancies: 1,
          targetHiringDate: '',
          justification: '',
          estimatedSalary: 60000,
        });
        fetchBudgets();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit requisition');
      }
    } catch (err) {
      toast.error('Error submitting requisition');
    }
  };

  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !selectedDept) return;

    try {
      const res = await fetch('/api/hr/budgeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPSERT_BUDGET',
          workspaceId: activeWorkspace.id,
          departmentId: selectedDept.departmentId,
          budgetedHeadcount: budgetForm.budgetedHeadcount,
          approvedSalaryBudget: budgetForm.approvedSalaryBudget,
        }),
      });

      if (res.ok) {
        toast.success('Department headcount budget updated!');
        setBudgetModalOpen(false);
        setSelectedDept(null);
        fetchBudgets();
      } else {
        toast.error('Failed to update budget');
      }
    } catch (err) {
      toast.error('Error updating budget');
    }
  };

  const handleActionRequisition = async (requisitionId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!activeWorkspace?.id) return;

    try {
      const res = await fetch('/api/hr/budgeting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionId,
          status,
          approverMemberId: activeMember?.id,
        }),
      });

      if (res.ok) {
        toast.success(`Manpower requisition ${status.toLowerCase()}!`);
        fetchBudgets();
      } else {
        toast.error('Failed to update requisition');
      }
    } catch (err) {
      toast.error('Error updating requisition');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="size-6 text-primary" />
            Headcount Budgeting & Manpower Requisitions
          </h1>
          <p className="text-sm text-muted-foreground">
            Track department headcount caps, committed salary budgets, available seats, and approve hiring requisitions.
          </p>
        </div>

        <Button onClick={() => setReqModalOpen(true)} className="font-bold">
          <Plus className="size-4 mr-1.5" />
          Submit Manpower Requisition
        </Button>
      </div>

      {/* Department Budget Cards */}
      {loading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading headcount budget metrics...</Card>
      ) : departments.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted-foreground space-y-2">
          <Building className="size-8 mx-auto opacity-30" />
          <p className="font-semibold text-sm">No department budgets configured</p>
          <p>Create department budget allocations to control workforce seat caps.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const occupancyPct = Math.round((dept.currentHeadcount / (dept.budgetedHeadcount || 1)) * 100);

            return (
              <Card key={dept.departmentId} className="bg-card border-border p-5 rounded-xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                    <Building className="size-4 text-primary" />
                    {dept.departmentName}
                  </h3>

                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedDept(dept);
                        setBudgetForm({
                          budgetedHeadcount: dept.budgetedHeadcount,
                          approvedSalaryBudget: dept.approvedSalaryBudget,
                        });
                        setBudgetModalOpen(true);
                      }}
                      className="text-xs h-7 px-2"
                    >
                      Edit Caps
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Headcount Occupancy:</span>
                    <span className="font-bold font-mono">
                      {dept.currentHeadcount} / {dept.budgetedHeadcount} Seats ({occupancyPct}%)
                    </span>
                  </div>
                  <Progress value={Math.min(100, occupancyPct)} className="h-2 bg-muted" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 bg-muted/30 rounded-lg">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Open Vacancies</span>
                    <span className="font-bold text-amber-500">{dept.openVacancies} seats</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Available Seats</span>
                    <span className="font-bold text-emerald-600">{dept.availableSeats} available</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Committed Salary:</span>
                  <span className="font-bold text-foreground">
                    ${dept.committedSalaryBudget.toLocaleString()} / ${dept.approvedSalaryBudget.toLocaleString()}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manpower Requisitions Section */}
      <Card className="bg-card border-border shadow-xs">
        <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Briefcase className="size-4 text-primary" />
            Manpower Hiring Requisitions ({requisitions.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {requisitions.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">No manpower hiring requisitions submitted.</p>
          ) : (
            <div className="divide-y divide-border">
              {requisitions.map((req) => {
                const isApproved = req.status === 'APPROVED';
                const isRejected = req.status === 'REJECTED';

                return (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground">{req.position_title}</h4>
                        <Badge variant="outline" className="text-[10px] font-mono uppercase">
                          {req.department?.name || 'Department'}
                        </Badge>
                        <Badge
                          variant={isApproved ? 'default' : isRejected ? 'destructive' : 'secondary'}
                          className="text-[10px] uppercase font-bold"
                        >
                          {req.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground italic">"{req.justification}"</p>

                      <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground pt-1">
                        <span>Vacancies: {req.requested_vacancies} seat(s)</span>
                        <span>Target DOJ: {req.target_hiring_date}</span>
                        <span>Est. Budget: ${req.estimated_salary?.toLocaleString()}</span>
                      </div>
                    </div>

                    {req.status === 'SUBMITTED' && canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleActionRequisition(req.id, 'APPROVED')}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                        >
                          Approve Requisition
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActionRequisition(req.id, 'REJECTED')}
                          className="text-xs font-bold text-red-500 border-red-500/30 h-8"
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Requisition Modal */}
      <Dialog open={reqModalOpen} onOpenChange={setReqModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="size-4 text-primary" />
              Submit Manpower Hiring Requisition
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit a formal request for new headcount positions within a department budget.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRequisition} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Select Department</Label>
              <Select
                value={reqForm.departmentId}
                onValueChange={(val) => setReqForm({ ...reqForm, departmentId: val })}
              >
                <SelectTrigger className="bg-background text-xs h-9">
                  <SelectValue placeholder="Choose department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.departmentId} value={d.departmentId}>
                      {d.departmentName} ({d.availableSeats} seats available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Position Title</Label>
              <Input
                value={reqForm.positionTitle}
                onChange={(e) => setReqForm({ ...reqForm, positionTitle: e.target.value })}
                placeholder="e.g. Senior Frontend Engineer"
                className="bg-background text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Requested Vacancies</Label>
                <Input
                  type="number"
                  min={1}
                  value={reqForm.requestedVacancies}
                  onChange={(e) => setReqForm({ ...reqForm, requestedVacancies: Number(e.target.value) })}
                  className="bg-background text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Target Hiring Date</Label>
                <Input
                  type="date"
                  value={reqForm.targetHiringDate}
                  onChange={(e) => setReqForm({ ...reqForm, targetHiringDate: e.target.value })}
                  className="bg-background text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-primary">Approved Role Salary Budget Amount ($)</Label>
              <Input
                type="number"
                value={reqForm.estimatedSalary}
                onChange={(e) => setReqForm({ ...reqForm, estimatedSalary: Number(e.target.value) })}
                className="bg-background text-xs h-9 font-bold text-foreground"
                placeholder="e.g. 65000"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Hiring Justification & Business Need</Label>
              <Textarea
                value={reqForm.justification}
                onChange={(e) => setReqForm({ ...reqForm, justification: e.target.value })}
                placeholder="Explain business justification, project requirements, or replacement need..."
                className="bg-background text-xs min-h-[80px]"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setReqModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Submit Requisition
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Department Caps Modal */}
      <Dialog open={budgetModalOpen} onOpenChange={setBudgetModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building className="size-4 text-primary" />
              Edit Budget Caps for {selectedDept?.departmentName}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateBudget} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Budgeted Headcount Seat Cap</Label>
              <Input
                type="number"
                min={1}
                value={budgetForm.budgetedHeadcount}
                onChange={(e) => setBudgetForm({ ...budgetForm, budgetedHeadcount: Number(e.target.value) })}
                className="bg-background text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Approved Annual Salary Budget ($)</Label>
              <Input
                type="number"
                value={budgetForm.approvedSalaryBudget}
                onChange={(e) => setBudgetForm({ ...budgetForm, approvedSalaryBudget: Number(e.target.value) })}
                className="bg-background text-xs h-9"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBudgetModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Save Budget Allocation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
