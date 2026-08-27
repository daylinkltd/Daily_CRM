'use client';

import React, { useState } from 'react';
import { UtensilsCrossed, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface KdsOrder {
  id: string;
  orderNumber: string;
  table: string;
  timeAgo: string;
  items: { name: string; qty: number; portion: string; notes?: string }[];
  status: 'PENDING' | 'PREPARING' | 'READY';
}

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<KdsOrder[]>([
    {
      id: '1',
      orderNumber: 'BAR-0982',
      table: 'Table 4',
      timeAgo: '3 mins ago',
      status: 'PENDING',
      items: [
        { name: 'Glenfiddich 12 Single Malt', qty: 2, portion: '60ML', notes: 'With ice on side' },
        { name: 'Long Island Iced Tea (LIIT)', qty: 1, portion: 'COCKTAIL' },
      ],
    },
    {
      id: '2',
      orderNumber: 'BAR-0981',
      table: 'VIP Booth 2',
      timeAgo: '7 mins ago',
      status: 'PREPARING',
      items: [
        { name: 'Heineken Lager Draft Pint', qty: 4, portion: 'PINT' },
        { name: 'Absolut Swedish Vodka', qty: 2, portion: '30ML', notes: 'Neat' },
      ],
    },
  ]);

  const updateStatus = (id: string, nextStatus: 'PREPARING' | 'READY') => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o))
    );
    toast.success(`Order status updated to ${nextStatus}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kitchen & Bar Display System (KDS)</h1>
          <p className="text-sm text-muted-foreground">
            Live order ticket queue for bartenders and kitchen staff.
          </p>
        </div>
      </div>

      {/* Ticket Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((ticket) => (
          <Card
            key={ticket.id}
            className={`border flex flex-col justify-between ${
              ticket.status === 'PENDING'
                ? 'border-amber-500/50 bg-amber-500/5'
                : ticket.status === 'PREPARING'
                ? 'border-blue-500/50 bg-blue-500/5'
                : 'border-emerald-500/50 bg-emerald-500/5'
            }`}
          >
            <CardHeader className="py-3 px-4 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-primary" />
                  {ticket.orderNumber}
                </CardTitle>
                <span className="text-xs text-muted-foreground">{ticket.table}</span>
              </div>
              <div className="flex flex-col items-end">
                <Badge
                  variant={
                    ticket.status === 'PENDING'
                      ? 'outline'
                      : ticket.status === 'PREPARING'
                      ? 'secondary'
                      : 'default'
                  }
                  className="text-xs"
                >
                  {ticket.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="size-3" />
                  {ticket.timeAgo}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 flex-1 space-y-2 text-xs">
              {ticket.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start pb-2 border-b border-border/40 last:border-none">
                  <div>
                    <span className="font-semibold text-foreground">{item.name}</span>
                    {item.notes && <p className="text-[10px] text-amber-500 italic mt-0.5">Note: {item.notes}</p>}
                  </div>
                  <span className="font-bold text-primary ml-2">{item.qty} × {item.portion}</span>
                </div>
              ))}
            </CardContent>

            <div className="p-3 border-t border-border/50 bg-background/50 flex gap-2">
              {ticket.status === 'PENDING' && (
                <Button
                  onClick={() => updateStatus(ticket.id, 'PREPARING')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                >
                  Start Preparing
                </Button>
              )}
              {ticket.status === 'PREPARING' && (
                <Button
                  onClick={() => updateStatus(ticket.id, 'READY')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                >
                  Mark as Ready
                </Button>
              )}
              {ticket.status === 'READY' && (
                <div className="w-full py-1 text-center font-semibold text-emerald-600 text-xs flex items-center justify-center gap-1">
                  <CheckCircle2 className="size-4" />
                  Ready to Serve
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
