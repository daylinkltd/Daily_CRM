'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import type { MockChannel } from '@/lib/social/mock-channels';
import { formatFollowers, formatLastSynced } from '@/lib/social/mock-channels';
import { RefreshCw, Settings, Unlink, CheckCircle2, WifiOff, Users, Calendar, SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ChannelCardProps {
  channel: MockChannel;
  onManage?: (channelId: string) => void;
  onDisconnect?: (channelId: string) => void;
  onConnect?: (channelId: string) => void;
}

export function ChannelCard({ channel, onManage, onDisconnect, onConnect }: ChannelCardProps) {
  const [syncing, setSyncing] = useState(false);
  const meta = SOCIAL_PLATFORM_ICONS[channel.platform];
  if (!meta) return null;
  const Icon = meta.icon;

  const handleSync = async () => {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 1200));
    setSyncing(false);
    toast.success(`Synced ${channel.accountName}`);
  };

  return (
    <div className={cn(
      'relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-all hover:shadow-md',
      channel.isConnected ? 'border-border hover:border-primary/30' : 'border-dashed border-border/70 opacity-80'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', meta.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{meta.label}</p>
            <p className="text-xs text-muted-foreground truncate">{channel.accountName}</p>
          </div>
        </div>

        {/* Connection status badge */}
        {channel.isConnected ? (
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-2 py-0.5 shrink-0">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-muted border border-border rounded-full px-2 py-0.5 shrink-0">
            <WifiOff className="h-3 w-3" /> Disconnected
          </div>
        )}
      </div>

      {/* Stats */}
      {channel.isConnected && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-background border border-border p-2 text-center">
            <p className="text-base font-black text-foreground">{formatFollowers(channel.followers)}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-center gap-0.5 mt-0.5">
              <Users className="h-2.5 w-2.5" /> Followers
            </p>
          </div>
          <div className="rounded-xl bg-background border border-border p-2 text-center">
            <p className="text-base font-black text-blue-600 dark:text-blue-400">{channel.scheduledCount}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-center gap-0.5 mt-0.5">
              <Calendar className="h-2.5 w-2.5" /> Scheduled
            </p>
          </div>
          <div className="rounded-xl bg-background border border-border p-2 text-center">
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{channel.publishedCount}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-center gap-0.5 mt-0.5">
              <SendHorizontal className="h-2.5 w-2.5" /> Published
            </p>
          </div>
        </div>
      )}

      {/* Last synced */}
      {channel.isConnected && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/60 pt-3">
          <span className="flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" />
            Last synced {formatLastSynced(channel.lastSynced)}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
          >
            <RefreshCw className={cn('h-2.5 w-2.5', syncing && 'animate-spin')} />
            Sync now
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {channel.isConnected ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onManage?.(channel.id)}
              className="h-7 text-xs font-bold flex-1 gap-1 rounded-lg"
            >
              <Settings className="h-3 w-3" /> Manage
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDisconnect?.(channel.id)}
              className="h-7 text-xs font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 gap-1 rounded-lg"
            >
              <Unlink className="h-3 w-3" /> Disconnect
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => onConnect?.(channel.id)}
            className="h-7 text-xs font-bold flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-1 rounded-lg"
          >
            Connect {meta.label}
          </Button>
        )}
      </div>
    </div>
  );
}
