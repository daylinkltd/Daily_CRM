import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const VALID_PLANS = ['growth', 'custom'];

export async function POST(request: NextRequest) {
  try {
    // Public lead form — rate-limit per IP so the prospects table
    // can't be flooded by an anonymous loop.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const limit = checkRateLimit(`prospects:${ip}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = await request.json();

    const { full_name, company_name, email, phone, team_size, plan_interest, message } = body as {
      full_name?: string;
      company_name?: string;
      email?: string;
      phone?: string;
      team_size?: string;
      plan_interest?: string;
      message?: string;
    };

    // Validate required fields
    if (!full_name?.trim() || !company_name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'full_name, company_name, and email are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from('prospects')
      .insert({
        full_name: full_name.trim(),
        company_name: company_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        team_size: team_size?.trim() || null,
        plan_interest: VALID_PLANS.includes(plan_interest || '') ? plan_interest : 'growth',
        message: message?.trim() || null,
        status: 'new',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[prospects] Insert error:', error);
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err: any) {
    console.error('[prospects] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Allow PATCH to update prospect status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    // "Admin only" must actually be enforced — this mutates the sales
    // pipeline with a service-role client.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile?.system_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const body = await request.json();
    const { id, status } = body as { id?: string; status?: string };

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }

    const validStatuses = ['new', 'contacted', 'converted'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { error } = await admin
      .from('prospects')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
