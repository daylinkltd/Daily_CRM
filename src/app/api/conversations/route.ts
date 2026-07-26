import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace membership
    const { data: member, error: memberErr } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a member of this workspace' },
        { status: 403 }
      );
    }

    // Try fetching conversations with embedded contacts
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false });

    if (!convError && conversations) {
      return NextResponse.json({ conversations });
    }

    // Fallback: If PostgREST embedding fails, fetch conversations and contacts separately
    console.warn('[conversations GET] Embedded query failed, executing fallback join:', convError);

    const { data: rawConvs, error: rawErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false });

    if (rawErr || !rawConvs) {
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    const contactIds = Array.from(
      new Set(rawConvs.map((c) => c.contact_id).filter(Boolean))
    );

    let contactsMap: Record<string, any> = {};
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .in('id', contactIds);

      if (contacts) {
        contactsMap = Object.fromEntries(contacts.map((c) => [c.id, c]));
      }
    }

    const joined = rawConvs.map((c) => ({
      ...c,
      contact: c.contact_id ? contactsMap[c.contact_id] || null : null,
    }));

    return NextResponse.json({ conversations: joined });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
