'use client';

// ============================================================
// ModulePicker — two questions, then a set of pre-ticked cards.
//
// Used in three places that must agree: onboarding, the create-workspace
// dialog, and Settings → Modules. One component rather than three, so
// the recommendation a customer sees at signup is the same one they see
// when they revisit it.
//
// WHY QUESTIONS FIRST. A new customer cannot answer "which modules do
// you want" — they have never seen the modules. They can answer "what
// kind of business are you" instantly, and that predicts the answer
// well enough to pre-tick the boxes. Once ticked, the cards are just
// confirmation, which is a much easier act than selection.
//
// In settings the questions are already answered, so the picker opens
// on the cards with the questions available above them.
// ============================================================

import { useMemo } from 'react';
import { Check } from 'lucide-react';

import {
  MODULE_KEYS,
  MODULE_LABELS,
  type ModuleKey,
} from '@/lib/auth/modules';
import {
  BUSINESS_TYPES,
  TEAM_SIZES,
  recommendModules,
  recommendationReason,
} from '@/lib/workspace/module-templates';
import { cn } from '@/lib/utils';

/**
 * What each module does, in one line, for someone who has not used it.
 * The marketing copy in modules-content.ts is written to sell; this is
 * written to help somebody decide in about two seconds.
 */
const MODULE_BLURB: Record<ModuleKey, string> = {
  crm: 'Customers, enquiries, deals and WhatsApp conversations.',
  marketing: 'Campaigns, broadcasts and lead capture forms.',
  accounting: 'Invoices, payments, ledgers and GST.',
  hr: 'Staff records, attendance, leave, payroll and letters.',
  retail: 'Point of sale, products, stock and purchasing.',
  bar: 'Table service, kitchen orders and bar stock by the peg.',
  printing: 'Printing job orders — enquiry, quotation, production and delivery.',
  projects: 'Projects, tasks, timesheets and billable hours.',
};

export interface ModuleSelection {
  businessType: string | null;
  teamSize: string | null;
  modules: ModuleKey[];
}

interface Props {
  value: ModuleSelection;
  /**
   * A React state setter, so every update below can be FUNCTIONAL.
   *
   * Taking a plain `(next) => void` meant each handler computed its
   * result from the `value` prop, which is a snapshot of the last
   * render. Two changes in the same tick then both built on the same
   * stale snapshot and the first was silently discarded -- answering
   * two questions quickly lost the first answer.
   */
  onChange: React.Dispatch<React.SetStateAction<ModuleSelection>>;
  /** Settings opens straight on the cards; signup asks first. */
  compact?: boolean;
  disabled?: boolean;
}

export function ModulePicker({ value, onChange, compact = false, disabled = false }: Props) {
  const recommended = useMemo(
    () => recommendModules(value.businessType, value.teamSize),
    [value.businessType, value.teamSize],
  );

  /**
   * Answering a question re-ticks the cards.
   *
   * Deliberately overwrites the selection rather than merging: someone
   * who changes their answer from "agency" to "restaurant" wants the
   * restaurant set, not the union of both. Their manual changes are
   * only lost when they change an answer, which is the one moment they
   * expect the recommendation to move.
   */
  const answer = (patch: Partial<Pick<ModuleSelection, 'businessType' | 'teamSize'>>) => {
    onChange((prev) => {
      const businessType = patch.businessType ?? prev.businessType;
      const teamSize = patch.teamSize ?? prev.teamSize;
      return { businessType, teamSize, modules: recommendModules(businessType, teamSize) };
    });
  };

  const toggle = (key: ModuleKey) => {
    onChange((prev) => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter((m) => m !== key)
        // Rebuilt from MODULE_KEYS so the list stays in canonical order
        // however many times it is toggled.
        : MODULE_KEYS.filter((m) => m === key || prev.modules.includes(m)),
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Question 1 ---- */}
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="text-sm font-semibold text-foreground">
          What kind of business is this?
        </legend>
        <p className="text-xs text-muted-foreground">
          We use this to switch on the parts you are likely to need. You can change any of it below.
        </p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {BUSINESS_TYPES.map((type) => {
            const active = value.businessType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => answer({ businessType: type.id })}
                aria-pressed={active}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background/40 hover:bg-muted/50',
                )}
              >
                <span className="block text-sm font-medium text-foreground">{type.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {type.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ---- Question 2 ---- */}
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="text-sm font-semibold text-foreground">How many people work here?</legend>
        <p className="text-xs text-muted-foreground">
          This decides whether staff tools like attendance and payroll are worth switching on.
        </p>
        <div className="mt-1 grid gap-2 sm:grid-cols-4">
          {TEAM_SIZES.map((size) => {
            const active = value.teamSize === size.id;
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => answer({ teamSize: size.id })}
                aria-pressed={active}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background/40 hover:bg-muted/50',
                )}
              >
                <span className="block text-sm font-medium text-foreground">{size.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {size.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ---- The cards ---- */}
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="text-sm font-semibold text-foreground">
          {compact ? 'Modules' : 'Switch on what you need'}
        </legend>
        <p className="text-xs text-muted-foreground">
          Anything off here is hidden from the sidebar for everyone. Nothing is deleted, and you can
          turn it back on in Settings → Modules whenever you like.
        </p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {MODULE_KEYS.map((key) => {
            const on = value.modules.includes(key);
            const why = recommendationReason(key, value.businessType, value.teamSize);
            const isRecommended = recommended.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                aria-pressed={on}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  on
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border bg-background/40 hover:bg-muted/50',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {MODULE_LABELS[key]}
                    </span>
                    {isRecommended && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Suggested
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {MODULE_BLURB[key]}
                  </span>
                  {/* The reason the box was ticked. A recommendation you
                      cannot interrogate is a default you distrust. */}
                  {why && on && (
                    <span className="mt-1 block text-[11px] italic text-muted-foreground/80">
                      {why}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {value.modules.length === 0 && (
          <p className="text-xs font-medium text-amber-500">
            Nothing selected — we will switch everything on rather than leave you with an empty
            sidebar.
          </p>
        )}
      </fieldset>
    </div>
  );
}

/** The starting state for a workspace that has never been asked. */
export function initialSelection(
  businessType?: string | null,
  teamSize?: string | null,
  modules?: readonly string[] | null,
): ModuleSelection {
  return {
    businessType: businessType ?? null,
    teamSize: teamSize ?? null,
    modules:
      modules && modules.length > 0
        ? MODULE_KEYS.filter((k) => modules.includes(k))
        : recommendModules(businessType, teamSize),
  };
}
