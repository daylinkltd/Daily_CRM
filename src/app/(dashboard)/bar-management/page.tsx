'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wine,
  TrendingUp,
  PackageCheck,
  AlertTriangle,
  Clock,
  LayoutGrid,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BarDashboardPage() {
  const [stats, setStats] = useState({
    todaySales: 45800,
    totalOrders: 124,
    activeTables: '8 / 15',
    lowStockItems: 3,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bar Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time sales, table status, KSBCL liquor stock levels, and shift performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bar-management/pos">
            <Button size="sm">
              <LayoutGrid className="size-4 mr-1.5" />
              Open POS Terminal
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today's Revenue</CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.todaySales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">+12.4% from yesterday</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Orders</CardTitle>
            <Wine className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Avg ₹369 / order</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Tables</CardTitle>
            <Clock className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTables}</div>
            <p className="text-xs text-muted-foreground mt-1">53% Floor Occupancy</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            <AlertTriangle className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Reorder threshold reached</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <LayoutGrid className="size-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Touch POS Terminal</h3>
                <p className="text-xs text-muted-foreground">Order taking, 30ml/60ml shots, and bill split.</p>
              </div>
            </div>
            <Link href="/bar-management/pos" className="w-full mt-4 block">
              <Button variant="outline" className="w-full text-xs">Launch POS</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600">
                <PackageCheck className="size-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">KSBCL Stock Inward</h3>
                <p className="text-xs text-muted-foreground">Case receiving, permit numbers, and EAL serials.</p>
              </div>
            </div>
            <Link href="/bar-management/inventory/inward" className="w-full mt-4 block">
              <Button variant="outline" className="w-full text-xs">Inward Entry</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/10 text-purple-600">
                <FileText className="size-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">KSBCL Daily Register</h3>
                <p className="text-xs text-muted-foreground">Export opening & closing stock for excise audit.</p>
              </div>
            </div>
            <Link href="/bar-management/reports/ksbcl" className="w-full mt-4 block">
              <Button variant="outline" className="w-full text-xs">View Register</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
