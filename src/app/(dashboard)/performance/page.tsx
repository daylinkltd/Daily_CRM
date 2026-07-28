'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';

export default function PerformancePage() {
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('people_manage');

  const [cycles, setCycles] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cycleName, setCycleName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchPerformanceData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/hr/performance?workspaceId=${activeWorkspace.id}`);
      const json = await res.json();
      setCycles(json.cycles || []);
      setGoals(json.goals || []);
      setPromotions(json.promotions || []);
    } catch {
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleName.trim() || !startDate || !endDate) return;
    if (!activeWorkspace?.id) return;

    setSaving(true);
    try {
      const res = await fetch('/api/hr/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_CYCLE',
          workspaceId: activeWorkspace.id,
          name: cycleName,
          startDate,
          endDate
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Performance Review Cycle created');
      setCycleName('');
      setCycleModalOpen(false);
      fetchPerformanceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create review cycle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance & Appraisals"
        description="Manage annual/quarterly review cycles, OKRs, employee goals, self-reviews, and promotion history."
        action={
          canManage && (
            <Button onClick={() => setCycleModalOpen(true)} className="bg-primary text-primary-foreground">
              <Plus className="size-4 mr-2" /> Start Review Cycle
            </Button>
          )
        }
      />

      <Tabs defaultValue="cycles" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="cycles">Review Cycles ({cycles.length})</TabsTrigger>
          <TabsTrigger value="goals">Employee OKRs / Goals ({goals.length})</TabsTrigger>
          <TabsTrigger value="promotions">Promotion History ({promotions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cycles">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : cycles.length === 0 ? (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Award className="size-12 text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No Review Cycles Defined</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Start a performance appraisal cycle (e.g. Q1 2027 Review) to collect self-ratings and manager reviews.
                </p>
                {canManage && (
                  <Button onClick={() => setCycleModalOpen(true)}>
                    <Plus className="size-4 mr-2" /> Create Review Cycle
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cycles.map(c => (
                <Card key={c.id} className="border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-600 text-white text-[10px] uppercase">{c.status}</Badge>
                      <span className="text-xs text-muted-foreground">{c.start_date} – {c.end_date}</span>
                    </div>
                    <CardTitle className="text-base font-semibold mt-2">{c.name}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map(g => (
              <Card key={g.id} className="border-border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">{g.title}</CardTitle>
                  <CardDescription className="text-xs">{g.description || 'Employee OKR goal.'}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="promotions">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Promotion History Audit Log</CardTitle>
              <CardDescription>Track designation advancements and salary revisions.</CardDescription>
            </CardHeader>
            <CardContent>
              {promotions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No promotions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {promotions.map(p => (
                    <div key={p.id} className="p-3 border border-border rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{p.oldDesig?.title || 'Previous'} $\rightarrow$ {p.newDesig?.title || 'New Designation'}</span>
                        <span className="text-muted-foreground block text-[11px] mt-0.5">Reason: {p.promotion_reason}</span>
                      </div>
                      <Badge variant="outline">{p.effective_date}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Cycle Modal */}
      <Dialog open={cycleModalOpen} onOpenChange={setCycleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Performance Review Cycle</DialogTitle>
            <DialogDescription>Define an appraisal period for employee self-reviews and manager evaluations.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCycle} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cycle Name</Label>
              <Input placeholder="e.g. Annual Appraisal 2026" value={cycleName} onChange={e => setCycleName(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setCycleModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Start Cycle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
