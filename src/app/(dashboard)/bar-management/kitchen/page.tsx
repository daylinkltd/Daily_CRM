'use client';

import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Clock, CheckCircle2, AlertCircle, Plus, RefreshCw } from 'lucide-react';
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
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadKdsOrders = async () => {
    if (typeof window === 'undefined') return;
    setIsRefreshing(true);
    let localList: KdsOrder[] = [];
    const saved = localStorage.getItem('bar_kds_orders');
    if (saved) {
      try {
        localList = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }

    // Also fetch from API endpoint
    try {
      const res = await fetch('/api/bar/orders');
      if (res.ok) {
        const json = await res.json();
        if (json.orders && Array.isArray(json.orders) && json.orders.length > 0) {
          const apiOrders = json.orders;
          // Combine API and local orders, deduplicating by orderNumber
          const combinedMap = new Map();
          [...localList, ...apiOrders].forEach((o) => {
            if (o.orderNumber && !combinedMap.has(o.orderNumber)) {
              combinedMap.set(o.orderNumber, o);
            }
          });
          const merged = Array.from(combinedMap.values());
          setOrders(merged);
          localStorage.setItem('bar_kds_orders', JSON.stringify(merged));
          setIsRefreshing(false);
          return;
        }
      }
    } catch (e) {
      console.warn('API KDS fetch fallback to local:', e);
    }

    if (saved !== null) {
      setOrders(localList);
      setIsRefreshing(false);
      return;
    }

    // Default sample tickets if empty
    const defaults: KdsOrder[] = [
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
    ];
    setOrders(defaults);
    localStorage.setItem('bar_kds_orders', JSON.stringify(defaults));
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadKdsOrders();

    const handleStorage = () => loadKdsOrders();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleStorage);
    };
  }, []);

  const handleAddTestTicket = () => {
    const randomTableNum = Math.floor(Math.random() * 8) + 1;
    const kotNo = `KOT-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket: KdsOrder = {
      id: `test_${Date.now()}`,
      orderNumber: kotNo,
      table: `Table ${randomTableNum}`,
      timeAgo: 'Just now',
      status: 'PENDING',
      items: [
        { name: 'Paneer Tikka Tandoori', qty: 1, portion: 'FULL', notes: 'Extra Mint Chutney' },
        { name: 'Butter Chicken Murgh Khas', qty: 1, portion: 'FULL' },
        { name: 'Glenfiddich 12 Single Malt', qty: 2, portion: '60ML', notes: 'On the rocks' },
      ],
    };

    setOrders((prev) => {
      const updated = [newTicket, ...prev];
      if (typeof window !== 'undefined') {
        localStorage.setItem('bar_kds_orders', JSON.stringify(updated));
      }
      return updated;
    });
    toast.success(`Dispatched KOT #${kotNo} for Table ${randomTableNum} to KDS Queue!`);
  };

  const updateStatus = (id: string, nextStatus: 'PREPARING' | 'READY') => {
    setOrders((prev) => {
      const updated = prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o));
      if (typeof window !== 'undefined') {
        localStorage.setItem('bar_kds_orders', JSON.stringify(updated));
      }
      return updated;
    });
    toast.success(`Order status updated to ${nextStatus}`);
  };

  const handleCancelOrder = (id: string, orderNumber: string, table: string) => {
    setOrders((prev) => {
      const updated = prev.filter((o) => o.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bar_kds_orders', JSON.stringify(updated));
      }
      return updated;
    });
    toast.error(`Order ${orderNumber} for ${table} CANCELLED. Ticket voided.`);
  };

  const handleClearCompleted = () => {
    setOrders((prev) => {
      const updated = prev.filter((o) => o.status !== 'READY');
      if (typeof window !== 'undefined') {
        localStorage.setItem('bar_kds_orders', JSON.stringify(updated));
      }
      return updated;
    });
    toast.info('Cleared ready tickets from KDS display screen');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="size-6 text-primary" />
            Kitchen & Bar Display System (KDS)
          </h1>
          <p className="text-sm text-muted-foreground">
            Live order ticket queue for bartenders and kitchen staff.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleAddTestTicket}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1 shadow-sm"
          >
            <Plus className="size-3.5" />
            Send Test Ticket
          </Button>
          <Button
            onClick={loadKdsOrders}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            className="text-xs font-semibold gap-1"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Queue
          </Button>
          <Button onClick={handleClearCompleted} variant="outline" size="sm" className="text-xs font-semibold">
            Clear Ready Tickets
          </Button>
        </div>
      </div>

      {/* Ticket Cards Grid or Empty Queue State */}
      {orders.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border flex flex-col items-center justify-center space-y-3 bg-card/50">
          <UtensilsCrossed className="size-10 text-muted-foreground/50 animate-pulse" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">KDS Queue Clean & Empty</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              All tickets cleared! New order tickets dispatched from Touch POS or Table Billing will appear here automatically in real time.
            </p>
          </div>
          <Button
            onClick={handleAddTestTicket}
            size="sm"
            variant="outline"
            className="text-xs font-semibold gap-1 mt-2"
          >
            <Plus className="size-3.5 text-primary" />
            Send Test KOT Ticket
          </Button>
        </Card>
      ) : (
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
              <div className="flex flex-col items-end gap-1">
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
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
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

            <div className="p-3 border-t border-border/50 bg-background/50 flex items-center gap-2">
              {ticket.status === 'PENDING' && (
                <Button
                  onClick={() => updateStatus(ticket.id, 'PREPARING')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 font-bold"
                >
                  Start Preparing
                </Button>
              )}
              {ticket.status === 'PREPARING' && (
                <Button
                  onClick={() => updateStatus(ticket.id, 'READY')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-bold"
                >
                  Mark as Ready
                </Button>
              )}
              {ticket.status === 'READY' && (
                <div className="flex-1 py-1 font-semibold text-emerald-600 text-xs flex items-center justify-center gap-1">
                  <CheckCircle2 className="size-4" />
                  Ready to Serve
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCancelOrder(ticket.id, ticket.orderNumber, ticket.table)}
                className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30 font-semibold"
                title="Cancel order ticket (Customer left)"
              >
                Void Ticket
              </Button>
            </div>
          </Card>
        ))}
        </div>
      )}
    </div>
  );
}
