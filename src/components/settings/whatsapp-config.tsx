'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  PhoneCall,
  Bot,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

const MASKED_TOKEN = '••••••••••••••••';

type Provider = 'meta' | 'twilio' | 'mock';
type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

interface ProviderTab {
  id: Provider;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const PROVIDER_TABS: ProviderTab[] = [
  {
    id: 'meta',
    label: 'Meta Cloud API',
    icon: <MessageSquare className="h-4 w-4" />,
    description: 'Official Meta WhatsApp Cloud API. Best for production use.',
    color: 'text-blue-400',
  },
  {
    id: 'twilio',
    label: 'Twilio',
    icon: <PhoneCall className="h-4 w-4" />,
    description: 'Twilio WhatsApp Sandbox & Business messaging.',
    color: 'text-rose-400',
  },
  {
    id: 'mock',
    label: 'Sandbox Simulator',
    icon: <Bot className="h-4 w-4" />,
    description: 'Free local simulator. No real messages sent.',
    color: 'text-emerald-400',
  },
];

export function WhatsAppConfig() {
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [statusMessage, setStatusMessage] = useState('');
  const [showResetBanner, setShowResetBanner] = useState(false);

  // Provider selection
  const [selectedProvider, setSelectedProvider] = useState<Provider>('meta');

  // Shared fields
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // Meta-specific
  const [wabaId, setWabaId] = useState('');

  // Twilio-specific (accountSid reuses wabaId field, authToken reuses accessToken)
  // Phone number uses phoneNumberId — shared field

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/config?workspace_id=${activeWorkspace.id}`);
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setHasConfig(true);
        setShowResetBanner(false);
        setStatusMessage('');
        if (payload.provider) setSelectedProvider(payload.provider as Provider);
        // Only set masking if config exists
        setPhoneNumberId('');
        setAccessToken(MASKED_TOKEN);
        setTokenEdited(false);
        setWabaId('');
        setVerifyToken('');
      } else if (payload.reason === 'no_config') {
        setConnectionStatus('disconnected');
        setHasConfig(false);
        setShowResetBanner(false);
        setStatusMessage(payload.message || '');
        resetFormFields();
      } else if (payload.reason === 'token_corrupted') {
        setConnectionStatus('disconnected');
        setHasConfig(true);
        setShowResetBanner(true);
        setStatusMessage(payload.message || '');
      } else {
        setConnectionStatus('disconnected');
        setHasConfig(payload.reason !== 'no_config');
        setShowResetBanner(false);
        setStatusMessage(payload.message || '');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  function resetFormFields() {
    setPhoneNumberId('');
    setWabaId('');
    setAccessToken('');
    setVerifyToken('');
    setTokenEdited(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || !activeWorkspace?.id) {
      setLoading(false);
      return;
    }
    fetchConfig();
  }, [authLoading, user, activeWorkspace?.id, fetchConfig]);

  async function handleSave() {
    if (!activeWorkspace?.id) {
      toast.error('No active workspace selected');
      return;
    }
    if (!phoneNumberId.trim()) {
      toast.error(selectedProvider === 'twilio' ? 'Twilio Phone Number is required' : 'Phone Number ID is required');
      return;
    }
    if (!hasConfig && (!accessToken.trim() || !tokenEdited)) {
      toast.error(selectedProvider === 'twilio' ? 'Auth Token is required for initial setup' : 'Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        workspace_id: activeWorkspace.id,
        provider: selectedProvider,
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (hasConfig && !tokenEdited) {
        // For mock provider, send a placeholder — no real token needed
        if (selectedProvider === 'mock') {
          payload.access_token = 'mock-token';
        } else {
          toast.error('Please re-enter the token/credentials to save changes');
          setSaving(false);
          return;
        }
      } else if (!hasConfig && selectedProvider === 'mock') {
        payload.access_token = 'mock-token';
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        return;
      }

      const providerName = PROVIDER_TABS.find(p => p.id === selectedProvider)?.label || selectedProvider;
      toast.success(
        data.phone_info?.verifiedName
          ? `Connected to ${data.phone_info.verifiedName} via ${providerName}`
          : `${providerName} configuration saved successfully`
      );

      await fetchConfig();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    if (!activeWorkspace?.id) return;
    try {
      setTesting(true);
      const res = await fetch(`/api/whatsapp/config?workspace_id=${activeWorkspace.id}`);
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setShowResetBanner(false);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verifiedName
            ? `Connected to ${payload.phone_info.verifiedName}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setShowResetBanner(payload.reason === 'token_corrupted');
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!activeWorkspace?.id) return;
    if (!confirm('This will delete the current WhatsApp config so you can re-enter it. Continue?')) return;

