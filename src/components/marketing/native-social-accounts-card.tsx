'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { SocialPlatformIcon } from '@/components/calendar/social-icons';
import { Button } from '@/components/ui/button';
import {
  Share2,
  CheckCircle2,
  RefreshCw,
  Trash2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
  Sparkles,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SocialChannel {
  id: string;
  provider: string;
  platform: string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
  is_enabled: boolean;
  status: string;
  account_type?: string | null;
  connected_at: string;
  token_expires_at?: string | null;
}

interface SocialIntegration {
  id: string;
  provider: string;
  provider_account_name?: string | null;
  status: string;
  last_error?: string | null;
}

export function NativeSocialAccountsCard() {
  const { activeWorkspace } = useWorkspace();
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [integrations, setIntegrations] = useState<SocialIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/marketing/social/channels?workspace_id=${activeWorkspace.id}`);
      if (res.ok) {
        const json = await res.json();
        setChannels(json.channels || []);
        setIntegrations(json.integrations || []);
      }
    } catch (err) {
      console.error('[NativeSocialAccountsCard] Failed to fetch channels:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchChannels();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get('connected');
      const errorMsg = params.get('error');

      if (connected) {
        toast.success(`Successfully connected ${connected.toUpperCase()} accounts!`);
        window.history.replaceState({}, '', window.location.pathname);
        fetchChannels();
      } else if (errorMsg) {
        toast.error(`Connection error: ${decodeURIComponent(errorMsg)}`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [fetchChannels]);

  const handleConnect = (provider: 'meta' | 'linkedin') => {
    if (!activeWorkspace?.id) {
      toast.error('Please select an active workspace first.');
      return;
    }
    setConnectingProvider(provider);
    window.location.href = `/api/marketing/social/${provider}/connect?workspace_id=${activeWorkspace.id}`;
  };

  const handleToggleChannel = async (channelId: string, currentEnabled: boolean) => {
    if (!activeWorkspace?.id) return;
    try {
      const res = await fetch('/api/marketing/social/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          isEnabled: !currentEnabled,
          workspaceId: activeWorkspace.id,
        }),
      });
      if (res.ok) {
        toast.success(currentEnabled ? 'Channel disabled' : 'Channel enabled');
        setChannels((prev) =>
          prev.map((ch) => (ch.id === channelId ? { ...ch, is_enabled: !currentEnabled } : ch))
        );
      }
    } catch {
      toast.error('Failed to update channel status');
    }
  };

  const handleDisconnect = async (channelId?: string, provider?: string) => {
    if (!activeWorkspace?.id) return;
    try {
      const params = new URLSearchParams({ workspace_id: activeWorkspace.id });
      if (channelId) params.append('channel_id', channelId);
      if (provider) params.append('provider', provider);

      const res = await fetch(`/api/marketing/social/channels?${params.toString()}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Channel disconnected');
        fetchChannels();
      }
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const isMetaConnected = integrations.some((i) => i.provider === 'meta' && i.status === 'connected');
  const isLinkedInConnected = integrations.some((i) => i.provider === 'linkedin' && i.status === 'connected');

  return (
    <div className="rounded-3xl border border-border bg-card p-6 space-y-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-foreground">Native Social Publishing Channels</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
              Phase 1
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Connect Facebook Pages, Instagram Professional accounts, and LinkedIn Profiles or Company Pages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchChannels()}
            disabled={loading}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Provider Quick Connect Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Meta (Facebook + Instagram) */}
        <div className="p-4 rounded-2xl border border-border bg-background space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">f</div>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white flex items-center justify-center text-[10px] font-bold">ig</div>
                </div>
                <h4 className="text-xs font-bold text-foreground">Meta (Facebook & Instagram)</h4>
              </div>
              {isMetaConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">Not connected</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Publishes directly to managed Facebook Pages and linked Instagram Professional business accounts.
            </p>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
            {isMetaConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect(undefined, 'meta')}
                className="text-[11px] font-bold rounded-xl text-destructive hover:bg-destructive/10"
              >
                Disconnect Meta
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => handleConnect('meta')}
                disabled={connectingProvider === 'meta'}
                className="w-full text-[11px] font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Link2 className="h-3.5 w-3.5" />
                {connectingProvider === 'meta' ? 'Connecting...' : 'Connect Facebook & Instagram'}
              </Button>
            )}
          </div>
        </div>

        {/* LinkedIn */}
        <div className="p-4 rounded-2xl border border-border bg-background space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-[10px] font-bold">in</div>
                <h4 className="text-xs font-bold text-foreground">LinkedIn</h4>
              </div>
              {isLinkedInConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">Not connected</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Publishes directly to your LinkedIn Personal Profile and administered Company Pages via REST Posts API.
            </p>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
            {isLinkedInConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect(undefined, 'linkedin')}
                className="text-[11px] font-bold rounded-xl text-destructive hover:bg-destructive/10"
              >
                Disconnect LinkedIn
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => handleConnect('linkedin')}
                disabled={connectingProvider === 'linkedin'}
                className="w-full text-[11px] font-bold rounded-xl bg-blue-700 hover:bg-blue-800 text-white gap-1.5"
              >
                <Link2 className="h-3.5 w-3.5" />
                {connectingProvider === 'linkedin' ? 'Connecting...' : 'Connect LinkedIn Profile & Pages'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Connected Channels List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          Active Workspace Channels ({channels.length})
        </h4>

        {channels.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-border bg-background/50 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No social media channels connected yet for this workspace.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Click Connect above to authorize Meta (Facebook/Instagram) or LinkedIn.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {channels.map((ch) => {
              const isError = ch.status === 'error';

              return (
                <div
                  key={ch.id}
                  className={cn(
                    'p-3.5 rounded-2xl border bg-background space-y-3 flex flex-col justify-between transition-all',
                    ch.is_enabled ? 'border-border' : 'border-border/50 opacity-60',
                    isError && 'border-rose-500/50 bg-rose-500/5'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-muted/60 text-foreground">
                          <SocialPlatformIcon platform={ch.platform} className="h-4 w-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-foreground line-clamp-1">{ch.display_name}</h5>
                          <span className="text-[10px] font-medium text-muted-foreground capitalize">
                            {ch.account_type?.replace('_', ' ') || ch.platform}
                          </span>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={ch.is_enabled}
                        onChange={() => handleToggleChannel(ch.id, ch.is_enabled)}
                        className="h-4 w-4 rounded accent-primary cursor-pointer mt-1"
                        title={ch.is_enabled ? 'Disable channel' : 'Enable channel'}
                      />
                    </div>

                    {isError && (
                      <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-rose-500/10 text-rose-600 text-[11px] font-medium">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Token expired — reconnect required</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Connected {new Date(ch.connected_at).toLocaleDateString()}</span>
                    <button
                      onClick={() => handleDisconnect(ch.id)}
                      className="text-destructive hover:underline font-bold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
