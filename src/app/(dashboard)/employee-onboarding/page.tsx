'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  User,
  ShieldCheck,
  FileText,
  Laptop,
  Key,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';

interface OnboardingTaskTemplate {
  id: string;
  title: string;
  description?: string;
  category: 'DOCUMENT' | 'ASSET' | 'POLICY' | 'ACCOUNT_CREATION';
}

interface EmployeeOnboardingTask {
  id: string;
  workspace_id: string;
  hr_employee_id: string;
  task_id: string;
  status: 'PENDING' | 'COMPLETED';
  completed_at?: string;
  verified_by?: string;
  task?: OnboardingTaskTemplate;
}

interface BulkTaskInput {
  id: string;
  title: string;
  description: string;
  category: 'DOCUMENT' | 'ASSET' | 'POLICY' | 'ACCOUNT_CREATION';
}

export default function HRDepartmentOnboardingPage() {
  const { activeWorkspace, activeMember } = useWorkspace();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [templates, setTemplates] = useState<OnboardingTaskTemplate[]>([]);
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeOnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk Template Tasks Modal State
  const [addTemplateModalOpen, setAddTemplateModalOpen] = useState(false);
  const [bulkTasks, setBulkTasks] = useState<BulkTaskInput[]>([
    { id: '1', title: '', description: '', category: 'DOCUMENT' },
  ]);

  const fetchEmployees = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    try {
      const res = await fetch(`/api/account/members?workspaceId=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        const membersList = data.members || [];
        setEmployees(membersList);
        if (membersList.length > 0 && !selectedEmployeeId) {
          const myMember = membersList.find((m: any) => m.id === activeMember?.id);
          setSelectedEmployeeId(myMember ? myMember.id : membersList[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeWorkspace?.id, selectedEmployeeId]);

  const fetchOnboardingData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const url = selectedEmployeeId
        ? `/api/hr/onboarding?workspaceId=${activeWorkspace.id}&employeeId=${selectedEmployeeId}`
        : `/api/hr/onboarding?workspaceId=${activeWorkspace.id}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setEmployeeTasks(data.employeeTasks || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load onboarding checklist');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, selectedEmployeeId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchOnboardingData();
  }, [fetchOnboardingData]);

  const handleToggleTaskStatus = async (taskInstanceId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      const res = await fetch('/api/hr/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskInstanceId,
          status: nextStatus,
          verifiedByMemberId: nextStatus === 'COMPLETED' ? activeMember?.id : null,
        }),
      });

      if (res.ok) {
        toast.success(`Task status updated to ${nextStatus}`);
        fetchOnboardingData();
      } else {
        toast.error('Failed to update task status');
      }
    } catch (err) {
      toast.error('Error updating task');
    }
  };

  const handleVerifyTask = async (taskInstanceId: string) => {
    try {
      const res = await fetch('/api/hr/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskInstanceId,
          status: 'COMPLETED',
          verifiedByMemberId: activeMember?.id || 'hr_admin',
        }),
      });

      if (res.ok) {
        toast.success('Onboarding task verified by HR!');
        fetchOnboardingData();
      } else {
        toast.error('Failed to verify task');
      }
    } catch (err) {
      toast.error('Error verifying task');
    }
  };

  const handleAddBulkRow = () => {
    setBulkTasks([
      ...bulkTasks,
      { id: Date.now().toString(), title: '', description: '', category: 'DOCUMENT' },
    ]);
  };

  const handleRemoveBulkRow = (id: string) => {
    if (bulkTasks.length === 1) return;
    setBulkTasks(bulkTasks.filter((t) => t.id !== id));
  };

  const handleUpdateBulkRow = (id: string, field: keyof BulkTaskInput, value: string) => {
    setBulkTasks(
      bulkTasks.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleAddTemplateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id) return;

    const validTasks = bulkTasks.filter((t) => t.title && t.title.trim());
    if (validTasks.length === 0) {
      toast.error('Please enter at least one valid task title');
      return;
    }

    try {
      const res = await fetch('/api/hr/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          tasks: validTasks,
        }),
      });

      if (res.ok) {
        toast.success(`${validTasks.length} onboarding task template(s) created!`);
        setAddTemplateModalOpen(false);
        setBulkTasks([{ id: '1', title: '', description: '', category: 'DOCUMENT' }]);
        fetchOnboardingData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create template tasks');
      }
    } catch (err) {
      toast.error('Error creating template tasks');
    }
  };

  const completedCount = employeeTasks.filter((t) => t.status === 'COMPLETED').length;
  const verifiedCount = employeeTasks.filter((t) => t.verified_by).length;
  const totalCount = employeeTasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'DOCUMENT':
        return <FileText className="size-4 text-blue-500" />;
      case 'ASSET':
        return <Laptop className="size-4 text-purple-500" />;
      case 'POLICY':
        return <Shield className="size-4 text-emerald-500" />;
      case 'ACCOUNT_CREATION':
        return <Key className="size-4 text-amber-500" />;
      default:
        return <CheckSquare className="size-4 text-primary" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="size-6 text-primary" />
            Employee Onboarding Progress & Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Track onboarding task checklists, document submissions, IT asset allocation, and HR verification.
          </p>
        </div>

        <Button onClick={() => setAddTemplateModalOpen(true)} className="font-bold">
          <Plus className="size-4 mr-1.5" />
          Add Task Templates (Batch)
        </Button>
      </div>

      {/* Select Employee Bar & Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 bg-card border border-border p-4 space-y-3 shadow-xs">
          <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block">
            Select Employee
          </Label>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="bg-background text-xs h-10">
              <SelectValue placeholder="Choose employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.user?.full_name || emp.user?.email || `Employee (${emp.id.slice(0, 6)})`} — {emp.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        <Card className="md:col-span-2 bg-card border border-border p-5 flex flex-col justify-between shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">Onboarding Progress</h3>
              <p className="text-xs text-muted-foreground">
                {completedCount} of {totalCount} tasks completed · {verifiedCount} verified by HR
              </p>
            </div>
            <Badge variant={progressPct === 100 ? 'default' : 'secondary'} className="text-xs font-bold px-2.5 py-1">
              {progressPct}% COMPLETED
            </Badge>
          </div>

          <div className="space-y-1">
            <Progress value={progressPct} className="h-2.5 bg-muted" />
          </div>
        </Card>
      </div>

      {/* Tasks List */}
      <Card className="bg-card border-border shadow-xs">
        <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Onboarding Task Checklist
          </CardTitle>
          <span className="text-xs text-muted-foreground">{employeeTasks.length} checklist items</span>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-xs text-muted-foreground">Loading onboarding checklist...</p>
          ) : employeeTasks.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">No onboarding tasks assigned for this employee.</p>
          ) : (
            <div className="divide-y divide-border">
              {employeeTasks.map((item) => {
                const isCompleted = item.status === 'COMPLETED';
                const isVerified = Boolean(item.verified_by);

                return (
                  <div
                    key={item.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isCompleted ? 'bg-muted/20' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-muted/50 border border-border/50 shrink-0 mt-0.5">
                        {getCategoryIcon(item.task?.category)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold text-sm leading-snug ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {item.task?.title}
                          </h4>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5">
                            {item.task?.category}
                          </Badge>
                        </div>
                        {item.task?.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.task.description}</p>
                        )}
                        {item.completed_at && (
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            Completed on {new Date(item.completed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant={isCompleted ? 'outline' : 'default'}
                        onClick={() => handleToggleTaskStatus(item.id, item.status)}
                        className="text-xs font-semibold h-8"
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 className="size-3.5 mr-1 text-emerald-600" />
                            Completed
                          </>
                        ) : (
                          'Mark Complete'
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant={isVerified ? 'secondary' : 'outline'}
                        onClick={() => handleVerifyTask(item.id)}
                        className={`text-xs font-semibold h-8 ${
                          isVerified ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : ''
                        }`}
                      >
                        <ShieldCheck className="size-3.5 mr-1" />
                        {isVerified ? 'HR Verified' : 'Verify'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Task Templates Modal (Supports Batch/Multiple Rows) */}
      <Dialog open={addTemplateModalOpen} onOpenChange={setAddTemplateModalOpen}>
        <DialogContent className="sm:max-w-xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="size-4 text-primary" />
              Add Onboarding Task Templates (Batch Creation)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add single or multiple onboarding checklist items at once. Select distinct categories (Documents, Assets, Policies, Account Creation) for each item.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddTemplateTask} className="space-y-4 py-2 text-xs">
            <div className="space-y-3 divide-y divide-border">
              {bulkTasks.map((row, idx) => (
                <div key={row.id} className={`space-y-2.5 ${idx > 0 ? 'pt-3' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider">
                      Task Item #{idx + 1}
                    </span>
                    {bulkTasks.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveBulkRow(row.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="font-semibold">Task Title</Label>
                      <Input
                        value={row.title}
                        onChange={(e) => handleUpdateBulkRow(row.id, 'title', e.target.value)}
                        placeholder="e.g. Upload Driving License / Address Proof"
                        className="bg-background text-xs h-9"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="font-semibold">Category</Label>
                      <Select
                        value={row.category}
                        onValueChange={(val: any) => handleUpdateBulkRow(row.id, 'category', val)}
                      >
                        <SelectTrigger className="bg-background text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DOCUMENT">DOCUMENT — Document Verification</SelectItem>
                          <SelectItem value="ASSET">ASSET — Hardware & Laptop Provisioning</SelectItem>
                          <SelectItem value="POLICY">POLICY — Policy Sign-off & NDA</SelectItem>
                          <SelectItem value="ACCOUNT_CREATION">ACCOUNT_CREATION — Worksuite Credentials</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="font-semibold">Description / Instructions (Optional)</Label>
                    <Input
                      value={row.description}
                      onChange={(e) => handleUpdateBulkRow(row.id, 'description', e.target.value)}
                      placeholder="Instructions for employee or verifying HR..."
                      className="bg-background text-xs h-8"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddBulkRow}
                className="text-xs font-semibold gap-1.5"
              >
                <Plus className="size-3.5 text-primary" />
                Add Another Task Row
              </Button>

              <span className="text-[11px] font-mono text-muted-foreground">
                {bulkTasks.length} task(s) in batch
              </span>
            </div>

            <DialogFooter className="pt-2 border-t border-border mt-3">
              <Button type="button" variant="outline" onClick={() => setAddTemplateModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Create {bulkTasks.length} Template Task(s)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
