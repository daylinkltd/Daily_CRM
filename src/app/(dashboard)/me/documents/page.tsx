"use client";

import { MyRecordsList } from "@/components/self-service/my-records-list";
import { EmployeeGuard } from "@/components/layout/employee-guard";

/** The employee's own documents on file. */
function MyDocumentsContent() {
  return (
    <MyRecordsList
      title="My Documents"
      description="Documents held on your employee record."
      table="employee_documents"
      columns="id, document_type, storage_path, created_at"
      orderBy="created_at"
      emptyMessage="Documents HR adds to your record will appear here."
      renderRow={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {String(r.document_type ?? "Document").replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Added {new Date(String(r.created_at)).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    />
  );
}

/**
 * Employee-only. A member without an `employee_profiles` row sees an
 * explanation instead of an empty page — see EmployeeGuard.
 */
export default function MyDocumentsPage() {
  return (
    <EmployeeGuard feature="Documents">
      <MyDocumentsContent />
    </EmployeeGuard>
  );
}
