'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
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

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export default function RecruitmentPage() {
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('people_manage' as any);

  const [jobs, setJobs] = useState<any[]>([]);
  const [, setCandidates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!candName.trim() || !candEmail.trim() || !selectedJobId || !activeWorkspace?.id) return;
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

      toast.success(`Application moved to ${newStage}`);
      fetchRecruitment();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update stage');
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
              <Button variant="outline" onClick={() => setCandModalOpen(true)} className="bg-card">
                <UserCheck className="size-4 mr-2" /> Add Candidate
              </Button>
              <Button onClick={() => setJobModalOpen(true)} className="bg-primary text-primary-foreground">
                <Plus className="size-4 mr-2" /> Create Job Opening
              </Button>
            </div>
          )
        }
      />

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="pipeline">Candidate Pipeline (Kanban)</TabsTrigger>
          <TabsTrigger value="jobs">Job Openings ({jobs.length})</TabsTrigger>
        </TabsList>

        {/* Candidate Pipeline Kanban */}
        <TabsContent value="pipeline" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto">
              {STAGES.map(stage => {
                const stageApps = applications.filter(a => a.stage === stage);

                return (
                  <div key={stage} className="bg-muted/30 border border-border rounded-lg p-3 min-w-[200px] flex flex-col gap-3">
                    <div className="flex items-center justify-between font-semibold text-xs text-foreground uppercase tracking-wider">
                      <span>{stage}</span>
                      <Badge variant="secondary" className="text-[10px]">{stageApps.length}</Badge>
                    </div>

                    <div className="space-y-2 min-h-[300px]">
                      {stageApps.map(a => (
                        <Card key={a.id} className="border-border bg-card shadow-xs p-3 space-y-2 text-xs">
                          <div className="font-semibold text-foreground">{a.candidate?.full_name || 'Candidate'}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{a.candidate?.email}</div>
                          <Badge variant="outline" className="text-[9px] bg-secondary/40">
                            {a.job?.title || 'Job Opening'}
                          </Badge>

                          <div className="pt-2 flex items-center justify-between border-t border-border/40 text-[10px]">
                            {stage !== 'HIRED' && (
                              <button
                                onClick={() => {
                                  const nextIdx = STAGES.indexOf(stage) + 1;
                                  if (nextIdx < STAGES.length) handleMoveStage(a.id, STAGES[nextIdx]);
                                }}
                                className="text-primary hover:underline flex items-center gap-0.5"
                              >
                                Advance <ChevronRight className="size-3" />
                              </button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Job Opening</DialogTitle>
            <DialogDescription>Post a new open job role for recruitment.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateJob} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input placeholder="e.g. Senior Frontend Developer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input placeholder="Remote / New York / Hybrid" value={jobLocation} onChange={e => setJobLocation(e.target.value)} />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Candidate to Job</DialogTitle>
            <DialogDescription>Add a candidate application into the recruitment pipeline.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCandidate} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Job Opening</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-popover px-3 text-xs"
                value={selectedJobId}
                onChange={e => setSelectedJobId(e.target.value)}
              >
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Candidate Full Name</Label>
              <Input placeholder="Jane Doe" value={candName} onChange={e => setCandName(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" placeholder="jane@example.com" value={candEmail} onChange={e => setCandEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input placeholder="+1 555-0199" value={candPhone} onChange={e => setCandPhone(e.target.value)} />
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
    </div>
  );
}
