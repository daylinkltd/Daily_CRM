"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Check, Landmark, Plus, Trash2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";

export const INDUSTRY_TEMPLATES = [
  { id: "GENERAL_RETAIL", label: "General Retail Store", icon: "", desc: "Standard retail catalog, POS billing, and GST tax management." },
  { id: "GROCERY", label: "Supermarket & Grocery", icon: "", desc: "Pack size, Net/Gross Weight, Storage temp, Best Before, Organic, FEFO expiry." },
  { id: "PHARMACY", label: "Chemist & Pharmacy", icon: "", desc: "Salt Composition, Dosage Form, Strength, Schedule H/H1, Mfg License, Expiry alerts." },
  { id: "GARMENT", label: "Apparel & Garment Store", icon: "", desc: "Size, Color, Fabric, Fit, Gender, Season, Sleeve, Neck, Pattern, Collection, Style Code." },
  { id: "FOOTWEAR", label: "Footwear Showroom", icon: "", desc: "Shoe Size, Material, Color, Heel Height, Sole Material, Closure Type, Waterproof." },
  { id: "ELECTRONICS", label: "Electronics & Mobile Shop", icon: "", desc: "Model #, Processor, RAM, Storage, Display Size, Battery, Serial/IMEI, Warranty." },
  { id: "JEWELLERY", label: "Jewellery & Bullion", icon: "", desc: "Karat Purity, Net/Gross/Stone Weight, Making Charges, Wastage %, Hallmark #, Certification." },
  { id: "HARDWARE", label: "Hardware & Building Material", icon: "", desc: "Material Grade, Dimensions, Length/Width/Diameter, Coating, Standard." },
  { id: "FURNITURE", label: "Furniture Showroom", icon: "", desc: "Dimensions, Wood/Material Type, Color, Finish, Weight Capacity, Room Type." },
  { id: "AUTOMOBILE", label: "Automobile & Spare Parts", icon: "", desc: "OEM Part #, Vehicle Fitment, Engine Type, Model Year, Fuel Type, Position." },
  { id: "BOOKS_STATIONERY", label: "Books & Stationery", icon: "", desc: "ISBN, Author, Publisher, Edition, Language, Genre, Binding Type, Pages." },
  { id: "RESTAURANT", label: "Restaurant & QSR", icon: "", desc: "Veg/Non-Veg/Jain, Spicy Level, KOT Station, Prep Time, Recipe Code, Calories." },
  { id: "MANUFACTURING", label: "Manufacturing & Production", icon: "", desc: "BOM Reference, Routing, Work Center, Yield %, Scrap %, QC Required, Revision." },
  { id: "OPTICAL", label: "Optical & Eyewear Store", icon: "", desc: "Frame Size, Lens Type, Spher/Cyl Power, Axis, PD, Lens/Frame Brand, UV Protection." },
  { id: "COSMETICS", label: "Cosmetics & Beauty", icon: "", desc: "Shade, Skin Type, Hair Type, SPF Rating, Volume (ml), Cruelty Free, Organic." },
  { id: "PET_STORE", label: "Pet Store & Supplies", icon: "", desc: "Pet Type (Dog/Cat), Breed, Age Group, Flavor, Weight, Prescription Food." },
  { id: "CHEMICAL_PAINT", label: "Chemicals & Paint Store", icon: "", desc: "Hazard Class, UN Number, Flash Point, Viscosity, Color Code, Safety Sheet (MSDS)." },
  { id: "AGRICULTURE", label: "Agriculture & Farming", icon: "", desc: "Seed Variety, Crop, Season, Fertilizer Grade, Pesticide Type, License #." },
  { id: "BABY_PRODUCTS", label: "Baby & Infant Products", icon: "", desc: "Age Group (Months), Material, Safety Standard, BPA Free, Non-Toxic." },
  { id: "HANDCRAFTED_GIFTS", label: "Handcrafted & Handmade Gift Shop", icon: "", desc: "Artisan/Maker Name, Handcrafting Lead Days, Personalization Notes, Gift Box Type, Sustainable/Eco-Friendly." },
  { id: "EVENT_BULK_GIFTS", label: "Wedding & Corporate Bulk Return Gifts", icon: "", desc: "Target Event (Wedding/Corporate), Minimum Order Qty (MOQ), Tiered Bulk Rates, Custom Branding Card, Sample Lead Time." },
];

const DEFAULT_ACCOUNTS = [
  { id: "1", name: "HDFC Bank Primary", vpa: "store@hdfc" },
  { id: "2", name: "ICICI Bank Current", vpa: "store@icici" },
  { id: "3", name: "SBI Business Account", vpa: "store@sbi" },
  { id: "4", name: "Store Static QR Code", vpa: "merchant@paytm" }
];

