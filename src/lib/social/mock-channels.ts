import type { SocialPlatform } from '@/types/calendar';

export interface MockChannel {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  profileUrl: string;
  avatarUrl: string;
  isConnected: boolean;
  lastSynced: string;
  followers: number;
  scheduledCount: number;
  publishedCount: number;
  pendingCount: number;
  bio: string;
}

export const MOCK_CHANNELS: MockChannel[] = [
  {
    id: 'ch_instagram',
    platform: 'instagram',
    accountName: '@dailycrm_official',
    profileUrl: 'https://instagram.com/dailycrm_official',
    avatarUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=80&auto=format&fit=crop&q=80',
    isConnected: true,
    lastSynced: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    followers: 12400,
    scheduledCount: 4,
    publishedCount: 47,
    pendingCount: 1,
    bio: 'The all-in-one CRM for growing businesses. WhatsApp + CRM + Social.',
  },
  {
    id: 'ch_facebook',
    platform: 'facebook',
    accountName: 'Daily CRM Page',
    profileUrl: 'https://facebook.com/dailycrm',
    avatarUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=80&auto=format&fit=crop&q=80',
    isConnected: true,
    lastSynced: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    followers: 8650,
    scheduledCount: 3,
    publishedCount: 62,
    pendingCount: 2,
    bio: 'Grow your business with AI-powered CRM automation.',
  },
  {
    id: 'ch_linkedin',
    platform: 'linkedin',
    accountName: 'Daily CRM Company',
    profileUrl: 'https://linkedin.com/company/dailycrm',
    avatarUrl: 'https://images.unsplash.com/photo-1616469829935-c2cd407df0ce?w=80&auto=format&fit=crop&q=80',
    isConnected: true,
    lastSynced: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    followers: 5820,
    scheduledCount: 5,
    publishedCount: 89,
    pendingCount: 0,
    bio: 'Enterprise-grade CRM for sales, marketing and support teams.',
  },
  {
    id: 'ch_x',
    platform: 'x',
    accountName: '@DailyCRMApp',
    profileUrl: 'https://x.com/DailyCRMApp',
    avatarUrl: 'https://images.unsplash.com/photo-1611605698335-8441fbf929be?w=80&auto=format&fit=crop&q=80',
    isConnected: true,
    lastSynced: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    followers: 3210,
    scheduledCount: 2,
    publishedCount: 134,
    pendingCount: 1,
    bio: 'Real-time CRM updates and product news. Tweets by the team.',
  },
  {
    id: 'ch_tiktok',
    platform: 'tiktok',
    accountName: '@dailycrm_tok',
    profileUrl: 'https://tiktok.com/@dailycrm_tok',
    avatarUrl: 'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=80&auto=format&fit=crop&q=80',
    isConnected: true,
    lastSynced: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    followers: 7840,
    scheduledCount: 1,
    publishedCount: 28,
    pendingCount: 0,
    bio: 'Behind the scenes, product tutorials and CRM tips.',
  },
  {
    id: 'ch_youtube',
    platform: 'youtube',
    accountName: 'Daily CRM Tech',
    profileUrl: 'https://youtube.com/@dailycrmtech',
    avatarUrl: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=80&auto=format&fit=crop&q=80',
    isConnected: true,
    lastSynced: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    followers: 2190,
    scheduledCount: 1,
    publishedCount: 15,
    pendingCount: 0,
    bio: 'Tutorials, case studies, and deep-dives into Daily CRM features.',
  },
  {
    id: 'ch_threads',
    platform: 'threads',
    accountName: '@dailycrm_threads',
    profileUrl: 'https://threads.net/@dailycrm_threads',
    avatarUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=80&auto=format&fit=crop&q=80',
    isConnected: false,
    lastSynced: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    followers: 840,
    scheduledCount: 0,
    publishedCount: 6,
    pendingCount: 0,
    bio: 'Conversational marketing content from Daily CRM.',
  },
];

export function formatFollowers(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return count.toString();
}

export function formatLastSynced(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}
