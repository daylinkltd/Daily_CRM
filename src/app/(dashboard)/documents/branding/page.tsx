"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

/**
 * The letterhead designer now lives with the rest of company identity in
 * Settings -> Branding, so there is one place that decides how the company
 * appears on documents, letters and invoices. This route forwards there.
 */
export default function DocumentsBrandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings?tab=letterhead");
  }, [router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Taking you to Branding…</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Letterhead now sits with your logo and company details in Settings.
      </p>
      <Link href="/settings?tab=letterhead" className="text-xs text-primary underline">
        Go there now
      </Link>
    </div>
  );
}
