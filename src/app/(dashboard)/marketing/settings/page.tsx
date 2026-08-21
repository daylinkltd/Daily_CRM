'use client';

import React, { useState } from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { BufferIntegrationCard } from '@/components/marketing/buffer-integration-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SocialPlatform, MarketingSettings } from '@/types/calendar';
import {
  Settings,
  Share2,
  Send,
  ClipboardCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Trash2,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PLATFORMS_LIST: SocialPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'threads',
  'pinterest',
];

export default function MarketingSettingsPage() {
  const store = useCalendarStore();
  const [activeTab, setActiveTab] = useState<'accounts' | 'publishing' | 'approvals' | 'ai'>('accounts');

  // Form local state initialized from store.marketingSettings
  const [settings, setSettings] = useState<MarketingSettings>(store.marketingSettings);

  const [connectedAccounts, setConnectedAccounts] = useState<Record<SocialPlatform, boolean>>({
    instagram: false,
    facebook: false,
    linkedin: false,
    x: false,
    tiktok: false,
    youtube: false,
    threads: false,
    pinterest: false,
  });

  const toggleConnect = (p: SocialPlatform) => {
    const next = !connectedAccounts[p];
    setConnectedAccounts({ ...connectedAccounts, [p]: next });
    if (next) toast.success(`Connected to ${p.toUpperCase()} successfully!`);
    else toast.info(`Disconnected ${p.toUpperCase()}`);
  };

  const handleSaveSettings = () => {
    store.saveSettings(settings);
    toast.success('Marketing settings saved successfully!');
  };

  const connectedCount = Object.values(connectedAccounts).filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Marketing Settings"
        description="Configure connected social channels, publishing rules, approval governance, and AI brand voice."
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'accounts'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Share2 className="h-4 w-4" /> Social Accounts
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('publishing')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'publishing'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Send className="h-4 w-4" /> Publishing
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'approvals'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <ClipboardCheck className="h-4 w-4" /> Approvals
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'ai'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="h-4 w-4" /> AI Assistant
        </button>
      </div>

      {/* 1. SOCIAL ACCOUNTS TAB (MULTI-TENANT BUFFER INTEGRATION) */}
      {activeTab === 'accounts' && (
        <BufferIntegrationCard />
      )}

      {/* 2. PUBLISHING TAB */}
      {activeTab === 'publishing' && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-xs">
          <h3 className="text-sm font-black text-foreground">Publishing Defaults & Link Tracking</h3>

          <div className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Default Timezone</label>
              <select
                value={settings.defaultTimezone}
                onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST / EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                <option value="Europe/London">Europe/London (GMT / BST)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Primary Default Platform</label>
              <select
                value={settings.defaultPlatform}
                onChange={(e) => setSettings({ ...settings, defaultPlatform: e.target.value as SocialPlatform })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground capitalize"
              >
                {PLATFORMS_LIST.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <Button onClick={handleSaveSettings} className="rounded-xl text-xs font-bold bg-primary text-primary-foreground">
              Save Publishing Settings
            </Button>
          </div>
        </div>
      )}

      {/* 3. APPROVALS TAB */}
      {activeTab === 'approvals' && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-xs">
          <h3 className="text-sm font-black text-foreground">Approval & Content Governance</h3>

          <div className="space-y-4 max-w-lg">
            <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-background">
              <div>
                <h4 className="text-xs font-bold text-foreground">Require Approval for Creators</h4>
                <p className="text-[11px] text-muted-foreground">Prevent creator posts from scheduling without manager sign-off.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.approvalRequired}
                onChange={(e) => setSettings({ ...settings, approvalRequired: e.target.checked })}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Approval Levels</label>
              <select
                value={settings.approvalLevels}
                onChange={(e) => setSettings({ ...settings, approvalLevels: e.target.value as 'single' | 'two_tier' })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="single">Single-Tier (Any Manager / Approver)</option>
                <option value="two_tier">Multi-Tier (Manager + Executive Sign-Off)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Rejection Behavior</label>
              <select
                value={settings.rejectionBehavior}
                onChange={(e) => setSettings({ ...settings, rejectionBehavior: e.target.value as any })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="return_to_creator">Return to Creator as Draft with Feedback</option>
                <option value="archive">Archive Rejected Post</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <Button onClick={handleSaveSettings} className="rounded-xl text-xs font-bold bg-primary text-primary-foreground">
              Save Approval Settings
            </Button>
          </div>
        </div>
      )}

      {/* 4. AI ASSISTANT TAB */}
      {activeTab === 'ai' && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-xs">
          <h3 className="text-sm font-black text-foreground">AI Brand Voice & Content Tuning</h3>

          <div className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Default Tone</label>
              <select
                value={settings.aiTone}
                onChange={(e) => setSettings({ ...settings, aiTone: e.target.value as any })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="engaging">Engaging & Conversational</option>
                <option value="professional">Authoritative & Professional B2B</option>
                <option value="bold">Bold & High-Energy</option>
                <option value="educational">Educational & Step-by-Step</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Brand Voice Guidelines Prompt</label>
              <Textarea
                rows={3}
                value={settings.aiBrandVoice}
                onChange={(e) => setSettings({ ...settings, aiBrandVoice: e.target.value })}
                placeholder="Describe your brand personality, phrasing preferences, and value props..."
                className="rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">AI Output Language</label>
                <Input
                  value={settings.aiLanguage}
                  onChange={(e) => setSettings({ ...settings, aiLanguage: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Auto-Generated Hashtag Count</label>
                <Input
                  type="number"
                  value={settings.hashtagCount}
                  onChange={(e) => setSettings({ ...settings, hashtagCount: Number(e.target.value) })}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <Button onClick={handleSaveSettings} className="rounded-xl text-xs font-bold bg-primary text-primary-foreground">
              Save AI Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
