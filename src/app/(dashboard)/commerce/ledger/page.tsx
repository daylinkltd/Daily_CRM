"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Search, Plus, Send, RefreshCw, User, CheckCircle2, ArrowDownRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function CustomerLedgerPage() {
  const { activeWorkspace } = useWorkspace();
  const supabase = createClient();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const fetchContacts = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load customer ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [activeWorkspace?.id]);

  const handleWhatsAppReminder = (contact: any) => {
    if (!contact.phone) {
      toast.error("Customer phone number is missing");
      return;
    }
    const cleanPhone = contact.phone.replace(/[^0-9]/g, "");
    const message = encodeURIComponent(
      `Hello ${contact.name}, this is a gentle reminder from Daily CRM regarding your pending credit balance. Please make the payment at your earliest convenience. Thank you!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
  };

  const filteredContacts = contacts.filter((c) =>
    c.name?.toLowerCase().includes(query.toLowerCase()) ||
    c.phone?.includes(query)
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Wallet className="h-6 w-6 text-[#00aef0]" />
            Customer Khata & Credit Risk Ledger
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track customer credit balances (Udhar), credit limits, payment terms, and send WhatsApp payment reminders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchContacts} variant="outline" className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11">
            <RefreshCw className="h-4 w-4" />
            Refresh Books
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search Customer by Name, Phone Number, or Company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-slate-950/80 border-slate-800 text-white rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Khata Ledger Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Customer Category</th>
                <th className="py-3.5 px-4 text-right">Credit Limit</th>
                <th className="py-3.5 px-4 text-right">Pending Udhar Balance</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    Loading Customer Ledger...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    No customers found in ledger. Add contacts in CRM module to start tracking credit.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {contact.name}
                      {contact.company && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {contact.company}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      {contact.phone || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-bold text-[#00aef0]">
                      RETAIL
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                      ₹50,000.00
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-amber-400">
                      ₹{Number(contact.outstanding_balance || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => handleWhatsAppReminder(contact)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl gap-1.5 h-8"
                      >
                        <Send className="h-3.5 w-3.5" />
                        WhatsApp Reminder
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
