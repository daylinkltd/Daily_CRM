"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { createClient } from "@/lib/supabase/client";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import {
  MessageSquare,
  PlugZap,
  Save,
  Loader2,
  Users,
  Coins,
  Bot,
  FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function CRMSettingsPanel() {
  const supabase = createClient();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [autoAssignLeads, setAutoAssignLeads] = useState(true);
  const [staleDealDays, setStaleDealDays] = useState(14);
  const [enableWhatsAppAutoReply, setEnableWhatsAppAutoReply] = useState(true);
  const [leadCaptureNotifyEmail, setLeadCaptureNotifyEmail] = useState("");

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("workspaces")
        .select("plan_limits")
        .eq("id", activeWorkspace.id)
        .maybeSingle();

      if (data?.plan_limits?.crm_settings) {
        const crm = data.plan_limits.crm_settings;
        setAutoAssignLeads(crm.autoAssignLeads ?? true);
        setStaleDealDays(crm.staleDealDays ?? 14);
        setEnableWhatsAppAutoReply(crm.enableWhatsAppAutoReply ?? true);
        setLeadCaptureNotifyEmail(crm.leadCaptureNotifyEmail || "");
      }
      setLoading(false);
    };

    fetchSettings();
  }, [activeWorkspace?.id, supabase]);

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    setSaving(true);

    try {
      const { data: currentWs } = await supabase
        .from("workspaces")
        .select("plan_limits")
        .eq("id", activeWorkspace.id)
        .single();

      const existingLimits = currentWs?.plan_limits || {};
      const updatedLimits = {
        ...existingLimits,
        crm_settings: {
          autoAssignLeads,
          staleDealDays,
          enableWhatsAppAutoReply,
          leadCaptureNotifyEmail,
          updated_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from("workspaces")
        .update({ plan_limits: updatedLimits })
        .eq("id", activeWorkspace.id);

      if (error) throw error;
      toast.success("CRM & Pipeline settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save CRM settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading CRM Settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl text-foreground">
      <SettingsPanelHead
        title="CRM & Pipeline Settings"
        description="Configure lead assignment rules, deal pipeline triggers, WhatsApp channels, and automated follow-ups."
        action={
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 shadow-xs"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Changes
          </Button>
        }
      />

      {/* Quick Jump Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/settings?tab=whatsapp" className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <PlugZap className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">WhatsApp API</h4>
            <p className="text-[11px] text-muted-foreground">Manage WABA numbers</p>
          </div>
        </Link>

        <Link href="/settings?tab=chatbot" className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Bot className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">AI Chatbot</h4>
            <p className="text-[11px] text-muted-foreground">Auto-reply assistant</p>
          </div>
        </Link>

        <Link href="/settings?tab=templates" className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
            <FileText className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Templates</h4>
            <p className="text-[11px] text-muted-foreground">WhatsApp & Email templates</p>
          </div>
        </Link>
      </div>

      {/* 1. Lead & Pipeline Rules */}
      <Card className="bg-card border-border shadow-xs rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <MessageSquare className="size-4 text-primary" /> Lead Routing & Pipeline Rules
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Automate incoming contact distribution and deal stale alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Auto-Assign New Leads (Round-Robin)</Label>
              <p className="text-[11px] text-muted-foreground">Automatically distribute new incoming WhatsApp & form leads among active team members.</p>
            </div>
            <Switch
              checked={autoAssignLeads}
              onCheckedChange={setAutoAssignLeads}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Enable WhatsApp Instant Auto-Response</Label>
              <p className="text-[11px] text-muted-foreground">Send welcoming auto-reply when a new customer messages outside business hours.</p>
            </div>
            <Switch
              checked={enableWhatsAppAutoReply}
              onCheckedChange={setEnableWhatsAppAutoReply}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mark Deals Stale After (Days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={staleDealDays}
                onChange={(e) => setStaleDealDays(Number(e.target.value))}
                className="bg-background text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Highlight pipeline deals with no recent activity or stage change.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Lead Notification Email</Label>
              <Input
                type="email"
                placeholder="sales-lead@yourcompany.com"
                value={leadCaptureNotifyEmail}
                onChange={(e) => setLeadCaptureNotifyEmail(e.target.value)}
                className="bg-background text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Email address to receive immediate lead capture summaries.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
