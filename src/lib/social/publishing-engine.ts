import { createClient } from '@/lib/supabase/server';
import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import { SOCIAL_CONFIG } from './config';
import type {
  PostPublishPayload,
  MarketingSocialChannelRecord,
  MarketingIntegrationRecord,
  PlatformResult,
  PlatformPublishStatus,
  SocialPlatformAdapter,
} from './types';
import { MetaGraphAdapter } from './adapters/meta-graph-adapter';
import { LinkedInAdapter } from './adapters/linkedin-adapter';
import { reconcileChannelPost } from './reconciliation';

export interface PublishExecutionSummary {
  success: boolean;
  postId: string;
  aggregateStatus: 'published' | 'partially_published' | 'failed' | 'unknown';
  platformResults: Record<string, PlatformResult>;
  externalPostIds: Record<string, string>;
  message: string;
}

/**
 * Universal server-side Social Publishing Dispatcher.
 * Invoked identically by both on-demand (Instant Publish) and background Cron workers.
 */
export async function publishMarketingPost(params: {
  postId: string;
  workspaceId: string;
  targetChannelIds?: string[];
  isRetry?: boolean;
  triggeredByUserId?: string;
  workerId?: string;
}): Promise<PublishExecutionSummary> {
  const { postId, workspaceId, targetChannelIds, isRetry, triggeredByUserId, workerId = 'manual_or_cron' } = params;
  const supabase = await createClient();

  // 1. Step 1: ATOMIC CLAIM (commits immediately, no open DB transaction during external API calls)
  const { data: post, error: claimError } = await supabase
    .from('marketing_posts')
    .update({
      status: 'publishing',
      locked_at: new Date().toISOString(),
      locked_by: workerId,
    })
    .eq('id', postId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (claimError || !post) {
    throw new Error(`Failed to claim post ${postId} for publishing: ${claimError?.message || 'Post not found or unauthorized'}`);
  }

  // 2. Fetch verified workspace channels & integrations
  const { data: channelsData, error: channelsError } = await supabase
    .from('marketing_social_channels')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_enabled', true)
    .eq('status', 'connected');

  if (channelsError) {
    await releasePostLock(supabase, postId, 'failed', { error: 'Failed to query workspace channels' });
    throw new Error(`Error querying workspace channels: ${channelsError.message}`);
  }

  const allChannels = (channelsData || []) as MarketingSocialChannelRecord[];
  const existingResults: Record<string, PlatformResult> = post.platform_results || {};
  const externalPostIds: Record<string, string> = post.external_post_ids || {};

  // Filter target channels
  let activeChannels = allChannels;
  if (targetChannelIds && targetChannelIds.length > 0) {
    activeChannels = allChannels.filter((ch) => targetChannelIds.includes(ch.id));
  } else if (post.target_channel_ids && post.target_channel_ids.length > 0) {
    activeChannels = allChannels.filter((ch) => post.target_channel_ids.includes(ch.id));
  } else if (post.channels && post.channels.length > 0) {
    // Fallback match on platform name
    activeChannels = allChannels.filter((ch) => post.channels.includes(ch.platform));
  }

  if (activeChannels.length === 0) {
    const errorMsg = 'No connected social media channels found for this workspace/post';
    await releasePostLock(supabase, postId, 'failed', { error: errorMsg });
    return {
      success: false,
      postId,
      aggregateStatus: 'failed',
      platformResults: existingResults,
      externalPostIds,
      message: errorMsg,
    };
  }

  // Filter out channels that are already successfully published (IDEMPOTENCY RULE)
  const channelsToExecute = activeChannels.filter((ch) => {
    const priorResult = existingResults[ch.id];
    if (priorResult?.status === 'published' && !isRetry) {
      return false; // Skip already published channel!
    }
    return true;
  });

  if (channelsToExecute.length === 0 && Object.keys(existingResults).length > 0) {
    // All targeted channels were already published
    await releasePostLock(supabase, postId, 'published', {});
    return {
      success: true,
      postId,
      aggregateStatus: 'published',
      platformResults: existingResults,
      externalPostIds,
      message: 'All target channels are already published',
    };
  }

  // 3. Step 2: EXECUTE ADAPTERS ASYNCHRONOUSLY OUTSIDE DB LOCK
  const updatedResults = { ...existingResults };
  const executionPromises = channelsToExecute.map(async (channel) => {
    const platform = channel.platform as 'facebook' | 'instagram' | 'linkedin';
    let adapter: SocialPlatformAdapter;

    if (platform === 'facebook' || platform === 'instagram') {
      adapter = new MetaGraphAdapter(platform);
    } else if (platform === 'linkedin') {
      adapter = new LinkedInAdapter();
    } else {
      updatedResults[channel.id] = {
        channelId: channel.id,
        platform: platform as any,
        status: 'failed',
        attemptCount: (existingResults[channel.id]?.attemptCount || 0) + 1,
        lastErrorCode: 'UNSUPPORTED_PLATFORM',
        lastErrorMessage: `Platform ${platform} is not supported in Phase 1`,
        errorClassification: 'validation',
      };
      return;
    }

    // A. Validate payload before dispatch
    const val = adapter.validatePayload(post, channel);
    if (!val.valid) {
      updatedResults[channel.id] = {
        channelId: channel.id,
        platform,
        status: 'failed',
        attemptCount: (existingResults[channel.id]?.attemptCount || 0) + 1,
        lastErrorCode: 'VALIDATION_ERROR',
        lastErrorMessage: val.error || 'Payload validation failed',
        errorClassification: 'validation',
      };
      return;
    }

    // B. Resolve and decrypt access token
    let rawToken = '';
    try {
      if (channel.page_access_token_encrypted) {
        rawToken = decrypt(channel.page_access_token_encrypted);
      } else {
        // Fallback fetch integration token
        const { data: intRow } = await supabase
          .from('marketing_integrations')
          .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
          .eq('id', channel.integration_id)
          .single();

        if (intRow?.access_token_encrypted) {
          rawToken = decrypt(intRow.access_token_encrypted);
        }
      }
    } catch (tokenDecErr: any) {
      updatedResults[channel.id] = {
        channelId: channel.id,
        platform,
        status: 'failed',
        attemptCount: (existingResults[channel.id]?.attemptCount || 0) + 1,
        lastErrorCode: 'TOKEN_DECRYPT_ERROR',
        lastErrorMessage: `Could not decrypt channel token: ${tokenDecErr.message}`,
        errorClassification: 'authentication',
      };
      return;
    }

    if (!rawToken) {
      updatedResults[channel.id] = {
        channelId: channel.id,
        platform,
        status: 'failed',
        attemptCount: (existingResults[channel.id]?.attemptCount || 0) + 1,
        lastErrorCode: 'MISSING_TOKEN',
        lastErrorMessage: 'No active access token found for channel',
        errorClassification: 'authentication',
      };
      return;
    }

    // C. Handle Reconciliation if previous attempt was UNKNOWN
    if (existingResults[channel.id]?.status === 'unknown' || existingResults[channel.id]?.reconciliationRequired) {
      const rec = await reconcileChannelPost({
        post,
        channel,
        accessToken: rawToken,
        adapter,
      });

      if (rec.reconciled && rec.newStatus === 'published' && rec.externalPostId) {
        updatedResults[channel.id] = {
          ...existingResults[channel.id],
          status: 'published',
          externalPostId: rec.externalPostId,
          externalPostUrl: rec.externalPostUrl,
          completedAt: new Date().toISOString(),
          reconciliationRequired: false,
        };
        externalPostIds[platform] = rec.externalPostId;
        return;
      }
    }

    // D. Publish post via platform adapter
    const startTime = new Date().toISOString();
    const result = await adapter.publishPost({
      post,
      channel,
      accessToken: rawToken,
    });

    const attemptCount = (existingResults[channel.id]?.attemptCount || 0) + 1;
    updatedResults[channel.id] = {
      channelId: channel.id,
      platform,
      status: result.status,
      attemptCount,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      externalPostId: result.externalPostId,
      externalPostUrl: result.externalPostUrl,
      errorClassification: result.errorClassification,
      lastErrorCode: result.lastErrorCode,
      lastErrorMessage: result.lastErrorMessage,
      providerRequestId: result.providerRequestId,
      reconciliationRequired: result.reconciliationRequired,
      rawResponseSnippet: result.rawResponseSnippet,
    };

    if (result.success && result.externalPostId) {
      externalPostIds[platform] = result.externalPostId;
    }

    // If token was revoked/expired, flag channel in database
    if (result.errorClassification === 'authentication') {
      await supabase
        .from('marketing_social_channels')
        .update({ status: 'error' })
        .eq('id', channel.id);
    }
  });

  await Promise.allSettled(executionPromises);

  // 4. Step 3: ATOMIC RESULT COMMIT & AGGREGATE STATUS
  let totalPublished = 0;
  let totalFailed = 0;
  let totalUnknown = 0;

  for (const ch of activeChannels) {
    const res = updatedResults[ch.id];
    if (res?.status === 'published') totalPublished++;
    else if (res?.status === 'unknown') totalUnknown++;
    else totalFailed++;
  }

  let aggregateStatus: 'published' | 'partially_published' | 'failed' | 'unknown' = 'failed';
  if (totalPublished === activeChannels.length) {
    aggregateStatus = 'published';
  } else if (totalPublished > 0) {
    aggregateStatus = 'partially_published';
  } else if (totalUnknown > 0) {
    aggregateStatus = 'unknown';
  }

  await supabase
    .from('marketing_posts')
    .update({
      status: aggregateStatus,
      platform_results: updatedResults,
      external_post_ids: externalPostIds,
      published_at: totalPublished > 0 ? new Date().toISOString() : null,
      locked_at: null,
      locked_by: null,
    })
    .eq('id', postId);

  // 5. Audit Log Entry
  try {
    await supabase.from('marketing_audit_logs').insert({
      workspace_id: workspaceId,
      entity_type: 'post',
      entity_id: postId,
      action: aggregateStatus === 'published' ? 'post_published' : 'post_publish_attempted',
      user_id: triggeredByUserId || null,
      comment: `Publish executed: ${totalPublished} published, ${totalFailed} failed, ${totalUnknown} unknown across ${activeChannels.length} channels`,
      metadata: {
        aggregateStatus,
        channelsCount: activeChannels.length,
        platformResults: updatedResults,
      },
    });
  } catch (auditErr) {
    console.warn('[PublishingEngine] Audit log write skipped:', auditErr);
  }

  return {
    success: aggregateStatus === 'published' || aggregateStatus === 'partially_published',
    postId,
    aggregateStatus,
    platformResults: updatedResults,
    externalPostIds,
    message: `Publish completed with status: ${aggregateStatus}`,
  };
}

async function releasePostLock(
  supabase: any,
  postId: string,
  newStatus: string,
  details: Record<string, any>
) {
  await supabase
    .from('marketing_posts')
    .update({
      status: newStatus,
      failure_reason: details.error || null,
      locked_at: null,
      locked_by: null,
    })
    .eq('id', postId);
}
