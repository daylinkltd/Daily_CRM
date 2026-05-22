import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ADMIN_EMAIL = 'info@daylink.in';
const ADMIN_PASSWORD = 'Tech@132';

/**
 * GET /api/saas-admin/seed-admin
 *
 * Idempotent endpoint that ensures the super_admin account exists with
 * the correct password hash (Admin SDK bcrypt, NOT pgcrypto's crypt()).
 *
 * The SQL migration (014_seed_super_admin.sql) creates the auth user with
 * pgcrypto's crypt() which produces a hash the Supabase Auth Go verifier
 * cannot verify. This route resets the password via Admin API to fix that.
 *
 * Called automatically from the login page on first mount.
 * Protected: only works in non-production OR with ADMIN_SEED_SECRET env var.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const envSecret = process.env.ADMIN_SEED_SECRET;

  if (envSecret && secret !== envSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!envSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Set ADMIN_SEED_SECRET in env for production use' },
      { status: 403 }
    );
  }

  try {
    const adminClient = createAdminClient();

    // Find the user by looking up profiles (faster than listing all auth users)
    const { data: profileRow } = await adminClient
      .from('profiles')
      .select('user_id, system_role')
      .eq('email', ADMIN_EMAIL)
      .maybeSingle();

    if (profileRow?.user_id) {
      // User exists — reset password via Admin SDK to produce correct hash
      const { error } = await adminClient.auth.admin.updateUserById(profileRow.user_id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Ensure super_admin role is set
      if (profileRow.system_role !== 'super_admin') {
        await adminClient
          .from('profiles')
          .update({ system_role: 'super_admin' })
          .eq('user_id', profileRow.user_id);
      }

      return NextResponse.json({
        success: true,
        action: 'password_reset',
        email: ADMIN_EMAIL,
      });
    }

    // No user found — create from scratch via Admin SDK
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Daylink Admin' },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    const userId = newUser.user.id;

    // Set system_role after trigger creates the profile
    await new Promise((r) => setTimeout(r, 300)); // brief wait for DB trigger
    await adminClient
      .from('profiles')
      .update({ system_role: 'super_admin', full_name: 'Daylink Admin' })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      action: 'created',
      email: ADMIN_EMAIL,
    });
  } catch (err: any) {
    console.error('[seed-admin]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
