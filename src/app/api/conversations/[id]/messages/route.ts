import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const conversationId = resolvedParams.id;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify conversation access via workspace membership
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, workspace_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: member, error: memberErr } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', conversation.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Forbidden: You are not authorized to view messages in this workspace' },
        { status: 403 }
      );
    }

    // Fetch messages for the conversation
    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgErr) {
      console.error('Failed to fetch messages:', msgErr);
      return NextResponse.json(
        { error: `Failed to fetch messages: ${msgErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: messages ?? [] });
  } catch (error) {
    console.error('Error in messages GET route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
