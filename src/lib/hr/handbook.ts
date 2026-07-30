// ============================================================
// Employee handbook template — 13 sections generated from
// company_details into the existing hr_policies machinery
// (versioned content, SHA-256 hashes, signed acknowledgements).
//
// Structure follows the HR-specified outline for Daylink Tech Labs:
// Welcome, Employment, Working Hours, Leave, Salary, Benefits,
// IT Policy, Code of Conduct, Performance, Discipline, POSH, Exit,
// Forms. Wording is a solid starting point that HR edits per
// workspace; [HR: …] markers flag the spots that need a human
// decision before publishing.
// ============================================================

export interface CompanyDetails {
  workspace_id: string;
  legal_name: string | null;
  brand_name: string | null;
  director_name: string | null;
  registered_address: string | null;
  website: string | null;
  contact_email: string | null;
  welcome_message: string | null;
  vision: string | null;
  mission: string | null;
  core_values: string | null;
  office_start: string;
  office_end: string;
  working_days: string;
  lunch_minutes: number;
  break_minutes: number;
  probation_months: number;
  notice_period_days: number;
  payroll_cycle: string;
  salary_day: number;
  casual_leave_days: number;
  sick_leave_days: number;
  earned_leave_days: number;
  posh_committee: string | null;
}

/** Fields that must be filled before the handbook can be generated. */
export const REQUIRED_DETAILS: (keyof CompanyDetails)[] = [
  "legal_name",
  "director_name",
  "vision",
  "mission",
  "core_values",
];

export function missingDetails(d: Partial<CompanyDetails> | null): string[] {
  if (!d) return [...REQUIRED_DETAILS] as string[];
  return REQUIRED_DETAILS.filter((k) => !String(d[k] ?? "").trim()).map(String);
}

export interface HandbookSection {
  order: number;
  key: string;
  title: string;
  /** hr_policies.category value. */
  category: string;
  mandatory: boolean;
  build: (d: CompanyDetails) => string;
}

const name = (d: CompanyDetails) => d.brand_name || d.legal_name || "the Company";

