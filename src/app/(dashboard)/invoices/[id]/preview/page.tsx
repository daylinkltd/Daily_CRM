"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Printer,
  Banknote,
  Send,
  Building2,
  User,
  CheckCircle2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconAction } from "@/components/ui/icon-action";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

interface InvoicePayment {
  id: string;
  amount: number;
  payment_date: string;
  mode: string;
  reference_number: string | null;
  created_at: string;
}

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  source: string;
  status: string;
  currency: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes: string | null;
  terms: string | null;
  sent_at: string | null;
  paid_at: string | null;
  contact?: {
    id: string;
    name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  project?: { id: string; name: string | null } | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

const STATUS_META: Record<string, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-muted/10 text-muted-foreground border-border/20" },
  sent: { label: "Sent", classes: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  partially_paid: { label: "Partially Paid", classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  paid: { label: "Paid", classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  overdue: { label: "Overdue", classes: "bg-red-500/10 text-red-400 border-red-500/20" },
  void: { label: "Void", classes: "bg-muted/10 text-muted-foreground border-border/20 line-through" },
};

export default function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: invoiceId } = React.use(params);
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Workspace metadata for header branding
  const [workspaceInfo, setWorkspaceInfo] = useState<{
    company_name: string | null;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
    logo_url: string | null;
  } | null>(null);

  // Payment Modal State
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);

  const loadInvoice = React.useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      // 1. Fetch Invoice base row
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq("id", invoiceId)
        .maybeSingle();

      if (invErr || !inv) {
        throw new Error("Invoice not found or access denied");
      }

      // 2. Fetch Contact details separately if contact_id exists
      let contactData = null;
      if (inv.contact_id) {
        const { data: c } = await supabase
          .from("contacts")
          .select("id, name, company, email, phone")
          .eq("id", inv.contact_id)
          .maybeSingle();
        contactData = c;
      }

      // 3. Fetch Line Items
      const { data: items } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("position", { ascending: true });

      // 4. Fetch Payments
      const { data: payments } = await supabase
        .from("invoice_payments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("payment_date", { ascending: false });

      setInvoice({
        ...inv,
        contact: contactData,
        items: items || [],
        payments: payments || [],
      });

      // 5. Fetch Workspace details if workspace_id present
      if (inv.workspace_id) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("company_name, company_address, company_email, company_phone, logo_url")
          .eq("id", inv.workspace_id)
          .maybeSingle();

        if (ws) {
          setWorkspaceInfo(ws);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [supabase, invoiceId]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  async function handleSend() {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send invoice");
      toast.success(`${invoice.invoice_number} issued and posted to accounting`);
      await loadInvoice();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecordPayment() {
    if (!invoice) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payAmount),
          mode: payMode,
          reference_number: payRef || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      toast.success("Payment recorded and posted to accounting");
      setPayOpen(false);
      setPayAmount("");
      setPayRef("");
      await loadInvoice();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-2">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading invoice details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => router.push("/invoices")} className="mb-4 gap-2">
          <ArrowLeft className="size-4" /> Back to Invoices
        </Button>
        <Card className="p-8 text-center text-muted-foreground">Invoice not found.</Card>
      </div>
    );
  }

  const meta = STATUS_META[invoice.status] ?? STATUS_META.draft;
  const currency = invoice.currency || defaultCurrency;
  const balanceDue = Number(invoice.total_amount) - Number(invoice.amount_paid);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.push("/invoices")} className="gap-2">
          <ArrowLeft className="size-4" /> Back to Invoices
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="size-4" /> Print / Save PDF
          </Button>

          {invoice.status === "draft" && (
            <Button size="sm" onClick={handleSend} disabled={actionLoading} className="gap-2">
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send & Issue Invoice
            </Button>
          )}

          {["sent", "partially_paid", "overdue"].includes(invoice.status) && (
            <Button
              size="sm"
              onClick={() => {
                setPayAmount(balanceDue.toFixed(2));
                setPayOpen(true);
              }}
              className="gap-2"
            >
              <Banknote className="size-4" /> Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Printable Invoice Document */}
      <Card className="border bg-card text-card-foreground shadow-sm print:shadow-none print:border-none p-6 sm:p-10 space-y-8">
        {/* Header: Company & Invoice Info */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b pb-6">
          <div className="space-y-2">
            {workspaceInfo?.logo_url ? (
              // eslint-disable-next-next/no-img-element
              <img src={workspaceInfo.logo_url} alt="Company Logo" className="h-10 w-auto object-contain" />
            ) : (
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {workspaceInfo?.company_name || activeWorkspace?.name || "Business Invoice"}
              </h2>
            )}
            <div className="text-xs text-muted-foreground space-y-0.5">
              {workspaceInfo?.company_address && <p>{workspaceInfo.company_address}</p>}
              {workspaceInfo?.company_email && <p>Email: {workspaceInfo.company_email}</p>}
              {workspaceInfo?.company_phone && <p>Phone: {workspaceInfo.company_phone}</p>}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="flex items-center sm:justify-end gap-2">
              <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">TAX INVOICE</h1>
              <span className={`inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold rounded-full ${meta.classes}`}>
                {meta.label}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">#{invoice.invoice_number}</p>
            <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
              <p><span className="font-medium text-foreground">Issue Date:</span> {invoice.issue_date}</p>
              {invoice.due_date && <p><span className="font-medium text-foreground">Due Date:</span> {invoice.due_date}</p>}
              {invoice.source && <p className="capitalize"><span className="font-medium text-foreground">Source:</span> {invoice.source}</p>}
            </div>
          </div>
        </div>

        {/* Bill To & Project Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border border-border/50">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5" /> Billed To
            </span>
            <p className="text-sm font-semibold text-foreground">
              {invoice.contact?.company || invoice.contact?.name || "N/A"}
            </p>
            {invoice.contact?.company && invoice.contact?.name && (
              <p className="text-xs text-muted-foreground">Attn: {invoice.contact.name}</p>
            )}
            {invoice.contact?.address && (
              <p className="text-xs text-muted-foreground whitespace-pre-line">{invoice.contact.address}</p>
            )}
            {invoice.contact?.email && (
              <p className="text-xs text-muted-foreground">{invoice.contact.email}</p>
            )}
          </div>

          {invoice.project && (
            <div className="space-y-1 sm:text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center sm:justify-end gap-1.5">
                <Building2 className="size-3.5" /> Associated Project
              </span>
              <p className="text-sm font-medium text-foreground">{invoice.project.name}</p>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Description</h3>
          <div className="border rounded-md overflow-x-auto">
            <Table className="w-full text-left">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[50%]">Item / Description</TableHead>
                  <TableHead className="text-right w-[15%]">Qty</TableHead>
                  <TableHead className="text-right w-[15%]">Unit Price</TableHead>
                  {Number(invoice.tax_rate) > 0 && <TableHead className="text-right w-[10%]">Tax</TableHead>}
                  <TableHead className="text-right w-[20%]">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                      No line items attached to this invoice.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-sm whitespace-normal break-words">
                        {item.description}
                      </TableCell>
                      <TableCell className="text-right text-xs whitespace-nowrap">{item.quantity}</TableCell>
                      <TableCell className="text-right text-xs whitespace-nowrap">
                        {formatCurrency(Number(item.unit_price), currency, { decimals: 2 })}
                      </TableCell>
                      {Number(invoice.tax_rate) > 0 && (
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {item.tax_rate || invoice.tax_rate}%
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium text-xs whitespace-nowrap">
                        {formatCurrency(Number(item.line_total || item.quantity * item.unit_price), currency, { decimals: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary & Totals */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
          <div className="space-y-4 sm:max-w-md flex-1">
            {invoice.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line bg-muted/10 p-3 rounded border">
                  {invoice.notes}
                </p>
              </div>
            )}
            {invoice.terms && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Terms & Conditions</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line bg-muted/10 p-3 rounded border">
                  {invoice.terms}
                </p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 space-y-2 border-t sm:border-t-0 pt-4 sm:pt-0">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(Number(invoice.subtotal), currency, { decimals: 2 })}</span>
            </div>
            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Discount</span>
                <span className="font-medium text-foreground">-{formatCurrency(Number(invoice.discount_amount), currency, { decimals: 2 })}</span>
              </div>
            )}
            {Number(invoice.tax_amount) > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Tax ({invoice.tax_rate}%)</span>
                <span className="font-medium text-foreground">{formatCurrency(Number(invoice.tax_amount), currency, { decimals: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-foreground border-t pt-2">
              <span>Total Amount</span>
              <span>{formatCurrency(Number(invoice.total_amount), currency, { decimals: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Amount Paid</span>
              <span className="font-medium text-emerald-500">{formatCurrency(Number(invoice.amount_paid), currency, { decimals: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-foreground bg-muted/30 p-2 rounded border border-border/50 mt-1">
              <span>Balance Due</span>
              <span className={balanceDue > 0 ? "text-yellow-500" : "text-emerald-500"}>
                {formatCurrency(balanceDue, currency, { decimals: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Payments History (If Any) */}
        {invoice.payments.length > 0 && (
          <div className="border-t pt-6 space-y-3 print:break-inside-avoid">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500" /> Payment History
            </h3>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference / UTR</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{p.payment_date}</TableCell>
                      <TableCell className="text-xs capitalize">{p.mode.replace("_", " ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.reference_number || "—"}</TableCell>
                      <TableCell className="text-right text-xs font-medium text-emerald-500">
                        {formatCurrency(Number(p.amount), currency, { decimals: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment — {invoice.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Outstanding:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(balanceDue, currency, { decimals: 2 })}
              </span>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Amount</label>
              <Input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mode</label>
              <Select value={payMode} onValueChange={(v) => v && setPayMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Reference / UTR (optional)</label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <IconAction label="Record" icon={paying ? <Loader2 className="animate-spin" /> : <Banknote />} onClick={handleRecordPayment} disabled={paying || !payAmount} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
