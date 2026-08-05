"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Reveals its children when they scroll into view.
 *
 * FAILS SAFE BY DESIGN. The element is only marked `data-reveal` — the
 * thing that hides it — once this effect runs. If JavaScript never
 * executes, hydration fails, or IntersectionObserver is missing, the
 * content simply renders normally. Hiding in CSS and revealing with JS
 * would turn any of those into a blank page, and blank is far worse than
 * unanimated.
 *
 * The observer disconnects after the first intersection: this is an
 * entrance, not a scroll-linked effect, and re-animating content on the
 * way back up is nauseating rather than delightful.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger, in ms. Keep under ~400 or the last item feels broken. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect the OS setting here too, not just in CSS: without this the
    // element would still be marked and sit at its final state anyway, but
    // skipping the observer entirely avoids the work.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return;

    node.setAttribute("data-reveal", "");
    if (delay) node.style.setProperty("--reveal-delay", `${delay}ms`);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-reveal", "visible");
          observer.disconnect();
        }
      },
      // Fires slightly before the element is fully on screen, so the motion
      // finishes about when the reader's eye arrives.
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
