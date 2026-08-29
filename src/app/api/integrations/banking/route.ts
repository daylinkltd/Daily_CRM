// ============================================================
// Banking / core-accounting integration settings.
//
// GET  ?workspace_id=…            — current config (never the token) + recent pushes
// POST { action: "save" }         — connect or update; token is encrypted at rest
// POST { action: "test" }         — verify the URL and token reach the banking system
// POST { action: "retry", cycleId, stage } — resend a failed payroll push
// POST { action: "disconnect" }   — pause the integration
// ============================================================

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/whatsapp/encryption";
import {
  BANKING_PROVIDER,
  getBankingConfig,
  pushPayrollToBanking,
  totalsFromPayslips,
} from "@/lib/integrations/banking";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function requireAdmin(supabase: SupabaseClient, workspaceId: string, userId: string) {
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) return null;
  return member;
}

export async function GET(request: Request) {
  try {
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

    const { data: config } = await supabase
      .from("workspace_integrations")
      .select("settings, status, last_error, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("provider", BANKING_PROVIDER)
      .maybeSingle();

    const { data: pushes } = await supabase
      .from("banking_payroll_pushes")
      .select("payroll_cycle_id, stage, status, voucher_no, last_error, attempts, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!config) {
      return NextResponse.json({ configured: false, pushes: pushes ?? [] });
    }

    const settings = (config.settings || {}) as Record<string, string>;

    return NextResponse.json({
      configured: true,
      provider: BANKING_PROVIDER,
      baseUrl: settings.base_url || "",
      remoteWorkspaceId: settings.remote_workspace_id || "",
      paymentRole: settings.payment_role || "BANK",
      // The token is write-only. Only whether one is set is exposed.
      tokenSet: Boolean(settings.encrypted_token),
      status: config.status || "inactive",
      lastError: config.last_error,
      updatedAt: config.updated_at,
      pushes: pushes ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load banking config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, action } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    // This writes into the customer's statutory ledger; admins only.
    const member = await requireAdmin(supabase, workspaceId, user.id);
    if (!member) {
      return NextResponse.json(
        { error: "Only workspace admins can configure the banking integration" },
        { status: 403 }
      );
    }

    if (action === "disconnect") {
      await supabase
        .from("workspace_integrations")
        .update({ status: "inactive", updated_by: member.id })
        .eq("workspace_id", workspaceId)
        .eq("provider", BANKING_PROVIDER);
      return NextResponse.json({ success: true, status: "inactive" });
    }

    if (action === "retry") {
      return retryPush(supabase, workspaceId, body.cycleId, body.stage);
    }

    if (action === "save" || action === "test") {
      const { baseUrl, token, remoteWorkspaceId, paymentRole } = body;

      if (!baseUrl?.trim() || !remoteWorkspaceId?.trim()) {
        return NextResponse.json(
          { error: "Banking system URL and workspace ID are required" },
          { status: 400 }
        );
      }

      let normalisedUrl: string;
      try {
        const parsed = new URL(baseUrl.trim());
        if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
          return NextResponse.json(
            { error: "The banking system URL must use https" },
            { status: 400 }
          );
        }
        normalisedUrl = `${parsed.origin}`;
      } catch {
        return NextResponse.json({ error: "Banking system URL is not valid" }, { status: 400 });
      }

      // Existing row lets an admin update the URL without re-entering the token.
      const { data: existing } = await supabase
        .from("workspace_integrations")
        .select("settings")
        .eq("workspace_id", workspaceId)
        .eq("provider", BANKING_PROVIDER)
        .maybeSingle();

      const existingSettings = (existing?.settings || {}) as Record<string, string>;
      const encryptedToken = token?.trim()
        ? encrypt(token.trim())
        : existingSettings.encrypted_token;

      if (!encryptedToken) {
        return NextResponse.json(
          { error: "Paste the token issued by the banking system's Integrations screen" },
          { status: 400 }
        );
      }

      const settings = {
        base_url: normalisedUrl,
        remote_workspace_id: remoteWorkspaceId.trim(),
        payment_role: paymentRole === "CASH" ? "CASH" : "BANK",
        encrypted_token: encryptedToken,
      };

      const { error: upsertError } = await supabase.from("workspace_integrations").upsert(
        {
          workspace_id: workspaceId,
          provider: BANKING_PROVIDER,
          status: "active",
          settings,
          last_error: null,
          updated_by: member.id,
        },
        { onConflict: "workspace_id,provider" }
      );

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }

      if (action === "test") {
        const result = await testConnection(supabase, workspaceId);
        if (!result.ok) {
          await supabase
            .from("workspace_integrations")
            .update({ status: "error", last_error: result.error })
            .eq("workspace_id", workspaceId)
            .eq("provider", BANKING_PROVIDER);
        }
        return NextResponse.json({ success: result.ok, ...result });
      }

      return NextResponse.json({ success: true, status: "active" });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save banking config" },
      { status: 500 }
    );
  }
}

