"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * An icon-only button whose label appears on hover and on keyboard focus.
 *
 * WHY NOT EVERYWHERE: an icon with a hidden label is faster to scan once
 * you know the icon, and slower the first time you meet it. So this is
 * for REPEATED, SECONDARY actions — row actions in a table, toolbar
 * items — where the same few icons recur and vertical space is scarce.
 * Primary calls to action ("Issue official document", "Save policy")
 * keep their visible text: a destructive or committing action should
 * never depend on a hover to be understood, and hover does not exist on
 * touch devices at all.
 *
 * The label is always exposed to assistive technology through
 * `aria-label`, so hiding it visually never hides it from a screen
 * reader.
 */
export function IconAction({
  label,
  icon,
  onClick,
  variant = "ghost",
  size = "sm",
  disabled,
  destructive,
  className,
  side = "top",
  type = "button",
  ...props
}: {
  /** Shown on hover/focus and used as the accessible name. Required. */
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  side?: "top" | "right" | "bottom" | "left";
} & Omit<ComponentProps<typeof Button>, "children">) {
  return (
    <TooltipProvider delay={250}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type={type}
              variant={variant}
              size={size}
              disabled={disabled}
              onClick={onClick}
              aria-label={label}
              className={cn(
                "px-2",
                destructive && "text-muted-foreground hover:text-destructive",
                className
              )}
              {...props}
            >
              {icon}
            </Button>
          }
        />
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
