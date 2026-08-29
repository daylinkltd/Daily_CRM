'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useRowSelection } from '@/hooks/use-row-selection';
import { affectedCount } from '@/lib/supabase/affected-rows';
import {
  BulkActionBar,
  SelectAllCheckbox,
  SelectRowCheckbox,
} from '@/components/ui/bulk-action-bar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { OnboardEmployeeForm } from '@/components/employees/onboard-employee-form';
import { UserPlus } from 'lucide-react';
import { useMemberDirectory } from '@/hooks/use-member-directory';
import { IconAction } from "@/components/ui/icon-action";

export default function EmployeesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  // Names come from the server directory: a client-side `profiles`
  // query returns only the caller's own row under RLS, which is why
  // every colleague rendered as "Unknown User".
  const { byUserId: directoryByUserId } = useMemberDirectory();

  const [employees, setEmployees] = useState<any[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOnboard, setShowOnboard] = useState(false);

  const fetchEmployees = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      // employee_profiles has TWO foreign keys to workspace_members —
      // workspace_member_id (the employee) and manager_workspace_member_id
      // (their manager) — so the embed MUST name which one. Without the
      // hint PostgREST refuses it with "more than one relationship was
      // found", the whole select fails, and the fallback below drops
      // departments and designations: that is why those columns rendered
      // as "-" for every employee.
      // 1. Try querying employee_profiles with joined relations
      let { data: rawData, error } = await supabase
        .from('employee_profiles')
        .select(`
          *,
          departments ( name ),
          designations ( title ),
          workspace_members!workspace_member_id ( id, user_id, role )
        `)
        .eq('workspace_id', activeWorkspace.id);

      // Fallback query if relational join returned an error
      if (error || !rawData) {
        console.warn('Relational fetch for employee_profiles failed, running fallback:', error?.message);
        const { data: fbData, error: fbErr } = await supabase
          .from('employee_profiles')
          .select('*')
          .eq('workspace_id', activeWorkspace.id);

        if (fbErr) throw fbErr;
        rawData = fbData || [];

        // Manual join for workspace_members
        const memberIds = rawData.map(e => e.workspace_member_id).filter(Boolean);
        if (memberIds.length > 0) {
          const { data: membersData } = await supabase
            .from('workspace_members')
            .select('id, user_id, role')
            .in('id', memberIds);
          const memberMap = Object.fromEntries((membersData || []).map(m => [m.id, m]));
          rawData.forEach(e => {
            e.workspace_members = memberMap[e.workspace_member_id] || null;
          });
        }
      }

      setEmployees(rawData || []);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  /** Employee row + the directory identity that names it. */
  const namedEmployees = useMemo(
    () =>
      employees.map((emp) => {
        const entry = directoryByUserId.get(emp.workspace_members?.user_id);
        return {
          emp,
          fullName: entry?.full_name || 'Workspace Member',
          email: entry?.email || '',
          avatarUrl: entry?.avatar_url || null,
        };
      }),
    [employees, directoryByUserId],
  );

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return namedEmployees;
    const query = search.toLowerCase();
    return namedEmployees.filter(({ emp, fullName, email }) =>
      emp.employee_code?.toLowerCase().includes(query) ||
      fullName.toLowerCase().includes(query) ||
      email.toLowerCase().includes(query),
    );
  }, [namedEmployees, search]);

  const selection = useRowSelection(
    filteredEmployees,
    (row: { emp: { workspace_member_id: string } }) => row.emp.workspace_member_id
  );

  /** Set the status of every selected employee in one statement. */
  const bulkSetStatus = async (status: 'ACTIVE' | 'INACTIVE') => {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await supabase
        .from('employee_profiles')
        .update({ status })
        .in('workspace_member_id', ids)
        .eq('workspace_id', activeWorkspace!.id)
        .select('workspace_member_id');
      const outcome = affectedCount(result, ids.length, 'employees');
      if (outcome.partial) toast.warning(outcome.message);
      else toast.success(outcome.message);
      selection.clear();
      fetchEmployees();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update employees');
    } finally {
      setBulkBusy(false);
    }
  };


  const viewEmployeeDetails = (employeeId: string) => {
    router.push(`/employees/${employeeId}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Employee Directory" 
        description="View and manage all employees across the organization."
        action={
          <IconAction label="Onboard Employee" icon={<UserPlus className="size-4 " />} onClick={() => setShowOnboard(true)} className="bg-primary text-primary-foreground hover:bg-primary/90" />
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
              <TableHead className="w-8">
                <SelectAllCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  label="Select all employees"
                />
              </TableHead>
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
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading employees...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <UserSquare className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No employees match your search.' : 'No employees found.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map(({ emp, fullName, email, avatarUrl }) => {
                return (
                  <TableRow
                    key={emp.workspace_member_id}
                    data-selected={selection.isSelected(emp.workspace_member_id) || undefined}
                    className="border-border hover:bg-muted/50 cursor-pointer data-[selected]:bg-primary/5"
                    onClick={() => viewEmployeeDetails(emp.workspace_member_id)}
                  >
                    {/* The row navigates on click, so the checkbox cell must
                        swallow the event or ticking a box opens the profile. */}
                    <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                      <SelectRowCheckbox
                        checked={selection.isSelected(emp.workspace_member_id)}
                        onToggle={(o) => selection.toggle(emp.workspace_member_id, o)}
                        label={`Select ${fullName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 border border-border">
                          {avatarUrl && <AvatarImage src={avatarUrl} />}
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
                      {emp.designations?.title || '-'}
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

      <BulkActionBar
        count={selection.selectedCount}
        hiddenCount={selection.hiddenSelectedCount}
        onClear={selection.clear}
        busy={bulkBusy}
        noun="employee"
      >
        <Button size="sm" variant="outline" onClick={() => bulkSetStatus('ACTIVE')} disabled={bulkBusy} className="h-7 text-xs">
          Mark active
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkSetStatus('INACTIVE')} disabled={bulkBusy} className="h-7 text-xs">
          Mark inactive
        </Button>
      </BulkActionBar>
    </div>
  );
}
