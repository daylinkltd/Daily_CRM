"use client";

import { useState } from "react";
import { TicketPercent, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  ConsoleCard,
  LoadingRow,
  useConsoleData,
} from "@/components/saas-admin/console-ui";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  percent_off: number;
  plan_id: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  valid_until: string | null;
  active: boolean;
  created_at: string;
  total_discount_paise: number;
}

export default function CouponsPage() {
  const { data, loading, error, reload } = useConsoleData<{ coupons: Coupon[] }>(
    "/api/saas-admin/coupons",
  );

  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [description, setDescription] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const create = async () => {
    setBusy("create");
    try {
      const res = await fetch("/api/saas-admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          percent_off: Number(percent),
          description: description || null,
          max_redemptions: maxRedemptions || null,
          valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      toast.success(`Coupon ${json.coupon.code} is live`);
      setCode(""); setPercent("10"); setDescription(""); setMaxRedemptions(""); setValidUntil("");
      setCreating(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(null);
    }
  };

  const setActive = async (c: Coupon, active: boolean) => {
    setBusy(c.id);
    try {
      const res = await fetch("/api/saas-admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, active }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <TicketPercent className="h-5 w-5 text-primary" /> Coupons
        </h1>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> New coupon
        </button>
      </div>

      {creating && (
        <ConsoleCard title="New coupon">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="LAUNCH25"
                maxLength={32}
                className="h-10 w-44 rounded-lg border border-border bg-card px-3 text-sm font-bold uppercase tracking-wide text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">% off</span>
              <input
                type="number"
                min={1}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="h-10 w-24 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Max uses (blank = unlimited)
              </span>
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                className="h-10 w-40 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Expires (optional)
              </span>
              <input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block flex-1 min-w-48">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Internal note
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who this is for"
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={busy === "create" || !code || !percent}
              onClick={create}
              className="h-10 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              Create
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Percent-only, applied to the pre-GST base; GST is recomputed on the discounted
            amount. Live coupons cannot be edited — deactivate and issue a new code, so
            orders in flight keep the terms they were created with.
          </p>
        </ConsoleCard>
      )}

      <ConsoleCard>
        {loading && !data ? (
          <LoadingRow label="Loading coupons…" />
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : (data?.coupons ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No coupons yet. Buyers enter codes on the billing page at checkout.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4">Code</th>
                  <th className="pb-2.5 pr-4">Discount</th>
                  <th className="pb-2.5 pr-4">Used</th>
                  <th className="pb-2.5 pr-4">Given away</th>
                  <th className="pb-2.5 pr-4">Expires</th>
                  <th className="pb-2.5 pr-4">Status</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.coupons ?? []).map((c) => {
                  const exhausted =
                    c.max_redemptions !== null && c.redeemed_count >= c.max_redemptions;
                  const expired = c.valid_until && new Date(c.valid_until) < new Date();
                  return (
                    <tr key={c.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 pr-4">
                        <code className="font-bold text-foreground">{c.code}</code>
                        {c.description && (
                          <span className="block text-[11px] text-muted-foreground">{c.description}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-foreground">{c.percent_off}%</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {c.redeemed_count}
                        {c.max_redemptions !== null && ` / ${c.max_redemptions}`}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        ₹{(c.total_discount_paise / 100).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-3 pr-4">
                        {!c.active ? (
                          <Badge tone="neutral">inactive</Badge>
                        ) : exhausted ? (
                          <Badge tone="warn">exhausted</Badge>
                        ) : expired ? (
                          <Badge tone="warn">expired</Badge>
                        ) : (
                          <Badge tone="good">live</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={busy === c.id}
                          onClick={() => setActive(c, !c.active)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          {c.active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ConsoleCard>
    </div>
  );
}
