'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Plus, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function HolidaysPage() {
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('people_manage' as any);

  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [holidayType, setHolidayType] = useState('COMPANY');
  const [recurrenceType, setRecurrenceType] = useState('YEARLY');
  const [description] = useState('');

  const fetchHolidays = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/hr/holidays?workspaceId=${activeWorkspace.id}`);
      const json = await res.json();
      setHolidays(json.holidays || []);
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    if (!activeWorkspace?.id) return;

    setSaving(true);
    try {
      const res = await fetch('/api/hr/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          title,
          date,
          holidayType,
          recurrenceType,
          description
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Holiday added to company calendar');
      setTitle('');
      setDate('');
      setModalOpen(false);
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holidays Calendar"
        description="Official national, company, and optional holidays linked to attendance & leave rules."
        action={
          canManage && (
            <Button onClick={() => setModalOpen(true)} className="bg-primary text-primary-foreground">
              <Plus className="size-4 mr-2" /> Add Holiday
            </Button>
          )
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : holidays.length === 0 ? (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="size-12 text-muted-foreground opacity-20 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Holidays Added</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Add company holidays and national days to automatically exclude them from attendance & leave calculations.
            </p>
            {canManage && (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4 mr-2" /> Add First Holiday
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {holidays.map(h => (
            <Card key={h.id} className="border-border bg-card shadow-sm hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase bg-secondary/50">
                    {h.holiday_type}
                  </Badge>
                  <span className="text-xs font-semibold text-primary">
                    {new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <CardTitle className="text-base font-semibold mt-2">{h.title}</CardTitle>
                <CardDescription className="text-xs line-clamp-1 mt-1">
                  {h.description || 'Official company holiday.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground border-t border-border/50 flex items-center justify-between mt-3 pt-3">
                <span className="flex items-center gap-1">
                  <RefreshCw className="size-3 text-muted-foreground" />
                  {h.recurrence_type === 'YEARLY' ? 'Repeats Every Year' : 'One-time Event'}
                </span>
                <span>Active</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Holiday Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Company Holiday</DialogTitle>
            <DialogDescription>Add a holiday date to the company calendar.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateHoliday} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Holiday Title</Label>
              <Input placeholder="e.g. Independence Day" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Holiday Type</Label>
                <Select value={holidayType} onValueChange={(val) => setHolidayType(val || 'COMPANY')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NATIONAL">National Holiday</SelectItem>
                    <SelectItem value="COMPANY">Company Holiday</SelectItem>
                    <SelectItem value="OPTIONAL">Optional / Floating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recurrence Rule</Label>
              <Select value={recurrenceType} onValueChange={(val) => setRecurrenceType(val || 'YEARLY')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YEARLY">Repeats Yearly (e.g. Fixed National Days)</SelectItem>
                  <SelectItem value="NONE">One-Time Event Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Add Holiday
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
