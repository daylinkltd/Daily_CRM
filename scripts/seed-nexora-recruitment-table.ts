import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_JOBS = [
  {
    code: 'JOB001',
    title: 'Site Engineer',
    deptName: 'Projects & Construction',
    status: 'OPEN',
    openings: 2,
    expLevel: '5+ years',
    minExp: 5,
    location: 'Belagavi',
    minSal: 450000,
    maxSal: 700000,
    skills: ['Quality Control', 'Structural Execution', 'AutoCAD', 'Concrete Testing'],
    desc: 'Responsible for day-to-day site supervision, quality assurance of concrete pours, contractor management, and structural safety execution at Belagavi project sites.'
  },
  {
    code: 'JOB002',
    title: 'RMC Plant Operator',
    deptName: 'RMC & Concrete',
    status: 'OPEN',
    openings: 3,
    expLevel: '2+ years',
    minExp: 2,
    location: 'Belagavi',
    minSal: 300000,
    maxSal: 450000,
    skills: ['Batching Plant Operation', 'PLC Control Systems', 'Mix Design Handling', 'Equipment Maintenance'],
    desc: 'Operate automatic concrete batching plant PLC controls, ensure precise aggregate mixing ratio adherence, and maintain daily dispatch schedules.'
  },
  {
    code: 'JOB003',
    title: 'Accounts Executive',
    deptName: 'Accounts & Finance',
    status: 'CLOSED',
    openings: 1,
    expLevel: '2+ years',
    minExp: 2,
    location: 'Corporate Office',
    minSal: 350000,
    maxSal: 500000,
    skills: ['Tally Prime', 'GST Filing', 'Bank Reconciliation', 'Vendor Payments'],
    desc: 'Manage daily accounting entries, vendor invoice verifications, GST return preparations, and bank reconciliations at the Belagavi corporate headquarters.'
  }
];

const RAW_CANDIDATES = [
  { jobCode: 'JOB001', name: 'Rajesh Patil', email: 'rajesh.patil@gmail.com', phone: '+91 98450 12345', stage: 'INTERVIEW', rating: 4, feedback: 'Strong site execution experience in Belagavi region.' },
  { jobCode: 'JOB001', name: 'Anil Deshmukh', email: 'anil.deshmukh@yahoo.com', phone: '+91 98220 54321', stage: 'SCREENING', rating: 3, feedback: 'Good technical background, resume under review.' },
  { jobCode: 'JOB002', name: 'Sanjay Kumar', email: 'sanjay.kumar@outlook.com', phone: '+91 97410 98765', stage: 'APPLIED', rating: 3, feedback: '2 years experience in automated batching plants.' },
  { jobCode: 'JOB002', name: 'Praveen Naik', email: 'praveen.naik@gmail.com', phone: '+91 96320 11223', stage: 'OFFER', rating: 5, feedback: 'Selected. Release offer letter for batching operator.' },
  { jobCode: 'JOB003', name: 'Swati Kulkarni', email: 'swati.kulkarni@gmail.com', phone: '+91 95130 33445', stage: 'HIRED', rating: 5, feedback: 'Hired and onboarded successfully.' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding recruitment data into workspace:', workspaceId);

  // Department Map
  const { data: depts } = await admin.from('departments').select('id, name').eq('workspace_id', workspaceId);
  const deptMap: Record<string, string> = {};
  if (depts) depts.forEach(d => deptMap[d.name] = d.id);

  const jobMap: Record<string, string> = {};
  let successJobCount = 0;

  for (const j of RAW_JOBS) {
    const deptId = deptMap[j.deptName];
    const fullTitle = `[${j.code}] ${j.title}`;

    const { data: existing } = await admin
      .from('hr_recruitment_jobs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('title', fullTitle)
      .maybeSingle();

    if (existing?.id) {
      jobMap[j.code] = existing.id;
      await admin.from('hr_recruitment_jobs').update({
        status: j.status,
        vacancies_count: j.openings,
        experience_level: j.expLevel,
        location: j.location,
      }).eq('id', existing.id);
    } else {
      const { data: newJob, error: jErr } = await admin
        .from('hr_recruitment_jobs')
        .insert({
          workspace_id: workspaceId,
          department_id: deptId,
          title: fullTitle,
          location: j.location,
          employment_type: 'FULL_TIME',
          experience_level: j.expLevel,
          min_experience_years: j.minExp,
          vacancies_count: j.openings,
          status: j.status,
          job_description: j.desc,
          required_skills: j.skills,
          min_salary: j.minSal,
          max_salary: j.maxSal,
          salary_currency: 'INR'
        })
        .select('id')
        .single();

      if (jErr) {
        console.error(`Error creating job ${j.code}:`, jErr.message);
        continue;
      }
      jobMap[j.code] = newJob.id;
    }

    console.log(`✅ ${j.code} | ${j.title} (${j.deptName}) | Status: ${j.status} | Openings: ${j.openings} | Exp: ${j.expLevel}`);
    successJobCount++;
  }

  // Seed Candidates & Applications
  let successCandCount = 0;
  for (const c of RAW_CANDIDATES) {
    const jobId = jobMap[c.jobCode];
    if (!jobId) continue;

    // Create Candidate
    let candId: string | null = null;
    const { data: existingCand } = await admin.from('hr_candidates').select('id').eq('workspace_id', workspaceId).eq('email', c.email).maybeSingle();
    if (existingCand?.id) {
      candId = existingCand.id;
    } else {
      const { data: newCand } = await admin.from('hr_candidates').insert({
        workspace_id: workspaceId,
        full_name: c.name,
        email: c.email,
        phone: c.phone
      }).select('id').single();
      candId = newCand?.id || null;
    }

    if (!candId) continue;

    // Create Application
    let appId: string | null = null;
    const { data: existingApp } = await admin.from('hr_job_applications').select('id').eq('job_id', jobId).eq('candidate_id', candId).maybeSingle();
    if (existingApp?.id) {
      appId = existingApp.id;
      await admin.from('hr_job_applications').update({ stage: c.stage }).eq('id', appId);
    } else {
      const { data: newApp } = await admin.from('hr_job_applications').insert({
        workspace_id: workspaceId,
        job_id: jobId,
        candidate_id: candId,
        stage: c.stage
      }).select('id').single();
      appId = newApp?.id || null;
    }

    if (appId && c.stage === 'INTERVIEW') {
      await admin.from('hr_interviews').insert({
        workspace_id: workspaceId,
        application_id: appId,
        interview_type: 'TECHNICAL',
        scheduled_at: new Date().toISOString(),
        rating: c.rating,
        feedback_notes: c.feedback,
        decision: 'PASSED'
      });
    }

    successCandCount++;
  }

  console.log(`\n🎉 Seeded ${successJobCount}/3 recruitment jobs & ${successCandCount} candidate applications successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
