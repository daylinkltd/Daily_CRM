import Image from "next/image";

import { BRAND } from "@/config/brand";
import daylinkD from "@/../public/daylink-d.png";

/**
 * The Dailybuz mark — Daylink's own "D".
 *
 * This was briefly a hand-drawn SVG "inspired by" the Daylink D: same
 * gradient, same offset square, a redrawn letterform. That was the wrong
 * call. A mark that resembles the parent brand without being it reads as a
 * knock-off rather than a family, and it made the checkout hand-off worse —
 * a buyer sent from dailybuz.com to daylink.in saw two similar-but-different
 * logos, which is precisely the pattern a phishing page produces.
 *
 * So it is the real asset now, the same file daylink.in ships. One mark,
 * used identically in both places, is both simpler and more trustworthy.
 *
 * A PNG rather than inline SVG because that is the form the original exists
 * in; it is 1024×1024 with transparency, so it stays crisp at every size the
 * site uses and sits correctly on light and dark backgrounds. Next's image
 * pipeline serves it as WebP at the requested size, so the 887KB source
 * never reaches a browser.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  /** Mark only — for the favicon, the app sidebar, tight spaces. */
  showWordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src={daylinkD}
        alt={showWordmark ? "" : `${BRAND.name} logo`}
        aria-hidden={showWordmark || undefined}
        width={28}
        height={28}
        priority
        className="size-7 shrink-0 object-contain"
      />

      {showWordmark && (
        <span className="text-base font-extrabold tracking-tight text-[var(--mkt-fg)]">
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
