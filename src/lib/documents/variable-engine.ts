/**
 * Variable Interpolation Engine for Enterprise SaaS Document Platform
 */

export interface DocumentVariableMeta {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "currency";
  module: VariableModule;
  required?: boolean;
}

/**
 * Modules a variable can belong to. Each maps to a real table in this
 * application — nothing here is aspirational, so a token offered in the
 * picker can always actually be filled.
 */
export const VARIABLE_MODULES = [
  "employee",
  "candidate",
  "company",
  "client",
  "deal",
  "quotation",
  "invoice",
  "project",
  "payroll",
  "leave",
  "document",
  "system",
] as const;
export type VariableModule = (typeof VARIABLE_MODULES)[number];

export const VARIABLE_MODULE_LABELS: Record<VariableModule, string> = {
  employee: "Employee",
  candidate: "Candidate & hiring",
  company: "Your company",
  client: "Client / contact",
  deal: "Deal",
  quotation: "Quotation",
  invoice: "Invoice",
  project: "Project",
  payroll: "Payroll",
  leave: "Leave",
  document: "Document",
  system: "System",
};

export const VARIABLE_DICTIONARY: DocumentVariableMeta[] = [
  // ── Employee (employee_profiles + profiles + designations/departments)
  { key: "employee.name", label: "Employee full name", type: "text", module: "employee", required: true },
  { key: "employee.code", label: "Employee code", type: "text", module: "employee" },
  { key: "employee.designation", label: "Designation / title", type: "text", module: "employee" },
  { key: "employee.department", label: "Department", type: "text", module: "employee" },
  { key: "employee.joining_date", label: "Date of joining", type: "date", module: "employee" },
  { key: "employee.confirmation_date", label: "Confirmation date", type: "date", module: "employee" },
  { key: "employee.relieving_date", label: "Relieving / last working day", type: "date", module: "employee" },
  { key: "employee.employment_type", label: "Employment type", type: "text", module: "employee" },
  { key: "employee.status", label: "Employment status", type: "text", module: "employee" },
  { key: "employee.email", label: "Employee email", type: "text", module: "employee" },
  { key: "employee.phone", label: "Employee phone", type: "text", module: "employee" },
  { key: "employee.address", label: "Employee address", type: "text", module: "employee" },
  { key: "employee.manager", label: "Reporting manager", type: "text", module: "employee" },
  { key: "employee.work_location", label: "Work location", type: "text", module: "employee" },
  { key: "employee.salary", label: "Salary / CTC amount", type: "currency", module: "employee" },
  { key: "employee.basic_salary", label: "Basic salary (monthly)", type: "currency", module: "employee" },
  { key: "employee.gross_salary", label: "Gross salary (monthly)", type: "currency", module: "employee" },
  { key: "employee.probation_period", label: "Probation period", type: "text", module: "employee" },
  { key: "employee.notice_period", label: "Notice period", type: "text", module: "employee" },

  // ── Candidate & hiring (hr_candidates, hr_recruitment_jobs, hr_job_applications)
  { key: "candidate.name", label: "Candidate full name", type: "text", module: "candidate" },
  { key: "candidate.email", label: "Candidate email", type: "text", module: "candidate" },
  { key: "candidate.phone", label: "Candidate phone", type: "text", module: "candidate" },
  { key: "candidate.current_company", label: "Current employer", type: "text", module: "candidate" },
  { key: "candidate.experience_years", label: "Years of experience", type: "number", module: "candidate" },
  { key: "candidate.source", label: "Sourced from", type: "text", module: "candidate" },
  { key: "candidate.stage", label: "Hiring stage", type: "text", module: "candidate" },
  { key: "candidate.expected_salary", label: "Expected salary", type: "currency", module: "candidate" },
  { key: "candidate.notice_period", label: "Candidate notice period", type: "text", module: "candidate" },
  { key: "job.title", label: "Job opening title", type: "text", module: "candidate" },
  { key: "job.department", label: "Hiring department", type: "text", module: "candidate" },
  { key: "job.location", label: "Job location", type: "text", module: "candidate" },
  { key: "job.employment_type", label: "Job employment type", type: "text", module: "candidate" },
  { key: "interview.date", label: "Interview date", type: "date", module: "candidate" },
  { key: "interview.time", label: "Interview time", type: "text", module: "candidate" },
  { key: "interview.mode", label: "Interview mode / link", type: "text", module: "candidate" },
  { key: "interview.panel", label: "Interview panel", type: "text", module: "candidate" },

  // ── Your company (workspaces + company_letterhead_configs)
  { key: "company.name", label: "Company legal name", type: "text", module: "company", required: true },
  { key: "company.tagline", label: "Company tagline", type: "text", module: "company" },
  { key: "company.address", label: "Registered address", type: "text", module: "company" },
  { key: "company.email", label: "Contact email", type: "text", module: "company" },
  { key: "company.phone", label: "Contact phone", type: "text", module: "company" },
  { key: "company.website", label: "Official website", type: "text", module: "company" },
  { key: "company.tax_id", label: "Tax / registration ID (GSTIN, EIN)", type: "text", module: "company" },
  { key: "company.currency", label: "Default currency", type: "text", module: "company" },

  // ── Client / contact (contacts)
  { key: "client.name", label: "Client / contact name", type: "text", module: "client" },
  { key: "client.company", label: "Client organisation", type: "text", module: "client" },
  { key: "client.email", label: "Client email", type: "text", module: "client" },
  { key: "client.phone", label: "Client phone", type: "text", module: "client" },
  { key: "client.address", label: "Client address", type: "text", module: "client" },
  { key: "client.gst_number", label: "Client tax number", type: "text", module: "client" },

  // ── Deal (deals + pipeline_stages)
  { key: "deal.title", label: "Deal title", type: "text", module: "deal" },
  { key: "deal.value", label: "Deal value", type: "currency", module: "deal" },
  { key: "deal.stage", label: "Pipeline stage", type: "text", module: "deal" },
  { key: "deal.owner", label: "Deal owner", type: "text", module: "deal" },
  { key: "deal.expected_close", label: "Expected close date", type: "date", module: "deal" },

  // ── Quotation (quotations)
  { key: "quotation.number", label: "Quotation number", type: "text", module: "quotation" },
  { key: "quotation.title", label: "Quotation title", type: "text", module: "quotation" },
  { key: "quotation.total", label: "Quotation total", type: "currency", module: "quotation" },
  { key: "quotation.valid_until", label: "Valid until", type: "date", module: "quotation" },
  { key: "quotation.payment_terms", label: "Payment terms", type: "text", module: "quotation" },

  // ── Invoice (invoices + invoice_payments)
  { key: "invoice.number", label: "Invoice number", type: "text", module: "invoice" },
  { key: "invoice.date", label: "Invoice date", type: "date", module: "invoice" },
  { key: "invoice.due_date", label: "Due date", type: "date", module: "invoice" },
  { key: "invoice.subtotal", label: "Subtotal", type: "currency", module: "invoice" },
  { key: "invoice.tax", label: "Tax amount", type: "currency", module: "invoice" },
  { key: "invoice.total", label: "Invoice total", type: "currency", module: "invoice" },
  { key: "invoice.amount_paid", label: "Amount paid", type: "currency", module: "invoice" },
  { key: "invoice.balance_due", label: "Balance due", type: "currency", module: "invoice" },
  { key: "invoice.days_overdue", label: "Days overdue", type: "number", module: "invoice" },
  { key: "invoice.payment_link", label: "Payment link", type: "text", module: "invoice" },

  // ── Project (projects + tasks)
  { key: "project.name", label: "Project name", type: "text", module: "project" },
  { key: "project.manager", label: "Project manager", type: "text", module: "project" },
  { key: "project.status", label: "Project status", type: "text", module: "project" },
  { key: "project.budget", label: "Project budget", type: "currency", module: "project" },
  { key: "project.deadline", label: "Project deadline", type: "date", module: "project" },
  { key: "project.hourly_rate", label: "Hourly billing rate", type: "currency", module: "project" },
  { key: "task.title", label: "Task title", type: "text", module: "project" },
  { key: "task.due_date", label: "Task due date", type: "date", module: "project" },
  { key: "task.assignee", label: "Task assignee", type: "text", module: "project" },

  // ── Payroll (payslips + payroll_cycles)
  { key: "payroll.period", label: "Pay period", type: "text", module: "payroll" },
  { key: "payroll.total_earnings", label: "Total earnings", type: "currency", module: "payroll" },
  { key: "payroll.total_deductions", label: "Total deductions", type: "currency", module: "payroll" },
  { key: "payroll.net_payable", label: "Net payable", type: "currency", module: "payroll" },
  { key: "payroll.pf_deduction", label: "Provident fund", type: "currency", module: "payroll" },
  { key: "payroll.professional_tax", label: "Professional tax", type: "currency", module: "payroll" },
  { key: "payroll.tds_deduction", label: "Income tax (TDS)", type: "currency", module: "payroll" },
  { key: "payroll.pay_date", label: "Pay date", type: "date", module: "payroll" },

  // ── Leave (leave_requests)
  { key: "leave.type", label: "Leave type", type: "text", module: "leave" },
  { key: "leave.start_date", label: "Leave start date", type: "date", module: "leave" },
  { key: "leave.end_date", label: "Leave end date", type: "date", module: "leave" },
  { key: "leave.days", label: "Number of days", type: "number", module: "leave" },
  { key: "leave.balance", label: "Remaining balance", type: "number", module: "leave" },
  { key: "leave.reason", label: "Reason", type: "text", module: "leave" },

  // ── Document metadata
  { key: "document.number", label: "Document number", type: "text", module: "document", required: true },
  { key: "document.title", label: "Document title", type: "text", module: "document" },
  { key: "document.date", label: "Issue date", type: "date", module: "document" },
  { key: "signatory_name", label: "Signatory name", type: "text", module: "document" },
  { key: "signatory_designation", label: "Signatory designation", type: "text", module: "document" },

  // ── System
  { key: "today", label: "Current system date", type: "date", module: "system" },
  { key: "current_year", label: "Current year", type: "text", module: "system" },
  { key: "sender_name", label: "Your name (the sender)", type: "text", module: "system" },
];

