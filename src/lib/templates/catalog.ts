/**
 * Shared vocabulary for the unified template library (migration 088).
 *
 * Kept out of the component so the settings page, any future automation
 * builder, and the send paths all agree on what a module and channel
 * mean, and so the labels are written once.
 */

export const TEMPLATE_MODULES = [
  "crm",
  "accounting",
  "hr",
  "retail",
  "projects",
  "general",
] as const;
export type TemplateModule = (typeof TEMPLATE_MODULES)[number];

export const TEMPLATE_MODULE_LABELS: Record<TemplateModule, string> = {
  crm: "CRM & Sales",
  accounting: "Finance",
  hr: "HR & People",
  retail: "Retail",
  projects: "Projects",
  general: "General",
};

export const TEMPLATE_CHANNELS = [
  "whatsapp",
  "email",
  "sms",
  "document",
  "internal",
] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];

export const TEMPLATE_CHANNEL_LABELS: Record<TemplateChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  document: "Document",
  internal: "Internal",
};

export interface TemplateRow {
  id: string;
  workspace_id: string | null;
  module: TemplateModule;
  channel: TemplateChannel;
  category: string | null;
  name: string;
  description: string | null;
  subject: string | null;
  body: string;
  variables: string[] | null;
  tags: string[] | null;
  requires_approval: boolean;
  approval_status: string | null;
  is_system: boolean;
  is_active: boolean;
  source_template_id: string | null;
  usage_count: number;
}

/** Tokens actually present in a body/subject, in order of appearance. */
export function extractVariables(...parts: (string | null | undefined)[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const m of part.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)) {
      const token = m[1];
      if (!seen.has(token)) {
        seen.add(token);
        found.push(token);
      }
    }
  }
  return found;
}

/**
 * WhatsApp templates must be approved by Meta before they can be sent
 * to a user outside the 24-hour service window. Everything else is
 * usable the moment it is saved.
 */
export function needsAggregatorApproval(channel: TemplateChannel): boolean {
  return channel === "whatsapp";
}

/** Rough SMS segment count — 160 GSM-7 chars, 153 per part when concatenated. */
export function smsSegments(body: string): number {
  const length = body.length;
  if (length === 0) return 0;
  if (length <= 160) return 1;
  return Math.ceil(length / 153);
}
