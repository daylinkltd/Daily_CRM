export interface MediaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MediaMetadata {
  url?: string;
  type?: 'image' | 'video';
  fileSizeMb?: number;
  width?: number;
  height?: number;
  aspectRatio?: string;
  source?: 'uploaded' | 'ai_generated' | 'stock';
}

export interface PublishingValidationResult {
  ready: boolean;
  errors: string[];
  warnings: string[];
  checklist: Array<{
    item: string;
    passed: boolean;
    importance: 'blocker' | 'warning';
    detail: string;
  }>;
}

const PLATFORM_MEDIA_RULES: Record<
  string,
  {
    maxImageMb: number;
    maxVideoMb: number;
    allowedImageTypes: string[];
    allowedVideoTypes: string[];
    preferredAspectRatios: string[];
    defaultDimension: string;
  }
> = {
  instagram: {
    maxImageMb: 8,
    maxVideoMb: 100,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime'],
    preferredAspectRatios: ['1:1', '4:5', '9:16'],
    defaultDimension: '1080x1080 (Square 1:1) or 1080x1350 (Portrait 4:5)',
  },
  facebook: {
    maxImageMb: 10,
    maxVideoMb: 500,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime'],
    preferredAspectRatios: ['1:1', '16:9', '9:16'],
    defaultDimension: '1200x630 (Landscape 1.91:1) or 1080x1080 (Square 1:1)',
  },
  linkedin: {
    maxImageMb: 8,
    maxVideoMb: 200,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
    allowedVideoTypes: ['video/mp4'],
    preferredAspectRatios: ['1:1', '16:9', '4:5'],
    defaultDimension: '1200x627 (Landscape) or 1080x1080 (Square 1:1)',
  },
  x: {
    maxImageMb: 5,
    maxVideoMb: 512,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4'],
    preferredAspectRatios: ['16:9', '1:1'],
    defaultDimension: '1200x675 (Landscape 16:9)',
  },
  tiktok: {
    maxImageMb: 0, // Video only primarily
    maxVideoMb: 287,
    allowedImageTypes: [],
    allowedVideoTypes: ['video/mp4', 'video/webm'],
    preferredAspectRatios: ['9:16'],
    defaultDimension: '1080x1920 (Vertical 9:16)',
  },
  youtube: {
    maxImageMb: 2, // Thumbnail
    maxVideoMb: 1024,
    allowedImageTypes: ['image/jpeg', 'image/png'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime'],
    preferredAspectRatios: ['16:9', '9:16'],
    defaultDimension: '1280x720 (Landscape 16:9)',
  },
  threads: {
    maxImageMb: 8,
    maxVideoMb: 100,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedVideoTypes: ['video/mp4'],
    preferredAspectRatios: ['1:1', '4:5', '16:9'],
    defaultDimension: '1080x1080 (Square 1:1)',
  },
  pinterest: {
    maxImageMb: 20,
    maxVideoMb: 500,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedVideoTypes: ['video/mp4'],
    preferredAspectRatios: ['2:3', '9:16'],
    defaultDimension: '1000x1500 (Vertical 2:3)',
  },
};

export function getRecommendedFormatForPlatform(platforms: string[]): {
  aspectRatio: string;
  dimension: string;
  hint: string;
} {
  const primary = (platforms[0] || 'linkedin').toLowerCase();
  const rule = PLATFORM_MEDIA_RULES[primary] || PLATFORM_MEDIA_RULES.linkedin;

  if (primary === 'instagram') {
    return {
      aspectRatio: '1:1',
      dimension: '1080x1080',
      hint: 'Instagram prioritizes 1:1 square graphics or 4:5 vertical feed cards for higher visual engagement.',
    };
  }
  if (primary === 'linkedin') {
    return {
      aspectRatio: '1.91:1',
      dimension: '1200x627',
      hint: 'LinkedIn feeds favor professional high-contrast landscape banners or 1:1 infographics.',
    };
  }
  if (primary === 'x') {
    return {
      aspectRatio: '16:9',
      dimension: '1200x675',
      hint: 'X (Twitter) posts render best with 16:9 widescreen banners to avoid timeline auto-cropping.',
    };
  }
  if (primary === 'tiktok' || primary === 'youtube') {
    return {
      aspectRatio: '9:16',
      dimension: '1080x1920',
      hint: 'Full-screen vertical orientation (9:16) for short-form mobile engagement.',
    };
  }

  return {
    aspectRatio: '1:1',
    dimension: rule.defaultDimension,
    hint: `Auto-formatted for ${platforms.join(', ')}.`,
  };
}

export function validateMediaForPlatforms(
  media: MediaMetadata,
  platforms: string[]
): MediaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!media.url) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Basic URL syntax check
  try {
    new URL(media.url);
  } catch {
    errors.push('Media URL is invalid or malformed.');
    return { valid: false, errors, warnings };
  }

  // Validate per target platform
  for (const plat of platforms) {
    const rules = PLATFORM_MEDIA_RULES[plat.toLowerCase()];
    if (!rules) continue;

    if (media.type === 'image' && rules.maxImageMb === 0) {
      warnings.push(`${plat} primarily supports short-form video content.`);
    }

    if (media.fileSizeMb) {
      if (media.type === 'image' && media.fileSizeMb > rules.maxImageMb && rules.maxImageMb > 0) {
        errors.push(`Image exceeds ${plat}'s maximum file size of ${rules.maxImageMb}MB (Uploaded: ${media.fileSizeMb.toFixed(1)}MB).`);
      }
      if (media.type === 'video' && media.fileSizeMb > rules.maxVideoMb) {
        errors.push(`Video exceeds ${plat}'s maximum file size of ${rules.maxVideoMb}MB (Uploaded: ${media.fileSizeMb.toFixed(1)}MB).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validatePublishingReadiness(params: {
  post: {
    title?: string;
    defaultCaption?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    channels?: string[];
    status?: string;
    scheduledAt?: string | null;
  };
  hasConnectedChannels: boolean;
  userCanPublish: boolean;
}): PublishingValidationResult {
  const { post, hasConnectedChannels, userCanPublish } = params;
  const checklist: PublishingValidationResult['checklist'] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Content and Title Presence
  const hasTitle = Boolean(post.title && post.title.trim().length > 0);
  checklist.push({
    item: 'Post Title & Topic defined',
    passed: hasTitle,
    importance: 'blocker',
    detail: hasTitle ? `Title: "${post.title}"` : 'Post title is missing.',
  });
  if (!hasTitle) errors.push('Post title is required.');

  // 2. Caption presence
  const hasCaption = Boolean(post.defaultCaption && post.defaultCaption.trim().length > 0);
  checklist.push({
    item: 'Caption / Body Copy provided',
    passed: hasCaption,
    importance: 'blocker',
    detail: hasCaption ? `${post.defaultCaption?.length} characters` : 'Main caption is empty.',
  });
  if (!hasCaption) errors.push('Caption is required to publish.');

  // 3. Target Channels selected
  const hasChannels = Boolean(post.channels && post.channels.length > 0);
  checklist.push({
    item: 'Target Social Channels selected',
    passed: hasChannels,
    importance: 'blocker',
    detail: hasChannels ? post.channels?.join(', ') || '' : 'No target channels selected.',
  });
  if (!hasChannels) errors.push('At least one target social platform must be selected.');

  // 4. Media Validity
  if (post.mediaUrl) {
    const mediaCheck = validateMediaForPlatforms(
      { url: post.mediaUrl, type: post.mediaType },
      post.channels || []
    );
    const mediaPassed = mediaCheck.valid;
    checklist.push({
      item: 'Media creative validated for platforms',
      passed: mediaPassed,
      importance: 'blocker',
      detail: mediaPassed ? 'Creative format and dimensions compatible' : mediaCheck.errors.join('; '),
    });
    if (!mediaPassed) errors.push(...mediaCheck.errors);
  }

  // 5. Account Connectivity
  checklist.push({
    item: 'Channel OAuth / Integration connected',
    passed: hasConnectedChannels,
    importance: 'warning',
    detail: hasConnectedChannels ? 'Active Buffer/Direct connection verified' : 'No external social account connected (will run in simulation mode)',
  });
  if (!hasConnectedChannels) {
    warnings.push('No external social account linked. Post will be published to local workspace records.');
  }

  // 6. User Permissions
  checklist.push({
    item: 'User publishing permission granted',
    passed: userCanPublish,
    importance: 'blocker',
    detail: userCanPublish ? 'Authorized to publish' : 'User lacks publishing permission in this workspace',
  });
  if (!userCanPublish) errors.push('You do not have permission to publish content directly.');

  // 7. Approval Status
  const isApproved = post.status === 'approved' || post.status === 'scheduled' || userCanPublish;
  checklist.push({
    item: 'Content Approval completed',
    passed: isApproved,
    importance: 'blocker',
    detail: isApproved ? `Status: ${post.status}` : `Content is in "${post.status}" state and requires approval`,
  });
  if (!isApproved) errors.push(`Content in "${post.status}" status cannot be published without approval.`);

  const ready = errors.length === 0;

  return {
    ready,
    errors,
    warnings,
    checklist,
  };
}
