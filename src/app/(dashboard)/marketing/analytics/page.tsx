'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  PerformanceChart,
  PostsByPlatformChart,
  EngagementPieChart,
} from '@/components/social/social-analytics-charts';
import { buildPlatformBreakdownFromPosts } from '@/lib/social/mock-analytics';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import type { SocialPlatform } from '@/types/calendar';
import {
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  MousePointer,
  Users,
  BarChart3,
  Flame,
  UserCheck,
  Briefcase,
  DollarSign,
  Lightbulb,
  Check,
  ArrowRight,
  Target,
  Sparkles,
  Plus,
  SendHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DATE_RANGES = ['Today', '7 Days', '30 Days', '90 Days', 'Custom Range'] as const;
const PLATFORM_FILTERS: (SocialPlatform | 'all')[] = [
  'all',
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'threads',
  'pinterest',
];

function formatNum(n: number): string {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

export default function MarketingAnalyticsPage() {
  const store = useCalendarStore();
  const [dateRange, setDateRange] = useState<string>('30 Days');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');

  const campaigns = store.campaigns || [];
  const insights = (store.aiInsights || []).filter((i) => i.status === 'active');
  const published = store.publishedPosts || [];
  const allPosts = store.socialPosts || [];
  const contacts = store.marketingContacts || [];

  // Filter published posts by platform if selected
  const filteredPublished = platformFilter === 'all'
    ? published
    : published.filter(p => p.channels.includes(platformFilter));

  const totalReach = published.reduce((s, p) => s + (p.analytics?.reach || 0), 0);
  const totalLikes = published.reduce((s, p) => s + (p.analytics?.likes || 0), 0);
  const totalComments = published.reduce((s, p) => s + (p.analytics?.comments || 0), 0);
  const totalShares = published.reduce((s, p) => s + (p.analytics?.shares || 0), 0);
  const totalClicks = published.reduce((s, p) => s + (p.analytics?.clicks || 0), 0);
  const totalEngagement = totalLikes + totalComments + totalShares;
  const avgEngRate = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(1) + '%' : '0.0%';

  const totalLeads = contacts.length || campaigns.reduce((s, c) => s + (c.metrics?.leads || 0), 0);
  const totalQualified = contacts.filter(c => c.marketing_attribution?.leadTemperature === 'hot' || c.marketing_attribution?.leadTemperature === 'warm').length
    || campaigns.reduce((s, c) => s + (c.metrics?.qualifiedLeads || 0), 0);
  const totalHot = contacts.filter(c => c.marketing_attribution?.leadTemperature === 'hot').length
    || campaigns.reduce((s, c) => s + (c.metrics?.hotLeads || 0), 0);
  const totalOpps = campaigns.reduce((s, c) => s + (c.metrics?.opportunities || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.metrics?.revenue || 0), 0);

  const crmMetrics = [
    { label: 'Total Leads Generated', value: totalLeads, change: totalLeads > 0 ? `${totalLeads} tracked` : '0 tracked', trend: totalLeads > 0 ? 'up' : 'neutral', icon: Flame, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { label: 'Qualified Leads', value: totalQualified, change: totalLeads > 0 ? `${Math.round((totalQualified / (totalLeads || 1)) * 100)}% Qual. Rate` : '0%', trend: totalQualified > 0 ? 'up' : 'neutral', icon: UserCheck, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Hot Buying Intent', value: totalHot, change: totalHot > 0 ? 'Action required' : 'No hot leads', trend: totalHot > 0 ? 'alert' : 'neutral', icon: Sparkles, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
    { label: 'Warm Prospects', value: Math.max(0, totalLeads - totalHot), change: 'In nurturing', trend: 'neutral', icon: Users, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    { label: 'Deals Created', value: totalOpps, change: totalOpps > 0 ? `${totalOpps} deals` : '0 deals', trend: totalOpps > 0 ? 'up' : 'neutral', icon: Briefcase, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
    { label: 'Customers Converted', value: Math.round(totalOpps * 0.5), change: 'From marketing', trend: 'neutral', icon: Target, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Attributed Revenue', value: totalRevenue > 0 ? `₹${(totalRevenue / 1000).toFixed(0)}k` : '₹0', change: totalRevenue > 0 ? 'Live pipeline' : 'No revenue yet', trend: totalRevenue > 0 ? 'up' : 'neutral', icon: DollarSign, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  ];

  // Dynamic source breakdown computed from real contacts & campaigns
  const sourceMap: Record<string, { name: string; leads: number; qualified: number; color: string }> = {};
  contacts.forEach(c => {
    const src = c.marketing_attribution?.source || 'Direct / Website';
    if (!sourceMap[src]) {
      sourceMap[src] = { name: src, leads: 0, qualified: 0, color: 'bg-primary' };
    }
    sourceMap[src].leads += 1;
    if (c.marketing_attribution?.leadTemperature === 'hot' || c.marketing_attribution?.leadTemperature === 'warm') {
      sourceMap[src].qualified += 1;
    }
  });
  const sourceBreakdown = Object.values(sourceMap);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Marketing & CRM Attribution Analytics"
        description="Comprehensive cross-channel campaign metrics, lead source attribution, revenue ROI, and performance benchmarks."
      />

      {/* Date Range & Platform Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1 bg-card border border-border rounded-2xl p-1 shadow-sm overflow-x-auto">
          {DATE_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0',
                dateRange === range ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto max-w-full">
          {PLATFORM_FILTERS.map((pf) => {
            const meta = pf !== 'all' ? SOCIAL_PLATFORM_ICONS[pf] : null;
            const Icon = meta?.icon;
            return (
              <button
                key={pf}
                onClick={() => setPlatformFilter(pf)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl border transition-colors shrink-0',
                  platformFilter === pf
                    ? pf === 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : `${meta?.color} border-transparent shadow-xs`
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {pf === 'all' ? 'All Channels' : meta?.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: MARKETING -> CRM ATTRIBUTION KPI CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-500" /> Leads Generated & Pipeline Attribution
          </h3>
          <Link href="/contacts" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            CRM Contacts Database <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {crmMetrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-2xl border border-border bg-card p-3.5 flex flex-col justify-between gap-1.5 shadow-sm hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">{m.label}</span>
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border shrink-0', m.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">{m.value}</p>
                  <p className={cn('text-[10px] font-bold mt-0.5', m.trend === 'up' ? 'text-emerald-500' : m.trend === 'alert' ? 'text-rose-500' : 'text-muted-foreground')}>
                    {m.change}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">Reach & Engagement Over Time</h3>
            <span className="text-xs text-muted-foreground font-bold">{dateRange}</span>
          </div>
          <PerformanceChart posts={filteredPublished} />
        </div>

        <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">Engagement Breakdown</h3>
          </div>
          <EngagementPieChart posts={filteredPublished} />
        </div>
      </div>

      {/* SECTION 3: PLATFORM BREAKDOWN & SOURCE LEADS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-black text-foreground">Platform Comparison & Volume</h3>
          <PostsByPlatformChart posts={allPosts} />
        </div>

        <div className="lg:col-span-6 rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Leads by Marketing Source
            </h3>
            <span className="text-xs text-muted-foreground font-bold">{contacts.length} Total Leads</span>
          </div>

          {sourceBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6 rounded-2xl border border-dashed border-border/80 bg-muted/10">
              <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-bold text-foreground">No source attribution recorded yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                When prospects engage with campaigns or submit forms, their source channels will be charted here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sourceBreakdown.map((s) => (
                <div key={s.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-foreground">{s.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{s.leads} Leads</span>
                      <span className="text-emerald-500">{s.qualified} Qualified</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                    <div className={cn('h-full rounded-full', s.color)} style={{ width: `${Math.min(100, (s.leads / (totalLeads || 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: CAMPAIGN ATTRIBUTION TABLE */}
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Campaign Attribution & ROI Breakdown
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live metrics and CRM contact drilldown for active marketing campaigns
            </p>
          </div>
          <Link href="/marketing/create">
            <Button size="sm" className="h-8 px-3 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-xs">
              <Plus className="h-3.5 w-3.5" /> Create Campaign
            </Button>
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground rounded-2xl border border-dashed border-border/80 bg-muted/10">
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
                <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <th className="py-3 px-3">Campaign</th>
                  <th className="py-3 px-3">Audience</th>
                  <th className="py-3 px-3 text-right">Reach</th>
                  <th className="py-3 px-3 text-right">Clicks</th>
                  <th className="py-3 px-3 text-right">Leads</th>
                  <th className="py-3 px-3 text-right">Qualified</th>
                  <th className="py-3 px-3 text-right">Hot</th>
                  <th className="py-3 px-3 text-right">Opps</th>
                  <th className="py-3 px-3 text-right">Revenue</th>
                  <th className="py-3 px-3 text-center">CRM Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-foreground">{camp.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{camp.slug || 'campaign'}</div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-foreground">{camp.targetAudience || '-'}</td>
                    <td className="py-3.5 px-3 text-right font-medium">{formatNum(camp.metrics?.reach || 0)}</td>
                    <td className="py-3.5 px-3 text-right font-medium">{(camp.metrics?.clicks || 0).toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-foreground">{camp.metrics?.leads || 0}</td>
                    <td className="py-3.5 px-3 text-right">
                      <span className="font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        {camp.metrics?.qualifiedLeads || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className="font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
                        {camp.metrics?.hotLeads || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-foreground">{camp.metrics?.opportunities || 0}</td>
                    <td className="py-3.5 px-3 text-right font-black text-foreground">
                      ₹{((camp.metrics?.revenue || 0) / 1000).toFixed(0)}k
                    </td>
                    <td className="py-3.5 px-3 text-center">
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

      {/* SECTION 5: PUBLISHED CONTENT PERFORMANCE TABLE */}
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground">Published Content Performance</h3>
          <span className="text-xs text-muted-foreground font-bold">{published.length} Published</span>
        </div>

        {published.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground rounded-2xl border border-dashed border-border/80 bg-muted/10">
            <SendHorizontal className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-bold text-foreground">Nothing published yet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Published marketing content will appear here with live reach, clicks, and engagement stats.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground uppercase text-[10px] font-extrabold tracking-wider">
                <tr>
                  <th className="p-3">Post Title</th>
                  <th className="p-3">Platform</th>
                  <th className="p-3 text-right">Reach</th>
                  <th className="p-3 text-right">Likes</th>
                  <th className="p-3 text-right">Comments</th>
                  <th className="p-3 text-right">Shares</th>
                  <th className="p-3 text-right">Clicks</th>
                  <th className="p-3 text-right">Eng. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {published.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-bold text-foreground max-w-[240px] truncate">{p.title}</td>
                    <td className="p-3 capitalize">{p.channels.join(', ')}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatNum(p.analytics?.reach || 0)}</td>
                    <td className="p-3 text-right font-mono text-rose-500 font-bold">{p.analytics?.likes || 0}</td>
                    <td className="p-3 text-right font-mono text-violet-500 font-bold">{p.analytics?.comments || 0}</td>
                    <td className="p-3 text-right font-mono text-amber-500 font-bold">{p.analytics?.shares || 0}</td>
                    <td className="p-3 text-right font-mono text-sky-500 font-bold">{p.analytics?.clicks || 0}</td>
                    <td className="p-3 text-right font-mono text-emerald-500 font-black">
                      {p.analytics?.engagementRate || 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 6: AI MARKETING LEARNING INSIGHTS */}
      {insights.length > 0 && (
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-purple-500/5 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">AI Marketing Learning Insights</h3>
                <p className="text-[11px] text-muted-foreground">Actionable recommendations generated from attribution data</p>
              </div>
            </div>
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
    </div>
  );
}
