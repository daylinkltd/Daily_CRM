"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Mail, Send, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface IntegrationShareButtonsProps {
  workspaceId: string;
  documentTitle: string;
  documentSummary?: string;
  shareUrl?: string;
}

export function IntegrationShareButtons({
  workspaceId,
  documentTitle,
  documentSummary = "",
  shareUrl = "",
}: IntegrationShareButtonsProps) {
  const [waConnected, setWaConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [outlookModalOpen, setOutlookModalOpen] = useState(false);

  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [sendingWa, setSendingWa] = useState(false);

  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingOutlook, setSendingOutlook] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    // Check WhatsApp status
    fetch(`/api/whatsapp/config?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "connected" || d.configs?.length > 0) setWaConnected(true);
      })
      .catch(() => {});

    // Check Outlook status
    fetch(`/api/integrations/outlook?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.configured && d.status === "active") setOutlookConnected(true);
      })
      .catch(() => {});
  }, [workspaceId]);

  const defaultText = `Hi, sharing ${documentTitle} from Daily CRM: ${documentSummary} ${shareUrl ? `Link: ${shareUrl}` : ""}`.trim();

  const handleOpenWa = () => {
    setWaMessage(defaultText);
    setWaModalOpen(true);
  };

  const handleOpenOutlook = () => {
    setEmailSubject(`Shared: ${documentTitle}`);
    setEmailBody(defaultText);
    setOutlookModalOpen(true);
  };

  const handleSendWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waPhone.trim()) {
      toast.error("Please enter a WhatsApp phone number");
      return;
    }
    setSendingWa(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          to: waPhone.trim(),
          message_type: "text",
          content: waMessage,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send WhatsApp message");

      toast.success("Document shared natively via WhatsApp!");
      setWaModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to share via WhatsApp");
    } finally {
      setSendingWa(false);
    }
  };

  const handleSendOutlook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }
    setSendingOutlook(true);
    try {
      const res = await fetch("/api/integrations/outlook/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          to: emailTo.trim(),
          subject: emailSubject,
          bodyHtml: `<p>${emailBody.replace(/\n/g, "<br/>")}</p>`,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send email via Outlook");

      toast.success("Document shared via Microsoft Outlook!");
      setOutlookModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to share via Outlook");
    } finally {
      setSendingOutlook(false);
    }
  };

  if (!waConnected && !outlookConnected) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
        <Share2 className="size-3.5" /> Share:
      </span>

      {waConnected && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleOpenWa}
          className="size-8 p-0 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
          title="Share via WhatsApp Inbox"
        >
          <MessageSquare className="size-4" />
        </Button>
      )}

      {outlookConnected && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleOpenOutlook}
          className="size-8 p-0 border-blue-500/30 text-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
          title="Share via Microsoft Outlook"
        >
          <Mail className="size-4" />
        </Button>
      )}

      {/* WhatsApp Share Modal */}
      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-5 text-emerald-500" /> Share via WhatsApp Inbox
            </DialogTitle>
            <DialogDescription>
              Directly message {documentTitle} to any phone number using your CRM WhatsApp API.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendWa} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Recipient Phone Number (with Country Code)</Label>
              <Input
                placeholder="e.g. +919876543210"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={4}
                className="text-xs"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setWaModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingWa} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {sendingWa ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Send className="size-4 mr-1.5" />}
                Send WhatsApp
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Outlook Share Modal */}
      <Dialog open={outlookModalOpen} onOpenChange={setOutlookModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="size-5 text-blue-500" /> Share via Microsoft Outlook
            </DialogTitle>
            <DialogDescription>
              Send an email with {documentTitle} using your Outlook App Registration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendOutlook} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Recipient Email Address</Label>
              <Input
                type="email"
                placeholder="recipient@company.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Body</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={4}
                className="text-xs"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOutlookModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingOutlook} className="bg-blue-600 hover:bg-blue-700 text-white">
                {sendingOutlook ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Send className="size-4 mr-1.5" />}
                Send Email
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
