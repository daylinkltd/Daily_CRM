'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
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
  Layers,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BufferIntegrationStatus {
  isConfigured: boolean;
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  accountId?: string;
  accountName?: string;
  accountEmail?: string;
  currentOrganizationId?: string;
  currentOrganizationName?: string;
  organizations: Array<{ id: string; name: string }>;
  channels: Array<{
    id: string;
    providerChannelId: string;
    platform: string;
    displayName: string;
    username?: string;
    avatarUrl?: string;
    isEnabled: boolean;
    status: string;
  }>;
  connectedAt?: string;
  lastSyncedAt?: string;
  lastError?: string;
  isDevSimulation?: boolean;
}

export function BufferIntegrationCard() {
  const { activeWorkspace } = useWorkspace();
  const [statusData, setStatusData] = useState<BufferIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnectModal, setDisconnectModal] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/integrations/buffer/status?workspace_id=${activeWorkspace.id}`);
      if (res.ok) {
        const json = await res.json();
        setStatusData(json);
      }
    } catch (e) {
      console.error('[BufferCard] Fetch status error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchStatus();

    // Check URL parameters for OAuth redirect feedback
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('buffer_connected') === 'true') {
        toast.success('Buffer account connected successfully! Channels synchronized.');
        window.history.replaceState({}, '', window.location.pathname);
      }
      const errorMsg = params.get('buffer_error');
      if (errorMsg) {
        toast.error(`Buffer Connection Failed: ${decodeURIComponent(errorMsg)}`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!activeWorkspace?.id) {
      toast.error('No active workspace selected.');
      return;
    }

    try {
      setConnecting(true);
      const res = await fetch('/api/integrations/buffer/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });

      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'Failed to initiate authorization');
      }

      // Redirect to Buffer OAuth or dev simulation endpoint
      window.location.href = json.url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect Buffer');
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!activeWorkspace?.id) return;

    try {
      setSyncing(true);
      const res = await fetch('/api/integrations/buffer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Synchronized ${json.count} channel(s) from Buffer.`);
        fetchStatus();
      } else {
        throw new Error(json.error || 'Sync failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync Buffer channels');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeWorkspace?.id) return;

    try {
      const res = await fetch('/api/integrations/buffer/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });

      if (res.ok) {
        toast.info('Buffer account disconnected. Historical CRM records preserved.');
        setDisconnectModal(false);
        fetchStatus();
      } else {
        const json = await res.json();
        throw new Error(json.error || 'Disconnect failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 flex items-center justify-center min-h-[220px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isConnected = statusData?.isConnected;

  return (
    <div className="space-y-6">
      {/* Main Buffer Integration Banner */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white font-black text-xl shadow-md shrink-0">
              ⠃
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-black text-foreground">Buffer Multi-Tenant Integration</h3>
                {isConnected ? (
                  <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </span>
                ) : (
                  <span className="bg-muted text-muted-foreground text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-border">
                    Not Connected
                  </span>
                )}
                {statusData?.isDevSimulation && (
                  <span className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Dev Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                Connect your organization&apos;s Buffer account via OAuth 2.0 PKCE to publish and schedule AI content directly to LinkedIn, Instagram, Facebook, X, TikTok, YouTube, Threads, and Pinterest.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isConnected ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                  {syncing ? 'Syncing...' : 'Sync Channels'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5"
                >
                  Reconnect
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDisconnectModal(true)}
                  className="h-9 px-3 text-xs font-bold rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Disconnect
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={connecting}
                className="h-9 px-4 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-md gap-2"
              >
                <Share2 className="h-4 w-4 stroke-[2.5]" />
                {connecting ? 'Connecting...' : 'Connect Buffer'}
              </Button>
            )}
          </div>
        </div>

        {/* Connected Account & Organization Details */}
        {isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/60 text-xs">
            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/80 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black block">Connected Account</span>
              <strong className="text-foreground font-bold">{statusData?.accountName || 'Buffer Account'}</strong>
              <p className="text-[11px] text-muted-foreground truncate">{statusData?.accountEmail || '-'}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/80 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black block">Active Organization</span>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <strong className="text-foreground font-bold">{statusData?.currentOrganizationName || 'Primary Organization'}</strong>
              </div>
              <p className="text-[10px] text-muted-foreground">ID: {statusData?.currentOrganizationId || '-'}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/80 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black block">Security & Sync</span>
              <div className="flex items-center gap-1 text-emerald-500 font-bold">
                <ShieldCheck className="h-3.5 w-3.5" /> AES-256 Encrypted at Rest
              </div>
              <p className="text-[10px] text-muted-foreground">
                Synced {statusData?.lastSyncedAt ? new Date(statusData.lastSyncedAt).toLocaleTimeString() : 'Just now'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Connected Social Channels Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-foreground">Available Publishing Channels</h4>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? `${statusData?.channels.length || 0} channels discovered for this tenant's Buffer account.`
                : 'Connect Buffer above to discover and manage your social channels.'}
            </p>
          </div>
        </div>

        {!isConnected || statusData?.channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-2">
            <Share2 className="h-9 w-9 opacity-30 text-primary" />
            <p className="text-xs font-bold text-foreground">No social accounts connected</p>
            <p className="text-[11px] text-muted-foreground max-w-md">
              Connect your organization&apos;s Buffer account to unlock direct multi-channel publishing and automated UTM attribution tracking.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {statusData?.channels.map((ch) => {
              const meta = SOCIAL_PLATFORM_ICONS[ch.platform as keyof typeof SOCIAL_PLATFORM_ICONS];
              const Icon = meta?.icon || Share2;

              return (
                <div
                  key={ch.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card shadow-xs hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border shrink-0', meta?.color || 'bg-primary/10 text-primary border-primary/20')}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-black text-foreground capitalize truncate">{ch.displayName}</h5>
                      <p className="text-[10px] text-muted-foreground truncate">{ch.username || ch.platform}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                    Active
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      {disconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-foreground">Disconnect Buffer?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Daily CRM will stop publishing through this Buffer account. Existing CRM campaigns, AI content drafts, and attribution history will not be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisconnectModal(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDisconnect}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
