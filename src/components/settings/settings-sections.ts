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
    | 'crm_module' 
    | 'finance_module' 
    | 'projects_module' 
    | 'hr_module' 
    | 'retail_module' 
    | 'workspace_admin';
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'top' },
  profile: { id: 'profile', label: 'Your profile', icon: User, group: 'account' },
  security: { id: 'security', label: 'Login & security', icon: Shield, group: 'account' },
  appearance: { id: 'appearance', label: 'Appearance', icon: Palette, group: 'account' },
  
  // CRM Module Settings
  crm: { id: 'crm', label: 'CRM & Pipelines', icon: PlugZap, group: 'crm_module' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp API', icon: PlugZap, group: 'crm_module' },
  chatbot: { id: 'chatbot', label: 'AI Chatbot', icon: Bot, group: 'crm_module' },
  templates: { id: 'templates', label: 'Templates', icon: FileText, group: 'top' },
  'whatsapp-templates': { id: 'whatsapp-templates', label: 'WhatsApp Templates', icon: FileText, group: 'crm_module' },
  fields: { id: 'fields', label: 'Fields & tags', icon: Tags, group: 'crm_module' },
  deals: { id: 'deals', label: 'Deals & currency', icon: Coins, group: 'crm_module' },
  
  // Accounting Module Settings
  accounting: { id: 'accounting', label: 'Accounting & Ledgers', icon: Landmark, group: 'finance_module' },
  
  // Project Management Settings
  projects: { id: 'projects', label: 'Project Management', icon: Briefcase, group: 'projects_module' },
  
  // HR Module Settings
  hr: { id: 'hr', label: 'HR & Operations', icon: Briefcase, group: 'hr_module' },
  attendance: { id: 'attendance', label: 'Attendance & Punch', icon: MapPin, group: 'hr_module' },
  
  // Retail Module Settings
  retail: { id: 'retail', label: 'Retail Presets', icon: Store, group: 'retail_module' },
  
  // Workspace Admin Settings
  members: { id: 'members', label: 'Team members', icon: UsersRound, group: 'workspace_admin' },
  roles: { id: 'roles', label: 'Roles & permissions', icon: ShieldCheck, group: 'workspace_admin' },
  billing: { id: 'billing', label: 'Billing & Plan', icon: CreditCard, group: 'workspace_admin' },
  api: { id: 'api', label: 'API keys', icon: KeyRound, group: 'workspace_admin' },
  catalog: { id: 'catalog', label: 'Service Catalog', icon: FileSpreadsheet, group: 'workspace_admin' },
  branding: { id: 'branding', label: 'Company Branding', icon: Building2, group: 'workspace_admin' },
};

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null, group: 'top' },
  { label: 'Account', group: 'account' },
  { label: 'CRM Module', group: 'crm_module' },
  { label: 'Finance & Accounting', group: 'finance_module' },
  { label: 'Project Management', group: 'projects_module' },
  { label: 'HR & People Operations', group: 'hr_module' },
  { label: 'Retail & Commerce', group: 'retail_module' },
  { label: 'Workspace Administration', group: 'workspace_admin' },
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
