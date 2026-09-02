'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  ArrowDownToLine,
  AlertTriangle,
  FileText,
  RefreshCw,
  Wine,
  Calendar,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INITIAL_DEMO_DAMAGE_LOGS = [
  {
    id: 'dmg_01',
    product_name: 'Old Monk Supreme Rum (750ml)',
    product_id: 'Old Monk Supreme Rum (750ml)',
    sku: 'OM-750',
    damage_type: 'COUNTER_BREAKAGE',
    bottles_damaged: 1,
    volume_ml_damaged: 750,
    reason: 'Accidental bottle slip behind the bar counter',
    ksbcl_permit_no: 'KSBCL/KA/2026/09876',
    logged_at: new Date().toISOString(),
    logged_by: 'Swaraj J. (Bar Manager)',
    status: 'STOCK_DEDUCTED',
  },
];

// Helper to parse bottle count from formatted string e.g. "2 Cases + 2 Btl" -> 26 bottles
const parseBottles = (fmtStr?: string): number => {
  if (!fmtStr) return 0;
  const casesMatch = fmtStr.match(/(\d+)\s*Cases?/i);
  const btlMatch = fmtStr.match(/(\d+)\s*Btl/i) || fmtStr.match(/(\d+)\s*Cans?/i);
  const cases = casesMatch ? parseInt(casesMatch[1], 10) : 0;
  const btl = btlMatch ? parseInt(btlMatch[1], 10) : 0;
  return cases * 12 + btl;
};

// Format total bottles back into Cases + Loose Bottles
const formatCasesAndBottles = (totalBottles: number, unitLabel = 'Btl'): string => {
  const rounded = Math.max(0, totalBottles);
  const cases = Math.floor(rounded / 12);
  const loose = Number((rounded % 12).toFixed(1));
  if (cases > 0) {
    return loose > 0 ? `${cases} Cases + ${loose} ${unitLabel}` : `${cases} Cases + 0 ${unitLabel}`;
  }
  return `${loose} ${unitLabel}`;
};

