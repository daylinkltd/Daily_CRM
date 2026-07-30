'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Loader2, Briefcase, Calendar, Banknote, Target, Users, Settings } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useWorkspace } from '@/hooks/use-workspace';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectKanban } from '@/components/tasks/project-kanban';
import { PlanningView } from '@/components/projects/planning-view';
import { WorkflowSettings } from '@/components/projects/workflow-settings';
import { AutomationsSettings } from '@/components/projects/automations-settings';
import { ProjectTimeline } from '@/components/projects/project-timeline';
import { ProjectTaskList } from '@/components/projects/project-task-list';
import { ProjectReportsGallery } from '@/components/projects/project-reports-gallery';

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace, can, defaultCurrency } = useWorkspace();
  const canManageProjects = can('projects_manage');

  const [project, setProject] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjectData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    const { data: projData, error: projErr } = await supabase
      .from('projects')
      .select(`
        *,
        manager:workspace_members!projects_manager_workspace_member_id_fkey (
          id, user_id
        ),
        client:contacts!projects_client_id_fkey ( name, company )
      `)
      .eq('workspace_id', activeWorkspace.id)
      .eq('id', id)
      .single();

    if (projErr) {
      toast.error('Failed to load project details');
      setLoading(false);
      return;
    }

    // Enrich manager with profile (two-step: workspace_members.user_id refs auth.users not public.profiles)
    if (projData?.manager?.user_id) {
      const { data: prof } = await supabase.from('profiles').select('user_id, full_name, avatar_url').eq('user_id', projData.manager.user_id).single();
      if (prof) projData.manager.profiles = prof;
    }
    setProject(projData);

    const { data: rawMemData } = await supabase
      .from('project_members')
      .select(`*, workspace_members!inner ( id, user_id )`)
      .eq('project_id', id);

    if (rawMemData && rawMemData.length > 0) {
      const userIds = rawMemData.map((m: any) => m.workspace_members?.user_id).filter(Boolean);
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, avatar_url').in('user_id', userIds);
      const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
      const enriched = rawMemData.map((m: any) => ({
        ...m,
        workspace_members: m.workspace_members
          ? { ...m.workspace_members, profiles: profileMap[m.workspace_members.user_id] || null }
          : null,
      }));
      setMembers(enriched);
    }

    setLoading(false);
  }, [supabase, activeWorkspace?.id, id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-sm text-muted-foreground mb-4">Project not found.</p>
        <Button variant="outline" onClick={() => router.push('/projects')}>Back to Projects</Button>
      </div>
    );
  }

  const managerProfile = Array.isArray(project.manager?.profiles) 
    ? project.manager?.profiles[0] 
    : project.manager?.profiles;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/15 text-emerald-700 border-emerald-200';
      case 'completed': return 'bg-blue-500/15 text-blue-700 border-blue-200';
      case 'on_hold': return 'bg-orange-500/15 text-orange-700 border-orange-200';
      case 'cancelled': return 'bg-red-500/15 text-red-700 border-red-200';
      default: return 'bg-muted/15 text-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit" onClick={() => router.push('/projects')}>
        <ChevronLeft className="size-4" />
        Back to Projects
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center size-14 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Briefcase className="size-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              {project.name}
              <Badge variant="outline" className={getStatusColor(project.status)}>
                {project.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="uppercase text-[10px] tracking-wide bg-muted text-muted-foreground">
                {project.project_source}
              </Badge>
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              {project.deadline && (
                <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> Due: {new Date(project.deadline).toLocaleDateString()}</span>
              )}
              {project.client && (
                <span className="flex items-center gap-1.5"><Target className="size-3.5" /> Client: {project.client.company || project.client.name}</span>
              )}
            </div>
          </div>
        </div>
        
        {canManageProjects && (
          <Button variant="outline" className="shrink-0 shadow-sm border-border">
            <Settings className="size-4 mr-2" /> Project Settings
          </Button>
        )}
      </div>

      {/* Dynamic Methodology Tabs */}
      {(() => {
        const type = (project?.project_type || 'SCRUM').toUpperCase();

        const renderOverviewTab = () => (
          <TabsContent value="overview" className="m-0 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Card className="border-border bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Project Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Project Manager</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {managerProfile ? (
                            <>
                              <Avatar className="size-6">
                                <AvatarImage src={managerProfile.avatar_url} />
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{managerProfile.full_name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-foreground">{managerProfile.full_name}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Budget</p>
                        <p className="text-sm text-foreground mt-1.5 flex items-center gap-1">
                          <Banknote className="size-4 text-emerald-500" />
                          {project.budget ? formatCurrency(project.budget, defaultCurrency) : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Users className="size-4" /> Team Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {members.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No members assigned.</p>
                    ) : (
                      <div className="space-y-3">
                        {members.map(m => {
                          const prof = Array.isArray(m.workspace_members?.profiles) ? m.workspace_members.profiles[0] : m.workspace_members?.profiles;
                          return (
                            <div key={m.id} className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarImage src={prof?.avatar_url} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">{prof?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">{prof?.full_name || 'Unknown'}</span>
                                <span className="text-xs text-muted-foreground capitalize">{m.role || 'Member'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        );

        if (type === 'KANBAN') {
          return (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-muted w-full justify-start overflow-x-auto h-auto p-1 rounded-lg">
                <TabsTrigger value="overview" className="py-2">Overview</TabsTrigger>
                <TabsTrigger value="board" className="py-2">Board</TabsTrigger>
                <TabsTrigger value="list" className="py-2">List</TabsTrigger>
                <TabsTrigger value="timeline" className="py-2">Timeline</TabsTrigger>
                <TabsTrigger value="reports" className="py-2">Reports</TabsTrigger>
                <TabsTrigger value="files" className="py-2">Files</TabsTrigger>
                <TabsTrigger value="settings" className="py-2">Settings</TabsTrigger>
              </TabsList>

              <div className="mt-6">
                {renderOverviewTab()}
                <TabsContent value="board" className="m-0 focus-visible:outline-none">
                  <ProjectKanban projectId={id} canManage={canManageProjects} />
                </TabsContent>
                <TabsContent value="list" className="m-0 focus-visible:outline-none">
                  <ProjectTaskList projectId={id} canManage={canManageProjects} />
                </TabsContent>
                <TabsContent value="timeline" className="m-0 focus-visible:outline-none">
                  <ProjectTimeline projectId={id} />
                </TabsContent>
                <TabsContent value="reports" className="m-0 focus-visible:outline-none">
                  <ProjectReportsGallery projectId={id} projectType={project?.project_type} />
                </TabsContent>
                <TabsContent value="files" className="m-0 focus-visible:outline-none">
                  <Card className="border-border bg-card p-6"><p className="text-sm text-muted-foreground">Project files & attachments</p></Card>
                </TabsContent>
                <TabsContent value="settings" className="m-0 focus-visible:outline-none space-y-8">
                  <WorkflowSettings projectId={id} />
                  <div className="border-t pt-8">
                    <AutomationsSettings projectId={id} />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          );
        }

        if (type === 'WATERFALL' || type === 'BASIC') {
          return (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-muted w-full justify-start overflow-x-auto h-auto p-1 rounded-lg">
                <TabsTrigger value="overview" className="py-2">Overview</TabsTrigger>
                <TabsTrigger value="tasks" className="py-2">Tasks</TabsTrigger>
                <TabsTrigger value="gantt" className="py-2">Gantt</TabsTrigger>
                <TabsTrigger value="milestones" className="py-2">Milestones</TabsTrigger>
                <TabsTrigger value="files" className="py-2">Files</TabsTrigger>
                <TabsTrigger value="reports" className="py-2">Reports</TabsTrigger>
                <TabsTrigger value="settings" className="py-2">Settings</TabsTrigger>
              </TabsList>

              <div className="mt-6">
                {renderOverviewTab()}
                <TabsContent value="tasks" className="m-0 focus-visible:outline-none">
                  <ProjectTaskList projectId={id} canManage={canManageProjects} />
                </TabsContent>
                <TabsContent value="gantt" className="m-0 focus-visible:outline-none">
                  <ProjectTimeline projectId={id} />
                </TabsContent>
                <TabsContent value="milestones" className="m-0 focus-visible:outline-none">
                  <Card className="border-border bg-card p-6"><p className="text-sm text-muted-foreground">Project Milestones & Deliverables</p></Card>
                </TabsContent>
                <TabsContent value="files" className="m-0 focus-visible:outline-none">
                  <Card className="border-border bg-card p-6"><p className="text-sm text-muted-foreground">Project files & attachments</p></Card>
                </TabsContent>
                <TabsContent value="reports" className="m-0 focus-visible:outline-none">
                  <ProjectReportsGallery projectId={id} projectType={project?.project_type} />
                </TabsContent>
                <TabsContent value="settings" className="m-0 focus-visible:outline-none space-y-8">
                  <WorkflowSettings projectId={id} />
                  <div className="border-t pt-8">
                    <AutomationsSettings projectId={id} />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          );
        }

        // Default: SCRUM
        return (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-muted w-full justify-start overflow-x-auto h-auto p-1 rounded-lg">
              <TabsTrigger value="overview" className="py-2">Overview</TabsTrigger>
              <TabsTrigger value="backlog" className="py-2">Backlog</TabsTrigger>
              <TabsTrigger value="sprint" className="py-2">Sprint</TabsTrigger>
              <TabsTrigger value="board" className="py-2">Board</TabsTrigger>
              <TabsTrigger value="timeline" className="py-2">Timeline</TabsTrigger>
              <TabsTrigger value="reports" className="py-2">Reports</TabsTrigger>
              <TabsTrigger value="files" className="py-2">Files</TabsTrigger>
              <TabsTrigger value="settings" className="py-2">Settings</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              {renderOverviewTab()}
              <TabsContent value="backlog" className="m-0 focus-visible:outline-none">
                <PlanningView projectId={id} canManage={canManageProjects} />
              </TabsContent>
              <TabsContent value="sprint" className="m-0 focus-visible:outline-none">
                <ProjectKanban projectId={id} canManage={canManageProjects} />
              </TabsContent>
              <TabsContent value="board" className="m-0 focus-visible:outline-none">
                <ProjectKanban projectId={id} canManage={canManageProjects} />
              </TabsContent>
              <TabsContent value="timeline" className="m-0 focus-visible:outline-none">
                <ProjectTimeline projectId={id} />
              </TabsContent>
              <TabsContent value="reports" className="m-0 focus-visible:outline-none">
                <ProjectReportsGallery projectId={id} projectType={project?.project_type} />
              </TabsContent>
              <TabsContent value="files" className="m-0 focus-visible:outline-none">
                <Card className="border-border bg-card p-6"><p className="text-sm text-muted-foreground">Project files & attachments</p></Card>
              </TabsContent>
              <TabsContent value="settings" className="m-0 focus-visible:outline-none space-y-8">
                <WorkflowSettings projectId={id} />
                <div className="border-t pt-8">
                  <AutomationsSettings projectId={id} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        );
      })()}
    </div>
  );
}
