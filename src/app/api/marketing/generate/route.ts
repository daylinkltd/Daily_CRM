import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateMarketingContent } from '@/lib/marketing/ai-generator';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      topic,
      contentType = 'social',
      platforms = ['linkedin', 'instagram', 'x'],
      targetAudience,
      tone,
      campaignName,
      productOrService,
      websiteUrl,
      preferredLanguage,
      templateId,
      brandVoice,
      visualStyle,
      additionalCreativeInstructions,
      regenTarget,
      existingCaption,
      existingTitle,
      uploadedMediaUrl,
      workspaceId,
    } = body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json({ error: 'Topic is required to generate marketing content.' }, { status: 400 });
    }

    const generated = await generateMarketingContent({
      topic,
      contentType,
      platforms,
      targetAudience,
      tone,
      campaignName,
      productOrService,
      websiteUrl,
      preferredLanguage,
      templateId,
      brandVoice,
      visualStyle,
      additionalCreativeInstructions,
      regenTarget,
      existingCaption,
      existingTitle,
      uploadedMediaUrl,
    });

    // Traceable logging into marketing_generations if workspaceId is present
    if (workspaceId && generated.generation_id) {
      try {
        await supabase.from('marketing_generations').insert({
          generation_id: generated.generation_id,
          workspace_id: workspaceId,
          created_by: user.id,
          original_input: topic,
          structured_intent: generated.structured_intent || {},
          prompt_version: 'v2.0',
          generated_content: (generated.mode === 'blog' ? generated.blog : generated.social) || {},
          generated_media: generated.social?.image_url ? { url: generated.social.image_url, prompt: generated.social.image_prompt } : {},
        });
      } catch (logErr) {
        console.warn('[MarketingGenerateAPI] Non-blocking generation log error:', logErr);
      }
    }

    return NextResponse.json(generated);
  } catch (err: any) {
    console.error('[MarketingGenerateAPI] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate marketing content.' },
      { status: 500 }
    );
  }
}
