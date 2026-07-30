'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { useWorkspace } from '@/hooks/use-workspace';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { EmployeeProfileOverview } from '@/components/employees/employee-profile-overview';
import { EmployeeAssetsTab } from '@/components/employees/employee-assets-tab';
import { EmployeeDocumentsTab } from '@/components/employees/employee-documents-tab';

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace, can } = useWorkspace();
  const canManagePeople = can('people_manage');

  const [employee, setEmployee] = useState<any | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfileData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    // 1. Fetch employee (two-step: workspace_members.user_id refs auth.users not public.profiles)
    const { data: rawEmpData, error: empErr } = await supabase
      .from('employee_profiles')
      .select(`*, workspace_members!inner ( id, user_id, role )`)
      .eq('workspace_id', activeWorkspace.id)
      .eq('workspace_member_id', id)
      .single();

    if (empErr) {
      toast.error('Failed to load employee profile');
      setLoading(false);
      return;
    }

    // Enrich with profile
    const empData: any = rawEmpData;
    if (empData?.workspace_members?.user_id) {
      const { data: prof } = await supabase.from('profiles').select('user_id, full_name, email, avatar_url').eq('user_id', empData.workspace_members.user_id).single();
      if (prof) empData.workspace_members.profiles = prof;
    }
    setEmployee(empData);

    // 2. Fetch reference data for the edit form
    const [deptRes, desigRes, rawMgrRes] = await Promise.all([
      supabase.from('departments').select('id, name').eq('workspace_id', activeWorkspace.id).order('name'),
      supabase.from('designations').select('id, title').eq('workspace_id', activeWorkspace.id).order('title'),
      supabase.from('employee_profiles').select(`workspace_member_id, workspace_members!inner ( id, user_id )`).eq('workspace_id', activeWorkspace.id)
    ]);

    if (deptRes.data) setDepartments(deptRes.data);
    if (desigRes.data) setDesignations(desigRes.data);

    // Enrich managers with profiles
    if (rawMgrRes.data && rawMgrRes.data.length > 0) {
      const mgrUserIds = rawMgrRes.data.map((m: any) => m.workspace_members?.user_id).filter(Boolean);
      const { data: mgrProfilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', mgrUserIds);
      const mgrProfileMap = Object.fromEntries((mgrProfilesData || []).map((p: any) => [p.user_id, p]));
      setManagers(rawMgrRes.data.map((m: any) => ({
        ...m,
        workspace_members: m.workspace_members
          ? { ...m.workspace_members, profiles: mgrProfileMap[m.workspace_members.user_id] || null }
          : null,
      })));
    }

    setLoading(false);
  }, [supabase, activeWorkspace?.id, id]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading profile...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-sm text-muted-foreground mb-4">Employee not found.</p>
        <Button variant="outline" onClick={() => router.push('/employees')}>Back to Directory</Button>
      </div>
    );
  }

  const profile = Array.isArray(employee.workspace_members?.profiles) 
    ? employee.workspace_members?.profiles[0] 
    : employee.workspace_members?.profiles;
  const fullName = profile?.full_name || 'Unknown User';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit" onClick={() => router.push('/employees')}>
        <ChevronLeft className="size-4" />
        Back to Directory
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border border-border">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
              {fullName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              {fullName}
              <StatusBadge status={employee.status || 'ACTIVE'} />
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{profile?.email}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-muted w-full justify-start overflow-x-auto h-auto p-1 rounded-lg">
          <TabsTrigger value="overview" className="py-2">Overview</TabsTrigger>
          <TabsTrigger value="assets" className="py-2">Assets</TabsTrigger>
          <TabsTrigger value="documents" className="py-2">Documents</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <EmployeeProfileOverview 
              employee={employee} 
              departments={departments}
              designations={designations}
              managers={managers}
              canEdit={canManagePeople}
              onSaved={fetchProfileData}
            />
          </TabsContent>
          <TabsContent value="assets" className="m-0 focus-visible:outline-none">
            <EmployeeAssetsTab employeeId={id} canEdit={canManagePeople} />
          </TabsContent>
          <TabsContent value="documents" className="m-0 focus-visible:outline-none">
            <EmployeeDocumentsTab employeeId={id} canEdit={canManagePeople} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
