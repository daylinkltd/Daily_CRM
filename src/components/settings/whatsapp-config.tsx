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
import { cn } from '@/lib/utils';
import { IconAction } from "@/components/ui/icon-action";

const MASKED_TOKEN = '••••••••••••••••';

type Provider = 'meta' | 'twilio' | 'mock' | 'apiauto';
type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

interface ProviderTab {
  id: Provider;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PROVIDER_TABS: ProviderTab[] = [
  {
    id: 'meta',
    label: 'Meta Cloud API',
    icon: <MessageSquare className="h-4 w-4 shrink-0" />,
    description: 'Official Meta WhatsApp Cloud API. Best for production use.',
  },
  {
    id: 'twilio',
    label: 'Twilio',
    icon: <PhoneCall className="h-4 w-4 shrink-0" />,
    description: 'Twilio WhatsApp Sandbox & Business messaging.',
  },
  {
    id: 'mock',
    label: 'Sandbox Simulator',
    icon: <Bot className="h-4 w-4 shrink-0" />,
    description: 'Free local simulator. No real messages sent.',
  },
  {
    id: 'apiauto',
    label: 'ApiAuto.in',
    icon: <Zap className="h-4 w-4 shrink-0" />,
    description: 'Connect via official.apiauto.in API.',
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

  // Active provider selection tab
  const [selectedProvider, setSelectedProvider] = useState<Provider>('meta');

  // Provider-specific credential states (prevents data loss when clicking between tabs)
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaTokenEdited, setMetaTokenEdited] = useState(false);

  const [twilioSender, setTwilioSender] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioTokenEdited, setTwilioTokenEdited] = useState(false);

  const [apiautoPhoneId, setApiautoPhoneId] = useState('');
  const [apiautoApiKey, setApiautoApiKey] = useState('');
  const [apiautoTokenEdited, setApiautoTokenEdited] = useState(false);

  const [mockPhoneId, setMockPhoneId] = useState('sim-phone-001');

