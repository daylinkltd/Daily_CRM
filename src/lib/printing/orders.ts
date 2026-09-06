// ============================================================
// Printing-press job orders — pure helpers shared by the list page,
// the create form and the job detail. No I/O here.
//
// The status flow mirrors the printing-press billing flow chart:
//   ENQUIRY → QUOTED → APPROVED → IN_PRODUCTION → COMPLETED
//   → INVOICED → DELIVERED   (CANCELLED possible until production)
// with IN_PRODUCTION sub-staged DESIGN → PRINT → FINISHING.
// ============================================================

export const ORDER_STATUSES = [
  "ENQUIRY",
  "QUOTED",
  "APPROVED",
  "IN_PRODUCTION",
  "COMPLETED",
  "INVOICED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRODUCTION_STAGES = ["DESIGN", "PRINT", "FINISHING"] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

/** The forward path a job walks (CANCELLED is a side exit, not a step). */
export const STATUS_FLOW: readonly OrderStatus[] = [
  "ENQUIRY",
  "QUOTED",
  "APPROVED",
  "IN_PRODUCTION",
  "COMPLETED",
  "INVOICED",
  "DELIVERED",
];

export const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  ENQUIRY: { label: "Enquiry", className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  QUOTED: { label: "Quoted", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  APPROVED: { label: "Approved", className: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  IN_PRODUCTION: { label: "In production", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  COMPLETED: { label: "Completed", className: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  INVOICED: { label: "Invoiced", className: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  CANCELLED: { label: "Cancelled", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export const STAGE_LABELS: Record<ProductionStage, string> = {
  DESIGN: "Design",
  PRINT: "Print",
  FINISHING: "Finishing",
};

/** A job can only be cancelled before money and materials are sunk. */
export function isCancellable(status: OrderStatus): boolean {
  return status === "ENQUIRY" || status === "QUOTED" || status === "APPROVED";
}

/** The next production stage, or null when FINISHING is done. */
export function nextStage(stage: ProductionStage | null): ProductionStage | null {
  if (!stage) return "DESIGN";
  const i = PRODUCTION_STAGES.indexOf(stage);
  return i >= 0 && i < PRODUCTION_STAGES.length - 1 ? PRODUCTION_STAGES[i + 1] : null;
}

export interface OrderItemInput {
  quantity: number;
  rate: number;
}

/** Line amount + GST-exclusive totals, rounded to paise at each step the
 *  way the invoice engine does (per line, then per aggregate). */
export function computeOrderTotals(items: OrderItemInput[], taxRate: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = r2(
    items.reduce((s, it) => s + r2((Number(it.quantity) || 0) * (Number(it.rate) || 0)), 0),
  );
  const taxAmount = r2((subtotal * (Number(taxRate) || 0)) / 100);
  return { subtotal, taxAmount, grandTotal: r2(subtotal + taxAmount) };
}

/** One line describing an item's printing attributes, for tables and
 *  invoice descriptions: "3.5 x 2 inch · Art Card 300 GSM · 4/4 · Matte
 *  Lamination". Empty attributes vanish rather than leaving separators. */
export function attributeSummary(item: {
  size?: string | null;
  paper_type?: string | null;
  gsm?: string | null;
  print_type?: string | null;
  color_mode?: string | null;
  finishing?: string | null;
}): string {
  const paper = [item.paper_type, item.gsm ? `${item.gsm} GSM` : null]
    .filter(Boolean)
    .join(" ");
  return [item.size, paper || null, item.print_type, item.color_mode, item.finishing]
    .filter((v) => v && String(v).trim())
    .join(" · ");
}
