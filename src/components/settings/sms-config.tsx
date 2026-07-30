'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function SmsConfig() {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');

  async function handleSave() {
    if (!accountSid.trim() || !authToken.trim() || !fromNumber.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      toast.success('SMS Configuration saved successfully');
      setConnectionStatus('connected');
      setSaving(false);
    }, 1000);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTimeout(() => {
      toast.success('Successfully sent test SMS');
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
            {connectionStatus === 'connected' ? 'Your Twilio account is connected.' : 'Configure your Twilio credentials below.'}
          </AlertDescription>
        </Alert>

        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">API Credentials</CardTitle>
            <CardDescription className="text-muted-foreground">Enter your Twilio API credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Account SID</Label>
              <Input value={accountSid} onChange={(e) => setAccountSid(e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Auth Token</Label>
              <div className="relative">
                <Input type={showToken ? 'text' : 'password'} value={authToken} onChange={(e) => setAuthToken(e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Twilio Phone Number</Label>
              <Input value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} placeholder="+1234567890" className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving...</> : 'Save Configuration'}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="border-border text-foreground hover:text-foreground hover:bg-muted">
            {testing ? 'Sending...' : 'Send Test SMS'}
          </Button>
        </div>
      </div>
      <div>
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Twilio Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You can find your Account SID and Auth Token on the homepage of the Twilio Console. Ensure your Twilio phone number is SMS-capable.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