    try {
      setResetting(true);
      const res = await fetch(`/api/whatsapp/config?workspace_id=${activeWorkspace.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setHasConfig(false);
      setConnectionStatus('disconnected');
      setShowResetBanner(false);
      setStatusMessage('');
      resetFormFields();
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-[#00aef0]" />
      </div>
    );
  }

  const currentTab = PROVIDER_TABS.find(p => p.id === selectedProvider)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* ── Main config form ── */}
      <div className="space-y-6">

        {/* Token-corrupted reset banner */}
        {showResetBanner && (
          <Alert className="bg-amber-950/40 border-amber-600/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-200 mb-1">Stored token can&apos;t be decrypted</AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">{statusMessage}</AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetting ? <><Loader2 className="size-4 animate-spin" /> Resetting...</> : <><RotateCcw className="size-4" /> Reset Configuration</>}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Connection status */}
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected'
              ? <CheckCircle2 className="size-4 text-[#00aef0]" />
              : <XCircle className="size-4 text-red-500" />}
            <AlertTitle className="text-white mb-0">
              {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-slate-400 mt-1">
            {connectionStatus === 'connected'
              ? `Your WhatsApp Business API is connected via ${currentTab.label} and ready to send/receive messages.`
              : statusMessage || 'Select a provider below, fill in your credentials, and save.'}
          </AlertDescription>
        </Alert>

        {/* ── Provider selector ── */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">WhatsApp Provider</CardTitle>
            <CardDescription className="text-slate-400">
              Choose the API provider to send and receive WhatsApp messages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PROVIDER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedProvider(tab.id)}
                  className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200 ${
                    selectedProvider === tab.id
                      ? 'border-[#00aef0]/50 bg-[#00aef0]/5 ring-1 ring-[#00aef0]/30'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className={`${tab.color} ${selectedProvider === tab.id ? '' : 'text-slate-500'} transition-colors`}>
                    {tab.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${selectedProvider === tab.id ? 'text-white' : 'text-slate-400'}`}>
                      {tab.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{tab.description}</p>
                  </div>
                  {selectedProvider === tab.id && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#00aef0] shadow-sm shadow-[#00aef0]/50" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Provider-specific credential fields ── */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className={currentTab.color}>{currentTab.icon}</span>
              {currentTab.label} Credentials
            </CardTitle>
            <CardDescription className="text-slate-400">
              {selectedProvider === 'meta' && 'Enter your Meta WhatsApp Business API credentials from the Meta Developer Dashboard.'}
              {selectedProvider === 'twilio' && 'Enter your Twilio Account SID, Auth Token, and WhatsApp sender number.'}
              {selectedProvider === 'mock' && 'No real credentials needed — the simulator accepts any values and returns instant successes.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Phone Number ID / Sender Number */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                {selectedProvider === 'twilio' ? 'Twilio Sender Number' : 'Phone Number ID'}
              </Label>
              <Input
                placeholder={
                  selectedProvider === 'twilio'
                    ? 'e.g. +14155238886'
                    : selectedProvider === 'mock'
                    ? 'e.g. sim-phone-001'
                    : 'e.g. 100234567890123'
                }
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {/* WABA ID / Account SID — not shown for mock */}
            {selectedProvider !== 'mock' && (
              <div className="space-y-2">
                <Label className="text-slate-300">
                  {selectedProvider === 'twilio' ? 'Twilio Account SID' : 'WhatsApp Business Account ID'}
                </Label>
                <Input
                  placeholder={
                    selectedProvider === 'twilio'
                      ? 'e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                      : 'e.g. 100234567890456'
                  }
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            )}

            {/* Access Token / Auth Token — not shown for mock */}
            {selectedProvider !== 'mock' && (
              <div className="space-y-2">
                <Label className="text-slate-300">
                  {selectedProvider === 'twilio' ? 'Auth Token' : 'Permanent Access Token'}
                </Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder={selectedProvider === 'twilio' ? 'Enter your Twilio Auth Token' : 'Enter your Meta access token'}
                    value={accessToken}
                    onChange={(e) => { setAccessToken(e.target.value); setTokenEdited(true); }}
                    onFocus={() => {
                      if (accessToken === MASKED_TOKEN) {
                        setAccessToken('');
                        setTokenEdited(true);
                      }
                    }}
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
                {hasConfig && !tokenEdited && (
                  <p className="text-xs text-slate-500">Token is hidden for security. Re-enter it to update.</p>
                )}
              </div>
            )}

            {/* Mock simulator notice */}
            {selectedProvider === 'mock' && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-sm text-emerald-400 font-medium mb-1">Sandbox mode active</p>
                <p className="text-xs text-slate-400">
                  All messages will be logged to the console and stored in the database as sent — no real WhatsApp messages will be delivered. Perfect for testing automations and broadcasts locally.
                </p>
              </div>
            )}

            {/* Webhook Verify Token — Meta only */}
            {selectedProvider === 'meta' && (
              <div className="space-y-2">
                <Label className="text-slate-300">Webhook Verify Token</Label>
                <Input
                  placeholder="Create a custom verify token"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">
                  A custom string you create. Must match the token you set in Meta webhook settings.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook URL — shown for Meta only */}
        {selectedProvider === 'meta' && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Webhook Configuration</CardTitle>
              <CardDescription className="text-slate-400">
                Use this URL as your webhook callback in the Meta App Dashboard.
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
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#00aef0] hover:bg-[#00aef0]/90 text-white shadow-lg shadow-[#00aef0]/10"
          >
            {saving ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : 'Save Configuration'}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !hasConfig}
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            {testing ? <><Loader2 className="size-4 animate-spin" /> Testing...</> : <><Zap className="size-4" /> Test Connection</>}
          </Button>
          {hasConfig && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
            >
              {resetting ? <><Loader2 className="size-4 animate-spin" /> Resetting...</> : <><RotateCcw className="size-4" /> Reset Configuration</>}
            </Button>
          )}
        </div>
      </div>

      {/* ── Setup Instructions Sidebar ── */}
      <div>
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Setup Instructions</CardTitle>
            <CardDescription className="text-slate-400">
              {selectedProvider === 'meta' && 'Connect your Meta WhatsApp Cloud API account.'}
              {selectedProvider === 'twilio' && 'Connect your Twilio WhatsApp messaging account.'}
              {selectedProvider === 'mock' && 'No setup required — just save and start testing.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProvider === 'meta' && (
              <Accordion>
                <AccordionItem className="border-slate-700">
                  <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#00aef0] text-xs font-bold text-white">1</span>
                      Create a Meta App
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Go to <span className="text-[#00aef0]">developers.facebook.com</span></li>
                      <li>Click &quot;My Apps&quot; → &quot;Create App&quot;</li>
                      <li>Select &quot;Business&quot; as the app type</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem className="border-slate-700">
                  <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#00aef0] text-xs font-bold text-white">2</span>
                      Add WhatsApp Product
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>In your app dashboard, click &quot;Add Product&quot;</li>
                      <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                      <li>Follow the setup wizard to link your business</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem className="border-slate-700">
                  <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#00aef0] text-xs font-bold text-white">3</span>
                      Get API Credentials
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Go to WhatsApp &gt; API Setup</li>
                      <li>Copy your <strong className="text-slate-200">Phone Number ID</strong></li>
                      <li>Copy your <strong className="text-slate-200">WhatsApp Business Account ID</strong></li>
                      <li>Generate a <strong className="text-slate-200">Permanent Access Token</strong> from Business Settings &gt; System Users</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem className="border-slate-700">
                  <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#00aef0] text-xs font-bold text-white">4</span>
                      Configure Webhooks
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Go to WhatsApp &gt; Configuration</li>
                      <li>Click &quot;Edit&quot; on the Webhook section</li>
                      <li>Paste the <strong className="text-slate-200">Webhook Callback URL</strong></li>
                      <li>Enter the same <strong className="text-slate-200">Verify Token</strong> you set here</li>
                      <li>Subscribe to &quot;messages&quot; webhook field</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {selectedProvider === 'twilio' && (
              <Accordion>
                <AccordionItem className="border-slate-700">
                  <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">1</span>
                      Get Twilio Credentials
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Go to <span className="text-rose-400">console.twilio.com</span></li>
                      <li>Copy your <strong className="text-slate-200">Account SID</strong> (WABA ID field)</li>
                      <li>Copy your <strong className="text-slate-200">Auth Token</strong> (Access Token field)</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem className="border-slate-700">
                  <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">2</span>
                      Set Up WhatsApp Sender
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>In Twilio Console, go to Messaging &gt; Try it out &gt; Send a WhatsApp message</li>
                      <li>Note your <strong className="text-slate-200">Twilio WhatsApp Number</strong> (e.g. +14155238886)</li>
                      <li>For production, request a dedicated sender in Messaging &gt; Senders</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {selectedProvider === 'mock' && (
              <div className="space-y-3 text-sm text-slate-400">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-emerald-400 font-medium mb-2">✓ No configuration needed</p>
                  <p>The Sandbox Simulator works immediately after saving. Use any placeholder values in the Phone Number field.</p>
                </div>
                <p>All sends will appear in the inbox as delivered, and the message IDs will start with <code className="text-emerald-400 bg-slate-800 px-1 rounded">mock-msg-</code>.</p>
                <p>Perfect for testing automations, broadcasts, and CRM workflows without incurring API costs.</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
              {selectedProvider === 'meta' && (
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#00aef0] hover:text-[#00aef0]/80 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Meta WhatsApp API Documentation
                </a>
              )}
              {selectedProvider === 'twilio' && (
                <a
                  href="https://www.twilio.com/docs/whatsapp/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Twilio WhatsApp API Documentation
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
