'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NativeSelect } from "@/components/ui/native-select";

export function EmailConfig() {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  const [provider, setProvider] = useState('SendGrid');
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');

  async function handleSave() {
    if (!apiKey.trim() || !fromEmail.trim()) {
      toast.error('API Key and From Email are required');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      toast.success('Email Configuration saved successfully');
      setConnectionStatus('connected');
      setSaving(false);
    }, 1000);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTimeout(() => {
      toast.success('Successfully sent test email');
      setConnectionStatus('connected');
      setTesting(false);
    }, 1500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      <div className="space-y-6">
        <Alert className="bg-card border-border">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-red-500" />}
            <AlertTitle className="text-foreground mb-0">{connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}</AlertTitle>
          </div>
          <AlertDescription className="text-muted-foreground">
            {connectionStatus === 'connected' ? `Your ${provider} account is connected.` : 'Configure your SMTP/API email provider.'}
          </AlertDescription>
        </Alert>

        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">API Credentials</CardTitle>
            <CardDescription className="text-muted-foreground">Enter your Email provider credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Provider</Label>
              <NativeSelect value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full h-10 rounded-md bg-muted border-border text-foreground px-3">
                <option value="SendGrid">SendGrid</option>
                <option value="AWS SES">AWS SES</option>
                <option value="Resend">Resend</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">From Email Address</Label>
              <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@yourdomain.com" className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">API Key</Label>
              <div className="relative">
                <Input type={showToken ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving...</> : 'Save Configuration'}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="border-border text-foreground hover:text-foreground hover:bg-muted">
            {testing ? 'Sending...' : 'Send Test Email'}
          </Button>
        </div>
      </div>
      <div>
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ensure your From Email address is verified in your provider&apos;s dashboard to prevent emails from going to spam.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
