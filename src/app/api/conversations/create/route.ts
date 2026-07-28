import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils'
import { findContactByPhoneDigits } from '@/lib/contacts/find-by-phone'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, contact_id, name, phone, email } = body

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    // Verify workspace membership
    const { data: member, error: memberErr } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a member of this workspace' },
        { status: 403 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetContact: any = null

    if (contact_id) {
      // Fetch existing contact
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contact_id)
        .eq('workspace_id', workspace_id)
        .single()

      if (contactErr || !contact) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      targetContact = contact
    } else if (phone) {
      const sanitized = sanitizePhoneForMeta(phone)
      if (!isValidE164(sanitized)) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Include country code (e.g. +919876543210 or +14155552671).' },
          { status: 400 }
        )
      }

      // Check if contact already exists in workspace, comparing digits
      // only. An exact string match missed the same number stored in a
      // different shape ("+91 9902319132" vs "919902319132") and created
      // a duplicate contact, splitting the customer's history in two.
      const existing = await findContactByPhoneDigits(
        supabase,
        workspace_id,
        sanitized,
      )

      if (existing) {
        targetContact = existing
      } else {
        // Create new contact
        const { data: newContact, error: createErr } = await supabase
          .from('contacts')
          .insert({
            workspace_id,
            user_id: user.id,
            name: (name && name.trim()) ? name.trim() : sanitized,
            phone: sanitized,
            email: (email && email.trim()) ? email.trim() : null,
          })
          .select()
          .single()

        if (createErr || !newContact) {
          console.error('Failed to create contact:', createErr)
          return NextResponse.json(
            { error: `Failed to create contact: ${createErr?.message || 'unknown error'}` },
            { status: 500 }
          )
        }
        targetContact = newContact
      }
    } else {
      return NextResponse.json(
        { error: 'Either contact_id or phone is required' },
        { status: 400 }
      )
    }

    // Check if conversation already exists for this contact in this workspace
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('workspace_id', workspace_id)
      .eq('contact_id', targetContact.id)
      .maybeSingle()

    if (existingConv) {
      return NextResponse.json({
        success: true,
        conversation: existingConv,
        isNew: false,
      })
    }

    // Create new conversation
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        workspace_id,
        user_id: user.id,
        contact_id: targetContact.id,
        status: 'open',
        bot_status: 'active',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .select('*, contact:contacts(*)')
      .single()

    if (convErr || !newConv) {
      console.error('Failed to create conversation:', convErr)
      return NextResponse.json(
        { error: `Failed to create conversation: ${convErr?.message || 'unknown error'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      conversation: newConv,
      isNew: true,
    })
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
