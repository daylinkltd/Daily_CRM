#!/usr/bin/env node
/**
 * ETL for the Daylink Mongo data that the earlier imports did NOT cover.
 *
 *   node scripts/import-daylink-new-data.mjs                # dry run
 *   node scripts/import-daylink-new-data.mjs --live         # writes
 *   node scripts/import-daylink-new-data.mjs --only=letters # one section
 *
 * Requires:
 *   MONGO_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * WHAT MOVES, and what deliberately does not
 *
 *   letters      offerletters + appointmentletters + inductionletters (44)
 *                → official_documents, linked to the employee's
 *                  workspace_member when the email matches one. These are
 *                  real signed HR letters with their own numbers, so they
 *                  land as Issued and inherit the immutability trigger.
 *
 *   leads        contacts + messages (15) → contacts. Website enquiry
 *                forms; each becomes a CRM contact with the enquiry text
 *                kept as the note so the context is not lost.
 *
 *   interns      internships (43) → hr_candidates + hr_recruitment_jobs
 *                + hr_job_applications, so the intake shows up in the
 *                Recruitment module with its real stage.
 *
 *   NOT IMPORTED, on purpose:
 *     products, categories, partners, impactareas, showcaseitems,
 *     testimonials  — these belong to a CLIENT's site (pfwci-business),
 *                     not to Daylink Tech Labs. Importing them would put
 *                     another organisation's catalogue in this tenant.
 *     blogs, blogtopics, seosettings, pagedatas, pagevisits, galleries,
 *     knowledgedocuments, ragmetrics  — website CMS and chatbot data with
 *                     no CRM counterpart.
 *     users         — web logins, not staff (the earlier import learned
 *                     this the hard way and pulled in two strangers).
 *     websiteclients — six logos for a marquee, not customer records.
 *     invoices, quotations — real business data, but the commerce schema
 *                     has closed voucher/GST enumerations that must be
 *                     mapped deliberately rather than guessed. Left for a
 *                     follow-up pass; see the data-map notes.
 *
 * IDEMPOTENT BY NATURAL KEY, like the earlier importers: letters by
 * document_number, contacts by (workspace, phone), candidates by
 * (workspace, email). Re-running completes a partial run and changes
 * nothing that already landed.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CRM_DIR = path.resolve(__dirname, '..');

const LIVE = process.argv.includes('--live');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const WORKSPACE_ID = 'ab6095d0-aa86-4328-934b-d56f26d8d7d8'; // Daylink Tech Labs
const OWNER_EMAIL = 'swaraj@daylink.in';

const mongoUri = process.env.MONGO_URL;
if (!mongoUri) {
  console.error('Set MONGO_URL to the daylink MongoDB connection string.');
  process.exit(1);
}
const crmEnv = fs.existsSync(path.join(CRM_DIR, '.env.local'))
  ? fs.readFileSync(path.join(CRM_DIR, '.env.local'), 'utf8')
  : '';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || crmEnv.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || crmEnv.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
if (!SUPA_URL || !SUPA_KEY || SUPA_URL.includes('placeholder')) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or .env.local).');
  process.exit(1);
}

const H = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

const stats = {};
const bump = (k, n = 1) => { stats[k] = (stats[k] ?? 0) + n; };
const skipped = [];

async function sbSelect(q) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${q}`, { headers: H });
  const json = await res.json();
  if (!res.ok) throw new Error(`SELECT ${q}: ${JSON.stringify(json)}`);
  return json;
}

async function sbInsert(table, rows) {
  if (!rows.length) return [];
  if (!LIVE) return rows.map((r) => ({ id: r.id ?? crypto.randomUUID() }));
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`INSERT ${table}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

const iso = (d) => (d instanceof Date ? d.toISOString() : d ? new Date(d).toISOString() : null);
const day = (d) => iso(d)?.slice(0, 10) ?? null;
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Mongo's letter text is plain text with newlines; letters render as HTML. */
function textToHtml(text) {
  if (!text) return '';
  return String(text)
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

function money(salaryObj) {
  if (!salaryObj || typeof salaryObj !== 'object') return null;
  const n = salaryObj.amount ?? salaryObj.annual ?? salaryObj.monthly ?? salaryObj.ctc;
  return typeof n === 'number' ? n : null;
}

// ============================================================
// Letters → official_documents
// ============================================================
async function importLetters(db, ctx) {
  const specs = [
    { coll: 'offerletters', title: 'Letter of Offer', numberField: 'offerLetterNumber',
      nameField: 'candidateName', emailField: 'candidateEmail', dateField: 'offerDate' },
    { coll: 'appointmentletters', title: 'Appointment Letter', numberField: 'appointmentLetterNumber',
      nameField: 'employeeName', emailField: 'employeeEmail', dateField: 'letterDate' },
    { coll: 'inductionletters', title: 'Induction Letter', numberField: 'inductionLetterNumber',
      nameField: 'employeeName', emailField: 'employeeEmail', dateField: 'letterDate' },
  ];

  const existing = await sbSelect(
    `official_documents?workspace_id=eq.${WORKSPACE_ID}&select=document_number`,
  );
  const seen = new Set(existing.map((d) => d.document_number));

  for (const spec of specs) {
    const docs = await db.collection(spec.coll).find({}).toArray();
    for (const d of docs) {
      const number = d[spec.numberField] || `${spec.coll.toUpperCase()}-${String(d._id).slice(-6)}`;
      if (seen.has(number)) { bump(`${spec.coll}_already_present`); continue; }

      const name = d[spec.nameField];
      const email = (d[spec.emailField] || '').toLowerCase().trim();
      if (!name) { skipped.push(`${spec.coll} ${number}: no recipient name`); continue; }

      // Link to the employee when we can; an unlinked letter is still
      // worth keeping, it just won't appear on their Letters tab.
      const memberId = ctx.memberIdByEmail.get(email) ?? null;
      if (!memberId) bump(`${spec.coll}_unlinked`);

      const bodyParts = [];
      if (d.position) bodyParts.push(`Position: ${d.position}`);
      if (d.department) bodyParts.push(`Department: ${d.department}`);
      if (d.designation && d.designation !== d.position) bodyParts.push(`Designation: ${d.designation}`);
      if (d.workLocation) bodyParts.push(`Work location: ${d.workLocation}`);
      if (d.employmentType) bodyParts.push(`Employment type: ${d.employmentType}`);
      const start = d.startDate ?? d.appointmentDate ?? d.joiningDate;
      if (start) bodyParts.push(`Start date: ${day(start)}`);
      const sal = money(d.salary);
      if (sal) bodyParts.push(`Compensation: ${sal}`);
      if (d.probationPeriod) bodyParts.push(`Probation: ${d.probationPeriod} months`);
      if (d.workingHours) bodyParts.push(`Working hours: ${d.workingHours}`);
      if (d.reportingTo) bodyParts.push(`Reporting to: ${d.reportingTo}`);

      const html = [
        `<p>Dear ${esc(name)},</p>`,
        bodyParts.length ? `<ul>${bodyParts.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '',
        textToHtml(d.termsAndConditions),
        textToHtml(d.additionalNotes),
      ].filter(Boolean).join('\n');

      await sbInsert('official_documents', [{
        id: crypto.randomUUID(),
        workspace_id: WORKSPACE_ID,
        document_number: number,
        title: spec.title,
        linked_entity_type: 'Employee',
        linked_entity_id: memberId,
        recipient_name: name,
        recipient_email: d[spec.emailField] || null,
        // These letters were really issued — Mongo carries their number
        // and signature status. Landing them as Draft would invite
        // someone to "finish" a letter that is already out.
        status: 'Issued',
        body_html: html,
        issued_by: ctx.ownerUserId,
        issued_date: day(d[spec.dateField] ?? d.createdAt) ?? day(new Date()),
        template_snapshot_json: { imported_from: spec.coll, mongo_id: String(d._id) },
      }]);
      seen.add(number);
      bump(`${spec.coll}_imported`);
    }
  }
}

// ============================================================
// Website enquiries → contacts
// ============================================================
async function importLeads(db, ctx) {
  const existing = await sbSelect(
    `contacts?workspace_id=eq.${WORKSPACE_ID}&select=phone,email`,
  );
  const byPhone = new Set(existing.map((c) => c.phone));
  const byEmail = new Set(existing.map((c) => (c.email || '').toLowerCase()).filter(Boolean));

  const rows = [
    ...(await db.collection('contacts').find({}).toArray()).map((d) => ({
      name: d.name, email: d.email, phone: d.phone,
      note: [d.subject, d.message].filter(Boolean).join(' — '),
      created: d.createdAt, source: 'website contact form',
    })),
    ...(await db.collection('messages').find({}).toArray()).map((d) => ({
      name: d.fullName, email: d.email, phone: d.phone,
      note: [d.subject, d.message].filter(Boolean).join(' — '),
      created: d.createdAt, source: 'website message form',
    })),
  ];

  for (const r of rows) {
    const email = (r.email || '').toLowerCase().trim();
    // `contacts.phone` is NOT NULL; an enquiry with no number still has
    // an email worth keeping, so synthesise a placeholder rather than
    // dropping a lead on the floor.
    const phone = (r.phone || '').trim() || (email ? `email:${email}` : '');
    if (!phone) { skipped.push(`lead ${r.name || '(unnamed)'}: no phone or email`); continue; }
    if (byPhone.has(phone) || (email && byEmail.has(email))) { bump('leads_already_present'); continue; }

    await sbInsert('contacts', [{
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_ID,
      user_id: ctx.ownerUserId,
      name: r.name || null,
      email: r.email || null,
      phone,
      created_at: iso(r.created) ?? new Date().toISOString(),
    }]);
    byPhone.add(phone);
    if (email) byEmail.add(email);
    bump('leads_imported');
  }
}

// ============================================================
// Internships → recruitment
// ============================================================
const INTERN_STAGE = {
  ongoing: 'HIRED', completed: 'HIRED', accepted: 'OFFER',
  offered: 'OFFER', pending: 'APPLIED', rejected: 'REJECTED',
  cancelled: 'REJECTED', withdrawn: 'REJECTED',
};

async function importInterns(db, ctx) {
  const docs = await db.collection('internships').find({}).toArray();
  if (!docs.length) return;

  const existingCandidates = await sbSelect(
    `hr_candidates?workspace_id=eq.${WORKSPACE_ID}&select=id,email`,
  );
  const candidateByEmail = new Map(
    existingCandidates.map((c) => [(c.email || '').toLowerCase(), c.id]),
  );

  const existingJobs = await sbSelect(
    `hr_recruitment_jobs?workspace_id=eq.${WORKSPACE_ID}&select=id,title`,
  );
  const jobByTitle = new Map(existingJobs.map((j) => [j.title, j.id]));

  const existingApps = await sbSelect(
    `hr_job_applications?workspace_id=eq.${WORKSPACE_ID}&select=job_id,candidate_id`,
  );
  const appKeys = new Set(existingApps.map((a) => `${a.job_id}|${a.candidate_id}`));

  for (const d of docs) {
    const email = (d.candidateEmail || '').trim().toLowerCase();
    if (!email) { skipped.push(`internship ${d.internshipNumber}: no email`); continue; }

    // One job per distinct position, so the pipeline groups the way a
    // recruiter expects rather than showing 43 one-candidate roles.
    const title = (d.position || 'Intern').replace(/\.$/, '').trim();
    let jobId = jobByTitle.get(title);
    if (!jobId) {
      const [job] = await sbInsert('hr_recruitment_jobs', [{
        id: crypto.randomUUID(),
        workspace_id: WORKSPACE_ID,
        title,
        location: d.collegeAddress?.city || 'Belagavi',
        employment_type: 'INTERN',
        status: 'CLOSED',
        job_description: (d.responsibilities || []).map((r) => `• ${r}`).join('\n') || null,
      }]);
      jobId = job.id;
      jobByTitle.set(title, jobId);
      bump('intern_jobs_created');
    }

    let candidateId = candidateByEmail.get(email);
    if (!candidateId) {
      const [cand] = await sbInsert('hr_candidates', [{
        id: crypto.randomUUID(),
        workspace_id: WORKSPACE_ID,
        full_name: (d.candidateName || email).replace(/\.$/, '').trim(),
        email,
        phone: d.candidatePhone || null,
        created_at: iso(d.createdAt) ?? new Date().toISOString(),
      }]);
      candidateId = cand.id;
      candidateByEmail.set(email, candidateId);
      bump('intern_candidates_created');
    }

    const key = `${jobId}|${candidateId}`;
    if (appKeys.has(key)) { bump('intern_applications_already_present'); continue; }

    await sbInsert('hr_job_applications', [{
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_ID,
      job_id: jobId,
      candidate_id: candidateId,
      stage: INTERN_STAGE[String(d.status).toLowerCase()] ?? 'APPLIED',
      applied_at: iso(d.offerDate ?? d.createdAt) ?? new Date().toISOString(),
    }]);
    appKeys.add(key);
    bump('intern_applications_created');
  }
}

// ============================================================
async function main() {
  console.log(LIVE ? '=== LIVE RUN — writing ===' : '=== DRY RUN — nothing is written ===');

  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();

  // Context shared by every section: who owns imported rows, and the
  // email → workspace_member map that links letters to employees.
  const members = await sbSelect(
    `workspace_members?workspace_id=eq.${WORKSPACE_ID}&select=id,user_id`,
  );
  const profiles = await sbSelect(
    `profiles?select=user_id,email&user_id=in.(${members.map((m) => m.user_id).join(',')})`,
  );
  const emailByUser = new Map(profiles.map((p) => [p.user_id, (p.email || '').toLowerCase()]));
  const memberIdByEmail = new Map();
  let ownerUserId = null;
  for (const m of members) {
    const email = emailByUser.get(m.user_id);
    if (email) memberIdByEmail.set(email, m.id);
    if (email === OWNER_EMAIL) ownerUserId = m.user_id;
  }
  if (!ownerUserId) {
    throw new Error(`Owner ${OWNER_EMAIL} is not a member of workspace ${WORKSPACE_ID}.`);
  }
  const ctx = { memberIdByEmail, ownerUserId };
  console.log(`Workspace members: ${members.length}, resolvable emails: ${memberIdByEmail.size}`);

  const sections = { letters: importLetters, leads: importLeads, interns: importInterns };
  for (const [name, fn] of Object.entries(sections)) {
    if (ONLY && ONLY !== name) continue;
    console.log(`\n--- ${name} ---`);
    await fn(db, ctx);
  }

  await client.close();

  console.log('\n=== SUMMARY ===');
  for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k.padEnd(42)} ${v}`);
  if (skipped.length) {
    console.log(`\n=== SKIPPED (${skipped.length}) ===`);
    for (const s of skipped.slice(0, 40)) console.log(`  ${s}`);
  }
  if (!LIVE) console.log('\nDry run only. Re-run with --live to write.');
}

main().catch((err) => { console.error('\nFAILED:', err.message); process.exit(1); });
