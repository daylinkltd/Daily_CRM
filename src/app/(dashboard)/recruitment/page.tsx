'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Loader2, UserCheck, DollarSign, Briefcase, Users, CheckCircle2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconAction } from "@/components/ui/icon-action";
import { CandidateBoard, type CandidateApplication } from '@/components/recruitment/candidate-board';
import { CandidateList } from '@/components/recruitment/candidate-list';
import { ViewToggle, type BoardView } from '@/components/ui/view-toggle';
import { ApplicationEditModal, type EditableApplication } from '@/components/recruitment/application-edit-modal';
import { RichTextArea } from "@/components/ui/rich-textarea";

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export default function RecruitmentPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('people_manage');

  const [jobs, setJobs] = useState<any[]>([]);
  const [, setCandidates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [budgetMetrics, setBudgetMetrics] = useState<any>({
    totalApprovedBudget: 0,
    committedBudget: 0,
    remainingBudget: 0,
    totalVacancies: 0,
    hiredCount: 0,
    openVacancies: 0,
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BoardView>('kanban');
  const [editApp, setEditApp] = useState<EditableApplication | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const openEdit = (application: CandidateApplication) => {
    setEditApp(application as EditableApplication);
    setEditOpen(true);
  };

  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [candModalOpen, setCandModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [onboardingId, setOnboardingId] = useState<string | null>(null);

  // Manpower Requisition & Job Form State
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationGrade, setDesignationGrade] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [budgetType, setBudgetType] = useState('ANNUAL_BUDGET');
  const [approvedBudgetAmount, setApprovedBudgetAmount] = useState('');
  const [budgetApprovalStatus, setBudgetApprovalStatus] = useState('APPROVED');
  const [vacanciesCount, setVacanciesCount] = useState('1');
  const [hiringManager, setHiringManager] = useState('');
  const [expectedDoj, setExpectedDoj] = useState('');
  const [hiringReason, setHiringReason] = useState('NEW_HEADCOUNT');
  const [jobLocation, setJobLocation] = useState('Remote / Hybrid');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [rolesResponsibilities, setRolesResponsibilities] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [minExperienceYears, setMinExperienceYears] = useState('2');
  const [maxExperienceYears, setMaxExperienceYears] = useState('5');
  const [educationalCriteria, setEducationalCriteria] = useState("Bachelor's Degree");
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('USD');

  // Candidate Form State
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candPhone, setCandPhone] = useState('');

  // Fetch departments live from Supabase directly
  const fetchDepartments = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('workspace_id', activeWorkspace.id)
      .order('name', { ascending: true });

    if (data && data.length > 0) {
      setDepartments(data);
    }
  }, [activeWorkspace?.id, supabase]);

  const fetchRecruitment = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/hr/recruitment?workspaceId=${activeWorkspace.id}`);
      const json = await res.json();
      setJobs(json.jobs || []);
      setCandidates(json.candidates || []);
      setApplications(json.applications || []);
      if (json.departments && json.departments.length > 0) {
        setDepartments(json.departments);
      } else {
        await fetchDepartments();
      }
      if (json.budgetMetrics) {
        setBudgetMetrics(json.budgetMetrics);
      }
      if (json.jobs?.length > 0 && !selectedJobId) {
        setSelectedJobId(json.jobs[0].id);
      }
    } catch {
      toast.error('Failed to load recruitment data');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, selectedJobId, fetchDepartments]);

  useEffect(() => {
    fetchRecruitment();
  }, [fetchRecruitment]);

  // Re-fetch departments whenever job creation modal opens
  useEffect(() => {
    if (jobModalOpen) {
      fetchDepartments();
    }
  }, [jobModalOpen, fetchDepartments]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !activeWorkspace?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_JOB',
          workspaceId: activeWorkspace.id,
          title: jobTitle,
          departmentId: departmentId || null,
          designationGrade,
          costCenter,
          budgetType,
          approvedBudgetAmount,
          budgetApprovalStatus,
          vacanciesCount,
          hiringManager,
          expectedDoj,
          hiringReason,
          location: jobLocation,
          employmentType,
          rolesResponsibilities,
          requiredSkills,
          minExperienceYears,
          maxExperienceYears,
          educationalCriteria,
          minSalary,
          maxSalary,
          salaryCurrency
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Manpower Requisition & Job Opening created');
      setJobTitle('');
      setJobModalOpen(false);
      fetchRecruitment();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  const handleOnboardEmployee = async (applicationId: string) => {
    if (!activeWorkspace?.id) return;
    setOnboardingId(applicationId);
    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONVERT_TO_EMPLOYEE',
          workspaceId: activeWorkspace.id,
          applicationId
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success(json.message || 'Candidate onboarded into Employee Master');
      fetchRecruitment();
    } catch (err: any) {
      toast.error(err.message || 'Failed to onboard candidate');
    } finally {
      setOnboardingId(null);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id) return;
    if (!selectedJobId) {
      toast.error('Create a job opening first, then add candidates to it');
      return;
    }
    if (!candName.trim() || !candEmail.trim()) {
      toast.error('Candidate name and email are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_CANDIDATE',
          workspaceId: activeWorkspace.id,
          jobId: selectedJobId,
          fullName: candName,
          email: candEmail,
          phone: candPhone
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Candidate added to job pipeline');
      setCandName('');
      setCandEmail('');
      setCandPhone('');
      setCandModalOpen(false);
      fetchRecruitment();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add candidate');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (appId: string, newStage: string) => {
    const snapshot = applications;
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, stage: newStage } : a)),
    );

    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MOVE_STAGE',
          workspaceId: activeWorkspace?.id,
          applicationId: appId,
          newStage
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
    } catch (err: any) {
      setApplications(snapshot);
      toast.error(err.message || 'Failed to update stage');
    }
  };

  const handleDeleteApplication = async (application: CandidateApplication) => {
    const name = application.candidate?.full_name || 'this candidate';
    if (!window.confirm(`Remove ${name} from the pipeline? The candidate record itself is kept.`)) {
      return;
    }

    const snapshot = applications;
    setApplications((prev) => prev.filter((a) => a.id !== application.id));

    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_APPLICATION',
          workspaceId: activeWorkspace?.id,
          applicationId: application.id,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Application removed');
    } catch (err) {
      setApplications(snapshot);
      toast.error(
        err instanceof Error ? err.message : 'Failed to remove application',
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment & Hiring ATS"
        description="End-to-End Recruitment Management: Workforce Planning, Budgeting, Requisition, Candidate Pipeline, and Employee Master Onboarding."
        action={
          canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCandModalOpen(true)} className="bg-card font-medium text-xs gap-1.5 border-border">
                <UserCheck className="size-4 text-emerald-500" /> Add Candidate
              </Button>
              <Button size="sm" onClick={() => setJobModalOpen(true)} className="bg-primary text-primary-foreground font-medium text-xs gap-1.5">
                <Plus className="size-4" /> New Requisition
              </Button>
            </div>
          )
        }
      />

      {/* Top Budget & Headcount Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Approved Budget</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                ${budgetMetrics.totalApprovedBudget?.toLocaleString() || '0'}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <DollarSign className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Committed Salary Offers</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                ${budgetMetrics.committedBudget?.toLocaleString() || '0'}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Briefcase className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Open Vacancies</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {budgetMetrics.openVacancies || 0} <span className="text-xs font-normal text-muted-foreground">/ {budgetMetrics.totalVacancies || 0} Total</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Hired Candidates</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {budgetMetrics.hiredCount || 0}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="pipeline">Candidate Pipeline</TabsTrigger>
          <TabsTrigger value="jobs">Manpower Requisitions ({jobs.length})</TabsTrigger>
        </TabsList>

        {/* Candidate Pipeline — board or list */}
        <TabsContent value="pipeline" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{applications.length}</span> Active Applications
                </div>
                <ViewToggle value={view} onChange={setView} label="Candidate pipeline view" />
              </div>
              {view === 'kanban' ? (
                <CandidateBoard
                  stages={STAGES}
                  applications={applications as CandidateApplication[]}
                  canManage={canManage}
                  onMove={handleMoveStage}
                  onDelete={handleDeleteApplication}
                  onEdit={openEdit}
                  onAddCandidate={() => setCandModalOpen(true)}
                />
              ) : (
                <CandidateList
                  stages={STAGES}
                  applications={applications as CandidateApplication[]}
                  canManage={canManage}
                  onMove={handleMoveStage}
                  onDelete={handleDeleteApplication}
                  onEdit={openEdit}
                />
              )}

              {/* Hired Candidates - One Click Onboard Section */}
              {applications.filter((a) => a.stage === 'HIRED').length > 0 && (
                <Card className="border-emerald-500/30 bg-emerald-500/5 mt-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <UserPlus className="size-4" /> Ready for Employee Master Onboarding (Box 10)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Candidates accepted in HIRED stage can be onboarded directly into the HR Employee Master table with auto-generated Employee Code.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {applications
                      .filter((a) => a.stage === 'HIRED')
                      .map((app) => (
                        <div key={app.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{app.candidate?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{app.job?.title} · {app.candidate?.email}</p>
                          </div>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5"
                            disabled={onboardingId === app.id}
                            onClick={() => handleOnboardEmployee(app.id)}
                          >
                            {onboardingId === app.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                            Onboard to Employee Master
                          </Button>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Manpower Requisitions Tab */}
        <TabsContent value="jobs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map(j => (
              <Card key={j.id} className="border-border bg-card shadow-sm flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      {j.status}
                    </Badge>
                    {j.cost_center && (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20 font-mono">
                        {j.cost_center}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">{j.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {j.department?.name ? `${j.department.name} · ` : ''} {j.location}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 text-xs text-muted-foreground border-t border-border/50 pt-3">
                  <div className="flex items-center justify-between">
                    <span>Vacancies: <strong className="text-foreground">{j.vacancies_count || 1}</strong></span>
                    <span>Type: <strong className="text-foreground">{j.employment_type?.replace(/_/g, ' ')}</strong></span>
                  </div>
                  {j.approved_budget_amount > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Approved Budget:</span>
                      <strong className="text-emerald-600 font-semibold">${Number(j.approved_budget_amount).toLocaleString()}</strong>
                    </div>
                  )}
                  {j.expected_doj && (
                    <div className="flex items-center justify-between">
                      <span>Expected DOJ:</span>
                      <span className="text-foreground font-medium">{new Date(j.expected_doj).toLocaleDateString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Comprehensive Manpower Requisition & Job Modal (Boxes 1, 2 & 3) */}
      <Dialog open={jobModalOpen} onOpenChange={setJobModalOpen}>
        <DialogContent className="sm:max-w-[650px] bg-card border-border rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Create Manpower Requisition & Job Opening</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define workforce planning, budget allocation, requisition requirements, and job competencies (Boxes 1, 2 & 3).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateJob} className="space-y-4 py-2">
            <Tabs defaultValue="requisition" className="w-full">
              <TabsList className="grid grid-cols-3 w-full bg-muted/60">
                <TabsTrigger value="requisition" className="text-xs">1. Requisition & Budget</TabsTrigger>
                <TabsTrigger value="description" className="text-xs">2. Job Description</TabsTrigger>
                <TabsTrigger value="salary" className="text-xs">3. Salary & Approval</TabsTrigger>
              </TabsList>

              {/* Tab 1: Requisition & Budgeting (Box 1 & 2) */}
              <TabsContent value="requisition" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-medium">Job Title / Role <span className="text-red-500">*</span></Label>
                    <Input placeholder="e.g. Senior Frontend Developer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required className="bg-card border-border h-9 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Department</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Department..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground text-center">
                            No departments found.<br/>
                            <a href="/departments" className="text-primary hover:underline font-medium">Add Departments in HR</a>
                          </div>
                        ) : (
                          departments.map((d) => (
                            <SelectItem key={d.id} value={d.id} className="text-xs cursor-pointer">{d.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Designation / Grade</Label>
                    <Input placeholder="e.g. Grade L3 / Lead" value={designationGrade} onChange={e => setDesignationGrade(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Cost Center Code</Label>
                    <Input placeholder="e.g. CC-ENG-2026" value={costCenter} onChange={e => setCostCenter(e.target.value)} className="bg-card border-border h-9 text-sm font-mono" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">No. of Vacancies</Label>
                    <Input type="number" min="1" value={vacanciesCount} onChange={e => setVacanciesCount(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Hiring Manager</Label>
                    <Input placeholder="e.g. Sarah Jenkins" value={hiringManager} onChange={e => setHiringManager(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Expected Date of Joining (DOJ)</Label>
                    <Input type="date" value={expectedDoj} onChange={e => setExpectedDoj(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Location</Label>
                    <Input placeholder="Remote / On-site / Hybrid" value={jobLocation} onChange={e => setJobLocation(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Employment Type</Label>
                    <Select value={employmentType} onValueChange={setEmploymentType}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL_TIME">Full Time</SelectItem>
                        <SelectItem value="PART_TIME">Part Time</SelectItem>
                        <SelectItem value="CONTRACT">Contract</SelectItem>
                        <SelectItem value="INTERNSHIP">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Job Description & Competencies (Box 3) */}
              <TabsContent value="description" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Roles & Responsibilities</Label>
                  <RichTextArea rows={3} placeholder="Describe core duties and expected outcomes..." value={rolesResponsibilities} onChange={e => setRolesResponsibilities(e.target.value)} className="bg-card border-border text-xs" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Required Skills & Competencies</Label>
                  <Input placeholder="React, TypeScript, Node.js, Next.js" value={requiredSkills} onChange={e => setRequiredSkills(e.target.value)} className="bg-card border-border h-9 text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Min Experience (Years)</Label>
                    <Input type="number" min="0" value={minExperienceYears} onChange={e => setMinExperienceYears(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Max Experience (Years)</Label>
                    <Input type="number" min="0" value={maxExperienceYears} onChange={e => setMaxExperienceYears(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Educational Criteria</Label>
                  <Input placeholder="e.g. Bachelor in Computer Science or equivalent" value={educationalCriteria} onChange={e => setEducationalCriteria(e.target.value)} className="bg-card border-border h-9 text-sm" />
                </div>
              </TabsContent>

              {/* Tab 3: Salary & Approvals (Box 1 & 3) */}
              <TabsContent value="salary" className="space-y-3 pt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Min Salary Budget</Label>
                    <Input type="number" placeholder="60000" value={minSalary} onChange={e => setMinSalary(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Max Salary Budget</Label>
                    <Input type="number" placeholder="95000" value={maxSalary} onChange={e => setMaxSalary(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Currency</Label>
                    <Input placeholder="USD" value={salaryCurrency} onChange={e => setSalaryCurrency(e.target.value)} className="bg-card border-border h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Approved Requisition Budget ($)</Label>
                    <Input type="number" placeholder="100000" value={approvedBudgetAmount} onChange={e => setApprovedBudgetAmount(e.target.value)} className="bg-card border-border h-9 text-sm font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Budget Approval Status</Label>
                    <Select value={budgetApprovalStatus} onValueChange={setBudgetApprovalStatus}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVED">Approved Budget</SelectItem>
                        <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                        <SelectItem value="BUDGET_EXCEPTION">Budget Exception</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setJobModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Create Requisition
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Candidate Modal */}
      <Dialog open={candModalOpen} onOpenChange={setCandModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Add Candidate to Job</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Add a candidate application into the recruitment pipeline.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCandidate} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Job Opening <span className="text-red-500">*</span></Label>
              <Select value={selectedJobId} onValueChange={(v) => setSelectedJobId(v || '')}>
                <SelectTrigger className="w-full bg-card border-border h-10 text-sm">
                  <SelectValue placeholder="Select a job opening..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={j.id} className="cursor-pointer text-sm">
                      {j.title} {j.location ? `(${j.location})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Candidate Full Name <span className="text-red-500">*</span></Label>
              <Input placeholder="Jane Doe" value={candName} onChange={e => setCandName(e.target.value)} required className="bg-card border-border" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address <span className="text-red-500">*</span></Label>
                <Input type="email" placeholder="jane@example.com" value={candEmail} onChange={e => setCandEmail(e.target.value)} required className="bg-card border-border" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input placeholder="+1 555-0199" value={candPhone} onChange={e => setCandPhone(e.target.value)} className="bg-card border-border" />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setCandModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Add Candidate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ApplicationEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        application={editApp}
        jobs={jobs.map((j) => ({ id: j.id, title: j.title }))}
        stages={STAGES}
        workspaceId={activeWorkspace?.id}
        onSaved={fetchRecruitment}
      />

    </div>
  );
}
