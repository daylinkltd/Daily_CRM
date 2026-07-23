'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Briefcase, Plus } from 'lucide-react';
import { PlanningView } from '@/components/projects/planning-view';
import { SprintBurndown } from '@/components/projects/sprint-burndown';
import { ProjectVelocity } from '@/components/projects/project-velocity';
import { ProjectForm } from '@/components/projects/project-form';

export default function PlanningPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('projects_manage' as any);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [projectFormOpen, setProjectFormOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false });

    const projList = data || [];
    setProjects(projList);

    if (projList.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projList[0].id);
    }

    setLoading(false);
  }, [activeWorkspace?.id, supabase, selectedProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading planning data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sprint & Backlog Planning"
        description="Plan Sprints, manage Epics, backlog grooming, and track team velocity."
        action={
          <div className="flex items-center gap-3">
            {projects.length > 0 && (
              <Select value={selectedProjectId} onValueChange={(val) => setSelectedProjectId(val || '')}>
                <SelectTrigger className="w-[220px] bg-card border-border">
                  <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canManage && (
              <Button onClick={() => setProjectFormOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                <Plus className="size-4 mr-2" /> New Project
              </Button>
            )}
          </div>
        }
      />

      {projects.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="size-12 text-muted-foreground opacity-20 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Projects Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create your first project to start planning Sprints, Epics, and Backlog tasks.
            </p>
            {canManage && (
              <Button onClick={() => setProjectFormOpen(true)}>
                <Plus className="size-4 mr-2" /> Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : selectedProjectId ? (
        <div className="space-y-8">
          <PlanningView projectId={selectedProjectId} canManage={canManage} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SprintBurndown projectId={selectedProjectId} />
            <ProjectVelocity projectId={selectedProjectId} />
          </div>
        </div>
      ) : null}

      <ProjectForm
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        onSaved={fetchProjects}
      />
    </div>
  );
}
