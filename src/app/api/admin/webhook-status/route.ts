import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recentWebhookLogs } from '@/app/api/whatsapp/webhook/route';
import { registerPhoneNumber } from '@/lib/whatsapp/meta-api';
import { ensureWabaSubscribed } from '@/lib/whatsapp/webhook-subscribe';
import { decrypt } from '@/lib/whatsapp/encryption';
import { isAuthorizedAdminRequest } from '@/lib/auth/admin-gate';

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  try {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    // 1. Fetch configs
    const { data: configs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*');

    // Auto-subscribe Meta WABAs to this App's Webhooks & register phone numbers to claim inbound stream
    const subscriptionResults: Array<{ waba_id: string; status: string; error?: string }> = [];
    const registrationResults: Array<{ phone_number_id: string; status: string; error?: string }> = [];
    if (configs && configs.length > 0) {
      for (const config of configs) {
        if (config.provider === 'meta' && config.access_token) {
          try {
            const token = decrypt(config.access_token);
            if (config.waba_id) {
              // Decrypt the workspace verify token so the subscription
              // can pin inbound delivery to this deployment's webhook
              // URL (override_callback_uri). Falls back to the
              // app-dashboard callback when the pin fails.
              let verifyToken: string | null = null;
              if (config.verify_token) {
                try {
                  verifyToken = decrypt(config.verify_token);
                } catch {
                  verifyToken = config.verify_token;
                }
              }
              const sub = await ensureWabaSubscribed({
                wabaId: config.waba_id,
                accessToken: token,
                verifyToken,
              });
              subscriptionResults.push({
                waba_id: config.waba_id,
                status: sub.subscribed ? `subscribed (${sub.mode})` : 'error',
                ...(sub.error ? { error: sub.error } : {}),
              });
            }
            if (config.phone_number_id) {
              try {
                const url = new URL(request.url);
                const pin =
                  url.searchParams.get('pin') ||
                  process.env.META_TWO_STEP_PIN ||
                  '792725';
                const res = await registerPhoneNumber({
                  phoneNumberId: config.phone_number_id,
                  accessToken: token,
                  pin,
                });
                registrationResults.push({
                  phone_number_id: config.phone_number_id,
                  status: res.alreadyRegistered ? 'already_registered' : 'registered',
                });
              } catch (err) {
                registrationResults.push({
                  phone_number_id: config.phone_number_id,
                  status: 'error',
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
          } catch (tokenErr) {
            console.error('Failed to decrypt token:', tokenErr);
          }
        }
      }
    }

    // 2. Fetch counts
    const { count: contactsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    const { count: conversationsCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true });

    const { count: messagesCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // 3. Fetch latest 5 conversations with messages
    const { data: recentConversations } = await supabase
      .from('conversations')
      .select('id, workspace_id, contact_id, status, last_message_text, last_message_at, contact:contacts(*)')
      .order('last_message_at', { ascending: false })
      .limit(5);

    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    const sanitizedConfigs = configs?.map((c) => ({
      id: c.id,
      workspace_id: c.workspace_id,
      user_id: c.user_id,
      provider: c.provider,
      phone_number_id: c.phone_number_id,
      waba_id: c.waba_id,
      status: c.status,
      created_at: c.created_at,
    }));

    return NextResponse.json({
      status: 'active',
      configCount: sanitizedConfigs?.length ?? 0,
      configs: sanitizedConfigs ?? [],
      counts: {
        contacts: contactsCount ?? 0,
        conversations: conversationsCount ?? 0,
        messages: messagesCount ?? 0,
      },
      wabaSubscriptions: subscriptionResults,
      phoneRegistrations: registrationResults,
      recentConversations: recentConversations ?? [],
      recentMessages: recentMessages ?? [],
      webhookLogs: recentWebhookLogs ?? [],
      configError: configError ? configError.message : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/webhook-status
 * Simulates a test inbound WhatsApp message for the active workspace.
 */
export async function POST(request: Request) {
  try {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const phone = body.phone || '919876543210';
    const messageText = body.message || 'Hello from WhatsApp CRM Test!';

    const supabase = supabaseAdmin();

    // Get active whatsapp_config or workspace
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!config) {
      return NextResponse.json(
        { error: 'No whatsapp_config row found. Please configure WhatsApp in Settings first.' },
        { status: 400 }
      );
    }

    const mockPayload = {
      entry: [
        {
          id: config.phone_number_id || 'test-entry',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '917892976832',
                  phone_number_id: config.phone_number_id || '1293266613862937',
                },
                contacts: [
                  {
                    profile: { name: 'Test WhatsApp User' },
                    wa_id: phone,
                  },
                ],
                messages: [
                  {
                    from: phone,
                    id: `simulated-${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: messageText },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    // Forward payload directly to the internal webhook POST route
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dailycrm.cloud';
    const webhookRes = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockPayload),
    });

    const result = await webhookRes.json();

    return NextResponse.json({
      success: true,
      simulatedPayload: mockPayload,
      webhookResponse: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
