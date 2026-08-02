'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Plus,
  Eye,
  Share2,
  X,
  CheckSquare,
  Sparkles,
  Bookmark,
  Bug,
  ChevronDown,
  Zap
} from 'lucide-react';
import { formatMemberName } from '@/components/tasks/task-form';
import { IconAction } from "@/components/ui/icon-action";

interface EpicDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epicId: string | null;
  projectId: string;
  onSaved?: () => void;
}

export function EpicDetailsModal({
  open,
  onOpenChange,
  epicId,
  projectId,
  onSaved,
}: EpicDetailsModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [, setEpic] = useState<any | null>(null);
  const [childTasks, setChildTasks] = useState<any[]>([]);
  const [, setMembers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newChildTitle, setNewChildTitle] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchEpicData = useCallback(async () => {
    if (!epicId) return;
    setLoading(true);

    try {
      const [epicRes, tasksRes, statusesRes, membersRes] = await Promise.all([
        supabase.from('epics').select('*').eq('id', epicId).single(),
        supabase
          .from('tasks')
          .select('*, project_statuses(id, name, color, category)')
          .eq('epic_id', epicId)
          .order('created_at', { ascending: true }),
        supabase
          .from('project_statuses')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true }),
        fetch('/api/account/members').then((r) => r.json()).catch(() => ({ members: [] })),
      ]);

      const epicData = epicRes.data;
      setEpic(epicData);
      setName(epicData?.name || '');
      setDescription(epicData?.description || '');
      setStatuses(statusesRes.data || []);

      const memberList = membersRes?.members || [];
      setMembers(memberList);

      const memberMap = new Map(memberList.map((m: any) => [m.id, m]));
      const enrichedTasks = (tasksRes.data || []).map((t: any) => ({
        ...t,
        assignee_member: t.assigned_workspace_member_id
          ? memberMap.get(t.assigned_workspace_member_id)
          : null,
      }));

      setChildTasks(enrichedTasks);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load epic details');
    } finally {
      setLoading(false);
    }
  }, [epicId, projectId, supabase]);

  useEffect(() => {
    if (open && epicId) {
      fetchEpicData();
    }
  }, [open, epicId, fetchEpicData]);

  // Calculate percentage done
  const completedCount = childTasks.filter(
    (t) => t.status === 'completed' || t.project_statuses?.category === 'DONE'
  ).length;
  const inProgressCount = childTasks.filter(
    (t) => t.status === 'in_progress' || t.project_statuses?.category === 'IN_PROGRESS'
  ).length;
  const percentDone =
    childTasks.length > 0 ? Math.round((completedCount / childTasks.length) * 100) : 0;

  const handleAddChildTask = async () => {
    if (!newChildTitle.trim() || !epicId) return;
    setIsAddingChild(true);

    try {
      const defaultStatus = statuses[0]?.id || null;
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          epic_id: epicId,
          title: newChildTitle.trim(),
          status_id: defaultStatus,
          task_type: 'STORY',
        })
        .select('*, project_statuses(id, name, color, category)')
        .single();

      if (error) throw error;
      setChildTasks((prev) => [...prev, data]);
      setNewChildTitle('');
      toast.success('Child work item added');
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add child item');
    } finally {
      setIsAddingChild(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, statusId: string) => {
    try {
      const selectedStatusObj = statuses.find((s) => s.id === statusId);
      const { error } = await supabase
        .from('tasks')
        .update({
          status_id: statusId,
          status: selectedStatusObj?.category?.toLowerCase() || 'in_progress',
        })
        .eq('id', taskId);

      if (error) throw error;
      setChildTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status_id: statusId, project_statuses: selectedStatusObj }
            : t
        )
      );
      toast.success('Status updated');
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleSaveEpic = async () => {
    if (!epicId || !name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('epics')
        .update({ name: name.trim(), description: description.trim() })
        .eq('id', epicId);

      if (error) throw error;
      toast.success('Epic updated');
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update epic');
    } finally {
      setSaving(false);
    }
  };

  const getIssueIcon = (type?: string) => {
    switch (type?.toUpperCase()) {
      case 'FEATURE':
        return <Sparkles className="size-4 text-emerald-500 shrink-0" />;
      case 'STORY':
        return <Bookmark className="size-4 text-green-600 shrink-0" />;
      case 'BUG':
        return <Bug className="size-4 text-red-500 shrink-0" />;
      default:
        return <CheckSquare className="size-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Jira Top Header Bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Zap className="size-3.5 text-purple-500" />
                <span className="font-semibold text-foreground">EPIC</span>
                <span>/</span>
                <span>EPIC-{epicId?.slice(0, 5).toUpperCase()}</span>
              </div>

              <div className="flex items-center gap-2">
                <IconAction
                  label="View"
                  icon={<Eye className="size-4" />}
                  variant="ghost"
                  className="size-8 text-muted-foreground"
                />
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                  <Share2 className="size-4" />
                </Button>
                <IconAction
                  label="Close"
                  icon={<X className="size-4" />}
                  variant="ghost"
                  className="size-8 text-muted-foreground"
                  onClick={() => onOpenChange(false)}
                />
              </div>
            </div>

            {/* Jira 2-Column Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Left Main Work Content (8 cols) */}
              <div className="lg:col-span-8 p-6 space-y-6">
                {/* Epic Title Header */}
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-none bg-purple-600 flex items-center justify-center text-foreground shrink-0 font-bold text-sm">
                    E
                  </div>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto text-foreground"
                    placeholder="Epic Name"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Description
                  </span>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description..."
                    className="bg-card border-border text-sm min-h-[90px]"
                  />
                </div>

                {/* Child Work Items Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <ChevronDown className="size-4" /> Child work items
                    </span>
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      {percentDone}% Done
                    </span>
                  </div>

                  {/* Jira Multi-Color Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${percentDone}%` }}
                      title={`${completedCount} Completed`}
                    />
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{
                        width: `${childTasks.length > 0 ? (inProgressCount / childTasks.length) * 100 : 0}%`,
                      }}
                      title={`${inProgressCount} In Progress`}
                    />
                  </div>

                  {/* Child Work Table */}
                  <div className="rounded-md border border-border bg-card overflow-hidden">
                    <Table className="text-xs">
                      <TableHeader className="bg-muted/40 uppercase tracking-wider font-semibold text-muted-foreground">
                        <TableRow>
                          <TableHead className="py-2.5 px-3">Work</TableHead>
                          <TableHead className="py-2.5 px-3 w-20">Priority</TableHead>
                          <TableHead className="py-2.5 px-3 w-28">Assignee</TableHead>
                          <TableHead className="py-2.5 px-3 w-32 text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-border/50">
                        {childTasks.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                              No child work items under this epic yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          childTasks.map((ct) => {
                            const assigneeName = formatMemberName(ct.assignee_member);

                            return (
                              <TableRow key={ct.id} className="hover:bg-muted/30">
                                {/* Work Column: Type Icon + Key + Title */}
                                <TableCell className="py-2.5 px-3 font-medium">
                                  <div className="flex items-center gap-2">
                                    {getIssueIcon(ct.task_type)}
                                    <span className="text-primary font-mono text-[11px] hover:underline cursor-pointer">
                                      TASK-{ct.id.slice(0, 4).toUpperCase()}
                                    </span>
                                    <span className="text-foreground truncate max-w-[260px]">
                                      {ct.title}
                                    </span>
                                  </div>
                                </TableCell>

                                {/* Priority */}
                                <TableCell className="py-2.5 px-3 capitalize text-muted-foreground">
                                  {ct.priority || 'Medium'}
                                </TableCell>

                                {/* Assignee */}
                                <TableCell className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="size-5">
                                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                        {assigneeName.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate max-w-[80px] text-muted-foreground">
                                      {assigneeName}
                                    </span>
                                  </div>
                                </TableCell>

                                {/* Status Selector */}
                                <TableCell className="py-2.5 px-3 text-right">
                                  <Select
                                    value={ct.status_id || statuses[0]?.id}
                                    onValueChange={(val) => handleUpdateStatus(ct.id, val)}
                                  >
                                    <SelectTrigger className="h-7 text-[11px] bg-muted border-border font-medium capitalize">
                                      <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statuses.map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="text-xs">
                                          {s.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Inline Quick Add Child Task Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newChildTitle}
                      onChange={(e) => setNewChildTitle(e.target.value)}
                      placeholder="+ Add child story or task..."
                      className="bg-card border-border h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChildTask();
                        }
                      }}
                    />
                    <IconAction label="Add" icon={isAddingChild ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3.5 " />} onClick={handleAddChildTask}
                      disabled={isAddingChild || !newChildTitle.trim()}
                      className="h-8 text-xs bg-primary text-primary-foreground shrink-0" />
                  </div>
                </div>
              </div>

              {/* Right Details Sidebar (4 cols) */}
              <div className="lg:col-span-4 p-6 space-y-6 bg-muted/10">
                <div className="rounded-lg border border-border bg-card p-4 space-y-4 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Details
                  </span>

                  {/* Assignee */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Assignee</span>
                    <span className="font-medium text-foreground">Unassigned</span>
                  </div>

                  {/* Reporter */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Reporter</span>
                    <span className="font-medium text-foreground">Workspace Admin</span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-semibold text-purple-600">Epic</span>
                  </div>

                  {/* Total Child Tasks */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Child Work Items</span>
                    <span className="font-mono text-foreground font-semibold">{childTasks.length}</span>
                  </div>
                </div>

                {/* Footer Save Button */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button size="sm" onClick={handleSaveEpic} disabled={saving}>
                    {saving && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