/** Variables grouped by module, for a picker UI. */
export function variablesByModule(): Record<VariableModule, DocumentVariableMeta[]> {
  const out = {} as Record<VariableModule, DocumentVariableMeta[]>;
  for (const m of VARIABLE_MODULES) out[m] = [];
  for (const v of VARIABLE_DICTIONARY) out[v.module].push(v);
  return out;
}

/**
 * Escape a context value for insertion into an HTML document body.
 *
 * Interpolated values are user-supplied (recipient name, designation,
 * salary, contact fields) and the result is persisted to
 * `official_documents.body_html`, which is rendered through
 * `dangerouslySetInnerHTML`. Without this, typing markup into
 * "Recipient Full Name" is stored XSS for every later viewer.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Replaces Handlebars-style {{variable.key}} tokens in HTML text with contextual dictionary values.
 */
export function interpolateVariables(
  templateHtml: string,
  contextData: Record<string, any>
): string {
  if (!templateHtml) return "";

  return templateHtml.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (match, token) => {
    const value = getNestedValue(contextData, token);
    if (value !== undefined && value !== null) {
      return escapeHtml(String(value));
    }
    // Return empty placeholder string if context missing
    return `<span class="text-primary font-mono underline bg-primary/10 px-1 py-0.5 rounded">[${token}]</span>`;
  });
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}
