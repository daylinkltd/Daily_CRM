// Shared money math for commercials — used by both the create and
// update/convert API routes so totals can never diverge.

export interface CommercialItemInput {
  name: string;
  description?: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  discount_percent?: number;
}

export function computeCommercialTotals(items: CommercialItemInput[]) {
  let total_cost = 0;
  let total_value = 0;
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    total_cost += Math.round(qty * (Number(it.unit_cost) || 0) * 100) / 100;
    total_value +=
      Math.round(
        qty * (Number(it.unit_price) || 0) * (1 - (Number(it.discount_percent) || 0) / 100) * 100
      ) / 100;
  }
  return { total_cost, total_value };
}

export function normalizeCommercialItems(rawItems: unknown): CommercialItemInput[] | null {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;
  const items = rawItems.map((it: CommercialItemInput) => ({
    name: String(it.name || "").trim(),
    description: it.description ? String(it.description) : undefined,
    quantity: Number(it.quantity) || 0,
    unit_cost: Number(it.unit_cost) || 0,
    unit_price: Number(it.unit_price) || 0,
    discount_percent: Number(it.discount_percent) || 0,
  }));
  if (items.some((it) => !it.name || it.quantity < 0 || it.unit_cost < 0 || it.unit_price < 0)) {
    return null;
  }
  return items;
}
