import type {
  CRMActivity,
  SocialPost,
  BlogPost,
  Campaign,
  ContentIdea,
  MarketingNotification,
  MarketingSettings,
  AIMarketingInsight,
} from '@/types/calendar';

export const INITIAL_CRM_ACTIVITIES: CRMActivity[] = [];

export const INITIAL_BLOG_POSTS: BlogPost[] = [];

export const INITIAL_SOCIAL_POSTS: SocialPost[] = [];

export const INITIAL_CAMPAIGNS: Campaign[] = [];

export const INITIAL_CONTENT_IDEAS: ContentIdea[] = [];

export const INITIAL_MARKETING_NOTIFICATIONS: MarketingNotification[] = [];

export const INITIAL_MARKETING_SETTINGS: MarketingSettings = {
  defaultTimezone: 'UTC',
  defaultPlatform: 'linkedin',
  approvalRequired: true,
  approvalLevels: 'single',
  rejectionBehavior: 'return_to_creator',
  aiTone: 'engaging',
  aiBrandVoice: 'Authoritative yet approachable B2B SaaS tone, focused on productivity, growth, and omnichannel efficiency.',
  aiLanguage: 'English (US)',
  hashtagCount: 4,
};

export const INITIAL_AI_INSIGHTS: AIMarketingInsight[] = [];

export const INITIAL_MARKETING_CONTACTS: any[] = [];
