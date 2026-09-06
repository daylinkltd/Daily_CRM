import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from('marketing_brand_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[BrandProfileAPI] Lookup notice:', error.message);
    }

    return NextResponse.json({
      success: true,
      profile: profile || null,
    });
  } catch (err: any) {
    console.error('[BrandProfileAPI] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch brand profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      workspace_id,
      company_name,
      website,
      business_description,
      industry,
      target_audience,
      brand_voice,
      brand_personality,
      primary_color,
      secondary_color,
      brand_guidelines,
    } = body;

    if (!workspace_id || !company_name) {
      return NextResponse.json(
        { error: 'workspace_id and company_name are required' },
        { status: 400 }
      );
    }

    const profilePayload = {
      workspace_id,
      company_name: company_name.trim(),
      website: website?.trim() || null,
      business_description: business_description?.trim() || null,
      industry: industry?.trim() || null,
      target_audience: target_audience?.trim() || null,
      brand_voice: brand_voice?.trim() || null,
      brand_personality: brand_personality?.trim() || null,
      primary_color: primary_color?.trim() || null,
      secondary_color: secondary_color?.trim() || null,
      brand_guidelines: brand_guidelines?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error } = await supabase
      .from('marketing_brand_profiles')
      .upsert(profilePayload, { onConflict: 'workspace_id' })
      .select('*')
      .single();

    if (error) {
      console.error('[BrandProfileAPI] Save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (err: any) {
    console.error('[BrandProfileAPI] POST Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save brand profile' }, { status: 500 });
  }
}
