import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendReactionMessage } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import {
  describePostgresError,
  isMissingOnConflictConstraint,
} from '@/lib/supabase/pg-errors';

/**
 * POST /api/whatsapp/react
 *
 * Body: { message_id: <internal UUID>, emoji: <single emoji or "" to remove> }
 *
 * Sends the reaction to Meta and mirrors it into `message_reactions`
 * (delete on empty emoji). Customer-side reactions are handled by the
 * webhook — this route only writes `actor_type = 'agent'` rows.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(`react:${user.id}`, RATE_LIMITS.react);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    // Resolve the caller's workspace memberships so conversation +
    // whatsapp_config lookups work for teammates who didn't author the
    // rows directly. (The schema is workspace_id-based — the previous
    // profiles.account_id lookup hit a nonexistent column and made
    // this route 403 for every caller.)
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    const workspaceIds = (memberships ?? [])
      .map((m: { workspace_id: string | null }) => m.workspace_id)
      .filter(Boolean) as string[];
    if (workspaceIds.length === 0) {
      return NextResponse.json(
        { error: 'Your profile is not linked to a workspace.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { message_id, emoji } = body as {
      message_id?: string;
      emoji?: string;
    };

    if (!message_id || typeof emoji !== 'string') {
      return NextResponse.json(
        { error: 'message_id and emoji are required' },
        { status: 400 },
      );
    }

    // Resolve target message + its conversation; verify ownership.
    const { data: targetMessage, error: msgError } = await supabase
      .from('messages')
      .select('id, message_id, conversation_id')
      .eq('id', message_id)
      .maybeSingle();

    if (msgError || !targetMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (!targetMessage.message_id) {
      // No Meta ID yet — usually a sending/failed agent message. We can't
      // tell Meta to react to a message it never received.
      return NextResponse.json(
        { error: 'Cannot react to a message that has not been sent to WhatsApp' },
        { status: 400 },
      );
    }

    // RLS scopes this to conversations the caller's workspace can see;
    // the row's workspace_id then drives the whatsapp_config lookup —
    // same pattern as /api/whatsapp/send.
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, workspace_id, contact:contacts(phone)')
      .eq('id', targetMessage.conversation_id)
      .in('workspace_id', workspaceIds)
      .maybeSingle();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    const contact = Array.isArray(conversation.contact)
      ? conversation.contact[0]
      : conversation.contact;
    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 },
      );
    }

    // WhatsApp config + access token, scoped to the conversation's
    // workspace so multi-workspace members react via the right number
    // (whatsapp_config.workspace_id is UNIQUE per 011).
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('workspace_id', conversation.workspace_id)
      .maybeSingle();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured.' },
        { status: 400 },
      );
    }

    const accessToken = decrypt(config.access_token);
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone);

    try {
      await sendReactionMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: sanitizedPhone,
        targetMessageId: targetMessage.message_id,
        emoji,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error('[whatsapp/react] Meta send failed:', message);
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 },
      );
    }

    // Mirror into DB. Empty emoji = removal.
    if (emoji === '') {
      const { error: delError } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', targetMessage.id)
        .eq('actor_type', 'agent')
        .eq('actor_id', user.id);

      if (delError) {
        console.error('[whatsapp/react] DB delete failed:', delError);
        return NextResponse.json(
          {
            error: `Reaction sent to WhatsApp, but removing it here failed: ${describePostgresError(delError)}`,
          },
          { status: 500 },
        );
      }
    } else {
      const row = {
        message_id: targetMessage.id,
        conversation_id: targetMessage.conversation_id,
        actor_type: 'agent',
        actor_id: user.id,
        emoji,
      };

      // Upsert. The unique constraint (message_id, actor_type, actor_id)
      // lets us swap emoji in a single statement.
      const { error: upsertError } = await supabase
        .from('message_reactions')
        .upsert(row, { onConflict: 'message_id,actor_type,actor_id' });

      if (upsertError && isMissingOnConflictConstraint(upsertError)) {
        // The deployment's message_reactions predates the UNIQUE
        // (message_id, actor_type, actor_id) constraint — ON CONFLICT has
        // nothing to match (Postgres 42P10), so every reaction 500s.
        // Migration 071_message_reactions_repair.sql adds it. Until it's
        // applied, emulate the upsert: delete this actor's row, insert the
        // new one. Racy only against the same user double-reacting, which
        // 071 then de-duplicates.
        console.warn(
          '[whatsapp/react] message_reactions is missing UNIQUE (message_id, actor_type, actor_id) — ' +
            'falling back to delete-then-insert. Apply migration 071_message_reactions_repair.sql to fix this properly.',
        );

        const { error: clearError } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', targetMessage.id)
          .eq('actor_type', 'agent')
          .eq('actor_id', user.id);

        if (clearError) {
          console.error('[whatsapp/react] fallback delete failed:', clearError);
          return NextResponse.json(
            {
              error: `Reaction sent to WhatsApp, but saving it here failed: ${describePostgresError(clearError)}`,
            },
            { status: 500 },
          );
        }

        const { error: insertError } = await supabase
          .from('message_reactions')
          .insert(row);

        if (insertError) {
          console.error('[whatsapp/react] fallback insert failed:', insertError);
          return NextResponse.json(
            {
              error: `Reaction sent to WhatsApp, but saving it here failed: ${describePostgresError(insertError)}`,
            },
            { status: 500 },
          );
        }

        // Reaction is live on both sides; flag the schema drift so the UI
        // (or support) can tell that a migration is pending.
        return NextResponse.json({
          success: true,
          degraded: 'missing-unique-constraint',
          migration: '071_message_reactions_repair.sql',
        });
      }

      if (upsertError) {
        console.error('[whatsapp/react] DB upsert failed:', upsertError);
        return NextResponse.json(
          {
            error: `Reaction sent to WhatsApp, but saving it here failed: ${describePostgresError(upsertError)}`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in WhatsApp react POST:', error);
    // Surface the reason — the client toasts whatever `error` holds, and a
    // bare "Failed to react to message" left users (and support) blind.
    const detail = error instanceof Error ? error.message : '';
    return NextResponse.json(
      {
        error: detail
          ? `Failed to react to message: ${detail}`
          : 'Failed to react to message',
      },
      { status: 500 },
    );
  }
}
