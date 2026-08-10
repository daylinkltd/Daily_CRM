import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/whatsapp/encryption";
import { pushPayrollToBanking } from "./banking";

/**
 * Outcome mapping for every response the banking system can return.
 *
 * The rule that matters: a push must never throw. Payroll has already been
 * written when this runs, so a failure at the far end has to come back as a
 * recorded, retryable outcome rather than an exception that surfaces as a
 * payroll error.
 */

interface Write {
  table: string;
  op: "upsert" | "update";
  payload: Record<string, unknown>;
}

/**
 * Minimal Supabase stand-in that records what the connector writes.
 *
 * Cast through `unknown` at the boundary: SupabaseClient's real type is far
 * larger than the handful of calls the connector makes, and stubbing all of it
 * would obscure the test.
 */
function makeSupabase(settings: Record<string, string> | null) {
  const writes: Write[] = [];

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return this;
            },
            maybeSingle: async () =>
              table === "workspace_integrations"
                ? { data: settings ? { settings, status: "active" } : null }
                : { data: { attempts: 0 } },
          };
        },
        upsert: async (payload: Record<string, unknown>) => {
          writes.push({ table, op: "upsert", payload });
          return { error: null };
        },
        update(payload: Record<string, unknown>) {
          writes.push({ table, op: "update", payload });
          return {
            eq() {
              return this;
            },
            then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
          };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, writes };
}

const CONFIG = {
  base_url: "https://books.example.com",
  remote_workspace_id: "ws-1",
  payment_role: "BANK",
  encrypted_token: encrypt("test-token"),
};

const ARGS = {
  workspaceId: "ws-1",
  cycleId: "cycle-1",
  periodLabel: "August 2026",
  stage: "paid" as const,
  amount: 220000,
};

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pushPayrollToBanking", () => {
  it("skips cleanly when no banking system is connected", async () => {
    const { client } = makeSupabase(null);
    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome).toEqual({ status: "skipped", reason: "No banking system connected" });
  });

  it("reports a successful posting with the voucher number", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { success: true, status: "posted", voucherNo: "PAY202608000001" }));
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome).toMatchObject({ status: "sent", voucherNo: "PAY202608000001" });
  });

  it("treats an already-applied stage as a duplicate, not a failure", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { success: true, status: "duplicate", voucherNo: "PAY202608000001" }));
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome).toMatchObject({ status: "duplicate", voucherNo: "PAY202608000001" });
  });

  it("surfaces the remote error message on rejection", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(422, { success: false, error: "No ledger is mapped for: SALARIES_PAYABLE" })
    );
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome).toMatchObject({
      status: "failed",
      httpStatus: 422,
      error: "No ledger is mapped for: SALARIES_PAYABLE",
    });
  });

  it("fails retryably when the books are closed", async () => {
    vi.stubGlobal("fetch", mockFetch(409, { success: false, error: "The books are not open for posting." }));
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome).toMatchObject({ status: "failed", httpStatus: 409 });
  });

  it("fails retryably when the remote database is down", async () => {
    vi.stubGlobal("fetch", mockFetch(503, { success: false, error: "Service temporarily unavailable" }));
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome).toMatchObject({ status: "failed", httpStatus: 503 });
  });

  it("does not throw when the banking system is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome.status).toBe("failed");
  });

  it("records the attempt in the outbox before sending", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { status: "posted", voucherNo: "PAY1" }));
    const { client, writes } = makeSupabase(CONFIG);

    await pushPayrollToBanking(client, ARGS);

    const upsert = writes.find((w) => w.table === "banking_payroll_pushes" && w.op === "upsert");
    expect(upsert?.payload).toMatchObject({
      payroll_cycle_id: "cycle-1",
      stage: "paid",
      status: "pending",
    });
  });

  it("sends the payout stage with the configured payment source", async () => {
    const fetchMock = mockFetch(200, { status: "posted" });
    vi.stubGlobal("fetch", fetchMock);
    const { client } = makeSupabase({ ...CONFIG, payment_role: "CASH" });

    await pushPayrollToBanking(client, ARGS);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://books.example.com/api/integrations/dailybiz/payroll");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toMatchObject({
      workspaceId: "ws-1",
      cycleId: "cycle-1",
      stage: "paid",
      amount: 220000,
      paymentRole: "CASH",
    });
  });

  it("sends the accrual stage with the gross and the deduction breakdown", async () => {
    const fetchMock = mockFetch(200, { status: "posted" });
    vi.stubGlobal("fetch", fetchMock);
    const { client } = makeSupabase(CONFIG);

    await pushPayrollToBanking(client, {
      ...ARGS,
      stage: "processed",
      amount: undefined,
      totals: {
        grossSalary: 80000,
        netPayable: 74000,
        deductions: [{ role: "PF_PAYABLE", amount: 6000 }],
      },
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      stage: "processed",
      grossSalary: 80000,
      netPayable: 74000,
      deductions: [{ role: "PF_PAYABLE", amount: 6000 }],
    });
  });

  it("does not send an unusable token as plaintext when decryption fails", async () => {
    const fetchMock = mockFetch(200, { status: "posted" });
    vi.stubGlobal("fetch", fetchMock);
    const { client } = makeSupabase({ ...CONFIG, encrypted_token: "not-valid-ciphertext" });

    const outcome = await pushPayrollToBanking(client, ARGS);

    expect(outcome).toEqual({ status: "skipped", reason: "No banking system connected" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
