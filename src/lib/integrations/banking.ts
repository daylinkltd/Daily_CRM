// ============================================================
// Banking / core-accounting connector.
//
// Payroll is calculated here; the salary expense has to appear in the
// customer's statutory books, which live in their core banking system
// (NDH). Rather than duplicating a chart of accounts in this app, we
// push the cycle TOTALS and let that system post the voucher.
//
// What crosses the boundary: gross salary, the statutory deduction
// breakdown, and the net payable. No employee names, codes or
// individual salaries — the payslips stay here.
//
// Two pushes per cycle, matching how payroll actually works:
//
//   processed -> DR Salary Expense (gross)
//                CR PF / PT / TDS payable, CR Staff Advance
//                CR Salaries Payable (net)
//
//   paid      -> DR Salaries Payable
//                CR Cash / Bank
//
// The remote side maps each ROLE below to one of its own ledgers, so a
// customer's chart of accounts is never hardcoded here.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/whatsapp/encryption";

export const BANKING_PROVIDER = "banking";

/** Deduction roles the banking system understands. */
export type DeductionRole =
  | "PF_PAYABLE"
  | "ESI_PAYABLE"
  | "TDS_PAYABLE"
  | "PROFESSIONAL_TAX_PAYABLE"
  | "STAFF_ADVANCE";

export interface BankingConfig {
  /** Base URL of the banking system, e.g. https://books.example.com */
  baseUrl: string;
  /** Inbound token issued by the banking system's Integrations screen. */
  token: string;
  /** Workspace id the banking system expects to see (this workspace). */
  remoteWorkspaceId: string;
  /** Cash or bank as the payout source for the "paid" posting. */
  paymentRole: "CASH" | "BANK";
  enabled: boolean;
}

export interface PayrollTotals {
  grossSalary: number;
  netPayable: number;
  deductions: Array<{ role: DeductionRole; amount: number; label?: string }>;
}

export type PushOutcome =
  | { status: "sent"; voucherNo?: string; httpStatus: number }
  | { status: "duplicate"; voucherNo?: string; httpStatus: number }
  | { status: "failed"; httpStatus?: number; error: string }
  | { status: "skipped"; reason: string };

/** Round to paise; float drift here would fail the remote balance check. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Load and decrypt the banking configuration for a workspace.
 * Returns null when the workspace has not connected a banking system.
 */
