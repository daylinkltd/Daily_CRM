import { requireApiKey } from '@/lib/auth/api-context';
import { ok, toApiErrorResponse, badRequest } from '@/lib/api/v1/respond';
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils';

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');

    let body;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }

    const { phone, name, email, company } = body;

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw badRequest('Phone number is required');
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      throw badRequest('Invalid phone number: must contain digits');
    }

    const suffix = normalized.length >= 8 ? normalized.slice(-8) : normalized;

    const { data: contacts, error: searchError } = await ctx.supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', ctx.accountId)
      .like('phone', `%${suffix}`);

    if (searchError) {
      throw searchError;
    }

    const existing = contacts?.find((c: any) => phonesMatch(c.phone, phone)) ?? null;

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

      return ok({ contact, isNew: false });
    } else {
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

      return ok({ contact, isNew: true });
    }
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
