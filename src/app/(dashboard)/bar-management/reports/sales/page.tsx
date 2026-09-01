'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar as CalendarIcon,
  Download,
  Printer,
  Search,
  TrendingUp,
  UtensilsCrossed,
  Wine,
  Filter,
  DollarSign,
  ArrowUpRight,
  ReceiptText,
  CalendarDays,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ItemSalesRow {
  id: string;
  name: string;
  category: string;
  type: 'FOOD' | 'DRINK';
  portion: string;
  unitPrice: number;
  qtySold: number;
  totalRevenue: number;
  pctContribution: number;
}

interface DailySalesSummaryRow {
  date: string;
  dayOfWeek: string;
  orderCount: number;
  foodRevenue: number;
  drinkRevenue: number;
  gstTax: number;
  cashRevenue: number;
  cardRevenue: number;
  upiRevenue: number;
  totalRevenue: number;
}

export default function DishAndLiquorSalesReportPage() {
  const [activeTab, setActiveTab] = useState<'DISH' | 'DAILY'>('DISH');

  // Calendar Date State
  const [datePreset, setDatePreset] = useState('TODAY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Itemized Dish Sales Data with LocalStorage Sync
  const [salesData, setSalesData] = useState<ItemSalesRow[]>([
    { id: '1', name: 'Butter Chicken Murgh Khas', category: 'MAIN_COURSE', type: 'FOOD', portion: 'FULL', unitPrice: 380, qtySold: 64, totalRevenue: 24320, pctContribution: 16.4 },
    { id: '2', name: 'Glenfiddich 12 Single Malt', category: 'WHISKY', type: 'DRINK', portion: '60ML', unitPrice: 850, qtySold: 26, totalRevenue: 22100, pctContribution: 14.9 },
    { id: '3', name: 'Paneer Tikka Tandoori', category: 'STARTERS', type: 'FOOD', portion: 'FULL', unitPrice: 280, qtySold: 52, totalRevenue: 14560, pctContribution: 9.8 },
    { id: '4', name: 'Heineken Lager Draft Pint', category: 'BEER', type: 'DRINK', portion: 'PINT', unitPrice: 340, qtySold: 42, totalRevenue: 14280, pctContribution: 9.6 },
    { id: '5', name: 'Jack Daniel\'s Old No. 7', category: 'WHISKY', type: 'DRINK', portion: '60ML', unitPrice: 600, qtySold: 22, totalRevenue: 13200, pctContribution: 8.9 },
    { id: '6', name: 'Chilli Chicken Dry', category: 'STARTERS', type: 'FOOD', portion: 'PORTION', unitPrice: 310, qtySold: 38, totalRevenue: 11780, pctContribution: 7.9 },
    { id: '7', name: 'Absolut Swedish Vodka', category: 'VODKA', type: 'DRINK', portion: 'BOTTLE', unitPrice: 4600, qtySold: 2, totalRevenue: 9200, pctContribution: 6.2 },
    { id: '8', name: 'Tandoori Butter Naan', category: 'MAIN_COURSE', type: 'FOOD', portion: 'PIECE', unitPrice: 60, qtySold: 140, totalRevenue: 8400, pctContribution: 5.7 },
    { id: '9', name: 'Long Island Iced Tea (LIIT)', category: 'COCKTAIL', type: 'DRINK', portion: 'GLASS', unitPrice: 580, qtySold: 14, totalRevenue: 8120, pctContribution: 5.5 },
    { id: '10', name: 'Crispy Salt & Pepper Mushrooms', category: 'STARTERS', type: 'FOOD', portion: 'PORTION', unitPrice: 240, qtySold: 32, totalRevenue: 7680, pctContribution: 5.2 },
    { id: '11', name: 'Old Monk Supreme Rum', category: 'RUM', type: 'DRINK', portion: '60ML', unitPrice: 280, qtySold: 24, totalRevenue: 6720, pctContribution: 4.5 },
    { id: '12', name: 'French Fries Peri Peri', category: 'STARTERS', type: 'FOOD', portion: 'PORTION', unitPrice: 160, qtySold: 51, totalRevenue: 8160, pctContribution: 5.4 },
  ]);

  // Calendar Day-Wise Sales Summary Data
  const [dailySalesData, setDailySalesData] = useState<DailySalesSummaryRow[]>([
    { date: '2026-09-01', dayOfWeek: 'Tuesday', orderCount: 52, foodRevenue: 74900, drinkRevenue: 73620, gstTax: 26733, cashRevenue: 45000, cardRevenue: 62000, upiRevenue: 41520, totalRevenue: 148520 },
    { date: '2026-08-31', dayOfWeek: 'Monday', orderCount: 41, foodRevenue: 58200, drinkRevenue: 61400, gstTax: 21528, cashRevenue: 34000, cardRevenue: 51000, upiRevenue: 34600, totalRevenue: 119600 },
    { date: '2026-08-30', dayOfWeek: 'Sunday', orderCount: 68, foodRevenue: 98400, drinkRevenue: 112000, gstTax: 37872, cashRevenue: 62000, cardRevenue: 94000, upiRevenue: 54400, totalRevenue: 210400 },
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ledger: any[] = JSON.parse(localStorage.getItem('bar_completed_sales_ledger') || '[]');
      if (ledger.length > 0) {
        // Build map of itemized sales from completed transactions
        const itemMap: Record<string, { name: string; category: string; type: 'FOOD' | 'DRINK'; portion: string; unitPrice: number; qtySold: number; totalRevenue: number }> = {};

        ledger.forEach((tx) => {
          (tx.items || []).forEach((i: any) => {
            const key = `${i.name}_${i.portion}`;
            if (!itemMap[key]) {
              itemMap[key] = {
                name: i.name,
                category: i.category || (i.type === 'DRINK' ? 'BEVERAGES' : 'STARTERS'),
                type: i.type || (i.portion === '60ML' || i.portion === '30ML' || i.portion === 'BOTTLE' || i.portion === 'PINT' ? 'DRINK' : 'FOOD'),
                portion: i.portion || 'PORTION',
                unitPrice: Number(i.unitPrice || 0),
                qtySold: 0,
                totalRevenue: 0,
              };
            }
            itemMap[key].qtySold += Number(i.qty || 1);
            itemMap[key].totalRevenue += Number(i.totalPrice || (i.unitPrice * i.qty));
          });
        });

        // Merge into salesData
        setSalesData((prev) => {
          const updated = [...prev];
          Object.values(itemMap).forEach((item) => {
            const existingIdx = updated.findIndex((r) => r.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(r.name.toLowerCase()));
            if (existingIdx >= 0) {
              updated[existingIdx] = {
                ...updated[existingIdx],
                qtySold: updated[existingIdx].qtySold + item.qtySold,
                totalRevenue: updated[existingIdx].totalRevenue + item.totalRevenue,
              };
            } else {
              updated.unshift({
                id: `sales_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: item.name,
                category: item.category,
                type: item.type,
                portion: item.portion,
                unitPrice: item.unitPrice,
                qtySold: item.qtySold,
                totalRevenue: item.totalRevenue,
                pctContribution: 5.0,
              });
            }
          });

          // Recalculate % contribution
          const grandTotalRev = updated.reduce((sum, r) => sum + r.totalRevenue, 0) || 1;
          return updated.map((r) => ({
            ...r,
            pctContribution: Number(((r.totalRevenue / grandTotalRev) * 100).toFixed(1)),
          }));
        });
      }
    }
  }, []);

  const handleDatePresetChange = (val: string) => {
    setDatePreset(val);
    const todayStr = new Date().toISOString().split('T')[0];
    if (val === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (val === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (val === 'WEEK') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(w.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (val === 'MONTH') {
      const m = new Date();
      m.setDate(1);
      setStartDate(m.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const filteredDishSales = salesData.filter((item) => {
    const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesCategory && matchesSearch;
  });

  const totalSalesRevenue = filteredDishSales.reduce((sum, item) => sum + item.totalRevenue, 0);
  const totalUnitsSold = filteredDishSales.reduce((sum, item) => sum + item.qtySold, 0);
  const totalFoodRevenue = salesData.filter((i) => i.type === 'FOOD').reduce((sum, i) => sum + i.totalRevenue, 0);
  const totalDrinkRevenue = salesData.filter((i) => i.type === 'DRINK').reduce((sum, i) => sum + i.totalRevenue, 0);

  const handleExportCsv = () => {
    toast.success(`Downloading ${activeTab === 'DISH' ? 'Dish Sales' : 'Daily Day-Wise Sales'} Report (CSV)...`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            Restaurant & Bar Sales Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Calendar day-wise revenue summary and itemized dish sales performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="text-xs font-semibold">
            <Download className="size-4 mr-1.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint} className="text-xs font-bold bg-primary">
            <Printer className="size-4 mr-1.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Total Period Sales</span>
            <div className="text-2xl font-bold text-emerald-500 mt-1">₹{totalSalesRevenue.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUpRight className="size-3 text-emerald-500" />
              {startDate} to {endDate}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Total Items / Dishes Sold</span>
            <div className="text-2xl font-bold text-foreground mt-1">{totalUnitsSold} units</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">Quantity dispatched</span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
              Food Sales
              <UtensilsCrossed className="size-3.5 text-emerald-500" />
            </span>
            <div className="text-2xl font-bold text-foreground mt-1">₹{totalFoodRevenue.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">
              {Math.round((totalFoodRevenue / (totalSalesRevenue || 1)) * 100)}% of total sales
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
              Liquor Sales
              <Wine className="size-3.5 text-purple-500" />
            </span>
            <div className="text-2xl font-bold text-foreground mt-1">₹{totalDrinkRevenue.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">
              {Math.round((totalDrinkRevenue / (totalSalesRevenue || 1)) * 100)}% of total sales
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Date Picker & View Selector Bar */}
      <div className="p-4 bg-card border border-border rounded-lg shadow-xs space-y-4">
        {/* View Mode Toggle Buttons */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'DISH' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('DISH')}
              className="text-xs font-bold"
            >
              <UtensilsCrossed className="size-3.5 mr-1.5" />
              Itemized Dish Sales
            </Button>

            <Button
              variant={activeTab === 'DAILY' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('DAILY')}
              className="text-xs font-bold"
            >
              <CalendarDays className="size-3.5 mr-1.5" />
              Daily Day-by-Day Sales
            </Button>
          </div>

          <Badge variant="secondary" className="text-[10px]">
            {activeTab === 'DISH' ? 'Dish & Drink Breakdown' : 'Calendar Day-Wise Revenue'}
          </Badge>
        </div>

        {/* Date Range & Calendar Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Preset */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Range:</span>
              <Select value={datePreset} onValueChange={handleDatePresetChange}>
                <SelectTrigger className="w-[130px] bg-background text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAY">Today</SelectItem>
                  <SelectItem value="YESTERDAY">Yesterday</SelectItem>
                  <SelectItem value="WEEK">Last 7 Days</SelectItem>
                  <SelectItem value="MONTH">This Month</SelectItem>
                  <SelectItem value="CUSTOM">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calendar Date Inputs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">From:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('CUSTOM');
                  }}
                  className="bg-background text-xs h-9 font-mono w-[135px]"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('CUSTOM');
                  }}
                  className="bg-background text-xs h-9 font-mono w-[135px]"
                />
              </div>
            </div>

            {/* Department Filter (Only for Dish Tab) */}
            {activeTab === 'DISH' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Type:</span>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[130px] bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Items</SelectItem>
                    <SelectItem value="FOOD">Food Dishes</SelectItem>
                    <SelectItem value="DRINK">Liquor Drinks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dish name, category, date..."
              className="pl-9 bg-background text-xs h-9"
            />
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: Itemized Dish Sales Table */}
      {activeTab === 'DISH' && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Itemized Dish & Drink Performance ({filteredDishSales.length} items)</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Period Revenue: ₹{totalSalesRevenue.toLocaleString('en-IN')}
              </Badge>
            </CardTitle>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-3 px-4">ITEM / DISH NAME</th>
                  <th className="py-3 px-4">DEPARTMENT</th>
                  <th className="py-3 px-4">CATEGORY</th>
                  <th className="py-3 px-4">PORTION</th>
                  <th className="py-3 px-4 text-right">UNIT PRICE</th>
                  <th className="py-3 px-4 text-center">QTY SOLD</th>
                  <th className="py-3 px-4 text-right">TOTAL REVENUE</th>
                  <th className="py-3 px-4 text-right">% CONTRIBUTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredDishSales.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        {item.type === 'FOOD' ? (
                          <span className="size-2 rounded-full bg-emerald-500 shrink-0" title="Food" />
                        ) : (
                          <span className="size-2 rounded-full bg-purple-500 shrink-0" title="Liquor" />
                        )}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={item.type === 'FOOD' ? 'default' : 'secondary'} className="text-[10px]">
                        {item.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{item.category.replace('_', ' ')}</td>
                    <td className="py-3 px-4 font-mono text-[11px] font-semibold">{item.portion}</td>
                    <td className="py-3 px-4 text-right font-mono">₹{item.unitPrice}</td>
                    <td className="py-3 px-4 text-center font-bold text-foreground text-sm font-mono">
                      {item.qtySold}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-500 font-mono text-sm">
                      ₹{item.totalRevenue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {item.pctContribution}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* VIEW MODE 2: Daily Day-by-Day Sales Report Table */}
      {activeTab === 'DAILY' && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Calendar Day-Wise Sales Summary</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Total Orders: {dailySalesData.reduce((acc, d) => acc + d.orderCount, 0)} bills
              </Badge>
            </CardTitle>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-3 px-4">CALENDAR DATE</th>
                  <th className="py-3 px-4">DAY OF WEEK</th>
                  <th className="py-3 px-4 text-center">BILLS / ORDERS</th>
                  <th className="py-3 px-4 text-right">FOOD SALES</th>
                  <th className="py-3 px-4 text-right">LIQUOR SALES</th>
                  <th className="py-3 px-4 text-right">GST TAX (18%)</th>
                  <th className="py-3 px-4 text-right">PAYMENT SPLIT (CASH / CARD / UPI)</th>
                  <th className="py-3 px-4 text-right">NET DAILY REVENUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {dailySalesData.map((row) => (
                  <tr key={row.date} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground font-mono">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px]">{row.dayOfWeek}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono">{row.orderCount}</td>
                    <td className="py-3 px-4 text-right font-mono">₹{row.foodRevenue.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-mono">₹{row.drinkRevenue.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">₹{row.gstTax.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right text-[11px]">
                      <span className="text-emerald-500 font-mono">₹{(row.cashRevenue / 1000).toFixed(0)}k Cash</span> ·{' '}
                      <span className="text-blue-500 font-mono">₹{(row.cardRevenue / 1000).toFixed(0)}k Card</span> ·{' '}
                      <span className="text-purple-500 font-mono">₹{(row.upiRevenue / 1000).toFixed(0)}k UPI</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-500 font-mono text-sm">
                      ₹{row.totalRevenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
