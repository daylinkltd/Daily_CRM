/**
 * Central configuration for Social Platform API versions, base URLs,
 * headers, timeouts, and polling parameters.
 */

export const SOCIAL_CONFIG = {
  meta: {
    // Current official Meta Graph API stable version
    apiVersion: process.env.META_GRAPH_API_VERSION || 'v22.0',
    graphBaseUrl: 'https://graph.facebook.com',
    get baseUrl() {
      return `${this.graphBaseUrl}/${this.apiVersion}`;
    },
    oauthDialogUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'public_profile',
    ],
    containerPoll: {
      initialDelayMs: 3000,
      stepDelayMs: 2000,
      maxIntervalMs: 10000,
      maxAttempts: 12, // Up to 60s for video transcoding
    },
  },
  linkedin: {
    // Current supported LinkedIn REST API Version (Format: YYYYMM, 2-year lifecycle)
    // Supports /rest/posts and /rest/images with Header 'Linkedin-Version: 202501'
    apiVersion: process.env.LINKEDIN_API_VERSION || '202501',
    restliProtocolVersion: '2.0.0',
    apiBaseUrl: 'https://api.linkedin.com/rest',
    oauthUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: [
      'openid',
      'profile',
      'email',
      'w_member_social',
      'w_organization_social',
    ],
  },
  publishing: {
    lockTimeoutMs: 10 * 60 * 1000, // 10 minutes lock expiry before reconciliation
    maxWorkerBatchSize: 10,
    maxAutomaticRetries: 3,
    reconciliationWindowMinutes: 15,
  },
} as const;
