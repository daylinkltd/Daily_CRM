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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function BarInventoryPage() {
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedPermitItem, setSelectedPermitItem] = useState<any | null>(null);

  const fetchStock = async (dateStr?: string) => {
    setLoading(true);
    const targetDate = dateStr || selectedDate;
    try {
      const res = await fetch(`/api/bar/reports/ksbcl?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        setStockRows(data.ksbcl_register || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(selectedDate);
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
                  <th className="py-3 px-4 font-bold text-foreground">Closing Stock</th>
                  <th className="py-3 px-4">Total Volume</th>
                  <th className="py-3 px-4 text-right">Est. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                      Loading KSBCL daily stock register for {selectedDate}...
                    </td>
                  </tr>
                ) : stockRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
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
