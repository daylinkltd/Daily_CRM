/**
 * Variable Interpolation Engine for Enterprise SaaS Document Platform
 */

export interface DocumentVariableMeta {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "currency";
  module: "employee" | "company" | "client" | "document" | "system";
  required?: boolean;
}

export const VARIABLE_DICTIONARY: DocumentVariableMeta[] = [
  // Employee variables
  { key: "employee.name", label: "Employee Full Name", type: "text", module: "employee", required: true },
  { key: "employee.designation", label: "Designation / Title", type: "text", module: "employee" },
  { key: "employee.department", label: "Department", type: "text", module: "employee" },
  { key: "employee.joining_date", label: "Date of Joining", type: "date", module: "employee" },
  { key: "employee.salary", label: "Salary / CTC Amount", type: "currency", module: "employee" },
  { key: "employee.email", label: "Employee Email", type: "text", module: "employee" },
  { key: "employee.phone", label: "Employee Phone", type: "text", module: "employee" },

  // Company / Workspace variables
  { key: "company.name", label: "Company Legal Name", type: "text", module: "company", required: true },
  { key: "company.tagline", label: "Company Tagline", type: "text", module: "company" },
  { key: "company.address", label: "Registered Address", type: "text", module: "company" },
  { key: "company.email", label: "Contact Email", type: "text", module: "company" },
  { key: "company.phone", label: "Contact Phone", type: "text", module: "company" },
  { key: "company.website", label: "Official Website", type: "text", module: "company" },
  { key: "company.tax_id", label: "Tax / Registration ID (GSTIN/EIN)", type: "text", module: "company" },

  // Client / CRM Contact variables
  { key: "client.name", label: "Client / Contact Name", type: "text", module: "client" },
  { key: "client.company", label: "Client Organization", type: "text", module: "client" },
  { key: "client.email", label: "Client Email", type: "text", module: "client" },
  { key: "client.phone", label: "Client Phone", type: "text", module: "client" },

  // Document metadata variables
  { key: "document.number", label: "Document Number", type: "text", module: "document", required: true },
  { key: "document.title", label: "Document Title", type: "text", module: "document" },
  { key: "document.date", label: "Issue Date", type: "date", module: "document" },
  { key: "today", label: "Current System Date", type: "date", module: "system" },
];

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
