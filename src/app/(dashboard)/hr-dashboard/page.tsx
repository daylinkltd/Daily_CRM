'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  CalendarClock,
  Briefcase,
  Gift,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  TrendingUp,
  UserPlus,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HRDashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({
    totalEmployees: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingApprovals: 0,
    pendingLeaves: 0,
    pendingRequests: 0,
    openJobs: 0
  });

  useEffect(() => {
    async function loadDashboardMetrics() {
      if (!activeWorkspace?.id) return;
      setLoading(true);

      try {
        const res = await fetch(`/api/hr/dashboard?workspaceId=${activeWorkspace.id}`);
        const json = await res.json();
        if (json.metrics) {
          setMetrics(json.metrics);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardMetrics();
  }, [activeWorkspace?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Executive Dashboard"
        description="Real-time workforce headcount, daily attendance, pending approvals, recruitment, and HR operations."
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card shadow-sm cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/employees')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Total Workforce</span>
              <Users className="size-4 text-blue-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{metrics.totalEmployees}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Active employee profiles
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => router.push('/attendance')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Present Today</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-500">{metrics.presentToday}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Punched in for today's shift
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm cursor-pointer hover:border-amber-500/50 transition-colors" onClick={() => router.push('/leave')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Pending Approvals</span>
              <Clock className="size-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-500">{metrics.pendingApprovals}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {metrics.pendingLeaves} Leaves • {metrics.pendingRequests} ESS Requests
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => router.push('/recruitment')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Open Job Roles</span>
              <Briefcase className="size-4 text-purple-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-500">{metrics.openJobs}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Active recruitment openings
          </CardContent>
        </Card>
      </div>

      {/* Actionable HR Operations Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Action Navigation */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">HR Operations & Workflows</CardTitle>
            <CardDescription>Quick access to essential HR management modules</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button variant="outline" onClick={() => router.push('/recruitment')} className="h-20 flex flex-col items-center justify-center gap-1.5 bg-muted/20">
              <Briefcase className="size-5 text-purple-500" />
              <span className="text-xs">Recruitment</span>
            </Button>

            <Button variant="outline" onClick={() => router.push('/shifts')} className="h-20 flex flex-col items-center justify-center gap-1.5 bg-muted/20">
              <Clock className="size-5 text-emerald-500" />
              <span className="text-xs">Shifts & Roster</span>
            </Button>

            <Button variant="outline" onClick={() => router.push('/holidays')} className="h-20 flex flex-col items-center justify-center gap-1.5 bg-muted/20">
              <CalendarClock className="size-5 text-blue-500" />
              <span className="text-xs">Holidays</span>
            </Button>

            <Button variant="outline" onClick={() => router.push('/performance')} className="h-20 flex flex-col items-center justify-center gap-1.5 bg-muted/20">
              <TrendingUp className="size-5 text-amber-500" />
              <span className="text-xs">Performance</span>
            </Button>

            <Button variant="outline" onClick={() => router.push('/requests')} className="h-20 flex flex-col items-center justify-center gap-1.5 bg-muted/20">
              <FileCheck className="size-5 text-indigo-500" />
              <span className="text-xs">ESS Requests</span>
            </Button>

            <Button variant="outline" onClick={() => router.push('/policies')} className="h-20 flex flex-col items-center justify-center gap-1.5 bg-muted/20">
              <CheckCircle2 className="size-5 text-teal-500" />
              <span className="text-xs">Policies</span>
            </Button>
          </CardContent>
        </Card>

        {/* Action Needed Alerts */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Action Needed Today</CardTitle>
            <CardDescription>Operational items requiring HR attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-amber-600" />
                <span><strong>{metrics.pendingLeaves} Leave Applications</strong> waiting for approval</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => router.push('/leave')} className="text-xs text-amber-700 dark:text-amber-300">
                Review
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="size-4 shrink-0 text-blue-600" />
                <span><strong>{metrics.pendingRequests} Employee Requests</strong> (Bank details, Certificates)</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => router.push('/requests')} className="text-xs text-blue-700 dark:text-blue-300">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
