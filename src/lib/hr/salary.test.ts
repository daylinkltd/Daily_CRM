import { describe, it, expect } from "vitest";
import {
  computeSalaryBreakdown,
  basicForTargetGross,
  validateStructure,
  round2,
  type SalaryComponent,
} from "./salary";

/** The seeded starter structure from migration 089. */
const STANDARD: SalaryComponent[] = [
  { id: "1", name: "Basic Salary", code: "BASIC", type: "EARNING", calculation_type: "PERCENTAGE_OF_BASIC", value_number: 100, is_statutory: false, payroll_field: "basic_salary", sort_order: 10 },
  { id: "2", name: "HRA", code: "HRA", type: "EARNING", calculation_type: "PERCENTAGE_OF_BASIC", value_number: 40, is_statutory: false, payroll_field: "hra", sort_order: 20 },
  { id: "3", name: "Conveyance", code: "CONV", type: "EARNING", calculation_type: "FIXED_AMOUNT", value_number: 1600, is_statutory: false, payroll_field: "special_allowance", sort_order: 30 },
  { id: "4", name: "Medical", code: "MED", type: "EARNING", calculation_type: "FIXED_AMOUNT", value_number: 1250, is_statutory: false, payroll_field: "special_allowance", sort_order: 40 },
  { id: "5", name: "Provident Fund", code: "PF", type: "DEDUCTION", calculation_type: "PERCENTAGE_OF_BASIC", value_number: 12, is_statutory: true, payroll_field: "pf_deduction", sort_order: 60 },
  { id: "6", name: "Professional Tax", code: "PT", type: "DEDUCTION", calculation_type: "FIXED_AMOUNT", value_number: 200, is_statutory: true, payroll_field: "professional_tax", sort_order: 70 },
];

describe("computeSalaryBreakdown", () => {
  it("computes earnings, deductions and net for a standard structure", () => {
    const r = computeSalaryBreakdown(STANDARD, 30_000);
    // 30000 basic + 12000 HRA + 1600 + 1250 = 44850
    expect(r.grossMonthly).toBe(44_850);
    // 3600 PF + 200 PT
    expect(r.totalDeductions).toBe(3_800);
    expect(r.netMonthly).toBe(41_050);
    expect(r.ctcAnnual).toBe(538_200);
  });

  it("does not double count basic in gross", () => {
    // The 100%-of-basic component reports basic; it must not add a
    // second 30000 on top of the input.
    const r = computeSalaryBreakdown(STANDARD, 30_000);
    const basicLine = r.earnings.find((l) => l.payroll_field === "basic_salary");
    expect(basicLine?.amount).toBe(30_000);
    expect(r.basic).toBe(30_000);
    expect(r.grossMonthly).toBeLessThan(60_000);
  });

  it("accumulates several components into one payroll column", () => {
    const r = computeSalaryBreakdown(STANDARD, 30_000);
    // Conveyance 1600 + Medical 1250 both map to special_allowance.
    expect(r.payrollFields.special_allowance).toBe(2_850);
    expect(r.payrollFields.hra).toBe(12_000);
    expect(r.payrollFields.pf_deduction).toBe(3_600);
    expect(r.payrollFields.professional_tax).toBe(200);
  });

  it("leaves unmapped payroll columns at zero", () => {
    const r = computeSalaryBreakdown(STANDARD, 30_000);
    expect(r.payrollFields.tds_deduction).toBe(0);
  });

  it("keeps printed lines summing to the printed total", () => {
    // 33333 * 40% = 13333.2 — a case where rounding once at the end
    // would leave the lines not adding up to the shown gross.
    const r = computeSalaryBreakdown(STANDARD, 33_333);
    const sum = round2(r.earnings.reduce((s, l) => s + l.amount, 0));
    expect(sum).toBe(r.grossMonthly);
    const dsum = round2(r.deductions.reduce((s, l) => s + l.amount, 0));
    expect(dsum).toBe(r.totalDeductions);
  });

  it("respects sort order regardless of input order", () => {
    const shuffled = [STANDARD[3], STANDARD[0], STANDARD[2], STANDARD[1]];
    const r = computeSalaryBreakdown(shuffled, 10_000);
    expect(r.earnings.map((l) => l.code)).toEqual(["BASIC", "HRA", "CONV", "MED"]);
  });

  it("treats a negative basic as zero", () => {
    const r = computeSalaryBreakdown(STANDARD, -5_000);
    expect(r.basic).toBe(0);
    expect(r.netMonthly).toBe(round2(2_850 - 200));
  });

  it("handles an empty structure", () => {
    const r = computeSalaryBreakdown([], 30_000);
    expect(r.grossMonthly).toBe(0);
    expect(r.netMonthly).toBe(0);
  });
});

describe("basicForTargetGross", () => {
  it("inverts computeSalaryBreakdown", () => {
    const basic = basicForTargetGross(STANDARD, 44_850);
    expect(basic).toBe(30_000);
    expect(computeSalaryBreakdown(STANDARD, basic).grossMonthly).toBe(44_850);
  });

  it("round-trips a non-round target", () => {
    const target = 75_000;
    const basic = basicForTargetGross(STANDARD, target);
    // Allow a rounding cent, but it must land on the target.
    expect(Math.abs(computeSalaryBreakdown(STANDARD, basic).grossMonthly - target)).toBeLessThan(1);
  });

  it("returns zero when fixed earnings already exceed the target", () => {
    expect(basicForTargetGross(STANDARD, 1_000)).toBe(0);
  });
});

describe("validateStructure", () => {
  it("passes a well-formed structure", () => {
    expect(validateStructure(STANDARD)).toEqual([]);
  });

  it("flags a missing basic head", () => {
    const problems = validateStructure(STANDARD.filter((c) => c.code !== "BASIC"));
    expect(problems.join(" ")).toMatch(/Basic Salary/);
  });

  it("flags two components mapped to basic", () => {
    const dup = [...STANDARD, { ...STANDARD[0], id: "9", name: "Basic 2" }];
    expect(validateStructure(dup).join(" ")).toMatch(/More than one/);
  });

  it("flags a percentage above 100 and a negative value", () => {
    const bad: SalaryComponent[] = [
      ...STANDARD,
      { ...STANDARD[1], id: "10", name: "Silly HRA", value_number: 150 },
      { ...STANDARD[2], id: "11", name: "Negative", value_number: -50 },
    ];
    const out = validateStructure(bad).join(" ");
    expect(out).toMatch(/more than basic itself/);
    expect(out).toMatch(/negative value/);
  });

  it("flags basic falling below the configured floor", () => {
    // Basic is ~64% of gross here, so a 70% floor must complain.
    expect(validateStructure(STANDARD, 70).join(" ")).toMatch(/below the 70% floor/);
    expect(validateStructure(STANDARD, 50)).toEqual([]);
  });
});
