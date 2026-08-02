"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Home, RotateCcw, ArrowLeft } from "lucide-react";

/**
 * Shared shell for every error page, so a 404 and a 500 do not look like
 * two different products.
 *
 * The buttons here KEEP their text deliberately. Someone who has just hit
 * an error is already disoriented; making them hover an icon to discover
 * how to get out is the wrong moment to be clever.
 */
export function ErrorState({
  code,
  title,
  message,
  children,
  onRetry,
}: {
  code: string;
  title: string;
  message: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-5xl font-semibold tracking-tight text-muted-foreground/40">
          {code}
        </p>

        <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>

        {children}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="gap-1.5">
              <RotateCcw className="size-4" /> Try again
            </Button>
          )}
          <Link href="/dashboard">
            <Button variant={onRetry ? "outline" : "default"} className="gap-1.5">
              <Home className="size-4" /> Go to dashboard
            </Button>
          </Link>
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        </div>
      </div>
    </main>
  );
}
