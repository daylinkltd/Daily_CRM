import * as React from "react"
import { cn } from "@/lib/utils"

export interface DataToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  search?: React.ReactNode
  filters?: React.ReactNode
  actions?: React.ReactNode
}

export function DataToolbar({
  search,
  filters,
  actions,
  className,
  ...props
}: DataToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {search}
        {filters}
      </div>
      {actions && (
        <div className="flex items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
