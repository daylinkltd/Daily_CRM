'use client';

import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { buildTimeSeriesFromPosts, buildPlatformBreakdownFromPosts, AnalyticsDataPoint, PlatformBreakdown } from '@/lib/social/mock-analytics';
import type { SocialPost } from '@/types/calendar';
import { BarChart3, PieChart as PieIcon, LineChart as LineIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Shared Tooltip ─── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-card border border-border shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-bold text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="flex items-center gap-1.5 font-semibold">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: entry.color }} />
          {entry.name}: {Number(entry.value || 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/* ─── Performance Over Time Chart ─── */
interface PerformanceChartProps {
  posts?: SocialPost[];
  data?: AnalyticsDataPoint[];
  className?: string;
}

export function PerformanceChart({ posts = [], data: propData, className }: PerformanceChartProps) {
  const chartData = propData || buildTimeSeriesFromPosts(posts);
  const hasData = chartData.length > 0 && chartData.some(d => d.reach > 0 || d.engagement > 0 || d.clicks > 0);

  if (!hasData) {
    return (
      <div className={cn('w-full h-56 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-border/80 bg-muted/10', className)}>
        <LineIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs font-bold text-foreground">Not enough data yet</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
          Analytics will appear after your marketing activity starts publishing and generating engagement.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('w-full h-56', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="reach" name="Reach" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="engagement" name="Engagement" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Posts by Platform Bar Chart ─── */
interface PostsByPlatformChartProps {
  posts?: SocialPost[];
  data?: PlatformBreakdown[];
  className?: string;
}

export function PostsByPlatformChart({ posts = [], data: propData, className }: PostsByPlatformChartProps) {
  const chartData = propData || buildPlatformBreakdownFromPosts(posts);
  const hasData = chartData.length > 0 && chartData.some(d => d.posts > 0);

  if (!hasData) {
    return (
      <div className={cn('w-full h-48 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-border/80 bg-muted/10', className)}>
        <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs font-bold text-foreground">No platform activity yet</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Posts scheduled or published across connected channels will be compared here.
        </p>
      </div>
    );
  }

  const data = chartData.map(p => ({ name: p.platform, posts: p.posts, color: p.color }));

  return (
    <div className={cn('w-full h-48', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="posts" name="Posts" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Engagement by Platform Pie ─── */
interface EngagementPieChartProps {
  posts?: SocialPost[];
  data?: PlatformBreakdown[];
  className?: string;
}

export function EngagementPieChart({ posts = [], data: propData, className }: EngagementPieChartProps) {
  const chartData = propData || buildPlatformBreakdownFromPosts(posts);
  const hasData = chartData.length > 0 && chartData.some(d => d.engagement > 0);

  if (!hasData) {
    return (
      <div className={cn('w-full h-48 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-border/80 bg-muted/10', className)}>
        <PieIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs font-bold text-foreground">No engagement recorded yet</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Audience reactions and interactions will populate this breakdown.
        </p>
      </div>
    );
  }

  const data = chartData.map(p => ({ name: p.platform, value: p.engagement, color: p.color }));

  return (
    <div className={cn('w-full h-48 flex', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Engagements']} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
