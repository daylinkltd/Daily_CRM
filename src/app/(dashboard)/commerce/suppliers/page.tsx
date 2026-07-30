"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, RefreshCw, Search, Phone, Mail, MapPin, FileText, X } from "lucide-react";
import { toast } from "sonner";

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
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-[#00aef0]" />
            Supplier & Vendor Master Directory
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Master directory of wholesalers, manufacturers, GSTIN details, and stock suppliers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchSuppliers} variant="outline" className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11"
          >
            <Plus className="h-4 w-4" />
            Add New Supplier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by Company Name, Contact Person, Phone, or GSTIN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-slate-950/80 border-slate-800 text-white rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-4">Contact Person</th>
                <th className="py-3.5 px-4">Phone & Email</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4 text-right">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    Loading Suppliers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    No suppliers registered yet. Click &quot;Add New Supplier&quot; to populate your vendor directory.
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {supplier.company_name}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {supplier.contact_person || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {supplier.phone && (
                        <div className="flex items-center gap-1 text-slate-200">
                          <Phone className="h-3 w-3 text-[#00aef0]" /> {supplier.phone}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                          <Mail className="h-3 w-3 text-slate-500" /> {supplier.email}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#00aef0]">
                      {supplier.gstin || "URP"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {supplier.address || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-white">
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#00aef0]" />
                Add New Supplier / Vendor
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Supplier / Company Name *</Label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Acme Wholesale Pvt Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Contact Person</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Phone Number</Label>
                  <Input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="e.g. vendor@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">GSTIN Number</Label>
                  <Input
                    type="text"
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Office / Warehouse Address</Label>
                <Input
                  type="text"
                  placeholder="e.g. Plot 42, Industrial Area, Mumbai"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-800 text-slate-300 rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl h-10 px-5">
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
