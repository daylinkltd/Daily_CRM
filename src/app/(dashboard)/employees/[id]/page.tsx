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
import { EmployeeAttendanceTab } from '@/components/employees/employee-attendance-tab';
import { EmployeeCompensationTab } from '@/components/employees/employee-compensation-tab';
import { EmployeeLettersTab } from '@/components/employees/employee-letters-tab';

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
    if (!id) return;
    setLoading(true);

    try {
      let empData: any = null;

      // Step 1: Query employee_profiles by workspace_member_id or id
      // employee_profiles is keyed by workspace_member_id and has no `id`
      // column; the previous `.or(...,id.eq.)` filter referenced a column
      // that does not exist, so this query always errored and the page
      // limped along on the fallback below.
      const { data: rawEmp } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('workspace_member_id', id)
        .maybeSingle();

      if (rawEmp) {
        empData = { ...rawEmp };
      } else {
        // Step 2: Try finding workspace_member directly by id or user_id
        const { data: member } = await supabase
          .from('workspace_members')
          .select('id, user_id, role, workspace_id')
          .or(`id.eq.${id},user_id.eq.${id}`)
          .maybeSingle();

        if (member) {
          const { data: empByMember } = await supabase
            .from('employee_profiles')
            .select('*')
            .eq('workspace_member_id', member.id)
            .maybeSingle();

          if (empByMember) {
            empData = { ...empByMember };
          } else {
            // Auto-fallback profile for active workspace member
            empData = {
              workspace_member_id: member.id,
              workspace_id: member.workspace_id || activeWorkspace?.id,
              status: 'ACTIVE',
              joining_date: new Date().toISOString().slice(0, 10),
              employment_type: 'FULL_TIME',
            };
          }
          empData.workspace_members = member;
        }
      }

      if (!empData) {
        setEmployee(null);
        setLoading(false);
        return;
      }

      // Step 3: Ensure workspace_members is populated
      if (!empData.workspace_members && empData.workspace_member_id) {
        const { data: member } = await supabase
          .from('workspace_members')
          .select('id, user_id, role, workspace_id')
          .eq('id', empData.workspace_member_id)
          .maybeSingle();
        empData.workspace_members = member || null;
      }

      // Step 4: Enrich workspace_members with profiles (full_name, email, avatar_url)
      if (empData?.workspace_members?.user_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .eq('user_id', empData.workspace_members.user_id)
          .maybeSingle();
        if (prof) {
          empData.workspace_members.profiles = prof;
        }
      }

      setEmployee(empData);

      // Step 5: Fetch reference data for departments, designations, managers
      const targetWsId = empData.workspace_id || activeWorkspace?.id;
      if (targetWsId) {
        const [deptRes, desigRes, rawMgrRes] = await Promise.all([
          supabase.from('departments').select('id, name').eq('workspace_id', targetWsId).order('name'),
          supabase.from('designations').select('id, title').eq('workspace_id', targetWsId).order('title'),
          supabase.from('employee_profiles').select(`workspace_member_id, workspace_id`).eq('workspace_id', targetWsId)
        ]);

        if (deptRes.data) setDepartments(deptRes.data);
        if (desigRes.data) setDesignations(desigRes.data);

        if (rawMgrRes.data && rawMgrRes.data.length > 0) {
          const mgrMemberIds = rawMgrRes.data.map((m: any) => m.workspace_member_id).filter(Boolean);
          const { data: mgrMembers } = await supabase
            .from('workspace_members')
            .select('id, user_id')
            .in('id', mgrMemberIds);
          
          const mgrUserIds = (mgrMembers || []).map((m: any) => m.user_id).filter(Boolean);
          const { data: mgrProfilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', mgrUserIds);
          
          const mgrProfileMap = Object.fromEntries((mgrProfilesData || []).map((p: any) => [p.user_id, p]));
          const memberMap = Object.fromEntries((mgrMembers || []).map((m: any) => [m.id, m]));

          setManagers(rawMgrRes.data.map((m: any) => {
            const wm = memberMap[m.workspace_member_id];
            return {
              workspace_member_id: m.workspace_member_id,
              workspace_members: wm ? { ...wm, profiles: mgrProfileMap[wm.user_id] || null } : null
            };
          }));
        }
      }
    } catch (err: any) {
      console.error('Error fetching employee profile:', err);
      toast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
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
  const fullName = profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Employee Profile';

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
            <h1 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-3">
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
          <TabsTrigger value="compensation" className="py-2">Compensation</TabsTrigger>
          <TabsTrigger value="attendance" className="py-2">Attendance</TabsTrigger>
          <TabsTrigger value="letters" className="py-2">Letters</TabsTrigger>
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
          <TabsContent value="compensation" className="m-0 focus-visible:outline-none">
            {employee.workspace_member_id ? (
              <EmployeeCompensationTab
                workspaceMemberId={employee.workspace_member_id}
                canEdit={canManagePeople}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Onboard this member as an employee before setting compensation.
              </p>
            )}
          </TabsContent>
          <TabsContent value="attendance" className="m-0 focus-visible:outline-none">
            {employee.workspace_member_id ? (
              <EmployeeAttendanceTab
                workspaceMemberId={employee.workspace_member_id}
                canEdit={canManagePeople}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Onboard this member as an employee before setting attendance rules.
              </p>
            )}
          </TabsContent>
          <TabsContent value="letters" className="m-0 focus-visible:outline-none">
            {employee.workspace_member_id ? (
              <EmployeeLettersTab
                workspaceMemberId={employee.workspace_member_id}
                canEdit={canManagePeople}
                context={{
                  employee_name: fullName,
                  employee_code: employee.employee_code ?? null,
                  designation:
                    designations.find((d: any) => d.id === employee.designation_id)?.title ?? null,
                  department:
                    departments.find((d: any) => d.id === employee.department_id)?.name ?? null,
                  joining_date: employee.joining_date ?? null,
                  email: profile?.email ?? null,
                  salary: employee.ctc_annual ? String(employee.ctc_annual) : null,
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Onboard this member as an employee before issuing letters.
              </p>
            )}
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
