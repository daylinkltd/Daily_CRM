"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet,
  Search,
  Send,
  RefreshCw,
  UserPlus,
  Plus,
  IndianRupee,
  AlertTriangle,
  Users,
  CheckCircle2,
  X,
  Info,
  Phone,
  Building,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppReminderModal } from "@/components/finance/whatsapp-reminder-modal";
import { IconAction } from "@/components/ui/icon-action";
import { NativeSelect } from "@/components/ui/native-select";

export default function CustomerLedgerPage() {
  const { activeWorkspace } = useWorkspace();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [creditLimit, setCreditLimit] = useState("50000");

  // Record Payment Collection Modal State
  const [selectedPayCustomer, setSelectedPayCustomer] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"CASH" | "UPI" | "BANK">("CASH");
  const [payNotes, setPayNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const fetchLedger = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/commerce/ledger?workspace_id=${activeWorkspace.id}`);
      const json = await res.json();
      if (res.ok && json.customers) {
        setCustomers(json.customers);
      }
    } catch {
      toast.error("Failed to load customer khata ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [activeWorkspace?.id]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || (!firstName && !phone)) {
      toast.error("Customer Name or Phone Number is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_CUSTOMER",
          workspace_id: activeWorkspace.id,
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          email,
          company,
          credit_limit: Number(creditLimit || 50000),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create customer");

      toast.success("New Customer added to CRM & Khata Ledger!");
      setShowAddCustomerModal(false);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setCompany("");
      setCreditLimit("50000");
      fetchLedger();
    } catch (err: any) {
      toast.error(err.message || "Failed to add customer");
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !selectedPayCustomer || !payAmount) {
      toast.error("Payment amount is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_PAYMENT",
          workspace_id: activeWorkspace.id,
          contact_id: selectedPayCustomer.id,
          payment_amount: Number(payAmount),
          payment_mode: payMode,
          notes: payNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");

      toast.success(
        `Recorded Khata payment of ₹${Number(payAmount).toFixed(2)} for ${selectedPayCustomer.displayName}!`
      );
      setSelectedPayCustomer(null);
      setPayAmount("");
      setPayNotes("");
      fetchLedger();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const [selectedWaCustomer, setSelectedWaCustomer] = useState<any>(null);
  const [waModalOpen, setWaModalOpen] = useState(false);

  const handleWhatsAppReminder = (c: any) => {
    const rawPhone = c.phone || c.phone_number;
    if (!rawPhone) {
      toast.error("Customer phone number is missing");
      return;
    }
    setSelectedWaCustomer(c);
    setWaModalOpen(true);
  };

  // Compute Stats
  const totalCustomersCount = customers.length;
  const totalUdharBalance = customers.reduce(
    (acc, c) => acc + Number(c.outstanding_balance || 0),
    0
  );
  const overLimitCount = customers.filter(
    (c) => Number(c.outstanding_balance || 0) > Number(c.credit_limit || 50000)
  ).length;

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filteredCustomers = customers.filter(
    (c) =>
      c.displayName?.toLowerCase().includes(query.toLowerCase()) ||
      c.phone?.includes(query) ||
      c.phone_number?.includes(query) ||
      c.company?.toLowerCase().includes(query.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const displayedCustomers = filteredCustomers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2.5">
            <Wallet className="h-6 w-6 text-[#00aef0]" />
            Customer Khata &amp; Credit Risk Ledger
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track customer credit balances (Udhar), set credit limits, collect payments, and send WhatsApp payment reminders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconAction label="Refresh Books" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchLedger}
            variant="outline"
            className="border-border text-foreground gap-1.5 rounded-xl h-11" />
          <IconAction label="Add New Customer" icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowAddCustomerModal(true)}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11" />
        </div>
      </div>

      {/* Workflow Guidance Banner */}
      <div className="bg-card/90 border border-border p-4 rounded-2xl flex items-center gap-3 text-xs text-foreground">
        <Info className="h-5 w-5 text-[#00aef0] shrink-0" />
        <div>
          <strong className="text-foreground block font-bold text-sm">
            How Customer Khata Works:
          </strong>
          Customers created here are automatically saved to your <span className="text-[#00aef0] font-bold">CRM Contacts</span> and available in <span className="text-[#00aef0] font-bold">POS Billing</span>. When a POS checkout is completed using <span className="text-amber-400 font-bold">KHATA_CREDIT</span> mode, their pending balance increases here. Click <strong>Record Payment</strong> to collect cash/UPI and clear their Udhar balance!
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card/90 border border-border rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Registered Customers</div>
            <div className="text-2xl font-extrabold text-[#00aef0] mt-1">{totalCustomersCount}</div>
          </div>
          <div className="h-10 w-10 bg-[#00aef0]/10 border border-[#00aef0]/20 rounded-xl flex items-center justify-center text-[#00aef0]">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 bg-card/90 border border-border rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Pending Udhar Balance</div>
            <div className="text-2xl font-extrabold text-amber-400 mt-1">
              ₹{totalUdharBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
            <IndianRupee className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 bg-card/90 border border-border rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">Over Credit Limit Alerts</div>
            <div className="text-2xl font-extrabold text-rose-400 mt-1">{overLimitCount}</div>
          </div>
          <div className="h-10 w-10 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-card/80 p-3 rounded-2xl border border-border backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search Customer by Name, Phone Number, or Company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-background/80 border-border text-foreground rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Khata Ledger Table */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3.5 px-4 w-[28%]">Customer Name</th>
                <th className="py-3.5 px-4 w-[24%]">Phone &amp; Email</th>
                <th className="py-3.5 px-4 text-right w-[16%]">Credit Limit</th>
                <th className="py-3.5 px-4 text-right w-[16%]">Pending Udhar Balance</th>
                <th className="py-3.5 px-4 text-center w-[16%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground text-sm">
                    Loading Customer Khata Ledger...
                  </td>
                </tr>
              ) : displayedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground text-sm space-y-3">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-foreground font-semibold">No Customers Found</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Add customer details to start tracking credit limits and Khata payments.
                    </p>
                    <IconAction label="Add First Customer" icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowAddCustomerModal(true)}
                      className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl gap-2 mt-2" />
                  </td>
                </tr>
              ) : (
                displayedCustomers.map((contact) => {
                  const bal = Number(contact.outstanding_balance || 0);
                  const limit = Number(contact.credit_limit || 50000);
                  const isOverLimit = bal > limit;

                  return (
                    <tr key={contact.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-foreground">
                        <div>{contact.displayName}</div>
                        {contact.company && (
                          <span className="block text-[11px] text-muted-foreground font-normal">
                            {contact.company}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-foreground">
                        {(contact.phone || contact.phone_number) && (
                          <div className="flex items-center gap-1 font-mono text-foreground">
                            <Phone className="h-3 w-3 text-[#00aef0]" />
                            {contact.phone || contact.phone_number}
                          </div>
                        )}
                        {contact.email && (
                          <div className="text-[11px] text-muted-foreground">{contact.email}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-foreground">
                        ₹{limit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold">
                        <span
                          className={
                            bal > 0
                              ? isOverLimit
                                ? "text-rose-400"
                                : "text-amber-400"
                              : "text-emerald-400"
                          }
                        >
                          ₹{bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <IconAction label="Record Payment" icon={<IndianRupee className="h-3.5 w-3.5" />} onClick={() => setSelectedPayCustomer(contact)}
                            className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold text-xs rounded-xl gap-1 h-8 px-3" />
                          <IconAction label="WhatsApp" icon={<Send className="h-3.5 w-3.5" />} variant="outline"
                            onClick={() => handleWhatsAppReminder(contact)}
                            className="border-emerald-600/30 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-bold text-xs rounded-xl gap-1 h-8 px-3" />
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

      {/* Pagination Bar */}
      {filteredCustomers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card/80 border border-border p-3.5 rounded-2xl text-xs text-foreground backdrop-blur-md">
          <div>
            Showing <strong className="text-foreground">{(page - 1) * pageSize + 1}</strong> to{" "}
            <strong className="text-foreground">
              {Math.min(page * pageSize, filteredCustomers.length)}
            </strong>{" "}
            of <strong className="text-foreground">{filteredCustomers.length}</strong> registered customers
          </div>
          <div className="flex items-center gap-2">
            <IconAction label="Previous" icon={<ChevronLeft className="h-4 w-4" />} variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-border text-foreground h-8 gap-1 rounded-xl disabled:opacity-40" />
            <span className="font-bold text-foreground px-3 py-1 bg-background rounded-lg border border-border">
              Page {page} of {totalPages}
            </span>
            <IconAction label="Next" icon={<ChevronRight className="h-4 w-4" />} variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="border-border text-foreground h-8 gap-1 rounded-xl disabled:opacity-40" />
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-foreground overflow-x-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#00aef0]" />
                Add New Customer to CRM &amp; Khata
              </h2>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">First Name *</Label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. Ramesh"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Last Name</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Kumar"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Phone Number *</Label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="e.g. ramesh@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Company / Shop Name</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Ramesh Traders"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Credit Limit (₹)</Label>
                  <Input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="bg-background border-border text-foreground rounded-xl h-10 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowAddCustomerModal(false)} className="border-border text-foreground rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl h-10 px-5">
                  {saving ? "Adding..." : "Add Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Collection Modal */}
      {selectedPayCustomer && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-foreground overflow-x-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-[#00aef0]" />
                Collect Khata Payment
              </h2>
              <button onClick={() => setSelectedPayCustomer(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-background p-3 rounded-2xl border border-border space-y-1 text-xs">
              <span className="text-muted-foreground block">Customer Name:</span>
              <strong className="text-foreground text-sm font-extrabold block">
                {selectedPayCustomer.displayName}
              </strong>
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">Current Pending Udhar:</span>
                <span className="text-amber-400 font-extrabold text-sm">
                  ₹{Number(selectedPayCustomer.outstanding_balance || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-foreground">Payment Collected Amount (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="Enter collected cash/UPI amount..."
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs font-bold text-base"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-foreground">Payment Collection Mode</Label>
                <NativeSelect
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as any)}
                  className="w-full bg-background border border-border text-foreground rounded-xl h-10 px-3 text-xs font-bold"
                >
                  <option value="CASH">CASH Collection</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="BANK">Bank Transfer / Cheque</option>
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-foreground">Notes / Remarks</Label>
                <Input
                  type="text"
                  placeholder="e.g. Partial cash payment received"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="bg-background border-border text-foreground rounded-xl h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setSelectedPayCustomer(null)} className="border-border text-foreground rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl h-10 px-5">
                  {saving ? "Saving..." : "Record Payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeWorkspace?.id && (
        <WhatsAppReminderModal
          open={waModalOpen}
          onOpenChange={setWaModalOpen}
          customer={selectedWaCustomer}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name || "Dailybiz"}
        />
      )}
    </div>
  );
}
