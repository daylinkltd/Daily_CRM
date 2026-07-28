'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Calendar, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, addDays, startOfWeek, addWeeks, startOfMonth, addMonths, differenceInDays, isSameDay, isBefore, isAfter, eachDayOfInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface ProjectTimelineProps {
  projectId: string;
}

type Scale = 'day' | 'week' | 'month';

export function ProjectTimeline({ projectId }: ProjectTimelineProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const [scale, setScale] = useState<Scale>('week');
  const [tasks, setTasks] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({});

  // Create Epic State
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [newEpicName, setNewEpicName] = useState('');
  const [isCreatingEpic, setIsCreatingEpic] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      // Fetch all tasks for this project
      const { data: rawTasks } = await supabase
        .from('tasks')
        .select('id, title, start_date, due_date, epic_id, status_id, status, priority, created_at')
        .eq('project_id', projectId);

      // Fetch epics
      const { data: epicsData } = await supabase
        .from('epics')
        .select('*')
        .eq('project_id', projectId);

      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeekStr = addDays(new Date(), 7).toISOString().split('T')[0];

      // Assign fallback dates for unscheduled tasks so they appear on the timeline bar
      const tasksData = (rawTasks || []).map(t => {
        const startDate = t.start_date || t.created_at?.split('T')[0] || todayStr;
        const dueDate = t.due_date || addDays(new Date(startDate), 7).toISOString().split('T')[0] || nextWeekStr;
        return {
          ...t,
          start_date: startDate,
          due_date: dueDate
        };
      });

      setTasks(tasksData);
      
      const epicsArr = (epicsData || []).map(e => ({
        ...e,
        title: e.title || e.name || 'Untitled Epic'
      }));
      setEpics(epicsArr);

      // Expand all by default
      const initialExpanded: Record<string, boolean> = {};
      epicsArr.forEach(e => initialExpanded[e.id] = true);
      initialExpanded['no-epic'] = true;
      setExpandedEpics(initialExpanded);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleEpic = (id: string) => {
    setExpandedEpics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateEpic = async () => {
    if (!newEpicName.trim()) return;
    setIsCreatingEpic(true);
    try {
      const { error } = await supabase.from('epics').insert({
        project_id: projectId,
        title: newEpicName.trim(),
        name: newEpicName.trim()
      });
      if (error) throw error;
      toast.success('Epic created successfully');
      setNewEpicName('');
      setEpicModalOpen(false);
      fetchData(); // Refresh timeline
    } catch (err: any) {
      toast.error(err.message || 'Failed to create Epic');
    } finally {
      setIsCreatingEpic(false);
    }
  };

  // Calculate timeline bounds
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return { minDate: today, maxDate: addMonths(today, 1), totalDays: 30 };
    }

    let min = new Date(tasks[0].start_date);
    let max = new Date(tasks[0].due_date);

    tasks.forEach(t => {
      const s = new Date(t.start_date);
      const d = new Date(t.due_date);
      if (s < min) min = s;
      if (d > max) max = d;
    });

    // Add padding
    min = addDays(min, -7);
    max = addDays(max, 14);

    return { minDate: min, maxDate: max, totalDays: differenceInDays(max, min) + 1 };
  }, [tasks]);

  // Generate Columns based on scale
  const columns = useMemo(() => {
    const cols = [];
    let current = minDate;
    
    if (scale === 'day') {
      while (current <= maxDate) {
        cols.push({ date: current, label: format(current, 'd'), subLabel: format(current, 'EEE') });
        current = addDays(current, 1);
      }
    } else if (scale === 'week') {
      let currWeek = startOfWeek(minDate, { weekStartsOn: 1 });
      while (currWeek <= maxDate) {
        cols.push({ date: currWeek, label: `Week of ${format(currWeek, 'MMM d')}`, subLabel: '' });
        currWeek = addWeeks(currWeek, 1);
      }
    } else if (scale === 'month') {
      let currMonth = startOfMonth(minDate);
      while (currMonth <= maxDate) {
        cols.push({ date: currMonth, label: format(currMonth, 'MMMM yyyy'), subLabel: '' });
        currMonth = addMonths(currMonth, 1);
      }
    }
    return cols;
  }, [minDate, maxDate, scale]);

  const getTaskStyle = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    let leftPercent = 0;
    let widthPercent = 100;

    if (scale === 'day') {
      leftPercent = (differenceInDays(start, minDate) / totalDays) * 100;
      widthPercent = ((differenceInDays(end, start) + 1) / totalDays) * 100;
    } else if (scale === 'week') {
      const totalWeeks = columns.length;
      const startOffset = differenceInDays(start, minDate) / 7;
      const duration = differenceInDays(end, start) / 7;
      leftPercent = (startOffset / totalWeeks) * 100;
      widthPercent = (duration / totalWeeks) * 100;
    } else {
      // Month
      const totalMonths = columns.length;
      const startOffset = differenceInDays(start, minDate) / 30.44;
      const duration = differenceInDays(end, start) / 30.44;
      leftPercent = (startOffset / totalMonths) * 100;
      widthPercent = (duration / totalMonths) * 100;
    }

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(2, widthPercent)}%`
    };
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  // Group tasks by Epic
  const groupedTasks: Array<{ id: string; name: string; tasks: any[] }> = epics.map(epic => ({
    ...epic,
    name: epic.title || epic.name || 'Untitled Epic',
    tasks: tasks.filter(t => t.epic_id === epic.id).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  }));

  const orphanedTasks = tasks.filter(t => !t.epic_id).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  if (orphanedTasks.length > 0) {
    groupedTasks.push({ id: 'no-epic', name: 'Other Tasks (No Epic)', tasks: orphanedTasks });
  }

  return (
    <Card className="border-border shadow-sm flex flex-col h-[600px]">
      <div className="p-4 border-b flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <h3 className="font-semibold">Project Roadmap</h3>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setEpicModalOpen(true)}>
            <Plus className="size-4 mr-2" /> Epic
          </Button>
          <Select value={scale} onValueChange={(val) => val && setScale(val as Scale)}>
            <SelectTrigger className="w-[120px] bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative flex">
        {/* Left Sidebar (Names) */}
        <div className="w-[250px] border-r flex-shrink-0 bg-card sticky left-0 z-20">
          <div className="h-[60px] border-b bg-muted/50 flex items-center px-4 font-medium text-sm">
            Task Name
          </div>
          <div className="py-2">
            {tasks.length === 0 && epics.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center space-y-2">
                <p className="font-medium">No tasks or epics yet.</p>
                <p className="text-xs">Create tasks in the <strong>Board</strong> or <strong>List</strong> tab, or create an Epic using the button above.</p>
              </div>
            ) : (
              groupedTasks.map(group => (
                <div key={group.id} className="mb-2">
                  <div 
                    className="flex items-center px-2 py-1.5 hover:bg-muted cursor-pointer font-medium text-sm group"
                    onClick={() => toggleEpic(group.id)}
                  >
                    {expandedEpics[group.id] ? <ChevronDown className="size-4 mr-1 text-muted-foreground group-hover:text-foreground" /> : <ChevronRight className="size-4 mr-1 text-muted-foreground group-hover:text-foreground" />}
                    <span className="truncate">{group.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal">{group.tasks.length} tasks</span>
                  </div>
                  {expandedEpics[group.id] && (
                    <div>
                      {group.tasks.length === 0 ? (
                        <div className="pl-8 pr-2 py-2 text-xs text-muted-foreground italic">No tasks assigned to this epic</div>
                      ) : (
                        group.tasks.map(t => (
                          <div key={t.id} className="pl-8 pr-2 py-2 text-sm text-muted-foreground truncate hover:bg-muted/50 hover:text-foreground transition-colors border-l-2 border-transparent hover:border-primary h-10 flex items-center">
                            {t.title}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        
        </div>

        {/* Timeline Grid */}
        <div className="flex-1 overflow-x-auto relative min-w-[800px] bg-background text-foreground">
          {/* Header */}
          <div className="h-[60px] border-b border-border flex bg-muted/50 sticky top-0 z-10">
            {columns.map((col, i) => (
              <div key={i} className="flex-1 border-r border-border min-w-[60px] flex flex-col justify-center items-center px-1">
                <span className="text-xs font-medium truncate w-full text-center text-foreground">{col.label}</span>
                {col.subLabel && <span className="text-[10px] text-muted-foreground">{col.subLabel}</span>}
              </div>
            ))}
          </div>

          {/* Today Marker */}
          <div 
            className="absolute top-[60px] bottom-0 w-0.5 bg-red-500 z-10 opacity-70 pointer-events-none" 
            style={{ 
              left: getTaskStyle(new Date().toISOString(), new Date().toISOString()).left 
            }} 
          />

          {/* Rows */}
          <div className="py-2 relative min-h-[300px]">
            {groupedTasks.map(group => (
              <div key={`grid-${group.id}`} className="mb-2">
                <div className="h-[32px] border-b border-border/20"></div> {/* Epic row spacer */}
                {expandedEpics[group.id] && group.tasks.length === 0 && (
                  <div className="h-9"></div>
                )}
                {expandedEpics[group.id] && group.tasks.map(t => (
                  <div key={`grid-task-${t.id}`} className="h-10 relative group border-b border-border/40 hover:bg-muted/20">
                    <div 
                      className="absolute top-1.5 h-7 bg-primary text-primary-foreground text-xs rounded shadow-sm px-2 flex items-center overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-110 transition-all z-10 font-medium"
                      style={getTaskStyle(t.start_date, t.due_date)}
                      title={`${t.title} (${format(parseISO(t.start_date), 'MMM d')} - ${format(parseISO(t.due_date), 'MMM d')})`}
                    >
                      {t.title}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex pointer-events-none opacity-40">
              {columns.map((_, i) => (
                <div key={`bg-${i}`} className="flex-1 border-r border-border/50 min-w-[60px] h-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={epicModalOpen} onOpenChange={setEpicModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Epic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Epic Name</Label>
              <Input 
                value={newEpicName}
                onChange={(e) => setNewEpicName(e.target.value)}
                placeholder="e.g. User Authentication Q3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEpicModalOpen(false)} disabled={isCreatingEpic}>Cancel</Button>
            <Button onClick={handleCreateEpic} disabled={isCreatingEpic || !newEpicName.trim()}>
              {isCreatingEpic && <Loader2 className="size-4 animate-spin mr-2" />}
              Create Epic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
