"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useWorkspace } from "@/hooks/use-workspace";
import { MODULE_LABELS, type ModuleKey } from "@/lib/auth/modules";

interface RequireModuleProps {
  /** App module the wrapped page belongs to. */
  module: ModuleKey;
  /** Rendered while access is still being resolved. Defaults to null. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * `<RequireModule module="hr">…</RequireModule>` — lightweight CLIENT-side
 * UX guard for a module's landing page. When the current member lacks the
 * module it shows a toast and redirects to /dashboard, so people don't land
 * on empty/erroring pages.
 *
 * This is UX only — the RLS migration is the real enforcement. We wait for
 * `loading` to settle before deciding so we never redirect an owner/member
 * mid-load (during load module access defaults to CRM-only and would fire a
 * false redirect).
 */
export function RequireModule({
  module,
  fallback = null,
  children,
}: RequireModuleProps) {
  const router = useRouter();
  const { moduleAccess, loading } = useWorkspace();
  const allowed = moduleAccess[module];
  // Guard against firing the toast/redirect twice under React strict mode
  // or re-renders while the navigation is in flight.
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (loading || allowed || redirectedRef.current) return;
    redirectedRef.current = true;
    toast.error(`You don't have access to the ${MODULE_LABELS[module]} module`);
    router.replace("/dashboard");
  }, [loading, allowed, module, router]);

  // Don't flash gated content: render the fallback until access is confirmed.
  if (loading || !allowed) return <>{fallback}</>;

  return <>{children}</>;
}
