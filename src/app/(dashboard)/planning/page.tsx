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
import { IconAction } from "@/components/ui/icon-action";

export default function PlanningPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('projects_manage');

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [projectFormOpen, setProjectFormOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('projects')
      .select('id, name, project_type')
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

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const isKanban = selectedProject?.project_type?.toUpperCase() === 'KANBAN';
  const isWaterfall = ['WATERFALL', 'BASIC'].includes(selectedProject?.project_type?.toUpperCase() || '');

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
        title="Planning Hub"
        description="Plan Sprints, manage Epics, backlog grooming, and track team velocity."
        action={
          <div className="flex items-center gap-3">
            {projects.length > 0 && (
              <Select value={selectedProjectId} onValueChange={(val) => setSelectedProjectId(val || '')}>
                <SelectTrigger className="w-[240px] bg-card border-border">
                  <SelectValue placeholder="Select Project">
                    {selectedProject ? `${selectedProject.name} (${selectedProject.project_type || 'SCRUM'})` : 'Select Project'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} label={p.name}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{p.name}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-none bg-muted text-muted-foreground">
                          {p.project_type || 'SCRUM'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canManage && (
              <IconAction label="New Project" icon={<Plus className="size-4 " />} onClick={() => setProjectFormOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" />
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
              Create your first project to start planning tasks and workflows.
            </p>
            {canManage && (
              <IconAction label="Create Project" icon={<Plus className="size-4 " />} onClick={() => setProjectFormOpen(true)} />
            )}
          </CardContent>
        </Card>
      ) : selectedProjectId ? (
        isKanban ? (
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-500/10 text-blue-600 mb-2">
                <Briefcase className="size-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{selectedProject?.name} (Kanban Project)</h3>
              <p className="text-muted-foreground max-w-lg mx-auto text-sm">
                Kanban projects operate on continuous flow without fixed Sprints or Sprint Burndown charts. Work items are managed directly on the project&apos;s Kanban Board.
              </p>
              <div className="pt-2">
                <Button onClick={() => window.location.href = `/projects/${selectedProjectId}`} variant="outline" className="border-border">
                  Go to {selectedProject?.name} Kanban Board
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isWaterfall ? (
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 text-amber-600 mb-2">
                <Calendar className="size-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{selectedProject?.name} (Waterfall Project)</h3>
              <p className="text-muted-foreground max-w-lg mx-auto text-sm">
                Waterfall projects follow sequential milestones and deliverables using Gantt timelines instead of Sprints.
              </p>
              <div className="pt-2">
                <Button onClick={() => window.location.href = `/projects/${selectedProjectId}`} variant="outline" className="border-border">
                  Go to {selectedProject?.name} Gantt & Milestones
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* SCRUM Project */
          <div className="space-y-8">
            <PlanningView projectId={selectedProjectId} canManage={canManage} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SprintBurndown projectId={selectedProjectId} />
              <ProjectVelocity projectId={selectedProjectId} />
            </div>
          </div>
        )
      ) : null}

      <ProjectForm
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        onSaved={fetchProjects}
      />
    </div>
  );
}
