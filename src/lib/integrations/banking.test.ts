import { describe, expect, it } from "vitest";
import { totalsFromPayslips } from "./banking";

/**
 * The banking system posts DR gross salary against CR deductions + CR net, and
 * rejects the voucher outright if those do not reconcile. So the invariant that
 * matters here is: gross === net + sum(deductions).
 */
function slip(overrides: Partial<Record<string, number>> = {}) {
  return {
    total_earnings: 0,
    pf_deduction: 0,
    professional_tax: 0,
    tds_deduction: 0,
    advance_deduction: 0,
    net_payable: 0,
    ...overrides,
  };
}

describe("totalsFromPayslips", () => {
  it("sums gross, net and each deduction across payslips", () => {
    const totals = totalsFromPayslips([
      slip({ total_earnings: 50000, pf_deduction: 1800, professional_tax: 200, tds_deduction: 2000, net_payable: 46000 }),
      slip({ total_earnings: 30000, pf_deduction: 1800, professional_tax: 200, tds_deduction: 0, net_payable: 28000 }),
    ]);

    expect(totals.grossSalary).toBe(80000);
    expect(totals.netPayable).toBe(74000);
    expect(totals.deductions).toEqual([
      { role: "PF_PAYABLE", amount: 3600, label: "Provident Fund" },
      { role: "PROFESSIONAL_TAX_PAYABLE", amount: 400, label: "Professional Tax" },
      { role: "TDS_PAYABLE", amount: 2000, label: "TDS on Salary" },
    ]);
  });

  it("keeps gross equal to net plus deductions", () => {
    const totals = totalsFromPayslips([
      slip({ total_earnings: 50000, pf_deduction: 1800, professional_tax: 200, tds_deduction: 2000, advance_deduction: 5000, net_payable: 41000 }),
      slip({ total_earnings: 27500, pf_deduction: 1800, professional_tax: 200, tds_deduction: 1500, net_payable: 24000 }),
    ]);

    const deductionTotal = totals.deductions.reduce((sum, d) => sum + d.amount, 0);
    expect(totals.netPayable + deductionTotal).toBe(totals.grossSalary);
  });

  it("reports a recovered advance so the receivable is credited", () => {
    const totals = totalsFromPayslips([
      slip({ total_earnings: 40000, advance_deduction: 7500, net_payable: 32500 }),
    ]);

    expect(totals.deductions).toContainEqual({
      role: "STAFF_ADVANCE",
      amount: 7500,
      label: "Salary Advance Recovered",
    });
  });

  it("omits deductions that are zero rather than sending empty lines", () => {
    const totals = totalsFromPayslips([slip({ total_earnings: 20000, net_payable: 20000 })]);

    expect(totals.deductions).toEqual([]);
    expect(totals.grossSalary).toBe(20000);
    expect(totals.netPayable).toBe(20000);
  });

  it("accepts numeric strings, which is how Postgres numerics arrive", () => {
    const totals = totalsFromPayslips([
      {
        total_earnings: "50000.50",
        pf_deduction: "1800.25",
        professional_tax: "200",
        tds_deduction: "0",
        advance_deduction: "0",
        net_payable: "48000.25",
      },
    ]);

    expect(totals.grossSalary).toBe(50000.5);
    expect(totals.netPayable).toBe(48000.25);
    const deductionTotal = totals.deductions.reduce((sum, d) => sum + d.amount, 0);
    expect(totals.netPayable + deductionTotal).toBe(totals.grossSalary);
  });

  it("rounds to paise so float drift cannot fail the remote balance check", () => {
    // 0.1 + 0.2 style accumulation across many slips
    const totals = totalsFromPayslips(
      Array.from({ length: 3 }, () => slip({ total_earnings: 0.1, net_payable: 0.1 }))
    );

    expect(totals.grossSalary).toBe(0.3);
    expect(totals.netPayable).toBe(0.3);
  });

  it("handles an empty cycle without producing NaN", () => {
    const totals = totalsFromPayslips([]);

    expect(totals.grossSalary).toBe(0);
    expect(totals.netPayable).toBe(0);
    expect(totals.deductions).toEqual([]);
  });
});
