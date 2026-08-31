// ============================================================
// "Which of this do I actually need?"
//
// The product keeps growing modules, and most businesses want a
// fraction of them. A restaurant does not want a project tracker; a
// freelance designer does not want a bar till. Shipping everything
// switched on makes the app look like somebody else's software.
//
// So the first question at signup is not "which modules" — a new
// customer cannot answer that, having never seen them — but "what kind
// of business are you, and how many people". Those two they can answer
// instantly, and between them they predict the answer well enough to
// pre-tick the boxes. The customer then adjusts and moves on.
//
// This file holds ONLY that mapping. It is pure: no database, no React,
// no I/O — because the recommendation is a product decision that should
// be arguable in a test rather than discovered in a signup funnel.
//
// A RECOMMENDATION IS NOT A RESTRICTION. Everything here is a starting
// tick, changed in the picker at signup and again later in
// Settings → Modules. Nothing is locked.
// ============================================================

import { MODULE_KEYS, type ModuleKey } from '@/lib/auth/modules';

export interface BusinessType {
  id: string;
  label: string;
  /** What this covers, in the customer's words rather than ours. */
  description: string;
  /** The starting set, before team size is considered. */
  modules: ModuleKey[];
}

/**
 * Deliberately concrete labels. "Services" or "Trading" would cover
 * more businesses and help none of them choose — someone running a
 * salon needs to see something that sounds like a salon.
 *
 * CRM is absent from these lists because it is added unconditionally
 * below: every one of these businesses talks to customers, and it is
 * the spine the rest of the product hangs from.
 */
export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'retail_shop',
    label: 'Retail shop or showroom',
    description: 'You sell over a counter — groceries, clothing, electronics, jewellery.',
    modules: ['retail', 'accounting'],
  },
  {
    id: 'restaurant',
    label: 'Restaurant, café or cloud kitchen',
    description: 'Table or counter service, a kitchen, and stock that spoils.',
    modules: ['bar', 'retail', 'accounting'],
  },
  {
    id: 'bar',
    label: 'Bar, pub or lounge',
    description: 'Drinks service with stock measured by the peg and the bottle.',
    modules: ['bar', 'retail', 'accounting'],
  },
  {
    id: 'wholesale',
    label: 'Wholesale or distribution',
    description: 'You supply other businesses, in bulk, usually on credit.',
    modules: ['retail', 'accounting'],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing or production',
    description: 'You make things — raw material in, finished goods out.',
    modules: ['retail', 'accounting', 'projects'],
  },
  {
    id: 'agency',
    label: 'Marketing or creative agency',
    description: 'Client work billed by retainer or project.',
    modules: ['projects', 'marketing', 'accounting'],
  },
  {
    id: 'it_services',
    label: 'Software or IT services',
    description: 'Development, support or managed services for clients.',
    modules: ['projects', 'accounting'],
  },
  {
    id: 'professional_services',
    label: 'Consulting, CA, legal or advisory',
    description: 'You sell expertise, tracked by engagement and hours.',
    modules: ['projects', 'accounting'],
  },
  {
    id: 'healthcare',
    label: 'Clinic, diagnostics or wellness',
    description: 'Appointments, patients and a front desk.',
    modules: ['accounting'],
  },
  {
    id: 'education',
    label: 'School, coaching or training',
    description: 'Students, batches, fees and enquiries.',
    modules: ['marketing', 'accounting'],
  },
  {
    id: 'real_estate',
    label: 'Real estate or construction',
    description: 'Long sales cycles, site work, and enquiries worth chasing.',
    modules: ['marketing', 'projects', 'accounting'],
  },
  {
    id: 'staffing',
    label: 'Recruitment or staffing',
    description: 'You place people — candidates on one side, clients on the other.',
    modules: ['hr', 'projects'],
  },
  {
    id: 'logistics',
    label: 'Logistics or field services',
    description: 'Work happens away from the office — delivery, repair, installation.',
    modules: ['projects', 'accounting'],
  },
  {
    id: 'freelancer',
    label: 'Freelancer or solo business',
    description: 'It is mostly you, and you would like the paperwork to be quick.',
    modules: ['projects', 'accounting'],
  },
  {
    id: 'other',
    label: 'Something else',
    description: 'Start with the essentials and add what you need as you go.',
    modules: ['accounting'],
  },
];

export interface TeamSize {
  id: string;
  label: string;
  description: string;
}

export const TEAM_SIZES: TeamSize[] = [
  { id: 'solo', label: 'Just me', description: 'No staff to roster or pay' },
  { id: 'small', label: '2 – 10 people', description: 'A small team who mostly know what everyone is doing' },
  { id: 'medium', label: '11 – 50 people', description: 'Attendance, leave and payroll start to matter' },
  { id: 'large', label: 'More than 50', description: 'Formal HR processes across departments' },
];

/**
 * Businesses where people work shifts, so attendance and rostering
 * matter well before the headcount is large. A five-person restaurant
 * needs a roster; a five-person consultancy does not.
 */
const SHIFT_BASED = new Set([
  'retail_shop',
  'restaurant',
  'bar',
  'manufacturing',
  'logistics',
  'healthcare',
]);

export function findBusinessType(id: string | null | undefined): BusinessType {
  return BUSINESS_TYPES.find((b) => b.id === id) ?? BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

/**
 * The modules to pre-tick for this kind of business at this size.
 *
 * Returned in MODULE_KEYS order rather than the order rules happened to
 * add them, so the picker renders consistently and a snapshot of the
 * result is stable.
 */
export function recommendModules(
  businessTypeId: string | null | undefined,
  teamSizeId: string | null | undefined,
): ModuleKey[] {
  const type = findBusinessType(businessTypeId);
  const chosen = new Set<ModuleKey>(type.modules);

  // Every business here has customers to keep track of, and the rest of
  // the product refers back to them.
  chosen.add('crm');

  // HR earns its place by headcount, or by the work being shift-based.
  if (teamSizeId === 'solo') {
    // Nobody to roster, nobody to pay. Recruitment is the exception:
    // its whole business is other people.
    if (type.id !== 'staffing') chosen.delete('hr');
  } else if (teamSizeId === 'small') {
    if (SHIFT_BASED.has(type.id)) chosen.add('hr');
  } else if (teamSizeId === 'medium' || teamSizeId === 'large') {
    chosen.add('hr');
  }

  return MODULE_KEYS.filter((k) => chosen.has(k));
}

/**
 * Why a module was pre-ticked, for the picker to show under the card.
 *
 * A recommendation the customer cannot interrogate is just a default
 * they will distrust — and turning off something they needed is a
 * worse outcome than leaving on something they did not.
 */
export function recommendationReason(
  moduleKey: ModuleKey,
  businessTypeId: string | null | undefined,
  teamSizeId: string | null | undefined,
): string | null {
  const type = findBusinessType(businessTypeId);
  if (!recommendModules(businessTypeId, teamSizeId).includes(moduleKey)) return null;

  if (moduleKey === 'crm') return 'Everyone needs somewhere to keep customers.';
  if (moduleKey === 'hr') {
    if (type.id === 'staffing') return 'Placing people is the business.';
    if (teamSizeId === 'medium' || teamSizeId === 'large') {
      return 'At your size, attendance and payroll are worth automating.';
    }
    return 'Shift work needs a roster, whatever the headcount.';
  }
  return `Typical for ${type.label.toLowerCase()}.`;
}
