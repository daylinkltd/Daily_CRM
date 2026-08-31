import {
  Coins,
  FileText,
  KeyRound,
  LayoutGrid,
  Palette,
  PlugZap,
  Shield,
  ShieldCheck,
  Tags,
  User,
  UsersRound,
  Bot,
  FileSpreadsheet,
  Building2,
  CreditCard,
  Briefcase,
  Store,
  Landmark,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

/**
 * Settings information architecture for the redesigned page.
 *
 * The flat tab strip became a grouped left rail with a new Overview
 * landing. The URL query param stays `?tab=` (deep-linkable, and it
 * keeps the existing links in sidebar.tsx / header.tsx working) — we
 * just map the old values onto the new sections.
 */
export const SETTINGS_SECTIONS = [
  'overview',
  'profile',
  'crm',
  'whatsapp',
  'templates',
  'accounting',
  'projects',
  'hr',
  'retail',
  'members',
  'modules',
  'billing',
  'api',
  'catalog',
  'branding',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';

/** Rail grouping. `adminOnly` items are hidden for non-admins. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group:
    | 'top'
    | 'account'
    | 'company'
    | 'content'
    | 'crm_module'
    | 'finance_module'
    | 'projects_module'
    | 'hr_module'
    | 'retail_module'
    | 'workspace_admin';
  /** One-line hint under the label in the rail and on the Overview cards. */
  blurb?: string;
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'top' },

  // Your account — personal, not workspace-wide.
  profile: { id: 'profile', label: 'Your profile', icon: User, group: 'account', blurb: 'Your details, password, sessions and appearance' },

  // The company itself — identity that appears on outgoing documents.
  branding: { id: 'branding', label: 'Company branding', icon: Building2, group: 'company', blurb: 'Logo, company details and the letterhead used on every document' },
  members: { id: 'members', label: 'Team & access', icon: UsersRound, group: 'company', blurb: 'Members, invitations, roles and permissions' },
  modules: { id: 'modules', label: 'Modules', icon: LayoutGrid, group: 'company', blurb: 'Which parts of the product this business uses' },

  // Reusable content shared across every module.
  templates: { id: 'templates', label: 'Templates', icon: FileText, group: 'content', blurb: 'Messages, emails and letters for every module' },
  catalog: { id: 'catalog', label: 'Service catalog', icon: FileSpreadsheet, group: 'content', blurb: 'Products and services you sell' },

  // CRM
  crm: { id: 'crm', label: 'CRM & pipelines', icon: PlugZap, group: 'crm_module', blurb: 'Pipelines, deal defaults, custom fields and tags' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp API', icon: PlugZap, group: 'crm_module', blurb: 'Connection, chatbot and Meta template approvals' },

  // Finance
  accounting: { id: 'accounting', label: 'Accounting & ledgers', icon: Landmark, group: 'finance_module', blurb: 'Chart of accounts and tax defaults' },

  // Projects
  projects: { id: 'projects', label: 'Project management', icon: Briefcase, group: 'projects_module', blurb: 'Project defaults and billing rates' },

  // HR
  hr: { id: 'hr', label: 'HR & operations', icon: Briefcase, group: 'hr_module', blurb: 'Shifts, leave, payroll, salary and attendance rules' },

  // Retail
  retail: { id: 'retail', label: 'Retail presets', icon: Store, group: 'retail_module', blurb: 'Counter, tax and receipt defaults' },

  // Platform administration
  billing: { id: 'billing', label: 'Billing & plan', icon: CreditCard, group: 'workspace_admin', blurb: 'Subscription and invoices' },
  api: { id: 'api', label: 'API keys', icon: KeyRound, group: 'workspace_admin', blurb: 'Programmatic access to your workspace' },
};

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null, group: 'top' },
  { label: 'Your account', group: 'account' },
  { label: 'Company', group: 'company' },
  { label: 'Content & templates', group: 'content' },
  { label: 'CRM & messaging', group: 'crm_module' },
  { label: 'Finance', group: 'finance_module' },
  { label: 'HR & people', group: 'hr_module' },
  { label: 'Projects', group: 'projects_module' },
  { label: 'Retail', group: 'retail_module' },
  { label: 'Administration', group: 'workspace_admin' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs from the old
 * flat layout collapse onto their new home (Tags + Custom fields → the
 * merged "Fields & tags" section). Anything unknown falls back to the
 * Overview landing.
 */
export function resolveSection(raw: string | null): SettingsSection {
  // Folded sections: the id survives as a sub-tab, so an old deep link
  // resolves to the parent and the parent opens on that tab.
  if (raw === 'security' || raw === 'appearance') return 'profile';
  if (raw === 'roles' || raw === 'permissions') return 'members';
  if (raw === 'chatbot' || raw === 'whatsapp-templates') return 'whatsapp';
  if (raw === 'fields' || raw === 'tags' || raw === 'custom-fields' || raw === 'deals') return 'crm';
  if (raw === 'attendance' || raw === 'timesheet-templates') return 'hr';
  if (raw === 'letterhead') return 'branding';
  if (raw === 'roles-permissions') return 'members';
  if (raw === 'hr-operations' || raw === 'hr_operations' || raw === 'operations') return 'hr';
  if (raw === 'retail' || raw === 'retail-settings') return 'retail';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
