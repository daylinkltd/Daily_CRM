/**
 * DailyBuz Marketing Calendar Notifications & Reminders Engine
 * Production-Ready Multi-Tenant Implementation
 * 
 * Deterministic, timezone-aware, idempotent operational status classification
 * and reminder dispatch logic.
 */

import type {
  SocialPost,
  SocialPlatform,
  OperationalPostStatus,
  NotificationSeverity,
  AttentionItem,
  TodayScheduledPostItem,
  NextScheduledPostItem,
  TodaysPostingSummary,
  MarketingNotification,
  MarketingNotificationType,
  MarketingNotificationPreferences,
} from '@/types/calendar';

// Default user preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: MarketingNotificationPreferences = {
  posting_reminders_enabled: true,
  daily_summary_enabled: true,
  daily_summary_time: '09:00',
  upcoming_reminders_enabled: true,
  upcoming_timing_minutes: 30,
  approval_notifications_enabled: true,
  publishing_success_enabled: true,
  publishing_failure_enabled: true,
  missing_media_enabled: true,
  channels: {
    in_app: true,
    email: false,
  },
};

/**
 * Sanitizes input text by stripping HTML tags and normalizing whitespace
 */
export function sanitizePlainText(input?: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// TIMEZONE & DATE UTILITIES
// ============================================================

/**
 * Formats a Date object or ISO string in a specific IANA timezone into YYYY-MM-DD
 */
export function getLocalDateString(dateInput: Date | string, timeZone: string = 'UTC'): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // outputs YYYY-MM-DD
  } catch {
    // Fallback if invalid timezone string provided
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toISOString().split('T')[0];
  }
}

/**
 * Formats a Date object or ISO string in a specific IANA timezone into HH:mm (24-hour)
 */
export function getLocalTimeString(dateInput: Date | string, timeZone: string = 'UTC'): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '12:00';

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

/**
 * Formats a Date into friendly 12-hour format e.g. "10:30 AM"
 */
export function formatLocalTime12h(dateInput: Date | string, timeZone: string = 'UTC'): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '12:00 PM';
  }
}

/**
 * Computes difference in minutes between future date and now
 */
