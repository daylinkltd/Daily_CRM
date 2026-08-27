'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Printer, RefreshCw, Wine, ShieldCheck, Download, Calendar, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function KsbclReportPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bar/reports/ksbcl');
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExportCSV = () => {
    if (!report?.ksbcl_register) return;
    const headers = 'Brand & Description,Opening Balance,Inward Receipts,Total Sales Billed,Damage/Spillage,Closing Balance,Total Litres,Permit No,EAL Serials\n';
    const rows = report.ksbcl_register
      .map(
        (r: any) =>
          `"${r.brand_name}","${r.opening_fmt}","${r.inward_fmt}","${r.sales_fmt}","${r.damage_fmt}","${r.closing_fmt}",${r.total_litres},"${r.ksbcl_permit_no}","${r.eal_serial_range}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KSBCL_Daily_Stock_Sheet_${selectedDate}.csv`;
    a.click();
    toast.success('Exported Daily Stock & Sales Sheet to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Daily Stock & Sales Sheet (KSBCL Form FL-4)</h1>
            <Badge variant="default" className="bg-emerald-600 text-white text-[10px] flex items-center gap-1">
              <ShieldCheck className="size-3" />
              Karnataka Excise Audit Ready
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automated daily opening balance, inward permit receipts, POS sales, breakage loss, and closing stock register.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-36 text-xs h-9 bg-card"
          />
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4 mr-1.5" />
            Print FL-4 Sheet
          </Button>
          <Button size="sm" onClick={fetchReport}>
            <RefreshCw className="size-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Register Report Table Card */}
      <Card className="bg-card border-border">
        <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Daily Stock & Sales Balance Sheet ({selectedDate})
          </CardTitle>
          <span className="text-xs font-mono text-muted-foreground">Form FL-4 • Karnataka State Excise</span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase font-medium border-b border-border">
                <tr>
                  <th className="py-3 px-4">Brand & Description</th>
                  <th className="py-3 px-4">Opening Stock</th>
                  <th className="py-3 px-4">Inward Receipts</th>
                  <th className="py-3 px-4">Total Sales Billed</th>
                  <th className="py-3 px-4">Spillage / Breakage</th>
                  <th className="py-3 px-4 font-bold text-foreground">Closing Stock</th>
                  <th className="py-3 px-4 text-right">Bulk Litres (BL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Calculating daily stock & sales balance sheet...
                    </td>
                  </tr>
                ) : !report?.ksbcl_register || report.ksbcl_register.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No stock records available for this date.
                    </td>
                  </tr>
                ) : (
                  report.ksbcl_register.map((row: any) => (
                    <tr key={row.product_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Wine className="size-3.5 text-primary shrink-0" />
                          <span>{row.brand_name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-500 block mt-0.5">{row.eal_serial_range}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{row.opening_fmt}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-600">+{row.inward_fmt}</td>
                      <td className="py-3 px-4 font-semibold text-blue-600">-{row.sales_fmt}</td>
                      <td className="py-3 px-4 text-red-500">{row.damage_fmt}</td>
                      <td className="py-3 px-4 font-bold text-foreground bg-muted/20">{row.closing_fmt}</td>
                      <td className="py-3 px-4 font-bold text-right text-primary">{row.total_litres} L</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
