'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCalendarStore } from '@/lib/calendar/store';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/social/status-badge';
import { PlatformIconStack } from '@/components/social/platform-badge';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import { ApprovalReviewDrawer } from '@/components/calendar/approval-review-drawer';
import { PerformanceChart } from '@/components/social/social-analytics-charts';
import { AIConversationalAssistant } from '@/components/marketing/ai-conversational-assistant';
import { LeadSimulatorModal } from '@/components/marketing/lead-simulator-modal';
import type { SocialPost, SocialPlatform } from '@/types/calendar';
import {
  Sparkles,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  FileEdit,
  TrendingUp,
  Eye,
  Heart,
  Target,
  ArrowRight,
  Share2,
  Flame,
  UserCheck,
  Briefcase,
  DollarSign,
  Bot,
  Lightbulb,
  ExternalLink,
  Tag,
  Check,
  X,
  Users,
  Compass,
  Trash2,
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

export default function MarketingDashboardPage() {
  const store = useCalendarStore();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [reviewPost, setReviewPost] = useState<SocialPost | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  if (!store.isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const scheduled = store.scheduledPosts || [];
  const published = store.publishedPosts || [];
  const pending = store.pendingApprovalPosts || [];
  const drafts = store.draftPosts || [];
  const campaigns = store.campaigns || [];
  const contacts = store.marketingContacts || [];
  const insights = (store.aiInsights || []).filter((i) => i.status === 'active');

  const totalReach = campaigns.reduce((s, c) => s + (c.metrics?.reach || 0), 0) + published.reduce((s, p) => s + (p.analytics?.reach || 0), 0);
  const totalLeads = contacts.length || campaigns.reduce((s, c) => s + (c.metrics?.leads || 0), 0);
  const totalQualified = contacts.filter(c => c.marketing_attribution?.leadTemperature === 'hot' || c.marketing_attribution?.leadTemperature === 'warm').length
    || campaigns.reduce((s, c) => s + (c.metrics?.qualifiedLeads || 0), 0);
  const totalHot = contacts.filter(c => c.marketing_attribution?.leadTemperature === 'hot').length
    || campaigns.reduce((s, c) => s + (c.metrics?.hotLeads || 0), 0);
  const totalOpps = campaigns.reduce((s, c) => s + (c.metrics?.opportunities || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.metrics?.revenue || 0), 0);

  const kpis = [
    { label: 'Total Leads Generated', value: totalLeads, change: totalLeads > 0 ? `${totalLeads} tracked` : '0 tracked', trend: totalLeads > 0 ? 'up' : 'neutral', icon: Flame, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { label: 'Qualified Leads', value: totalQualified, change: totalLeads > 0 ? `${Math.round((totalQualified / (totalLeads || 1)) * 100)}% Qual. Rate` : '0%', trend: totalQualified > 0 ? 'up' : 'neutral', icon: UserCheck, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Hot Buying Intent', value: totalHot, change: totalHot > 0 ? 'Immediate action' : 'No hot leads', trend: totalHot > 0 ? 'alert' : 'neutral', icon: Sparkles, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
    { label: 'Deals & Opportunities', value: totalOpps, change: totalOpps > 0 ? `${totalOpps} deals` : '0 deals', trend: totalOpps > 0 ? 'up' : 'neutral', icon: Briefcase, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
    { label: 'Revenue Attributed', value: totalRevenue > 0 ? `₹${(totalRevenue / 1000).toFixed(0)}k` : '₹0', change: totalRevenue > 0 ? 'Active pipeline' : '₹0 pipeline', trend: totalRevenue > 0 ? 'up' : 'neutral', icon: DollarSign, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
    { label: 'Pending Approval', value: pending.length, change: pending.length > 0 ? `${pending.length} pending` : 'All clear', trend: pending.length > 0 ? 'alert' : 'neutral', icon: Clock, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Active Campaigns', value: campaigns.filter((c) => c.status === 'active').length, change: `${campaigns.filter((c) => c.status === 'active').length} active`, trend: 'neutral', icon: Target, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  ];

  const upcomingPosts = [...scheduled]
    .filter((p) => p.date)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 5);

  return (
    <div className="space-y-8 pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            Marketing Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conversational AI Assistant · Content Creation · Intelligent Lead Attribution & CRM Linkages
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reset / Clear Data Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm('Clear all marketing data and start fresh?')) {
                store.clearAllData();
              }
            }}
            className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-border text-muted-foreground hover:text-rose-600 hover:border-rose-500/30"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear All Data
          </Button>

          {/* Simulate inbound response button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSimulatorOpen(true)}
            className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Bot className="h-4 w-4" /> Simulate Lead AI Intent
          </Button>

          {/* Date range switcher */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 shadow-sm">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
                  dateRange === r ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          <Link href="/marketing/create">
            <Button size="sm" className="h-9 px-3.5 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-md">
              <Plus className="h-4 w-4 stroke-[3]" /> Create
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION 1: PROMINENT CONVERSATIONAL AI ASSISTANT HERO */}
      <AIConversationalAssistant />

      {/* SECTION 2: MARKETING -> CRM ATTRIBUTION KPIS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">Marketing → CRM Lead Attribution Overview</h3>
          </div>
          <Link href="/contacts" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            View All CRM Contacts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between gap-2 shadow-sm hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">{k.label}</span>
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border shrink-0', k.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-foreground">{k.value}</p>
                  <p className={cn('text-[10px] font-bold mt-0.5', k.trend === 'up' ? 'text-emerald-500' : k.trend === 'alert' ? 'text-rose-500' : 'text-muted-foreground')}>
                    {k.change}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: AI POST-CAMPAIGN LEARNING INSIGHTS */}
      {insights.length > 0 && (
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-purple-500/5 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">AI Marketing Learning Insights</h3>
                <p className="text-[11px] text-muted-foreground">Proactive recommendations synthesized from audience conversion data</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">
              Continuous Learning Model
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((ins) => (
              <div key={ins.id} className="rounded-2xl border border-border bg-background p-4 flex flex-col justify-between gap-3 shadow-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">{ins.title}</span>
                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {ins.impact}
                    </span>
                  </div>
                  <p className="text-xs text-foreground font-semibold leading-snug">{ins.insight}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{ins.recommendation}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/80 text-xs">
                  <button
                    type="button"
                    onClick={() => store.dismissInsight(ins.id)}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                  <Button
                    size="sm"
                    onClick={() => store.applyInsight(ins.id)}
                    className="h-7 px-3 text-[11px] font-bold rounded-lg bg-primary text-primary-foreground gap-1"
                  >
                    <Check className="h-3 w-3" /> Use Recommendation
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: CAMPAIGN ROI & LEAD ATTRIBUTION BREAKDOWN */}
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Campaign Performance & Direct CRM Lead Flow
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every marketing dollar & post tracked from impression → touchpoints → CRM deal conversion
            </p>
          </div>
          <Link href="/marketing/analytics" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            Deep Attribution Analytics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground rounded-2xl border border-dashed border-border/80 bg-muted/10">
            <Target className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-bold text-foreground">No campaigns yet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
              Create your first marketing campaign with the AI Assistant to track cross-channel ROI and lead conversion.
            </p>
            <Link href="/marketing/create" className="mt-3">
              <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl">
                Create Campaign with AI
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-3">Campaign Name</th>
                  <th className="py-2.5 px-3">Target Audience</th>
                  <th className="py-2.5 px-3">Channels</th>
                  <th className="py-2.5 px-3 text-right">Reach</th>
                  <th className="py-2.5 px-3 text-right">Clicks</th>
                  <th className="py-2.5 px-3 text-right">Total Leads</th>
                  <th className="py-2.5 px-3 text-right">Qualified Leads</th>
                  <th className="py-2.5 px-3 text-right">Hot Leads</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-center">CRM Contacts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-foreground">{camp.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{camp.slug || 'campaign'}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-foreground">{camp.targetAudience || '-'}</span>
                    </td>
                    <td className="py-3 px-3">
                      <PlatformIconStack platforms={camp.platforms} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-foreground">
                      {((camp.metrics?.reach || 0) / 1000).toFixed(1)}k
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-foreground">
                      {(camp.metrics?.clicks || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-foreground">
                      {camp.metrics?.leads || 0}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        {camp.metrics?.qualifiedLeads || 0}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
                        {camp.metrics?.hotLeads || 0}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-foreground">
                      ₹{((camp.metrics?.revenue || 0) / 1000).toFixed(0)}k
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Link
                        href={`/contacts?tag=campaign:${camp.slug || camp.name.toLowerCase().replace(/\s+/g, '-')}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Users className="h-3 w-3" /> View Contacts
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 5: UPCOMING CONTENT & APPROVAL QUEUE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Upcoming Content & Platform Performance */}
        <div className="lg:col-span-7 space-y-6">
          {/* Upcoming Content Timeline */}
          <div className="rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black text-foreground">Upcoming Content Schedule</h3>
              </div>
              <Link href="/marketing/calendar" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View Full Calendar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {upcomingPosts.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
                No scheduled posts yet. Use the AI Assistant above to create and schedule content.
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-background hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlatformIconStack platforms={post.channels} size="sm" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate">{post.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{post.date} @ {post.time || '12:00'}</span>
                          {post.tagsCampaign && (
                            <>
                              <span>·</span>
                              <span className="font-bold text-primary truncate max-w-[140px]">{post.tagsCampaign}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={post.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform Performance Cards */}
          <div className="rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black text-foreground">Leads by Channel Performance</h3>
              </div>
              <Link href="/marketing/analytics" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                Channel Attribution <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PLATFORMS_LIST.map((p) => {
                const meta = SOCIAL_PLATFORM_ICONS[p];
                const Icon = meta?.icon;
                const leadsCount = contacts.filter((c) => c.marketing_attribution?.source?.toLowerCase() === p).length;
                const qualCount = contacts.filter(
                  (c) =>
                    c.marketing_attribution?.source?.toLowerCase() === p &&
                    (c.marketing_attribution?.leadTemperature === 'hot' || c.marketing_attribution?.leadTemperature === 'warm')
                ).length;
                const convRate = leadsCount > 0 ? ((qualCount / leadsCount) * 100).toFixed(0) + '%' : '0%';

                return (
                  <div key={p} className="rounded-2xl border border-border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', meta?.color)}>
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                      </div>
                      <span className="text-xs font-bold text-foreground capitalize truncate">{meta?.label}</span>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Leads:</span>
                        <strong className="text-foreground">{leadsCount}</strong>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Qualified:</span>
                        <strong className={qualCount > 0 ? "text-emerald-500 font-black" : "text-muted-foreground"}>{qualCount}</strong>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Conv. Rate:</span>
                        <strong className="text-foreground">{convRate}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Content Performance Chart & Approval Queue */}
        <div className="lg:col-span-5 space-y-6">
          {/* Approval Queue */}
          <div className="rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-black text-foreground">Approval Queue ({pending.length})</h3>
              </div>
              <Link href="/marketing/approvals" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {pending.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
                ✨ No posts waiting for approval. Default Approval = ON.
              </div>
            ) : (
              <div className="space-y-3">
                {pending.slice(0, 3).map((post) => (
                  <div key={post.id} className="p-3.5 rounded-2xl border border-border bg-background space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground line-clamp-1">{post.title}</h4>
                        <span className="text-[10px] text-primary font-bold">{post.tagsCampaign}</span>
                      </div>
                      <StatusBadge status={post.status} size="sm" />
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{post.defaultCaption}</p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                      <span>By {post.creatorName}</span>
                      <Button
                        size="sm"
                        onClick={() => setReviewPost(post)}
                        className="h-7 px-3 text-[11px] font-bold rounded-lg bg-primary text-primary-foreground gap-1"
                      >
                        Review & Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Chart */}
          <div className="rounded-3xl border border-border bg-card p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black text-foreground">Audience Engagement Curve</h3>
              </div>
            </div>
            <PerformanceChart posts={published} />
          </div>
        </div>
      </div>

      {/* Review Drawer */}
      <ApprovalReviewDrawer
        post={reviewPost}
        currentUserRole={store.currentUser.role}
        currentUserId={store.currentUser.id}
        onClose={() => setReviewPost(null)}
        onApprove={store.approvePost}
        onRequestChanges={store.requestChanges}
        onReject={store.rejectPost}
        onReassign={store.reassignApprover}
      />

      {/* Simulator Modal */}
      <LeadSimulatorModal open={isSimulatorOpen} onOpenChange={setIsSimulatorOpen} />
    </div>
  );
}
