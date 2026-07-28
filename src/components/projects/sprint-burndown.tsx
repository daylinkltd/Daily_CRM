'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, differenceInDays, addDays, parseISO, startOfDay, isAfter } from 'date-fns';

interface SprintBurndownProps {
  projectId: string;
}

export function SprintBurndown({ projectId }: SprintBurndownProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [sprintName, setSprintName] = useState<string>('');

  const fetchBurndownData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      // 1. Get Active Sprint
      const { data: sprintData, error: sprintError } = await supabase
        .from('sprints')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .single();

      if (sprintError || !sprintData || !sprintData.start_date || !sprintData.end_date) {
        setChartData([]);
        setLoading(false);
        return;
      }

      setSprintName(sprintData.name);

      // 2. Get tasks for this sprint
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, estimated_hours, completed_at, status_id')
        .eq('sprint_id', sprintData.id);

      if (tasksError) throw tasksError;

      // 3. Process Data for Chart
      const startDate = startOfDay(parseISO(sprintData.start_date));
      const endDate = startOfDay(parseISO(sprintData.end_date));
      const totalDays = differenceInDays(endDate, startDate) + 1;
      
      let totalEstimatedHours = 0;
      tasks?.forEach(t => {
        totalEstimatedHours += Number(t.estimated_hours || 0);
      });

      const dataPoints = [];
      const today = startOfDay(new Date());

      // Calculate daily decrement for ideal line
      const idealDailyBurn = totalDays > 1 ? totalEstimatedHours / (totalDays - 1) : totalEstimatedHours;

      let actualRemaining = totalEstimatedHours;

      for (let i = 0; i < totalDays; i++) {
        const currentDate = addDays(startDate, i);
        const dateStr = format(currentDate, 'MMM dd');

        // Ideal remaining logic
        const idealRemaining = Math.max(0, totalEstimatedHours - (idealDailyBurn * i));

        // Actual remaining logic (only calculate up to today)
        let actualPoint = null;
        if (!isAfter(currentDate, today)) {
          // Find tasks completed ON this specific day
          const tasksCompletedToday = tasks?.filter(t => {
            if (!t.completed_at) return false;
            const completedDate = startOfDay(parseISO(t.completed_at));
            return completedDate.getTime() === currentDate.getTime();
          }) || [];

          const hoursBurnedToday = tasksCompletedToday.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0);
          actualRemaining -= hoursBurnedToday;
          actualPoint = actualRemaining;
        }

        dataPoints.push({
          date: dateStr,
          ideal: parseFloat(idealRemaining.toFixed(1)),
          actual: actualPoint !== null ? parseFloat(actualPoint.toFixed(1)) : null
        });
      }

      setChartData(dataPoints);

    } catch (error) {
      console.error('Error fetching burndown data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchBurndownData();
  }, [fetchBurndownData]);

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
          <CardTitle className="text-lg">Sprint Burndown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-10">
            No active sprint found or sprint has no dates configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Burndown: {sprintName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Line 
                type="monotone" 
                name="Ideal Burndown"
                dataKey="ideal" 
                stroke="#94a3b8" 
                strokeWidth={2}
                strokeDasharray="5 5" 
                dot={false}
              />
              <Line 
                type="monotone" 
                name="Actual Remaining (Hrs)"
                dataKey="actual" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
