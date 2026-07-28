/**
 * WhatsApp-style doodle backdrop for the chat area.
 *
 * Rendered as an inline SVG `<pattern>` — fully self-contained, no
 * external requests (the old `/inbox-doodle.svg` reference pointed at a
 * file that never shipped, so the thread background was silently plain).
 *
 * Theme-awareness: every stroke uses `currentColor`, inherited from
 * `text-foreground`, and the whole layer sits at ~4.5% opacity — so the
 * doodles read as a barely-there texture over `bg-background` in both
 * light and dark modes. A separate 3% `--primary` wash underneath gives
 * the area the faint warm tint WhatsApp's chat wallpaper has, derived
 * from the accent token so every theme stays coherent.
 *
 * Layout contract: parent must be `position: relative`; this layer is
 * absolutely positioned, ignores pointer events, and is aria-hidden.
 */
export function ChatBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      {/* Warm accent wash under the doodles (token-derived, theme-safe). */}
      <div className="absolute inset-0 bg-primary/[0.03]" />
      {/*
        Dark mode needs a higher alpha: a light stroke at 4.5% over a
        near-black surface is effectively invisible, whereas the same
        alpha of a dark stroke on white reads clearly. Verified in both
        modes side by side.
      */}
      <svg
        className="absolute inset-0 h-full w-full text-foreground opacity-[0.045] dark:opacity-[0.10]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="inbox-doodle"
            width="220"
            height="220"
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Speech bubble */}
              <g transform="translate(16 14) rotate(-8)">
                <rect x="0" y="0" width="22" height="15" rx="5" />
                <path d="M6 15v5l6-5" />
              </g>
              {/* Heart */}
              <g transform="translate(112 8) rotate(10) scale(0.9)">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </g>
              {/* Paper plane */}
              <g transform="translate(178 36) rotate(-14) scale(0.9)">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </g>
              {/* Smiley */}
              <g transform="translate(58 58) rotate(6) scale(0.9)">
                <circle cx="10" cy="10" r="9" />
                <path d="M6.5 12a4.5 4.5 0 0 0 7 0" />
                <path d="M7 7.5h.01M13 7.5h.01" />
              </g>
              {/* Music note */}
              <g transform="translate(146 78) rotate(-6) scale(0.8)">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </g>
              {/* Coffee cup */}
              <g transform="translate(14 100) rotate(8) scale(0.85)">
                <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              </g>
              {/* Camera */}
              <g transform="translate(92 124) rotate(-10) scale(0.9)">
                <path d="M6 5l2-3h6l2 3" />
                <rect x="0" y="5" width="22" height="15" rx="4" />
                <circle cx="11" cy="12.5" r="4" />
              </g>
              {/* Star */}
              <g transform="translate(184 128) rotate(12) scale(0.85)">
                <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8Z" />
              </g>
              {/* Phone handset */}
              <g transform="translate(34 164) rotate(-6) scale(0.85)">
                <path d="M4 2h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 4a2 2 0 0 1 2-2Z" />
              </g>
              {/* Photo / image */}
              <g transform="translate(122 178) rotate(8) scale(0.9)">
                <rect x="0" y="0" width="20" height="18" rx="4" />
                <circle cx="6.5" cy="6" r="1.6" />
                <path d="M20 12.5 14 7 3 17" />
              </g>
              {/* Sparkle / asterisk */}
              <g transform="translate(186 186) scale(0.7)">
                <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" />
              </g>
              {/* Thumbs up */}
              <g transform="translate(74 16) rotate(-12) scale(0.75)">
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
              </g>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#inbox-doodle)" />
      </svg>
    </div>
  );
}
