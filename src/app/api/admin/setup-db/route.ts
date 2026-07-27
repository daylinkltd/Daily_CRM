import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorizedAdminRequest } from '@/lib/auth/admin-gate';

export async function GET(request: Request) {
  try {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try executing table creation SQL
    const sql = `
      CREATE TABLE IF NOT EXISTS public.message_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
        message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
        actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'customer')),
        actor_id UUID NOT NULL,
        emoji TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.member_presence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away')),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    // Attempt RPC execution if exec_sql is available
    const { error: rpcErr } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

    if (rpcErr) {
      return NextResponse.json({
        status: 'manual_migration_required',
        message: 'Database tables missing. Execute the attached SQL script in Supabase SQL Editor.',
        sql,
      });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Database schema tables setup successfully.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', error: message });
  }
}
