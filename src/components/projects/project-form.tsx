'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: any | null;
  onSaved: () => void;
}

export function ProjectForm({ open, onOpenChange, project, onSaved }: ProjectFormProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState('SCRUM');
  const [status, setStatus] = useState('active');
  const [managerId, setManagerId] = useState('none');
  const [clientId, setClientId] = useState('none');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (open && activeWorkspace?.id) {
      // Fetch references
      // Two-step fetch: workspace_members.user_id refs auth.users (not public.profiles),
      // so PostgREST cannot join directly. We fetch members + profiles separately and merge.
      supabase.from('workspace_members').select('id, user_id').eq('workspace_id', activeWorkspace.id).then(async ({ data: members }) => {
        if (!members || members.length === 0) { setManagers([]); return; }
        const userIds = members.map((m: any) => m.user_id);
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
        setManagers(members.map((m: any) => ({ ...m, profiles: profileMap[m.user_id] || null })));
      });
      supabase.from('contacts').select('id, name, company').eq('workspace_id', activeWorkspace.id).then(({ data }) => setClients(data || []));

      if (project) {
        setName(project.name || '');
        setProjectType(project.project_type || 'SCRUM');
        setStatus(project.status || 'active');
        setManagerId(project.manager_workspace_member_id || 'none');
        setClientId(project.client_id || 'none');
        setBudget(project.budget || '');
        setDeadline(project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '');
        setHourlyRate(project.hourly_rate ? project.hourly_rate.toString() : '');
        setIsPublic(project.is_public || false);
      } else {
        setName('');
        setProjectType('SCRUM');
        setStatus('active');
        setManagerId('none');
        setClientId('none');
        setBudget('');
        setDeadline('');
        setHourlyRate('');
        setIsPublic(false);
      }
    }
  }, [open, project, activeWorkspace?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim()) return;

    setSaving(true);
    
    try {
      const payload = {
        name: name.trim(),
        project_type: projectType,
        status,
        manager_workspace_member_id: managerId === 'none' ? null : managerId,
        client_id: clientId === 'none' ? null : clientId,
        budget: budget ? parseFloat(budget) : null,
        deadline: deadline || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        is_public: isPublic,
        project_source: project ? project.project_source : 'MANUAL' // Preserve source on edit
      };

      if (project?.id) {
        const { error } = await supabase.from('projects').update(payload).eq('id', project.id);
        if (error) throw error;
        toast.success('Project updated successfully');
      } else {
        const { data: newProj, error } = await supabase
          .from('projects')
          .insert({ ...payload, workspace_id: activeWorkspace.id })
          .select('id')
          .single();
          
        if (error) throw error;

        // Seed default workflow statuses for the new project
        if (newProj?.id) {
          await supabase.from('project_statuses').insert([
            { project_id: newProj.id, name: 'To Do', category: 'TODO', color: 'slate', sort_order: 1 },
            { project_id: newProj.id, name: 'In Progress', category: 'IN_PROGRESS', color: 'blue', sort_order: 2 },
            { project_id: newProj.id, name: 'Review', category: 'IN_PROGRESS', color: 'orange', sort_order: 3 },
            { project_id: newProj.id, name: 'Done', category: 'DONE', color: 'emerald', sort_order: 4 },
          ]);
        }

        toast.success('Project created successfully');
      }
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {project ? 'Edit Project' : 'Create Project'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Project Name <span className="text-red-500">*</span></Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Website Redesign Q3" 
              className="bg-card border-border text-foreground"
              required 
            />
          </div>

          <div className="space-y-2">
            <Label>Methodology / Project Type</Label>
            <Select value={projectType} onValueChange={(val) => setProjectType(val || 'SCRUM')}>
              <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SCRUM">Scrum (Sprints & Planning Tab)</SelectItem>
                <SelectItem value="KANBAN">Kanban</SelectItem>
                <SelectItem value="BASIC">Basic / Waterfall</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val || '')}>
                <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input 
                type="date"
                value={deadline} 
                onChange={(e) => setDeadline(e.target.value)} 
                className="bg-card border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Project Manager</Label>
            <Select value={managerId} onValueChange={(val) => setManagerId(val || '')}>
              <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Unassigned --</SelectItem>
                {managers.map(m => {
                  const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                  return <SelectItem key={m.id} value={m.id}>{profile?.full_name || 'Unknown'}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Associated Client</Label>
            <Select value={clientId} onValueChange={(val) => setClientId(val || '')}>
              <SelectTrigger className="bg-card border-border"><SelectValue placeholder="No Client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Internal / No Client --</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Budget Amount</Label>
              <Input 
                type="number"
                min="0"
                step="0.01"
                value={budget} 
                onChange={(e) => setBudget(e.target.value)} 
                placeholder="0.00" 
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Rate ($)</Label>
              <Input 
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate} 
                onChange={(e) => setHourlyRate(e.target.value)} 
                placeholder="0.00" 
                className="bg-card border-border text-foreground"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label className="text-base">Public Portal</Label>
              <p className="text-xs text-muted-foreground">Enable read-only link for clients</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <DialogFooter className="pt-4 border-t border-border mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="border-border hover:bg-muted">Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving && <Loader2 className="size-4 animate-spin mr-2" />} {project ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