export async function getBankingConfig(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<BankingConfig | null> {
  const { data } = await supabase
    .from("workspace_integrations")
    .select("settings, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", BANKING_PROVIDER)
    .maybeSingle();

  if (!data) return null;

  const settings = (data.settings || {}) as Record<string, string>;
  if (!settings.base_url || !settings.encrypted_token || !settings.remote_workspace_id) {
    return null;
  }

  let token: string;
  try {
    token = decrypt(settings.encrypted_token);
  } catch {
    // A token that cannot be decrypted is unusable; treat as unconfigured
    // rather than sending garbage at the customer's ledger.
    return null;
  }

  return {
    baseUrl: settings.base_url.replace(/\/+$/, ""),
    token,
    remoteWorkspaceId: settings.remote_workspace_id,
    paymentRole: settings.payment_role === "CASH" ? "CASH" : "BANK",
    enabled: data.status === "active",
  };
}

/**
 * Derive the totals to post from a cycle's payslips.
 *
 * The gross expense and each statutory deduction are sent separately.
 * Sending only the net would understate salary cost in the P&L and hide
 * the PF/TDS/PT liabilities, which a statutory filing needs to show.
 */
export function totalsFromPayslips(
  payslips: Array<{
    total_earnings: number | string;
    pf_deduction: number | string;
    professional_tax: number | string;
    tds_deduction: number | string;
    advance_deduction: number | string;
    net_payable: number | string;
  }>
): PayrollTotals {
  const sum = (pick: (slip: (typeof payslips)[number]) => number | string) =>
    round2(payslips.reduce((total, slip) => total + Number(pick(slip) || 0), 0));

  const deductions: PayrollTotals["deductions"] = [
    { role: "PF_PAYABLE" as const, amount: sum((s) => s.pf_deduction), label: "Provident Fund" },
    {
      role: "PROFESSIONAL_TAX_PAYABLE" as const,
      amount: sum((s) => s.professional_tax),
      label: "Professional Tax",
    },
    { role: "TDS_PAYABLE" as const, amount: sum((s) => s.tds_deduction), label: "TDS on Salary" },
    {
      role: "STAFF_ADVANCE" as const,
      // Recovering an advance credits the receivable rather than creating a liability.
      amount: sum((s) => s.advance_deduction),
      label: "Salary Advance Recovered",
    },
  ].filter((deduction) => deduction.amount > 0);

  return {
    grossSalary: sum((s) => s.total_earnings),
    netPayable: sum((s) => s.net_payable),
    deductions,
  };
}

interface PushArgs {
  workspaceId: string;
  cycleId: string;
  periodLabel: string;
  stage: "processed" | "paid";
  /** stage=processed */
  totals?: PayrollTotals;
  /** stage=paid */
  amount?: number;
}

/**
 * Send one payroll stage to the banking system and record the attempt.
 *
 * Never throws: payroll has already been written here, and a network
 * problem at the far end must not roll it back or surface as a payroll
 * failure. The outbox row keeps the attempt visible and retryable.
 */
export async function pushPayrollToBanking(
  supabase: SupabaseClient,
  args: PushArgs
): Promise<PushOutcome> {
  const config = await getBankingConfig(supabase, args.workspaceId);

  if (!config) {
    return { status: "skipped", reason: "No banking system connected" };
  }
  if (!config.enabled) {
    return { status: "skipped", reason: "Banking integration is paused" };
  }

  const body =
    args.stage === "processed"
      ? {
          workspaceId: config.remoteWorkspaceId,
          cycleId: args.cycleId,
          periodLabel: args.periodLabel,
          stage: "processed" as const,
          grossSalary: args.totals?.grossSalary ?? 0,
          deductions: args.totals?.deductions ?? [],
          netPayable: args.totals?.netPayable ?? 0,
        }
      : {
          workspaceId: config.remoteWorkspaceId,
          cycleId: args.cycleId,
          periodLabel: args.periodLabel,
          stage: "paid" as const,
          amount: round2(args.amount ?? 0),
          paymentRole: config.paymentRole,
        };

  // Record the attempt before sending, so a crash mid-request still
  // leaves a row an operator can retry.
  await supabase.from("banking_payroll_pushes").upsert(
    {
      workspace_id: args.workspaceId,
      payroll_cycle_id: args.cycleId,
      stage: args.stage,
      status: "pending",
      payload: body,
    },
    { onConflict: "payroll_cycle_id,stage" }
  );

  const outcome = await send(config, body);

  await supabase
    .from("banking_payroll_pushes")
    .update({
      status:
        outcome.status === "sent"
          ? "sent"
          : outcome.status === "duplicate"
            ? "duplicate"
            : "failed",
      voucher_no: "voucherNo" in outcome ? (outcome.voucherNo ?? null) : null,
      http_status: "httpStatus" in outcome ? (outcome.httpStatus ?? null) : null,
      last_error: outcome.status === "failed" ? outcome.error : null,
      attempts: await nextAttemptCount(supabase, args.cycleId, args.stage),
    })
    .eq("payroll_cycle_id", args.cycleId)
    .eq("stage", args.stage);

  return outcome;
}

async function nextAttemptCount(
  supabase: SupabaseClient,
  cycleId: string,
  stage: string
): Promise<number> {
  const { data } = await supabase
    .from("banking_payroll_pushes")
    .select("attempts")
    .eq("payroll_cycle_id", cycleId)
    .eq("stage", stage)
    .maybeSingle();
  return Number(data?.attempts ?? 0) + 1;
}

/** POST the voucher, mapping the remote response onto an outcome. */
async function send(config: BankingConfig, body: unknown): Promise<PushOutcome> {
  const url = `${config.baseUrl}/api/integrations/dailybuz/payroll`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let payload: { status?: string; voucherNo?: string; error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON response; fall through to the status-based error below.
    }

    if (!response.ok) {
      return {
        status: "failed",
        httpStatus: response.status,
        error: payload?.error || `Banking system returned ${response.status}`,
      };
    }

    // The remote side reports an already-applied stage as a duplicate. That is
    // a success: it means the voucher exists, so stop retrying.
    if (payload?.status === "duplicate") {
      return { status: "duplicate", voucherNo: payload?.voucherNo, httpStatus: response.status };
    }

    return { status: "sent", voucherNo: payload?.voucherNo, httpStatus: response.status };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Banking system did not respond within 15s"
          : err.message
        : "Could not reach the banking system";
    return { status: "failed", error };
  }
}
