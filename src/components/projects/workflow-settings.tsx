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
import { Badge } from '@/components/ui/badge';
import { IconAction } from "@/components/ui/icon-action";

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
  const [newStatusColor] = useState('slate');
  const [isAdding, setIsAdding] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<string>('0');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Portal state
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [portalSettings, setPortalSettings] = useState({ show_timeline: true, show_board: false });
  const [isSavingPortal, setIsSavingPortal] = useState(false);

  // Visualizer state
  const [showTransitionLabels, setShowTransitionLabels] = useState(true);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

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
    } else if (!data || data.length === 0) {
      // Auto-seed default workflow statuses if project has none
      const defaults = [
        { project_id: projectId, name: 'To Do', category: 'TODO', color: 'slate', sort_order: 1 },
        { project_id: projectId, name: 'In Progress', category: 'IN_PROGRESS', color: 'blue', sort_order: 2 },
        { project_id: projectId, name: 'Review', category: 'IN_PROGRESS', color: 'orange', sort_order: 3 },
        { project_id: projectId, name: 'Done', category: 'DONE', color: 'emerald', sort_order: 4 },
      ];
      const { data: seeded } = await supabase.from('project_statuses').insert(defaults).select('*');
      setStatuses(seeded || []);
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
    } catch {
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
    } catch {
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
    } catch {
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
      case 'TODO': return 'text-muted-foreground bg-muted/10 border-border';
      case 'IN_PROGRESS': return 'text-blue-500 bg-blue-500/10 border-blue-200';
      case 'DONE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-200';
      default: return 'text-muted-foreground bg-muted/10';
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
                  <IconAction
                    label="Copy"
                    icon={<Copy className="size-4" />}
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success('Copied to clipboard');
                    }}
                  />
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

      {/* Jira Interactive Workflow Visualizer */}
      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Interactive Workflow Diagram
              </CardTitle>
              <CardDescription>Visual map of status transitions and available state flows</CardDescription>
            </div>
            {statuses.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground mr-2 font-medium">Current status:</span>
                  <Badge variant="outline" className="uppercase font-semibold text-primary bg-primary/10 border-primary/20">
                    {(statuses.find(s => s.id === (selectedStatusId || statuses[0]?.id)) || statuses[0])?.name}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-medium">Can be moved to:</span>
                  <div className="flex items-center gap-1">
                    {statuses
                      .filter(s => s.id !== (selectedStatusId || statuses[0]?.id))
                      .map(s => (
                        <Badge key={s.id} variant="outline" className={`uppercase text-[10px] ${getCategoryColor(s.category)}`}>
                          {s.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="show_transition_labels" 
                checked={showTransitionLabels} 
                onCheckedChange={(c) => setShowTransitionLabels(!!c)} 
              />
              <Label htmlFor="show_transition_labels" className="text-xs font-medium cursor-pointer">
                Show transition labels
              </Label>
            </div>
          </div>

          {/* Workflow Diagram Canvas */}
          <div className="relative border border-border/80 rounded-xl bg-muted/50/50 dark:bg-background/50 p-8 min-h-[220px] flex items-center justify-center overflow-x-auto">
            <div 
              className="flex items-center gap-6 transition-all duration-200"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
            >
              {/* START Node */}
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-card text-foreground font-bold text-[10px] tracking-wider flex items-center justify-center shadow-md">
                  START
                </div>
                <div className="w-8 h-0.5 bg-muted-foreground/40 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-l-6 border-l-muted-foreground/40" />
                </div>
              </div>

              {/* Status Nodes */}
              {statuses.map((status, index) => {
                const isSelected = (selectedStatusId || statuses[0]?.id) === status.id;
                const isLast = index === statuses.length - 1;

                return (
                  <div key={status.id} className="flex items-center gap-6">
                    <div 
                      onClick={() => setSelectedStatusId(status.id)}
                      className={`relative cursor-pointer px-5 py-2.5 rounded-lg border-2 font-bold text-xs uppercase tracking-wider transition-all duration-150 shadow-sm flex items-center gap-2 ${
                        isSelected 
                          ? 'ring-2 ring-primary ring-offset-2 scale-105 shadow-md bg-background' 
                          : 'bg-background hover:border-primary/50'
                      } ${getCategoryColor(status.category)}`}
                    >
                      {status.name}

                      {/* Transition Label 'Any' */}
                      {showTransitionLabels && (
                        <div className="absolute -top-3 -right-2 bg-muted text-foreground text-[9px] font-medium px-1.5 py-0.5 rounded-full shadow">
                          Any
                        </div>
                      )}
                    </div>

                    {!isLast && (
                      <div className="w-8 h-0.5 bg-muted-foreground/40 relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-l-6 border-l-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Zoom Controls Bar */}
            <div className="absolute bottom-3 right-4 flex items-center gap-2 bg-background/90 backdrop-blur border border-border px-3 py-1.5 rounded-lg shadow-sm">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                className="text-xs font-bold text-muted-foreground hover:text-foreground px-1"
              >
                -
              </button>
              <input 
                type="range" 
                min="70" 
                max="130" 
                value={zoomLevel} 
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-20 accent-primary cursor-pointer h-1.5"
              />
              <button 
                onClick={() => setZoomLevel(prev => Math.min(130, prev + 10))}
                className="text-xs font-bold text-muted-foreground hover:text-foreground px-1"
              >
                +
              </button>
            </div>
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
              statuses.map((status) => (
                <div key={status.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <GripVertical className="size-4 text-muted-foreground cursor-grab" />
                    <span className="font-medium text-sm">{status.name}</span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${getCategoryColor(status.category)}`}>
                      {status.category.replace('_', ' ')}
                    </span>
                  </div>
                  <IconAction
                    label="Delete"
                    icon={<Trash2 className="size-4" />}
                    variant="ghost"
                    onClick={() => handleDeleteStatus(status.id)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  />
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
