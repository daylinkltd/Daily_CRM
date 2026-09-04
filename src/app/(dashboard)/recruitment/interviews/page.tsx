'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  Plus,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Briefcase,
  User,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';

interface CandidateInterview {
  id: string;
  workspace_id: string;
  application_id: string;
  interviewer_member_id?: string;
  interview_type: string;
  scheduled_at: string;
  rating?: number;
  feedback_notes?: string;
  decision: 'PASSED' | 'REJECTED' | 'PENDING';
  application?: {
    id: string;
    stage: string;
    candidate?: {
      id: string;
      full_name: string;
      email: string;
      phone?: string;
      resume_url?: string;
    };
    job?: {
      id: string;
      title: string;
    };
  };
}

export default function CandidateInterviewsPage() {
  const { activeWorkspace } = useWorkspace();
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scorecardModalOpen, setScorecardModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<CandidateInterview | null>(null);

  // Applications list for schedule modal
  const [applications, setApplications] = useState<any[]>([]);

  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    applicationId: '',
    interviewType: 'TECHNICAL',
    scheduledAt: '',
  });

  const [scorecardForm, setScorecardForm] = useState({
    rating: 4,
    feedbackNotes: '',
    decision: 'PASSED' as 'PASSED' | 'REJECTED' | 'PENDING',
  });

  const fetchInterviews = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/recruitment/interviews?workspaceId=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setInterviews(data.interviews || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  const fetchApplications = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    try {
      const res = await fetch(`/api/hr/recruitment?workspaceId=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchInterviews();
    fetchApplications();
  }, [fetchInterviews, fetchApplications]);

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !scheduleForm.applicationId || !scheduleForm.scheduledAt) {
      toast.error('Please select candidate application and interview date/time');
      return;
    }

    try {
      const res = await fetch('/api/hr/recruitment/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          applicationId: scheduleForm.applicationId,
          interviewType: scheduleForm.interviewType,
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
        }),
      });

      if (res.ok) {
        toast.success('Candidate interview scheduled successfully!');
        setScheduleModalOpen(false);
        setScheduleForm({ applicationId: '', interviewType: 'TECHNICAL', scheduledAt: '' });
        fetchInterviews();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to schedule interview');
      }
    } catch (err) {
      toast.error('Error scheduling interview');
    }
  };

  const handleOpenScorecard = (interview: CandidateInterview) => {
    setSelectedInterview(interview);
    setScorecardForm({
      rating: interview.rating || 4,
      feedbackNotes: interview.feedback_notes || '',
      decision: interview.decision || 'PASSED',
    });
    setScorecardModalOpen(true);
  };

  const handleSubmitScorecard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !selectedInterview) return;

    try {
      const res = await fetch('/api/hr/recruitment/interviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedInterview.id,
          workspaceId: activeWorkspace.id,
          rating: scorecardForm.rating,
          feedbackNotes: scorecardForm.feedbackNotes,
          decision: scorecardForm.decision,
        }),
      });

      if (res.ok) {
        toast.success('Interview scorecard rating & decision saved!');
        setScorecardModalOpen(false);
        setSelectedInterview(null);
        fetchInterviews();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save scorecard');
      }
    } catch (err) {
      toast.error('Error submitting scorecard');
    }
  };

  const filteredInterviews = interviews.filter((item) => {
    const candidateName = item.application?.candidate?.full_name || '';
    const jobTitle = item.application?.job?.title || '';
    const matchesSearch =
      !searchQuery ||
      candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      jobTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.decision === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="size-6 text-primary" />
            Interview Scheduling & Candidate Scorecards
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedule candidate interviews, record 1–5 rating scorecards, and submit hiring decisions.
          </p>
        </div>

        <Button onClick={() => setScheduleModalOpen(true)} className="font-bold">
          <Plus className="size-4 mr-1.5" />
          Schedule Interview
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl shadow-xs">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name or job role..."
            className="pl-9 text-xs h-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] text-xs h-9 bg-background">
              <SelectValue placeholder="Filter Decision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Decisions</SelectItem>
              <SelectItem value="PENDING">Pending Evaluation</SelectItem>
              <SelectItem value="PASSED">Passed / Recommend</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Interviews Grid */}
      {loading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading interview schedule...</Card>
      ) : filteredInterviews.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted-foreground space-y-2">
          <CalendarIcon className="size-8 mx-auto opacity-30" />
          <p className="font-semibold text-sm">No interviews found</p>
          <p>Schedule a candidate interview to begin evaluating applicants.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInterviews.map((interview) => {
            const cand = interview.application?.candidate;
            const job = interview.application?.job;
            const isPassed = interview.decision === 'PASSED';
            const isRejected = interview.decision === 'REJECTED';

            return (
              <Card
                key={interview.id}
                className="bg-card border-border hover:border-primary/50 transition-all flex flex-col justify-between p-5 rounded-xl shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground leading-snug">{cand?.full_name || 'Candidate'}</h3>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Briefcase className="size-3 text-primary" />
                        {job?.title || 'Job Opening'}
                      </span>
                    </div>

                    <Badge
                      variant={isPassed ? 'default' : isRejected ? 'destructive' : 'secondary'}
                      className="text-[10px] font-bold uppercase tracking-wider shrink-0"
                    >
                      {interview.decision}
                    </Badge>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-lg space-y-1.5 text-xs border border-border/40">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon className="size-3.5 text-primary" />
                        Date & Time:
                      </span>
                      <span className="font-semibold text-foreground">
                        {new Date(interview.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
                      <span>Interview Round:</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">{interview.interview_type}</Badge>
                    </div>

                    {interview.rating && (
                      <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
                        <span>Scorecard Rating:</span>
                        <span className="font-bold text-amber-500 flex items-center gap-1">
                          <Star className="size-3.5 fill-amber-500 text-amber-500" />
                          {interview.rating} / 5
                        </span>
                      </div>
                    )}
                  </div>

                  {interview.feedback_notes && (
                    <div className="text-xs space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Feedback Notes:</span>
                      <p className="text-muted-foreground italic bg-background p-2.5 rounded-md border border-border/60 text-[11px] line-clamp-3">
                        "{interview.feedback_notes}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border/50 mt-4 flex items-center justify-between gap-2">
                  {cand?.resume_url ? (
                    <a
                      href={cand.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      View Resume
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{cand?.email}</span>
                  )}

                  <Button
                    size="sm"
                    variant={interview.decision === 'PENDING' ? 'default' : 'outline'}
                    onClick={() => handleOpenScorecard(interview)}
                    className="text-xs font-semibold h-8"
                  >
                    <Star className="size-3.5 mr-1" />
                    {interview.rating ? 'Edit Scorecard' : 'Rate & Evaluate'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Schedule Interview Modal */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CalendarIcon className="size-4 text-primary" />
              Schedule Candidate Interview
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an active candidate application and schedule an evaluation round.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleScheduleInterview} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Select Candidate Application</Label>
              <Select
                value={scheduleForm.applicationId}
                onValueChange={(val) => setScheduleForm({ ...scheduleForm, applicationId: val })}
              >
                <SelectTrigger className="bg-background text-xs h-9">
                  <SelectValue placeholder="Choose applicant..." />
                </SelectTrigger>
                <SelectContent>
                  {applications.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.candidate?.full_name} — {app.job?.title} ({app.stage})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Interview Type / Round</Label>
                <Select
                  value={scheduleForm.interviewType}
                  onValueChange={(val) => setScheduleForm({ ...scheduleForm, interviewType: val })}
                >
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TECHNICAL">Technical Round</SelectItem>
                    <SelectItem value="HR">HR & Culture Fit</SelectItem>
                    <SelectItem value="MANAGER">Hiring Manager Round</SelectItem>
                    <SelectItem value="EXECUTIVE">Leadership Round</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Scheduled Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduleForm.scheduledAt}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                  className="bg-background text-xs h-9"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setScheduleModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Schedule Interview
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Scorecard Modal */}
      <Dialog open={scorecardModalOpen} onOpenChange={setScorecardModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Star className="size-4 text-amber-500 fill-amber-500" />
              Candidate Scorecard & Hiring Decision
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Rate candidate performance for {selectedInterview?.application?.candidate?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitScorecard} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Performance Rating (1 to 5 Stars)</Label>
              <div className="flex items-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setScorecardForm({ ...scorecardForm, rating: star })}
                    className="p-1 hover:scale-110 transition-transform focus:outline-none"
                  >
                    <Star
                      className={`size-7 ${
                        star <= scorecardForm.rating
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
                <span className="font-bold text-sm ml-2 text-foreground">{scorecardForm.rating} / 5 Stars</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Hiring Decision</Label>
              <Select
                value={scorecardForm.decision}
                onValueChange={(val: any) => setScorecardForm({ ...scorecardForm, decision: val })}
              >
                <SelectTrigger className="bg-background text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">PENDING — Under Review</SelectItem>
                  <SelectItem value="PASSED">PASSED — Recommend Next Round / Offer</SelectItem>
                  <SelectItem value="REJECTED">REJECTED — Do Not Pursue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Interviewer Feedback & Notes</Label>
              <Textarea
                value={scorecardForm.feedbackNotes}
                onChange={(e) => setScorecardForm({ ...scorecardForm, feedbackNotes: e.target.value })}
                placeholder="Enter technical competencies, communication evaluation, strengths, and concerns..."
                className="bg-background text-xs min-h-[90px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setScorecardModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Save Scorecard & Decision
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
