/**
 * Defensive Scanner Input Extraction
 * Cleanly strips carriage returns, JSON brackets, or tag placeholders from barcode scanners.
 */
export function extractCleanSku(input: string): string {
  if (!input) return "";
  const str = input.trim().replace(/[\r\n]+/g, "");

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

/**
 * Code 128 Barcode Pattern Generator (Code 128 B)
 * Produces standard 1D barcode bar sequences readable by hardware scanners.
 */
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232"
];
const STOP_PATTERN = "2331112";

export function generateCode128Pattern(text: string): boolean[] {
  if (!text) return [];
  const clean = text.trim();
  
  // Start Code B index = 104
  let checksum = 104;
  const indices: number[] = [104];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    let val = code - 32;
    if (val < 0 || val > 95) val = 31; // fallback to space/question
    indices.push(val);
    checksum += val * (i + 1);
  }

  const checksumIndex = checksum % 103;
  indices.push(checksumIndex);

  let patternStr = "";
  for (const idx of indices) {
    patternStr += CODE128_PATTERNS[idx] || CODE128_PATTERNS[31];
  }
  patternStr += STOP_PATTERN;

  // Convert width pattern string into boolean array (true = bar, false = space)
  const bars: boolean[] = [];
  let isBar = true;
  for (let i = 0; i < patternStr.length; i++) {
    const width = parseInt(patternStr[i], 10);
    for (let w = 0; w < width; w++) {
      bars.push(isBar);
    }
    isBar = !isBar;
  }
  return bars;
}

