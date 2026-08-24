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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BarInventoryPage() {
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bar/reports/ksbcl');
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
    fetchStock();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alcohol Stock & KSBCL Register</h1>
          <p className="text-sm text-muted-foreground">
            Track liquid volume in Litres, sealed bottles, open bottle levels, and KSBCL excise compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStock}>
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
        <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Package className="size-5 text-primary" />
            KSBCL Daily Stock Register
          </CardTitle>
          <Link href="/bar-management/inventory/damage">
            <Button variant="outline" size="sm" className="text-xs">
              <AlertTriangle className="size-3.5 mr-1 text-amber-500" />
              Log Damage / Spillage
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium border-b border-border">
                <tr>
                  <th className="py-3 px-4">Brand / Liquor Item</th>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Sealed Bottles</th>
                  <th className="py-3 px-4">Open Bottles (ml)</th>
                  <th className="py-3 px-4">Total Volume (Litres)</th>
                  <th className="py-3 px-4">Cost / ML</th>
                  <th className="py-3 px-4 text-right">Est. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                      Loading KSBCL stock register...
                    </td>
                  </tr>
                ) : stockRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                      No stock records found. Use "Inward Permit Stock" to add inventory.
                    </td>
                  </tr>
                ) : (
                  stockRows.map((row) => (
                    <tr key={row.product_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                        <Wine className="size-4 text-primary" />
                        {row.brand_name}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{row.sku}</td>
                      <td className="py-3 px-4 font-bold text-foreground">{row.sealed_bottles} Btl</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.open_bottles_ml} ml</td>
                      <td className="py-3 px-4 font-bold text-primary">{row.total_litres} L</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">₹{row.wac_cost_per_ml.toFixed(2)}</td>
                      <td className="py-3 px-4 font-bold text-right text-emerald-600">₹{row.estimated_inventory_value.toLocaleString()}</td>
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
