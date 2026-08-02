'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IconAction } from "@/components/ui/icon-action";

export function FormsConfig() {
  const [saving, setSaving] = useState(false);
  
  const [pipelineId, setPipelineId] = useState('Sales');
  const [tag, setTag] = useState('inbound-lead');

  // Hardcoded for demo purposes
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/forms/capture` : 'https://crm.daylink.in/api/webhooks/forms/capture';

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  };

  async function handleSave() {
    setSaving(true);
    setTimeout(() => {
      toast.success('Lead Capture Settings saved');
      setSaving(false);
    }, 1000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      <div className="space-y-6">
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">Universal Form Webhook</CardTitle>
            <CardDescription className="text-muted-foreground">Send form submissions from any platform (Google Forms, Facebook Lead Ads, Webflow, Typeform) directly into Daily CRM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Your Unique Capture URL</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="bg-muted border-border text-foreground font-mono text-xs" />
                <IconAction
                  label="Copy"
                  icon={<Copy className="size-4" />}
                  variant="outline"
                  onClick={copyWebhook}
                  className="border-border text-foreground hover:text-foreground hover:bg-muted shrink-0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">Processing Rules</CardTitle>
            <CardDescription className="text-muted-foreground">How should new leads be handled when a form is submitted?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Assign to Pipeline</Label>
              <select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className="w-full h-10 rounded-md bg-muted border-border text-foreground px-3">
                <option value="Sales">Sales Pipeline</option>
                <option value="Support">Support Tickets</option>
                <option value="None">Don&apos;t create a deal</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Auto-Apply Tag</Label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. facebook-ad" className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
            </div>
            
            <div className="pt-4">
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving...</> : 'Save Rules'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Field Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Ensure your external form fields match these payload keys so Daily CRM can automatically parse them:
            </p>
            <div className="bg-background p-3 rounded-md border border-border">
              <pre className="text-xs text-foreground font-mono whitespace-pre-wrap">
{`{
  "name": "John Doe",
  "email": "john@ex.com",
  "phone": "+1234567890",
  "company": "Acme Inc"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
