"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  FileText,
  Layers,
} from "lucide-react";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { ServiceCatalogItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconAction } from "@/components/ui/icon-action";

export function CatalogSettings() {
  const supabase = createClient();
  const { accountId, canEditSettings } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  // State for Catalog Items
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // State for adding/editing item
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [pricingType, setPricingType] = useState<"one_time" | "monthly" | "yearly">("one_time");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // State for default terms
  const [terms, setTerms] = useState("");
  const [termsLoading, setTermsLoading] = useState(true);
  const [termsSaving, setTermsSaving] = useState(false);

  // Fetch Service Catalog Items
  const fetchItems = async () => {
    if (!workspaceId) return;
    try {
      const { data, error } = await supabase
        .from("service_catalog")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error("Error fetching catalog:", err.message);
      toast.error("Failed to load service catalog");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Default Terms from Workspace
  const fetchTerms = async () => {
    if (!workspaceId) return;
    try {
      const { data, error } = await supabase
        .from("workspaces")
        .select("default_quotation_terms")
        .eq("id", workspaceId)
        .single();

      if (error) throw error;
      setTerms(data?.default_quotation_terms || "");
    } catch (err: any) {
      console.error("Error fetching terms:", err.message);
    } finally {
      setTermsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchItems();
      fetchTerms();
    }
  }, [workspaceId]);

  // Categories list for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.default_description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, selectedCategory]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName("");
    setDescription("");
    setPrice("0");
    setPricingType("one_time");
    setCategory("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: ServiceCatalogItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.default_description || "");
    setPrice(item.default_price.toString());
    setPricingType(item.default_pricing_type);
    setCategory(item.category || "");
    setDialogOpen(true);
  };

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;

    setSubmitting(true);
    const numPrice = parseFloat(price) || 0;

    const payload = {
      workspace_id: workspaceId,
      name: name.trim(),
      default_description: description.trim() || null,
      default_price: numPrice,
      default_pricing_type: pricingType,
      category: category.trim() || null,
      is_active: true,
    };

    try {
      if (editingItem) {
        const { error } = await supabase
          .from("service_catalog")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Catalog item updated");
      } else {
        const { error } = await supabase
          .from("service_catalog")
          .insert(payload);

        if (error) throw error;
        toast.success("Catalog item created");
      }

      setDialogOpen(false);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this item?")) return;
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("service_catalog")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Catalog item removed");
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove item");
    }
  };

  const handleSaveTerms = async () => {
    if (!workspaceId) return;
    setTermsSaving(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ default_quotation_terms: terms })
        .eq("id", workspaceId);

      if (error) throw error;
      toast.success("Default quotation terms saved");
    } catch {
      toast.error("Failed to save terms");
    } finally {
      setTermsSaving(false);
    }
  };

  const pricingLabels = {
    one_time: "One-time",
    monthly: "Monthly Recurring",
    yearly: "Yearly Recurring",
  };

  return (
    <section className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Service Catalog & Quotation Settings"
        description="Define standard products/services and the default notes template used for new quotes."
      />

      <div className="grid gap-6">
        {/* Service Catalog Panel */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/40">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileSpreadsheet className="size-4 text-primary" />
                Service Catalog
              </CardTitle>
              <CardDescription>
                Add pre-configured products and services to copy directly into quotations.
              </CardDescription>
            </div>
            {canEditSettings && (
              <IconAction label="Add Item" icon={<Plus className="size-4" />} onClick={handleOpenAdd} className="bg-primary text-primary-foreground" />
            )}
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Search and Category Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search catalog..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 bg-muted border-border"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 rounded-lg border border-border bg-muted px-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                No catalog items found.
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/60">
                {filteredItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{item.name}</span>
                        {item.category && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border/50">
                            {item.category}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {pricingLabels[item.default_pricing_type]}
                        </span>
                      </div>
                      {item.default_description && (
                        <p className="text-xs text-muted-foreground max-w-2xl line-clamp-2">
                          {item.default_description}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-foreground">
                        {formatCurrency(item.default_price, defaultCurrency, { decimals: 2 })}
                      </p>
                    </div>
                    {canEditSettings && (
                      <div className="flex items-center gap-1 shrink-0">
                        <IconAction
                          label="Edit"
                          icon={<Edit2 className="size-3.5" />}
                          variant="ghost"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        />
                        <IconAction
                          label="Delete"
                          icon={<Trash2 className="size-3.5" />}
                          variant="ghost"
                          onClick={() => handleDeleteItem(item.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Default Quotation Terms */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <FileText className="size-4 text-primary" />
              Default Notes & Terms
            </CardTitle>
            <CardDescription>
              This standard contract text pre-populates every new quotation. You can modify it per-quote in the builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {termsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4">
                <Textarea plain
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  disabled={!canEditSettings}
                  rows={6}
                  placeholder="Enter notes, delivery schedules, tax clauses, payment milestones, etc."
                  className="bg-muted border-border font-mono text-xs text-foreground focus-visible:ring-primary"
                />
                {canEditSettings && (
                  <Button
                    onClick={handleSaveTerms}
                    disabled={termsSaving}
                    className="w-fit bg-primary text-primary-foreground hover:bg-primary/95"
                  >
                    {termsSaving ? (
                      <>
                        <Loader2 className="mr-1.5 size-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save Terms"
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Catalog Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border bg-popover text-popover-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Catalog Item" : "Add Catalog Item"}
            </DialogTitle>
            <DialogDescription>
              Define catalog product properties. Quotations copy these values directly upon insertion.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitItem} className="space-y-4 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                required
                placeholder="e.g. Premium Support Tier"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted border-border"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea plain
                id="item-desc"
                placeholder="Product description detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-muted border-border"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="item-price">Default Price</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {getCurrencySymbol(defaultCurrency)}
                  </span>
                  <Input
                    id="item-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pl-8 bg-muted border-border"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-type">Pricing Type</Label>
                <select
                  id="item-type"
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value as any)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="one_time">One-time</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="item-cat">Category</Label>
              <div className="relative">
                <Layers className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="item-cat"
                  placeholder="e.g. Services, Software, Hardware"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="pl-8 bg-muted border-border"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-border bg-transparent text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !name.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
