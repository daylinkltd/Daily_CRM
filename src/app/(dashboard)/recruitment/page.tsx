'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Loader2, UserCheck, ChevronRight } from 'lucide-react';
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

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export default function RecruitmentPage() {
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('people_manage');

  const [jobs, setJobs] = useState<any[]>([]);
  const [, setCandidates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Board to move people along, list to see everyone at once.
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

  // Job Form
  const [jobTitle, setJobTitle] = useState('');
  const [jobLocation, setJobLocation] = useState('Remote / Hybrid');

  // Candidate Form
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candPhone, setCandPhone] = useState('');

  const fetchRecruitment = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/hr/recruitment?workspaceId=${activeWorkspace.id}`);
      const json = await res.json();
      setJobs(json.jobs || []);
      setCandidates(json.candidates || []);
      setApplications(json.applications || []);
      if (json.jobs?.length > 0 && !selectedJobId) {
        setSelectedJobId(json.jobs[0].id);
      }
    } catch {
      toast.error('Failed to load recruitment data');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, selectedJobId]);

  useEffect(() => {
    fetchRecruitment();
  }, [fetchRecruitment]);

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
          location: jobLocation
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Job Opening created');
      setJobTitle('');
      setJobModalOpen(false);
      fetchRecruitment();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create job');
    } finally {
      setSaving(false);
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
    // Optimistic: refetching on every drop makes the card visibly snap back
    // to its old column before settling in the new one.
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

    // Optimistic, restored if the server disagrees.
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
        description="Manage job openings, candidate recruitment pipelines, interview scheduling, and offer letters."
        action={
          canManage && (
            <div className="flex items-center gap-2">
              <IconAction label="Add Candidate" icon={<UserCheck className="size-4 " />} variant="outline" onClick={() => setCandModalOpen(true)} className="bg-card" />
              <IconAction label="Create Job Opening" icon={<Plus className="size-4 " />} onClick={() => setJobModalOpen(true)} className="bg-primary text-primary-foreground" />
            </div>
          )
        }
      />

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="pipeline">Candidate Pipeline</TabsTrigger>
          <TabsTrigger value="jobs">Job Openings ({jobs.length})</TabsTrigger>
        </TabsList>

        {/* Candidate Pipeline — board or list */}
        <TabsContent value="pipeline" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex justify-end">
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
            </>
          )}
        </TabsContent>

        {/* Job Openings Tab */}
        <TabsContent value="jobs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {jobs.map(j => (
              <Card key={j.id} className="border-border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      {j.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{j.location}</span>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">{j.title}</CardTitle>
                  <CardDescription className="text-xs">{j.employment_type?.replace(/_/g, ' ')}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Job Modal */}
      <Dialog open={jobModalOpen} onOpenChange={setJobModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border rounded-xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Create Job Opening</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Post a new open job role for recruitment.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateJob} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Job Title <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Senior Frontend Developer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required className="bg-card border-border" />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input placeholder="Remote / New York / Hybrid" value={jobLocation} onChange={e => setJobLocation(e.target.value)} className="bg-card border-border" />
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setJobModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Create Job
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
