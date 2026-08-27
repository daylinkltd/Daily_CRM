'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function DamageLogPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    product_id: '',
    damage_type: 'COUNTER_BREAKAGE',
    bottles_damaged: '1',
    volume_ml_damaged: '750',
    ksbcl_permit_no: '',
    reason: 'Accidental bottle slip behind the bar counter',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.volume_ml_damaged) {
      toast.error('Please enter product ID and damaged volume in ml');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_id: form.product_id,
        damage_type: form.damage_type,
        bottles_damaged: Number(form.bottles_damaged),
        volume_ml_damaged: Number(form.volume_ml_damaged),
        ksbcl_permit_no: form.ksbcl_permit_no,
        reason: form.reason,
      };

      const res = await fetch('/api/bar/inventory/damage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to log damage');
      }

      toast.success('Damage log created & stock deducted!');
      router.push('/bar-management/inventory');
    } catch (err: any) {
      toast.error(err?.message || 'Damage log submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Damage & Spillage Accounting</h1>
          <p className="text-xs text-muted-foreground">Log Transit Damage (KSBCL GRN allowance) or Counter Breakage with manager verification.</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="py-4 px-6 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-500">
            <AlertTriangle className="size-4" />
            Breakage Incident Form
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label>Product ID / Liquor SKU</Label>
              <Input
                value={form.product_id}
                onChange={(e) => handleChange('product_id', e.target.value)}
                placeholder="e.g. prod_whisky_750"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Damage Classification</Label>
              <Select value={form.damage_type} onValueChange={(v) => handleChange('damage_type', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select damage type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSIT_DAMAGE">TRANSIT DAMAGE (KSBCL Delivery Claim)</SelectItem>
                  <SelectItem value="COUNTER_BREAKAGE">COUNTER BREAKAGE (Bar Drop Write-off)</SelectItem>
                  <SelectItem value="EXPIRED_BEER">EXPIRED BEER / KEG DRAIN</SelectItem>
                  <SelectItem value="CORKAGE_SPOILAGE">CORKAGE SPOILAGE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Bottles Damaged</Label>
                <Input
                  type="number"
                  value={form.bottles_damaged}
                  onChange={(e) => handleChange('bottles_damaged', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Volume Damaged (ML)</Label>
                <Input
                  type="number"
                  value={form.volume_ml_damaged}
                  onChange={(e) => handleChange('volume_ml_damaged', e.target.value)}
                  required
                />
              </div>
            </div>

            {form.damage_type === 'TRANSIT_DAMAGE' && (
              <div className="space-y-1.5">
                <Label>KSBCL GRN Permit Number (Required for Transit Allowance)</Label>
                <Input
                  value={form.ksbcl_permit_no}
                  onChange={(e) => handleChange('ksbcl_permit_no', e.target.value)}
                  placeholder="KSBCL/PERMIT/2026/09874"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Incident Reason / Manager Notes</Label>
              <Input
                value={form.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold mt-4">
              <CheckCircle2 className="size-4 mr-1.5" />
              Log Incident & Deduct Stock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
