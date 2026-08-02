import type { ReactNode } from "react";

/**
 * Employee self-service. Everything under /me is scoped to the signed-in
 * member's own records, so it needs no HR permission — asking staff to
 * hold `people_view` just to request their own leave both over-grants
 * them and hides the feature behind a module they should not need.
 */
export default function SelfServiceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
