"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Package,
  X,
  Printer,
  Tag,
  Barcode as BarcodeIcon,
  ShieldCheck,
  Banknote,
  Warehouse,
  Sliders,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
  Hash,
  Layers,
  MapPin,
  FileText,
  Calendar,
  Percent,
  Edit3 as Pencil,
} from "lucide-react";

export interface ProductDetails {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  alias_name?: string;
  manufacturer_name?: string;
  department_name?: string;
  brand_name?: string;
  category_name?: string;
  sub_category_name?: string;
  preferred_supplier?: string;
  product_status?: string;
  hsn_sac_code?: string;
  base_unit?: string;
  purchase_unit?: string;
  unit_conversion_factor?: number;
  purchase_price?: number;
  selling_price: number;
  wholesale_rate?: number;
  distributor_rate?: number;
  online_rate?: number;
  mrp?: number;
  min_selling_price?: number;
  tax_rate?: number;
  cess_rate?: number;
  is_tax_inclusive?: boolean;
  initial_stock?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  shelf_number?: string;
  bin_location?: string;
  allow_negative_stock?: boolean;
  track_batch?: boolean;
  track_serial?: boolean;
  track_expiry?: boolean;
  attributes?: Record<string, any>;
  category?: { name: string };
  created_at?: string;
}

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDetails | null;
  onPrintTag?: (product: ProductDetails) => void;
  onEdit?: (product: ProductDetails) => void;
}

