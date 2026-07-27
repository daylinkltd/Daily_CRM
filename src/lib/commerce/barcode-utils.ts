/**
 * Defensive Scanner Input Extraction
 * Cleanly strips carriage returns, JSON brackets, or tag placeholders from barcode scanners.
 */
export function extractCleanSku(input: string): string {
  if (!input) return "";
  let str = input.trim().replace(/[\r\n]+/g, "");

  // Parse JSON if scanned
  if (str.includes("{") && str.includes("}")) {
    try {
      const s = str.indexOf("{");
      const e = str.lastIndexOf("}") + 1;
      const parsed = JSON.parse(str.substring(s, e));
      return (parsed.code || parsed.sku || parsed.itemCode || parsed.id || str).trim();
    } catch {
      /* fallback */
    }
  }

  // Strip brackets or non-alphanumeric outer padding
  return str.replace(/^[\[{\s]+|[\]}\s]+$/g, "");
}

/**
 * Unified Financial Math Helper
 * Handles PERCENTAGE, PER_GRAM, and FIXED calculation modes seamlessly.
 */
export function computeItemFinancials(
  baseValue: number,
  chargeType: "PERCENTAGE" | "PER_GRAM" | "FIXED" = "FIXED",
  chargeValue: number = 0,
  netWeight: number = 1,
  taxRate: number = 0
) {
  const chargeAmount =
    chargeType === "PER_GRAM"
      ? netWeight * chargeValue
      : chargeType === "PERCENTAGE"
      ? baseValue * (chargeValue / 100)
      : chargeValue;

  const subtotal = baseValue + chargeAmount;
  const tax = subtotal * (taxRate / 100);
  const totalPrice = subtotal + tax;

  return { baseValue, chargeAmount, subtotal, tax, totalPrice };
}

/**
 * Helper to safely extract string message from error objects
 * Prevents React Fiber crashes in toast.error(e)
 */
export function sanitizeErrorMessage(e: any, fallback: string = "Operation failed"): string {
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  if (typeof e?.error?.message === "string") return e.error.message;
  if (typeof e?.error === "string") return e.error;
  return fallback;
}
