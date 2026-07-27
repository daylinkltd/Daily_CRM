import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title?: string; // Title is ignored to prevent duplicate headers since top navigation displays the title
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ description, action, className }: PageHeaderProps) {
  if (!description && !action) return null;

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6", className)}>
      <div className="min-w-0">
        {description && (
          <p className="text-sm text-slate-400 leading-normal max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="shrink-0 flex items-center gap-2.5">
          {action}
        </div>
      )}
    </div>
  );
}
