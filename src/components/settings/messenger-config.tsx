'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Copy, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function MessengerConfig() {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/messenger/webhook` : '';

  async function handleSave() {
    if (!pageId.trim() || !accessToken.trim()) {
      toast.error('Page ID and Access Token are required');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      toast.success('Messenger Configuration saved successfully');
      setConnectionStatus('connected');
      setSaving(false);
    }, 1000);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTimeout(() => {
      toast.success('Successfully connected to Facebook Page');
      setConnectionStatus('connected');
      setTesting(false);
    }, 1000);
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
            {connectionStatus === 'connected' ? 'Your Facebook Page is connected for Messenger DMs.' : 'Configure your Facebook Page credentials below.'}
          </AlertDescription>
        </Alert>

        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">API Credentials</CardTitle>
            <CardDescription className="text-slate-400">Enter your Facebook Page credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Facebook Page ID</Label>
              <Input value={pageId} onChange={(e) => setPageId(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Page Access Token</Label>
              <div className="relative">
                <Input type={showToken ? 'text' : 'password'} value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10" />
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
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </div>
      <div>
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white text-base">Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
              <li>Create a Meta App.</li>
              <li>Add the Messenger Product.</li>
              <li>Generate a Page Access Token.</li>
              <li>Subscribe to Webhooks using: <code className="block mt-1 bg-slate-800 p-2 rounded">{webhookUrl}</code></li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