export default function RetailSettingsPage() {
  const { activeWorkspace } = useWorkspace();
  const [selectedTemplate, setSelectedTemplate] = useState("GENERAL_RETAIL");
  const [saving, setSaving] = useState(false);

  // Bank Accounts state
  const [accounts, setAccounts] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newVpa, setNewVpa] = useState("");

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const saved = localStorage.getItem(`retail_template_${activeWorkspace.id}`);
    if (saved) {
      setSelectedTemplate(saved);
    }

    const savedAccounts = localStorage.getItem(`retail_bank_accounts_${activeWorkspace.id}`);
    if (savedAccounts) {
      setAccounts(JSON.parse(savedAccounts));
    } else {
      setAccounts(DEFAULT_ACCOUNTS);
      localStorage.setItem(`retail_bank_accounts_${activeWorkspace.id}`, JSON.stringify(DEFAULT_ACCOUNTS));
    }
  }, [activeWorkspace?.id]);

  const handleApplyTemplate = async (templateId: string) => {
    if (!activeWorkspace?.id) return;
    setSaving(true);
    try {
      setSelectedTemplate(templateId);
      localStorage.setItem(`retail_template_${activeWorkspace.id}`, templateId);
      localStorage.setItem('retail_template_active', templateId);
      toast.success(`Workspace Industry Template set to "${templateId}"!`);
    } catch {
      toast.error("Failed to apply preset");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAccount = () => {
    if (!newName.trim() || !newVpa.trim()) {
      toast.error("Account Name and UPI VPA/ID are required");
      return;
    }
    const newAcc = {
      id: Date.now().toString(),
      name: newName.trim(),
      vpa: newVpa.trim()
    };
    const updated = [...accounts, newAcc];
    setAccounts(updated);
    if (activeWorkspace?.id) {
      localStorage.setItem(`retail_bank_accounts_${activeWorkspace.id}`, JSON.stringify(updated));
    }
    setNewName("");
    setNewVpa("");
    toast.success(`Added bank account "${newAcc.name}"`);
  };

  const handleRemoveAccount = (id: string) => {
    const updated = accounts.filter(acc => acc.id !== id);
    setAccounts(updated);
    if (activeWorkspace?.id) {
      localStorage.setItem(`retail_bank_accounts_${activeWorkspace.id}`, JSON.stringify(updated));
    }
    toast.success("Account removed");
  };

  return (
    <section className="space-y-6 max-w-5xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Retail & Industry Presets"
        description="Set your workspace industry template and configure active UPI bank accounts for POS terminal payments."
      />

      {/* Active Template Status Card */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Active Workspace Industry Template</div>
          <div className="text-lg font-extrabold text-primary mt-0.5">{selectedTemplate}</div>
        </div>
        <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-xl font-bold">
          System Active
        </span>
      </div>

      {/* Dynamic Bank Accounts / UPI configuration */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Landmark className="size-4 text-primary" />
          UPI Bank Accounts & Destination Handles
        </h2>
        <p className="text-xs text-muted-foreground">
          Configure bank accounts and UPI VPA handles to route UPI and Split payments directly in the POS Checkout panel.
        </p>

        {/* List of accounts */}
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border/60">
              <div className="flex items-center gap-3">
                <QrCode className="size-4 text-primary" />
                <div>
                  <div className="text-xs font-bold text-foreground">{acc.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{acc.vpa}</div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveAccount(acc.id)}
                className="text-destructive hover:text-destructive/80 p-1.5 rounded-lg hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Account form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Account Name</Label>
            <Input
              type="text"
              placeholder="e.g. HDFC Bank Primary"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">UPI ID / VPA Handle</Label>
            <Input
              type="text"
              placeholder="e.g. store@hdfc"
              value={newVpa}
              onChange={(e) => setNewVpa(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAddAccount}
              className="w-full h-9 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <Plus className="size-3.5" />
              Add UPI Handle
            </Button>
          </div>
        </div>
      </div>

      {/* 1-Click Industry Presets Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Select Business Industry Preset (19 Enterprise Templates Supported)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INDUSTRY_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplate === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => handleApplyTemplate(tmpl.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card/50 border-border hover:border-border/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground text-sm">{tmpl.label}</h3>
                    {isSelected && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{tmpl.desc}</p>
                </div>
                <Button
                  size="sm"
                  disabled={saving || isSelected}
                  className={`w-full rounded-xl text-xs font-bold ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                  }`}
                >
                  {isSelected ? "Active Master Template" : "Set As Master Template"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
