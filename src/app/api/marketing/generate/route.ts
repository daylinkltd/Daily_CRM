import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateMarketingContent, BrandContext } from '@/lib/marketing/ai-generator';

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
      generationMode,
      contentType = 'social',
      platforms = ['instagram', 'linkedin', 'x'],
      targetAudience,
      tone,
      objective,
      campaignName,
      productOrService,
      websiteUrl,
      preferredLanguage,
      templateId,
      brandVoice,
      imageStyle,
      videoStyle,
      visualStyle,
      additionalCreativeInstructions,
      regenTarget,
      existingCaption,
      existingTitle,
      existingImagePrompt,
      existingVideoPrompt,
      existingHashtags,
      existingKeywords,
      existingCta,
      imagePromptVersion,
      videoPromptVersion,
      uploadedMediaUrl,
      workspaceId,
      customBrandContext,
      referenceArticles,
      primaryKeyword,
    } = body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json({
        success: false,
        stage: 'query_generation',
        error_code: 'TOPIC_REQUIRED',
        error: 'Topic is required to generate marketing content.',
      }, { status: 400 });
    }

    // 1. Fetch Multi-Tenant Brand Profile & Assets from Database if workspaceId is provided
    let brandContext: BrandContext = customBrandContext || {};
    let brandAssets: any[] = body.brandAssets || [];

    if (workspaceId) {
      try {
        const [profileRes, assetsRes, mSettingsRes, workspaceRes] = await Promise.all([
          supabase
            .from('marketing_brand_profiles')
            .select('*')
            .eq('workspace_id', workspaceId)
            .maybeSingle(),
          supabase
            .from('marketing_brand_assets')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false }),
          supabase
            .from('marketing_settings')
            .select('*')
            .eq('workspace_id', workspaceId)
            .maybeSingle(),
          supabase
            .from('workspaces')
            .select('name, branding')
            .eq('id', workspaceId)
            .maybeSingle(),
        ]);

        const brandProfile = profileRes.data;
        if (assetsRes.data && assetsRes.data.length > 0) {
          brandAssets = assetsRes.data;
        }

        const workspace = workspaceRes.data;
        const mSettings = mSettingsRes.data;

        // Construct tenant-specific brand context without hardcoding
        const colors = brandProfile?.primary_color
          ? `${brandProfile.primary_color}${brandProfile.secondary_color ? `, ${brandProfile.secondary_color}` : ''}`
          : workspace?.branding?.primaryColor ? `Primary ${workspace.branding.primaryColor}` : undefined;

        brandContext = {
          businessName: brandProfile?.company_name || workspace?.name || brandContext.businessName,
          brandDescription: brandProfile?.business_description || brandContext.brandDescription,
          brandVoice: brandProfile?.brand_voice || mSettings?.ai_brand_voice || brandContext.brandVoice,
          brandColors: colors || brandContext.brandColors,
          website: brandProfile?.website || websiteUrl || brandContext.website,
          productsOrServices: brandProfile?.business_description || productOrService || brandContext.productsOrServices,
          targetAudience: brandProfile?.target_audience || targetAudience || brandContext.targetAudience,
          campaign: campaignName || brandContext.campaign,
          ...brandContext,
        };
      } catch (err) {
        console.warn('[MarketingGenerateAPI] Non-blocking brand context lookup error:', err);
      }
    }

    // 2. Generate Structured Content & Production-Ready Prompts
    const generated = await generateMarketingContent({
      topic,
      generationMode,
      contentType,
      platforms,
      targetAudience,
      tone,
      objective,
      campaignName,
      productOrService,
      websiteUrl,
      preferredLanguage,
      templateId,
      brandVoice,
      imageStyle,
      videoStyle,
      visualStyle,
      brandContext,
      additionalCreativeInstructions,
      regenTarget,
      existingCaption,
      existingTitle,
      existingImagePrompt,
      existingVideoPrompt,
      existingHashtags,
      existingKeywords,
      existingCta,
      imagePromptVersion,
      videoPromptVersion,
      uploadedMediaUrl,
      brandAssets,
      referenceArticles,
      primaryKeyword,
    });

    if (!generated.success) {
      return NextResponse.json(generated, { status: 422 });
    }

    // 3. Traceable logging into marketing_generations if workspaceId is present
    if (workspaceId && generated.generation_id) {
      try {
        await supabase.from('marketing_generations').insert({
          generation_id: generated.generation_id,
          workspace_id: workspaceId,
          created_by: user.id,
          original_input: topic,
          structured_intent: generated.structured_intent || {},
          prompt_version: 'v3.0_creative_prompts',
          generated_content: (generated.mode === 'blog' ? generated.blog : generated.social) || {},
          generated_media: {
            image_prompt: generated.mode === 'blog' ? generated.blog?.image_prompt : generated.social?.image_prompt,
            video_prompt: generated.mode === 'blog' ? generated.blog?.video_prompt : generated.social?.video_prompt,
            uploaded_url: uploadedMediaUrl || null,
          },
        });
      } catch (logErr) {
        console.warn('[MarketingGenerateAPI] Non-blocking generation log error:', logErr);
      }
    }

    return NextResponse.json(generated);
  } catch (err: unknown) {
    console.error('[MarketingGenerateAPI] Error:', err);
    const msg = err instanceof Error ? err.message : 'Content generation failed. Please try again.';
    return NextResponse.json(
      {
        success: false,
        stage: 'llm_generation',
        error_code: 'INTERNAL_GENERATION_ERROR',
        error: msg,
      },
      { status: 500 }
    );
  }
}
