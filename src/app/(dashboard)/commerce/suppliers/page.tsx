"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, RefreshCw, Search, Phone, Mail, MapPin, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { IconAction } from "@/components/ui/icon-action";

export default function SuppliersPage() {
  const { activeWorkspace } = useWorkspace();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");

  const fetchSuppliers = async () => {
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
  };

  useEffect(() => {
    fetchSuppliers();
  }, [activeWorkspace?.id]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !companyName) {
      toast.error("Company Name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          company_name: companyName,
          contact_person: contactPerson || undefined,
          phone: phone || undefined,
          email: email || undefined,
          gstin: gstin || undefined,
          address: address || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create supplier");

      toast.success("Supplier added to Master Directory!");
      setShowAddModal(false);
      setCompanyName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setGstin("");
      setAddress("");
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.company_name?.toLowerCase().includes(query.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(query.toLowerCase()) ||
      s.phone?.includes(query) ||
      s.gstin?.toLowerCase().includes(query.toLowerCase())
  );

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
          <IconAction label="Add New Supplier" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}
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
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-4">Contact Person</th>
                <th className="py-3.5 px-4">Phone & Email</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4 text-right">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    Loading Suppliers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm space-y-3">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-foreground font-semibold">No Suppliers Registered Yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Add vendor details, GSTIN, contact numbers, and track supplier payables.
                    </p>
                    <IconAction label="Add New Supplier" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}
                      className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl gap-2 mt-2" />
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      {supplier.company_name}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-foreground">
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
                    <td className="py-3.5 px-4 font-mono text-xs text-[#00aef0]">
                      {supplier.gstin || "URP"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {supplier.address || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-foreground">
                      ₹{Number(supplier.outstanding_balance || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-foreground overflow-x-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#00aef0]" />
                Add New Supplier / Vendor
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-border text-foreground rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl h-10 px-5">
                  {saving ? "Saving..." : "Save Supplier"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
