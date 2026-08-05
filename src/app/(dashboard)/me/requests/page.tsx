"use client";

import { MyRecordsList } from "@/components/self-service/my-records-list";
import { Badge } from "@/components/ui/badge";
import { EmployeeGuard } from "@/components/layout/employee-guard";

/**
 * The employee's own HR requests. Keyed on hr_employee_id, which migration
 * 079 repointed at workspace_members — not the dormant hr_employees table.
 */
function MyRequestsContent() {
  return (
    <MyRecordsList
      title="My Requests"
      description="Certificates, letters and changes you have asked HR for."
      table="hr_employee_requests"
      columns="id, request_type, status, notes, created_at"
      orderBy="created_at"
      memberColumn="hr_employee_id"
      emptyMessage="Requests you raise with HR will appear here."
      renderRow={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {String(r.request_type).replace(/_/g, " ")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {new Date(String(r.created_at)).toLocaleDateString()}
              {r.notes ? ` · ${String(r.notes)}` : ""}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {String(r.status)}
          </Badge>
        </div>
      )}
    />
  );
}

/**
 * Employee-only. A member without an `employee_profiles` row sees an
 * explanation instead of an empty page — see EmployeeGuard.
 */
export default function MyRequestsPage() {
  return (
    <EmployeeGuard feature="Requests">
      <MyRequestsContent />
    </EmployeeGuard>
  );
}
