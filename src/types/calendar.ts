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
  | 'generating'
  | 'ready_for_review'
  | 'ai_generated'
  | 'pending_approval'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rejected';

export type ContentType =
  | 'post'
  | 'social'
  | 'blog'
  | 'article'
  | 'promo'
  | 'product_service'
  | 'announcement'
  | 'educational'
  | 'case_study'
  | 'testimonial'
  | 'behind_the_scenes'
  | 'industry_insights'
  | 'interactive_poll'
  | 'tips_tricks'
  | 'event'
  | 'meme_humor'
  | 'comparison'
  | 'ugc_spotlight'
  | 'seasonal_holiday'
  | 'newsletter_digest'
  | 'reel'
  | 'story'
  | 'video'
  | 'carousel'
  | 'short';

export type ToneType =
  | 'creative'
  | 'engaging'
  | 'professional'
  | 'concise'
  | 'educational'
  | 'bold'
  | 'witty'
  | 'empathetic'
  | 'urgent'
  | 'inspirational'
  | 'technical'
  | 'casual'
  | 'storytelling'
  | 'luxurious'
  | 'contrarian';

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
    | 'failed'
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

export type MarketingNotificationType =
  | 'POSTING_TODAY'
  | 'POST_UPCOMING'
  | 'POST_READY'
  | 'APPROVAL_REQUIRED'
  | 'MEDIA_MISSING'
  | 'PUBLISHING_FAILED'
  | 'PUBLISHING_SUCCESS'
  | 'POST_MISSED'
  | 'SOCIAL_ACCOUNT_DISCONNECTED'
  | 'SCHEDULE_CONFLICT'
  | 'POST_REJECTED'
  | 'CHANGES_REQUESTED'
  | 'approval_submitted'
  | 'approval_approved'
  | 'approval_rejected'
  | 'changes_requested'
  | 'post_published'
  | 'post_failed'
  | 'campaign_ending'
  | 'team_assignment'
  | 'analytics_report';

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type OperationalPostStatus =
  | 'READY'
  | 'PENDING_APPROVAL'
  | 'MISSING_MEDIA'
  | 'FAILED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'CANCELLED'
  | 'MISSED';

export interface AttentionItem {
  id: string;
  postId: string;
  title: string;
  channels: SocialPlatform[];
  contentType?: string;
  scheduledAt?: string;
  scheduledTime?: string;
  reason: 'approval_pending' | 'media_missing' | 'publishing_failed' | 'post_missed' | 'channel_disconnected' | 'changes_requested' | 'rejected';
  severity: NotificationSeverity;
  actionLabel: string;
  actionUrl: string;
  details?: string;
}

export interface TodayScheduledPostItem {
  id: string;
  title: string;
  channels: SocialPlatform[];
  contentType: string;
  scheduledAt?: string;
  date?: string;
  time?: string;
  operationalStatus: OperationalPostStatus;
  statusLabel: string;
  statusTone: 'ok' | 'warn' | 'error' | 'muted' | 'info';
  needsAttention: boolean;
  attentionReason?: string;
  mediaUrl?: string;
  creatorName?: string;
}

export interface NextScheduledPostItem {
  id: string;
  title: string;
  channels: SocialPlatform[];
  contentType: string;
  scheduledAt: string;
  date: string;
  time: string;
  minutesUntil: number;
  countdownLabel: string;
  operationalStatus: OperationalPostStatus;
  needsAttention: boolean;
  attentionReason?: string;
}

export interface TodaysPostingSummary {
  date: string; // YYYY-MM-DD
  timezone: string;
  totalScheduled: number;
  readyCount: number;
  attentionCount: number;
  publishedCount: number;
  posts: TodayScheduledPostItem[];
  nextPost: NextScheduledPostItem | null;
  attentionItems: AttentionItem[];
  upcomingPosts: Array<{
    id: string;
    title: string;
    channels: SocialPlatform[];
    contentType: string;
    scheduledAt: string;
    date: string;
    time: string;
    dateLabel: string; // 'Today', 'Tomorrow', 'Wed, 10 Sep'
  }>;
}

export interface MarketingNotificationPreferences {
  workspace_id?: string;
  user_id?: string;
  posting_reminders_enabled: boolean;
  daily_summary_enabled: boolean;
  daily_summary_time: string; // e.g. '09:00'
  upcoming_reminders_enabled: boolean;
  upcoming_timing_minutes: number; // e.g. 15, 30, 60
  approval_notifications_enabled: boolean;
  publishing_success_enabled: boolean;
  publishing_failure_enabled: boolean;
  missing_media_enabled: boolean;
  channels: {
    in_app: boolean;
    email: boolean;
  };
}

export interface MarketingNotification {
  id: string;
  workspace_id?: string;
  recipient_user_id?: string;
  title: string;
  message: string;
  type: MarketingNotificationType;
  severity?: NotificationSeverity;
  targetId?: string;
  related_post_id?: string;
  related_calendar_event_id?: string;
  metadata?: Record<string, any>;
  dedupe_key?: string;
  isRead: boolean;
  read_at?: string;
  createdAt: string;
  created_at?: string;
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
  mediaSource?: 'UPLOADED' | 'AI_GENERATED' | 'STOCK';
  shortCaption?: string;
  cta?: string;
  hashtags?: string[];
  keywords?: string[];
  image_prompt?: string;
  video_prompt?: string;
  image_prompt_version?: number;
  video_prompt_version?: number;
  objective?: string;
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
  assignedApproverId?: string;
  assignedApproverName?: string;
  rejection_reason?: string;
  approval_notes?: string;
  failure_reason?: string;

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
  scheduled_at?: string;
  published_at?: string;
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
  scheduled_at?: string;
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

