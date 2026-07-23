'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, UserSquare, Loader2, Mail } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { useWorkspace } from '@/hooks/use-workspace';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { OnboardEmployeeForm } from '@/components/employees/onboard-employee-form';
import { UserPlus } from 'lucide-react';

export default function EmployeesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOnboard, setShowOnboard] = useState(false);

  const fetchEmployees = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    // Fetch employee profiles and inner join with workspace_members & profiles for names
    // Note: Depends on standard FK setup in Supabase between workspace_members -> profiles
    const { data, error } = await supabase
      .from('employee_profiles')
      .select(`
        *,
        departments ( name ),
        designations ( name ),
        workspace_members!inner (
          role,
          profiles:user_id ( full_name, email, avatar_url )
        )
      `)
      .eq('workspace_id', activeWorkspace.id);

    if (error) {
      toast.error('Failed to load employees');
    } else {
      let emps = data || [];
      if (search.trim()) {
        const query = search.toLowerCase();
        emps = emps.filter(e => {
          const profile = Array.isArray(e.workspace_members?.profiles) 
            ? e.workspace_members?.profiles[0] 
            : e.workspace_members?.profiles;
          
          return (
            e.employee_code?.toLowerCase().includes(query) ||
            profile?.full_name?.toLowerCase().includes(query) ||
            profile?.email?.toLowerCase().includes(query)
          );
        });
      }
      setEmployees(emps);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, search]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const viewEmployeeDetails = (employeeId: string) => {
    router.push(`/employees/${employeeId}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Employee Directory" 
        description="View and manage all employees across the organization."
        action={
          <Button onClick={() => setShowOnboard(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <UserPlus className="size-4 mr-2" />
            Onboard Employee
          </Button>
        }
      />
      
      <OnboardEmployeeForm 
        open={showOnboard} 
        onOpenChange={setShowOnboard} 
        onSaved={fetchEmployees} 
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID..."
            className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Employee</TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">ID</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Department</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">Designation</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading employees...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <UserSquare className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No employees match your search.' : 'No employees found.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const profile = Array.isArray(emp.workspace_members?.profiles) 
                  ? emp.workspace_members?.profiles[0] 
                  : emp.workspace_members?.profiles;

                const fullName = profile?.full_name || 'Unknown User';
                const email = profile?.email || '';
                
                return (
                  <TableRow 
                    key={emp.workspace_member_id} 
                    className="border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => viewEmployeeDetails(emp.workspace_member_id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 border border-border">
                          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {fullName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">
                            {fullName}
                          </span>
                          <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="size-3" />
                            {email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs hidden sm:table-cell">
                      {emp.employee_code || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                      {emp.departments?.name || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">
                      {emp.designations?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={emp.status || 'ACTIVE'} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              viewEmployeeDetails(emp.workspace_member_id);
                            }}
                            className="text-popover-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                          >
                            <UserSquare className="size-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
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
    </div>
  );
}
