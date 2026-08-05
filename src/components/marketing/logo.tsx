import { BRAND } from "@/config/brand";

/**
 * The Dailybuz mark.
 *
 * DERIVED FROM THE DAYLINK "D", deliberately — these are sibling products
 * from one company, and a buyer who pays Daylink for Dailybuz should see
 * the family resemblance on the invoice. Three things carry over:
 *
 *   - the navy → bright-blue gradient of the Daylink swoosh
 *   - the small offset square at the top-left, which is Daylink's signature
 *   - a "D" built from motion rather than a drawn letterform
 *
 * What is new is the buzz: the bowl of the D is two concentric arcs
 * radiating outward, like a signal. That is the product — conversations
 * arriving — and it reads at 16px, which a literal bee or a detailed
 * illustration would not.
 *
 * Rendered inline as SVG rather than an <img> so it inherits currentColor
 * for the wordmark and stays crisp at any size, including in dark mode
 * where a baked PNG on a light background would show a halo.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  /** Mark only — for the favicon, the app sidebar, tight spaces. */
  showWordmark?: boolean;
}) {
  // Unique per render so two logos on one page cannot collide on the
  // gradient id, which would make the second one render un-gradiented.
  const gradientId = showWordmark ? "dbz-grad-full" : "dbz-grad-mark";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        viewBox="0 0 40 40"
        width="28"
        height="28"
        role="img"
        aria-label={showWordmark ? undefined : `${BRAND.name} logo`}
        aria-hidden={showWordmark || undefined}
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14274E" />
            <stop offset="55%" stopColor="#1268B3" />
            <stop offset="100%" stopColor="#0A9FE0" />
          </linearGradient>
        </defs>

        {/* Stem. */}
        <rect x="6" y="6" width="7" height="28" fill={`url(#${gradientId})`} />

        {/* Bowl — starts exactly where the stem ends (x=13) so the two read
            as one letter rather than a bar beside an arc. */}
        <path
          d="M13 6 A 14 14 0 0 1 13 34"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="7"
        />

        {/* The buzz: one detached arc echoing the bowl further out, like a
            signal leaving the letter. Thin and faint so it never competes
            with the D at small sizes. */}
        <path
          d="M15.5 1.8 A 18.4 18.4 0 0 1 15.5 38.2"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          opacity="0.38"
        />

        {/* Daylink's offset square, kept as the family signature. */}
        <rect x="6" y="0.5" width="4.5" height="4.5" fill="#0A9FE0" />
      </svg>

      {showWordmark && (
        <span className="text-base font-extrabold tracking-tight text-[var(--mkt-fg)]">
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
