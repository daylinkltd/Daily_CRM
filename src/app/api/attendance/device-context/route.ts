import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Returns the network context of the caller for an attendance punch.
 *
 * The IP is resolved here rather than in the browser on purpose: a client
 * cannot be trusted to report its own address, and browsers no longer
 * expose the local one (WebRTC returns an mDNS placeholder). Everything
 * the client collects about itself is self-reported; this is the one
 * field it cannot forge.
 */
function getClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ip: getClientIp(request),
    // Cloudflare and similar proxies add these; absent elsewhere.
    country: request.headers.get('cf-ipcountry'),
    observed_at: new Date().toISOString(),
  });
}
