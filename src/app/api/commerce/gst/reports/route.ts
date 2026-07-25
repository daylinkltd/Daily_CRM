import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");
  const type = searchParams.get("type") || "dashboard";

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  // Fetch all GST Ledger entries for this workspace
  const { data: ledgers, error } = await supabase
    .from("commerce_gst_ledgers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "ACTIVE")
    .order("invoice_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = ledgers || [];

  if (type === "gstr1") {
    const gstr1Entries = entries.filter((e) => e.ledger_type === "OUTPUT");
    return NextResponse.json({ data: gstr1Entries });
  }

  if (type === "gstr2b") {
    const gstr2bEntries = entries.filter((e) => e.ledger_type === "INPUT");
    return NextResponse.json({ data: gstr2bEntries });
  }

  // Calculate Dashboard Aggregations
  let totalTaxableSales = 0;
  let totalOutputGst = 0;
  let totalInputGst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  entries.forEach((e) => {
    if (e.ledger_type === "OUTPUT") {
      totalTaxableSales += Number(e.taxable_amount || 0);
      totalOutputGst += Number(e.total_gst || 0);
      totalCgst += Number(e.cgst_amount || 0);
      totalSgst += Number(e.sgst_amount || 0);
      totalIgst += Number(e.igst_amount || 0);
    } else if (e.ledger_type === "INPUT") {
      totalInputGst += Number(e.total_gst || 0);
    }
  });

  const netGstLiability = Math.max(0, totalOutputGst - totalInputGst);

  return NextResponse.json({
    summary: {
      totalTaxableSales,
      totalOutputGst,
      totalInputGst,
      netGstLiability,
      totalCgst,
      totalSgst,
      totalIgst,
      activeInvoiceCount: entries.length,
    },
    entries,
  });
}
