import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase admin client (service-role).
 * NEVER import this in client components — it bypasses RLS entirely.
 * Only use inside API routes (route.ts) or Server Actions.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[createAdminClient] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
