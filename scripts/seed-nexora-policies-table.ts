import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_POLICIES = [
  {
    code: 'POL001',
    title: 'Attendance & Punctuality Policy',
    category: 'ATTENDANCE',
    owner: 'HR',
    status: 'PUBLISHED',
    effectiveDate: '2026-04-01',
    reviewMonths: 12,
    nextReview: '2027-04-01',
    content: `## 1. Objective & Scope
This policy establishes guidelines for work hours, clock-in procedures, and attendance tracking across all offices, plants, and construction sites of Nexora Manufacturing.

## 2. Working Hours & Grace Period
- **Standard Shift**: 09:30 AM to 06:00 PM (Monday to Friday for Corporate; Monday to Saturday for Plants/Sites).
- **Grace Period**: A 15-minute grace period (up to 09:45 AM) is permitted for up to 3 occurrences per month.
- **Late Arrivals**: Arrival after 09:45 AM will be marked as 'Late'. 3 late marks in a month result in a half-day deduction.

## 3. Clock-In Procedures
- All employees must log attendance via the Daily_CRM Mobile App or Biometric terminals.
- On-site employees must enable GPS verification for location-based punches.`
  },
  {
    code: 'POL002',
    title: 'Leave & Holiday Policy',
    category: 'LEAVE',
    owner: 'HR',
    status: 'PUBLISHED',
    effectiveDate: '2026-04-01',
    reviewMonths: 12,
    nextReview: '2027-04-01',
    content: `## 1. Objective
To provide a balanced leave structure ensuring rest, personal time, and wellness for all full-time employees.

## 2. Annual Leave Entitlements
- **Casual Leave (CL)**: 12 days per year (credited monthly).
- **Sick Leave (SL)**: 7 days per year (requires medical certificate for >2 consecutive days).
- **Earned Leave (EL)**: 15 days accrued annually, eligible after 6 months of service.

## 3. Application & Approval
- Planned leaves must be submitted via the HR Portal at least 3 days in advance.
- Unplanned sick leaves must be notified to the reporting manager by 09:30 AM on the day of absence.`
  },
  {
    code: 'POL003',
    title: 'Workplace Safety Policy',
    category: 'CUSTOM',
    owner: 'Safety',
    status: 'PUBLISHED',
    effectiveDate: '2026-04-01',
    reviewMonths: 6,
    nextReview: '2026-10-01',
    content: `## 1. Zero-Harm Policy Statement
Nexora Manufacturing is committed to maintaining a safe working environment at all concrete plants, warehouse facilities, and project construction sites.

## 2. Mandatory Personal Protective Equipment (PPE)
- Safety Helmet, High-Visibility Vest, and Steel-Toe Boots are mandatory at all Plant and Project Site locations.
- Failure to wear mandatory PPE results in immediate site suspension.

## 3. Incident Reporting
- Any workplace injury, near-miss, or hazard must be reported to the Site Safety Officer within 2 hours.`
  },
  {
    code: 'POL004',
    title: 'Travel & Expense Reimbursement Policy',
    category: 'TRAVEL',
    owner: 'Finance',
    status: 'PUBLISHED',
    effectiveDate: '2026-04-01',
    reviewMonths: 12,
    nextReview: '2027-04-01',
    content: `## 1. Purpose
Defines guidelines and financial ceilings for business-related travel, client visits, and operational expenses incurred by employees.

## 2. Expense Limits & Daily Allowances
- **Local Conveyance**: ₹12/km for 4-wheelers, ₹6/km for 2-wheelers.
- **Outstation Per-Diem**: Up to ₹2,500/day for Tier-1 cities; ₹1,800/day for Tier-2 cities.
- **Meals & Hospitality**: Up to ₹800/day on official site visits.

## 3. Claims Submission
- All expense claims must be logged in the HR Expenses module within 7 days of completion.
- Original GST bills/receipts are mandatory for claims above ₹500.`
  }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding HR policies into workspace:', workspaceId);

  let successCount = 0;

  for (const pol of RAW_POLICIES) {
    const fullTitle = `[${pol.code}] ${pol.title}`;

    // Check if policy exists by title in workspace
    const { data: existing } = await admin
      .from('hr_policies')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('title', fullTitle)
      .maybeSingle();

    let policyId: string | null = null;

    if (existing?.id) {
      policyId = existing.id;
      await admin.from('hr_policies').update({
        category: pol.category,
        status: pol.status,
        review_frequency_months: pol.reviewMonths,
        next_review_date: pol.nextReview,
      }).eq('id', policyId);
    } else {
      const { data: newPol, error: pErr } = await admin
        .from('hr_policies')
        .insert({
          workspace_id: workspaceId,
          title: fullTitle,
          category: pol.category,
          status: pol.status,
          review_frequency_months: pol.reviewMonths,
          next_review_date: pol.nextReview,
          created_at: `${pol.effectiveDate}T00:00:00Z`
        })
        .select('id')
        .single();

      if (pErr) {
        console.error(`Error creating policy ${pol.code}:`, pErr.message);
        continue;
      }
      policyId = newPol.id;
    }

    if (!policyId) continue;

    // Check or insert policy version
    const { data: existingVer } = await admin
      .from('hr_policy_versions')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('policy_id', policyId)
      .eq('version_number', 1)
      .maybeSingle();

    if (!existingVer?.id) {
      await admin
        .from('hr_policy_versions')
        .insert({
          workspace_id: workspaceId,
          policy_id: policyId,
          version_number: 1,
          content: pol.content,
          change_summary: `Initial release v1.0 (${pol.owner} Dept)`,
          mandatory: true,
          effective_at: `${pol.effectiveDate}T00:00:00Z`,
          published_at: `${pol.effectiveDate}T00:00:00Z`
        });
    }

    console.log(`✅ ${pol.code} | ${pol.title} | Owner: ${pol.owner} | Category: ${pol.category} | Effective: ${pol.effectiveDate}`);
    successCount++;
  }

  console.log(`\n🎉 Seeded ${successCount}/4 HR policies & versions successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
