'use client';

import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  CreditCard,
  Banknote,
  QrCode,
  Users,
  Split,
  ChevronRight,
  UtensilsCrossed,
  ArrowRightLeft,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ThermalReceiptModal } from '@/components/bar/thermal-receipt-modal';

interface TableKotItem {
  id: string;
  name: string;
  portion: string;
  qty: number;
  unitPrice: number;
  roundNo: number; // KOT Round 1, Round 2, Round 3
  kotTime: string;
}

interface RunningTableTab {
  id: string;
  tableNumber: string;
  section: string;
  serverName: string;
  openedAgo: string;
  guestCount: number;
  status: 'OCCUPIED' | 'BILLING';
  items: TableKotItem[];
}

export default function RestaurantTableBillingPage() {
  const [selectedTabId, setSelectedTabId] = useState<string>('2');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddRoundModal, setShowAddRoundModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sample Food & Drink Items for Adding KOT Round
  const [newRoundItemName, setNewRoundItemName] = useState('Paneer Tikka Tandoori');
  const [newRoundPortion, setNewRoundPortion] = useState('FULL');
  const [newRoundQty, setNewRoundQty] = useState(1);
  const [newRoundPrice, setNewRoundPrice] = useState(280);

  const itemPriceCatalog: Record<string, number> = {
    'Paneer Tikka Tandoori': 280,
    'Butter Chicken Murgh Khas': 380,
    'Glenfiddich 12 Single Malt': 850,
    'Heineken Lager Draft Pint': 340,
    'Tandoori Butter Naan': 60,
    'French Fries Peri Peri': 160,
  };

  const handleItemSelectChange = (val: string) => {
    setNewRoundItemName(val);
    if (itemPriceCatalog[val]) {
      setNewRoundPrice(itemPriceCatalog[val]);
    }
  };

  const [runningTabs, setRunningTabs] = useState<RunningTableTab[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bar_running_table_tabs');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [
      {
        id: '2',
        tableNumber: 'Table 4',
        section: 'Main Floor',
        serverName: 'Rahul M.',
        openedAgo: '35 mins ago',
        guestCount: 5,
        status: 'OCCUPIED',
        items: [
          { id: 'k1', name: 'Glenfiddich 12 Single Malt', portion: '60ML', qty: 2, unitPrice: 850, roundNo: 1, kotTime: '12:15 PM' },
          { id: 'k2', name: 'Heineken Lager Draft Pint', portion: 'PINT', qty: 3, unitPrice: 340, roundNo: 1, kotTime: '12:15 PM' },
          { id: 'k3', name: 'Paneer Tikka Tandoori', portion: 'FULL', qty: 1, unitPrice: 280, roundNo: 2, kotTime: '12:30 PM' },
          { id: 'k4', name: 'Chilli Chicken Dry', portion: 'PORTION', qty: 1, unitPrice: 310, roundNo: 2, kotTime: '12:30 PM' },
        ],
      },
      {
        id: '3',
        tableNumber: 'T3',
        section: 'Main Floor',
        serverName: 'Anita S.',
        openedAgo: '50 mins ago',
        guestCount: 4,
        status: 'BILLING',
        items: [
          { id: 'k5', name: "Jack Daniel's Old No. 7", portion: '60ML', qty: 4, unitPrice: 600, roundNo: 1, kotTime: '12:00 PM' },
          { id: 'k6', name: 'Butter Chicken Murgh Khas', portion: 'FULL', qty: 1, unitPrice: 380, roundNo: 2, kotTime: '12:20 PM' },
          { id: 'k7', name: 'Tandoori Butter Naan', portion: 'FULL', qty: 4, unitPrice: 60, roundNo: 2, kotTime: '12:20 PM' },
        ],
      },
      {
        id: '7',
        tableNumber: 'V1',
        section: 'VIP Lounge',
        serverName: 'Vikram K.',
        openedAgo: '1 hour ago',
        guestCount: 8,
        status: 'OCCUPIED',
        items: [
          { id: 'k8', name: 'Absolut Swedish Vodka', portion: 'BOTTLE', qty: 1, unitPrice: 4600, roundNo: 1, kotTime: '11:50 AM' },
          { id: 'k9', name: 'Long Island Iced Tea (LIIT)', portion: '60ML', qty: 2, unitPrice: 580, roundNo: 2, kotTime: '12:15 PM' },
          { id: 'k10', name: 'Crispy Salt & Pepper Mushrooms', portion: 'PORTION', qty: 2, unitPrice: 240, roundNo: 2, kotTime: '12:15 PM' },
        ],
      },
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bar_running_table_tabs', JSON.stringify(runningTabs));
    }
  }, [runningTabs]);

  const activeTab = runningTabs.find((t) => t.id === selectedTabId) || runningTabs[0];

  const calculateSubtotal = (items: TableKotItem[]) =>
    items.reduce((acc, item) => acc + item.unitPrice * item.qty, 0);

  const currentSubtotal = activeTab ? calculateSubtotal(activeTab.items) : 0;
  const currentGst = Math.round(currentSubtotal * 0.18);
  const currentGrandTotal = currentSubtotal + currentGst;

  const filteredTabs = runningTabs.filter(
    (t) =>
      t.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.serverName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddKotRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab) return;

    const maxRound = Math.max(...activeTab.items.map((i) => i.roundNo), 0);
    const newRoundNo = maxRound + 1;

    const calculatedUnitPrice = itemPriceCatalog[newRoundItemName] || newRoundPrice || 250;

    const newItem: TableKotItem = {
      id: `k_${Date.now()}`,
      name: newRoundItemName,
      portion: newRoundPortion,
      qty: Number(newRoundQty),
      unitPrice: Number(calculatedUnitPrice),
      roundNo: newRoundNo,
      kotTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setRunningTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, status: 'OCCUPIED', items: [...t.items, newItem] } : t
      )
    );

    setShowAddRoundModal(false);
    toast.success(`KOT Round ${newRoundNo} appended to ${activeTab.tableNumber}!`);
  };

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isReceiptProforma, setIsReceiptProforma] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState('CASH');
  const [activeInvoiceNumber, setActiveInvoiceNumber] = useState('INV-BAR-2026-0892');

  const handlePrintProformaBill = () => {
    if (!activeTab) return;
    setRunningTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, status: 'BILLING' } : t))
    );
    setIsReceiptProforma(true);
    setActiveInvoiceNumber(`INV-${activeTab.tableNumber.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`);
    setShowReceiptModal(true);
    toast.info(`Proforma Bill generated for ${activeTab.tableNumber} (Moved to BILLING state)`);
  };

  const handleSettleTableBill = (paymentMethod: string) => {
    if (!activeTab) return;
    setIsSubmitting(true);
    const invoiceNo = `INV-${activeTab.tableNumber.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;
    setActivePaymentMethod(paymentMethod);
    setIsReceiptProforma(false);
    setActiveInvoiceNumber(invoiceNo);
    setShowReceiptModal(true);

    // Save transaction into localStorage sales ledger for Sales Report Analytics
    try {
      if (typeof window !== 'undefined') {
        const ledger = JSON.parse(localStorage.getItem('bar_completed_sales_ledger') || '[]');
        const saleTransaction = {
          id: `sale_tbl_${Date.now()}`,
          orderNumber: invoiceNo,
          tableNumber: activeTab.tableNumber,
          paymentMethod,
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
          subtotal: currentSubtotal,
          taxAmount: currentGst,
          grandTotal: currentGrandTotal,
          items: activeTab.items.map((i) => ({
            id: i.id,
            name: i.name,
            portion: i.portion,
            qty: i.qty,
            unitPrice: i.unitPrice,
            totalPrice: i.unitPrice * i.qty,
            type: (i.portion === '60ML' || i.portion === '30ML' || i.portion === 'BOTTLE' || i.portion === 'PINT' || i.portion === 'CAN' || i.name.toLowerCase().includes('vodka') || i.name.toLowerCase().includes('whisky') || i.name.toLowerCase().includes('beer') || i.name.toLowerCase().includes('rum')) ? 'DRINK' : 'FOOD',
            category: (i.portion === '60ML' || i.portion === '30ML' || i.portion === 'BOTTLE' || i.portion === 'PINT' || i.portion === 'CAN') ? 'BEVERAGE' : 'KITCHEN',
          })),
        };
        localStorage.setItem('bar_completed_sales_ledger', JSON.stringify([saleTransaction, ...ledger]));
      }
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => {
      setRunningTabs((prev) => prev.filter((t) => t.id !== activeTab.id));
      toast.success(
        `Bill Settled ₹${currentGrandTotal} via ${paymentMethod}! ${activeTab.tableNumber} is now VACANT.`
      );
      setIsSubmitting(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ReceiptText className="size-6 text-primary" />
            Restaurant Table Billing & Running Tabs
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage multi-round table orders, append KOT rounds, generate proforma bills, and settle table accounts.
          </p>
        </div>
      </div>

      {/* Main Grid: Running Table Cards & Active Bill Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Running Table Cards List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table, server, or section..."
              className="pl-9 bg-card text-xs h-10 border-border shadow-xs"
            />
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-16rem)] pr-1">
            {filteredTabs.length === 0 ? (
              <Card className="bg-card border-border p-8 text-center text-muted-foreground">
                <UtensilsCrossed className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">No active table bills</p>
                <p className="text-xs text-muted-foreground mt-1">All tables are currently vacant</p>
              </Card>
            ) : (
              filteredTabs.map((tab) => {
                const tabSubtotal = calculateSubtotal(tab.items);
                const tabTotal = tabSubtotal + Math.round(tabSubtotal * 0.18);
                const isSelected = activeTab?.id === tab.id;

                return (
                  <Card
                    key={tab.id}
                    onClick={() => setSelectedTabId(tab.id)}
                    className={`cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">{tab.tableNumber}</span>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {tab.section}
                        </Badge>
                      </div>

                      <Badge
                        variant={tab.status === 'OCCUPIED' ? 'secondary' : 'default'}
                        className="text-[10px]"
                      >
                        {tab.status}
                      </Badge>
                    </CardHeader>

                    <CardContent className="p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5 text-primary" />
                          {tab.guestCount} Guests · Server: {tab.serverName}
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <Clock className="size-3" />
                          {tab.openedAgo}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="text-muted-foreground text-[11px]">
                          {tab.items.length} items ordered across {Math.max(...tab.items.map((i) => i.roundNo))} round(s)
                        </span>
                        <span className="font-bold text-sm text-foreground">₹{tabTotal}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Table Bill Breakdown & Settlement */}
        {activeTab && (
          <div className="lg:col-span-7 flex flex-col h-full">
            <Card className="bg-card border-border flex-1 flex flex-col overflow-hidden shadow-xs">
              {/* Header Info */}
              <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between bg-muted/20">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ReceiptText className="size-5 text-primary" />
                    Running Tab: {activeTab.tableNumber} ({activeTab.section})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Server: <span className="font-semibold text-foreground">{activeTab.serverName}</span> · {activeTab.guestCount} Guests · {activeTab.openedAgo}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowAddRoundModal(true)}
                    size="sm"
                    className="h-8 text-xs font-bold bg-primary"
                  >
                    <Plus className="size-3.5 mr-1" />
                    Add KOT Round
                  </Button>
                </div>
              </CardHeader>

              {/* Order Items Grouped by KOT Rounds */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {[1, 2, 3].map((roundNum) => {
                  const roundItems = activeTab.items.filter((i) => i.roundNo === roundNum);
                  if (roundItems.length === 0) return null;

                  return (
                    <div key={roundNum} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-primary border-b border-border/60 pb-1">
                        <span className="flex items-center gap-1.5">
                          <UtensilsCrossed className="size-3.5" />
                          KOT Round #{roundNum}
                        </span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {roundItems[0]?.kotTime}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {roundItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs border border-border/30"
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{item.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                Portion: {item.portion} · Qty: {item.qty} × ₹{item.unitPrice}
                              </span>
                            </div>
                            <span className="font-bold text-sm">₹{item.unitPrice * item.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>

              {/* Bill Totals & Settlement Options */}
              <div className="p-4 border-t border-border bg-muted/20 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items Subtotal</span>
                    <span>₹{currentSubtotal}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Liquor & Food GST (18%)</span>
                    <span>₹{currentGst}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                    <span>Grand Total</span>
                    <span className="text-primary font-bold text-lg">₹{currentGrandTotal}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handlePrintProformaBill}
                      className="text-xs font-semibold flex items-center justify-center gap-1.5 h-9"
                    >
                      <Printer className="size-3.5 text-primary" />
                      Print Proforma Bill
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setShowSplitModal(true)}
                      className="text-xs font-semibold flex items-center justify-center gap-1.5 h-9"
                    >
                      <Split className="size-3.5 text-primary" />
                      Split Bill Across Guests
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button
                      disabled={isSubmitting}
                      onClick={() => handleSettleTableBill('CASH')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-10 flex items-center justify-center gap-1.5 font-bold shadow-xs"
                    >
                      <Banknote className="size-4" />
                      <span>Settle Cash</span>
                    </Button>

                    <Button
                      disabled={isSubmitting}
                      onClick={() => handleSettleTableBill('CARD')}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-10 flex items-center justify-center gap-1.5 font-bold shadow-xs"
                    >
                      <CreditCard className="size-4" />
                      <span>Settle Card</span>
                    </Button>

                    <Button
                      disabled={isSubmitting}
                      onClick={() => handleSettleTableBill('UPI')}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-10 flex items-center justify-center gap-1.5 font-bold shadow-xs"
                    >
                      <QrCode className="size-4" />
                      <span>Settle UPI</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Add KOT Round Dialog */}
      <Dialog open={showAddRoundModal} onOpenChange={setShowAddRoundModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="size-4 text-primary" />
              Append KOT Round to {activeTab?.tableNumber}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddKotRound} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Select Dish or Drink</Label>
              <Select value={newRoundItemName} onValueChange={handleItemSelectChange}>
                <SelectTrigger className="bg-background text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paneer Tikka Tandoori">Paneer Tikka Tandoori (₹280)</SelectItem>
                  <SelectItem value="Butter Chicken Murgh Khas">Butter Chicken Murgh Khas (₹380)</SelectItem>
                  <SelectItem value="Glenfiddich 12 Single Malt">Glenfiddich 12 Single Malt (₹850)</SelectItem>
                  <SelectItem value="Heineken Lager Draft Pint">Heineken Lager Draft Pint (₹340)</SelectItem>
                  <SelectItem value="Tandoori Butter Naan">Tandoori Butter Naan (₹60)</SelectItem>
                  <SelectItem value="French Fries Peri Peri">French Fries Peri Peri (₹160)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Portion Size</Label>
                <Select value={newRoundPortion} onValueChange={setNewRoundPortion}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Full Plate / Portion</SelectItem>
                    <SelectItem value="HALF">Half Plate</SelectItem>
                    <SelectItem value="60ML">60ML Peg</SelectItem>
                    <SelectItem value="30ML">30ML Peg</SelectItem>
                    <SelectItem value="PINT">Draft Pint</SelectItem>
                    <SelectItem value="BOTTLE">Full Bottle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newRoundQty}
                  onChange={(e) => setNewRoundQty(Number(e.target.value))}
                  className="bg-background text-xs h-9 font-mono"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddRoundModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Append KOT Round
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Thermal Receipt & Tax Invoice Modal */}
      {activeTab && (
        <ThermalReceiptModal
          open={showReceiptModal}
          onOpenChange={setShowReceiptModal}
          isProforma={isReceiptProforma}
          invoiceNumber={activeInvoiceNumber}
          date={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          tableNumber={activeTab.tableNumber}
          sectionName={activeTab.section}
          serverName={activeTab.serverName}
          paymentMethod={activePaymentMethod}
          subtotal={currentSubtotal}
          taxAmount={currentGst}
          grandTotal={currentGrandTotal}
          items={activeTab.items.map((i) => ({
            name: i.name,
            portion: i.portion,
            qty: i.qty,
            unitPrice: i.unitPrice,
            totalPrice: i.unitPrice * i.qty,
          }))}
        />
      )}
    </div>
  );
}
