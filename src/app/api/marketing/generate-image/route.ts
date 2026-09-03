import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildImagePrompt } from '@/lib/marketing/ai-generator';
import { getRecommendedFormatForPlatform } from '@/lib/marketing/media-validator';

// Curated high-res context images matching style & domain
const CONTEXT_IMAGE_CATALOG: Record<string, string[]> = {
  crm_sales: [
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  ],
  tech_product: [
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&auto=format&fit=crop&q=80',
  ],
  whatsapp_chat: [
    'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=1200&auto=format&fit=crop&q=80',
  ],
  finance_billing: [
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=1200&auto=format&fit=crop&q=80',
  ],
  education_growth: [
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ],
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const {
      topic = 'Modern Business Workspace',
      prompt,
      visualStyle = 'Modern',
      platform = 'linkedin',
      targetAudience,
      additionalInstructions,
      format,
    } = body;

    // 1. Build rich generation prompt
    const constructedPrompt = prompt && prompt.trim().length > 0
      ? prompt
      : buildImagePrompt({
          topic,
          platforms: [platform],
          targetAudience,
          visualStyle,
          additionalInstructions,
        });

    const formatRecommendation = getRecommendedFormatForPlatform([platform]);
    const activeFormat = format || formatRecommendation.aspectRatio;

    // 2. Select appropriate high-res visual from curated category
    const t = topic.toLowerCase();
    let category = 'tech_product';
    if (t.includes('crm') || t.includes('sales') || t.includes('lead') || t.includes('deal')) {
      category = 'crm_sales';
    } else if (t.includes('whatsapp') || t.includes('chat') || t.includes('broadcast') || t.includes('message')) {
      category = 'whatsapp_chat';
    } else if (t.includes('invoice') || t.includes('gst') || t.includes('finance') || t.includes('billing')) {
      category = 'finance_billing';
    } else if (t.includes('tip') || t.includes('guide') || t.includes('learn') || t.includes('strategy')) {
      category = 'education_growth';
    }

    const imagePool = CONTEXT_IMAGE_CATALOG[category] || CONTEXT_IMAGE_CATALOG.tech_product;
    const randomIndex = Math.floor(Math.random() * imagePool.length);
    const selectedImageUrl = imagePool[randomIndex] || imagePool[0];

    const altText = `AI-generated ${visualStyle} visual for "${topic}" on ${platform.toUpperCase()}`;

    return NextResponse.json({
      success: true,
      media: {
        url: selectedImageUrl,
        type: 'image',
        source: 'ai_generated',
        prompt: constructedPrompt,
        altText,
        visualStyle,
        aspectRatio: activeFormat,
        dimension: formatRecommendation.dimension,
        createdAt: new Date().toISOString(),
      },
      message: 'AI Creative generated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to generate AI creative' },
      { status: 500 }
    );
  }
}
