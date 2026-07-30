import * as React from "react"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  icon?: LucideIcon
  change?: {
    value: string | number
    trend: "up" | "down" | "neutral"
    label?: string
  }
  description?: string
  loading?: boolean
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  description,
  loading = false,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card className={cn("relative overflow-hidden p-5 flex flex-col justify-between h-full", className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground truncate">
            {label}
        </span>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-4xl font-bold tracking-tight text-foreground">
            {value}
          </div>
        )}

        {(change || description) && (
          <div className="flex items-center gap-1.5 text-xs mt-0.5">
            {change && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold text-[12px]",
                  change.trend === "up" && "text-emerald-600 dark:text-emerald-400",
                  change.trend === "down" && "text-rose-600 dark:text-rose-400",
                  change.trend === "neutral" && "text-muted-foreground"
                )}
              >
                {change.trend === "up" && <TrendingUp className="h-3 w-3 shrink-0" />}
                {change.trend === "down" && <TrendingDown className="h-3 w-3 shrink-0" />}
                {change.value}
              </span>
            )}
            {(description || change?.label) && (
              <span className="text-[12px] text-muted-foreground truncate">
                {description || change?.label}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
