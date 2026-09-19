import crypto from 'crypto';
import type {
  PostPublishPayload,
  MarketingSocialChannelRecord,
  PlatformResult,
  ReconciliationMatch,
  SocialPlatformAdapter,
} from './types';
import { MetaGraphAdapter } from './adapters/meta-graph-adapter';
import { LinkedInAdapter } from './adapters/linkedin-adapter';

/**
 * Creates a deterministic SHA-256 fingerprint for post text/media payload.
 */
export function generateContentFingerprint(post: PostPublishPayload, platform: string): string {
  const override = post.platform_overrides?.[platform];
  const text = (override?.caption || post.default_caption || post.title || '').trim();
  const media = override?.media_url || post.media_url || '';
  return crypto.createHash('sha256').update(`${text}::${media}`).digest('hex');
}

/**
 * Executes a safe, layered reconciliation lookup for a channel in UNKNOWN or STALE state.
 */
export async function reconcileChannelPost(params: {
  post: PostPublishPayload;
  channel: MarketingSocialChannelRecord;
  accessToken: string;
  adapter: SocialPlatformAdapter;
}): Promise<{
  reconciled: boolean;
  newStatus: 'published' | 'failed' | 'unknown';
  externalPostId?: string;
  externalPostUrl?: string;
  reason?: string;
}> {
  const { post, channel, accessToken, adapter } = params;

  if (!adapter.reconcileUnknownPost) {
    return {
      reconciled: false,
      newStatus: 'unknown',
      reason: 'Platform adapter does not implement reconciliation lookup',
    };
  }

  try {
    const match = await adapter.reconcileUnknownPost({ post, channel, accessToken });

    if (match.found && match.confidence === 'high' && match.externalPostId) {
      return {
        reconciled: true,
        newStatus: 'published',
        externalPostId: match.externalPostId,
        externalPostUrl: match.externalPostUrl,
        reason: match.matchReason || 'Confirmed post publication on external platform feed',
      };
    }

    // Inconclusive -> Do NOT auto-republish. Retain unknown status.
    return {
      reconciled: false,
      newStatus: 'unknown',
      reason: 'Reconciliation search found no matching post with high confidence. Manual verification required.',
    };
  } catch (err: any) {
    console.error('[ReconciliationEngine] Error during channel lookup:', err);
    return {
      reconciled: false,
      newStatus: 'unknown',
      reason: `Reconciliation query failed: ${err.message}`,
    };
  }
}
