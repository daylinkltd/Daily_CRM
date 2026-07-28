'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { formatMemberName } from '@/components/tasks/task-form';

interface AutomationsSettingsProps {
  projectId: string;
}

export function AutomationsSettings({ projectId }: AutomationsSettingsProps) {
  const { activeWorkspace: workspace, activeMember } = useWorkspace();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // New Rule State
  const [isCreating, setIsCreating] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [triggerStatusId, setTriggerStatusId] = useState('');
  const [actionType, setActionType] = useState('ASSIGN_MEMBER');
  const [actionMemberId, setActionMemberId] = useState('');
  const [actionPriority, setActionPriority] = useState('high');

  const fetchData = useCallback(async () => {
    if (!projectId || !workspace) return;
    setLoading(true);
    
    try {
      const [autoRes, statusesRes, membersRes] = await Promise.all([
        supabase.from('project_automations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('project_statuses').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
        fetch('/api/account/members').then((r) => r.json()).catch(() => ({ members: [] }))
      ]);
      
      setAutomations(autoRes.data || []);
      setStatuses(statusesRes.data || []);
      setMembers(membersRes?.members || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load automations data');
    } finally {
      setLoading(false);
    }
  }, [projectId, workspace, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRule = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('project_automations').update({ is_active: !currentActive }).eq('id', id);
    if (error) {
      toast.error('Failed to toggle automation');
    } else {
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentActive } : a));
    }
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from('project_automations').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete automation');
    } else {
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast.success('Automation deleted');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !activeMember || !triggerStatusId) {
      toast.error('Please select a trigger status');
      return;
    }

    let payload = {};
    if (actionType === 'ASSIGN_MEMBER') {
      if (!actionMemberId) {
        toast.error('Please select a member to assign');
        return;
      }
      payload = { member_id: actionMemberId };
    } else {
      payload = { priority: actionPriority };
    }

    try {
      const { data, error } = await supabase.from('project_automations').insert({
        project_id: projectId,
        workspace_id: workspace.id,
        name: newRuleName || 'Untitled Rule',
        trigger_type: 'STATUS_CHANGED',
        trigger_condition: { status_id: triggerStatusId },
        action_type: actionType,
        action_payload: payload,
        created_by: activeMember.id
      }).select().single();

      if (error) throw error;
      
      setAutomations([data, ...automations]);
      setIsCreating(false);
      setNewRuleName('');
      setTriggerStatusId('');
      setActionMemberId('');
      toast.success('Automation created successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to create automation');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Automations Engine</h3>
          <p className="text-sm text-muted-foreground">Automate repetitive tasks when events happen.</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? 'Cancel' : <><Plus className="size-4 mr-2" /> New Rule</>}
        </Button>
      </div>

      {isCreating && (
        <div className="p-4 border rounded-md bg-muted/30 space-y-4">
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input 
                value={newRuleName} 
                onChange={(e) => setNewRuleName(e.target.value)} 
                placeholder="e.g., Auto-assign QA Tester" 
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 border border-border/50 rounded bg-card">
                <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">WHEN</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm whitespace-nowrap">Task moves to</span>
                  <Select value={triggerStatusId} onValueChange={(val) => setTriggerStatusId(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                    <SelectContent>
                      {statuses.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 p-3 border border-border/50 rounded bg-card">
                <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">THEN</Label>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">Do</span>
                  <Select value={actionType} onValueChange={(val) => setActionType(val || '')}>
                    <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASSIGN_MEMBER">Assign to Member</SelectItem>
                      <SelectItem value="SET_PRIORITY">Change Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {actionType === 'ASSIGN_MEMBER' && (
                  <Select value={actionMemberId} onValueChange={(val) => setActionMemberId(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Select Team Member" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {formatMemberName(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {actionType === 'SET_PRIORITY' && (
                  <Select value={actionPriority} onValueChange={(val) => setActionPriority(val || '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Button type="submit">Save Automation Rule</Button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {automations.length === 0 && !isCreating && (
          <div className="text-center py-10 border border-dashed rounded-lg">
            <Zap className="size-8 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">No automations configured for this project.</p>
          </div>
        )}

        {automations.map(rule => {
          const targetStatus = statuses.find(s => s.id === rule.trigger_condition?.status_id);
          
          let actionText = '';
          if (rule.action_type === 'ASSIGN_MEMBER') {
            const memberId = rule.action_payload?.member_id;
            if (memberId === 'none') {
               actionText = 'Remove Assignee';
            } else {
               const member = members.find(m => m.id === memberId);
               actionText = `Assign to ${member ? formatMemberName(member) : 'Unassigned'}`;
            }
          } else if (rule.action_type === 'SET_PRIORITY') {
            actionText = `Set Priority to ${rule.action_payload?.priority}`;
          }

          return (
            <div key={rule.id} className="flex items-center justify-between p-4 border rounded-md bg-card shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{rule.name}</h4>
                  {!rule.is_active && <span className="text-[10px] uppercase bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Disabled</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>When Status is <strong className="text-foreground">{targetStatus?.name || 'Unknown'}</strong></span>
                  <span>→</span>
                  <span className="text-primary font-medium">{actionText}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Switch checked={rule.is_active} onCheckedChange={() => toggleRule(rule.id, rule.is_active)} />
                <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
