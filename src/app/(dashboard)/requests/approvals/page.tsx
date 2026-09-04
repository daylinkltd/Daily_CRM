'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  UserCheck,
  Building,
  ShieldCheck,
  Layers,
  MessageSquare,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';

interface ApprovalStep {
  id: string;
  step_number: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments?: string;
  acted_at?: string;
  approver_employee_id?: string;
}

interface ApprovalInstance {
  id: string;
  workspace_id: string;
  module: 'LEAVE' | 'EXPENSE' | 'REQUEST' | 'PROMOTION' | 'RESIGNATION';
  record_id: string;
  current_step: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  steps?: ApprovalStep[];
}

export default function UnifiedApprovalInboxPage() {
  const { activeWorkspace, activeMember } = useWorkspace();
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('ALL');

  // Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<ApprovalInstance | null>(null);
  const [selectedStepNumber, setSelectedStepNumber] = useState<number>(1);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [comments, setComments] = useState('');

  const fetchApprovals = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const url = `/api/hr/approvals?workspaceId=${activeWorkspace.id}&module=${moduleFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load approval requests');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, moduleFilter]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleOpenActionModal = (instance: ApprovalInstance, stepNumber: number, type: 'APPROVED' | 'REJECTED') => {
    setSelectedInstance(instance);
    setSelectedStepNumber(stepNumber);
    setActionType(type);
    setComments('');
    setActionModalOpen(true);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !selectedInstance) return;

    try {
      const res = await fetch('/api/hr/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstance.id,
          stepNumber: selectedStepNumber,
          approverMemberId: activeMember?.id || 'hr_admin',
          action: actionType,
          comments,
        }),
      });

      if (res.ok) {
        toast.success(`Approval step ${selectedStepNumber} ${actionType.toLowerCase()} successfully!`);
        setActionModalOpen(false);
        setSelectedInstance(null);
        fetchApprovals();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit approval action');
      }
    } catch (err) {
      toast.error('Error submitting approval action');
    }
  };

  const getModuleBadgeColor = (moduleName: string) => {
    switch (moduleName) {
      case 'LEAVE':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'EXPENSE':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'RESIGNATION':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'PROMOTION':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck className="size-6 text-primary" />
            Unified HR Multi-Stage Approval Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and sign off multi-level workflow approvals across Leave, Expenses, Promotions, and Resignations.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl shadow-xs">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="size-4 text-primary" />
          Filter by Workflow Module:
        </div>

        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[200px] text-xs h-9 bg-background">
            <SelectValue placeholder="Select Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Workflow Modules</SelectItem>
            <SelectItem value="LEAVE">Leave Requests</SelectItem>
            <SelectItem value="EXPENSE">Expense Claims</SelectItem>
            <SelectItem value="RESIGNATION">Resignation & Clearance</SelectItem>
            <SelectItem value="PROMOTION">Promotions & Transfers</SelectItem>
            <SelectItem value="REQUEST">General HR Requests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Approval List */}
      {loading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading approval inbox...</Card>
      ) : instances.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted-foreground space-y-2">
          <FileCheck className="size-8 mx-auto opacity-30" />
          <p className="font-semibold text-sm">No pending approval requests</p>
          <p>All multi-stage workflow approval requests have been processed.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {instances.map((instance) => {
            const isApproved = instance.status === 'APPROVED';
            const isRejected = instance.status === 'REJECTED';
            const sortedSteps = [...(instance.steps || [])].sort((a, b) => a.step_number - b.step_number);

            return (
              <Card key={instance.id} className="bg-card border-border p-5 rounded-xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="outline" className={`text-xs font-bold px-2.5 py-0.5 uppercase ${getModuleBadgeColor(instance.module)}`}>
                      {instance.module} WORKFLOW
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">Record Ref: #{instance.record_id.slice(0, 8)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isApproved ? 'default' : isRejected ? 'destructive' : 'secondary'}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      {instance.status} {instance.status === 'PENDING' && `(Step ${instance.current_step} of ${sortedSteps.length})`}
                    </Badge>
                  </div>
                </div>

                {/* Multi-Step Flow Visualization */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Approval Sequence & Sign-off Steps:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sortedSteps.map((step) => {
                      const isStepApproved = step.status === 'APPROVED';
                      const isStepRejected = step.status === 'REJECTED';
                      const isStepCurrent = instance.status === 'PENDING' && instance.current_step === step.step_number;

                      return (
                        <div
                          key={step.id}
                          className={`p-3 rounded-lg border text-xs space-y-1.5 transition-all ${
                            isStepCurrent
                              ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                              : isStepApproved
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : isStepRejected
                              ? 'border-red-500/30 bg-red-500/5'
                              : 'border-border/60 bg-muted/20 opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>Step {step.step_number}: {step.step_number === 1 ? 'Direct Manager' : 'HR Dept Admin'}</span>
                            {isStepApproved ? (
                              <CheckCircle2 className="size-4 text-emerald-500" />
                            ) : isStepRejected ? (
                              <XCircle className="size-4 text-red-500" />
                            ) : (
                              <Clock className="size-4 text-muted-foreground" />
                            )}
                          </div>

                          <div className="text-[11px] text-muted-foreground">
                            Status: <span className="font-semibold text-foreground">{step.status}</span>
                          </div>

                          {step.comments && (
                            <p className="text-[11px] italic bg-background p-2 rounded border border-border/40 text-muted-foreground">
                              "{step.comments}"
                            </p>
                          )}

                          {isStepCurrent && (
                            <div className="pt-2 flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleOpenActionModal(instance, step.step_number, 'APPROVED')}
                                className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenActionModal(instance, step.step_number, 'REJECTED')}
                                className="h-7 text-[11px] font-bold text-red-500 border-red-500/30 hover:bg-red-500/10 flex-1"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Step Action Confirmation Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {actionType === 'APPROVED' ? (
                <CheckCircle2 className="size-5 text-emerald-500" />
              ) : (
                <XCircle className="size-5 text-red-500" />
              )}
              {actionType === 'APPROVED' ? 'Approve' : 'Reject'} Step {selectedStepNumber} Sign-off
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide optional comments and confirm your approval decision for this request.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleActionSubmit} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <span className="font-semibold block">Approver Comments & Feedback</span>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Enter sign-off comments, notes, or rejection reason..."
                className="bg-background text-xs min-h-[90px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setActionModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                className={`text-xs font-bold ${
                  actionType === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Confirm {actionType === 'APPROVED' ? 'Approval' : 'Rejection'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
