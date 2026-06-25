"use client";

import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GatedButtonProps extends Omit<ComponentProps<typeof Button>, "title"> {
  canAct?: boolean;
  gateReason?: string;
  title?: string;
  children?: ReactNode;
}

export function GatedButton({
  canAct = true,
  gateReason,
  title,
  disabled,
  className,
  children,
  ...rest
}: GatedButtonProps) {
  const effectivelyDisabled = disabled || !canAct;
  const tooltip = !canAct && gateReason
    ? `Read-only — your role can't ${gateReason}`
    : title;

  return (
    <span
      className={cn("inline-flex", !canAct && "cursor-not-allowed")}
      title={tooltip}
    >
      <Button
        disabled={effectivelyDisabled}
        className={className}
        {...rest}
      >
        {children}
      </Button>
    </span>
  );
}
