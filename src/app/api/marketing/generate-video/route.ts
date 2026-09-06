import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  VideoGenerationService,
  GenerateVideoOptions,
  mapProviderErrorToApplicationError,
} from '@/lib/marketing/video-service';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body: GenerateVideoOptions = await req.json();

    if (!body || !body.prompt) {
      return NextResponse.json(
        {
          success: false,
          type: 'VIDEO_GENERATION_ERROR',
          code: 'INVALID_REQUEST',
          message: 'Some video settings are not supported. Please check your settings.',
          suggestedAction: 'edit_prompt',
          stage: 'validation',
        },
        { status: 400 }
      );
    }

    const result = await VideoGenerationService.generateVideo(body);

    if (!result.success) {
      const status = result.code === 'INVALID_REQUEST' ? 400 : result.code === 'PROVIDER_REJECTED' ? 422 : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    const errorResponse = mapProviderErrorToApplicationError(err, {
      provider: 'openai_sora',
      model: 'sora-1.0',
      stage: 'generation',
    });
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  const status = VideoGenerationService.getGenerationStatus(jobId);
  return NextResponse.json(status);
}
