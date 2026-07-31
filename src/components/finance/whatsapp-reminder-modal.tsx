"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, MessageSquare, AlertCircle, CheckCircle2, FileText, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface WhatsAppReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    displayName: string;
    phone?: string;
    phone_number?: string;
    outstanding_balance: number;
  } | null;
  workspaceId: string;
  workspaceName: string;
}

export function WhatsAppReminderModal({
  open,
  onOpenChange,
  customer,
  workspaceId,
  workspaceName,
}: WhatsAppReminderModalProps) {
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [templateApproved, setTemplateApproved] = useState<boolean | null>(null);

  const phone = customer?.phone || customer?.phone_number || "";
  const balance = Number(customer?.outstanding_balance || 0).toFixed(2);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!customer) return;
    const defaultMsg = `Hello ${customer.displayName}, this is a gentle payment reminder from ${workspaceName} regarding your pending Khata credit balance of ₹${balance}. Please make the payment at your earliest convenience. Thank you!`;
    setMessage(defaultMsg);
  }, [customer, balance, workspaceName]);

  // Check template approval status
  useEffect(() => {
    if (!open || !workspaceId) return;
    setChecking(true);

    fetch(`/api/whatsapp/templates?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        const templates = data.templates || [];
        const found = templates.find(
          (t: any) =>
            t.name === "payment_reminder" ||
            t.name === "khata_reminder" ||
            t.status === "APPROVED"
        );
        setTemplateApproved(!!found);
      })
      .catch(() => {
        // Fallback to true so user can try sending via 24h window
        setTemplateApproved(true);
      })
      .finally(() => setChecking(false));
  }, [open, workspaceId]);

  const handleSubmitTemplate = async () => {
    setSubmittingTemplate(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name: "payment_reminder",
          category: "UTILITY",
          language: "en_US",
          components: [
            {
              type: "BODY",
              text: "Hello {{1}}, this is a payment reminder from {{2}} regarding your pending balance of ₹{{3}}. Please make the payment at your earliest convenience.",
              example: {
                body_text: [["Valued Customer", workspaceName, balance]],
              },
            },
          ],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit template to Meta");

      toast.success("Payment reminder template submitted to Meta for approval!");
      setTemplateApproved(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit template");
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error("Customer phone number is missing");
      return;
    }
    setSending(true);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          to: phone,
          message_type: "text",
          content: message,
          contact_id: customer?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send WhatsApp message");

      toast.success("WhatsApp payment reminder sent natively via Daily CRM Inbox!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send WhatsApp message");
    } finally {
      setSending(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageSquare className="size-5 text-emerald-500" /> Send WhatsApp Reminder via CRM Inbox
            </DialogTitle>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
              {phone}
            </Badge>
          </div>
          <DialogDescription>
            Send payment reminder to <strong>{customer.displayName}</strong> for outstanding balance of <strong>₹{balance}</strong> directly through Daily CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSendReminder} className="space-y-4 py-2">
          {checking ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" /> Checking WhatsApp Meta Template Approval Status...
            </div>
          ) : templateApproved === false ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-amber-500">
                <AlertCircle className="size-4" /> Meta Payment Reminder Template Not Yet Submitted / Approved
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Meta Cloud API requires approved templates for sending business notifications outside active 24-hour customer windows. You can submit the standard payment reminder template for Meta review with 1-click below.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                onClick={handleSubmitTemplate}
                disabled={submittingTemplate}
              >
                {submittingTemplate ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Sparkles className="size-3.5 mr-1.5" />}
                Submit Payment Reminder Template for Meta Approval
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-md">
              <CheckCircle2 className="size-4" /> WhatsApp Native Direct Inbox Delivery Active
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Reminder Message Text</span>
              <span className="text-[10px] text-muted-foreground">{message.length} characters</span>
            </label>
            <Textarea plain
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="text-xs leading-relaxed"
              required
            />
          </div>

          <DialogFooter className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <FileText className="size-3.5 text-primary" /> Will be recorded in CRM Inbox
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {sending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Send className="size-4 mr-1.5" />}
                Send WhatsApp Reminder
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
