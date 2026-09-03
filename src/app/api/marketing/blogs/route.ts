import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateBlogSEO } from '@/lib/marketing/seo-evaluator';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id query parameter is required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('marketing_blogs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: blogs, error } = await query;

    if (error) {
      console.error('[MarketingBlogsAPI] Query error:', error);
      return NextResponse.json({ blogs: [], count: 0 });
    }

    return NextResponse.json({ blogs: blogs || [], count: blogs?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching blogs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspaceId,
      title,
      slug,
      excerpt = '',
      content = '',
      headings = [],
      faqSchema = [],
      featuredImage,
      altText = '',
      category = 'General',
      tags = [],
      seoTitle = '',
      seoDescription = '',
      primaryKeyword = '',
      secondaryKeywords = [],
      internalLinks = [],
      authorName = 'Editorial Team',
      status = 'draft',
      scheduledAt,
      campaignId,
    } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Blog title is required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate or clean slug
    const cleanSlug = (slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 70);

    // Compute live SEO readiness score
    const seoReport = evaluateBlogSEO({
      title,
      seoTitle: seoTitle || title,
      seoDescription: seoDescription || excerpt,
      slug: cleanSlug,
      content,
      primaryKeyword,
      secondaryKeywords,
      featuredImage,
      altText,
      headings,
      faqSchema,
      internalLinks,
    });

    const insertPayload = {
      workspace_id: workspaceId,
      title: title.trim(),
      slug: cleanSlug,
      excerpt,
      content,
      headings,
      faqSchema,
      featured_image: featuredImage || null,
      alt_text: altText,
      category,
      tags,
      seo_title: seoTitle || title,
      seo_description: seoDescription || excerpt,
      primary_keyword: primaryKeyword,
      secondary_keywords: secondaryKeywords,
      seo_readiness: seoReport,
      internal_links: internalLinks,
      author_id: user.id,
      author_name: authorName,
      status,
      scheduled_at: scheduledAt || null,
      campaign_id: campaignId || null,
      creator_id: user.id,
    };

    const { data: newBlog, error: insertError } = await supabase
      .from('marketing_blogs')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[MarketingBlogsAPI] Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await supabase.from('marketing_audit_logs').insert({
      workspace_id: workspaceId,
      entity_type: 'blog',
      entity_id: newBlog.id,
      action: status === 'pending_approval' ? 'submitted' : 'created',
      user_id: user.id,
      user_name: authorName,
      user_role: membership.role,
      comment: `Created blog "${title}" (SEO Score: ${seoReport.score}%)`,
    });

    return NextResponse.json({ blog: newBlog }, { status: 201 });
  } catch (err: any) {
    console.error('[MarketingBlogsAPI] Error:', err);
    return NextResponse.json({ error: err.message || 'Error saving blog' }, { status: 500 });
  }
}
