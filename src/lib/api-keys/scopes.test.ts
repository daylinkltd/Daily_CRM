import { describe, expect, it } from 'vitest';

import { V1_SCOPE_RESOURCES } from '@/lib/api/v1/resource-registry';
import {
  API_SCOPES,
  LEGACY_API_SCOPES,
  SCOPE_DESCRIPTIONS,
  SCOPE_GROUPS,
  V1_ACTIONS,
  hasScope,
  isApiScope,
  normalizeScopes,
} from './scopes';

describe('API scopes', () => {
  // Keys already issued carry these. Regenerating the list must not
  // invalidate them — `messages:send` in particular gates the send route.
  it('keeps every pre-existing scope grantable', () => {
    for (const legacy of [
      'messages:send',
      'messages:read',
      'contacts:read',
      'contacts:write',
      'conversations:read',
      'broadcasts:send',
    ]) {
      expect(isApiScope(legacy)).toBe(true);
    }
  });

  it('grants read, write and delete for every exposed resource', () => {
    for (const r of V1_SCOPE_RESOURCES) {
      for (const action of V1_ACTIONS) {
        expect(isApiScope(`${r.key}:${action}`)).toBe(true);
      }
    }
  });

  it('covers all five modules', () => {
    for (const key of ['contacts:read', 'payroll:read', 'products:read', 'accounting:read', 'projects:read']) {
      expect(isApiScope(key)).toBe(true);
    }
  });

  it('never grants a scope for an unexposed resource', () => {
    expect(isApiScope('api_keys:read')).toBe(false);
    expect(isApiScope('api_keys:write')).toBe(false);
    expect(isApiScope('profiles:read')).toBe(false);
  });

  it('rejects malformed scopes', () => {
    expect(isApiScope('contacts')).toBe(false);
    expect(isApiScope('contacts:')).toBe(false);
    expect(isApiScope('contacts:admin')).toBe(false);
    expect(isApiScope('*')).toBe(false);
    expect(isApiScope(null)).toBe(false);
    expect(isApiScope(42)).toBe(false);
  });

  it('describes every scope it offers, so no blank UI rows', () => {
    for (const scope of API_SCOPES) {
      expect(SCOPE_DESCRIPTIONS[scope], scope).toBeTruthy();
    }
  });

  it('has no duplicate scopes', () => {
    expect(new Set(API_SCOPES).size).toBe(API_SCOPES.length);
  });

  it('groups every scope exactly once for display', () => {
    const grouped = SCOPE_GROUPS.flatMap((g) => g.scopes);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(new Set(API_SCOPES));
  });

  it('keeps the legacy messaging wording rather than a generated one', () => {
    expect(SCOPE_DESCRIPTIONS['messages:send']).toBe('Send WhatsApp messages');
    // `contacts:read` is generated now but must still read sensibly.
    expect(SCOPE_DESCRIPTIONS['contacts:read']).toMatch(/read/i);
  });

  describe('normalizeScopes', () => {
    it('accepts a valid list and de-duplicates it', () => {
      expect(normalizeScopes(['payroll:read', 'payroll:read'])).toEqual([
        'payroll:read',
      ]);
    });

    it('accepts an empty list', () => {
      expect(normalizeScopes([])).toEqual([]);
    });

    it('rejects the whole list if any entry is unknown', () => {
      expect(normalizeScopes(['payroll:read', 'api_keys:write'])).toBeNull();
      expect(normalizeScopes(['nope'])).toBeNull();
    });

    it('rejects non-arrays', () => {
      expect(normalizeScopes('payroll:read')).toBeNull();
      expect(normalizeScopes(null)).toBeNull();
    });
  });

  describe('hasScope', () => {
    it('is an exact match, never a prefix or wildcard', () => {
      expect(hasScope(['payroll:read'], 'payroll:read')).toBe(true);
      expect(hasScope(['payroll:read'], 'payroll:write')).toBe(false);
      expect(hasScope(['payroll:read'], 'payroll:delete')).toBe(false);
      // A read grant must not imply write on a differently-named resource
      // that happens to share a prefix.
      expect(hasScope(['project:read'], 'project_invoices:read')).toBe(false);
    });

    it('does not treat write as implying delete', () => {
      expect(hasScope(['leave:write'], 'leave:delete')).toBe(false);
    });
  });

  it('offers the legacy messaging scopes plus three per resource', () => {
    // contacts:read / contacts:write predate the catalog but are generated
    // from it now, so they are not in LEGACY_API_SCOPES and not double-counted.
    expect(API_SCOPES.length).toBe(
      LEGACY_API_SCOPES.length + V1_SCOPE_RESOURCES.length * V1_ACTIONS.length
    );
  });
});