export function ProductDetailsModal({
  isOpen,
  onClose,
  product,
  onPrintTag,
  onEdit,
}: ProductDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "PRICING" | "STOCK" | "TAX" | "ATTRIBUTES"
  >("OVERVIEW");

  if (!isOpen || !product) return null;

  const sellingPrice = Number(product.selling_price || 0);
  const purchasePrice = Number(product.purchase_price || 0);
  const mrp = Number(product.mrp || sellingPrice);
  const marginAmt = sellingPrice - purchasePrice;
  const marginPct = sellingPrice > 0 ? (marginAmt / sellingPrice) * 100 : 0;
  const markupPct = purchasePrice > 0 ? (marginAmt / purchasePrice) * 100 : 0;

  const attributes = product.attributes || {};
  const industryTemplate = attributes.industry_template || "DEFAULT";

  // Filter out internal attributes if any
  const customUserFields = attributes.custom_user_fields || {};
  const attributeEntries = Object.entries(attributes).filter(
    ([key]) => key !== "industry_template" && key !== "custom_user_fields"
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8 text-foreground relative">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#00aef0]/10 text-[#00aef0] px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Product Details
              </span>
              {industryTemplate !== "DEFAULT" && (
                <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Template: {industryTemplate}
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  product.product_status === "INACTIVE"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {product.product_status || "ACTIVE"}
              </span>
            </div>

            <h2 className="text-2xl font-extrabold text-foreground tracking-tight mt-1">
              {product.name}
            </h2>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap font-mono pt-1">
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" /> SKU:{" "}
                <strong className="text-foreground">{product.sku}</strong>
              </span>
              {product.barcode && (
                <span className="flex items-center gap-1 text-[#00aef0]">
                  <BarcodeIcon className="h-3.5 w-3.5" /> Barcode:{" "}
                  <strong className="text-[#00aef0]">{product.barcode}</strong>
                </span>
              )}
              {product.hsn_sac_code && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" /> HSN/SAC:{" "}
                  <strong className="text-foreground">{product.hsn_sac_code}</strong>
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-background/80 p-3.5 rounded-2xl border border-border space-y-1">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
              Selling Price
            </span>
            <span className="text-xl font-extrabold text-[#00aef0] block">
              ₹{sellingPrice.toFixed(2)}
            </span>
            {mrp > sellingPrice && (
              <span className="text-[11px] text-muted-foreground line-through block">
                MRP: ₹{mrp.toFixed(2)}
              </span>
            )}
          </div>

          <div className="bg-background/80 p-3.5 rounded-2xl border border-border space-y-1">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
              Purchase Price
            </span>
            <span className="text-xl font-extrabold text-foreground block">
              ₹{purchasePrice.toFixed(2)}
            </span>
            {marginPct > 0 && (
              <span className="text-[11px] text-emerald-400 font-medium block">
                +{marginPct.toFixed(1)}% Margin
              </span>
            )}
          </div>

          <div className="bg-background/80 p-3.5 rounded-2xl border border-border space-y-1">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
              GST Tax Rate
            </span>
            <span className="text-xl font-extrabold text-purple-400 block">
              {product.tax_rate || 0}%
            </span>
            <span className="text-[11px] text-muted-foreground block">
              {product.is_tax_inclusive ? "Tax Inclusive" : "Tax Exclusive"}
            </span>
          </div>

          <div className="bg-background/80 p-3.5 rounded-2xl border border-border space-y-1">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
              Stock & Unit
            </span>
            <span className="text-xl font-extrabold text-amber-400 block">
              {product.initial_stock || 0} {product.base_unit || "PCS"}
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Min Reorder: {product.reorder_level || 10}
            </span>
          </div>
        </div>

        {/* Tab Navigation Header */}
        <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
          {[
            { id: "OVERVIEW", label: "Overview & Master", icon: Info },
            { id: "PRICING", label: "Pricing & Rates", icon: Banknote },
            { id: "STOCK", label: "Inventory & Location", icon: Warehouse },
            { id: "TAX", label: "GST & Statutory", icon: ShieldCheck },
            { id: "ATTRIBUTES", label: "Attributes & Custom Fields", icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#00aef0] text-foreground shadow-lg shadow-[#00aef0]/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="min-h-[220px] max-h-[360px] overflow-y-auto pr-1 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "OVERVIEW" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailCard label="Product Title" value={product.name} />
              <DetailCard label="SKU Code" value={product.sku} isMono />
              <DetailCard label="Barcode EAN/UPC" value={product.barcode || "N/A"} isMono />
              <DetailCard label="Alias / Alternate Name" value={product.alias_name || "N/A"} />
              <DetailCard label="Category" value={product.category_name || product.category?.name || "N/A"} />
              <DetailCard label="Sub Category" value={product.sub_category_name || "N/A"} />
              <DetailCard label="Brand" value={product.brand_name || "N/A"} />
              <DetailCard label="Manufacturer" value={product.manufacturer_name || "N/A"} />
              <DetailCard label="Department" value={product.department_name || "N/A"} />
              <DetailCard label="Preferred Supplier" value={product.preferred_supplier || "N/A"} />
            </div>
          )}

          {/* TAB 2: PRICING */}
          {activeTab === "PRICING" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DetailCard label="Selling Price" value={`₹${sellingPrice.toFixed(2)}`} highlight />
                <DetailCard label="Purchase Price" value={`₹${purchasePrice.toFixed(2)}`} />
                <DetailCard label="Maximum Retail Price (MRP)" value={`₹${mrp.toFixed(2)}`} />
                <DetailCard label="Wholesale Rate" value={product.wholesale_rate ? `₹${Number(product.wholesale_rate).toFixed(2)}` : "N/A"} />
                <DetailCard label="Distributor Rate" value={product.distributor_rate ? `₹${Number(product.distributor_rate).toFixed(2)}` : "N/A"} />
                <DetailCard label="Online Rate" value={product.online_rate ? `₹${Number(product.online_rate).toFixed(2)}` : "N/A"} />
                <DetailCard label="Minimum Selling Price" value={product.min_selling_price ? `₹${Number(product.min_selling_price).toFixed(2)}` : "N/A"} />
              </div>

              {/* Profitability Analysis Box */}
              <div className="bg-background p-4 rounded-2xl border border-border space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Percent className="h-4 w-4 text-[#00aef0]" /> Profitability Analysis
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Profit per Unit</span>
                    <span className="font-extrabold text-emerald-400 text-sm">
                      ₹{marginAmt.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Gross Margin %</span>
                    <span className="font-extrabold text-emerald-400 text-sm">
                      {marginPct.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Markup %</span>
                    <span className="font-extrabold text-purple-400 text-sm">
                      {markupPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STOCK & WAREHOUSE */}
          {activeTab === "STOCK" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DetailCard label="Base Unit" value={product.base_unit || "PCS"} />
                <DetailCard label="Purchase Unit" value={product.purchase_unit || "BOX"} />
                <DetailCard
                  label="Unit Conversion Factor"
                  value={`1 ${product.purchase_unit || "BOX"} = ${product.unit_conversion_factor || 1} ${product.base_unit || "PCS"}`}
                />
                <DetailCard label="Initial Opening Stock" value={`${product.initial_stock || 0} ${product.base_unit || "PCS"}`} />
                <DetailCard label="Reorder Level" value={`${product.reorder_level || 10} ${product.base_unit || "PCS"}`} />
                <DetailCard label="Reorder Quantity" value={`${product.reorder_quantity || 50} ${product.base_unit || "PCS"}`} />
                <DetailCard label="Min Stock Level" value={`${product.min_stock_level || 5} ${product.base_unit || "PCS"}`} />
                <DetailCard label="Max Stock Level" value={`${product.max_stock_level || 1000} ${product.base_unit || "PCS"}`} />
                <DetailCard label="Shelf Location" value={product.shelf_number || "Unassigned"} />
                <DetailCard label="Bin Location" value={product.bin_location || "Unassigned"} />
              </div>

              {/* Tracking Flags Status */}
              <div className="bg-background p-4 rounded-2xl border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tracking & Inventory Rules
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <FlagBadge label="Batch Tracking" active={!!product.track_batch} />
                  <FlagBadge label="Serial Tracking" active={!!product.track_serial} />
                  <FlagBadge label="Expiry Tracking" active={!!product.track_expiry} />
                  <FlagBadge label="Allow Negative Stock" active={!!product.allow_negative_stock} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GST & STATUTORY */}
          {activeTab === "TAX" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailCard label="HSN / SAC Code" value={product.hsn_sac_code || "6203"} isMono />
              <DetailCard label="GST Rate" value={`${product.tax_rate || 0}%`} />
              <DetailCard label="Cess Rate" value={`${product.cess_rate || 0}%`} />
              <DetailCard label="Tax Application" value={product.is_tax_inclusive ? "Tax Inclusive (Price includes GST)" : "Tax Exclusive (GST added at billing)"} />
            </div>
          )}

          {/* TAB 5: ATTRIBUTES & CUSTOM FIELDS */}
          {activeTab === "ATTRIBUTES" && (
            <div className="space-y-4">
              {attributeEntries.length > 0 ? (
                <div className="bg-background p-4 rounded-2xl border border-border space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#00aef0] flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> {industryTemplate} Industry Attributes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {attributeEntries.map(([k, v]) => (
                      <div key={k} className="bg-card/90 p-2.5 rounded-xl border border-border">
                        <span className="text-muted-foreground capitalize block text-[11px]">
                          {k.replace(/_/g, " ")}
                        </span>
                        <span className="font-semibold text-foreground block mt-0.5">
                          {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v || "N/A")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {Object.keys(customUserFields).length > 0 && (
                <div className="bg-background p-4 rounded-2xl border border-border space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Layers className="h-4 w-4" /> Custom Fields
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {Object.entries(customUserFields).map(([k, v]) => (
                      <div key={k} className="bg-card/90 p-2.5 rounded-xl border border-border">
                        <span className="text-muted-foreground block text-[11px]">{k}</span>
                        <span className="font-semibold text-foreground block mt-0.5">
                          {String(v || "N/A")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {attributeEntries.length === 0 && Object.keys(customUserFields).length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  No additional industry attributes or custom fields configured for this product.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="text-[11px] text-muted-foreground">
            Created: {product.created_at ? new Date(product.created_at).toLocaleDateString() : "Catalog Item"}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onEdit(product);
                }}
                className="border-border hover:border-[#00aef0] bg-[#00aef0]/10 hover:bg-[#00aef0]/20 text-[#00aef0] gap-2 rounded-xl text-xs h-10 font-bold"
              >
                <Pencil className="h-4 w-4" />
                Edit Product
              </Button>
            )}
            {onPrintTag && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onPrintTag(product);
                }}
                className="border-border hover:border-[#00aef0] text-foreground hover:text-[#00aef0] gap-2 rounded-xl text-xs h-10"
              >
                <Printer className="h-4 w-4" />
                Print Barcode Tag
              </Button>
            )}
            <Button
              onClick={onClose}
              className="bg-muted hover:bg-muted text-foreground font-bold rounded-xl text-xs h-10 px-5"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  label,
  value,
  isMono = false,
  highlight = false,
}: {
  label: string;
  value: string | number;
  isMono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="bg-background/80 p-3 rounded-2xl border border-border/80 space-y-1">
      <span className="text-[11px] text-muted-foreground font-medium block">{label}</span>
      <span
        className={`block text-xs font-semibold ${
          highlight ? "text-[#00aef0] text-sm font-extrabold" : "text-foreground"
        } ${isMono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function FlagBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
        active
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-card text-muted-foreground border-border"
      }`}
    >
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}