function valuesList(d: CompanyDetails): string {
  return (d.core_values ?? "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => `- ${v}`)
    .join("\n");
}

export const HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    order: 1,
    key: "welcome",
    title: "Handbook §1 — Welcome",
    category: "CUSTOM",
    mandatory: true,
    build: (d) => `# Welcome

## A Message from the Director

${d.welcome_message || `Welcome to ${name(d)}. We are delighted to have you on the team. This handbook explains who we are, how we work, and what you can expect from us — and what we expect from you. Read it fully; your acknowledgement at the end is a condition of employment.`}

— ${d.director_name}, Director

## About ${d.legal_name}

${name(d)} is registered as ${d.legal_name}${d.registered_address ? `, with its registered office at ${d.registered_address}` : ""}.${d.website ? ` Learn more at ${d.website}.` : ""}

## Vision

${d.vision}

## Mission

${d.mission}

## Core Values

${valuesList(d)}
`,
  },
  {
    order: 2,
    key: "employment",
    title: "Handbook §2 — Employment",
    category: "TERMS_AND_CONDITIONS",
    mandatory: true,
    build: (d) => `# Employment

## Equal Employment Opportunity

${name(d)} hires, promotes and compensates on merit alone. We do not discriminate on the basis of gender, religion, caste, age, disability, marital status or any other characteristic protected by law. This applies to every stage of employment, from recruitment to exit.

## Recruitment

Openings are filled through a structured process: application, screening, interviews and reference checks. Referral of candidates by employees is welcome and does not create any obligation to hire.

## Employment Categories

- **Full-time** — standard working hours, full benefits.
- **Probationer** — full-time employees within their probation period.
- **Intern / Trainee** — fixed-term learning engagements, terms per their letter.
- **Contract / Consultant** — engaged for a defined scope or period.

## Probation

New full-time employees serve a probation of **${d.probation_months} months** from the date of joining. Probation may be extended in writing if performance needs more time to assess.

## Confirmation

Confirmation follows a documented probation review. You will receive a written confirmation letter; do not assume confirmation from the passage of time alone.

## Background Verification

Employment is contingent on satisfactory verification of identity, education, prior employment and references. Falsified information at any stage is grounds for termination.
`,
  },
  {
    order: 3,
    key: "working-hours",
    title: "Handbook §3 — Working Hours & Attendance",
    category: "ATTENDANCE",
    mandatory: true,
    build: (d) => `# Working Hours

## Office Timings

Office hours are **${d.office_start} to ${d.office_end}**, **${d.working_days}**.

## Attendance

Attendance is recorded through the company's attendance system. Marking attendance for another person is gross misconduct.

## Late Arrival

Inform your manager if you expect to arrive late. Repeated unexcused late arrivals are a disciplinary matter and may attract leave deduction. [HR: define the late-mark rule, e.g. 3 late marks = half-day CL.]

## Breaks

- **Lunch break:** ${d.lunch_minutes} minutes.
- **Tea/short breaks:** ${d.break_minutes} minutes total per day.

## Overtime

Overtime requires prior manager approval. [HR: state whether overtime is compensated by pay or comp-off.]

## Work From Office Rules

Default mode of work is from office. Any work-from-home arrangement requires written manager approval in advance and may be withdrawn at the company's discretion.
`,
  },
  {
    order: 4,
    key: "leave",
    title: "Handbook §4 — Leave Policy",
    category: "LEAVE",
    mandatory: true,
    build: (d) => `# Leave Policy

Leave year runs January–December. Apply through the leave system in advance wherever possible.

## Entitlements

| Leave type | Annual entitlement |
|---|---|
| Casual Leave (CL) | ${d.casual_leave_days} days |
| Sick Leave (SL) | ${d.sick_leave_days} days |
| Earned Leave (EL) | ${d.earned_leave_days} days |

## Casual Leave

For personal exigencies. Apply at least 2 working days ahead except emergencies. [HR: max consecutive CL days.]

## Sick Leave

For illness. A medical certificate is required for more than 2 consecutive days.

## Earned Leave

Accrues monthly and may be carried forward. [HR: carry-forward cap and encashment rule.]

## Leave Without Pay

When paid leave is exhausted, approved absence is unpaid and deducted in payroll.

## Maternity Leave

As per the Maternity Benefit Act — 26 weeks of paid leave for eligible women employees.

## Paternity Leave

[HR: define paternity leave, e.g. 5 working days within 3 months of the child's birth.]

## Bereavement Leave

Up to 3 days of paid leave on the death of an immediate family member.

## Comp-Off

Compensatory offs for approved work on holidays/weekends must be availed within 60 days.

## Sandwich Leave

Weekends/holidays falling **between** two leave days count as leave. Weekends adjacent to (but not between) leave days do not.
`,
  },
  {
    order: 5,
    key: "salary",
    title: "Handbook §5 — Salary & Payroll",
    category: "TERMS_AND_CONDITIONS",
    mandatory: true,
    build: (d) => `# Salary

## Payroll Cycle

Payroll runs **${d.payroll_cycle.toLowerCase()}**, covering the 1st to the last day of the month.

## Salary Date

Salary is credited on or before the **${d.salary_day}${ordinal(d.salary_day)}** of the following month.

## Payslip

Payslips are issued digitally for every cycle. Keep payslip details confidential.

## Deductions

Statutory deductions (professional tax, TDS, PF/ESI where applicable) and approved recoveries (salary advances, loss/damage of company property) appear on your payslip.

## Incentives & Bonus

Incentive and bonus schemes, where applicable, are communicated separately in writing and are discretionary unless your letter says otherwise.

## Salary Revision

Compensation is reviewed as part of the appraisal cycle (§9). Revision is linked to performance and company results, and is not automatic.
`,
  },
  {
    order: 6,
    key: "benefits",
    title: "Handbook §6 — Employee Benefits",
    category: "CUSTOM",
    mandatory: false,
    build: (d) => `# Employee Benefits

## Health & Wellness

[HR: describe current wellness support, e.g. sick-room, doctor-on-call, wellness days.]

## Training

Role-relevant training is provided on joining and on adoption of new tools or processes.

## Professional Development

${name(d)} supports certifications and courses relevant to your role. [HR: define budget/approval flow.]

## Employee Recognition

Outstanding contribution is recognised through spot awards and appraisal outcomes. [HR: name the programmes.]

## Planned Additions

As the company grows, the following are planned:

- Provident Fund (PF)
- Employee State Insurance (ESI)
- Group Medical Insurance
`,
  },
  {
    order: 7,
    key: "it-policy",
    title: "Handbook §7 — IT & Information Security Policy",
    category: "IT_SECURITY",
    mandatory: true,
    build: (d) => `# IT Policy

This section is a condition of system access. Violations may lead to immediate revocation of access and disciplinary action.

## Laptop Usage

Company laptops are for company work. Keep them physically secure, encrypted and never leave them unattended in public places. Report loss or theft within 24 hours.

## Password Policy

Use strong, unique passwords and the company password manager. Enable two-factor authentication wherever available. Never share credentials — not with colleagues, not with managers.

## Internet & Email Usage

Company internet and email are business tools. Incidental personal use is tolerated; illegal, offensive or bandwidth-abusive use is not. Email sent from a company address represents ${name(d)}.

## Software Installation

Install only licensed, approved software. Pirated software is strictly prohibited and is gross misconduct.

## Cyber Security

Do not click unexpected attachments or links. Report suspected phishing or compromise to IT immediately — fast reporting is never punished; concealment is.

## AI Tools Policy

AI assistants (ChatGPT, GitHub Copilot, Claude and similar) may be used to aid your work **subject to**:

- Never paste client code, client data, credentials or personal data into external AI tools without written approval.
- AI-generated code is reviewed to the same standard as human-written code; you own what you ship.
- Follow client-specific AI restrictions where a client imposes them.

## Data Protection & Client Confidentiality

Client data is accessed on a need-to-know basis only, stays inside approved systems, and is never copied to personal devices or accounts. Confidentiality obligations survive your employment.

## Source Code Ownership

All code, designs and work product created in the course of employment are the property of ${d.legal_name} or its clients, as per your employment agreement and NDA.

## Git Repository Rules

- Work in the company's repositories under your company identity.
- No force-pushes to protected branches; changes land via reviewed pull requests.
- Never commit secrets, keys or client data to a repository.
- Personal/public repos must not contain company or client code — including snippets.

## Cloud Storage

Company data lives in company-approved storage only. Personal Google Drive/Dropbox accounts are not approved locations.

## USB Device Usage

USB storage is disabled by default. Where a business need exists, request an exception from IT. [HR/IT: state the exception process.]
`,
  },
  {
    order: 8,
    key: "code-of-conduct",
    title: "Handbook §8 — Code of Conduct",
    category: "CODE_OF_CONDUCT",
    mandatory: true,
    build: (d) => `# Code of Conduct

## Professional Behaviour

Treat colleagues, clients and vendors with respect and courtesy. Disagreements are argued on merit, never made personal.

## Dress Code

Smart casual on regular days; formal when meeting clients. [HR: adjust to your norms.]

## Respectful Workplace & Anti-Bullying

Harassment, bullying, intimidation or humiliation — in person or online — is not tolerated at ${name(d)}. See §11 for POSH-specific protections and procedures.

## Workplace Ethics

Be honest in records, claims and communications. Falsifying data, attendance, expenses or reports is gross misconduct.

## Conflict of Interest

Disclose in writing any outside engagement, financial interest or relationship that could conflict with the company's interests — including moonlighting and interests in vendors or competitors. When in doubt, disclose.

## Gifts & Hospitality

Do not accept gifts or hospitality that could influence, or appear to influence, business decisions. [HR: set a value threshold, e.g. ₹2,000, above which disclosure is required.]

## Confidentiality

Company information — financials, salaries, client lists, strategies, source code — is confidential by default. Share externally only under an approved NDA.

## Grievance Redressal

Raise concerns with your manager first; if unresolved or inappropriate to raise there, escalate to HR or the Director. Genuine complaints made in good faith never attract retaliation, and whistleblowers are protected.
`,
  },
  {
    order: 9,
    key: "performance",
    title: "Handbook §9 — Performance Management",
    category: "CUSTOM",
    mandatory: false,
    build: (d) => `# Performance

## KPI & KRA

Every role has documented Key Result Areas (KRAs) and measurable KPIs, agreed with your manager at the start of each review period.

## Probation Review

A structured review before the end of probation (§2) decides confirmation, extension or separation.

## Appraisals

Appraisals run [HR: annually/half-yearly] and combine self-assessment, manager assessment and KPI outcomes.

## Performance Improvement Plan (PIP)

Sustained underperformance leads to a written PIP with clear goals and a defined duration ([HR: 30/60/90 days]). Failure to meet PIP goals may lead to separation.

## Promotions & Salary Increment

Promotions recognise sustained performance and readiness for larger scope, and are effective only when confirmed in writing. Increments follow the appraisal cycle (§5).
`,
  },
  {
    order: 10,
    key: "discipline",
    title: "Handbook §10 — Disciplinary Policy",
    category: "CUSTOM",
    mandatory: true,
    build: (d) => `# Discipline

Discipline at ${name(d)} is progressive — except for gross misconduct, which may lead directly to suspension or termination.

## Progressive Steps

1. **Verbal warning** — documented by the manager.
2. **Written warning** — issued by HR, acknowledged by the employee.
3. **Final warning** — states clearly that the next step is termination.
4. **Suspension** — with or without pay, pending inquiry.
5. **Termination** — with notice or pay in lieu, per your employment letter.

## Gross Misconduct

Includes (not exhaustively): theft or fraud; violence or threats; harassment (see §11); falsification of records or attendance; breach of confidentiality or IT policy (§7); working under the influence of alcohol or drugs; unauthorised absence beyond [HR: N] consecutive days.

Gross misconduct may result in immediate termination without notice, after a fair opportunity to respond.
`,
  },
  {
    order: 11,
    key: "posh",
    title: "Handbook §11 — Prevention of Sexual Harassment (POSH)",
    category: "POSH",
    mandatory: true,
    build: (d) => `# Prevention of Sexual Harassment

${name(d)} has zero tolerance for sexual harassment, in line with the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013.

## What Constitutes Sexual Harassment

Unwelcome physical contact or advances; demands or requests for sexual favours; sexually coloured remarks; showing pornography; any other unwelcome physical, verbal or non-verbal conduct of a sexual nature — including over chat, email or video calls.

## Complaints Committee

${d.posh_committee || `**Note:** organisations with fewer than 10 employees are not required to constitute an Internal Committee; complaints are handled by the **Local Committee** constituted by the District Officer. As ${name(d)} grows past 10 employees, an Internal Complaints Committee (ICC) will be constituted and this section updated. [HR: once the ICC exists, list the Presiding Officer, members and the external member here.]`}

## Complaint Procedure

A written complaint should be made within 3 months of the incident (extendable by the Committee for recorded reasons). Complaints may be given to HR for onward transmission to the Committee if approaching it directly is difficult.

## Investigation Process

The Committee completes its inquiry within 90 days, hearing both parties with strict confidentiality. Interim reliefs (transfer, leave to the aggrieved) may be granted. Retaliation against a complainant or witness is itself misconduct. Malicious complaints, proven to be knowingly false, attract action — an unproven complaint is **not** malicious by itself.
`,
  },
  {
    order: 12,
    key: "exit",
    title: "Handbook §12 — Exit Policy",
    category: "TERMS_AND_CONDITIONS",
    mandatory: true,
    build: (d) => `# Exit Policy

## Resignation

Resign in writing (email to your manager and HR). The resignation date is the date HR receives it.

## Notice Period

**${d.notice_period_days} days** for confirmed employees, unless your employment letter states otherwise. [HR: probationer notice period.] The company may, at its discretion, accept buy-out of unserved notice.

## Asset Return

All company property — laptop, access cards, SIMs, documents, data — must be returned on or before the last working day. Recovery for unreturned assets is made from final settlement.

## Exit Interview

HR conducts an exit interview in the final week. Feedback is used to improve, and is kept confidential.

## Full & Final Settlement

Processed within 45 days of the last working day, covering earned salary, leave encashment (per §4), recoveries and reimbursements.

## Experience & Relieving Letters

Issued after asset return and handover are complete and no disciplinary inquiry is pending.
`,
  },
  {
    order: 13,
    key: "forms",
    title: "Handbook §13 — Forms & Acknowledgement",
    category: "TERMS_AND_CONDITIONS",
    mandatory: true,
    build: (d) => `# Forms

The following are executed at or shortly after joining. Signed copies are kept in your employee file.

## Handbook Acknowledgement

Your digital acknowledgement of this handbook (recorded with your typed signature, timestamp and content fingerprint) confirms that you have read, understood and agree to abide by all sections. Acknowledgement is required again whenever a material revision is published.

## Non-Disclosure Agreement (NDA)

Covers confidentiality of company and client information (§7, §8) during and after employment.

## IT Asset Form

Records every company asset issued to you, its condition, and your responsibility for it until return (§12).

## Employee Declaration

Declares that the personal information, education and employment history you provided are true, and discloses any conflicts of interest (§8).

---

*This handbook is issued by ${d.legal_name}. It does not create a contract of employment beyond your employment letter, and the company may revise it with notice. The latest published version, acknowledged digitally, is the operative one.*
`,
  },
];

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