export default function BarInventoryPage() {
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [damageLogs, setDamageLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedPermitItem, setSelectedPermitItem] = useState<any | null>(null);

  const fetchStock = async (dateStr?: string) => {
    setLoading(true);
    const targetDate = dateStr || selectedDate;

    // Load damage logs from localStorage
    let logs: any[] = [];
    if (typeof window !== 'undefined') {
      const savedLogs = localStorage.getItem('bar_damage_logs_local');
      if (savedLogs) {
        try {
          const parsed = JSON.parse(savedLogs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            logs = parsed;
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (logs.length === 0) {
        logs = INITIAL_DEMO_DAMAGE_LOGS;
        localStorage.setItem('bar_damage_logs_local', JSON.stringify(INITIAL_DEMO_DAMAGE_LOGS));
      }
    }
    setDamageLogs(logs);

    try {
      const res = await fetch(`/api/bar/reports/ksbcl?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        let rows = data.ksbcl_register || [];

        // Dynamically compute exact Closing Stock = Opening + Inward - Sales - Spillage/Damage
        rows = rows.map((r: any) => {
          const matchedLogs = logs.filter((l: any) => {
            if (!l.product_id && !l.product_name) return false;
            const term = (l.product_name || l.product_id || '').toLowerCase().trim();
            const brand = (r.brand_name || '').toLowerCase().trim();
            const sku = (r.sku || '').toLowerCase().trim();
            return brand.includes(term) || term.includes(brand) || term === sku;
          });

          const totalDmgBtl = matchedLogs.reduce((acc: number, l: any) => acc + (Number(l.bottles_damaged) || 0), 0);
          const totalDmgMl = matchedLogs.reduce((acc: number, l: any) => acc + (Number(l.volume_ml_damaged) || 0), 0);

          const openingBtl = parseBottles(r.opening_fmt);
          const inwardBtl = parseBottles(r.inward_fmt);
          const salesBtl = parseBottles(r.sales_fmt);
          const damageBtl = totalDmgBtl > 0 ? totalDmgBtl : (r.damage_bottles || parseBottles(r.damage_fmt));

          // Closing Stock Formula: Opening + Inward - Sales - Damage
          const closingBtl = Math.max(0, openingBtl + inwardBtl - salesBtl - damageBtl);
          const totalLitres = Number(((closingBtl * 750) / 1000).toFixed(2));
          const estimatedVal = Math.round(totalLitres * 1000 * (r.wac_cost_per_ml || 5.5));

          return {
            ...r,
            damage_fmt: damageBtl > 0 ? `${damageBtl} Btl (${totalDmgMl || damageBtl * 750}ml)` : (r.damage_fmt || '0 Btl (0ml)'),
            damage_bottles: damageBtl,
            closing_fmt: formatCasesAndBottles(closingBtl),
            total_litres: totalLitres,
            estimated_inventory_value: estimatedVal,
          };
        });

        setStockRows(rows);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(selectedDate);
    const handleStorage = () => fetchStock(selectedDate);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleStorage);
    };
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Alcohol Stock & KSBCL Register</h1>
            <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <ShieldCheck className="size-3" />
              Date-wise Register
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track liquid volume in Litres, daily opening/closing balance, permit numbers, EAL holograms, and KSBCL excise compliance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-2.5 py-1 text-xs">
            <Calendar className="size-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-7 w-32 border-0 bg-transparent text-xs p-0 focus-visible:ring-0"
            />
          </div>

          <Button variant="outline" size="sm" onClick={() => fetchStock(selectedDate)}>
            <RefreshCw className="size-4 mr-1.5" />
            Refresh
          </Button>

          <Link href="/bar-management/inventory/inward">
            <Button size="sm">
              <ArrowDownToLine className="size-4 mr-1.5" />
              Inward Permit Stock (GRN)
            </Button>
          </Link>
        </div>
      </div>

      {/* Stock Table Card */}
      <Card className="bg-card border-border">
        <CardHeader className="py-4 px-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Package className="size-5 text-primary" />
              KSBCL Daily Stock Register ({selectedDate})
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/bar-management/reports/ksbcl">
              <Button variant="outline" size="sm" className="text-xs">
                <FileText className="size-3.5 mr-1 text-primary" />
                FL-4 Excise Sheet
              </Button>
            </Link>
            <Link href="/bar-management/inventory/damage">
              <Button variant="outline" size="sm" className="text-xs">
                <AlertTriangle className="size-3.5 mr-1 text-amber-500" />
                Log Damage / Spillage
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium border-b border-border">
                <tr>
                  <th className="py-3 px-4">Brand & Permit Details</th>
                  <th className="py-3 px-4">Opening Stock</th>
                  <th className="py-3 px-4">Inward Receipts</th>
                  <th className="py-3 px-4">Sales Billed</th>
                  <th className="py-3 px-4 text-amber-500">Spillage / Damage</th>
                  <th className="py-3 px-4 font-bold text-foreground">Closing Stock</th>
                  <th className="py-3 px-4">Total Volume</th>
                  <th className="py-3 px-4 text-right">Est. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                      Loading KSBCL daily stock register for {selectedDate}...
                    </td>
                  </tr>
                ) : stockRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                      No stock records found for {selectedDate}. Use "Inward Permit Stock" to add inventory.
                    </td>
                  </tr>
                ) : (
                  stockRows.map((row) => (
                    <tr 
                      key={row.product_id} 
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedPermitItem(row)}
                    >
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Wine className="size-4 text-primary shrink-0" />
                          <span className="hover:text-primary transition-colors">{row.brand_name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">SKU: {row.sku}</span>
                          {row.ksbcl_permit_no && (
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              Permit: {row.ksbcl_permit_no}
                            </span>
                          )}
                          {row.eal_serial_range && (
                            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              EAL: {row.eal_serial_range}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{row.opening_fmt || `${row.sealed_bottles || 0} Btl`}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-emerald-600">+{row.inward_fmt || '0 Btl'}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-blue-600">-{row.sales_fmt || '0 Btl'}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-amber-500">{row.damage_fmt || '0 Btl (0ml)'}</td>
                      <td className="py-3 px-4 font-bold text-foreground bg-muted/20">{row.closing_fmt || `${row.sealed_bottles || 0} Btl`}</td>
                      <td className="py-3 px-4 font-bold text-primary">{row.total_litres} L</td>
                      <td className="py-3 px-4 font-bold text-right text-emerald-600">₹{row.estimated_inventory_value?.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Breakage & Spillage Audit Register Card */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-500">
              <AlertTriangle className="size-5" />
              Breakage & Spillage Audit Register
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified record of liquor bottle breakages, transit damages, and corresponding stock deductions.
            </p>
          </div>
          <Link href="/bar-management/inventory/damage">
            <Button size="sm" variant="outline" className="text-xs font-semibold border-amber-500/30 text-amber-500 hover:bg-amber-500/10 gap-1">
              <AlertTriangle className="size-3.5" />
              Log Damage / Spillage
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium border-b border-border">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Liquor Product / SKU</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4 text-center">Bottles Damaged</th>
                  <th className="py-3 px-4 text-center">Volume (ml)</th>
                  <th className="py-3 px-4">Logged By / Manager</th>
                  <th className="py-3 px-4">Incident Reason / Notes</th>
                  <th className="py-3 px-4 text-right">Deduction Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {damageLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No breakage incidents recorded yet.
                    </td>
                  </tr>
                ) : (
                  damageLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {log.logged_at ? new Date(log.logged_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '2026-09-02 17:04'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Wine className="size-3.5 text-amber-500 shrink-0" />
                          <span>{log.product_name || log.product_id}</span>
                        </div>
                        {log.sku && <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">SKU: {log.sku}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {log.damage_type ? log.damage_type.replace('_', ' ') : 'COUNTER BREAKAGE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-red-500">
                        {log.bottles_damaged || 1} Bottle(s)
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-red-500">
                        {log.volume_ml_damaged || 750} ml
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {log.logged_by || 'Swaraj J. (Bar Manager)'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground italic max-w-xs truncate">
                        "{log.reason || 'Accidental bottle slip behind counter'}"
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" />
                          Deducted (-{log.volume_ml_damaged || 750}ml)
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Permit & Hologram Details Dialog */}
      {selectedPermitItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Wine className="size-5 text-primary" />
                <h3 className="font-bold text-base">{selectedPermitItem.brand_name}</h3>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedPermitItem(null)}>
                ✕
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-muted/50 p-3 rounded-lg space-y-2 border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SKU / Code:</span>
                  <span className="font-mono font-semibold">{selectedPermitItem.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transport Permit No:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedPermitItem.ksbcl_permit_no || 'KSBCL/KA/2026/09874'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EAL Hologram Serials:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {selectedPermitItem.eal_serial_range || 'EAL-882001 - EAL-882036'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WAC Cost / ml:</span>
                  <span className="font-semibold">₹{selectedPermitItem.wac_cost_per_ml?.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">Current Volume</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{selectedPermitItem.total_litres} Litres</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">Stock Valuation</p>
                  <p className="text-sm font-bold text-primary mt-0.5">₹{selectedPermitItem.estimated_inventory_value?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedPermitItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
