import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const { data: holidays, error } = await supabase
      .from('hr_holidays')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holidays: holidays || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspaceId, title, date, holidayType, recurrenceType, description } = body;

    if (!workspaceId || !title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
    }

    const { data: holiday, error } = await supabase
      .from('hr_holidays')
      .insert({
        workspace_id: workspaceId,
        title,
        date,
        holiday_type: holidayType || 'COMPANY',
        recurrence_type: recurrenceType || 'YEARLY',
        description: description || ''
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holiday });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Edit a holiday. Scoped by workspace as well as id, and a zero-row result
 * is reported honestly: Supabase returns success when RLS filters an
 * UPDATE away, which would otherwise look like a save that stuck until the
 * page was reloaded.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspaceId, id, title, date, holidayType, recurrenceType, description } = body;

    if (!workspaceId || !id) {
      return NextResponse.json({ error: 'workspaceId and id are required' }, { status: 400 });
    }
    if (title !== undefined && !String(title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (date !== undefined) patch.date = date;
    if (holidayType !== undefined) patch.holiday_type = holidayType;
    if (recurrenceType !== undefined) patch.recurrence_type = recurrenceType;
    if (description !== undefined) patch.description = description;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from('hr_holidays')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Could not update that holiday — it may have been removed, or you may not have permission.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ holiday: rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const id = searchParams.get('id');

    if (!workspaceId || !id) {
      return NextResponse.json({ error: 'workspaceId and id are required' }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from('hr_holidays')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Could not delete that holiday — it may already be gone, or you may not have permission.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ deleted: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
