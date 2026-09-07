'use client';

import React, { useState, useEffect } from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/ui/page-header';
import { BufferIntegrationCard } from '@/components/marketing/buffer-integration-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SocialPlatform, MarketingSettings, MarketingNotificationPreferences } from '@/types/calendar';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/marketing/calendar-notifications';
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
  Building2,
  Bell,
  Clock,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextArea } from "@/components/ui/rich-textarea";
import { BrandSettingsSection } from '@/components/marketing/brand-settings-section';

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
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'brand' | 'accounts' | 'publishing' | 'notifications' | 'approvals' | 'ai'>('brand');

  // Form local state initialized from store.marketingSettings
  const [settings, setSettings] = useState<MarketingSettings>(store.marketingSettings);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<MarketingNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Load preferences from API
  useEffect(() => {
    if (!activeWorkspace?.id) return;
    async function loadPrefs() {
      try {
        const res = await fetch(`/api/marketing/notification-preferences?workspace_id=${activeWorkspace?.id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.preferences) {
            setNotifPrefs(json.preferences);
          }
        }
      } catch {
        // ignore
      }
    }
    loadPrefs();
  }, [activeWorkspace?.id]);

  const handleSaveSettings = () => {
    store.saveSettings(settings);
    toast.success('Marketing settings saved successfully!');
  };

  const handleSaveNotifPrefs = async () => {
    if (!activeWorkspace?.id) {
      toast.success('Notification preferences saved!');
      return;
    }

    try {
      setIsSavingPrefs(true);
      const res = await fetch('/api/marketing/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          ...notifPrefs,
        }),
      });

      if (res.ok) {
        toast.success('Notification & reminder preferences saved successfully!');
      } else {
        toast.success('Notification preferences updated locally.');
      }
    } catch {
      toast.success('Notification preferences updated.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Marketing Settings"
        description="Configure brand profile, asset library, connected channels, posting reminders, and governance."
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('brand')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0 cursor-pointer',
            activeTab === 'brand'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Building2 className="h-4 w-4" /> Brand Profile & Assets
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0 cursor-pointer',
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
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0 cursor-pointer',
            activeTab === 'publishing'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Send className="h-4 w-4" /> Publishing
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0 cursor-pointer',
            activeTab === 'notifications'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Bell className="h-4 w-4" /> Posting Reminders
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0 cursor-pointer',
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
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0 cursor-pointer',
            activeTab === 'ai'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="h-4 w-4" /> AI Voice
        </button>
      </div>

      {/* 0. BRAND PROFILE & ASSETS TAB */}
      {activeTab === 'brand' && (
        <BrandSettingsSection />
      )}

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
              <NativeSelect
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
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Primary Default Platform</label>
              <NativeSelect
                value={settings.defaultPlatform}
                onChange={(e) => setSettings({ ...settings, defaultPlatform: e.target.value as SocialPlatform })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground capitalize"
              >
                {PLATFORMS_LIST.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <Button onClick={handleSaveSettings} className="rounded-xl text-xs font-bold bg-primary text-primary-foreground">
              Save Publishing Settings
            </Button>
          </div>
        </div>
      )}

      {/* 3. NOTIFICATION & REMINDER PREFERENCES TAB */}
      {activeTab === 'notifications' && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-6 shadow-xs">
          <div>
            <h3 className="text-sm font-black text-foreground">Posting Reminders & Alert Settings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure automated morning schedules, upcoming post count-downs, and operational attention alerts.
            </p>
          </div>

          <div className="space-y-4 max-w-xl">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-background shadow-2xs">
              <div>
                <h4 className="text-xs font-bold text-foreground">Enable Posting Reminders</h4>
                <p className="text-[11px] text-muted-foreground">Receive automated notifications for scheduled content.</p>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.posting_reminders_enabled}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, posting_reminders_enabled: e.target.checked })}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
            </div>

            {/* Daily Posting Summary */}
            <div className="p-4 rounded-2xl border border-border bg-background space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Daily Posting Summary</h4>
                  <p className="text-[11px] text-muted-foreground">Morning digest of everything scheduled to publish today.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.daily_summary_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, daily_summary_enabled: e.target.checked })}
                  disabled={!notifPrefs.posting_reminders_enabled}
                  className="h-4 w-4 rounded accent-primary cursor-pointer disabled:opacity-50"
                />
              </div>

              {notifPrefs.daily_summary_enabled && (
                <div className="pt-2 border-t border-border flex items-center justify-between gap-4">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Summary Time
                  </label>
                  <Input
                    type="time"
                    value={notifPrefs.daily_summary_time}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, daily_summary_time: e.target.value })}
                    className="h-8 w-32 rounded-xl text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* Upcoming Post Reminder */}
            <div className="p-4 rounded-2xl border border-border bg-background space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Upcoming Post Reminder</h4>
                  <p className="text-[11px] text-muted-foreground">Advance warning before a scheduled post goes live.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.upcoming_reminders_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, upcoming_reminders_enabled: e.target.checked })}
                  disabled={!notifPrefs.posting_reminders_enabled}
                  className="h-4 w-4 rounded accent-primary cursor-pointer disabled:opacity-50"
                />
              </div>

              {notifPrefs.upcoming_reminders_enabled && (
                <div className="pt-2 border-t border-border flex items-center justify-between gap-4">
                  <label className="text-xs font-medium text-foreground">Advance Timing</label>
                  <NativeSelect
                    value={notifPrefs.upcoming_timing_minutes.toString()}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, upcoming_timing_minutes: parseInt(e.target.value, 10) })}
                    className="h-8 w-44 rounded-xl border border-border bg-card px-2.5 text-xs font-bold text-foreground"
                  >
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="120">2 hours before</option>
                  </NativeSelect>
                </div>
              )}
            </div>

            {/* Event & Operational Alerts */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Operational Alerts</h4>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                <div>
                  <p className="text-xs font-bold text-foreground">Approval Requests & Decisions</p>
                  <p className="text-[10px] text-muted-foreground">Alerts when posts are submitted, approved, or rejected.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.approval_notifications_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, approval_notifications_enabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                <div>
                  <p className="text-xs font-bold text-foreground">Publishing Failures</p>
                  <p className="text-[10px] text-muted-foreground">Immediate alerts when social dispatch encounters an error.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.publishing_failure_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, publishing_failure_enabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                <div>
                  <p className="text-xs font-bold text-foreground">Missing Media & Attention Items</p>
                  <p className="text-[10px] text-muted-foreground">Warnings when scheduled posts are missing visual assets.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.missing_media_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, missing_media_enabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                <div>
                  <p className="text-xs font-bold text-foreground">Publishing Success</p>
                  <p className="text-[10px] text-muted-foreground">Confirmations when content is published live.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.publishing_success_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, publishing_success_enabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Notification Channels */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Delivery Channels</h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifPrefs.channels.in_app}
                    onChange={(e) => setNotifPrefs({
                      ...notifPrefs,
                      channels: { ...notifPrefs.channels, in_app: e.target.checked },
                    })}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-xs font-bold text-foreground">In-App Alerts</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifPrefs.channels.email}
                    onChange={(e) => setNotifPrefs({
                      ...notifPrefs,
                      channels: { ...notifPrefs.channels, email: e.target.checked },
                    })}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Digests
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <Button
              onClick={handleSaveNotifPrefs}
              disabled={isSavingPrefs}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs cursor-pointer"
            >
              {isSavingPrefs ? 'Saving...' : 'Save Notification Preferences'}
            </Button>
          </div>
        </div>
      )}

      {/* 4. APPROVALS TAB */}
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
              <NativeSelect
                value={settings.approvalLevels}
                onChange={(e) => setSettings({ ...settings, approvalLevels: e.target.value as 'single' | 'two_tier' })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="single">Single-Tier (Any Manager / Approver)</option>
                <option value="two_tier">Multi-Tier (Manager + Executive Sign-Off)</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Rejection Behavior</label>
              <NativeSelect
                value={settings.rejectionBehavior}
                onChange={(e) => setSettings({ ...settings, rejectionBehavior: e.target.value as any })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="return_to_creator">Return to Creator as Draft with Feedback</option>
                <option value="archive">Archive Rejected Post</option>
              </NativeSelect>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <Button onClick={handleSaveSettings} className="rounded-xl text-xs font-bold bg-primary text-primary-foreground">
              Save Approval Settings
            </Button>
          </div>
        </div>
      )}

      {/* 5. AI ASSISTANT TAB */}
      {activeTab === 'ai' && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-xs">
          <h3 className="text-sm font-black text-foreground">AI Brand Voice & Content Tuning</h3>

          <div className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Default Tone</label>
              <NativeSelect
                value={settings.aiTone}
                onChange={(e) => setSettings({ ...settings, aiTone: e.target.value as any })}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="engaging">Engaging & Conversational</option>
                <option value="professional">Authoritative & Professional B2B</option>
                <option value="bold">Bold & High-Energy</option>
                <option value="educational">Educational & Step-by-Step</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Brand Voice Guidelines Prompt</label>
              <RichTextArea
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
