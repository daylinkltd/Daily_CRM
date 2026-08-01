"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { createClient } from "@/lib/supabase/client";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import {
  Landmark,
  FileText,
  Save,
  Loader2,
  Receipt,
  Percent,
  CalendarDays
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AccountingSettingsPanel() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [financialYearStartMonth, setFinancialYearStartMonth] = useState("4"); // April
  const [defaultGstRate, setDefaultGstRate] = useState(18);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [receiptPrefix, setReceiptPrefix] = useState("RCT-");
  const [voucherPrefix, setVoucherPrefix] = useState("VCH-");
  const [enableCreditLimitCheck, setEnableCreditLimitCheck] = useState(true);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("workspaces")
        .select("plan_limits")
        .eq("id", activeWorkspace.id)
        .maybeSingle();

      if (data?.plan_limits?.accounting_settings) {
        const acc = data.plan_limits.accounting_settings;
        setFinancialYearStartMonth(acc.financialYearStartMonth || "4");
        setDefaultGstRate(acc.defaultGstRate ?? 18);
        setPricesIncludeTax(acc.pricesIncludeTax ?? false);
        setInvoicePrefix(acc.invoicePrefix || "INV-");
        setReceiptPrefix(acc.receiptPrefix || "RCT-");
        setVoucherPrefix(acc.voucherPrefix || "VCH-");
        setEnableCreditLimitCheck(acc.enableCreditLimitCheck ?? true);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [activeWorkspace?.id, supabase]);

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    setSaving(true);

    try {
      const { data: currentWs } = await supabase
        .from("workspaces")
        .select("plan_limits")
        .eq("id", activeWorkspace.id)
        .single();

      const existingLimits = currentWs?.plan_limits || {};
      const updatedLimits = {
        ...existingLimits,
        accounting_settings: {
          financialYearStartMonth,
          defaultGstRate,
          pricesIncludeTax,
          invoicePrefix,
          receiptPrefix,
          voucherPrefix,
          enableCreditLimitCheck,
          updated_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from("workspaces")
        .update({ plan_limits: updatedLimits })
        .eq("id", activeWorkspace.id);

      if (error) throw error;
      toast.success("Accounting & Financial settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save accounting settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading Accounting Settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl text-foreground">
      <SettingsPanelHead
        title="Accounting & Ledger Settings"
        description="Configure financial year boundaries, GST defaults, voucher numbering, and customer credit limits."
        action={
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 shadow-xs"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Changes
          </Button>
        }
      />

      {/* 1. Financial Year & Tax Defaults */}
      <Card className="bg-card border-border shadow-xs rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Landmark className="size-4 text-primary" /> Financial Year & GST Configuration
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Set accounting period boundaries and default tax computation rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Financial Year Start Month</Label>
              <select
                value={financialYearStartMonth}
                onChange={(e) => setFinancialYearStartMonth(e.target.value)}
                className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary"
              >
                <option value="1">January (Calendar Year)</option>
                <option value="4">April (April to March - India / UK)</option>
                <option value="7">July (July to June)</option>
                <option value="10">October (October to September)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default GST Rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={defaultGstRate}
                onChange={(e) => setDefaultGstRate(Number(e.target.value))}
                className="bg-background text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Prices Include Tax (Tax Inclusive)</Label>
              <p className="text-[11px] text-muted-foreground">When enabled, product prices listed in ledgers already include GST/sales tax.</p>
            </div>
            <Switch
              checked={pricesIncludeTax}
              onCheckedChange={setPricesIncludeTax}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Enforce Customer Credit Limits</Label>
              <p className="text-[11px] text-muted-foreground">Warn or block new sales entries when customer outstanding balance exceeds credit limit.</p>
            </div>
            <Switch
              checked={enableCreditLimitCheck}
              onCheckedChange={setEnableCreditLimitCheck}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Document & Voucher Prefixes */}
      <Card className="bg-card border-border shadow-xs rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Receipt className="size-4 text-emerald-500" /> Voucher & Document Prefixes
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Customize auto-generated document numbers for Accounting vouchers and invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Invoice Prefix</Label>
              <Input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="bg-background text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Receipt Prefix</Label>
              <Input
                type="text"
                value={receiptPrefix}
                onChange={(e) => setReceiptPrefix(e.target.value)}
                className="bg-background text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Voucher Prefix</Label>
              <Input
                type="text"
                value={voucherPrefix}
                onChange={(e) => setVoucherPrefix(e.target.value)}
                className="bg-background text-xs font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
