// ============================================================
// Payment-reminder context for the Receivables (Khata) page.
//
// The reminder modal used to hit a non-existent endpoint to guess
// template status (its `.catch()` defaulted to "approved", so the
// green "delivery active" banner was always shown), and posted a
// payload /api/whatsapp/send rejects — it needs a `conversation_id`,
// not a phone number. So no reminder could ever be delivered.
//
// This route resolves everything the modal needs, server-side:
//   - the contact's phone
//   - a conversation for that contact (found or created), which is
//     what the inbox and the send route key off
//   - whether the 24-hour customer-service window is open, using the
//     same rule as the inbox (latest message with
//     sender_type = 'customer', expired at 24h)
//   - the real status of the reminder template from message_templates
//
// The caller then sends through /api/whatsapp/send — free text while
// the window is open, otherwise the approved template. Reusing that
// route keeps its rate limiting, phone sanitising, message logging
// and Meta error hints instead of duplicating them here.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** The template used to re-engage outside the 24-hour window. */
export const REMINDER_TEMPLATE_NAME = "payment_reminder";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspace_id, contact_id } = await request.json();
  if (!workspace_id || !contact_id) {
    return NextResponse.json(
      { error: "workspace_id and contact_id are required" },
      { status: 400 },
    );
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  // Contact must belong to this workspace — prevents reaching another
  // tenant's contact by id.
  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("id", contact_id)
    .eq("workspace_id", workspace_id)
    .single();
  if (contactErr || !contact) {
    return NextResponse.json({ error: "Customer not found in this workspace" }, { status: 404 });
  }
  if (!contact.phone) {
    return NextResponse.json(
      { error: `${contact.name || "This customer"} has no phone number on record` },
      { status: 400 },
    );
  }

  // Find the existing conversation, or open one so the reminder lands
  // in the inbox thread like any other message.
  let conversationId: string | null = null;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("contact_id", contact_id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created, error: convErr } = await supabase
      .from("conversations")
      .insert({
        workspace_id,
        contact_id,
        user_id: user.id,
        status: "open",
      })
      .select("id")
      .single();
    if (convErr || !created) {
      return NextResponse.json(
        { error: `Could not open a conversation for this customer: ${convErr?.message}` },
        { status: 500 },
      );
    }
    conversationId = created.id;
  }

  // 24-hour customer-service window: same rule as the inbox composer.
  // A brand-new conversation has no customer message, so the window is
  // closed and a template is required — which is the normal case for
  // a receivables reminder.
  const { data: lastCustomerMsg } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("sender_type", "customer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let windowOpen = false;
  let hoursRemaining = 0;
  if (lastCustomerMsg?.created_at) {
    const hoursSince =
      (Date.now() - new Date(lastCustomerMsg.created_at).getTime()) / 3_600_000;
    windowOpen = hoursSince < 24;
    hoursRemaining = windowOpen ? Math.max(0, 24 - hoursSince) : 0;
  }

  // Real template status, read from the table the sync job writes
  // Meta's verbatim status into.
  const { data: template } = await supabase
    .from("message_templates")
    .select("name, language, status, body_text, footer_text")
    .eq("workspace_id", workspace_id)
    .eq("name", REMINDER_TEMPLATE_NAME)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    conversation_id: conversationId,
    contact: { id: contact.id, name: contact.name, phone: contact.phone },
    window_open: windowOpen,
    hours_remaining: Math.floor(hoursRemaining),
    template: template
      ? {
          name: template.name,
          language: template.language,
          status: template.status,
          approved: template.status === "APPROVED",
          body_text: template.body_text,
          footer_text: template.footer_text,
        }
      : null,
  });
}
