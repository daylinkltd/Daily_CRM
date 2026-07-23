'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Loader2, Link as LinkIcon, Copy } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

interface WorkflowSettingsProps {
  projectId: string;
}

export function WorkflowSettings({ projectId }: WorkflowSettingsProps) {
  const supabase = createClient();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New status form state
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusCategory, setNewStatusCategory] = useState('TODO');
  const [newStatusColor, setNewStatusColor] = useState('slate');
  const [isAdding, setIsAdding] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<string>('0');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Portal state
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [portalSettings, setPortalSettings] = useState({ show_timeline: true, show_board: false });
  const [isSavingPortal, setIsSavingPortal] = useState(false);

  const fetchStatuses = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('project_statuses')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
      
      if (error) {
      toast.error('Failed to load workflow statuses');
    } else {
      setStatuses(data || []);
    }
    
    // Fetch project settings
    const { data: projectData } = await supabase
      .from('projects')
      .select('hourly_rate, is_public, public_share_token, portal_settings')
      .eq('id', projectId)
      .single();
      
    if (projectData) {
      if (projectData.hourly_rate) setHourlyRate(projectData.hourly_rate.toString());
      setIsPublic(projectData.is_public || false);
      setShareToken(projectData.public_share_token || '');
      if (projectData.portal_settings) setPortalSettings(projectData.portal_settings);
    }

    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;

    setIsAdding(true);
    try {
      const { error } = await supabase.from('project_statuses').insert({
        project_id: projectId,
        name: newStatusName.trim(),
        category: newStatusCategory,
        color: newStatusColor,
        sort_order: statuses.length + 1
      });

      if (error) throw error;
      toast.success('Status added successfully');
      setNewStatusName('');
      fetchStatuses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add status');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    try {
      // Basic safeguard: don't delete if it's the only status
      if (statuses.length <= 1) {
        toast.error('Projects must have at least one status');
        return;
      }
      
      const { error } = await supabase.from('project_statuses').delete().eq('id', statusId);
      if (error) throw error;
      toast.success('Status deleted');
      fetchStatuses();
    } catch (err: any) {
      toast.error('Failed to delete status. It might be in use.');
    }
  };

  const handleSaveRate = async () => {
    setIsSavingRate(true);
    try {
      const rateNum = parseFloat(hourlyRate);
      if (isNaN(rateNum) || rateNum < 0) {
        toast.error('Please enter a valid hourly rate');
        return;
      }
      
      const { error } = await supabase
        .from('projects')
        .update({ hourly_rate: rateNum })
        .eq('id', projectId);
        
      if (error) throw error;
      toast.success('Hourly rate saved');
    } catch (err) {
      toast.error('Failed to save hourly rate');
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleSavePortal = async (updates: any) => {
    setIsSavingPortal(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);
        
      if (error) throw error;
      toast.success('Portal settings updated');
    } catch (err) {
      toast.error('Failed to update portal settings');
    } finally {
      setIsSavingPortal(false);
    }
  };

  const togglePublic = (checked: boolean) => {
    setIsPublic(checked);
    handleSavePortal({ is_public: checked });
  };

  const togglePortalSetting = (key: string, checked: boolean) => {
    const newSettings = { ...portalSettings, [key]: checked };
    setPortalSettings(newSettings);
    handleSavePortal({ portal_settings: newSettings });
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'TODO': return 'text-slate-500 bg-slate-500/10 border-slate-200';
      case 'IN_PROGRESS': return 'text-blue-500 bg-blue-500/10 border-blue-200';
      case 'DONE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-200';
      default: return 'text-slate-500 bg-slate-500/10';
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/${shareToken}` : '';

  return (
    <div className="space-y-6">
      {/* Client Portal Settings */}
      <Card className="border-border shadow-sm border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LinkIcon className="size-5 text-primary" /> Client Portal
          </CardTitle>
          <CardDescription>Share a read-only view of the project with external clients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Enable Public Sharing</p>
              <p className="text-xs text-muted-foreground">Anyone with the link can view the project status</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={togglePublic} disabled={isSavingPortal} />
          </div>

          {isPublic && (
            <div className="space-y-4 pt-4 border-t border-primary/10">
              <div className="space-y-2">
                <Label>Public Link</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={shareUrl} className="bg-background font-mono text-xs" />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Visible Modules</Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="show_timeline" 
                    checked={portalSettings.show_timeline} 
                    onCheckedChange={(c) => togglePortalSetting('show_timeline', !!c)} 
                    disabled={isSavingPortal}
                  />
                  <Label htmlFor="show_timeline" className="font-normal">Timeline (Roadmap)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="show_board" 
                    checked={portalSettings.show_board} 
                    onCheckedChange={(c) => togglePortalSetting('show_board', !!c)} 
                    disabled={isSavingPortal}
                  />
                  <Label htmlFor="show_board" className="font-normal">Kanban Board</Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finance Settings */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Financial Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 max-w-sm">
            <div className="space-y-2 flex-1">
              <Label>Project Hourly Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <Input 
                  type="number"
                  min="0"
                  step="0.01"
                  value={hourlyRate} 
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="pl-7 bg-card"
                />
              </div>
            </div>
            <Button onClick={handleSaveRate} disabled={isSavingRate}>
              {isSavingRate ? <Loader2 className="size-4 animate-spin" /> : 'Save Rate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Workflow Statuses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            {statuses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No statuses configured.</p>
            ) : (
              statuses.map((status, index) => (
                <div key={status.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <GripVertical className="size-4 text-muted-foreground cursor-grab" />
                    <span className="font-medium text-sm">{status.name}</span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${getCategoryColor(status.category)}`}>
                      {status.category.replace('_', ' ')}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteStatus(status.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-3">Add New Status</h4>
            <form onSubmit={handleAddStatus} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Name</Label>
                <Input 
                  value={newStatusName} 
                  onChange={e => setNewStatusName(e.target.value)} 
                  placeholder="e.g. QA Review" 
                  className="bg-card"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={newStatusCategory} onValueChange={(val) => val && setNewStatusCategory(val)}>
                  <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isAdding || !newStatusName.trim()} className="w-full">
                {isAdding ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4 mr-2" /> Add</>}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
