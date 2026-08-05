"use client";

import { MyRecordsList } from "@/components/self-service/my-records-list";
import { EmployeeGuard } from "@/components/layout/employee-guard";
import { Badge } from "@/components/ui/badge";

/**
 * The employee's own official documents.
 *
 * Reads `official_documents` — the SAME table the HR module issues from —
 * rather than the separate `employee_documents` it used to read. Those are
 * two unrelated tables, so nothing HR issued ever reached the employee.
 *
 * One table means the lifecycle follows automatically: a document issued
 * against this member appears here, and because HR soft-deletes with
 * `deleted_at`, removing it there removes it here too. Nothing to sync.
 *
 * Mirrors the HR-side query in employee-letters-tab.tsx: a document is
 * attached to a person by `linked_entity_type = 'Employee'` plus
 * `linked_entity_id = workspace_member_id`.
 */
function MyDocumentsContent() {
  return (
    <MyRecordsList
      title="My Documents"
      description="Official documents issued to you — offer letters, confirmations, certificates."
      table="official_documents"
      columns="id, document_number, title, status, issued_date, created_at"
      orderBy="created_at"
      memberColumn="linked_entity_id"
      equals={{ linked_entity_type: "Employee" }}
      isNull={["deleted_at"]}
      emptyMessage="Documents HR issues to you will appear here."
      renderRow={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {String(r.title ?? "Document")}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.document_number ? `${String(r.document_number)} · ` : ""}
              {r.issued_date
                ? `Issued ${new Date(String(r.issued_date)).toLocaleDateString()}`
                : `Added ${new Date(String(r.created_at)).toLocaleDateString()}`}
            </p>
          </div>
          {r.status ? (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {String(r.status)}
            </Badge>
          ) : null}
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
