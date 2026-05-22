'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Copy, CheckCircle2, XCircle, Loader2, ExternalLink, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

const MASKED_TOKEN = '••••••••••••••••';
type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

export function InstagramConfig() {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('Configure your Instagram Graph API credentials below.');

  const [accountId, setAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/instagram/webhook` : '';

  async function handleSave() {
    if (!accountId.trim()) {
      toast.error('Instagram Account ID is required');
      return;
    }
    if (!accessToken.trim()) {
      toast.error('Access Token is required');
      return;
    }

    setSaving(true);
    // Simulate API call to save config
    setTimeout(() => {
      toast.success('Instagram Configuration saved successfully');
      setConnectionStatus('connected');
      setStatusMessage('');
      setSaving(false);
    }, 1000);
  }

  async function handleTestConnection() {
    setTesting(true);
    // Simulate API call to test connection
    setTimeout(() => {
      toast.success('Successfully connected to Instagram API');
      setConnectionStatus('connected');
      setTesting(false);
    }, 1000);
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* Main config form */}
      <div className="space-y-6">
        {/* Connection Status */}
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="size-4 text-[#00aef0]" />
            ) : (
              <XCircle className="size-4 text-red-500" />
            )}
            <AlertTitle className="text-white mb-0">
              {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-slate-400">
            {connectionStatus === 'connected'
              ? 'Your Instagram account is connected and ready to receive DMs.'
              : statusMessage}
          </AlertDescription>
        </Alert>

        {/* API Credentials */}
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">API Credentials</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your Instagram Graph API credentials to start receiving DMs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Instagram Account ID</Label>
              <Input
                placeholder="e.g. 17841400000000000"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                The ID of the Instagram Professional account you want to connect.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Long-Lived Page Access Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your Page Access Token"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Must be linked to the Facebook Page connected to your Instagram account.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Webhook Verify Token</Label>
              <Input
                placeholder="Create a custom verify token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Webhook URL */}
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">Webhook Configuration</CardTitle>
            <CardDescription className="text-slate-400">
              Use this URL in your Meta App Dashboard for Instagram.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-slate-300">Webhook Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                  className="shrink-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-[#00aef0] hover:bg-[#00aef0]/90 text-white">
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving...</> : 'Save Configuration'}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div>
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white text-base">Setup Instructions</CardTitle>
            <CardDescription className="text-slate-400">
              Follow these steps to connect Instagram DMs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem className="border-slate-700">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-[#00aef0] text-xs font-bold text-white">1</span>
                    Link Instagram to Facebook Page
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to your Facebook Page Settings</li>
                    <li>Click &quot;Linked Accounts&quot;</li>
                    <li>Select Instagram and connect your account. Make sure it's a Professional account.</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem className="border-slate-700">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-[#00aef0] text-xs font-bold text-white">2</span>
                    Enable Message Access
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Open Instagram app on your phone</li>
                    <li>Go to Settings &gt; Privacy &gt; Messages</li>
                    <li>Turn on &quot;Allow access to messages&quot;</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
