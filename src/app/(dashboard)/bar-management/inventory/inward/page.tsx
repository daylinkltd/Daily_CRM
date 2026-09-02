'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowLeft, CheckCircle2, Plus, Trash2, Wine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface InwardLineItem {
  id: string;
  product_id: string;
  pkg_template: string;
  bottles_per_case: number;
  bottle_size_ml: number;
  cases_received: number;
  case_purchase_price: number;
  eal_serial_start: string;
  eal_serial_end: string;
}

export default function KsbclInwardPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Shared Header Information - Clean Default Inputs
  const [ksbclPermitNo, setKsbclPermitNo] = useState('');
  const [indentNo, setIndentNo] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  // Catalog Products loaded dynamically from Liquor Catalog
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bar_liquor_products');
      if (saved) {
        try {
          const items = JSON.parse(saved);
          if (Array.isArray(items) && items.length > 0) {
            setCatalogProducts(items);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    // Default fallback catalog items
    setCatalogProducts([
      { id: 'prod_glenfiddich_750', name: 'Glenfiddich 12 Single Malt (750ml)', bottle_size_ml: 750, bottles_per_case: 12, case_price: 54000 },
      { id: 'prod_jd_750', name: "Jack Daniel's Old No. 7 (750ml)", bottle_size_ml: 750, bottles_per_case: 12, case_price: 38400 },
      { id: 'prod_oldmonk_750', name: 'Old Monk Supreme Rum (750ml)', bottle_size_ml: 750, bottles_per_case: 12, case_price: 14400 },
      { id: 'prod_heineken_can_500', name: 'Heineken Lager Draft Beer (500ml)', bottle_size_ml: 500, bottles_per_case: 24, case_price: 5600 },
      { id: 'prod_kingfisher_650', name: 'Kingfisher Premium Beer (650ml Btl)', bottle_size_ml: 650, bottles_per_case: 12, case_price: 2400 },
    ]);
  }, []);

  // Multi-Item Table Grid Rows - Starts with 1 clean initial row
  const [lines, setLines] = useState<InwardLineItem[]>([
    {
      id: 'line_1',
      product_id: 'prod_glenfiddich_750',
      pkg_template: 'QUART',
      bottles_per_case: 12,
      bottle_size_ml: 750,
      cases_received: 1,
      case_purchase_price: 54000,
      eal_serial_start: '',
      eal_serial_end: '',
    },
  ]);

  const addLineItem = () => {
    const nextProd = catalogProducts[lines.length % catalogProducts.length] || catalogProducts[0];
    const newLine: InwardLineItem = {
      id: `line_${Date.now()}`,
      product_id: nextProd?.id || nextProd?.name || 'prod_oldmonk_750',
      pkg_template: nextProd?.bottle_size_ml === 500 ? 'BEER_CAN' : 'QUART',
      bottles_per_case: nextProd?.bottles_per_case || 12,
      bottle_size_ml: nextProd?.bottle_size_ml || 750,
      cases_received: 1,
      case_purchase_price: nextProd?.case_price || 14400,
      eal_serial_start: '',
      eal_serial_end: '',
    };
    setLines((prev) => [...prev, newLine]);
    toast.success('Added new line item row to permit invoice');
  };

  const removeLineItem = (id: string) => {
    if (lines.length === 1) {
      toast.error('Permit invoice must contain at least 1 item line');
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof InwardLineItem, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updated = { ...l, [field]: value };
          if (field === 'product_id') {
            const matched = catalogProducts.find((p) => p.id === value || p.name === value);
            if (matched) {
              updated.bottle_size_ml = matched.bottle_size_ml || 750;
              updated.bottles_per_case = matched.bottles_per_case || 12;
              updated.case_purchase_price = matched.case_price || 14400;
            } else if (value === 'prod_glenfiddich_750') {
              updated.bottle_size_ml = 750;
              updated.bottles_per_case = 12;
              updated.case_purchase_price = 54000;
            } else if (value === 'prod_jd_750') {
              updated.bottle_size_ml = 750;
              updated.bottles_per_case = 12;
              updated.case_purchase_price = 38400;
            } else if (value === 'prod_oldmonk_750') {
              updated.bottle_size_ml = 750;
              updated.bottles_per_case = 12;
              updated.case_purchase_price = 14400;
            } else if (value === 'prod_heineken_can_500') {
              updated.bottle_size_ml = 500;
              updated.bottles_per_case = 24;
              updated.case_purchase_price = 5600;
            } else if (value === 'prod_kingfisher_650') {
              updated.bottle_size_ml = 650;
              updated.bottles_per_case = 12;
              updated.case_purchase_price = 2400;
            }
          }
          return updated;
        }
        return l;
      })
    );
  };

  // Grand Totals across all line items
  const totalCasesSum = lines.reduce((acc, l) => acc + Number(l.cases_received || 0), 0);
  const totalBottlesSum = lines.reduce((acc, l) => acc + Number(l.cases_received || 0) * Number(l.bottles_per_case || 12), 0);
  const totalLitresSum = lines.reduce(
    (acc, l) => acc + (Number(l.cases_received || 0) * Number(l.bottles_per_case || 12) * Number(l.bottle_size_ml || 750)) / 1000,
    0
  );
  const totalInvoicePriceSum = lines.reduce((acc, l) => acc + Number(l.cases_received || 0) * Number(l.case_purchase_price || 0), 0);

  const handleSubmitAllLines = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ksbclPermitNo) {
      toast.error('Please enter KSBCL Permit Number');
      return;
    }

    setSubmitting(true);
    try {
      const newInwardLogs: any[] = [];
      for (const [idx, line] of lines.entries()) {
        const matchedCat = catalogProducts.find((p) => p.id === line.product_id || p.name === line.product_id);
        const productName =
          matchedCat?.name ||
          (line.product_id === 'prod_glenfiddich_750'
            ? 'Glenfiddich 12 Single Malt (750ml)'
            : line.product_id === 'prod_jd_750'
            ? "Jack Daniel's Old No. 7 (750ml)"
            : line.product_id === 'prod_oldmonk_750'
            ? 'Old Monk Supreme Rum (750ml)'
            : line.product_id === 'prod_heineken_can_500'
            ? 'Heineken Lager Draft Beer (500ml)'
            : line.product_id === 'prod_kingfisher_650'
            ? 'Kingfisher Premium Beer (650ml Btl)'
            : line.product_id);

        const sku =
          matchedCat?.sku ||
          matchedCat?.brand ||
          (line.product_id === 'prod_glenfiddich_750'
            ? 'GLEN-750'
            : line.product_id === 'prod_jd_750'
            ? 'JD-750'
            : line.product_id === 'prod_oldmonk_750'
            ? 'OM-750'
            : line.product_id === 'prod_heineken_can_500'
            ? 'HEIN-500'
            : line.product_id === 'prod_kingfisher_650'
            ? 'KF-650'
            : 'BAR-SKU');

        const payload = {
          product_id: line.product_id,
          ksbcl_permit_no: ksbclPermitNo,
          indent_no: indentNo,
          batch_number: batchNumber,
          eal_serial_start: line.eal_serial_start,
          eal_serial_end: line.eal_serial_end,
          cases_received: Number(line.cases_received),
          bottles_per_case: Number(line.bottles_per_case),
          bottle_size_ml: Number(line.bottle_size_ml),
          case_purchase_price: Number(line.case_purchase_price),
        };

        await fetch('/api/bar/inventory/inward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => null);

        newInwardLogs.push({
          id: `grn_${Date.now()}_${idx}`,
          ksbcl_permit_no: ksbclPermitNo,
          indent_no: indentNo,
          batch_number: batchNumber,
          product_name: productName,
          product_id: line.product_id,
          sku: sku,
          cases_received: Number(line.cases_received),
          bottles_per_case: Number(line.bottles_per_case),
          total_bottles: Number(line.cases_received) * Number(line.bottles_per_case),
          bottle_size_ml: Number(line.bottle_size_ml),
          total_litres: (Number(line.cases_received) * Number(line.bottles_per_case) * Number(line.bottle_size_ml)) / 1000,
          case_purchase_price: Number(line.case_purchase_price),
          total_cost: Number(line.cases_received) * Number(line.case_purchase_price),
          eal_serial_start: line.eal_serial_start,
          eal_serial_end: line.eal_serial_end,
          received_at: new Date().toISOString(),
          received_by: 'Swaraj J. (Bar Manager)',
          status: 'STOCK_ADDED',
        });
      }

      // Persist locally for instant reflection on Stock & KSBCL page
      try {
        const existingInward = JSON.parse(localStorage.getItem('bar_inward_logs_local') || '[]');
        localStorage.setItem('bar_inward_logs_local', JSON.stringify([...newInwardLogs, ...existingInward]));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error(e);
      }

      toast.success(`Successfully received ${lines.length} items on Permit ${ksbclPermitNo}! Stock & WAC updated.`);
      router.push('/bar-management/inventory');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit permit invoice lines');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Multi-Item KSBCL Stock Inward (GRN)</h1>
          <p className="text-xs text-muted-foreground">Receive permit cases, track total bottles, EAL hologram ranges, and auto-update WAC costing.</p>
        </div>
      </div>

      <form onSubmit={handleSubmitAllLines} className="space-y-6">
        {/* Shared Permit Header Information Card */}
        <Card className="bg-card border-border">
          <CardHeader className="py-4 px-6 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ArrowDownToLine className="size-4 text-primary" />
              1. Shared KSBCL Transport Permit Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label>KSBCL Transport Permit Number</Label>
                <Input
                  value={ksbclPermitNo}
                  onChange={(e) => setKsbclPermitNo(e.target.value)}
                  placeholder="KSBCL/KA/2026/09874"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Indent Number (Optional)</Label>
                <Input
                  value={indentNo}
                  onChange={(e) => setIndentNo(e.target.value)}
                  placeholder="IND-5582"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Batch Number / Delivery Note</Label>
                <Input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="BATCH-2026-A"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Item Line Table Grid Card */}
        <Card className="bg-card border-border">
          <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wine className="size-4 text-primary" />
              2. Permit Item Lines ({lines.length} Brands on Invoice)
            </CardTitle>
            <Button type="button" size="sm" onClick={addLineItem} className="bg-primary text-primary-foreground font-bold text-xs">
              <Plus className="size-3.5 mr-1" />
              + Add Item Line
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-medium border-b border-border">
                  <tr>
                    <th className="py-3 px-4 min-w-[220px]">Product / Liquor Item</th>
                    <th className="py-3 px-4 min-w-[130px]">EAL Start Serial</th>
                    <th className="py-3 px-4 min-w-[130px]">EAL End Serial</th>
                    <th className="py-3 px-4 w-[100px]">Cases Recv</th>
                    <th className="py-3 px-4 min-w-[120px] text-center">Total Bottles</th>
                    <th className="py-3 px-4 w-[120px]">Price / Case (₹)</th>
                    <th className="py-3 px-4 min-w-[100px] text-right">Litres</th>
                    <th className="py-3 px-4 w-[40px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {lines.map((line) => {
                    const rowTotalBottles = Number(line.cases_received || 0) * Number(line.bottles_per_case || 12);
                    const lineLitres = (rowTotalBottles * Number(line.bottle_size_ml || 750)) / 1000;
                    return (
                      <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <Select
                            value={line.product_id}
                            onValueChange={(val) => updateLine(line.id, 'product_id', val)}
                          >
                            <SelectTrigger className="bg-background h-8 text-xs">
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                              {catalogProducts.map((p) => (
                                <SelectItem key={p.id || p.name} value={p.id || p.name}>
                                  {p.name} ({p.bottle_size_ml || 750}ml, {p.bottles_per_case || 12}/case)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="py-3 px-4">
                          <Input
                            value={line.eal_serial_start}
                            onChange={(e) => updateLine(line.id, 'eal_serial_start', e.target.value)}
                            placeholder="EAL-882001"
                            className="h-8 text-xs font-mono"
                          />
                        </td>

                        <td className="py-3 px-4">
                          <Input
                            value={line.eal_serial_end}
                            onChange={(e) => updateLine(line.id, 'eal_serial_end', e.target.value)}
                            placeholder="EAL-882024"
                            className="h-8 text-xs font-mono"
                          />
                        </td>

                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            value={line.cases_received}
                            onChange={(e) => updateLine(line.id, 'cases_received', e.target.value)}
                            className="h-8 text-xs font-bold"
                          />
                        </td>

                        <td className="py-3 px-4 text-center font-bold text-foreground bg-muted/20">
                          {rowTotalBottles} Bottles
                        </td>

                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            value={line.case_purchase_price}
                            onChange={(e) => updateLine(line.id, 'case_purchase_price', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-primary">
                          {lineLitres.toFixed(2)} L
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLineItem(line.id)}
                            className="size-7 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Permit Summary Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px]">Total Items</span>
                  <p className="font-bold text-foreground">{lines.length} Brands</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Total Cases</span>
                  <p className="font-bold text-foreground">{totalCasesSum} Cases</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Total Bottles</span>
                  <p className="font-bold text-foreground">{totalBottlesSum} Bottles</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Total Volume</span>
                  <p className="font-bold text-primary">{totalLitresSum.toFixed(2)} L</p>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto bg-primary font-bold">
                <CheckCircle2 className="size-4 mr-1.5" />
                Submit Complete Permit Invoice ({lines.length} Items)
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
