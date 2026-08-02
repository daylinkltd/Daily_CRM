"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

/**
 * The old "Template Studio" lived here and read `document_templates`
 * (migration 084) — a second, separate store for the same idea as the
 * unified template library in `templates` (migration 088). Two stores
 * meant this page always showed "No custom templates created yet" while
 * 106 templates, including 15 HR letters, sat in the other one.
 *
 * There is now a single place for every template in the product —
 * WhatsApp, email, SMS, HR letters and documents — so this route
 * forwards there rather than presenting a competing screen.
 */
export default function DocumentTemplatesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings?tab=templates");
  }, [router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Taking you to Templates…</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Document templates now live with every other template in one place.
      </p>
      <Link href="/settings?tab=templates" className="text-xs text-primary underline">
        Go there now
      </Link>
    </div>
  );
}
