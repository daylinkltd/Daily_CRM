import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recentWebhookLogs } from '@/app/api/whatsapp/webhook/route';

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    // 1. Fetch configs
    const { data: configs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, workspace_id, user_id, provider, phone_number_id, waba_id, status, created_at');

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

    return NextResponse.json({
      status: 'active',
      configCount: configs?.length ?? 0,
      configs: configs ?? [],
      counts: {
        contacts: contactsCount ?? 0,
        conversations: conversationsCount ?? 0,
        messages: messagesCount ?? 0,
      },
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
