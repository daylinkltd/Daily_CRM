import { describe, expect, it } from 'vitest';

import {
  BUSINESS_TYPES,
  TEAM_SIZES,
  findBusinessType,
  recommendModules,
  recommendationReason,
} from './module-templates';
import { MODULE_KEYS, applyWorkspaceModules, type ModuleAccess } from '@/lib/auth/modules';

/**
 * These decide what a new customer sees on their first screen. Getting
 * them wrong is not a crash — it is a restaurant owner looking at a
 * project tracker and concluding the product is not for them.
 */

describe('the catalogue itself', () => {
  it('offers only real module keys', () => {
    for (const type of BUSINESS_TYPES) {
      for (const m of type.modules) {
        expect(MODULE_KEYS).toContain(m);
      }
    }
  });

  it('has unique ids', () => {
    const ids = BUSINESS_TYPES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sizes = TEAM_SIZES.map((t) => t.id);
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('describes every option, because a bare label does not help anyone choose', () => {
    for (const type of BUSINESS_TYPES) {
      expect(type.description.length).toBeGreaterThan(10);
    }
  });
});

describe('findBusinessType', () => {
  it('falls back to the catch-all rather than throwing on an unknown id', () => {
    expect(findBusinessType('not_a_real_type').id).toBe('other');
    expect(findBusinessType(null).id).toBe('other');
    expect(findBusinessType(undefined).id).toBe('other');
  });
});

describe('recommendModules', () => {
  it('always includes CRM — it is the spine, not an add-on', () => {
    for (const type of BUSINESS_TYPES) {
      for (const size of TEAM_SIZES) {
        expect(recommendModules(type.id, size.id)).toContain('crm');
      }
    }
  });

  it('never recommends nothing', () => {
    for (const type of BUSINESS_TYPES) {
      for (const size of TEAM_SIZES) {
        expect(recommendModules(type.id, size.id).length).toBeGreaterThan(0);
      }
    }
  });

  it('returns modules in a stable order regardless of how rules added them', () => {
    const out = recommendModules('restaurant', 'large');
    expect(out).toEqual(MODULE_KEYS.filter((k) => out.includes(k)));
  });

  it('gives a restaurant a till and a kitchen, not a project tracker', () => {
    const out = recommendModules('restaurant', 'small');
    expect(out).toContain('bar');
    expect(out).toContain('retail');
    expect(out).not.toContain('projects');
  });

  it('gives an agency projects, not a bar till', () => {
    const out = recommendModules('agency', 'small');
    expect(out).toContain('projects');
    expect(out).toContain('marketing');
    expect(out).not.toContain('bar');
  });

  describe('HR is earned, not assumed', () => {
    it('is left off for a one-person business', () => {
      expect(recommendModules('freelancer', 'solo')).not.toContain('hr');
      expect(recommendModules('agency', 'solo')).not.toContain('hr');
    });

    it('appears for a small SHIFT-based business, where rosters matter early', () => {
      expect(recommendModules('restaurant', 'small')).toContain('hr');
      expect(recommendModules('retail_shop', 'small')).toContain('hr');
    });

    it('stays off for a small desk-based business', () => {
      // Five consultants do not need an attendance system.
      expect(recommendModules('professional_services', 'small')).not.toContain('hr');
    });

    it('appears once the headcount is large enough for anyone', () => {
      expect(recommendModules('professional_services', 'medium')).toContain('hr');
      expect(recommendModules('it_services', 'large')).toContain('hr');
    });

    it('is kept for a solo recruiter, whose business IS other people', () => {
      expect(recommendModules('staffing', 'solo')).toContain('hr');
    });
  });

  it('falls back to a usable set for an unknown business type', () => {
    const out = recommendModules('mystery', 'small');
    expect(out).toContain('crm');
    expect(out).toContain('accounting');
  });
});

describe('recommendationReason', () => {
  it('explains a module that was recommended', () => {
    expect(recommendationReason('bar', 'restaurant', 'small')).toBeTruthy();
  });

  it('says nothing about a module that was not', () => {
    expect(recommendationReason('bar', 'agency', 'small')).toBeNull();
  });

  it('gives size-specific and shift-specific reasons for HR', () => {
    expect(recommendationReason('hr', 'professional_services', 'medium')).toContain('your size');
    expect(recommendationReason('hr', 'restaurant', 'small')).toContain('Shift work');
  });
});

describe('applyWorkspaceModules', () => {
  const all: ModuleAccess = {
    crm: true, marketing: true, accounting: true, hr: true,
    retail: true, bar: true, printing: true, projects: true,
  };

  it('hides what the business did not turn on', () => {
    const out = applyWorkspaceModules(all, ['crm', 'accounting']);
    expect(out.crm).toBe(true);
    expect(out.accounting).toBe(true);
    expect(out.bar).toBe(false);
    expect(out.projects).toBe(false);
  });

  it('never GRANTS a module the role did not allow', () => {
    // The layers intersect; a workspace selection cannot widen access.
    const limited: ModuleAccess = { ...all, hr: false };
    expect(applyWorkspaceModules(limited, ['crm', 'hr']).hr).toBe(false);
  });

  it('leaves a workspace with no selection completely alone', () => {
    // Every workspace predating this feature is in exactly this state
    // and must not lose its sidebar.
    expect(applyWorkspaceModules(all, null)).toEqual(all);
    expect(applyWorkspaceModules(all, undefined)).toEqual(all);
  });

  it('treats an empty list as "not chosen" rather than hiding everything', () => {
    // Hiding every module would leave no navigation to reach the
    // settings page that turns them back on.
    expect(applyWorkspaceModules(all, [])).toEqual(all);
  });

  it('ignores an unknown key without disturbing the rest', () => {
    const out = applyWorkspaceModules(all, ['crm', 'time_travel']);
    expect(out.crm).toBe(true);
    expect(out.retail).toBe(false);
  });
});
