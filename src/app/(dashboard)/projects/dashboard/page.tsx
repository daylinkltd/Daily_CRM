'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Target, Clock, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function ProjectDashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace, defaultCurrency } = useWorkspace();

  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    onHold: 0,
    totalBudget: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('projects')
      .select('status, budget')
      .eq('workspace_id', activeWorkspace.id);

    if (!error && data) {
      const active = data.filter(p => p.status === 'active').length;
      const completed = data.filter(p => p.status === 'completed').length;
      const onHold = data.filter(p => p.status === 'on_hold').length;
      const totalBudget = data.reduce((acc, curr) => acc + (curr.budget || 0), 0);

      setStats({ active, completed, onHold, totalBudget });
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Projects Overview" 
        description="High-level metrics and health tracking across all workspace projects."
        action={
          <Button onClick={() => router.push('/projects')} variant="outline" className="shadow-sm border-border">
            View All Projects
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
            <Briefcase className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? '-' : stats.active}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? '-' : stats.completed}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Hold</CardTitle>
            <Clock className="size-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? '-' : stats.onHold}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting client or resources</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget Tracking</CardTitle>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? '-' : formatCurrency(stats.totalBudget, defaultCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all active & completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Resource Allocation</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Users className="size-8 text-muted-foreground/50" />
              <p className="text-sm">Resource timeline coming in Sprint 5</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Target className="size-8 text-muted-foreground/50" />
              <p className="text-sm">Deadline calendar coming in Sprint 4</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
