import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
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

    // Fetch conversation to verify workspace membership
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, workspace_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify workspace membership
    const { data: member, error: memberErr } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', conversation.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Forbidden: You are not authorized to delete conversations in this workspace' },
        { status: 403 }
      );
    }

    // Delete conversation (messages cascade delete ON DELETE CASCADE)
    const { error: deleteErr } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (deleteErr) {
      console.error('Failed to delete conversation:', deleteErr);
      return NextResponse.json(
        { error: `Failed to delete conversation: ${deleteErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
