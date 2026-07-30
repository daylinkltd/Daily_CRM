import { cn } from "@/lib/utils";

type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'PROBATION';

const statusStyles: Record<EmployeeStatus, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  INACTIVE: "bg-slate-500/15 text-slate-700 dark:text-muted-foreground",
  ON_LEAVE: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  TERMINATED: "bg-red-500/15 text-red-700 dark:text-red-400",
  PROBATION: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

const statusLabels: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On Leave",
  TERMINATED: "Terminated",
  PROBATION: "Probation",
};

export function StatusBadge({ status, className }: { status: EmployeeStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
