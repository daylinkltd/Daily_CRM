import type { SupabaseClient } from '@supabase/supabase-js'
import { isSamePhoneNumber, normalizePhone } from '@/lib/whatsapp/phone-utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
type ContactRow = any

/**
 * Resolve a phone number to an existing contact, comparing DIGITS ONLY.
 *
 * Why this exists: the same number gets stored in several shapes —
 * "+91 9902319132" (manual entry), "9902319132" (CSV import, no country
 * code), "919902319132" (WhatsApp wa_id). Callers that compared the raw
 * string (`.eq('phone', sanitized)`) or a raw-suffix LIKE therefore
 * missed existing rows and created duplicate contacts, which split one
 * customer's history across two chats.
 *
 * Uses the digit-normalized SQL helper from migration 070 when it's
 * available, and falls back to a raw-suffix LIKE otherwise. Both paths
 * return exact digit matches first, then the OLDEST match, so repeated
 * lookups for one number always resolve to the same contact.
 */
export async function findContactByPhoneDigits(
  client: SupabaseClient,
  workspaceId: string | null,
  phone: string,
): Promise<ContactRow | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const rpc = await client.rpc('find_contacts_by_phone_digits', {
    p_workspace_id: workspaceId || null,
    p_digits: normalized,
  })
  if (!rpc.error) {
    return (rpc.data as ContactRow[] | null)?.[0] ?? null
  }

  // Fallback: raw-suffix LIKE, oldest first for determinism.
  const suffix = normalized.length >= 8 ? normalized.slice(-8) : normalized
  let query = client.from('contacts').select('*')
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  const { data, error } = await query
    .like('phone', `%${suffix}`)
    .order('created_at', { ascending: true })

  if (error || !data) return null
  const rows = data as ContactRow[]
  return (
    rows.find((c) => normalizePhone(c.phone) === normalized) ??
    rows.find((c) => isSamePhoneNumber(c.phone, phone)) ??
    null
  )
}
