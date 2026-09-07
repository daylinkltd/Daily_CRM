import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalTimeString,
  formatLocalTime12h,
  getMinutesUntil,
  formatCountdown,
  doesPostRequireMedia,
  classifyPostStatus,
  getTodaysPostingSummary,
  getNextScheduledPost,
  buildDailySummaryDedupeKey,
  buildUpcomingReminderDedupeKey,
  buildApprovalRequiredDedupeKey,
  buildPublishSuccessDedupeKey,
  buildPublishFailureDedupeKey,
  buildMissedPostDedupeKey,
  createPostingTodayNotificationPayload,
  createUpcomingReminderNotificationPayload,
  createApprovalRequiredNotificationPayload,
  createPublishSuccessNotificationPayload,
  createPublishFailureNotificationPayload,
  createMissingMediaNotificationPayload,
  getScheduledPostsForRange,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from './calendar-notifications';
import type { SocialPost, SocialPlatform } from '@/types/calendar';

describe('DailyBuz Marketing Calendar Notifications & Reminders Engine', () => {
  const mockNow = new Date('2026-09-07T10:00:00.000Z'); // 10:00 UTC = 15:30 IST = 06:00 EST

  // ============================================================
  // 1. TIMEZONE & DATE MATH TESTS
  // ============================================================
  describe('Timezone & Date Math Tests', () => {
    it('TEST 1: accurately formats local date in UTC, IST, and EST', () => {
      expect(getLocalDateString(mockNow, 'UTC')).toBe('2026-09-07');
      expect(getLocalDateString(mockNow, 'Asia/Kolkata')).toBe('2026-09-07');
      expect(getLocalDateString(mockNow, 'America/New_York')).toBe('2026-09-07');
    });

    it('TEST 2: accurately detects date boundary shifts across timezones', () => {
      // 2026-09-07 23:30 UTC -> 2026-09-08 05:00 in IST (+5:30)
      const lateUtc = new Date('2026-09-07T23:30:00.000Z');
      expect(getLocalDateString(lateUtc, 'UTC')).toBe('2026-09-07');
      expect(getLocalDateString(lateUtc, 'Asia/Kolkata')).toBe('2026-09-08');

      // 2026-09-07 02:00 UTC -> 2026-09-06 22:00 in EST (-4:00)
      const earlyUtc = new Date('2026-09-07T02:00:00.000Z');
      expect(getLocalDateString(earlyUtc, 'UTC')).toBe('2026-09-07');
      expect(getLocalDateString(earlyUtc, 'America/New_York')).toBe('2026-09-06');
    });

    it('TEST 3: formats local time in 12-hour format with AM/PM', () => {
      // 10:00 UTC = 15:30 IST -> "3:30 PM"
      expect(formatLocalTime12h(mockNow, 'Asia/Kolkata')).toBe('3:30 PM');
      // 10:00 UTC -> "10:00 AM"
      expect(formatLocalTime12h(mockNow, 'UTC')).toBe('10:00 AM');
      // 10:00 UTC = 06:00 EST -> "6:00 AM"
      expect(formatLocalTime12h(mockNow, 'America/New_York')).toBe('6:00 AM');
    });

    it('TEST 4: computes accurate countdown minutes and humanized labels', () => {
      const in32Min = new Date(mockNow.getTime() + 32 * 60 * 1000);
      const in134Min = new Date(mockNow.getTime() + 134 * 60 * 1000); // 2h 14m
      const in2Min = new Date(mockNow.getTime() + 2 * 60 * 1000);
      const pastMin = new Date(mockNow.getTime() - 10 * 60 * 1000);

      expect(getMinutesUntil(in32Min, mockNow)).toBe(32);
      expect(formatCountdown(32)).toBe('Starts in 32 minutes');

      expect(getMinutesUntil(in134Min, mockNow)).toBe(134);
      expect(formatCountdown(134)).toBe('Starts in 2 hours 14 minutes');

      expect(formatCountdown(2)).toBe('Starting soon');
      expect(formatCountdown(0)).toBe('Starting now');
      expect(formatCountdown(-5)).toBe('Starting now');
    });
  });

  // ============================================================
  // 2. OPERATIONAL STATUS CLASSIFICATION TESTS
  // ============================================================
  describe('Post Status Classification Tests', () => {
    it('TEST 5: classifies published post as PUBLISHED with SUCCESS severity', () => {
      const post = {
        id: 'p1',
        title: 'Product Launch',
        status: 'published' as const,
        channels: ['instagram' as const],
        media_url: 'https://example.com/img.png',
        scheduled_at: '2026-09-07T10:00:00Z',
      };
      const res = classifyPostStatus(post, mockNow);
      expect(res.status).toBe('PUBLISHED');
      expect(res.statusLabel).toBe('Published');
      expect(res.needsAttention).toBe(false);
      expect(res.severity).toBe('SUCCESS');
    });

    it('TEST 6: classifies pending approval post as PENDING_APPROVAL with WARNING severity', () => {
      const post = {
        id: 'p2',
        title: 'Industry Insight',
        status: 'pending_approval' as const,
        channels: ['linkedin' as const],
        approver_name: 'Sarah Reviewer',
        scheduled_at: '2026-09-07T13:00:00Z',
      };
      const res = classifyPostStatus(post, mockNow);
      expect(res.status).toBe('PENDING_APPROVAL');
      expect(res.statusLabel).toBe('Approval pending');
      expect(res.needsAttention).toBe(true);
      expect(res.attentionReason).toBe('approval_pending');
      expect(res.attentionDetails).toContain('Sarah Reviewer');
      expect(res.severity).toBe('WARNING');
    });

    it('TEST 7: classifies visual post missing media as MISSING_MEDIA with ERROR severity', () => {
      const post = {
        id: 'p3',
        title: 'Weekend Promo',
        status: 'approved' as const,
        contentType: 'reel' as const,
        channels: ['instagram' as const],
        media_url: undefined,
        scheduled_at: '2026-09-07T18:00:00Z',
      };
      const res = classifyPostStatus(post, mockNow);
      expect(res.status).toBe('MISSING_MEDIA');
      expect(res.statusLabel).toBe('Creative missing');
      expect(res.needsAttention).toBe(true);
      expect(res.attentionReason).toBe('media_missing');
      expect(res.severity).toBe('ERROR');
    });

    it('TEST 8: classifies text-only post without media requirement as READY', () => {
      const post = {
        id: 'p4',
        title: 'Text Thought Leadership',
        status: 'approved' as const,
        contentType: 'post' as const,
        channels: ['linkedin' as const],
        mediaType: 'none' as const,
        media_url: undefined,
        scheduled_at: '2026-09-07T14:00:00Z',
      };
      const res = classifyPostStatus(post, mockNow);
      expect(res.status).toBe('READY');
      expect(res.statusLabel).toBe('Ready');
      expect(res.needsAttention).toBe(false);
    });

    it('TEST 9: classifies failed post as FAILED with ERROR severity and failure reason', () => {
      const post = {
        id: 'p5',
        title: 'Failed Campaign Announcement',
        status: 'failed' as const,
        failure_reason: 'Token expired on Instagram Graph API',
        channels: ['instagram' as const],
        media_url: 'https://example.com/asset.jpg',
        scheduled_at: '2026-09-07T08:00:00Z',
      };
      const res = classifyPostStatus(post, mockNow);
      expect(res.status).toBe('FAILED');
      expect(res.statusLabel).toBe('Publishing failed');
      expect(res.needsAttention).toBe(true);
      expect(res.attentionReason).toBe('publishing_failed');
      expect(res.attentionDetails).toContain('Token expired');
      expect(res.severity).toBe('ERROR');
    });

    it('TEST 10: classifies past scheduled post that was not published as MISSED', () => {
      const post = {
        id: 'p6',
        title: 'Overdue Post',
        status: 'approved' as const,
        channels: ['linkedin' as const],
        media_url: 'https://example.com/img.png',
        scheduled_at: '2026-09-07T08:00:00Z', // 2 hours before mockNow (10:00 UTC)
      };
      const res = classifyPostStatus(post, mockNow);
      expect(res.status).toBe('MISSED');
      expect(res.statusLabel).toBe('Missed scheduled time');
      expect(res.needsAttention).toBe(true);
      expect(res.attentionReason).toBe('post_missed');
      expect(res.severity).toBe('ERROR');
    });

    it('TEST 11: classifies disconnected social channel as CHANNEL_DISCONNECTED', () => {
      const post = {
        id: 'p7',
        title: 'Instagram Post on Disconnected Channel',
        status: 'approved' as const,
        channels: ['instagram' as const],
        media_url: 'https://example.com/img.png',
        scheduled_at: '2026-09-07T12:00:00Z',
      };
      const res = classifyPostStatus(post, mockNow, ['instagram']);
      expect(res.statusLabel).toBe('Channel disconnected');
      expect(res.needsAttention).toBe(true);
      expect(res.attentionReason).toBe('channel_disconnected');
      expect(res.severity).toBe('ERROR');
    });

    it('TEST 12: classifies rejected post and changes requested post correctly', () => {
      const postRejected = {
        id: 'p8',
        title: 'Rejected Post',
        status: 'rejected' as const,
        rejection_reason: 'Does not follow brand guidelines',
        channels: ['x' as const],
        scheduled_at: '2026-09-07T16:00:00Z',
      };
      const resRejected = classifyPostStatus(postRejected, mockNow);
      expect(resRejected.status).toBe('REJECTED');
      expect(resRejected.needsAttention).toBe(true);
      expect(resRejected.attentionReason).toBe('rejected');

      const postChanges = {
        id: 'p9',
        title: 'Changes Requested Post',
        status: 'changes_requested' as const,
        approval_notes: 'Please update CTA to point to pricing page',
        channels: ['linkedin' as const],
        scheduled_at: '2026-09-07T17:00:00Z',
      };
      const resChanges = classifyPostStatus(postChanges, mockNow);
      expect(resChanges.status).toBe('CHANGES_REQUESTED');
      expect(resChanges.needsAttention).toBe(true);
      expect(resChanges.attentionReason).toBe('changes_requested');
    });
  });

  // ============================================================
  // 3. TODAY'S SUMMARY & NEXT UP QUERY TESTS
  // ============================================================
  describe('Today Posting Summary & Next Up Query Tests', () => {
    it('TEST 13: handles zero scheduled posts today cleanly', () => {
      const summary = getTodaysPostingSummary([], 'UTC', mockNow);
      expect(summary.totalScheduled).toBe(0);
      expect(summary.attentionCount).toBe(0);
      expect(summary.readyCount).toBe(0);
      expect(summary.publishedCount).toBe(0);
      expect(summary.posts).toHaveLength(0);
      expect(summary.nextPost).toBeNull();
    });

    it('TEST 14: aggregates multiple posts with mixed operational statuses for today', () => {
      const posts = [
        {
          id: 'post-1',
          title: 'Morning Product Launch',
          channels: ['instagram'],
          content_type: 'reel',
          media_url: 'https://example.com/reel.mp4',
          status: 'approved',
          scheduled_at: '2026-09-07T11:00:00Z',
        },
        {
          id: 'post-2',
          title: 'Afternoon Industry Insight',
          channels: ['linkedin'],
          content_type: 'post',
          status: 'pending_approval',
          approver_name: 'Lead Reviewer',
          scheduled_at: '2026-09-07T13:00:00Z',
        },
        {
          id: 'post-3',
          title: 'Evening Promo',
          channels: ['instagram'],
          content_type: 'story',
          media_url: null, // missing media on visual story
          status: 'approved',
          scheduled_at: '2026-09-07T18:00:00Z',
        },
        {
          id: 'post-4',
          title: 'Tomorrow Post (Must be excluded from today)',
          channels: ['linkedin'],
          content_type: 'post',
          media_url: 'https://example.com/asset.png',
          status: 'approved',
          scheduled_at: '2026-09-08T10:00:00Z',
        },
        {
          id: 'post-5',
          title: 'Yesterday Post (Must be excluded from today)',
          channels: ['linkedin'],
          content_type: 'post',
          media_url: 'https://example.com/asset.png',
          status: 'published',
          scheduled_at: '2026-09-06T10:00:00Z',
        },
      ];

      const summary = getTodaysPostingSummary(posts, 'UTC', mockNow);

      expect(summary.totalScheduled).toBe(3); // post-1, post-2, post-3
      expect(summary.readyCount).toBe(1); // post-1
      expect(summary.attentionCount).toBe(2); // post-2 (pending approval), post-3 (missing media)
      expect(summary.publishedCount).toBe(0);

      // Verify posts details
      expect(summary.posts[0].id).toBe('post-1');
      expect(summary.posts[0].operationalStatus).toBe('READY');

      expect(summary.posts[1].id).toBe('post-2');
      expect(summary.posts[1].operationalStatus).toBe('PENDING_APPROVAL');

      expect(summary.posts[2].id).toBe('post-3');
      expect(summary.posts[2].operationalStatus).toBe('MISSING_MEDIA');

      // Verify Next Up identified
      expect(summary.nextPost).not.toBeNull();
      expect(summary.nextPost?.id).toBe('post-1');
      expect(summary.nextPost?.minutesUntil).toBe(60); // 11:00 vs 10:00 mockNow
      expect(summary.nextPost?.countdownLabel).toBe('Starts in 1 hour');

      // Verify upcoming posts contains future items
      expect(summary.upcomingPosts.some((p) => p.id === 'post-4')).toBe(true);
      expect(summary.upcomingPosts.some((p) => p.id === 'post-5')).toBe(false);
    });

    it('TEST 15: accurately identifies immediate next scheduled post and ignores past or published posts', () => {
      const posts = [
        {
          id: 'past-post',
          title: 'Earlier post',
          status: 'published',
          scheduled_at: '2026-09-07T08:00:00Z',
        },
        {
          id: 'next-in-line',
          title: 'Next Upcoming Feature',
          channels: ['instagram'],
          content_type: 'post',
          status: 'approved',
          media_url: 'https://cdn.example.com/asset.png',
          scheduled_at: '2026-09-07T10:32:00Z', // 32 minutes from 10:00 UTC
        },
        {
          id: 'later-post',
          title: 'Later Afternoon Post',
          channels: ['x'],
          content_type: 'post',
          status: 'approved',
          media_url: 'https://cdn.example.com/asset.png',
          scheduled_at: '2026-09-07T15:00:00Z',
        },
      ];

      const next = getNextScheduledPost(posts, 'UTC', mockNow);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('next-in-line');
      expect(next?.minutesUntil).toBe(32);
      expect(next?.countdownLabel).toBe('Starts in 32 minutes');
    });
  });

  // ============================================================
  // 4. DEDUPLICATION & IDEMPOTENCY TESTS
  // ============================================================
  describe('Deduplication & Idempotency Tests', () => {
    it('TEST 16: generates deterministic daily summary dedupe keys', () => {
      const key1 = buildDailySummaryDedupeKey('ws_123', '2026-09-07');
      const key2 = buildDailySummaryDedupeKey('ws_123', '2026-09-07');
      const keyOtherDay = buildDailySummaryDedupeKey('ws_123', '2026-09-08');
      const keyOtherWs = buildDailySummaryDedupeKey('ws_456', '2026-09-07');

      expect(key1).toBe('daily_summary:ws_123:all:2026-09-07');
      expect(key1).toBe(key2);
      expect(key1).not.toBe(keyOtherDay);
      expect(key1).not.toBe(keyOtherWs);
    });

    it('TEST 17: generates deterministic upcoming reminder dedupe keys', () => {
      const key1 = buildUpcomingReminderDedupeKey('post_abc', 30);
      const key2 = buildUpcomingReminderDedupeKey('post_abc', 30);
      const keyDifferentTiming = buildUpcomingReminderDedupeKey('post_abc', 15);

      expect(key1).toBe('upcoming_reminder:post_abc:30m');
      expect(key1).toBe(key2);
      expect(key1).not.toBe(keyDifferentTiming);
    });

    it('TEST 18: generates deterministic approval and publishing failure dedupe keys', () => {
      const approvalKey = buildApprovalRequiredDedupeKey('post_1', 'v1');
      expect(approvalKey).toBe('approval_required:post_1:v1');

      const successKey = buildPublishSuccessDedupeKey('post_1');
      expect(successKey).toBe('publish_success:post_1');

      const failureKey = buildPublishFailureDedupeKey('post_1', '2026-09-07T10:15:30Z');
      expect(failureKey).toBe('publish_failure:post_1:2026-09-07T10:15');
    });
  });

  // ============================================================
  // 5. NOTIFICATION PAYLOAD GENERATOR TESTS
  // ============================================================
  describe('Notification Payload Generator Tests', () => {
    it('TEST 19: generates dynamic daily posting summary notification with exact counts', () => {
      const summary: any = {
        date: '2026-09-07',
        totalScheduled: 3,
        attentionCount: 1,
        readyCount: 2,
        publishedCount: 0,
      };

      const notif = createPostingTodayNotificationPayload('ws_1', summary);
      expect(notif.type).toBe('POSTING_TODAY');
      expect(notif.severity).toBe('WARNING');
      expect(notif.title).toBe("Today's Posting Schedule");
      expect(notif.message).toContain('3 posts scheduled for today');
      expect(notif.message).toContain('1 requires your attention');
      expect(notif.dedupe_key).toBe('daily_summary:ws_1:all:2026-09-07');
    });

    it('TEST 20: generates upcoming reminder notification with actual post title and time', () => {
      const post = {
        id: 'post_99',
        title: 'Quarterly Financial Update',
        channels: ['linkedin' as const, 'x' as const],
        scheduled_at: '2026-09-07T14:30:00Z',
      };

      const notif = createUpcomingReminderNotificationPayload('ws_1', post, 30, 'UTC');
      expect(notif.type).toBe('POST_UPCOMING');
      expect(notif.severity).toBe('INFO');
      expect(notif.title).toBe('Upcoming Post in 30 min');
      expect(notif.message).toContain('"Quarterly Financial Update"');
      expect(notif.message).toContain('2:30 PM');
      expect(notif.message).toContain('Linkedin, X');
    });

    it('TEST 21: generates approval required notification with actual post metadata', () => {
      const post = {
        id: 'post_100',
        title: 'New Feature Announcement',
        channels: ['instagram' as const],
        creatorId: 'usr_alex',
        approverId: 'usr_lead',
        scheduled_at: '2026-09-07T16:00:00Z',
        updatedAt: '2026-09-07T10:00:00Z',
      };

      const notif = createApprovalRequiredNotificationPayload('ws_1', post, 'UTC');
      expect(notif.type).toBe('APPROVAL_REQUIRED');
      expect(notif.severity).toBe('WARNING');
      expect(notif.title).toBe('Approval required');
      expect(notif.message).toContain('"New Feature Announcement"');
      expect(notif.message).toContain('4:00 PM');
    });

    it('TEST 22: generates publishing failure notification without exposing sensitive credentials', () => {
      const post = {
        id: 'post_101',
        title: 'Global Announcement',
        channels: ['instagram' as const],
      };

      const notif = createPublishFailureNotificationPayload('ws_1', post, 'Media format MP4 not accepted for story');
      expect(notif.type).toBe('PUBLISHING_FAILED');
      expect(notif.severity).toBe('ERROR');
      expect(notif.title).toBe('Publishing Failed');
      expect(notif.message).toContain('Media format MP4 not accepted');
      expect(notif.message).not.toContain('access_token');
      expect(notif.message).not.toContain('secret');
    });
  });

  // ============================================================
  // 6. MULTI-TENANT & GOVERNANCE INTEGRITY TESTS
  // ============================================================
  describe('Multi-Tenant & Governance Integrity Tests', () => {
    it('TEST 23: guarantees default notification preferences are safely initialized', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.posting_reminders_enabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.daily_summary_enabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.daily_summary_time).toBe('09:00');
      expect(DEFAULT_NOTIFICATION_PREFERENCES.upcoming_timing_minutes).toBe(30);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.channels.in_app).toBe(true);
    });

    it('TEST 24: enforces that notifications never modify post approval status or auto-publish', () => {
      const unapprovedPost: Partial<SocialPost> = {
        id: 'post_locked',
        title: 'Unapproved Draft',
        status: 'pending_approval',
        scheduled_at: '2026-09-07T10:00:00Z',
      };

      // Classification correctly identifies it as needing attention without altering status
      const classification = classifyPostStatus(unapprovedPost, mockNow);
      expect(classification.status).toBe('PENDING_APPROVAL');
      expect(classification.needsAttention).toBe(true);
      expect(unapprovedPost.status).toBe('pending_approval');
    });

    it('TEST 25: prevents Daylink Tech Labs or fake marketing hardcoding from leaking into dynamic notifications', () => {
      const tenantPost: Partial<SocialPost> = {
        id: 'tenant_post_1',
        title: 'Fresh Monsoon Bakery Special Menu',
        channels: ['facebook' as const],
        scheduled_at: '2026-09-07T09:00:00Z',
      };

      const notif = createUpcomingReminderNotificationPayload('ws_bakery_tenant', tenantPost as any, 15, 'Asia/Kolkata');
      expect(notif.message).toContain('Fresh Monsoon Bakery Special Menu');
      expect(notif.message).not.toContain('Daylink');
      expect(notif.message).not.toContain('Marketing Creative');
      expect(notif.message).not.toContain('CRM');
    });
  });

  // ============================================================
  // 7. CRITICAL BUG REGRESSION TESTS (CASES A-D, MIDNIGHT, RESCHEDULE, MULTI-TENANT)
  // ============================================================
  describe('Critical Calendar Bug Regression Test Suite', () => {
    const tz = 'Asia/Kolkata'; // +5:30
    // Anchor: 2026-09-07 10:56 AM IST = 2026-09-07 05:26 UTC
    const anchorNow = new Date('2026-09-07T05:26:00.000Z');

    it('CASE A — TODAY: post scheduled today appears in Today Summary and Next Up', () => {
      const todayPost = {
        id: 'post_today_1',
        title: 'Calendar Today Test',
        status: 'scheduled' as const,
        channels: ['instagram' as const],
        media_url: 'https://example.com/image.jpg',
        scheduled_at: '2026-09-07T06:26:00.000Z', // 11:56 AM IST (1 hour future)
      };

      const summary = getTodaysPostingSummary([todayPost], tz, anchorNow);
      expect(summary.totalScheduled).toBe(1);
      expect(summary.posts.length).toBe(1);
      expect(summary.posts[0].title).toBe('Calendar Today Test');
      expect(summary.attentionCount).toBe(0);
      expect(summary.nextPost).not.toBeNull();
      expect(summary.nextPost?.title).toBe('Calendar Today Test');
      expect(summary.nextPost?.minutesUntil).toBe(60);
      expect(summary.nextPost?.countdownLabel).toBe('Starts in 1 hour');
    });

    it('CASE B — TOMORROW: post scheduled tomorrow is excluded from Today Summary but in upcoming', () => {
      const tomorrowPost = {
        id: 'post_tomorrow_1',
        title: 'Tomorrow Promotion',
        status: 'scheduled' as const,
        channels: ['linkedin' as const],
        scheduled_at: '2026-09-08T06:00:00.000Z', // 11:30 AM IST tomorrow
      };

      const summary = getTodaysPostingSummary([tomorrowPost], tz, anchorNow);
      expect(summary.totalScheduled).toBe(0);
      expect(summary.posts.length).toBe(0);
      expect(summary.upcomingPosts.length).toBe(1);
      expect(summary.upcomingPosts[0].dateLabel).toBe('Tomorrow');
    });

    it('CASE C — YESTERDAY: post scheduled yesterday is excluded from Today Summary and marked missed if uncompleted', () => {
      const yesterdayPost = {
        id: 'post_yesterday_1',
        title: 'Yesterday Update',
        status: 'scheduled' as const,
        channels: ['x' as const],
        scheduled_at: '2026-09-06T06:00:00.000Z', // Yesterday morning
      };

      const summary = getTodaysPostingSummary([yesterdayPost], tz, anchorNow);
      expect(summary.totalScheduled).toBe(0);
      expect(summary.posts.length).toBe(0);

      // Missed post classification
      const classification = classifyPostStatus(yesterdayPost, anchorNow);
      expect(classification.status).toBe('MISSED');
      expect(classification.needsAttention).toBe(true);
      expect(classification.attentionReason).toBe('post_missed');
    });

    it('CASE D — TODAY PENDING APPROVAL: post scheduled today but pending approval is included and flagged for attention', () => {
      const pendingPost = {
        id: 'post_pending_today',
        title: 'Product Launch Announcement',
        status: 'pending_approval' as const,
        channels: ['instagram' as const],
        scheduled_at: '2026-09-07T04:30:00.000Z', // 10:00 AM IST
        approver_name: 'Alex Rivera',
      };

      const summary = getTodaysPostingSummary([pendingPost], tz, anchorNow);
      expect(summary.totalScheduled).toBe(1);
      expect(summary.attentionCount).toBe(1);
      expect(summary.posts[0].needsAttention).toBe(true);
      expect(summary.posts[0].operationalStatus).toBe('PENDING_APPROVAL');
      expect(summary.attentionItems.length).toBe(1);
      expect(summary.attentionItems[0].reason).toBe('approval_pending');

      const notif = createApprovalRequiredNotificationPayload('ws_1', pendingPost as any, tz);
      expect(notif.type).toBe('APPROVAL_REQUIRED');
      expect(notif.message).toContain('Product Launch Announcement');
    });

    it('MIDNIGHT TEST: verifies exact date boundary split at 23:59 vs 00:01 local time', () => {
      // 2026-09-06 23:59 IST = 2026-09-06 18:29 UTC
      const sep6Night = new Date('2026-09-06T18:29:00.000Z');
      expect(getLocalDateString(sep6Night, tz)).toBe('2026-09-06');

      // 2026-09-07 00:01 IST = 2026-09-06 18:31 UTC
      const sep7Morning = new Date('2026-09-06T18:31:00.000Z');
      expect(getLocalDateString(sep7Morning, tz)).toBe('2026-09-07');

      // 2026-09-07 23:59 IST = 2026-09-07 18:29 UTC
      const sep7Night = new Date('2026-09-07T18:29:00.000Z');
      expect(getLocalDateString(sep7Night, tz)).toBe('2026-09-07');

      // 2026-09-08 00:01 IST = 2026-09-07 18:31 UTC
      const sep8Morning = new Date('2026-09-07T18:31:00.000Z');
      expect(getLocalDateString(sep8Morning, tz)).toBe('2026-09-08');
    });

    it('RESCHEDULE FLOW: post updated with date and time produces accurate scheduled_at and appears in Today Summary', () => {
      // Simulating a post that had no date or was on another date
      const draftPost = {
        id: 'post_draft_rescheduled',
        title: 'Rescheduled Customer Spotlight',
        status: 'draft' as const,
        channels: ['linkedin' as const],
      };

      // Reschedule action applied: date = '2026-09-07', time = '18:00', status = 'scheduled'
      const rescheduledPost = {
        ...draftPost,
        date: '2026-09-07',
        time: '18:00',
        scheduled_at: '2026-09-07T12:30:00.000Z', // 6:00 PM IST
        status: 'scheduled' as const,
      };

      const summary = getTodaysPostingSummary([rescheduledPost], tz, anchorNow);
      expect(summary.totalScheduled).toBe(1);
      expect(summary.posts[0].date).toBe('2026-09-07');
      expect(summary.posts[0].time).toBe('6:00 PM');
      expect(summary.nextPost?.title).toBe('Rescheduled Customer Spotlight');
    });

    it('CANONICAL RANGE QUERY: getScheduledPostsForRange filters posts accurately across time range', () => {
      const posts = [
        { id: '1', title: 'P1', scheduled_at: '2026-09-07T02:00:00Z' },
        { id: '2', title: 'P2', scheduled_at: '2026-09-07T14:00:00Z' },
        { id: '3', title: 'P3', scheduled_at: '2026-09-15T10:00:00Z' },
      ];

      const rangeResult = getScheduledPostsForRange(
        posts,
        '2026-09-07T00:00:00Z',
        '2026-09-07T23:59:59Z'
      );

      expect(rangeResult.length).toBe(2);
      expect(rangeResult.map((p) => p.id)).toEqual(['1', '2']);
    });
  });
});
