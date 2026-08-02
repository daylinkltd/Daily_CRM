"use client";

/**
 * Receivables payment reminder — sent through the WhatsApp inbox.
 *
 * Rewritten because none of this could work before: it posted a phone
 * number to /api/whatsapp/send (which needs a `conversation_id`), and
 * it "checked" template approval against an endpoint that does not
 * exist — whose `.catch()` set approved = true, so the green banner
 * always claimed delivery was active.
 *
 * Now /api/finance/payment-reminder resolves the real state (the
 * contact's conversation, whether the 24-hour customer-service window
 * is open, and the template's actual status from message_templates),
 * and this component sends via /api/whatsapp/send:
 *   - window open  → free text, editable
 *   - window shut  → the approved `payment_reminder` template
 *   - not approved → offer to submit it to Meta for approval
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Send, Loader2, MessageSquare, AlertCircle, CheckCircle2, Clock, FileText,
} from "lucide-react";

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
import { IconAction } from "@/components/ui/icon-action";

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

interface ReminderContext {
  conversation_id: string;
  window_open: boolean;
  hours_remaining: number;
  contact: { id: string; name: string | null; phone: string };
  template: {
    name: string;
    language: string;
    status: string;
    approved: boolean;
    body_text: string;
    footer_text: string | null;
  } | null;
}

/** Matches the seeded `payment_reminder` body: name, invoice, amount, due date. */
function templateParams(customerName: string, amount: string, dueDate: string): string[] {
  return [customerName, "Khata balance", amount, dueDate];
}

export function WhatsAppReminderModal({
  open,
  onOpenChange,
  customer,
  workspaceId,
  workspaceName,
}: WhatsAppReminderModalProps) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [ctx, setCtx] = useState<ReminderContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const balance = Number(customer?.outstanding_balance || 0).toFixed(2);
  // Meta requires no newlines/tabs and no doubled spaces in params.
  const amountParam = `INR ${balance}`;
  const dueDate = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  const loadContext = useCallback(async () => {
    if (!open || !workspaceId || !customer?.id) return;
    setLoading(true);
    setError(null);
    setCtx(null);
    try {
      const res = await fetch("/api/finance/payment-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, contact_id: customer.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not prepare the reminder");
      setCtx(json as ReminderContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the reminder");
    } finally {
      setLoading(false);
    }
  }, [open, workspaceId, customer?.id]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!customer) return;
    setMessage(
      `Hello ${customer.displayName}, this is a gentle payment reminder from ${workspaceName} regarding your pending Khata balance of ₹${balance}. Please make the payment at your earliest convenience. Thank you!`
    );
  }, [customer, balance, workspaceName]);

  async function handleSend() {
    if (!ctx || !customer) return;
    setSending(true);
    try {
      const payload = ctx.window_open
        ? {
            conversation_id: ctx.conversation_id,
            message_type: "text",
            content_text: message.trim(),
          }
        : {
            conversation_id: ctx.conversation_id,
            message_type: "template",
            template_name: ctx.template?.name,
            template_language: ctx.template?.language,
            template_message_params: {
              body: templateParams(customer.displayName, amountParam, dueDate),
            },
          };

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send WhatsApp message");

      toast.success(
        ctx.window_open
          ? "Reminder sent — it's in the customer's inbox thread"
          : "Template reminder sent — it's in the customer's inbox thread"
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send WhatsApp message");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmitTemplate() {
    setSubmittingTemplate(true);
    try {
      // Flat payload shape that /api/whatsapp/templates/submit expects.
      const res = await fetch("/api/whatsapp/templates/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: "payment_reminder",
          category: "Utility",
          language: "en_US",
          body_text:
            "Hi {{1}}, this is a friendly reminder that invoice {{2}} for {{3}} is due on {{4}}. If you have already paid, please ignore this message.",
          footer_text: "Thank you for your business.",
          sample_values: { body: ["Priya", "Khata balance", "INR 12,500", "5 Aug 2026"] },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit template");
      toast.success("Template submitted to Meta — approval usually takes a few minutes");
      await loadContext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit template");
    } finally {
      setSubmittingTemplate(false);
    }
  }

  const templateStatus = ctx?.template?.status ?? null;
  const canSend = ctx ? (ctx.window_open ? message.trim().length > 0 : !!ctx.template?.approved) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-emerald-500" />
            Send Payment Reminder
          </DialogTitle>
          <DialogDescription>
            {customer?.displayName} — outstanding ₹{balance}. Sent through your WhatsApp
            inbox, so the thread stays with the customer record.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Can&apos;t send a reminder yet</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
        ) : ctx ? (
          <div className="space-y-4">
            {/* Window state — the real reason a template is or isn't needed */}
            {ctx.window_open ? (
              <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  24-hour reply window is open ({ctx.hours_remaining}h remaining) — your
                  message sends as free text.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                <Clock className="mt-0.5 size-4 shrink-0" />
                <span>
                  The customer hasn&apos;t messaged in the last 24 hours, so WhatsApp only
                  allows an approved template. {templateStatus === "APPROVED"
                    ? "Your reminder template is approved and will be used."
                    : "Submit the reminder template for approval to continue."}
                </span>
              </div>
            )}

            {ctx.window_open ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Message</label>
                  <span className="text-[10px] text-muted-foreground">
                    {message.length} characters
                  </span>
                </div>
                <Textarea
                  plain
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Template preview
                  </label>
                  {templateStatus && (
                    <Badge
                      variant="outline"
                      className={
                        templateStatus === "APPROVED"
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-yellow-500/30 text-yellow-400"
                      }
                    >
                      {templateStatus}
                    </Badge>
                  )}
                </div>
                {ctx.template ? (
                  <div className="space-y-2 border border-border bg-muted/30 p-3 text-sm">
                    <p className="whitespace-pre-line">
                      {ctx.template.body_text
                        .replace("{{1}}", customer?.displayName ?? "")
                        .replace("{{2}}", "Khata balance")
                        .replace("{{3}}", amountParam)
                        .replace("{{4}}", dueDate)}
                    </p>
                    {ctx.template.footer_text && (
                      <p className="text-xs text-muted-foreground">{ctx.template.footer_text}</p>
                    )}
                  </div>
                ) : (
                  <div className="border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    No <code>payment_reminder</code> template exists in this workspace yet.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {ctx && !ctx.window_open && !ctx.template?.approved && (
            <IconAction label="Submit template for approval" icon={submittingTemplate ? <Loader2 className="animate-spin" /> : <FileText />} variant="outline" onClick={handleSubmitTemplate} disabled={submittingTemplate} />
          )}
          <Button onClick={handleSend} disabled={!canSend || sending || loading}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {ctx && !ctx.window_open ? "Send template reminder" : "Send reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
