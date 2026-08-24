'use client';

import React, { useState } from 'react';
import { CalendarDays, Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Table {
  id: string;
  tableNumber: string;
  section: string;
  capacity: number;
  status: 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'BILLING';
  guestCount?: number;
}

export default function TablesLayoutPage() {
  const [tables, setTables] = useState<Table[]>([
    { id: '1', tableNumber: 'T1', section: 'Main Floor', capacity: 2, status: 'VACANT' },
    { id: '2', tableNumber: 'T2', section: 'Main Floor', capacity: 4, status: 'OCCUPIED', guestCount: 3 },
    { id: '3', tableNumber: 'T3', section: 'Main Floor', capacity: 4, status: 'BILLING', guestCount: 4 },
    { id: '4', tableNumber: 'T4', section: 'Main Floor', capacity: 6, status: 'OCCUPIED', guestCount: 5 },
    { id: '5', tableNumber: 'R1', section: 'Rooftop', capacity: 4, status: 'RESERVED' },
    { id: '6', tableNumber: 'R2', section: 'Rooftop', capacity: 8, status: 'VACANT' },
    { id: '7', tableNumber: 'V1', section: 'VIP Lounge', capacity: 10, status: 'OCCUPIED', guestCount: 8 },
  ]);

  const toggleTable = (id: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'VACANT' ? 'OCCUPIED' : t.status === 'OCCUPIED' ? 'BILLING' : 'VACANT';
          toast.success(`Table ${t.tableNumber} updated to ${nextStatus}`);
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tables & Floor Layout</h1>
          <p className="text-sm text-muted-foreground">
            Manage live table occupancy, guest seating, and section maps.
          </p>
        </div>
      </div>

      {/* Table Map Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((t) => (
          <Card
            key={t.id}
            onClick={() => toggleTable(t.id)}
            className={`cursor-pointer transition-all hover:scale-105 flex flex-col justify-between p-4 border ${
              t.status === 'VACANT'
                ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500'
                : t.status === 'OCCUPIED'
                ? 'border-blue-500/40 bg-blue-500/5 hover:border-blue-500'
                : t.status === 'BILLING'
                ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                : 'border-purple-500/40 bg-purple-500/5 hover:border-purple-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg text-foreground">{t.tableNumber}</span>
              <Badge
                variant={
                  t.status === 'VACANT'
                    ? 'default'
                    : t.status === 'OCCUPIED'
                    ? 'secondary'
                    : 'outline'
                }
                className="text-[10px]"
              >
                {t.status}
              </Badge>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
              <span className="text-[10px]">{t.section}</span>
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Users className="size-3 text-primary" />
                {t.guestCount || 0}/{t.capacity}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
