import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateBlogSEO } from '@/lib/marketing/seo-evaluator';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: blog, error } = await supabase
      .from('marketing_blogs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', blog.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ blog });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching blog' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existingBlog } = await supabase
      .from('marketing_blogs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existingBlog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', existingBlog.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, any> = { ...body };
    delete updates.id;
    delete updates.workspace_id;
    delete updates.created_at;

    // Recalculate SEO if content, title, or keywords were modified
    if (updates.content || updates.title || updates.seo_title || updates.primary_keyword) {
      const seoReport = evaluateBlogSEO({
        title: updates.title || existingBlog.title,
        seoTitle: updates.seo_title || existingBlog.seo_title,
        seoDescription: updates.seo_description || existingBlog.seo_description,
        slug: updates.slug || existingBlog.slug,
        content: updates.content || existingBlog.content,
        primaryKeyword: updates.primary_keyword || existingBlog.primary_keyword,
        secondaryKeywords: updates.secondary_keywords || existingBlog.secondary_keywords,
        featuredImage: updates.featured_image || existingBlog.featured_image,
        altText: updates.alt_text || existingBlog.alt_text,
        headings: updates.headings || existingBlog.headings,
        faqSchema: updates.faqSchema || existingBlog.faqSchema,
      });
      updates.seo_readiness = seoReport;
    }

    const { data: updatedBlog, error: updateError } = await supabase
      .from('marketing_blogs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ blog: updatedBlog });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating blog' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: blog } = await supabase
      .from('marketing_blogs')
      .select('workspace_id')
      .eq('id', id)
      .maybeSingle();

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', blog.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('marketing_blogs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error deleting blog' }, { status: 500 });
  }
}
