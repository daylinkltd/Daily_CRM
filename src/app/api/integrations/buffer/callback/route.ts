import { NextResponse } from 'next/server';
import { BufferService } from '@/lib/integrations/buffer-service';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const isSim = url.searchParams.get('sim') === 'true';

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    console.error('[BufferCallback] OAuth error from provider:', error);
    return NextResponse.redirect(`${baseUrl}/marketing/settings?tab=accounts&buffer_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/marketing/settings?tab=accounts&buffer_error=Missing+authorization+code+or+state`);
  }

  try {
    const result = await BufferService.handleOAuthCallback(code, state, isSim);
    return NextResponse.redirect(`${baseUrl}/marketing/settings?tab=accounts&buffer_connected=true`);
  } catch (err: any) {
    console.error('[BufferCallback] Token exchange error:', err);
    return NextResponse.redirect(`${baseUrl}/marketing/settings?tab=accounts&buffer_error=${encodeURIComponent(err.message || 'OAuth verification failed')}`);
  }
}
