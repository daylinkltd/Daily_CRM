// ============================================================
// API key scopes — pure, unit-testable, no I/O.
//
// Authorization for the public API is *scopes-only*: a key's
// capabilities are defined entirely by the scopes granted to it at
// creation, independent of the role of the user who minted it. (We
// still gate *key creation* at admin+, so only trusted members can
// hand out capabilities — see the management routes.)
//
// A scope is `<resource>:<action>`. Endpoints declare the single
// scope they require; `requireApiKey(request, scope)` enforces it.
//
// The resource scopes are GENERATED from the same catalog that drives
// the permission matrix and the RLS policies
// (src/lib/auth/resources.ts, via the v1 resource registry), so every
// module — CRM, HR, retail, accounting, projects — is reachable and a
// new resource cannot be added to the app without also being grantable
// over the API.
//
// Three actions per resource, deliberately not four: `read` and `write`
// match the pre-existing `contacts:read` / `contacts:write` pair, and
// `delete` is split out so a key can be allowed to create and edit
// without being able to destroy. The internal matrix keeps its finer
// create/update/delete split; a public key is a blunter instrument.
// ============================================================

import { V1_SCOPE_RESOURCES } from '@/lib/api/v1/resource-registry';
import type { ModuleKey } from '@/lib/auth/resources';

/** Actions a public key can be granted per resource. */
export const V1_ACTIONS = ['read', 'write', 'delete'] as const;
export type V1Action = (typeof V1_ACTIONS)[number];

/**
 * Scopes that predate the catalog-generated set. Kept verbatim so keys
 * already in the wild keep working — `messages:send` in particular is
 * what the WhatsApp send endpoint checks, and `messages`/`conversations`
 * are tables under the `inbox` resource rather than resources
 * themselves, so nothing would regenerate them.
 */
export const LEGACY_API_SCOPES = [
  'messages:send',
  'messages:read',
  'conversations:read',
  'broadcasts:send',
] as const;

export type LegacyApiScope = (typeof LEGACY_API_SCOPES)[number];

/** `<resource>:<action>` for every exposed resource. */
export type ResourceApiScope = `${string}:${V1Action}`;

export type ApiScope = LegacyApiScope | ResourceApiScope;

function buildScopes(): { scopes: ApiScope[]; descriptions: Record<string, string> } {
  const scopes: ApiScope[] = [...LEGACY_API_SCOPES];
  const descriptions: Record<string, string> = {
    'messages:send': 'Send WhatsApp messages',
    'messages:read': 'Read messages and their delivery status',
    'conversations:read': 'List and read conversations',
    'broadcasts:send': 'Launch broadcast campaigns',
  };

  const verb: Record<V1Action, string> = {
    read: 'List and read',
    write: 'Create and update',
    delete: 'Delete',
  };

  for (const resource of V1_SCOPE_RESOURCES) {
    for (const action of V1_ACTIONS) {
      const scope: ApiScope = `${resource.key}:${action}`;
      // A legacy scope with the same name wins — its wording is what
      // existing integrators already see in the docs.
      if (descriptions[scope]) continue;
      scopes.push(scope);
      descriptions[scope] = `${verb[action]} ${resource.label.toLowerCase()}`;
    }
  }

  return { scopes, descriptions };
}

const BUILT = buildScopes();

/** Every grantable scope. Iterated by the docs page and the key UI. */
export const API_SCOPES: readonly ApiScope[] = BUILT.scopes;

/** Human-readable descriptions, surfaced in the key-creation UI. */
export const SCOPE_DESCRIPTIONS: Record<string, string> = BUILT.descriptions;

// Deliberately Set<string>: its job is to test untrusted input, which is
// only ever `string` before narrowing.
const SCOPE_SET = new Set<string>(BUILT.scopes);

export interface ScopeGroup {
  /** `null` for the legacy messaging scopes, which predate modules. */
  module: ModuleKey | null;
  label: string;
  scopes: ApiScope[];
}

/**
 * Scopes grouped for display. With one entry per resource per action the
 * flat list runs past a hundred checkboxes, which is unusable as a single
 * column — the settings UI renders these groups instead.
 */
export const SCOPE_GROUPS: readonly ScopeGroup[] = (() => {
  const moduleLabels: Record<ModuleKey, string> = {
    crm: 'CRM',
    accounting: 'Accounting',
    hr: 'HR',
    retail: 'Retail',
    projects: 'Projects',
  };

  const groups: ScopeGroup[] = [
    { module: null, label: 'Messaging', scopes: [...LEGACY_API_SCOPES] },
  ];

  for (const [module, label] of Object.entries(moduleLabels) as [ModuleKey, string][]) {
    const scopes = V1_SCOPE_RESOURCES.filter((r) => r.module === module).flatMap((r) =>
      V1_ACTIONS.map((a): ApiScope => `${r.key}:${a}`).filter(
        (s) => !(LEGACY_API_SCOPES as readonly string[]).includes(s)
      )
    );
    if (scopes.length) groups.push({ module, label, scopes });
  }

  return groups;
})();

/** Type-narrow an unknown value into a valid `ApiScope`. */
export function isApiScope(value: unknown): value is ApiScope {
  return typeof value === 'string' && SCOPE_SET.has(value);
}

/**
 * Validate and de-duplicate a caller-supplied scope list. Returns
 * the cleaned list, or `null` if any entry is not a known scope
 * (callers turn that into a 400). An empty input is valid — it
 * yields a key that authenticates but can't do anything beyond the
 * scope-free endpoints (e.g. `GET /api/v1/me`).
 */
export function normalizeScopes(input: unknown): ApiScope[] | null {
  if (!Array.isArray(input)) return null;
  const out: ApiScope[] = [];
  for (const entry of input) {
    if (!isApiScope(entry)) return null;
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}

/**
 * True iff `granted` contains `required`. The single source of
 * truth for "is this key allowed to do X?" — both `requireApiKey`
 * and any future inline check should call this rather than poking
 * at the array directly.
 */
export function hasScope(
  granted: readonly string[],
  required: ApiScope
): boolean {
  return granted.includes(required);
}
