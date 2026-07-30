"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2, CheckCircle2, ShieldCheck, HelpCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface OutlookConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSaved?: () => void;
}

export function OutlookConfigModal({
  open,
  onOpenChange,
  workspaceId,
  onSaved,
}: OutlookConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoading(true);

    fetch(`/api/integrations/outlook?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setTenantId(data.tenantId || "");
          setClientId(data.clientId || "");
          setFromEmail(data.fromEmail || "");
          setConnected(true);
          setClientSecret(""); // Leave empty to keep existing encrypted secret
        } else {
          setConnected(false);
        }
      })
      .catch((err) => {
        toast.error("Failed to load Outlook configuration");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [open, workspaceId]);

  const handleTestConnection = async () => {
    if (!tenantId || !clientId || !fromEmail) {
      toast.error("Please fill in Tenant ID, Client ID, and From Email");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/outlook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          tenantId,
          clientId,
          clientSecret,
          fromEmail,
          action: "test",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Connection test failed");

      toast.success(json.message || "Connected to Microsoft Outlook Graph API successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to Microsoft Outlook");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/outlook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          tenantId,
          clientId,
          clientSecret,
          fromEmail,
          action: "save",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save configuration");

      toast.success("Microsoft Outlook integration saved and active!");
      setConnected(true);
      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Mail className="size-6 text-blue-500" /> Microsoft Outlook Integration (App Registration)
            </DialogTitle>
            {connected && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 gap-1">
                <CheckCircle2 className="size-3.5" /> Connected
              </Badge>
            )}
          </div>
          <DialogDescription>
            Configure Microsoft Azure AD App Registration (Client Credentials Grant) to send emails via Microsoft Graph API for your entire workspace.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 py-2">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-blue-400">
                <HelpCircle className="size-4" /> Azure Portal Registration Guide
              </div>
              <p className="text-muted-foreground leading-relaxed">
                In Azure Portal → App Registrations: register your app, grant <strong>Mail.Send</strong> application permission under Microsoft Graph, and grant admin consent.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Directory (Tenant) ID</Label>
                <Input
                  placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Application (Client) ID</Label>
                <Input
                  placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  placeholder={connected ? "•••••••••••• (Leave blank to keep existing)" : "Enter Azure Client Secret value"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  required={!connected}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Sender Mailbox Address (From Email)</Label>
                <Input
                  type="email"
                  placeholder="e.g. sales@yourcompany.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || saving}
              >
                {testing ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldCheck className="size-4 mr-2 text-blue-500" />}
                Test Connection
              </Button>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                  Save & Connect Outlook
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
