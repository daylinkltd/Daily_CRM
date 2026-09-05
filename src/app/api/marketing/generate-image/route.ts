import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ImageGenerationService,
  GenerateImageOptions,
  mapImageProviderErrorToApplicationError,
} from '@/lib/marketing/image-service';

export async function POST(req: NextRequest) {
  let body: GenerateImageOptions | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    body = await req.json();

    if (!body || !body.prompt) {
      return NextResponse.json(
        {
          success: false,
          type: 'IMAGE_GENERATION_ERROR',
          code: 'INVALID_REQUEST',
          message: 'Some image settings are not supported. Please check your settings.',
          suggestedAction: 'edit_prompt',
          stage: 'validation',
        },
        { status: 400 }
      );
    }

    const result = await ImageGenerationService.generateImage(body);

    if (!result.success) {
      const status =
        result.code === 'INVALID_REQUEST'
          ? 400
          : result.code === 'PROVIDER_REJECTED' || result.code === 'PUBLIC_FIGURE_REFUSAL'
          ? 422
          : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json({
      success: true,
      media: {
        url: result.url,
        type: 'image',
        source: 'ai_generated',
        prompt: result.prompt,
        altText: result.altText,
        visualStyle: result.style,
        aspectRatio: result.aspectRatio,
        dimension: result.dimension,
        createdAt: result.created_at,
      },
      image: result,
      message: 'AI Creative generated successfully.',
    });
  } catch (err: any) {
    const errorResponse = mapImageProviderErrorToApplicationError(err, {
      provider: 'openai_dalle3',
      model: 'dall-e-3',
      stage: 'generation',
      prompt: typeof body !== 'undefined' ? body?.prompt : undefined,
    });
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
