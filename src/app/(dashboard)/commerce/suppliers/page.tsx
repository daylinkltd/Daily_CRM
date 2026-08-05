"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, RefreshCw, Search, Phone, Mail, X, Layers, Edit3, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IconAction } from "@/components/ui/icon-action";
import { BulkEntryDialog } from "@/components/ui/bulk-entry-dialog";
import { BulkActionBar, SelectAllCheckbox, SelectRowCheckbox } from "@/components/ui/bulk-action-bar";

export default function SuppliersPage() {
  const { activeWorkspace } = useWorkspace();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  
  // Modal & Selection state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [outstandingBalance, setOutstandingBalance] = useState("0");

  const fetchSuppliers = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/commerce/suppliers?workspace_id=${activeWorkspace.id}`);
      const json = await res.json();
      if (res.ok && json.suppliers) {
        setSuppliers(json.suppliers);
      }
    } catch {
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setCompanyName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setGstin("");
    setAddress("");
    setOutstandingBalance("0");
    setShowAddModal(true);
  };

  const handleOpenEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setCompanyName(supplier.company_name || "");
    setContactPerson(supplier.contact_person || "");
    setPhone(supplier.phone || "");
    setEmail(supplier.email || "");
    setGstin(supplier.gstin || "");
    setAddress(supplier.address || "");
    setOutstandingBalance(String(supplier.outstanding_balance || 0));
    setShowAddModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !companyName.trim()) {
      toast.error("Company Name is required");
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingSupplier?.id;
      const url = "/api/commerce/suppliers";
      const method = isEdit ? "PUT" : "POST";
      const payload = {
        id: editingSupplier?.id,
        workspace_id: activeWorkspace.id,
        company_name: companyName.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
        outstanding_balance: Number(outstandingBalance) || 0,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to ${isEdit ? "update" : "create"} supplier`);

      toast.success(isEdit ? "Supplier updated successfully!" : "Supplier added to Master Directory!");
      setShowAddModal(false);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!activeWorkspace?.id) return;
    if (!confirm(`Are you sure you want to delete supplier "${name}"?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/commerce/suppliers?id=${id}&workspace_id=${activeWorkspace.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete supplier");

      toast.success("Supplier deleted successfully!");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete supplier");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!activeWorkspace?.id || selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected supplier(s)?`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/commerce/suppliers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          ids: Array.from(selectedIds),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete selected suppliers");

      toast.success(`Deleted ${selectedIds.size} suppliers.`);
      setSelectedIds(new Set());
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete selected suppliers");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkAddSuppliers = async (rows: Record<string, string>[]) => {
    if (!activeWorkspace?.id) return;
    try {
      for (const row of rows) {
        if (!row.company_name?.trim()) continue;
        await fetch("/api/commerce/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: activeWorkspace.id,
            company_name: row.company_name.trim(),
            contact_person: row.contact_person?.trim() || undefined,
            phone: row.phone?.trim() || undefined,
            email: row.email?.trim() || undefined,
            gstin: row.gstin?.trim() || undefined,
            address: row.address?.trim() || undefined,
          }),
        });
      }
      toast.success(`Added ${rows.length} supplier${rows.length === 1 ? "" : "s"}.`);
      fetchSuppliers();
    } catch {
      toast.error("Failed to bulk add suppliers.");
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.company_name?.toLowerCase().includes(query.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(query.toLowerCase()) ||
      s.phone?.includes(query) ||
      s.gstin?.toLowerCase().includes(query.toLowerCase())
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const someFilteredSelected = filtered.some((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filtered.forEach((s) => next.delete(s.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((s) => next.add(s.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-[#00aef0]" />
            Supplier & Vendor Master Directory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Master directory of wholesalers, manufacturers, GSTIN details, and stock suppliers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconAction label="Refresh" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchSuppliers} variant="outline" className="border-border text-foreground gap-1.5 rounded-xl h-11" />
          <IconAction label="Bulk Add" icon={<Layers className="h-4 w-4" />} onClick={() => setBulkAddOpen(true)} variant="outline" className="border-border text-foreground gap-1.5 rounded-xl h-11" />
          <IconAction label="Add New Supplier" icon={<Plus className="h-4 w-4" />} onClick={handleOpenAdd}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11" />
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-card/80 p-3 rounded-2xl border border-border backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Company Name, Contact Person, Phone, or GSTIN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-background/80 border-border text-foreground rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <SelectAllCheckbox
                    checked={allFilteredSelected}
                    indeterminate={someFilteredSelected && !allFilteredSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Contact Person</th>
                <th className="py-3.5 px-4">Phone &amp; Email</th>
                <th className="py-3.5 px-4 hidden sm:table-cell">GSTIN</th>
                <th className="py-3.5 px-4 hidden lg:table-cell">Address</th>
                <th className="py-3.5 px-4 text-right">Outstanding Balance</th>
                <th className="py-3.5 px-4 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                    Loading Suppliers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm space-y-3">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-foreground font-semibold">No Suppliers Registered Yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Add vendor details, GSTIN, contact numbers, and track supplier payables.
                    </p>
                    <IconAction label="Add New Supplier" icon={<Plus className="h-4 w-4" />} onClick={handleOpenAdd}
                      className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl gap-2 mt-2" />
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => {
                  const isSelected = selectedIds.has(supplier.id);
                  return (
                    <tr key={supplier.id} className={`hover:bg-muted/40 transition-colors ${isSelected ? "bg-muted/30" : ""}`}>
                      <td className="py-3.5 px-4">
                        <SelectRowCheckbox
                          checked={isSelected}
                          onToggle={() => toggleSelectRow(supplier.id)}
                          label={`Select ${supplier.company_name}`}
                        />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        {supplier.company_name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-foreground hidden md:table-cell">
                        {supplier.contact_person || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-foreground">
                            <Phone className="h-3 w-3 text-[#00aef0]" /> {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                            <Mail className="h-3 w-3 text-muted-foreground" /> {supplier.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[#00aef0] hidden sm:table-cell">
                        {supplier.gstin || "URP"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground hidden lg:table-cell">
                        {supplier.address || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-foreground">
                        ₹{Number(supplier.outstanding_balance || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IconAction
                            label="Edit"
                            icon={<Edit3 className="h-4 w-4" />}
                            onClick={() => handleOpenEdit(supplier)}
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                          />
                          <IconAction
                            label="Delete"
                            icon={<Trash2 className="h-4 w-4 text-destructive" />}
                            onClick={() => handleDeleteSupplier(supplier.id, supplier.company_name)}
                            variant="ghost"
                            className="h-8 w-8 rounded-lg hover:bg-destructive/10"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        noun="supplier"
        busy={deleting}
      >
        <Button
          variant="destructive"
          size="sm"
          onClick={handleBulkDelete}
          disabled={deleting}
          className="rounded-lg h-8 px-3 text-xs gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Selected ({selectedIds.size})
        </Button>
      </BulkActionBar>

      {/* Bulk Entry Dialog */}
      <BulkEntryDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        scope="suppliers"
        workspaceId={activeWorkspace?.id || ""}
        title="Bulk Add Suppliers & Vendors"
        description="Paste or type multiple supplier details at once. Enter one supplier per row."
        columns={[
          { key: "company_name", label: "Company Name *", required: true },
          { key: "contact_person", label: "Contact Person" },
          { key: "phone", label: "Phone Number" },
          { key: "email", label: "Email Address" },
          { key: "gstin", label: "GSTIN Number" },
          { key: "address", label: "Address" },
        ]}
        onSubmit={handleBulkAddSuppliers}
      />

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-foreground overflow-x-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#00aef0]" />
                {editingSupplier ? "Edit Supplier / Vendor" : "Add New Supplier / Vendor"}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-foreground">Supplier / Company Name *</Label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Acme Wholesale Pvt Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Contact Person</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Phone Number</Label>
                  <Input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="e.g. vendor@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">GSTIN Number</Label>
                  <Input
                    type="text"
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Office / Warehouse Address</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Plot 42, Industrial Area, Mumbai"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Outstanding Balance (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={outstandingBalance}
                    onChange={(e) => setOutstandingBalance(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-border text-foreground rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl h-10 px-5">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {editingSupplier ? "Updating..." : "Saving..."}
                    </>
                  ) : editingSupplier ? (
                    "Update Supplier"
                  ) : (
                    "Save Supplier"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
