import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/whatsapp/encryption";
import { pushHrEventToNdh, drainHrSyncOutbox } from "./hrSync";

interface Write {
  table: string;
  op: "upsert" | "update";
  payload: Record<string, unknown>;
}

/**
 * Same shape as banking-push.test.ts's stand-in, extended with the
 * select().eq()...in()/order()/limit() chain drainHrSyncOutbox reads
 * pending rows through. Chainable methods all return `this` and the
 * builder resolves via `.then` so `await` works with or without a
 * terminal call, matching how the real supabase-js builder behaves.
 */
function makeSupabase(settings: Record<string, string> | null, pendingRows: Record<string, unknown>[] = []) {
  const writes: Write[] = [];

  function selectBuilder(table: string) {
    const builder = {
      eq() {
        return builder;
      },
      in() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      maybeSingle: async () =>
        table === "workspace_integrations"
          ? { data: settings ? { settings, status: "active" } : null }
          : { data: { attempts: 0 } },
      then(resolve: (value: { data: unknown; error: null }) => void) {
        resolve({ data: pendingRows, error: null });
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select() {
          return selectBuilder(table);
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

const EVENT = {
  workspaceId: "ws-1",
  eventType: "expense.approved" as const,
  entityTable: "expense_claims",
  entityId: "claim-1",
  payload: { id: "claim-1", status: "approved" },
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

describe("pushHrEventToNdh", () => {
  it("skips cleanly when no banking system is connected", async () => {
    const { client } = makeSupabase(null);
    const outcome = await pushHrEventToNdh(client, EVENT);

    expect(outcome).toEqual({ status: "skipped", reason: "No banking system connected" });
  });

  it("enqueues the outbox row before sending", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { status: "posted" }));
    const { client, writes } = makeSupabase(CONFIG);

    await pushHrEventToNdh(client, EVENT);

    const upsert = writes.find((w) => w.table === "hr_sync_pushes" && w.op === "upsert");
    expect(upsert?.payload).toMatchObject({
      event_type: "expense.approved",
      entity_table: "expense_claims",
      entity_id: "claim-1",
      status: "pending",
    });
  });

  it("signs the body with the same bearer token, and reports success", async () => {
    const fetchMock = mockFetch(200, { status: "posted" });
    vi.stubGlobal("fetch", fetchMock);
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushHrEventToNdh(client, EVENT);

    expect(outcome).toMatchObject({ status: "sent", httpStatus: 200 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://books.example.com/api/integrations/dailybiz/events");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["X-Signature-256"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(JSON.parse(init.body)).toMatchObject({
      workspaceId: "ws-1",
      eventType: "expense.approved",
      entityId: "claim-1",
    });
  });

  it("treats an already-applied event as a duplicate, not a failure", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { status: "duplicate" }));
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushHrEventToNdh(client, EVENT);

    expect(outcome).toMatchObject({ status: "duplicate" });
  });

  it("does not throw when NDH is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { client } = makeSupabase(CONFIG);

    const outcome = await pushHrEventToNdh(client, EVENT);

    expect(outcome.status).toBe("failed");
  });
});

describe("drainHrSyncOutbox", () => {
  it("sends every pending row and tallies the outcomes", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { status: "posted" }));
    const { client } = makeSupabase(CONFIG, [
      { event_type: "employee.created", entity_table: "employee_profiles", entity_id: "e1", payload: {} },
      { event_type: "attendance.punched", entity_table: "attendance", entity_id: "a1", payload: {} },
    ]);

    const tally = await drainHrSyncOutbox(client, "ws-1");

    expect(tally).toEqual({ sent: 2, duplicate: 0, failed: 0, skipped: 0 });
  });

  it("skips the whole drain when no banking system is connected", async () => {
    const { client } = makeSupabase(null, [
      { event_type: "employee.created", entity_table: "employee_profiles", entity_id: "e1", payload: {} },
    ]);

    const tally = await drainHrSyncOutbox(client, "ws-1");

    expect(tally).toEqual({ sent: 0, duplicate: 0, failed: 0, skipped: 1 });
  });

  it("counts a failed send without throwing", async () => {
    vi.stubGlobal("fetch", mockFetch(503, { error: "down" }));
    const { client } = makeSupabase(CONFIG, [
      { event_type: "leave.requested", entity_table: "leave_requests", entity_id: "l1", payload: {} },
    ]);

    const tally = await drainHrSyncOutbox(client, "ws-1");

    expect(tally).toEqual({ sent: 0, duplicate: 0, failed: 1, skipped: 0 });
  });
});
