"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2, IdCard } from "lucide-react";

import { useWorkspace } from "@/hooks/use-workspace";

/**
 * Gate employee self-service content on the member actually being staff.
 *
 * The sidebar already hides these links, but hiding a link is not access
 * control — the URL still resolves, and a stale bookmark or a shared link
 * would land a non-employee on a payslip page. So the pages guard
 * themselves too.
 *
 * This is NOT a security boundary and does not pretend to be one: the
 * underlying rows are protected by RLS keyed on workspace_member_id, so a
 * non-employee sees nothing regardless. What this prevents is a confusing
 * dead end — an empty payslip table reads as "your payslips are missing"
 * rather than "you are not on the payroll".
 *
 * Presence of an `employee_profiles` row is the test. It is keyed by
 * `workspace_member_id` and has no `id` column; `hr_employees` is dormant
 * and must not be used for this.
 */
export function EmployeeGuard({
  children,
  feature = "This page",
}: {
  children: ReactNode;
  /** Names the thing in the explanation, e.g. "Payslips". */
  feature?: string;
}) {
  const { isEmployee, loading, activeMember } = useWorkspace();

  // Wait for the membership lookup before deciding — rendering the refusal
  // first would flash it at every employee on every page load.
  if (loading || !activeMember) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isEmployee) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card px-6 py-16 text-center">
        <IdCard className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-4 text-sm font-semibold text-foreground">
          {feature} is for employees
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You are a member of this workspace but you don&apos;t have an employee
          record, so there is nothing here for you. If that looks wrong, ask an
          admin to add you under People.
        </p>
        <Link
          href="/me/work"
          className="mt-5 inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Go to My Work
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
