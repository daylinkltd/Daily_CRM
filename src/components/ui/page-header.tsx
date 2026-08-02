import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  actions?: React.ReactNode
  badge?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        // Compact by design: a page title is a signpost, not a banner.
        // It was text-3xl bold with a full paragraph beneath, which pushed
        // the actual content below the fold on a laptop.
        "flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
