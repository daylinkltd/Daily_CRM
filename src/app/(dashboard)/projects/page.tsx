'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { RequireModule } from '@/components/auth/require-module';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Search, Loader2, FolderKanban, MoreHorizontal, Plus, Briefcase, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { ProjectForm } from '@/components/projects/project-form';
import { IconAction } from "@/components/ui/icon-action";

export default function ProjectsListPage() {
  return (
    <RequireModule module="projects">
      <ProjectsListPageContent />
    </RequireModule>
  );
}

function ProjectsListPageContent() {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace, can, activeRole } = useWorkspace();
  const canManageProjects = activeRole === 'owner' || activeRole === 'admin' || can('projects_manage') || can('projects_create'); 

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<any | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    let query = supabase
      .from('projects')
      .select(`
        *,
        manager:workspace_members!projects_manager_workspace_member_id_fkey (
          id, user_id
        ),
        client:contacts!projects_client_id_fkey ( name, company )
      `)
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load projects');
    } else {
      const projectList = data || [];

      // Two-step: workspace_members.user_id refs auth.users, not public.profiles
      // PostgREST cannot traverse cross-schema FKs, so we enrich separately
      const managerUserIds = projectList.map((p: any) => p.manager?.user_id).filter(Boolean);
      if (managerUserIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', managerUserIds);
        const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
        projectList.forEach((p: any) => {
          if (p.manager?.user_id) p.manager.profiles = profileMap[p.manager.user_id] || null;
        });
      }

      setProjects(projectList);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, search]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/15 text-emerald-700 border-emerald-200';
      case 'completed': return 'bg-blue-500/15 text-blue-700 border-blue-200';
      case 'on_hold': return 'bg-orange-500/15 text-orange-700 border-orange-200';
      case 'cancelled': return 'bg-red-500/15 text-red-700 border-red-200';
      default: return 'bg-muted/15 text-foreground border-border';
    }
  };

  const getTypeBadge = (type: string) => {
    const t = (type || 'SCRUM').toUpperCase();
    switch (t) {
      case 'SCRUM':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200 text-[11px] font-medium">SCRUM</Badge>;
      case 'KANBAN':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 text-[11px] font-medium">KANBAN</Badge>;
      case 'WATERFALL':
      case 'BASIC':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 text-[11px] font-medium">WATERFALL</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{t}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    if (source === 'CRM') return <Badge variant="secondary" className="text-[10px] uppercase">CRM Deal</Badge>;
    if (source === 'AUTOMATION') return <Badge variant="secondary" className="text-[10px] uppercase bg-purple-500/15 text-purple-700">Automation</Badge>;
    return <Badge variant="secondary" className="text-[10px] uppercase bg-muted text-muted-foreground">Manual</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="All Projects" 
        description="View and manage all active, completed, and on-hold projects."
        action={
          canManageProjects && (
            <IconAction label="New Project" icon={<Plus className="size-4 " />} onClick={() => { setEditProject(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" />
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Project Name</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Type</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Client</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">Manager</TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">Source</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading projects...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <FolderKanban className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No projects match your search.' : 'No projects found.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => {
                const managerProfile = Array.isArray(project.manager?.profiles) 
                  ? project.manager?.profiles[0] 
                  : project.manager?.profiles;

                return (
                  <TableRow 
                    key={project.id} 
                    className="border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center size-9 rounded-md bg-primary/10 border border-primary/20 text-primary">
                          <Briefcase className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{project.name}</span>
                          {project.deadline && (
                            <span className="text-xs text-muted-foreground">
                              Due: {new Date(project.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {getTypeBadge(project.project_type)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {project.client ? (project.client.company || project.client.name) : '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {managerProfile ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6 border border-border">
                            {managerProfile.avatar_url && <AvatarImage src={managerProfile.avatar_url} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                              {managerProfile.full_name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground">{managerProfile.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {getSourceBadge(project.project_source)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(project.status)}>
                        {project.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/projects/${project.id}`); }} className="cursor-pointer">
                            <ExternalLink className="size-4 mr-2" /> Open Project
                          </DropdownMenuItem>
                          {canManageProjects && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditProject(project); setFormOpen(true); }} className="cursor-pointer">
                                Edit Settings
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ProjectForm
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editProject}
        onSaved={fetchProjects}
      />
    </div>
  );
}
