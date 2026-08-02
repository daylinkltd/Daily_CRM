/**
 * Salary structure evaluation — pure, no I/O, unit tested.
 *
 * A structure is a named slab made of ordered components. Each is an
 * EARNING or a DEDUCTION, computed either as a percentage of basic or
 * as a fixed monthly amount.
 *
 * The six flat columns on `employee_profiles` stay authoritative for
 * payroll: the processor and the ledger posting rule read them
 * directly. A structure computes values INTO those columns via each
 * component's `payroll_field`, so nothing downstream has to change.
 *
 * Money is handled in whole currency units rounded to 2dp at each
 * component, deliberately: a payslip has to add up exactly as printed,
 * so rounding once at the end would leave the printed lines not summing
 * to the printed total.
 */

export type ComponentType = "EARNING" | "DEDUCTION";
export type CalculationType = "PERCENTAGE_OF_BASIC" | "FIXED_AMOUNT";

/** The flat columns a component can feed. */
export const PAYROLL_FIELDS = [
  "basic_salary",
  "hra",
  "special_allowance",
  "pf_deduction",
  "professional_tax",
  "tds_deduction",
] as const;
export type PayrollField = (typeof PAYROLL_FIELDS)[number];

export interface SalaryComponent {
  id: string;
  name: string;
  code: string | null;
  type: ComponentType;
  calculation_type: CalculationType;
  /** Percent when PERCENTAGE_OF_BASIC, else a monthly amount. */
  value_number: number;
  is_statutory: boolean;
  payroll_field: PayrollField | null;
  sort_order: number;
}

export interface ComputedLine {
  component_id: string;
  name: string;
  code: string | null;
  type: ComponentType;
  calculation_type: CalculationType;
  /** The configured percent or amount, echoed for display. */
  rate: number;
  /** Monthly value in currency units. */
  amount: number;
  is_statutory: boolean;
  payroll_field: PayrollField | null;
}

export interface SalaryBreakdown {
  basic: number;
  earnings: ComputedLine[];
  deductions: ComputedLine[];
  grossMonthly: number;
  totalDeductions: number;
  netMonthly: number;
  ctcAnnual: number;
  /** Values to write to the six flat employee_profiles columns. */
  payrollFields: Record<PayrollField, number>;
}

/** Round to 2dp without the float drift of toFixed on .005 cases. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function componentAmount(c: SalaryComponent, basic: number): number {
  if (c.calculation_type === "PERCENTAGE_OF_BASIC") {
    return round2((basic * c.value_number) / 100);
  }
  return round2(c.value_number);
}

/**
 * Evaluate a structure against a monthly basic salary.
 *
 * The component whose payroll_field is `basic_salary` is not summed
 * from itself — basic is the input, and a 100%-of-basic component
 * simply reports it. Without that, basic would be double counted in
 * gross.
 */
export function computeSalaryBreakdown(
  components: SalaryComponent[],
  monthlyBasic: number
): SalaryBreakdown {
  const basic = round2(Math.max(0, monthlyBasic));
  const ordered = [...components].sort((a, b) => a.sort_order - b.sort_order);

  const earnings: ComputedLine[] = [];
  const deductions: ComputedLine[] = [];

  const payrollFields = PAYROLL_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f]: 0 }),
    {} as Record<PayrollField, number>
  );

  for (const c of ordered) {
    const isBasicHead = c.payroll_field === "basic_salary";
    const amount = isBasicHead ? basic : componentAmount(c, basic);

    const line: ComputedLine = {
      component_id: c.id,
      name: c.name,
      code: c.code,
      type: c.type,
      calculation_type: c.calculation_type,
      rate: c.value_number,
      amount,
      is_statutory: c.is_statutory,
      payroll_field: c.payroll_field,
    };

    if (c.type === "EARNING") earnings.push(line);
    else deductions.push(line);

    // Several components can map to the same column — conveyance and
    // medical both land in special_allowance — so accumulate.
    if (c.payroll_field) {
      payrollFields[c.payroll_field] = round2(payrollFields[c.payroll_field] + amount);
    }
  }

  const grossMonthly = round2(earnings.reduce((s, l) => s + l.amount, 0));
  const totalDeductions = round2(deductions.reduce((s, l) => s + l.amount, 0));

  return {
    basic,
    earnings,
    deductions,
    grossMonthly,
    totalDeductions,
    netMonthly: round2(grossMonthly - totalDeductions),
    // CTC here is gross annualised. Employer-side contributions are not
    // modelled yet, so this is deliberately not "gross + employer PF".
    ctcAnnual: round2(grossMonthly * 12),
    payrollFields,
  };
}

/**
 * Given a target monthly gross and a structure, find the basic that
 * produces it.
 *
 * Solved algebraically rather than by search: every earning is either a
 * percentage of basic or a constant, so
 *   gross = basic * (1 + Σpercent/100) + Σfixed
 * and basic falls straight out. Returns 0 when the fixed earnings alone
 * already exceed the target.
 */
export function basicForTargetGross(
  components: SalaryComponent[],
  targetMonthlyGross: number
): number {
  let percentSum = 0;
  let fixedSum = 0;

  for (const c of components) {
    if (c.type !== "EARNING") continue;
    if (c.payroll_field === "basic_salary") continue; // basic is the unknown
    if (c.calculation_type === "PERCENTAGE_OF_BASIC") percentSum += c.value_number;
    else fixedSum += c.value_number;
  }

  const multiplier = 1 + percentSum / 100;
  if (multiplier <= 0) return 0;

  return round2(Math.max(0, (targetMonthlyGross - fixedSum) / multiplier));
}

/**
 * Warn where a structure is likely misconfigured. Returned as messages
 * rather than thrown: a half-built structure must still be saveable.
 */
export function validateStructure(
  components: SalaryComponent[],
  minBasicPercent = 0
): string[] {
  const problems: string[] = [];

  const basicHeads = components.filter((c) => c.payroll_field === "basic_salary");
  if (basicHeads.length === 0) {
    problems.push("No component is mapped to Basic Salary, so nothing anchors the percentages.");
  } else if (basicHeads.length > 1) {
    problems.push("More than one component is mapped to Basic Salary.");
  }

  for (const c of components) {
    if (c.calculation_type === "PERCENTAGE_OF_BASIC" && c.value_number > 100) {
      problems.push(`"${c.name}" is ${c.value_number}% of basic, which is more than basic itself.`);
    }
    if (c.value_number < 0) {
      problems.push(`"${c.name}" has a negative value.`);
    }
  }

  if (minBasicPercent > 0) {
    // Check against a representative salary; the ratio is scale-free for
    // percentage components, so any positive basic gives the same answer
    // as long as fixed components are included.
    const sample = computeSalaryBreakdown(components, 10_000);
    if (sample.grossMonthly > 0) {
      const basicShare = (sample.basic / sample.grossMonthly) * 100;
      if (basicShare < minBasicPercent) {
        problems.push(
          `Basic is ${basicShare.toFixed(1)}% of gross, below the ${minBasicPercent}% floor set on this structure.`
        );
      }
    }
  }

  return problems;
}
