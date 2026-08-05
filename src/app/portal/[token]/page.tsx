import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { ShieldCheck, Calendar, LayoutTemplate } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectTimeline } from '@/components/projects/project-timeline';
import { ProjectKanban } from '@/components/tasks/project-kanban';

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch project using the public token
  const { data: project } = await supabase
    .from('projects')
    // `projects` has no `description` column. Selecting it errored, so
    // `project` was null and every share link fell through to notFound() —
    // the whole public portal returned 404.
    .select('id, name, is_public, portal_settings, workspaces(name, logo_url)')
    .eq('public_share_token', token)
    .single();

  if (!project || !project.is_public) {
    notFound();
  }

  const projData = project as any;
  const workspaceName = Array.isArray(projData?.workspaces) ? projData.workspaces[0]?.name : projData?.workspaces?.name;
  const settings = project.portal_settings || { show_timeline: true, show_board: false };

  // Determine default tab
  const defaultTab = settings.show_timeline ? 'timeline' : 'board';

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-muted flex flex-col">
      {/* Portal Header */}
      <header className="bg-card border-b h-16 flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="size-8 bg-primary/10 text-primary rounded-none flex items-center justify-center font-bold">
            {workspaceName?.charAt(0) || 'W'}
          </div>
          <div>
            <h1 className="font-semibold text-sm">{project.name}</h1>
            <p className="text-xs text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <ShieldCheck className="size-4" />
          Secure Client Portal
        </div>
      </header>

      {/* Portal Content */}
      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-lg font-semibold tracking-tight mb-2">Project Overview</h2>
          {/* No description paragraph: `projects` has no such column, so this
              block could never render. Add one to the table first if the
              portal should show a project blurb. */}
        </div>

        {(!settings.show_timeline && !settings.show_board) ? (
          <div className="text-center py-20 border border-dashed rounded-lg bg-card">
            <LayoutTemplate className="size-10 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-medium text-lg">No Modules Enabled</h3>
            <p className="text-muted-foreground mt-1">The project manager has not enabled any modules for this portal.</p>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="mb-6">
              {settings.show_timeline && (
                <TabsTrigger value="timeline" className="flex items-center gap-2">
                  <Calendar className="size-4" /> Timeline
                </TabsTrigger>
              )}
              {settings.show_board && (
                <TabsTrigger value="board" className="flex items-center gap-2">
                  <LayoutTemplate className="size-4" /> Board
                </TabsTrigger>
              )}
            </TabsList>

            {settings.show_timeline && (
              <TabsContent value="timeline" className="m-0 focus-visible:outline-none">
                {/* Note: The ProjectTimeline internally fetches its own data. Since the user is unauthenticated, 
                    the RLS policies (048) will allow the fetch because the parent project is public. */}
                <ProjectTimeline projectId={project.id} />
              </TabsContent>
            )}

            {settings.show_board && (
              <TabsContent value="board" className="m-0 focus-visible:outline-none">
                {/* Note: The ProjectKanban internally fetches its own data. We pass canManage=false so it renders read-only */}
                <ProjectKanban projectId={project.id} canManage={false} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>
    </div>
  );
}
