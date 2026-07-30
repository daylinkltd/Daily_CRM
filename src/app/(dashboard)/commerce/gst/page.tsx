"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  RefreshCw, 
  Search, 
  Download, 
  QrCode, 
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeErrorMessage } from "@/lib/commerce/barcode-utils";

export default function GstReportsPage() {
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"GSTR1" | "GSTR2B" | "TAX_SUMMARY">("GSTR1");
  const [summary, setSummary] = useState<any>({
    totalTaxableSales: 0,
    totalOutputGst: 0,
    totalInputGst: 0,
    netGstLiability: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    activeInvoiceCount: 0,
  });
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // E-Invoice QR Modal State
  const [selectedEInvoice, setSelectedEInvoice] = useState<any | null>(null);

  const fetchGstData = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/commerce/gst/reports?workspace_id=${activeWorkspace.id}`);
      const json = await res.json();
      if (res.ok && json.summary) {
        setSummary(json.summary);
        setEntries(json.entries || []);
      }
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, "Failed to load GST reports");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGstData();
  }, [activeWorkspace?.id]);

  const handleExportCsv = () => {
    try {
      const headers = ["Invoice No", "Date", "Party Name", "GSTIN", "HSN/SAC", "Taxable Value", "CGST", "SGST", "IGST", "Total GST", "IRN"];
      const rows = entries.map((e) => [
        e.invoice_number,
        e.invoice_date,
        `"${e.party_name || ""}"`,
        e.gstin || "",
        e.hsn_sac_code || "",
        e.taxable_amount,
        e.cgst_amount,
        e.sgst_amount,
        e.igst_amount,
        e.total_gst,
        e.irn_number || "",
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `GSTR1_Report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("GSTR-1 report exported successfully!");
    } catch (e: any) {
      toast.error(sanitizeErrorMessage(e, "Export failed"));
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (activeTab === "GSTR1" && e.ledger_type !== "OUTPUT") return false;
    if (activeTab === "GSTR2B" && e.ledger_type !== "INPUT") return false;

    const q = query.toLowerCase();
    return (
      e.invoice_number?.toLowerCase().includes(q) ||
      e.party_name?.toLowerCase().includes(q) ||
      e.gstin?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-[#00aef0]" />
            GST Filing & E-Invoicing Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            GSTR-1 Sales Report, GSTR-2B Input Tax Credit (ITC), CGST/SGST/IGST splitting, and B2B IRN generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchGstData} variant="outline" className="border-border text-foreground gap-1.5 rounded-xl h-11">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleExportCsv}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11"
          >
            <Download className="h-4 w-4" />
            Export GSTR CSV
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card/90 border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Total Taxable Sales</div>
          <div className="text-xl font-extrabold text-foreground mt-1">
            ₹{summary.totalTaxableSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Excludes GST component</div>
        </div>

        <div className="p-4 bg-card/90 border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Output GST Collected</div>
          <div className="text-xl font-extrabold text-rose-400 mt-1">
            ₹{summary.totalOutputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
            <span>CGST: ₹{summary.totalCgst.toFixed(2)}</span>
            <span>SGST: ₹{summary.totalSgst.toFixed(2)}</span>
          </div>
        </div>

        <div className="p-4 bg-card/90 border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Input Tax Credit (ITC)</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">
            ₹{summary.totalInputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Claimable on purchases</div>
        </div>

        <div className="p-4 bg-card/90 border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Net GST Liability</div>
          <div className="text-xl font-extrabold text-[#00aef0] mt-1">
            ₹{summary.netGstLiability.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Output GST - Input Credit</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("GSTR1")}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "GSTR1"
                ? "bg-[#00aef0] text-foreground shadow-lg shadow-[#00aef0]/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            GSTR-1 Outward Sales Report
          </button>
          <button
            onClick={() => setActiveTab("GSTR2B")}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "GSTR2B"
                ? "bg-[#00aef0] text-foreground shadow-lg shadow-[#00aef0]/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            GSTR-2B Inward Purchase (ITC) Report
          </button>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter Invoice / GSTIN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 bg-background border-border text-foreground rounded-xl text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Party / Buyer</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4">HSN/SAC</th>
                <th className="py-3.5 px-4 text-right">Taxable Value</th>
                <th className="py-3.5 px-4 text-right">CGST</th>
                <th className="py-3.5 px-4 text-right">SGST</th>
                <th className="py-3.5 px-4 text-right">IGST</th>
                <th className="py-3.5 px-4 text-right">Total Invoice</th>
                <th className="py-3.5 px-4 text-center">E-Invoice IRN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground text-sm">
                    Loading GST Tax Ledger...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground text-sm">
                    No active GST ledger entries found for this report period.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      #{e.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {e.invoice_date}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      {e.party_name || "POS Retail Customer"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                      {e.gstin || "URP (Unregistered)"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#00aef0]">
                      {e.hsn_sac_code || "7113"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-foreground">
                      ₹{Number(e.taxable_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                      ₹{Number(e.cgst_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                      ₹{Number(e.sgst_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                      ₹{Number(e.igst_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#00aef0]">
                      ₹{Number(e.total_invoice_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {e.irn_number ? (
                        <button
                          onClick={() => setSelectedEInvoice(e)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          IRN Active
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">B2C Retail</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signed E-Invoice QR Modal */}
      {selectedEInvoice && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Signed E-Invoice IRN &amp; QR
              </h2>
              <button onClick={() => setSelectedEInvoice(null)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block">IRN (64-Char Hash):</span>
                <span className="font-mono text-[11px] text-[#00aef0] break-all bg-background p-2 rounded-lg block mt-0.5 border border-border">
                  {selectedEInvoice.irn_number}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block">Ack Number:</span>
                  <span className="font-mono text-foreground font-bold">{selectedEInvoice.ack_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Ack Date:</span>
                  <span className="text-foreground">{selectedEInvoice.ack_date ? new Date(selectedEInvoice.ack_date).toLocaleDateString() : "—"}</span>
                </div>
              </div>

              {/* QR Code Payload Simulation */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-border text-black">
                <QrCode className="h-28 w-28 text-black" />
                <span className="text-[10px] font-mono text-gray-600 mt-2">Government Signed QR Code Payload</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={() => setSelectedEInvoice(null)} className="bg-[#00aef0] text-foreground font-bold rounded-xl">
                Close Viewer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
