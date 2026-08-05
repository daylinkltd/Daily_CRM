import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postKhataCollection } from "@/lib/accounting/posting";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  try {
    // 1. Fetch contacts
    const { data: contacts, error: cErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const contactIds = (contacts || []).map((c) => c.id);

    // 2. Fetch Khata ledgers for these contacts
    const khataMap: Record<string, any> = {};
    if (contactIds.length > 0) {
      const { data: khataRecords } = await supabase
        .from("commerce_customer_khata")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("contact_id", contactIds);

      (khataRecords || []).forEach((k) => {
        khataMap[k.contact_id] = k;
      });
    }

    const customerLedgers = (contacts || []).map((c) => {
      const name = c.name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed Customer";
      const khata = khataMap[c.id] || null;
      return {
        ...c,
        displayName: name,
        credit_limit: khata ? Number(khata.credit_limit || 50000) : 50000,
        outstanding_balance: khata ? Number(khata.outstanding_balance || 0) : 0,
        credit_days: khata ? Number(khata.credit_days || 30) : 30,
        khata_id: khata?.id || null,
      };
    });

    return NextResponse.json({ customers: customerLedgers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load customer ledger" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action = "CREATE_CUSTOMER", workspace_id } = body;

  if (!workspace_id) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  // Action 1: Create New Customer Contact
  if (action === "CREATE_CUSTOMER") {
    const { first_name, last_name, phone_number, email, company, credit_limit = 50000 } = body;

    if (!first_name && !phone_number) {
      return NextResponse.json({ error: "Customer Name or Phone is required" }, { status: 400 });
    }

    const fullName = [first_name, last_name].filter(Boolean).join(" ") || "Retail Customer";

    // Insert into contacts
    const { data: contact, error: cErr } = await supabase
      .from("contacts")
      .insert({
        workspace_id,
        user_id: user.id,
        name: fullName,
        phone: phone_number || null,
        email: email || null,
        company: company || null,
      })
      .select()
      .single();

    if (cErr || !contact) {
      return NextResponse.json({ error: cErr?.message || "Failed to create contact" }, { status: 500 });
    }

    // Initialize Khata Record
    await supabase.from("commerce_customer_khata").insert({
      workspace_id,
      contact_id: contact.id,
      credit_limit: Number(credit_limit || 50000),
      outstanding_balance: 0,
      credit_days: 30,
    });

    return NextResponse.json({ success: true, customer: contact });
  }

  // Action 2: Record Payment Collection (Udhar Recovery)
  if (action === "RECORD_PAYMENT") {
    const { contact_id, payment_amount, payment_mode = "CASH", notes = "" } = body;

    if (!contact_id || !payment_amount) {
      return NextResponse.json({ error: "Contact ID and Payment Amount are required" }, { status: 400 });
    }

    const payAmt = Number(payment_amount);
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
      return NextResponse.json({ error: "Payment amount must be a positive number" }, { status: 400 });
    }

    // Fetch existing khata
    const { data: existingKhata } = await supabase
      .from("commerce_customer_khata")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("contact_id", contact_id)
      .maybeSingle();

    const currentBal = Number(existingKhata?.outstanding_balance || 0);

    // Collecting more than is owed is almost certainly a typo — and
    // silently clamping it (the old behaviour) made the books disagree
    // with the khata forever.
    if (payAmt > currentBal + 0.005) {
      return NextResponse.json(
        { error: `Payment ${payAmt} exceeds outstanding balance ${currentBal}` },
        { status: 400 },
      );
    }

    // Post the balanced voucher FIRST: DR Cash/Bank, CR Customer
    // Khata. If posting fails, the balance is left untouched — the
    // books and the khata never diverge. (The old code wrote a
    // header with no lines: an orphan voucher with no amount, which
    // migration 075 deletes.)
    let posting;
    try {
      posting = await postKhataCollection(supabase, {
        workspace_id,
        contact_id,
        amount: payAmt,
        payment_mode,
        narration: notes || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post collection voucher";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const newBal = currentBal - payAmt;
    if (existingKhata) {
      await supabase
        .from("commerce_customer_khata")
        .update({ outstanding_balance: newBal })
        .eq("id", existingKhata.id);
    } else {
      await supabase.from("commerce_customer_khata").insert({
        workspace_id,
        contact_id,
        outstanding_balance: 0,
      });
    }

    return NextResponse.json({
      success: true,
      new_balance: newBal,
      voucher: { id: posting.journal_entry_id, voucher_number: posting.voucher_number },
    });
  }

  // Action 3: Update Credit Limit
  if (action === "UPDATE_LIMIT") {
    const { contact_id, credit_limit, credit_days } = body;

    const { data: existing } = await supabase
      .from("commerce_customer_khata")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("contact_id", contact_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("commerce_customer_khata")
        .update({
          credit_limit: Number(credit_limit || 50000),
          credit_days: Number(credit_days || 30),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("commerce_customer_khata").insert({
        workspace_id,
        contact_id,
        credit_limit: Number(credit_limit || 50000),
        credit_days: Number(credit_days || 30),
        outstanding_balance: 0,
      });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
