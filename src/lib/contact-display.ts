/**
 * Display helpers for contact names.
 *
 * Some contacts imported from CSVs with broken encodings end up with
 * names that are nothing but question marks ("?? ????? ?????" — mojibake
 * where every non-ASCII character was replaced by '?'). Rendering those
 * as-is looks broken, so anywhere we show a contact name we fall back to
 * the phone number when the stored name carries no real information.
 */

/**
 * True when the name consists only of question marks, whitespace, and/or
 * punctuation — i.e. it carries no displayable identity. Also true for
 * empty/null names so callers can use a single check.
 */
export function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  // Strip whitespace + common ASCII/Unicode punctuation. If nothing is
  // left, the name is a placeholder. \p{P} covers '?', '.', ',', '¿' etc.
  const stripped = name.replace(/[\s\p{P}\p{S}]/gu, "");
  return stripped.length === 0;
}

/**
 * The name to render for a contact: the stored name unless it's a
 * placeholder, otherwise the phone number, otherwise a generic label.
 */
export function contactDisplayName(
  name: string | null | undefined,
  phone: string | null | undefined,
  fallback = "Unknown",
): string {
  if (!isPlaceholderName(name)) return name as string;
  if (phone && phone.trim()) return phone.trim();
  return fallback;
}

/**
 * Single-character avatar initial. Uses the first letter of a real name;
 * placeholder-only names (or missing names) fall back to '#' so the
 * avatar doesn't render a lone '?' or a digit from the phone number.
 */
export function contactInitial(
  name: string | null | undefined,
  phone: string | null | undefined,
): string {
  const display = contactDisplayName(name, phone, "");
  const first = display.trim().charAt(0);
  if (!first) return "#";
  // Phone-number fallbacks start with '+' or a digit — show '#' instead.
  return /\p{L}/u.test(first) ? first.toUpperCase() : "#";
}
