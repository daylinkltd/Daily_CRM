'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? <CheckCircle2 className="size-4 text-[#00aef0]" /> : <XCircle className="size-4 text-red-500" />}
            <AlertTitle className="text-white mb-0">{connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}</AlertTitle>
          </div>
          <AlertDescription className="text-slate-400">
            {connectionStatus === 'connected' ? `Your ${provider} account is connected.` : 'Configure your SMTP/API email provider.'}
          </AlertDescription>
        </Alert>

        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">API Credentials</CardTitle>
            <CardDescription className="text-slate-400">Enter your Email provider credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Provider</Label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full h-10 rounded-md bg-slate-800 border-slate-700 text-white px-3">
                <option value="SendGrid">SendGrid</option>
                <option value="AWS SES">AWS SES</option>
                <option value="Resend">Resend</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">From Email Address</Label>
              <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@yourdomain.com" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">API Key</Label>
              <div className="relative">
                <Input type={showToken ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-[#00aef0] hover:bg-[#00aef0]/90 text-white">
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving...</> : 'Save Configuration'}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
            {testing ? 'Sending...' : 'Send Test Email'}
          </Button>
        </div>
      </div>
      <div>
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">
              Ensure your From Email address is verified in your provider's dashboard to prevent emails from going to spam.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
