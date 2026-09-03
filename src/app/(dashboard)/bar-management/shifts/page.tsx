'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Banknote, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function BartenderShiftsPage() {
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startFloat, setStartFloat] = useState('2000');
  const [actualCash, setActualCash] = useState('');
  const [zReport, setZReport] = useState<any>(null);

  const fetchShift = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bar/shifts');
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data.shift);
        setShiftHistory(data.shifts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShift();
  }, []);

  const handleOpenShift = async () => {
    try {
      const res = await fetch('/api/bar/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN', starting_cash_float: Number(startFloat) }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveShift(data.shift);
        toast.success('Shift opened with cash float!');
        fetchShift();
      } else {
        toast.error(data.error || 'Failed to open shift');
      }
    } catch (err) {
      toast.error('Failed to open shift');
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      const res = await fetch('/api/bar/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLOSE',
          shift_id: activeShift.id,
          ending_cash_actual: Number(actualCash),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setZReport(data.z_report);
        setActiveShift(null);
        toast.success('Shift closed & Z-Report generated!');
        fetchShift();
      } else {
        toast.error(data.error || 'Failed to close shift');
      }
    } catch (err) {
      toast.error('Failed to close shift');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bartender Shifts & Z-Reports</h1>
          <p className="text-sm text-muted-foreground">
            Manage cash float, clock-in/out, and shift closing drawer reconciliation.
          </p>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading shift status...</Card>
      ) : activeShift ? (
        /* Active Shift Card */
        <Card className="bg-card border-border">
          <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-600">
              <Clock className="size-4" />
              Active Shift in Progress
            </CardTitle>
            <span className="text-xs text-muted-foreground">Opened {new Date(activeShift.opened_at).toLocaleTimeString()}</span>
          </CardHeader>

          <CardContent className="p-6 space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-muted/40 border border-border flex justify-between items-center">
              <div>
                <span className="text-muted-foreground">Starting Cash Float:</span>
                <p className="text-lg font-bold text-foreground">₹{activeShift.starting_cash_float}</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label>Actual Cash in Drawer at Shift Close (₹)</Label>
              <Input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Enter total counted cash"
              />
            </div>

            <Button onClick={handleCloseShift} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
              Close Shift & Generate Z-Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Start Shift Card */
        <Card className="bg-card border-border">
          <CardHeader className="py-4 px-6 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Banknote className="size-4 text-primary" />
              Start New Bartender Shift
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label>Opening Cash Float (₹)</Label>
              <Input
                type="number"
                value={startFloat}
                onChange={(e) => setStartFloat(e.target.value)}
                placeholder="2000"
              />
            </div>

            <Button onClick={handleOpenShift} className="w-full bg-primary text-primary-foreground font-bold">
              Open Shift Drawer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Z-Report Summary Modal / View */}
      {zReport && (
        <Card className="border-emerald-500/50 bg-emerald-500/5 p-6 space-y-3 text-xs">
          <h3 className="font-bold text-sm text-emerald-600 flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            Z-Report Shift Summary
          </h3>
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
            <div>
              <span className="text-muted-foreground">Expected Cash</span>
              <p className="font-bold text-sm text-foreground">₹{zReport.expected_cash}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Actual Count</span>
              <p className="font-bold text-sm text-foreground">₹{zReport.actual_cash}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Difference</span>
              <p className={`font-bold text-sm ${zReport.difference < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                ₹{zReport.difference}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Shift History Table */}
      <Card className="bg-card border-border">
        <CardHeader className="py-4 px-6 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Shift History & Past Z-Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {shiftHistory.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No past shifts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3 pl-6">Opened</th>
                    <th className="p-3">Closed</th>
                    <th className="p-3 text-right">Start Float</th>
                    <th className="p-3 text-right">Expected</th>
                    <th className="p-3 text-right">Actual</th>
                    <th className="p-3 text-right">Difference</th>
                    <th className="p-3 pr-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shiftHistory.map((shift) => {
                    const diff = Number(shift.cash_difference ?? 0);
                    return (
                      <tr key={shift.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-6 font-medium">
                          {new Date(shift.opened_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {shift.closed_at
                            ? new Date(shift.closed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                            : 'In Progress'}
                        </td>
                        <td className="p-3 text-right font-mono">₹{shift.starting_cash_float}</td>
                        <td className="p-3 text-right font-mono">
                          {shift.expected_cash !== null && shift.expected_cash !== undefined
                            ? `₹${shift.expected_cash}`
                            : '—'}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {shift.ending_cash_actual !== null && shift.ending_cash_actual !== undefined
                            ? `₹${shift.ending_cash_actual}`
                            : '—'}
                        </td>
                        <td className={`p-3 text-right font-mono font-semibold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {shift.status === 'CLOSED' ? `₹${diff}` : '—'}
                        </td>
                        <td className="p-3 pr-6 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              shift.status === 'OPEN'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            {shift.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
