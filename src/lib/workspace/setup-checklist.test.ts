import { describe, it, expect } from "vitest";
import { evaluateSetup, setupSummary, SETUP_ITEMS, type SetupFacts } from "./setup-checklist";

const ALL_OFF: SetupFacts = {
  companyName: false,
  logo: false,
  letterheadConfigured: false,
  taxId: false,
  companyAddress: false,
  signatoryCount: 0,
  departmentCount: 0,
  workLocationCount: 0,
  salaryStructureCount: 0,
  whatsappConnected: false,
  modules: { hr: true, crm: true, accounting: true },
};

const ALL_ON: SetupFacts = {
  companyName: true,
  logo: true,
  letterheadConfigured: true,
  taxId: true,
  companyAddress: true,
  signatoryCount: 1,
  departmentCount: 2,
  workLocationCount: 1,
  salaryStructureCount: 1,
  whatsappConnected: true,
  modules: { hr: true, crm: true, accounting: true },
};

describe("evaluateSetup", () => {
  it("reports everything outstanding on a fresh workspace", () => {
    const s = evaluateSetup(ALL_OFF);
    expect(s.completed).toBe(0);
    expect(s.outstanding).toHaveLength(SETUP_ITEMS.length);
    expect(s.ready).toBe(false);
  });

  it("reports nothing outstanding on a complete workspace", () => {
    const s = evaluateSetup(ALL_ON);
    expect(s.outstanding).toHaveLength(0);
    expect(s.completed).toBe(s.total);
    expect(s.ready).toBe(true);
  });

  it("is ready once the blocking items are done, even with recommendations left", () => {
    const s = evaluateSetup({
      ...ALL_OFF,
      companyName: true,
      companyAddress: true,
      letterheadConfigured: true,
      signatoryCount: 1,
    });
    expect(s.blocking).toHaveLength(0);
    expect(s.recommended.length).toBeGreaterThan(0);
    expect(s.ready).toBe(true);
  });

  it("skips HR items entirely when the HR module is off", () => {
    const s = evaluateSetup({ ...ALL_OFF, modules: { hr: false, crm: true, accounting: true } });
    const ids = s.outstanding.map((i) => i.id);
    expect(ids).not.toContain("salary_structure");
    expect(ids).not.toContain("work_location");
    expect(ids).not.toContain("departments");
  });

  it("skips the tax number when accounting is off", () => {
    const s = evaluateSetup({ ...ALL_OFF, modules: { hr: true, crm: true, accounting: false } });
    expect(s.outstanding.map((i) => i.id)).not.toContain("tax_id");
  });

  it("skips WhatsApp when CRM is off", () => {
    const s = evaluateSetup({ ...ALL_OFF, modules: { hr: true, crm: false, accounting: true } });
    expect(s.outstanding.map((i) => i.id)).not.toContain("whatsapp");
  });

  it("counts the total against applicable items only, not every item", () => {
    const off = evaluateSetup({ ...ALL_OFF, modules: { hr: false, crm: false, accounting: false } });
    expect(off.total).toBeLessThan(SETUP_ITEMS.length);
  });

  it("treats letterhead and signatory as blocking, logo as recommended", () => {
    const s = evaluateSetup(ALL_OFF);
    expect(s.blocking.map((i) => i.id)).toContain("letterhead");
    expect(s.blocking.map((i) => i.id)).toContain("signatory");
    expect(s.recommended.map((i) => i.id)).toContain("logo");
  });

  it("does not leak the satisfied predicate into the returned items", () => {
    const [first] = evaluateSetup(ALL_OFF).outstanding;
    expect("satisfied" in first).toBe(false);
  });

  it("every item carries a consequence, so nothing is a bare demand", () => {
    for (const i of SETUP_ITEMS) expect(i.consequence.length).toBeGreaterThan(10);
  });
});

describe("setupSummary", () => {
  it("is null when nothing is outstanding", () => {
    expect(setupSummary(evaluateSetup(ALL_ON))).toBeNull();
  });

  it("names the worst item and counts the rest", () => {
    const msg = setupSummary(evaluateSetup(ALL_OFF))!;
    expect(msg).toContain("company legal name");
    expect(msg).toMatch(/other items/);
  });

  it("omits the tail when only one item remains", () => {
    const msg = setupSummary(evaluateSetup({ ...ALL_ON, logo: false }))!;
    expect(msg).toContain("company logo");
    expect(msg).not.toMatch(/other/);
  });

  it("prefers a blocking item over a recommended one", () => {
    const msg = setupSummary(evaluateSetup({ ...ALL_ON, logo: false, letterheadConfigured: false }))!;
    expect(msg).toContain("letterhead");
  });
});
