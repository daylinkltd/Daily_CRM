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
  'security',
  'appearance',
  'crm',
  'whatsapp',
  'chatbot',
  'templates',
  'whatsapp-templates',
  'fields',
  'deals',
  'accounting',
  'projects',
  'hr',
  'attendance',
  'retail',
  'members',
  'roles',
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
  profile: { id: 'profile', label: 'Your profile', icon: User, group: 'account', blurb: 'Name, photo and contact details' },
  security: { id: 'security', label: 'Login & security', icon: Shield, group: 'account', blurb: 'Password and active sessions' },
  appearance: { id: 'appearance', label: 'Appearance', icon: Palette, group: 'account', blurb: 'Theme and display density' },

  // The company itself — identity that appears on outgoing documents.
  branding: { id: 'branding', label: 'Company branding', icon: Building2, group: 'company', blurb: 'Logo, colours and letterhead' },
  members: { id: 'members', label: 'Team members', icon: UsersRound, group: 'company', blurb: 'Invite people and set their role' },
  roles: { id: 'roles', label: 'Roles & permissions', icon: ShieldCheck, group: 'company', blurb: 'What each role can see and do' },

  // Reusable content shared across every module.
  templates: { id: 'templates', label: 'Templates', icon: FileText, group: 'content', blurb: 'Messages, emails and letters for every module' },
  catalog: { id: 'catalog', label: 'Service catalog', icon: FileSpreadsheet, group: 'content', blurb: 'Products and services you sell' },
  fields: { id: 'fields', label: 'Fields & tags', icon: Tags, group: 'content', blurb: 'Custom fields and tag vocabulary' },

  // CRM
  crm: { id: 'crm', label: 'CRM & pipelines', icon: PlugZap, group: 'crm_module', blurb: 'Pipeline stages and lead defaults' },
  deals: { id: 'deals', label: 'Deals & currency', icon: Coins, group: 'crm_module', blurb: 'Default currency and deal settings' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp API', icon: PlugZap, group: 'crm_module', blurb: 'Connect your WhatsApp Business number' },
  'whatsapp-templates': { id: 'whatsapp-templates', label: 'WhatsApp approvals', icon: FileText, group: 'crm_module', blurb: 'Submit templates to Meta and track status' },
  chatbot: { id: 'chatbot', label: 'AI chatbot', icon: Bot, group: 'crm_module', blurb: 'Automated replies and handover rules' },

  // Finance
  accounting: { id: 'accounting', label: 'Accounting & ledgers', icon: Landmark, group: 'finance_module', blurb: 'Chart of accounts and tax defaults' },

  // Projects
  projects: { id: 'projects', label: 'Project management', icon: Briefcase, group: 'projects_module', blurb: 'Project defaults and billing rates' },

  // HR
  hr: { id: 'hr', label: 'HR & operations', icon: Briefcase, group: 'hr_module', blurb: 'Shifts, leave quotas and payroll rules' },
  attendance: { id: 'attendance', label: 'Attendance & punch', icon: MapPin, group: 'hr_module', blurb: 'Work locations, GPS rules and geofences' },

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
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (raw === 'permissions' || raw === 'roles-permissions') return 'roles';
  if (raw === 'hr-operations' || raw === 'hr_operations' || raw === 'operations') return 'hr';
  if (raw === 'retail' || raw === 'retail-settings') return 'retail';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