/**
 * Confirm the URL and token work, without writing anything to the ledger.
 *
 * A deliberately invalid payload is sent: a good token is rejected with 422
 * (the figures do not reconcile), a bad token with 401. That distinguishes
 * "reachable and authenticated" from "wrong credentials" while guaranteeing no
 * voucher can be created by a connection test.
 */
async function testConnection(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ ok: boolean; error?: string; detail?: string }> {
  const config = await getBankingConfig(supabase, workspaceId);
  if (!config) return { ok: false, error: "Configuration could not be read back" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${config.baseUrl}/api/integrations/dailybuz/payroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      // No cycleId: the far end rejects it at validation, before any posting.
      body: JSON.stringify({
        workspaceId: config.remoteWorkspaceId,
        stage: "processed",
        periodLabel: "connection test",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 401) {
      return { ok: false, error: "The banking system rejected the token" };
    }
    if (response.status === 403) {
      return {
        ok: false,
        error: "The token is valid but belongs to a different workspace ID",
      };
    }
    if (response.status === 404) {
      return { ok: false, error: "No payroll endpoint at that URL — check the address" };
    }

    // 400/422 means authenticated and validating — the only responses that
    // actually prove the credentials work.
    if (response.status === 400 || response.status === 422) {
      return { ok: true, detail: "Connected. The banking system accepted the credentials." };
    }

    if (response.status === 503) {
      return {
        ok: false,
        error: "The banking system is reachable but its database is down — try again shortly",
      };
    }

    // Anything else, 5xx included, has not proven the credentials work. Calling
    // it "connected" would hide a broken setup until payroll day.
    return {
      ok: false,
      error: `Unexpected response from the banking system (HTTP ${response.status})`,
    };
  } catch (err) {
    const error =
      err instanceof Error && err.name === "AbortError"
        ? "The banking system did not respond within 15s"
        : "Could not reach the banking system";
    return { ok: false, error };
  }
}

/** Resend a payroll stage that previously failed. */
async function retryPush(
  supabase: SupabaseClient,
  workspaceId: string,
  cycleId: string,
  stage: "processed" | "paid"
) {
  if (!cycleId || (stage !== "processed" && stage !== "paid")) {
    return NextResponse.json(
      { error: "cycleId and a stage of 'processed' or 'paid' are required" },
      { status: 400 }
    );
  }

  const { data: cycle } = await supabase
    .from("payroll_cycles")
    .select("id, workspace_id, month, year, total_payout")
    .eq("id", cycleId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!cycle) {
    return NextResponse.json({ error: "Payroll cycle not found" }, { status: 404 });
  }

  const periodLabel = `${MONTHS[cycle.month - 1]} ${cycle.year}`;

  if (stage === "paid") {
    const outcome = await pushPayrollToBanking(supabase, {
      workspaceId,
      cycleId,
      periodLabel,
      stage: "paid",
      amount: Number(cycle.total_payout),
    });
    return NextResponse.json({ success: outcome.status !== "failed", outcome });
  }

  // Re-derive the accrual totals from the stored payslips rather than trusting
  // the payload of the failed attempt.
  const { data: payslips } = await supabase
    .from("payslips")
    .select(
      "total_earnings, pf_deduction, professional_tax, tds_deduction, advance_deduction, net_payable"
    )
    .eq("payroll_cycle_id", cycleId);

  if (!payslips || payslips.length === 0) {
    return NextResponse.json(
      { error: "This cycle has no payslips to post" },
      { status: 400 }
    );
  }

  const outcome = await pushPayrollToBanking(supabase, {
    workspaceId,
    cycleId,
    periodLabel,
    stage: "processed",
    totals: totalsFromPayslips(payslips),
  });

  return NextResponse.json({ success: outcome.status !== "failed", outcome });
}
