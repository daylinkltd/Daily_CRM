export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'x'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'pinterest';

export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected';

export type ContentType =
  | 'post'
  | 'reel'
  | 'story'
  | 'video'
  | 'carousel'
  | 'short'
  | 'article';

export type CRMActivityType =
  | 'meeting'
  | 'call'
  | 'followup'
  | 'task'
  | 'appointment'
  | 'deal'
  | 'reminder';

export type CRMActivityStatus = 'upcoming' | 'completed' | 'overdue' | 'cancelled';

export type UserRole = 'creator' | 'approver' | 'admin' | 'manager' | 'designer' | 'analyst';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  avatarUrl?: string;
  email: string;
}

export interface PlatformContentOverride {
  platform: SocialPlatform;
  caption?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  link?: string;
  altText?: string;
  firstComment?: string;
}

export interface AuditHistoryItem {
  id: string;
  timestamp: string;
  action:
    | 'created'
    | 'edited'
    | 'submitted'
    | 'changes_requested'
    | 'resubmitted'
    | 'approved'
    | 'scheduled'
    | 'published'
    | 'rejected'
    | 'rescheduled'
    | 'reassigned';
  userId: string;
  userName: string;
  userRole: string;
  comment?: string;
}

export interface PostAnalytics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagementRate: number; // e.g. 4.8 for 4.8%
  clicks: number;
  saves?: number;
  impressions?: number;
}

export interface Campaign {
  id: string;
  name: string;
  slug?: string;
  description: string;
  objective: string;
  targetAudience?: string;
  cta?: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  ownerName: string;
  teamMemberIds: string[];
  platforms: SocialPlatform[];
  budget: number;
  spent?: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  metrics?: CampaignMetrics;
  createdAt: string;
}

export interface ContentIdea {
  id: string;
  title: string;
  notes: string;
  platforms: SocialPlatform[];
  tags: string[];
  campaignId?: string;
  campaignName?: string;
  creatorName: string;
  createdAt: string;
}

export interface MarketingNotification {
  id: string;
  title: string;
  message: string;
  type:
    | 'approval_submitted'
    | 'approval_approved'
    | 'approval_rejected'
    | 'changes_requested'
    | 'post_published'
    | 'post_failed'
    | 'campaign_ending'
    | 'team_assignment'
    | 'analytics_report';
  targetId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface MarketingSettings {
  defaultTimezone: string;
  defaultPlatform: SocialPlatform;
  approvalRequired: boolean;
  approvalLevels: 'single' | 'two_tier';
  rejectionBehavior: 'return_to_creator' | 'archive';
  aiTone: 'engaging' | 'professional' | 'concise' | 'creative';
  aiBrandVoice: string;
  aiLanguage: string;
  hashtagCount: number;
}

export interface SocialPost {
  id: string;
  category: 'social';
  title: string;
  contentType?: ContentType;
  channels: SocialPlatform[];
  defaultCaption: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video';
  hashtags?: string[];
  mentions?: string[];
  link?: string;
  altText?: string;
  firstComment?: string;
  tagsCampaign?: string;
  campaignId?: string;
  status: PostStatus;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  approverId?: string;
  approverName?: string;

  // CRM Linkages
  crmContactId?: string;
  crmContactName?: string;
  crmCompanyId?: string;
  crmCompanyName?: string;
  crmDealId?: string;
  crmDealName?: string;
  crmCampaignId?: string;
  crmCampaignName?: string;
  crmTaskId?: string;
  crmTaskName?: string;
  crmProjectId?: string;
  crmProjectName?: string;

  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm format
  timezone?: string;
  createdAt: string;
  updatedAt: string;
  platformOverrides?: Record<string, PlatformContentOverride>;
  auditHistory: AuditHistoryItem[];
  analytics?: PostAnalytics;
}

export interface CRMActivity {
  id: string;
  category: 'crm';
  type: CRMActivityType;
  title: string;
  contactId?: string;
  contactName?: string;
  companyId?: string;
  companyName?: string;
  dealId?: string;
  dealName?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  status: CRMActivityStatus;
  assigneeId: string;
  assigneeName: string;
  notes?: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  category: 'blog';
  title: string;
  slug: string;
  featuredImage?: string;
  excerpt?: string;
  content?: string;
  summary: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  postCategory?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  campaignId?: string;
  campaignName?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEvent = SocialPost | CRMActivity | BlogPost;

export type PrimaryFilter = 'all' | 'crm' | 'social' | 'blog';

export interface CalendarFilters {
  primary: PrimaryFilter;
  channels: SocialPlatform[];
  socialStatus: PostStatus | 'all';
  crmStatus: CRMActivityStatus | 'all';
  searchQuery: string;
  campaignId?: string;
  creatorId?: string;
}

export type LeadSource =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'x'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'pinterest'
  | 'blog'
  | 'website'
  | 'landing_page'
  | 'google'
  | 'email'
  | 'whatsapp'
  | 'referral'
  | 'campaign'
  | 'direct'
  | 'manual_entry';

export type LeadSourceType =
  | 'social_media'
  | 'search'
  | 'website'
  | 'direct'
  | 'referral'
  | 'paid_ads'
  | 'messaging'
  | 'email'
  | 'organic_content';

export type LeadTemperature = 'hot' | 'warm' | 'cold' | 'engagement' | 'spam';

export type LeadIntent =
  | 'pricing'
  | 'demo'
  | 'product_enquiry'
  | 'partnership'
  | 'support'
  | 'general_enquiry';

export interface JourneyTouchpoint {
  id: string;
  channel: string;
  type: 'view' | 'click' | 'read' | 'comment' | 'enquiry' | 'form_submission' | 'chat';
  title: string;
  timestamp: string;
  details?: string;
  campaignName?: string;
  contentTitle?: string;
}

export interface MarketingAttribution {
  source: string;
  sourceType: string;
  campaign?: string;
  campaignId?: string;
  content?: string;
  contentId?: string;
  firstTouch: string;
  lastTouch: string;
  leadScore: number;
  leadTemperature: LeadTemperature;
  intent: LeadIntent | string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  touchpoints: JourneyTouchpoint[];
}

export interface AIMarketingInsight {
  id: string;
  title: string;
  insight: string;
  recommendation: string;
  impact: string;
  type: 'platform_shift' | 'content_angle' | 'timing' | 'audience' | 'roi';
  status: 'active' | 'applied' | 'dismissed';
  createdAt: string;
}

export interface CampaignMetrics {
  reach: number;
  engagement: number;
  clicks: number;
  leads: number;
  qualifiedLeads: number;
  hotLeads: number;
  opportunities: number;
  revenue: number;
}

