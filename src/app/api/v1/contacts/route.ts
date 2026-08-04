import { requireApiKey } from '@/lib/auth/api-context';
import { ok, toApiErrorResponse, badRequest } from '@/lib/api/v1/respond';
import { listResource } from '@/lib/api/v1/generic-crud';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { findContactByPhoneDigits } from '@/lib/contacts/find-by-phone';
import { resolveImportTagIds, assignImportedContactTags } from '@/lib/contacts/resolve-import-tags';

/**
 * Listing needs no special handling, but this static route shadows the
 * dynamic `/api/v1/[resource]` segment — so without an explicit GET here,
 * `contacts:read` would be grantable while the endpoint answered 405.
 */
export async function GET(request: Request) {
  return listResource(request, 'contacts');
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');

    let body;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }

    const { phone, name, email, company, tags = ['leadcrapper'] } = body;

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw badRequest('Phone number is required');
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      throw badRequest('Invalid phone number: must contain digits');
    }

    // Resolve a valid user_id to use for creating tags or contacts if needed
    let userId = ctx.createdBy;
    if (!userId) {
      const { data: member } = await ctx.supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', ctx.accountId)
        .limit(1)
        .maybeSingle();
      userId = member?.user_id || null;
    }
    if (!userId) {
      throw badRequest('Could not attribute contact creation to any user in the workspace');
    }

    // Digit-normalized match: an exact-string or raw-suffix comparison
    // missed the same number stored in another format and created a
    // duplicate contact (see src/lib/contacts/find-by-phone.ts).
    const existing = await findContactByPhoneDigits(
      ctx.supabase,
      ctx.accountId,
      phone,
    );

    if (existing) {
      const { data: contact, error: updateError } = await ctx.supabase
        .from('contacts')
        .update({
          name: name?.trim() || existing.name,
          email: email?.trim() || existing.email,
          company: company?.trim() || existing.company,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      if (tags && Array.isArray(tags) && tags.length > 0) {
        const { tagIdByKey } = await resolveImportTagIds(ctx.supabase, {
          accountId: ctx.accountId,
          userId,
          tagNames: tags,
          canCreateTags: true,
        });
        await assignImportedContactTags(
          ctx.supabase,
          [{ contactId: contact.id, tagNames: tags }],
          tagIdByKey
        );
      }

      return ok({ contact, isNew: false });
    } else {
      const { data: contact, error: insertError } = await ctx.supabase
        .from('contacts')
        .insert({
          user_id: userId,
          workspace_id: ctx.accountId,
          name: name?.trim() || null,
          phone: phone.trim(),
          email: email?.trim() || null,
          company: company?.trim() || null,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (tags && Array.isArray(tags) && tags.length > 0) {
        const { tagIdByKey } = await resolveImportTagIds(ctx.supabase, {
          accountId: ctx.accountId,
          userId,
          tagNames: tags,
          canCreateTags: true,
        });
        await assignImportedContactTags(
          ctx.supabase,
          [{ contactId: contact.id, tagNames: tags }],
          tagIdByKey
        );
      }

      return ok({ contact, isNew: true });
    }
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
