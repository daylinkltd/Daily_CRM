/**
 * Normalise clipboard HTML before it is sanitised and inserted.
 *
 * THE BUG THIS FIXES: Google Docs wraps its entire clipboard payload in
 * `<b style="font-weight:normal">…</b>`. Word and some web apps do similar
 * things with spans. Our sanitiser strips `style` (correctly — it is an
 * injection surface) but KEEPS the `<b>`, so the style that neutralised it
 * disappears and every pasted document arrives entirely bold.
 *
 * Removing the bold in the toolbar then appeared not to stick, because the
 * outer wrapper survives a selection-scoped execCommand and comes back the
 * moment the value round-trips.
 *
 * So weight has to be resolved from the inline style BEFORE sanitising:
 *   * bold tags claiming a normal weight are unwrapped;
 *   * spans claiming a bold weight become <strong>, so intentional bold
 *     is not lost;
 *   * everything else is left for the sanitiser.
 *
 * Runs only in the browser (needs DOMParser); returns the input unchanged
 * on the server, where the sanitiser is the backstop.
 */

const BOLD_TAGS = new Set(["B", "STRONG"]);

/** A CSS font-weight that renders as not-bold. Exported for tests. */
export function isNormalWeight(weight: string): boolean {
  const w = weight.trim().toLowerCase();
  if (!w) return false;
  if (w === "normal" || w === "lighter") return true;
  const n = Number(w);
  return Number.isFinite(n) && n < 600;
}

/** A CSS font-weight that renders as bold. Exported for tests. */
export function isBoldWeight(weight: string): boolean {
  const w = weight.trim().toLowerCase();
  if (!w) return false;
  if (w === "bold" || w === "bolder") return true;
  const n = Number(w);
  return Number.isFinite(n) && n >= 600;
}

/** Replace an element with its own children, preserving order. */
function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

export function normalisePastedHtml(html: string): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return html;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return html;
  }
  if (!doc?.body) return html;

  // Snapshot first: unwrapping mutates the tree as we walk it.
  const elements = Array.from(doc.body.querySelectorAll<HTMLElement>("*"));

  for (const el of elements) {
    const weight = el.style?.fontWeight ?? "";

    // The Google Docs wrapper, and anything else bold-by-tag but
    // normal-by-style: the style was what made it not bold.
    if (BOLD_TAGS.has(el.tagName) && isNormalWeight(weight)) {
      unwrap(el);
      continue;
    }

    // Bold carried only in a style attribute would be lost once `style` is
    // stripped, so promote it to a real tag.
    if (!BOLD_TAGS.has(el.tagName) && isBoldWeight(weight)) {
      const strong = doc.createElement("strong");
      while (el.firstChild) strong.appendChild(el.firstChild);
      el.appendChild(strong);
    }
  }

  // A <b>/<strong> with nothing but whitespace inside is noise (unless it contains media like images).
  for (const el of Array.from(doc.body.querySelectorAll("b, strong"))) {
    if ((el.textContent ?? "").trim() === "" && el.querySelectorAll("img").length === 0) unwrap(el);
  }

  return doc.body.innerHTML;
}
