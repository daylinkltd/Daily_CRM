'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ProjectVelocityProps {
  projectId: string;
}

export function ProjectVelocity({ projectId }: ProjectVelocityProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchVelocityData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      // 1. Get last 5 completed sprints
      const { data: sprints, error: sprintsError } = await supabase
        .from('sprints')
        .select('id, name')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('end_date', { ascending: false })
        .limit(5);

      if (sprintsError || !sprints || sprints.length === 0) {
        setChartData([]);
        setLoading(false);
        return;
      }

      // Reverse to chronological order (oldest to newest)
      const sortedSprints = sprints.reverse();

      // 2. Fetch tasks for these sprints to calculate completed hours
      const sprintIds = sortedSprints.map(s => s.id);
      
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('sprint_id, estimated_hours, completed_at')
        .in('sprint_id', sprintIds)
        .not('completed_at', 'is', null); // only care about completed tasks

      if (tasksError) throw tasksError;

      // 3. Aggregate data
      const dataPoints = sortedSprints.map(sprint => {
        const sprintTasks = tasks?.filter(t => t.sprint_id === sprint.id) || [];
        const completedHours = sprintTasks.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0);
        
        return {
          name: sprint.name,
          completed: completedHours
        };
      });

      setChartData(dataPoints);

    } catch (error) {
      console.error('Error fetching velocity data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchVelocityData();
  }, [fetchVelocityData]);

  if (loading) {
    return (
      <Card className="h-80 flex items-center justify-center border-border shadow-sm">
        <Loader2 className="size-6 animate-spin text-primary" />
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-10">
            No completed sprints found. Complete a sprint to see velocity trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Velocity Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
                formatter={(value: any) => [`${value ?? 0} Hrs`, 'Completed Work']}
              />
              <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
