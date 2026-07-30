'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ShiftsPage() {
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('people_manage');

  const [shifts, setShifts] = useState<any[]>([]);
  const [, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('18:30');
  const [gracePeriod, setGracePeriod] = useState('15');

  const fetchShifts = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/hr/shifts?workspaceId=${activeWorkspace.id}`);
      const json = await res.json();
      setShifts(json.shifts || []);
      setAssignments(json.assignments || []);
    } catch {
      toast.error('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startTime || !endTime) return;
    if (!activeWorkspace?.id) return;

    setSaving(true);
    try {
      const res = await fetch('/api/hr/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name,
          code,
          startTime,
          endTime,
          gracePeriod
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Shift created successfully');
      setName('');
      setCode('');
      setModalOpen(false);
      fetchShifts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create shift');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts & Work Schedules"
        description="Configure work shifts, start/end hours and grace periods."
        action={
          canManage && (
            <Button onClick={() => setModalOpen(true)} className="bg-primary text-primary-foreground">
              <Plus className="size-4 mr-2" /> Add Shift
            </Button>
          )
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : shifts.length === 0 ? (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="size-12 text-muted-foreground opacity-20 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Shifts Defined</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Define work shift schedules (e.g. General Shift, Night Shift) for attendance tracking.
            </p>
            {canManage && (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4 mr-2" /> Create First Shift
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shifts.map(s => (
            <Card key={s.id} className="border-border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs uppercase font-mono bg-primary/10 text-primary border-primary/20">
                    {s.code}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Grace: {s.grace_period_minutes}m</span>
                </div>
                <CardTitle className="text-base font-semibold mt-2">{s.name}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-1.5 mt-1 font-mono text-foreground">
                  <Clock className="size-3.5 text-emerald-500" />
                  <span>{s.start_time} – {s.end_time}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground border-t border-border/50 flex items-center justify-between mt-3 pt-3">
                <span>{s.is_rotational ? '🔄 Rotational' : '📌 Fixed Shift'}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Shift Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Work Shift</DialogTitle>
            <DialogDescription>Define shift start/end times and late grace period.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateShift} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input placeholder="e.g. Morning Shift A" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shift Code</Label>
                <Input placeholder="MS-A" value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Grace Period (Mins)</Label>
                <Input type="number" value={gracePeriod} onChange={e => setGracePeriod(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Create Shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
