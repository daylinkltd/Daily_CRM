import type { SocialPost } from '@/types/calendar';

export interface AnalyticsDataPoint {
  date: string;
  reach: number;
  engagement: number;
  clicks: number;
  posts: number;
}

export interface PlatformBreakdown {
  platform: string;
  posts: number;
  reach: number;
  engagement: number;
  color: string;
}

export interface TopPost {
  id: string;
  title: string;
  platform: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
  mediaUrl: string;
  publishedDate: string;
}

export const ANALYTICS_TIME_SERIES: AnalyticsDataPoint[] = [];

export const PLATFORM_BREAKDOWN: PlatformBreakdown[] = [];

export const TOP_POSTS: TopPost[] = [];

export const SUMMARY_METRICS = {
  postsPublished: 0,
  totalReach: 0,
  totalEngagement: 0,
  totalLikes: 0,
  totalComments: 0,
  totalShares: 0,
  totalClicks: 0,
  followersGained: 0,
  followersTotal: 0,
  engagementRate: 0,
};

export function buildTimeSeriesFromPosts(posts: SocialPost[]): AnalyticsDataPoint[] {
  const published = posts.filter(p => p.status === 'published' && p.analytics);
  if (published.length === 0) return [];

  const map: Record<string, AnalyticsDataPoint> = {};
  published.forEach(p => {
    const d = new Date(p.date || p.createdAt);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!map[dateStr]) {
      map[dateStr] = { date: dateStr, reach: 0, engagement: 0, clicks: 0, posts: 0 };
    }
    map[dateStr].posts += 1;
    map[dateStr].reach += p.analytics?.reach || 0;
    map[dateStr].engagement += (p.analytics?.likes || 0) + (p.analytics?.comments || 0) + (p.analytics?.shares || 0);
    map[dateStr].clicks += p.analytics?.clicks || 0;
  });

  return Object.values(map);
}

export function buildPlatformBreakdownFromPosts(posts: SocialPost[]): PlatformBreakdown[] {
  const colors: Record<string, string> = {
    instagram: '#ec4899',
    linkedin: '#0284c7',
    x: '#64748b',
    facebook: '#2563eb',
    tiktok: '#14b8a6',
    youtube: '#ef4444',
    threads: '#a855f7',
    pinterest: '#e11d48',
  };

  const map: Record<string, PlatformBreakdown> = {};
  posts.forEach(p => {
    p.channels.forEach(ch => {
      const name = ch.charAt(0).toUpperCase() + ch.slice(1);
      if (!map[name]) {
        map[name] = { platform: name, posts: 0, reach: 0, engagement: 0, color: colors[ch] || '#6366f1' };
      }
      map[name].posts += 1;
      if (p.analytics) {
        map[name].reach += p.analytics.reach || 0;
        map[name].engagement += (p.analytics.likes || 0) + (p.analytics.comments || 0) + (p.analytics.shares || 0);
      }
    });
  });

  return Object.values(map);
}