export function getMinutesUntil(futureDateInput: Date | string, nowDateInput: Date | string = new Date()): number {
  const future = typeof futureDateInput === 'string' ? new Date(futureDateInput) : futureDateInput;
  const now = typeof nowDateInput === 'string' ? new Date(nowDateInput) : nowDateInput;
  const diffMs = future.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Formats countdown label based on minutes
 */
export function formatCountdown(minutesUntil: number): string {
  if (minutesUntil <= 0) return 'Starting now';
  if (minutesUntil <= 2) return 'Starting soon';
  if (minutesUntil < 60) return `Starts in ${minutesUntil} minutes`;
  
  const hours = Math.floor(minutesUntil / 60);
  const remainingMinutes = minutesUntil % 60;
  if (remainingMinutes === 0) {
    return `Starts in ${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `Starts in ${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
}

// ============================================================
// STATUS & ATTENTION CLASSIFIER
// ============================================================

export interface OperationalClassification {
  status: OperationalPostStatus;
  statusLabel: string;
  statusTone: 'ok' | 'warn' | 'error' | 'muted' | 'info';
  needsAttention: boolean;
  attentionReason?: AttentionItem['reason'];
  attentionDetails?: string;
  severity: NotificationSeverity;
}

/**
 * Determines whether a post requires media based on content type and channels
 */
export function doesPostRequireMedia(post: Partial<SocialPost>): boolean {
  if ((post.mediaType as any) === 'none') return false;
  
  const visualContentTypes = ['reel', 'story', 'video', 'carousel', 'short'];
  if (post.contentType && visualContentTypes.includes(post.contentType)) {
    return true;
  }

  const visualChannels: SocialPlatform[] = ['instagram', 'tiktok', 'youtube', 'pinterest'];
  if (post.channels && post.channels.some((c) => visualChannels.includes(c))) {
    return true;
  }

  return false;
}

/**
 * Authoritative classification of a post into its operational state
 */
export function classifyPostStatus(
  post: Partial<SocialPost> & Record<string, any>,
  now: Date = new Date(),
  disconnectedChannels: SocialPlatform[] = []
): OperationalClassification {
  const isPublished = post.status === 'published';
  const isPublishing = post.status === 'publishing';
  const isFailed = post.status === 'failed';
  const isRejected = post.status === 'rejected';
  const isChangesRequested = post.status === 'changes_requested';
  const isPendingApproval = post.status === 'pending_approval' || post.status === 'ready_for_review';
  const isDraft = post.status === 'draft' || post.status === 'ai_generated';
  const isApproved = post.status === 'approved' || post.status === 'scheduled';

  const scheduledTimestamp = post.scheduled_at || (post.date && post.time ? `${post.date}T${post.time}:00Z` : null);
  const scheduledDate = scheduledTimestamp ? new Date(scheduledTimestamp) : null;
  const isPastScheduled = scheduledDate ? scheduledDate.getTime() < (now.getTime() - 60000) : false; // 1 min buffer

  const hasMedia = Boolean(post.media_url || post.mediaUrl || (post.media_urls && post.media_urls.length > 0) || (post.mediaUrls && post.mediaUrls.length > 0));
  const mediaRequired = doesPostRequireMedia(post);
  const isMediaMissing = mediaRequired && !hasMedia;

  const hasDisconnectedChannel = post.channels && post.channels.some((c) => disconnectedChannels.includes(c));

  // 1. In-flight / Published states
  if (isPublished) {
    return {
      status: 'PUBLISHED',
      statusLabel: 'Published',
      statusTone: 'ok',
      needsAttention: false,
      severity: 'SUCCESS',
    };
  }

  if (isPublishing) {
    return {
      status: 'PUBLISHING',
      statusLabel: 'Publishing live',
      statusTone: 'info',
      needsAttention: false,
      severity: 'INFO',
    };
  }

  // 2. Failed state
  if (isFailed) {
    return {
      status: 'FAILED',
      statusLabel: 'Publishing failed',
      statusTone: 'error',
      needsAttention: true,
      attentionReason: 'publishing_failed',
      attentionDetails: post.failure_reason || 'Publishing attempt failed. Click to review or retry.',
      severity: 'ERROR',
    };
  }

  // 3. Rejected & Changes Requested
  if (isRejected) {
    return {
      status: 'REJECTED',
      statusLabel: 'Rejected',
      statusTone: 'error',
      needsAttention: true,
      attentionReason: 'rejected',
      attentionDetails: post.rejection_reason || 'Post was rejected by reviewer.',
      severity: 'WARNING',
    };
  }

  if (isChangesRequested) {
    return {
      status: 'CHANGES_REQUESTED',
      statusLabel: 'Changes requested',
      statusTone: 'warn',
      needsAttention: true,
      attentionReason: 'changes_requested',
      attentionDetails: post.approval_notes || 'Reviewer requested revisions before sign-off.',
      severity: 'WARNING',
    };
  }

  // 4. Pending Approval
  if (isPendingApproval) {
    return {
      status: 'PENDING_APPROVAL',
      statusLabel: 'Approval pending',
      statusTone: 'warn',
      needsAttention: true,
      attentionReason: 'approval_pending',
      attentionDetails: `Awaiting review from ${post.approver_name || post.approverName || 'manager'}.`,
      severity: 'WARNING',
    };
  }

  // 5. Channel Disconnected
  if (hasDisconnectedChannel) {
    return {
      status: 'SCHEDULED',
      statusLabel: 'Channel disconnected',
      statusTone: 'error',
      needsAttention: true,
      attentionReason: 'channel_disconnected',
      attentionDetails: 'Social channel is disconnected. Reconnect in Settings to enable publishing.',
      severity: 'ERROR',
    };
  }

  // 6. Missing Media
  if (isMediaMissing) {
    return {
      status: 'MISSING_MEDIA',
      statusLabel: 'Creative missing',
      statusTone: 'error',
      needsAttention: true,
      attentionReason: 'media_missing',
      attentionDetails: `Media asset is required for ${post.channels?.join(', ') || 'channels'}.`,
      severity: 'ERROR',
    };
  }

  // 7. Missed Scheduled Time
  if (isPastScheduled && (isApproved || isDraft)) {
    return {
      status: 'MISSED',
      statusLabel: 'Missed scheduled time',
      statusTone: 'error',
      needsAttention: true,
      attentionReason: 'post_missed',
      attentionDetails: 'Scheduled publishing time has passed without completion.',
      severity: 'ERROR',
    };
  }

  // 8. Ready for Dispatch
  if (isApproved) {
    return {
      status: 'READY',
      statusLabel: 'Ready',
      statusTone: 'ok',
      needsAttention: false,
      severity: 'INFO',
    };
  }

  // 9. Draft
  return {
    status: 'SCHEDULED',
    statusLabel: 'Draft scheduled',
    statusTone: 'muted',
    needsAttention: false,
    severity: 'INFO',
  };
}

// ============================================================
// DEDUPLICATION & IDEMPOTENCY KEYS
// ============================================================

export function buildDailySummaryDedupeKey(workspaceId: string, localDateStr: string, userId?: string): string {
  return `daily_summary:${workspaceId}:${userId || 'all'}:${localDateStr}`;
}

export function buildUpcomingReminderDedupeKey(postId: string, minutesTiming: number): string {
  return `upcoming_reminder:${postId}:${minutesTiming}m`;
}

export function buildApprovalRequiredDedupeKey(postId: string, updateEpoch: number | string): string {
  return `approval_required:${postId}:${updateEpoch}`;
}

export function buildPublishSuccessDedupeKey(postId: string): string {
  return `publish_success:${postId}`;
}

export function buildPublishFailureDedupeKey(postId: string, failedAt: string = ''): string {
  return `publish_failure:${postId}:${failedAt.slice(0, 16)}`;
}

export function buildMissedPostDedupeKey(postId: string, scheduledDateStr: string): string {
  return `post_missed:${postId}:${scheduledDateStr}`;
}

/**
 * Canonical service function to filter and normalize scheduled posts within a date/time range
 * converted across timezone boundaries.
 */
export function getScheduledPostsForRange(
  posts: any[],
  startDateTime: Date | string,
  endDateTime: Date | string,
  timezone: string = 'UTC'
): any[] {
  const start = typeof startDateTime === 'string' ? new Date(startDateTime) : startDateTime;
  const end = typeof endDateTime === 'string' ? new Date(endDateTime) : endDateTime;
  const startEpoch = start.getTime();
  const endEpoch = end.getTime();

  return posts.filter((post) => {
    const scheduledTimestamp = post.scheduled_at || (post.date ? `${post.date}T${post.time || '10:00'}:00Z` : null);
    if (!scheduledTimestamp) return false;
    const postDate = new Date(scheduledTimestamp);
    const postEpoch = postDate.getTime();
    if (isNaN(postEpoch)) return false;
    return postEpoch >= startEpoch && postEpoch <= endEpoch;
  });
}

// ============================================================
// AUTHORITATIVE TODAY'S POSTING SUMMARY
// ============================================================

/**
 * Calculates authoritative posting summary for a given workspace and local timezone
 */
export function getTodaysPostingSummary(
  posts: any[],
  timezone: string = 'UTC',
  now: Date = new Date(),
  disconnectedChannels: SocialPlatform[] = []
): TodaysPostingSummary {
  const todayLocalStr = getLocalDateString(now, timezone);

  // Normalize posts & categorize by local date
  const categorizedPostsToday: TodayScheduledPostItem[] = [];
  const allUpcomingPosts: TodaysPostingSummary['upcomingPosts'] = [];
  const attentionItems: AttentionItem[] = [];

  let readyCount = 0;
  let attentionCount = 0;
  let publishedCount = 0;

  // Sort posts by scheduled timestamp ascending
  const sorted = [...posts].sort((a, b) => {
    const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : (a.date ? new Date(`${a.date}T${a.time || '10:00'}:00Z`).getTime() : 0);
    const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : (b.date ? new Date(`${b.date}T${b.time || '10:00'}:00Z`).getTime() : 0);
    return timeA - timeB;
  });

  for (const post of sorted) {
    const scheduledTimestamp = post.scheduled_at || (post.date ? `${post.date}T${post.time || '10:00'}:00Z` : null);
    if (!scheduledTimestamp) continue;

    const postLocalDate = getLocalDateString(scheduledTimestamp, timezone);
    const postLocalTime = formatLocalTime12h(scheduledTimestamp, timezone);
    const classification = classifyPostStatus(post, now, disconnectedChannels);

    // Is it scheduled for today?
    if (postLocalDate === todayLocalStr) {
      if (classification.status === 'PUBLISHED') {
        publishedCount += 1;
      } else if (classification.needsAttention) {
        attentionCount += 1;
      } else if (classification.status === 'READY') {
        readyCount += 1;
      }

      categorizedPostsToday.push({
        id: post.id,
        title: sanitizePlainText(post.title) || 'Untitled Post',
        channels: post.channels || ['linkedin'],
        contentType: post.content_type || post.contentType || 'post',
        scheduledAt: scheduledTimestamp,
        date: postLocalDate,
        time: postLocalTime,
        operationalStatus: classification.status,
        statusLabel: classification.statusLabel,
        statusTone: classification.statusTone,
        needsAttention: classification.needsAttention,
        attentionReason: sanitizePlainText(classification.attentionDetails),
        mediaUrl: post.media_url || post.mediaUrl,
        creatorName: sanitizePlainText(post.creator_name || post.creatorName),
      });

      // Add to attention items if actionable
      if (classification.needsAttention && classification.attentionReason) {
        attentionItems.push({
          id: `att_${post.id}_${classification.attentionReason}`,
          postId: post.id,
          title: sanitizePlainText(post.title) || 'Untitled Post',
          channels: post.channels || ['linkedin'],
          contentType: post.content_type || post.contentType || 'post',
          scheduledAt: scheduledTimestamp,
          scheduledTime: postLocalTime,
          reason: classification.attentionReason,
          severity: classification.severity,
          actionLabel: classification.attentionReason === 'approval_pending' ? 'Review Post' : 'Fix & Edit',
          actionUrl: classification.attentionReason === 'approval_pending' ? `/marketing/approvals` : `/marketing/calendar?post=${post.id}`,
          details: sanitizePlainText(classification.attentionDetails),
        });
      }
    }

    // Is it in the upcoming window (future scheduled)?
    const postDate = new Date(scheduledTimestamp);
    if (postDate.getTime() > now.getTime() && classification.status !== 'PUBLISHED') {
      const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowLocalStr = getLocalDateString(tomorrowDate, timezone);

      let dateLabel = postLocalDate;
      if (postLocalDate === todayLocalStr) {
        dateLabel = 'Today';
      } else if (postLocalDate === tomorrowLocalStr) {
        dateLabel = 'Tomorrow';
      } else {
        try {
          dateLabel = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(postDate);
        } catch {
          dateLabel = postLocalDate;
        }
      }

      allUpcomingPosts.push({
        id: post.id,
        title: sanitizePlainText(post.title) || 'Untitled Post',
        channels: post.channels || ['linkedin'],
        contentType: post.content_type || post.contentType || 'post',
        scheduledAt: scheduledTimestamp,
        date: postLocalDate,
        time: postLocalTime,
        dateLabel,
      });
    }
  }

  // Find Next Scheduled Post (future only)
  const nextPost = getNextScheduledPost(posts, timezone, now, disconnectedChannels);

  return {
    date: todayLocalStr,
    timezone,
    totalScheduled: categorizedPostsToday.length,
    readyCount,
    attentionCount,
    publishedCount,
    posts: categorizedPostsToday,
    nextPost,
    attentionItems,
    upcomingPosts: allUpcomingPosts.slice(0, 10),
  };
}

/**
 * Finds the immediate next scheduled post that is strictly in the future
 */
export function getNextScheduledPost(
  posts: any[],
  timezone: string = 'UTC',
  now: Date = new Date(),
  disconnectedChannels: SocialPlatform[] = []
): NextScheduledPostItem | null {
  const futurePosts = posts
    .filter((p) => {
      if (p.status === 'published' || p.status === 'cancelled') return false;
      const scheduledTimestamp = p.scheduled_at || (p.date ? `${p.date}T${p.time || '10:00'}:00Z` : null);
      if (!scheduledTimestamp) return false;
      const date = new Date(scheduledTimestamp);
      return !isNaN(date.getTime()) && date.getTime() > now.getTime();
    })
    .sort((a, b) => {
      const timeA = new Date(a.scheduled_at || `${a.date}T${a.time || '10:00'}:00Z`).getTime();
      const timeB = new Date(b.scheduled_at || `${b.date}T${b.time || '10:00'}:00Z`).getTime();
      return timeA - timeB;
    });

  const next = futurePosts[0];
  if (!next) return null;

  const scheduledTimestamp = next.scheduled_at || `${next.date}T${next.time || '10:00'}:00Z`;
  const minutesUntil = getMinutesUntil(scheduledTimestamp, now);
  const classification = classifyPostStatus(next, now, disconnectedChannels);

  return {
    id: next.id,
    title: sanitizePlainText(next.title) || 'Untitled Post',
    channels: next.channels || ['linkedin'],
    contentType: next.content_type || next.contentType || 'post',
    scheduledAt: scheduledTimestamp,
    date: getLocalDateString(scheduledTimestamp, timezone),
    time: formatLocalTime12h(scheduledTimestamp, timezone),
    minutesUntil,
    countdownLabel: formatCountdown(minutesUntil),
    operationalStatus: classification.status,
    needsAttention: classification.needsAttention,
    attentionReason: sanitizePlainText(classification.attentionDetails),
  };
}

// ============================================================
// DYNAMIC NOTIFICATION GENERATORS
// ============================================================

export function createPostingTodayNotificationPayload(
  workspaceId: string,
  summary: TodaysPostingSummary
): Partial<MarketingNotification> {
  const title = "Today's Posting Schedule";
  let message = `You have ${summary.totalScheduled} post${summary.totalScheduled === 1 ? '' : 's'} scheduled for today.`;
  
  if (summary.attentionCount > 0) {
    message += ` ${summary.attentionCount} require${summary.attentionCount === 1 ? 's' : ''} your attention before publishing.`;
  } else if (summary.totalScheduled > 0) {
    message += ' All posts are ready for dispatch.';
  }

  return {
    workspace_id: workspaceId,
    type: 'POSTING_TODAY',
    severity: summary.attentionCount > 0 ? 'WARNING' : 'INFO',
    title,
    message,
    dedupe_key: buildDailySummaryDedupeKey(workspaceId, summary.date),
    metadata: {
      date: summary.date,
      totalScheduled: summary.totalScheduled,
      attentionCount: summary.attentionCount,
      readyCount: summary.readyCount,
    },
  };
}

export function createUpcomingReminderNotificationPayload(
  workspaceId: string,
  post: Partial<SocialPost> & { id: string; scheduled_at: string },
  minutesTiming: number,
  timezone: string = 'UTC'
): Partial<MarketingNotification> {
  const timeStr = formatLocalTime12h(post.scheduled_at, timezone);
  const platformsStr = post.channels?.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') || 'Social';
  const title = `Upcoming Post in ${minutesTiming} min`;
  const message = `Your ${platformsStr} post "${post.title || 'Untitled'}" is scheduled for ${timeStr}.`;

  return {
    workspace_id: workspaceId,
    related_post_id: post.id,
    type: 'POST_UPCOMING',
    severity: 'INFO',
    title,
    message,
    dedupe_key: buildUpcomingReminderDedupeKey(post.id, minutesTiming),
    metadata: {
      scheduled_at: post.scheduled_at,
      minutesTiming,
    },
  };
}

export function createApprovalRequiredNotificationPayload(
  workspaceId: string,
  post: Partial<SocialPost> & { id: string },
  timezone: string = 'UTC'
): Partial<MarketingNotification> {
  const timeStr = post.scheduled_at || post.date ? ` scheduled for ${formatLocalTime12h(post.scheduled_at || `${post.date}T${post.time || '12:00'}:00Z`, timezone)}` : '';
  const title = 'Approval required';
  const message = `Your ${post.channels?.join('/') || 'social'} post "${post.title || 'Untitled'}"${timeStr} is awaiting review.`;

  return {
    workspace_id: workspaceId,
    related_post_id: post.id,
    type: 'APPROVAL_REQUIRED',
    severity: 'WARNING',
    title,
    message,
    dedupe_key: buildApprovalRequiredDedupeKey(post.id, post.updatedAt || Date.now()),
    metadata: {
      creatorId: post.creatorId,
      approverId: post.approverId,
    },
  };
}

export function createPublishSuccessNotificationPayload(
  workspaceId: string,
  post: Partial<SocialPost> & { id: string }
): Partial<MarketingNotification> {
  const platformsStr = post.channels?.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') || 'channels';
  return {
    workspace_id: workspaceId,
    related_post_id: post.id,
    type: 'PUBLISHING_SUCCESS',
    severity: 'SUCCESS',
    title: 'Post Published Successfully',
    message: `"${post.title || 'Untitled'}" was published live to ${platformsStr}.`,
    dedupe_key: buildPublishSuccessDedupeKey(post.id),
  };
}

export function createPublishFailureNotificationPayload(
  workspaceId: string,
  post: Partial<SocialPost> & { id: string },
  errorMessage: string
): Partial<MarketingNotification> {
  const platformsStr = post.channels?.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') || 'channels';
  return {
    workspace_id: workspaceId,
    related_post_id: post.id,
    type: 'PUBLISHING_FAILED',
    severity: 'ERROR',
    title: 'Publishing Failed',
    message: `Your ${platformsStr} post "${post.title || 'Untitled'}" could not be published: ${errorMessage}`,
    dedupe_key: buildPublishFailureDedupeKey(post.id, new Date().toISOString()),
    metadata: { errorMessage },
  };
}

export function createMissingMediaNotificationPayload(
  workspaceId: string,
  post: Partial<SocialPost> & { id: string; scheduled_at?: string }
): Partial<MarketingNotification> {
  return {
    workspace_id: workspaceId,
    related_post_id: post.id,
    type: 'MEDIA_MISSING',
    severity: 'ERROR',
    title: 'Creative Media Missing',
    message: `Post "${post.title || 'Untitled'}" is scheduled but missing required visual assets.`,
    dedupe_key: `missing_media:${post.id}:${post.scheduled_at || 'draft'}`,
  };
}

export interface JobExecutionResult {
  success: boolean;
  workspacesScanned: number;
  postsFound: number;
  notificationsCreated: number;
  notificationsSkipped: number;
  logs: string[];
}

/**
 * Executes the complete calendar notification sweep for one or all workspaces.
 */
export async function runCalendarNotificationJob(
  supabase: any,
  targetWorkspaceId?: string,
  now: Date = new Date()
): Promise<JobExecutionResult> {
  const logs: string[] = [];
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalPostsFound = 0;

  // 1. Resolve Workspaces
  let wsQuery = supabase.from('workspaces').select('id, name');
  if (targetWorkspaceId) {
    wsQuery = wsQuery.eq('id', targetWorkspaceId);
  }
  const { data: workspaces, error: wsError } = await wsQuery;

  if (wsError || !workspaces || workspaces.length === 0) {
    return {
      success: true,
      workspacesScanned: 0,
      postsFound: 0,
      notificationsCreated: 0,
      notificationsSkipped: 0,
      logs: ['No workspaces found to process.'],
    };
  }

  for (const ws of workspaces) {
    try {
      // Fetch workspace settings
      const { data: mktSettings } = await supabase
        .from('marketing_settings')
        .select('default_timezone')
        .eq('workspace_id', ws.id)
        .maybeSingle();

      const timezone = mktSettings?.default_timezone || 'Asia/Kolkata';
      const localDateStr = getLocalDateString(now, timezone);
      const localTimeStr = getLocalTimeString(now, timezone);

      // Fetch preferences
      const { data: prefsList } = await supabase
        .from('marketing_notification_preferences')
        .select('*')
        .eq('workspace_id', ws.id);

      const defaultPrefs: MarketingNotificationPreferences = {
        posting_reminders_enabled: true,
        daily_summary_enabled: true,
        daily_summary_time: '09:00',
        upcoming_reminders_enabled: true,
        upcoming_timing_minutes: 30,
        approval_notifications_enabled: true,
        publishing_success_enabled: true,
        publishing_failure_enabled: true,
        missing_media_enabled: true,
        channels: { in_app: true, email: false },
      };

      const pref = prefsList?.[0] || defaultPrefs;

      // Fetch posts for workspace
      const { data: posts, error: postsErr } = await supabase
        .from('marketing_posts')
        .select('*')
        .eq('workspace_id', ws.id);

      if (postsErr || !posts || posts.length === 0) {
        logs.push(`Workspace ${ws.name || ws.id}: 0 posts found.`);
        continue;
      }

      totalPostsFound += posts.length;

      // 1. DAILY SUMMARY
      if (pref.posting_reminders_enabled && pref.daily_summary_enabled) {
        const summary = getTodaysPostingSummary(posts, timezone, now);
        if (summary.totalScheduled > 0) {
          const payload = createPostingTodayNotificationPayload(ws.id, summary);
          const { error: insertErr } = await supabase.from('marketing_notifications').insert({
            workspace_id: ws.id,
            recipient_user_id: null,
            type: payload.type,
            severity: payload.severity,
            title: payload.title,
            message: payload.message,
            metadata: payload.metadata,
            dedupe_key: payload.dedupe_key,
          });

          if (!insertErr) {
            totalCreated += 1;
            logs.push(`[${ws.name || ws.id}] Daily summary created for ${summary.date} (${summary.totalScheduled} posts).`);
          } else {
            totalSkipped += 1;
          }
        }
      }

      // 2. UPCOMING & ATTENTION NOTIFICATIONS
      for (const post of posts) {
        if (post.status === 'published' || post.status === 'cancelled') continue;
        const scheduledTimestamp = post.scheduled_at || (post.date && post.time ? `${post.date}T${post.time}:00Z` : null);
        if (!scheduledTimestamp) continue;

        const minutesUntil = getMinutesUntil(scheduledTimestamp, now);
        const timingWindow = pref.upcoming_timing_minutes || 30;

        // Upcoming Reminder
        if (pref.posting_reminders_enabled && pref.upcoming_reminders_enabled) {
          if (minutesUntil > 0 && minutesUntil <= timingWindow) {
            const payload = createUpcomingReminderNotificationPayload(
              ws.id,
              { ...post, scheduled_at: scheduledTimestamp },
              timingWindow,
              timezone
            );

            const { error: insertErr } = await supabase.from('marketing_notifications').insert({
              workspace_id: ws.id,
              recipient_user_id: post.creator_id || null,
              related_post_id: post.id,
              type: payload.type,
              severity: payload.severity,
              title: payload.title,
              message: payload.message,
              metadata: payload.metadata,
              dedupe_key: payload.dedupe_key,
            });

            if (!insertErr) {
              totalCreated += 1;
              logs.push(`[${ws.name || ws.id}] Upcoming reminder created for "${post.title}".`);
            } else {
              totalSkipped += 1;
            }
          }
        }

        // Missed Post Alert
        const postDate = new Date(scheduledTimestamp);
        const isPast = postDate.getTime() < (now.getTime() - 2 * 60 * 1000);
        if (isPast && (post.status === 'approved' || post.status === 'scheduled')) {
          const dedupeKey = buildMissedPostDedupeKey(post.id, localDateStr);
          const { error: insertErr } = await supabase.from('marketing_notifications').insert({
            workspace_id: ws.id,
            recipient_user_id: post.creator_id || null,
            related_post_id: post.id,
            type: 'POST_MISSED',
            severity: 'ERROR',
            title: 'Scheduled Post Missed',
            message: `Post "${post.title || 'Untitled'}" scheduled for ${getLocalDateString(scheduledTimestamp, timezone)} was not published.`,
            dedupe_key: dedupeKey,
          });

          if (!insertErr) {
            totalCreated += 1;
            logs.push(`[${ws.name || ws.id}] Missed post alert created for "${post.title}".`);
          } else {
            totalSkipped += 1;
          }
        }

        // Missing Media Alert
        if (pref.missing_media_enabled) {
          const visualChannels = ['instagram', 'tiktok', 'youtube'];
          const requiresMedia = post.channels?.some((c: string) => visualChannels.includes(c));
          const hasMedia = Boolean(post.media_url || (post.media_urls && post.media_urls.length > 0));
          if (requiresMedia && !hasMedia && post.status !== 'draft') {
            const payload = createMissingMediaNotificationPayload(ws.id, {
              ...post,
              scheduled_at: scheduledTimestamp,
            });

            const { error: insertErr } = await supabase.from('marketing_notifications').insert({
              workspace_id: ws.id,
              recipient_user_id: post.creator_id || null,
              related_post_id: post.id,
              type: payload.type,
              severity: payload.severity,
              title: payload.title,
              message: payload.message,
              dedupe_key: payload.dedupe_key,
            });

            if (!insertErr) {
              totalCreated += 1;
              logs.push(`[${ws.name || ws.id}] Missing media alert created for "${post.title}".`);
            } else {
              totalSkipped += 1;
            }
          }
        }
      }
    } catch (wsErr: any) {
      logs.push(`Error processing workspace ${ws.id}: ${wsErr?.message}`);
    }
  }

  return {
    success: true,
    workspacesScanned: workspaces.length,
    postsFound: totalPostsFound,
    notificationsCreated: totalCreated,
    notificationsSkipped: totalSkipped,
    logs,
  };
}

