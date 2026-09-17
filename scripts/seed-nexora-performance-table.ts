import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_PERFORMANCE = [
  { code: 'PERF001', empCode: 'EMP003', period: '2026 H1', area: 'Project Delivery', ratingStr: '4/5', numRating: 4, overall: 'Good', comment: 'Improve weekly reporting consistency' },
  { code: 'PERF002', empCode: 'EMP005', period: '2026 H1', area: 'Plant Operations', ratingStr: '4/5', numRating: 4, overall: 'Good', comment: 'Focus on preventive maintenance documentation' },
  { code: 'PERF003', empCode: 'EMP007', period: '2026 H1', area: 'Sales & Business Development', ratingStr: '3/5', numRating: 3, overall: 'Meets Expectations', comment: 'Increase follow-up conversion' },
  { code: 'PERF004', empCode: 'EMP004', period: '2026 H1', area: 'HR Operations', ratingStr: '4/5', numRating: 4, overall: 'Good', comment: 'Improve recruitment turnaround time' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding performance reviews into workspace:', workspaceId);

  // Map employee_code to hr_employees.id
  const { data: hrEmpList } = await admin
    .from('hr_employees')
    .select('id, employee_code')
    .eq('workspace_id', workspaceId);

  const hrEmpMap: Record<string, string> = {};
  if (hrEmpList) {
    for (const emp of hrEmpList) {
      if (emp.employee_code && emp.id) {
        hrEmpMap[emp.employee_code] = emp.id;
      }
    }
  }

  // Ensure Review Cycle 2026 H1 exists
  let cycleId: string | null = null;
  const { data: existingCycle } = await admin
    .from('hr_review_cycles')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('name', '2026 H1')
    .maybeSingle();

  if (existingCycle?.id) {
    cycleId = existingCycle.id;
  } else {
    const { data: newCycle, error: cErr } = await admin
      .from('hr_review_cycles')
      .insert({
        workspace_id: workspaceId,
        name: '2026 H1',
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status: 'OPEN'
      })
      .select('id')
      .single();

    if (cErr) {
      console.error('Error creating review cycle:', cErr.message);
      process.exit(1);
    }
    cycleId = newCycle.id;
  }

  console.log('Review Cycle ID for 2026 H1:', cycleId);

  let successCount = 0;

  for (const perf of RAW_PERFORMANCE) {
    const hrEmpId = hrEmpMap[perf.empCode];
    if (!hrEmpId) {
      console.error(`HR Employee ID not found for ${perf.empCode}`);
      continue;
    }

    const summaryText = `[${perf.code}] Area: ${perf.area} | Overall: ${perf.overall} | Comment: ${perf.comment}`;

    const { error: insertErr } = await admin
      .from('hr_performance_reviews')
      .insert({
        workspace_id: workspaceId,
        cycle_id: cycleId,
        hr_employee_id: hrEmpId,
        self_rating: perf.numRating,
        manager_rating: perf.numRating,
        final_rating: perf.numRating,
        feedback_summary: summaryText,
        status: 'COMPLETED'
      });

    if (insertErr) {
      console.error(`Error adding performance review ${perf.code}:`, insertErr.message);
    } else {
      console.log(`✅ ${perf.code} | ${perf.empCode} | Period: ${perf.period} | Area: ${perf.area} | Rating: ${perf.ratingStr} (${perf.overall})`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/4 performance reviews successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
