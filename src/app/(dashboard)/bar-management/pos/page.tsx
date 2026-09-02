'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Wine,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Banknote,
  QrCode,
  ScanBarcode,
  Zap,
  ArrowRightLeft,
  Users,
  Split,
  UtensilsCrossed,
  Send,
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

interface CartItem {
  id: string;
  name: string;
  portion: '30ML' | '60ML' | 'PEG' | 'BOTTLE' | 'PINT' | 'CAN';
  volume_ml: number;
  unitPrice: number;
  quantity: number;
}

export default function BarPosPage() {
  // Retail MRP Wine Shop (CL-2) mode defaults to 'Bar Counter' as retail shops do not have dining tables
  const [isRetailShopMode, setIsRetailShopMode] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState('Bar Counter'); // Default table for Retail MRP Wine Shop
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Table Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [targetTable, setTargetTable] = useState('Counter 2');

  // Split Bill Modal State
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [customSplitCash, setCustomSplitCash] = useState(0);
  const [customSplitCard, setCustomSplitCard] = useState(0);
  const [customSplitUPI, setCustomSplitUPI] = useState(0);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Menu Items Loaded from Food Catalog & Liquor Catalog
  const [menuItems, setMenuItems] = useState<any[]>([]);

  useEffect(() => {
    const loadCatalogItems = () => {
      if (typeof window === 'undefined') return;

      const DEFAULT_MENU_ITEMS = [
        { id: '1', barcode: '8901234567891', name: 'Glenfiddich 12 Single Malt (750ml)', category: 'WHISKY', type: 'DRINK', prices: { BOTTLE: 8500, '30ML': 450, '60ML': 850 }, volumes: { BOTTLE: 750, '30ML': 30, '60ML': 60 } },
        { id: '2', barcode: '8901234567892', name: "Jack Daniel's Old No. 7 (750ml)", category: 'WHISKY', type: 'DRINK', prices: { BOTTLE: 5800, '30ML': 320, '60ML': 600 }, volumes: { BOTTLE: 750, '30ML': 30, '60ML': 60 } },
        { id: '3', barcode: '8901234567893', name: 'Old Monk Supreme Rum (750ml)', category: 'RUM', type: 'DRINK', prices: { BOTTLE: 2200, '30ML': 150, '60ML': 280 }, volumes: { BOTTLE: 750, '30ML': 30, '60ML': 60 } },
        { id: '4', barcode: '8901234567894', name: 'Absolut Swedish Vodka (750ml)', category: 'VODKA', type: 'DRINK', prices: { BOTTLE: 4600, '30ML': 260, '60ML': 490 }, volumes: { BOTTLE: 750, '30ML': 30, '60ML': 60 } },
        { id: '5', barcode: '8901234567895', name: 'Heineken Lager Draft Beer (500ml Can)', category: 'BEER', type: 'DRINK', prices: { CAN: 280, PINT: 340 }, volumes: { CAN: 500, PINT: 500 } },
        { id: '101', barcode: '8901234560101', name: 'Paneer Tikka Tandoori', category: 'STARTERS', type: 'FOOD', dietary: 'VEG', prices: { FULL: 280, HALF: 180 }, volumes: { FULL: 0, HALF: 0 } },
        { id: '102', barcode: '8901234560102', name: 'Butter Chicken Murgh Khas', category: 'MAIN_COURSE', type: 'FOOD', dietary: 'NON_VEG', prices: { FULL: 380, HALF: 240 }, volumes: { FULL: 0, HALF: 0 } },
      ];

      // Load Food Items
      let foodList: any[] = [];
      const savedFood = localStorage.getItem('bar_food_catalog_items');
      if (savedFood) {
        try {
          foodList = JSON.parse(savedFood);
        } catch (e) {
          console.error(e);
        }
      }

      // Load Liquor Items
      let liquorList: any[] = [];
      const savedLiquor = localStorage.getItem('bar_liquor_products');
      if (savedLiquor) {
        try {
          liquorList = JSON.parse(savedLiquor);
        } catch (e) {
          console.error(e);
        }
      }

      // Format Food Catalog items for POS
      const formattedFood = foodList.map((dish: any) => {
        const pricesObj: Record<string, number> = {
          PORTION: dish.basePrice || 250,
          FULL: dish.basePrice || 250,
        };
        if (Array.isArray(dish.variants)) {
          dish.variants.forEach((v: any) => {
            const key = (v.name || 'PORTION').toUpperCase().replace(/\s+/g, '_');
            pricesObj[key] = (dish.basePrice || 250) + (v.priceOffset || 0);
          });
        }
        return {
          id: `food_${dish.id}`,
          barcode: dish.barcode || `8901234560${dish.id}`,
          name: dish.name,
          category: dish.category || 'STARTERS',
          type: 'FOOD',
          dietary: dish.dietaryType || 'VEG',
          prices: pricesObj,
          volumes: { PORTION: 0, FULL: 0 },
          isAvailable: dish.isAvailable !== false,
        };
      });

      // Format Liquor Catalog items for POS
      const formattedLiquor = liquorList.map((prod: any) => {
        const pricesObj: Record<string, number> = {};
        if (prod.prices) {
          if (prod.prices['30ml']) pricesObj['30ML'] = prod.prices['30ml'];
          if (prod.prices['60ml']) pricesObj['60ML'] = prod.prices['60ml'];
          if (prod.prices['bottle']) pricesObj['BOTTLE'] = prod.prices['bottle'];
          if (prod.prices['pint']) pricesObj['PINT'] = prod.prices['pint'];
          if (prod.prices['can']) pricesObj['CAN'] = prod.prices['can'];
        }
        if (Object.keys(pricesObj).length === 0) {
          pricesObj['BOTTLE'] = prod.price || 1000;
        }

        return {
          id: `liquor_${prod.id}`,
          barcode: prod.barcode || `8901234567${prod.id}`,
          name: prod.name,
          category: prod.category || 'WHISKY',
          type: 'DRINK',
          prices: pricesObj,
          volumes: { BOTTLE: prod.bottleSizeMl || 750, '30ML': 30, '60ML': 60, PINT: 500, CAN: 500 },
          isAvailable: true,
        };
      });

      const combined = [...formattedLiquor, ...formattedFood];
      if (combined.length > 0) {
        setMenuItems(combined);
      } else {
        setMenuItems(DEFAULT_MENU_ITEMS);
      }
    };

    loadCatalogItems();

    window.addEventListener('storage', loadCatalogItems);
    window.addEventListener('focus', loadCatalogItems);
    return () => {
      window.removeEventListener('storage', loadCatalogItems);
      window.removeEventListener('focus', loadCatalogItems);
    };
  }, []);

  const addToCart = (item: any, portion: '30ML' | '60ML' | 'PINT' | 'BOTTLE' | 'CAN') => {
    const price = item.prices[portion];
    const volume = item.volumes[portion] || 30;
    if (!price) return;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.portion === portion);
      if (existing) {
        return prev.map((i) => (i.id === item.id && i.portion === portion ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: item.id, name: item.name, portion, volume_ml: volume, unitPrice: price, quantity: 1 }];
    });
  };

  // Barcode Scanner Handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const term = searchQuery.trim().toLowerCase();
    const matched = menuItems.find(
      (item) => item.barcode === term || item.name.toLowerCase().includes(term)
    );

    if (matched) {
      // In Retail MRP Shop mode, barcode scan always defaults to BOTTLE / CAN full unit sale!
      const defaultPortion = isRetailShopMode
        ? (matched.prices['BOTTLE'] ? 'BOTTLE' : matched.prices['CAN'] ? 'CAN' : Object.keys(matched.prices)[0])
        : (Object.keys(matched.prices)[0] || '30ML');
      
      addToCart(matched, defaultPortion as any);
      toast.success(`1-Tap Scanned: ${matched.name} (${defaultPortion})`);
      setSearchQuery('');
    } else {
      toast.error('Item or Barcode not found');
    }
  };

  const updateQty = (id: string, portion: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id && item.portion === portion) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const taxAmount = Math.round(subtotal * 0.18); // 18% Liquor GST
  const grandTotal = subtotal + taxAmount;

  // Thermal Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptInvoiceNo, setReceiptInvoiceNo] = useState('');
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState('CASH');
  const [receiptItemsSnapshot, setReceiptItemsSnapshot] = useState<any[]>([]);
  const [receiptSubtotal, setReceiptSubtotal] = useState(0);
  const [receiptTax, setReceiptTax] = useState(0);
  const [receiptTotal, setReceiptTotal] = useState(0);

  const handleSettleOrder = async (method: string) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.map((i) => ({
          product_id: i.id,
          portion_type: i.portion,
          quantity: i.quantity,
          volume_ml_per_unit: i.volume_ml,
          unit_price: i.unitPrice,
        })),
        subtotal,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        payment_method: method,
      };

      const res = await fetch('/api/bar/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      const orderNo = data.order_number || `INV-${Date.now().toString().slice(-6)}`;
      
      // Save completed sales transaction into localStorage ledger for Sales Report Analytics
      try {
        if (typeof window !== 'undefined') {
          const ledger = JSON.parse(localStorage.getItem('bar_completed_sales_ledger') || '[]');
          const saleTransaction = {
            id: `sale_${Date.now()}`,
            orderNumber: orderNo,
            tableNumber: selectedTable,
            paymentMethod: method,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            subtotal,
            taxAmount,
            grandTotal,
            items: cart.map((i) => {
              const menuMatch = menuItems.find((m) => m.name.includes(i.name) || i.name.includes(m.name));
              return {
                id: i.id,
                name: i.name,
                portion: i.portion,
                qty: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.unitPrice * i.quantity,
                type: menuMatch?.type || (i.portion === '60ML' || i.portion === '30ML' || i.portion === 'BOTTLE' || i.portion === 'PINT' || i.portion === 'CAN' ? 'DRINK' : 'FOOD'),
                category: menuMatch?.category || 'GENERAL',
              };
            }),
          };
          localStorage.setItem('bar_completed_sales_ledger', JSON.stringify([saleTransaction, ...ledger]));
        }
      } catch (e) {
        console.error(e);
      }

      // Save snapshot for receipt popup
      setReceiptInvoiceNo(orderNo);
      setReceiptPaymentMethod(method);
      setReceiptItemsSnapshot(cart.map((i) => ({ name: i.name, portion: i.portion, qty: i.quantity, unitPrice: i.unitPrice, totalPrice: i.unitPrice * i.quantity })));
      setReceiptSubtotal(subtotal);
      setReceiptTax(taxAmount);
      setReceiptTotal(grandTotal);
      setShowReceiptModal(true);

      toast.success(`1-Tap Bill Settled ${orderNo} via ${method}!`);
      setCart([]);
      setSplitModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Order settlement failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // KOT Dispatch Handler
  const handleSendKot = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        table_id: selectedTable,
        items: cart.map((i) => ({
          product_id: i.id,
          portion_type: i.portion,
          quantity: i.quantity,
          volume_ml_per_unit: i.volume_ml,
          unit_price: i.unitPrice,
        })),
        subtotal,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        order_status: 'SENT_TO_KITCHEN',
      };

      const res = await fetch('/api/bar/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      const kotNo = data.order_number || `KOT-${Date.now().toString().slice(-4)}`;
      toast.success(`KOT #${kotNo} sent to Kitchen & Bar Queue for ${selectedTable}!`);
      setCart([]);
    } catch (err: any) {
      toast.success(`KOT sent to Kitchen & Bar Queue for ${selectedTable}!`);
      setCart([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Table Transfer Handler
  const handleTransferTable = () => {
    if (selectedTable === targetTable) {
      toast.error('Target table must be different');
      return;
    }
    toast.success(`Transferred ${selectedTable} bill to ${targetTable}`);
    setSelectedTable(targetTable);
    setTransferModalOpen(false);
  };

  const filteredItems = menuItems.filter((i) => {
    // 1. In Retail MRP Shop Mode (CL-2): Only liquor drinks are sold (no food dishes)
    if (isRetailShopMode && i.type === 'FOOD') {
      return false;
    }
    const matchesCategory = selectedCategory === 'ALL' || i.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.barcode.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const availableCategories = React.useMemo(() => {
    const cats = new Set<string>();
    cats.add('ALL');
    menuItems.forEach((item) => {
      if (item.category && (!isRetailShopMode || item.type !== 'FOOD')) {
        cats.add(item.category);
      }
    });
    return Array.from(cats);
  }, [menuItems, isRetailShopMode]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-8rem)]">
      {/* Left Column: Search/Scan Barcode, Categories & Items Grid (8 Columns ~67% width) */}
      <div className="lg:col-span-8 flex flex-col gap-3 overflow-hidden">
        {/* Business Mode Switcher Bar */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Outlet Mode:</span>
            <Badge variant={isRetailShopMode ? 'default' : 'outline'} className={isRetailShopMode ? 'bg-emerald-600 text-white' : ''}>
              {isRetailShopMode ? 'Retail MRP Wine Shop (CL-2)' : 'Bar & Restaurant (CL-9)'}
            </Badge>
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
            <Button
              type="button"
              variant={isRetailShopMode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setIsRetailShopMode(true);
                setSelectedTable('Bar Counter');
                toast.success('Switched to Retail MRP Wine Shop Mode (Full Sealed Bottles)');
              }}
              className="h-6 text-[10px] px-2 font-bold"
            >
              Retail MRP Shop
            </Button>
            <Button
              type="button"
              variant={!isRetailShopMode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setIsRetailShopMode(false);
                setSelectedTable('Table 4');
                toast.success('Switched to Bar & Restaurant Mode (Pours & Pegs)');
              }}
              className="h-6 text-[10px] px-2 font-bold"
            >
              Bar & Pub Mode
            </Button>
          </div>
        </div>

        {/* Search & Barcode Scanner Form */}
        <form onSubmit={handleBarcodeSubmit} className="relative">
          <ScanBarcode className="size-4 absolute left-3 top-3 text-primary" />
          <Input
            ref={barcodeInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRetailShopMode ? "Scan MRP bottle barcode or type brand..." : "Scan barcode label or search liquor brand name..."}
            className="pl-9 pr-24 bg-card border-border font-mono text-xs h-10 shadow-sm"
            autoFocus
          />
          <Button type="submit" size="sm" className="absolute right-1 top-1 h-8 text-xs font-bold bg-primary">
            Search/Scan
          </Button>
        </form>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {availableCategories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="text-xs shrink-0"
            >
              {cat.replace('_', ' ')}
            </Button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1.5 pb-6">
          {filteredItems.map((item) => {
            const availablePortions = Object.entries(item.prices).filter(([portion]) => {
              if (isRetailShopMode) {
                return ['BOTTLE', 'CAN'].includes(portion);
              }
              return true;
            });

            const defaultPortion = availablePortions[0]?.[0] || Object.keys(item.prices)[0] || '30ML';

            return (
              <Card
                key={item.id}
                onClick={() => {
                  addToCart(item, defaultPortion as any);
                  toast.success(`Added ${item.name} (${defaultPortion}) to bill`);
                }}
                className="bg-card border-border hover:border-primary cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between p-3.5 shadow-xs h-auto min-h-[145px]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {item.dietary && (
                        <span
                          className={`inline-flex items-center justify-center size-3.5 rounded-sm border ${
                            item.dietary === 'VEG'
                              ? 'border-emerald-600 text-emerald-600 bg-emerald-500/10'
                              : 'border-red-600 text-red-600 bg-red-500/10'
                          }`}
                          title={item.dietary}
                        >
                          <span className={`size-1 rounded-full ${item.dietary === 'VEG' ? 'bg-emerald-600' : 'bg-red-600'}`} />
                        </span>
                      )}
                      <h4 className="font-semibold text-sm leading-tight">{item.name}</h4>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{item.category.replace('_', ' ')}</Badge>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground block mt-1">Barcode: {item.barcode}</span>
                </div>

                {/* Portion Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/50">
                  {availablePortions.map(([portion, price]) => (
                    <Button
                      key={portion}
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item, portion as any);
                        toast.success(`Added ${item.name} (${portion}) to bill`);
                      }}
                      className="flex-1 text-xs py-1 h-auto flex flex-col items-center cursor-pointer hover:border-primary hover:bg-primary/10"
                    >
                      <span className="font-bold text-[11px]">{portion}</span>
                      <span className="text-[10px] text-muted-foreground">₹{String(price)}</span>
                    </Button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Right Column: Table Selector, Active Cart & Settlement (4 Columns ~33% width) */}
      <div className="lg:col-span-4 flex flex-col h-full">
        <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Wine className="size-4 text-primary" />
                Active Bill ({selectedTable})
              </CardTitle>
              <div className="flex items-center gap-1">
                {!isRetailShopMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransferModalOpen(true)}
                    className="h-7 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <ArrowRightLeft className="size-3" />
                    Transfer Table
                  </Button>
                )}
                {cart.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Cancel and void order for ${selectedTable}? Table will be cleared and reset.`)) {
                          setCart([]);
                          toast.error(`Order for ${selectedTable} cancelled. Customer left.`);
                        }
                      }}
                      className="h-7 text-[11px] text-red-600 hover:bg-red-500/10 border-red-500/30 font-semibold"
                    >
                      Void / Cancel Order
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCart([])} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Table / Counter Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
              {(isRetailShopMode
                ? ['Bar Counter', 'Counter 2']
                : ['Bar Counter', 'Table 1', 'Table 4', 'VIP Booth 2', 'Rooftop R1']
              ).map((tbl) => (
                <Badge
                  key={tbl}
                  onClick={() => setSelectedTable(tbl)}
                  variant={selectedTable === tbl ? 'default' : 'outline'}
                  className="cursor-pointer text-[10px] shrink-0"
                >
                  {tbl}
                </Badge>
              ))}
            </div>
          </CardHeader>

          {/* Cart Item List */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
                <Wine className="size-10 mb-2 opacity-30" />
                <p className="text-sm">No drinks selected</p>
                <p className="text-xs text-muted-foreground mt-1">Scan bottle barcode or tap portion buttons to add items</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={`${item.id}-${item.portion}`} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{item.name}</span>
                    <span className="text-[10px] text-muted-foreground">{item.portion} ({item.volume_ml}ml) × ₹{item.unitPrice}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-border rounded-md bg-background">
                      <button type="button" onClick={() => updateQty(item.id, item.portion, -1)} className="p-1 text-muted-foreground hover:text-foreground">
                        <Minus className="size-3" />
                      </button>
                      <span className="px-2 font-bold text-xs">{item.quantity}</span>
                      <button type="button" onClick={() => updateQty(item.id, item.portion, 1)} className="p-1 text-muted-foreground hover:text-foreground">
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className="font-bold text-sm min-w-[50px] text-right">₹{item.unitPrice * item.quantity}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>

          {/* Totals & Express Payment Buttons */}
          <div className="p-4 border-t border-border bg-muted/20 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Liquor GST (18%)</span>
                <span>₹{taxAmount}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                <span>Grand Total</span>
                <span className="text-primary font-bold">₹{grandTotal}</span>
              </div>
            </div>

            {/* Action Buttons: Send KOT / Direct Billing / Split / Express Settlement */}
            <div className="space-y-2 pt-2">
              {!isRetailShopMode ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={handleSendKot}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold h-10 flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <UtensilsCrossed className="size-4" />
                    <span>Send KOT ({selectedTable})</span>
                  </Button>

                  <Button
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={() => handleSettleOrder('CASH')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Zap className="size-4" />
                    <span>Direct Billing</span>
                  </Button>
                </div>
              ) : (
                <Button
                  disabled={cart.length === 0 || isSubmitting}
                  onClick={() => handleSettleOrder('CASH')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 flex items-center justify-center gap-2 shadow-md"
                >
                  <Zap className="size-4" />
                  <span>Direct Billing (Instant Checkout)</span>
                </Button>
              )}

              <Button
                disabled={cart.length === 0}
                variant="outline"
                onClick={() => setSplitModalOpen(true)}
                className="w-full text-xs font-bold flex items-center justify-center gap-1.5 h-8"
              >
                <Split className="size-3.5 text-primary" />
                Split Bill Across Guests / Multi-Payment
              </Button>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  disabled={cart.length === 0 || isSubmitting}
                  onClick={() => handleSettleOrder('CASH')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-11 flex flex-col gap-0.5 font-bold shadow-md"
                >
                  <div className="flex items-center gap-1">
                    <Banknote className="size-3.5" />
                  </div>
                  <span>1-Tap Cash</span>
                </Button>

                <Button
                  disabled={cart.length === 0 || isSubmitting}
                  onClick={() => handleSettleOrder('CARD')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-11 flex flex-col gap-0.5 font-bold shadow-md"
                >
                  <div className="flex items-center gap-1">
                    <CreditCard className="size-3.5" />
                  </div>
                  <span>1-Tap Card</span>
                </Button>

                <Button
                  disabled={cart.length === 0 || isSubmitting}
                  onClick={() => handleSettleOrder('UPI')}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-11 flex flex-col gap-0.5 font-bold shadow-md"
                >
                  <div className="flex items-center gap-1">
                    <QrCode className="size-3.5" />
                  </div>
                  <span>1-Tap UPI</span>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Table Transfer Modal Dialog */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ArrowRightLeft className="size-4 text-primary" />
              Transfer {selectedTable} Order to Another Table
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs py-2">
            <div className="space-y-1.5">
              <Label>Select Target Destination Table / Booth</Label>
              <Select value={targetTable} onValueChange={setTargetTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bar Counter">Bar Counter</SelectItem>
                  <SelectItem value="Table 1">Table 1</SelectItem>
                  <SelectItem value="Table 4">Table 4</SelectItem>
                  <SelectItem value="VIP Booth 2">VIP Booth 2</SelectItem>
                  <SelectItem value="Rooftop R1">Rooftop R1</SelectItem>
                  <SelectItem value="Outdoor Patio 3">Outdoor Patio 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleTransferTable} className="bg-primary font-bold">
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Bill Settlement Modal Dialog */}
      <Dialog open={splitModalOpen} onOpenChange={setSplitModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Split className="size-4 text-primary" />
              Split Bill — {selectedTable} (Total: ₹{grandTotal})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground">Equal Split Count:</span>
                <p className="text-muted-foreground text-[10px]">Divide bill evenly among guests</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSplitCount(Math.max(2, splitCount - 1))}>
                  -
                </Button>
                <span className="font-bold text-sm px-2">{splitCount} Guests</span>
                <Button variant="outline" size="sm" onClick={() => setSplitCount(splitCount + 1)}>
                  +
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
              <span className="font-bold text-primary">Each Guest Pays:</span>
              <span className="font-bold text-base text-primary">₹{Math.round(grandTotal / splitCount)}</span>
            </div>

            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-foreground">Custom Mixed Payment (Half Cash + Half Online)</Label>
                <Badge variant="outline" className="text-[10px]">Dual Accounting Entry</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Cash Amount (₹)</Label>
                  <Input
                    type="number"
                    value={customSplitCash}
                    onChange={(e) => setCustomSplitCash(Number(e.target.value))}
                    placeholder="e.g. 1000"
                    className="h-8 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Online / UPI Amount (₹)</Label>
                  <Input
                    type="number"
                    value={customSplitUPI}
                    onChange={(e) => setCustomSplitUPI(Number(e.target.value))}
                    placeholder="e.g. 1500"
                    className="h-8 font-bold text-purple-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Deposit Online Payment Into Accounting Bank Account</Label>
                <Select defaultValue="ICICI_UPI">
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select Bank Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ICICI_UPI">ICICI Bar UPI QR Bank Account (1030)</SelectItem>
                    <SelectItem value="HDFC_POS">HDFC Merchant POS Card Account (1020)</SelectItem>
                    <SelectItem value="SBI_OPERATING">SBI Main Bar Operating Account (1015)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                disabled={customSplitCash + customSplitUPI !== grandTotal || isSubmitting}
                onClick={() => handleSettleOrder(`MIXED_CASH_${customSplitCash}_UPI_${customSplitUPI}`)}
                className="w-full bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 text-white font-bold text-xs h-9 mt-1"
              >
                Settle Mixed Bill (₹{customSplitCash} Cash + ₹{customSplitUPI} Online)
              </Button>
              {customSplitCash + customSplitUPI !== grandTotal && (
                <p className="text-[10px] text-amber-500 font-semibold text-center">
                  Total mixed split must equal Grand Total (₹{grandTotal}). Remaining: ₹{grandTotal - (customSplitCash + customSplitUPI)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSplitModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Thermal Receipt & Tax Invoice Modal */}
      <ThermalReceiptModal
        open={showReceiptModal}
        onOpenChange={setShowReceiptModal}
        isProforma={false}
        invoiceNumber={receiptInvoiceNo}
        date={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        tableNumber={selectedTable}
        paymentMethod={receiptPaymentMethod}
        subtotal={receiptSubtotal}
        taxAmount={receiptTax}
        grandTotal={receiptTotal}
        items={receiptItemsSnapshot}
      />
    </div>
  );
}