  // Meta App Secret (webhook signature verification)
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaAppSecretEdited, setMetaAppSecretEdited] = useState(false);
  const [hasAppSecret, setHasAppSecret] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);

  // Shared Webhook Verify Token
  const [verifyToken, setVerifyToken] = useState('');

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  /**
   * Reveal a stored credential so the eye toggle actually shows the
   * real value. The form only holds a bullet placeholder (the secret
   * never ships to the browser on load), so "show" has to fetch it on
   * demand from the owner/admin-gated reveal endpoint.
   *
   * Returns true when the field now holds a real value.
   */
  const [revealing, setRevealing] = useState<string | null>(null);

  async function revealCredential(
    field: 'access_token' | 'app_secret',
    current: string,
    apply: (value: string) => void,
  ): Promise<boolean> {
    // Already showing a real value (user typed it, or we fetched it).
    if (current && current !== MASKED_TOKEN) return true;
    if (!activeWorkspace?.id) return false;
    try {
      setRevealing(field);
      const res = await fetch(
        `/api/whatsapp/config/reveal?workspace_id=${activeWorkspace.id}&field=${field}`,
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not reveal this credential.');
        return false;
      }
      apply(data.value);
      return true;
    } catch {
      toast.error('Could not reveal this credential.');
      return false;
    } finally {
      setRevealing(null);
    }
  }

  function generateVerifyToken() {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `whvt_${rand}`;
  }

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
      } else if (payload.reason === 'no_config') {
        setConnectionStatus('disconnected');
        setHasConfig(false);
        setShowResetBanner(false);
        setStatusMessage(payload.message || '');
      } else if (payload.reason === 'token_corrupted') {
        setConnectionStatus('disconnected');
        setHasConfig(true);
        setShowResetBanner(true);
        setStatusMessage(payload.message || '');
      } else {
        setConnectionStatus('disconnected');
        setHasConfig(payload.has_token || payload.reason !== 'no_config');
        setShowResetBanner(false);
        setStatusMessage(payload.message || '');
      }

      const activeProv = (payload.provider as Provider) || 'meta';
      setSelectedProvider(activeProv);

      // Populate verify token
      if (payload.verify_token) {
        setVerifyToken(payload.verify_token);
      } else {
        setVerifyToken(generateVerifyToken());
      }

      // Populate provider-specific fields from DB
      if (activeProv === 'meta') {
        setMetaPhoneId(payload.phone_number_id || '');
        setMetaWabaId(payload.waba_id || '');
        if (payload.has_token || payload.connected) {
          setMetaToken(MASKED_TOKEN);
          setMetaTokenEdited(false);
        }
        setHasAppSecret(Boolean(payload.has_app_secret));
        if (payload.has_app_secret) {
          setMetaAppSecret(MASKED_TOKEN);
          setMetaAppSecretEdited(false);
        }
      } else if (activeProv === 'twilio') {
        setTwilioSender(payload.phone_number_id || '');
        setTwilioAccountSid(payload.waba_id || '');
        if (payload.has_token || payload.connected) {
          setTwilioAuthToken(MASKED_TOKEN);
          setTwilioTokenEdited(false);
        }
      } else if (activeProv === 'apiauto') {
        setApiautoPhoneId(payload.phone_number_id || '');
        if (payload.has_token || payload.connected) {
          setApiautoApiKey(MASKED_TOKEN);
          setApiautoTokenEdited(false);
        }
      } else if (activeProv === 'mock') {
        setMockPhoneId(payload.phone_number_id || 'sim-phone-001');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

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

    let phone_number_id = '';
    let waba_id: string | null = null;
    let rawToken = '';
    let isTokenEdited = false;

    if (selectedProvider === 'meta') {
      phone_number_id = metaPhoneId.trim();
      waba_id = metaWabaId.trim() || null;
      rawToken = metaToken.trim();
      isTokenEdited = metaTokenEdited;
      if (!phone_number_id) {
        toast.error('Phone Number ID is required for Meta Cloud API');
        return;
      }
    } else if (selectedProvider === 'twilio') {
      phone_number_id = twilioSender.trim();
      waba_id = twilioAccountSid.trim() || null;
      rawToken = twilioAuthToken.trim();
      isTokenEdited = twilioTokenEdited;
      if (!phone_number_id) {
        toast.error('Twilio Sender Number is required');
        return;
      }
    } else if (selectedProvider === 'apiauto') {
      phone_number_id = apiautoPhoneId.trim();
      rawToken = apiautoApiKey.trim();
      isTokenEdited = apiautoTokenEdited;
      if (!phone_number_id) {
        toast.error('Phone Number ID is required for ApiAuto.in');
        return;
      }
    } else if (selectedProvider === 'mock') {
      phone_number_id = mockPhoneId.trim() || 'sim-phone-001';
      rawToken = 'mock-token';
    }

    if (!hasConfig && selectedProvider !== 'mock' && (!rawToken || rawToken === MASKED_TOKEN)) {
      toast.error('API Access / Auth Token is required for initial setup');
      return;
    }

    const currentVerifyToken = verifyToken.trim() || generateVerifyToken();
    if (!verifyToken) setVerifyToken(currentVerifyToken);

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        workspace_id: activeWorkspace.id,
        provider: selectedProvider,
        phone_number_id,
        waba_id,
        verify_token: currentVerifyToken,
      };

      if (selectedProvider === 'mock') {
        payload.access_token = 'mock-token';
      } else if (isTokenEdited && rawToken && rawToken !== MASKED_TOKEN) {
        payload.access_token = rawToken;
      } else if (hasConfig && !isTokenEdited) {
        payload.access_token = MASKED_TOKEN;
      } else {
        payload.access_token = rawToken;
      }

      // Only send the app secret when the user actually entered a new
      // value — the server validates it against Meta before storing.
      if (
        selectedProvider === 'meta' &&
        metaAppSecretEdited &&
        metaAppSecret.trim() &&
        metaAppSecret !== MASKED_TOKEN
      ) {
        payload.app_secret = metaAppSecret.trim();
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

      // Surface the inbound-webhook wiring result so a silent inbox
      // isn't discovered days later. `override_callback` means Meta
      // will deliver directly to this deployment's webhook URL.
      const sub = data.webhook_subscription;
      if (sub) {
        if (!sub.subscribed) {
          toast.error(
            `Saved, but inbound webhook subscription failed: ${sub.error || 'unknown error'}. Incoming messages will NOT arrive until this is resolved.`,
            { duration: 12000 }
          );
        } else if (sub.mode === 'app_default') {
          toast.warning(
            'Webhook subscribed via your Meta App dashboard settings. Make sure the Callback URL there points to this CRM, or incoming messages will not arrive.',
            { duration: 10000 }
          );
        }
      }
      if (data.app_secret_warning) {
        toast.warning(data.app_secret_warning, { duration: 12000 });
      }

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
    if (!confirm('This will clear the active WhatsApp config so you can re-enter your credentials. Continue?')) return;

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
      setMetaPhoneId('');
      setMetaWabaId('');
      setMetaToken('');
      setMetaTokenEdited(false);
      setTwilioSender('');
      setTwilioAccountSid('');
      setTwilioAuthToken('');
      setTwilioTokenEdited(false);
      setApiautoPhoneId('');
      setApiautoApiKey('');
      setApiautoTokenEdited(false);
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyVerifyToken() {
    if (!verifyToken) return;
    navigator.clipboard.writeText(verifyToken);
    toast.success('Webhook Verify Token copied to clipboard');
  }

  function handleGenerateVerifyToken() {
    const newToken = generateVerifyToken();
    setVerifyToken(newToken);
    toast.success('Generated new Webhook Verify Token');
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentTab = PROVIDER_TABS.find(p => p.id === selectedProvider)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] mt-4">
      {/* ── Main config form ── */}
      <div className="space-y-6">

        {/* Token-corrupted reset banner */}
        {showResetBanner && (
          <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold mb-1">Stored token can&apos;t be decrypted</AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs sm:text-sm">{statusMessage}</AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-foreground font-medium text-xs"
                >
                  {resetting ? <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Resetting...</> : <><RotateCcw className="size-3.5 mr-1.5" /> Reset Configuration</>}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Connection status card */}
        <Card className="bg-card text-card-foreground border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {connectionStatus === 'connected' ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="size-5" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <XCircle className="size-5" />
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {connectionStatus === 'connected' ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {connectionStatus === 'connected'
                    ? `Active via ${currentTab.label}. Messages are ready to send and receive.`
                    : statusMessage || 'Select your provider below, enter credentials, and save.'}
                </p>
              </div>
            </div>
            {connectionStatus === 'connected' && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            )}
          </CardContent>
        </Card>

        {/* ── Provider selector ── */}
        <Card className="bg-card text-card-foreground border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">WhatsApp Provider</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Choose the API provider to send and receive WhatsApp messages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROVIDER_TABS.map((tab) => {
                const isSelected = selectedProvider === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedProvider(tab.id)}
                    className={cn(
                      "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg transition-colors", isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                      {tab.icon}
                    </div>
                    <div>
                      <p className={cn("text-xs font-bold transition-colors", isSelected ? "text-primary" : "text-foreground")}>
                        {tab.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tab.description}</p>
                    </div>
                    {isSelected && (
                      <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Provider-specific credential fields ── */}
        <Card className="bg-card text-card-foreground border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <span className="text-primary">{currentTab.icon}</span>
              {currentTab.label} Credentials
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {selectedProvider === 'meta' && 'Enter your Meta WhatsApp Business API credentials from the Meta Developer Dashboard.'}
              {selectedProvider === 'twilio' && 'Enter your Twilio Account SID, Auth Token, and WhatsApp sender number.'}
              {selectedProvider === 'mock' && 'No real credentials needed — the simulator accepts any values and returns instant successes.'}
              {selectedProvider === 'apiauto' && 'Enter your ApiAuto token and Business Phone Number ID.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Meta Cloud API Fields */}
            {selectedProvider === 'meta' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Phone Number ID</Label>
                  <Input
                    placeholder="e.g. 1293266613862937"
                    value={metaPhoneId}
                    onChange={(e) => setMetaPhoneId(e.target.value)}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">WhatsApp Business Account ID</Label>
                  <Input
                    placeholder="e.g. 1027027283504128"
                    value={metaWabaId}
                    onChange={(e) => setMetaWabaId(e.target.value)}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Permanent Access Token</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter your Meta access token"
                      value={metaToken}
                      onChange={(e) => {
                        setMetaToken(e.target.value);
                        setMetaTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (metaToken === MASKED_TOKEN) {
                          setMetaToken('');
                          setMetaTokenEdited(true);
                        }
                      }}
                      className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9 pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showToken ? 'Hide access token' : 'Show access token'}
                      disabled={revealing === 'access_token'}
                      onClick={async () => {
                        if (!showToken) {
                          const ok = await revealCredential('access_token', metaToken, setMetaToken);
                          if (!ok) return;
                        }
                        setShowToken(!showToken);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm disabled:opacity-50"
                    >
                      {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {hasConfig && !metaTokenEdited && (
                    <p className="text-[11px] text-muted-foreground">Token is hidden for security. Click to re-enter if updating.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Meta App Secret</Label>
                  <div className="relative">
                    <Input
                      type={showAppSecret ? 'text' : 'password'}
                      placeholder={hasAppSecret ? MASKED_TOKEN : 'App Dashboard → App settings → Basic → App Secret'}
                      value={metaAppSecret}
                      onChange={(e) => {
                        setMetaAppSecret(e.target.value);
                        setMetaAppSecretEdited(true);
                      }}
                      onFocus={() => {
                        if (metaAppSecret === MASKED_TOKEN) {
                          setMetaAppSecret('');
                          setMetaAppSecretEdited(true);
                        }
                      }}
                      className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9 pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showAppSecret ? 'Hide app secret' : 'Show app secret'}
                      disabled={revealing === 'app_secret'}
                      onClick={async () => {
                        if (!showAppSecret) {
                          const ok = await revealCredential(
                            'app_secret',
                            metaAppSecret,
                            setMetaAppSecret,
                          );
                          if (!ok) return;
                        }
                        setShowAppSecret(!showAppSecret);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm disabled:opacity-50"
                    >
                      {showAppSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Required to receive incoming messages — Meta signs every webhook with it.
                    {!hasAppSecret && ' Not configured yet: inbound events may be rejected.'}
                  </p>
                </div>
              </>
            )}

            {/* Twilio Fields */}
            {selectedProvider === 'twilio' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Twilio Sender Number</Label>
                  <Input
                    placeholder="e.g. +14155238886"
                    value={twilioSender}
                    onChange={(e) => setTwilioSender(e.target.value)}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Twilio Account SID</Label>
                  <Input
                    placeholder="e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Auth Token</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter your Twilio Auth Token"
                      value={twilioAuthToken}
                      onChange={(e) => {
                        setTwilioAuthToken(e.target.value);
                        setTwilioTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (twilioAuthToken === MASKED_TOKEN) {
                          setTwilioAuthToken('');
                          setTwilioTokenEdited(true);
                        }
                      }}
                      className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9 pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showToken ? 'Hide auth token' : 'Show auth token'}
                      disabled={revealing === 'access_token'}
                      onClick={async () => {
                        if (!showToken) {
                          const ok = await revealCredential('access_token', twilioAuthToken, setTwilioAuthToken);
                          if (!ok) return;
                        }
                        setShowToken(!showToken);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm disabled:opacity-50"
                    >
                      {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ApiAuto Fields */}
            {selectedProvider === 'apiauto' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Phone Number ID</Label>
                  <Input
                    placeholder="e.g. 100234567890123"
                    value={apiautoPhoneId}
                    onChange={(e) => setApiautoPhoneId(e.target.value)}
                    className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">ApiAuto API Key</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter your ApiAuto token"
                      value={apiautoApiKey}
                      onChange={(e) => {
                        setApiautoApiKey(e.target.value);
                        setApiautoTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (apiautoApiKey === MASKED_TOKEN) {
                          setApiautoApiKey('');
                          setApiautoTokenEdited(true);
                        }
                      }}
                      className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9 pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showToken ? 'Hide API key' : 'Show API key'}
                      disabled={revealing === 'access_token'}
                      onClick={async () => {
                        if (!showToken) {
                          const ok = await revealCredential('access_token', apiautoApiKey, setApiautoApiKey);
                          if (!ok) return;
                        }
                        setShowToken(!showToken);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm disabled:opacity-50"
                    >
                      {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Sandbox Simulator notice */}
            {selectedProvider === 'mock' && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Sandbox mode active</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All messages will be logged to the console and stored in the database as sent — no real WhatsApp messages will be delivered. Ideal for testing automations locally.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook URL & Verify Token — shown for Meta and ApiAuto */}
        {(selectedProvider === 'meta' || selectedProvider === 'apiauto') && (
          <Card className="bg-card text-card-foreground border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base">Webhook Configuration</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Copy these parameters into your {selectedProvider === 'meta' ? 'Meta App Dashboard (WhatsApp > Configuration)' : 'ApiAuto platform'} to establish two-way messaging.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Webhook Callback URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="bg-muted/50 border-input text-foreground font-mono text-xs sm:text-sm h-9"
                  />
                  <IconAction
                    label="Copy Callback URL"
                    icon={<Copy className="size-4" />}
                    variant="outline"
                    onClick={handleCopyWebhookUrl}
                    className="shrink-0 border-border text-foreground hover:bg-muted h-9 w-9"
                  />
                </div>
              </div>

              {selectedProvider === 'meta' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Webhook Verify Token</Label>
                  <div className="flex gap-2">
                    <Input
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      placeholder="e.g. whvt_8a7f9b2c4e1d6a03"
                      className="bg-muted/50 border-input text-foreground font-mono text-xs sm:text-sm h-9"
                    />
                    <IconAction
                      label="Copy Verify Token"
                      icon={<Copy className="size-4" />}
                      variant="outline"
                      onClick={handleCopyVerifyToken}
                      className="shrink-0 border-border text-foreground hover:bg-muted h-9 w-9"
                    />
                    <IconAction
                      label="Generate New Verify Token"
                      icon={<RotateCcw className="size-4" />}
                      variant="outline"
                      onClick={handleGenerateVerifyToken}
                      className="shrink-0 border-border text-foreground hover:bg-muted h-9 w-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    System-generated verification token. Copy &amp; paste this token into Meta Webhook setup.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-9 px-4 shadow-sm"
          >
            {saving ? <><Loader2 className="size-4 animate-spin mr-1.5" /> Saving...</> : 'Save Configuration'}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !hasConfig}
            className="border-border text-foreground hover:bg-muted font-medium text-xs h-9 px-4"
          >
            {testing ? <><Loader2 className="size-4 animate-spin mr-1.5" /> Testing...</> : <><Zap className="size-4 mr-1.5" /> Test Connection</>}
          </Button>
          {hasConfig && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 font-medium text-xs h-9 px-4"
            >
              {resetting ? <><Loader2 className="size-4 animate-spin mr-1.5" /> Resetting...</> : <><RotateCcw className="size-4 mr-1.5" /> Reset Configuration</>}
            </Button>
          )}
        </div>
      </div>

      {/* ── Setup Instructions Sidebar ── */}
      <div>
        <Card className="bg-card text-card-foreground border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">Setup Instructions</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {selectedProvider === 'meta' && 'Connect your Meta WhatsApp Cloud API account.'}
              {selectedProvider === 'twilio' && 'Connect your Twilio WhatsApp messaging account.'}
              {selectedProvider === 'mock' && 'No setup required — just save and start testing.'}
              {selectedProvider === 'apiauto' && 'Connect your ApiAuto.in platform.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProvider === 'meta' && (
              <Accordion defaultValue={["item-4"]}>
                <AccordionItem value="item-1" className="border-border">
                  <AccordionTrigger className="text-foreground text-xs font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
                      Create a Meta App
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to <span className="text-primary font-medium">developers.facebook.com</span></li>
                      <li>Click &quot;My Apps&quot; → &quot;Create App&quot;</li>
                      <li>Select &quot;Business&quot; as the app type</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className="border-border">
                  <AccordionTrigger className="text-foreground text-xs font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
                      Add WhatsApp Product
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>In your app dashboard, click &quot;Add Product&quot;</li>
                      <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                      <li>Follow the setup wizard to link your business</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className="border-border">
                  <AccordionTrigger className="text-foreground text-xs font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
                      Get API Credentials
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to WhatsApp &gt; API Setup</li>
                      <li>Copy your <strong className="text-foreground">Phone Number ID</strong></li>
                      <li>Copy your <strong className="text-foreground">WhatsApp Business Account ID</strong></li>
                      <li>Generate a <strong className="text-foreground">Permanent Access Token</strong> from System Users</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4" className="border-border">
                  <AccordionTrigger className="text-foreground text-xs font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">4</span>
                      Configure Webhooks (Required)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to WhatsApp &gt; Configuration</li>
                      <li>Click &quot;Edit&quot; on the Webhook section</li>
                      <li>Paste the <strong className="text-foreground">Webhook Callback URL</strong></li>
                      <li>Enter the <strong className="text-foreground">Webhook Verify Token</strong> shown here</li>
                      <li><strong className="text-primary">MANDATORY:</strong> Click &quot;Subscribe&quot; on the <span className="text-foreground font-semibold">&quot;messages&quot;</span> field!</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {selectedProvider === 'twilio' && (
              <Accordion defaultValue={["item-1"]}>
                <AccordionItem value="item-1" className="border-border">
                  <AccordionTrigger className="text-foreground text-xs font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
                      Get Twilio Credentials
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to <span className="text-primary font-medium">console.twilio.com</span></li>
                      <li>Copy your <strong className="text-foreground">Account SID</strong></li>
                      <li>Copy your <strong className="text-foreground">Auth Token</strong></li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
