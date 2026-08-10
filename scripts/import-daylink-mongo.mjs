#!/usr/bin/env node
/**
 * One-off ETL: Daylink's internal MongoDB → the Daylink Tech Labs tenant
 * in Dailybiz (Supabase).
 *
 * Usage:
 *   node scripts/import-daylink-mongo.mjs           # dry run — prints the plan
 *   node scripts/import-daylink-mongo.mjs --live    # writes
 *
 * WHAT MOVES
 *   teams + users (admins)  → auth users, profiles, workspace_members,
 *                             employee_profiles (matched by EMAIL — the 4
 *                             people already in the workspace are reused,
 *                             never duplicated)
 *   projects                → projects (+ one "General work (imported)"
 *                             task each, because time_logs.task_id is NOT
 *                             NULL and unticketed timesheet lines need a
 *                             home)
 *   tickets                 → tasks under their mapped project
 *   attendancerecords       → attendance (multi-session days collapse to
 *                             first-in / last-out, per-session detail
 *                             preserved in remarks) + time_logs for every
 *                             timesheet line
 *
 * IDEMPOTENT BY NATURAL KEYS, not by run-state: users by email, projects
 * by (workspace, name), tasks by (project, title), attendance by
 * (member, date), time_logs by (member, date, description, duration).
 * Re-running after a partial failure completes the remainder and changes
 * nothing that already landed.
 *
 * Emits scripts/output/daylink-import-map.json — the Mongo id → UUID map
 * for every entity, so anything imported can be targeted later.
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CRM_DIR = path.resolve(__dirname, '..');
const DAYLINK_DIR = '/Volumes/projects/daylink';

// Mongoose comes from the daylink project's node_modules — this repo does
// not depend on MongoDB and should not start to for a one-off import.
const daylinkRequire = createRequire(path.join(DAYLINK_DIR, 'package.json'));
const mongoose = daylinkRequire('mongoose');

const LIVE = process.argv.includes('--live');
const WORKSPACE_ID = 'ab6095d0-aa86-4328-934b-d56f26d8d7d8'; // Daylink Tech Labs Private Limited

// ---- env -------------------------------------------------------------
const mongoUri = fs
  .readFileSync(path.join(DAYLINK_DIR, '.env'), 'utf8')
  .match(/MONGODB_URI=(.*)/)[1]
  .trim();
const crmEnv = fs.readFileSync(path.join(CRM_DIR, '.env.local'), 'utf8');
const SUPA_URL = crmEnv.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPA_KEY = crmEnv.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const HEADERS = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

// ---- tiny REST helpers -----------------------------------------------
async function sbSelect(pathAndQuery) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, { headers: HEADERS });
  const json = await res.json();
  if (!res.ok) throw new Error(`SELECT ${pathAndQuery}: ${JSON.stringify(json)}`);
  return json;
}

async function sbInsert(table, rows) {
  // Real UUID shape even in dry runs: these ids feed later SELECT
  // filters, and Postgres rejects a non-UUID before matching nothing.
  if (!LIVE) return rows.map((r) => ({ id: r.id ?? crypto.randomUUID() }));
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`INSERT ${table}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function createAuthUser(email, fullName) {
  if (!LIVE) return { id: crypto.randomUUID() };
  const res = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email,
      // Random unguessable password; people get in via "forgot password".
      // Choosing passwords for humans is how passwords end up in chats.
      password: crypto.randomBytes(24).toString('base64url'),
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`auth create ${email}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const stats = {};
const bump = (k, n = 1) => (stats[k] = (stats[k] ?? 0) + n);
const map = { workspaceId: WORKSPACE_ID, users: {}, projects: {}, tickets: {}, generatedAt: new Date().toISOString() };

// ---- main -------------------------------------------------------------
async function main() {
  console.log(LIVE ? '=== LIVE RUN ===' : '=== DRY RUN (pass --live to write) ===');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  // ---------- source ----------
  const teams = await db.collection('teams').find({}).toArray();
  // The `users` collection is WEB-APP LOGINS, not staff — it holds admin
  // accounts for OTHER sites hosted from the same codebase (pfwci.org
  // demo users live there). Importing it once put two strangers into the
  // company workspace; they were removed, and staff now come exclusively
  // from `teams`. Attendance rows with employeeModel 'User' that point
  // at deleted web logins stay skipped as unknown.
  const adminUsers = [];
  const mongoProjects = await db.collection('projects').find({}).toArray();
  const tickets = await db.collection('tickets').find({}).toArray();
  const attendance = await db.collection('attendancerecords').find({}).sort({ date: 1 }).toArray();
  console.log(`source: ${teams.length} team, ${adminUsers.length} admins, ${mongoProjects.length} projects, ${tickets.length} tickets, ${attendance.length} attendance days`);

  // ---------- existing target state ----------
  const existingMembers = await sbSelect(
    `workspace_members?select=id,user_id,role&workspace_id=eq.${WORKSPACE_ID}`,
  );
  const memberProfiles = existingMembers.length
    ? await sbSelect(
        `profiles?select=user_id,email,full_name&user_id=in.(${existingMembers.map((m) => m.user_id).join(',')})`,
      )
    : [];
  const memberByEmail = {};
  for (const m of existingMembers) {
    const p = memberProfiles.find((x) => x.user_id === m.user_id);
    if (p?.email) memberByEmail[p.email.toLowerCase()] = { memberId: m.id, userId: m.user_id };
  }

  const allProfiles = await sbSelect('profiles?select=user_id,email');
  const userByEmail = {};
  for (const p of allProfiles) if (p.email) userByEmail[p.email.toLowerCase()] = p.user_id;

  const existingProjects = await sbSelect(`projects?select=id,name&workspace_id=eq.${WORKSPACE_ID}`);
  const existingEmpProfiles = await sbSelect(
    `employee_profiles?select=workspace_member_id&workspace_id=eq.${WORKSPACE_ID}`,
  );
  const empProfileSet = new Set(existingEmpProfiles.map((e) => e.workspace_member_id));
  const departments = await sbSelect(`departments?select=id,name&workspace_id=eq.${WORKSPACE_ID}`);
  const designations = await sbSelect(`designations?select=id,title&workspace_id=eq.${WORKSPACE_ID}`);

  // ---------- 1. people ----------
  // Admins from `users` + staff from `teams`, deduped by email. Attendance
  // records reference either collection (employeeModel), so both maps are
  // keyed by mongo id string.
  const people = [];
  const seenEmails = new Set();
  for (const t of [...teams, ...adminUsers]) {
    const email = (t.email ?? '').trim().toLowerCase();
    // Source data contains at least one typo'd address with no @. Auth
    // would reject it anyway; skip the person, keep their name in the
    // map so someone can fix the address and re-run — idempotency makes
    // the re-run pick up exactly this person.
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!email || !emailValid || seenEmails.has(email)) {
      if (!email) bump('people_skipped_no_email');
      if (email && !emailValid) {
        bump('people_skipped_invalid_email');
        map.users[String(t._id)] = { invalidEmail: email, name: t.name ?? null };
        console.log('  ! invalid email, skipped:', t.name, '<' + email + '>');
        continue;
      }
      map.users[String(t._id)] = map.users[String(t._id)] ?? { email: email || null };
      if (email && seenEmails.has(email)) {
        // Same human in both collections — point this mongo id at the
        // same person.
        const prior = people.find((p) => p.email === email);
        if (prior) prior.mongoIds.push(String(t._id));
      }
      continue;
    }
    seenEmails.add(email);
    people.push({
      mongoIds: [String(t._id)],
      email,
      name: t.name ?? email.split('@')[0],
      designation: (t.designation ?? '').trim(),
      department: (t.department ?? '').trim(),
      phone: t.phone ?? null,
    });
  }

  const memberIdByMongo = {};
  for (const person of people) {
    let entry = memberByEmail[person.email];

    if (!entry) {
      let userId = userByEmail[person.email];
      if (!userId) {
        const created = await createAuthUser(person.email, person.name);
        userId = created.id;
        bump('auth_users_created');
        if (LIVE) {
          // The signup trigger may or may not fire for admin-created
          // users; upsert the profile so the name is right either way.
          await fetch(`${SUPA_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({ user_id: userId, email: person.email, full_name: person.name }),
          });
        }
      } else bump('auth_users_existing');

      const [member] = await sbInsert('workspace_members', [
        { id: crypto.randomUUID(), workspace_id: WORKSPACE_ID, user_id: userId, role: 'member' },
      ]);
      entry = { memberId: member.id, userId };
      bump('members_created');
    } else bump('members_existing');

    for (const mid of person.mongoIds) memberIdByMongo[mid] = entry.memberId;
    map.users[person.email] = {
      mongoIds: person.mongoIds,
      userId: entry.userId,
      workspaceMemberId: entry.memberId,
    };

    // Employee profile so HR/attendance features see them as staff.
    if (!empProfileSet.has(entry.memberId)) {
      let departmentId = null;
      if (person.department) {
        let d = departments.find((x) => x.name.toLowerCase() === person.department.toLowerCase());
        if (!d) {
          [d] = await sbInsert('departments', [
            { workspace_id: WORKSPACE_ID, name: person.department },
          ]);
          departments.push({ id: d.id, name: person.department });
          bump('departments_created');
        }
        departmentId = d.id;
      }
      let designationId = null;
      if (person.designation) {
        let d = designations.find((x) => x.title.toLowerCase() === person.designation.toLowerCase());
        if (!d) {
          [d] = await sbInsert('designations', [
            { workspace_id: WORKSPACE_ID, title: person.designation },
          ]);
          designations.push({ id: d.id, title: person.designation });
          bump('designations_created');
        }
        designationId = d.id;
      }

      // Sequential employee code so the HR list's ID column is populated
      // (imported rows previously showed '-').
      const codeRows = await sbSelect(
        `employee_profiles?select=employee_code&workspace_id=eq.${WORKSPACE_ID}&employee_code=not.is.null`,
      );
      const usedCodes = new Set(codeRows.map((r) => r.employee_code));
      let n = 0;
      while (usedCodes.has(`EMP-${String(n).padStart(4, '0')}`)) n++;

      await sbInsert('employee_profiles', [
        {
          workspace_member_id: entry.memberId,
          workspace_id: WORKSPACE_ID,
          employee_code: `EMP-${String(n).padStart(4, '0')}`,
          department_id: departmentId,
          designation_id: designationId,
          // Live rows use 'ACTIVE' (checked constraint) and free-text
          // employment_type — mirror what the app actually writes.
          employment_type: 'Full Time',
          status: 'ACTIVE',
          notes: `Imported from Daylink internal system (${person.mongoIds.join(', ')})`,
          // Salary is deliberately NOT migrated here: the Mongo letters
          // carry it inconsistently and a wrong salary in payroll is worse
          // than a blank one. HR fills these in Dailybiz.
          basic_salary: 0,
          hra: 0,
          special_allowance: 0,
          pf_deduction: 0,
          professional_tax: 0,
          tds_deduction: 0,
          ctc_annual: 0,
          attendance_enabled: true,
        },
      ]);
      bump('employee_profiles_created');
    }
  }

  // ---------- 2. projects (+ catch-all tasks) ----------
  const projectIdByMongo = {}; // mongo _id → dailybiz project id
  const projectIdByNumber = {}; // mongo numeric projectId → dailybiz id
  const catchAllTaskByProject = {};

  async function ensureProject(name) {
    let p = existingProjects.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!p) {
      [p] = await sbInsert('projects', [
        { id: crypto.randomUUID(), workspace_id: WORKSPACE_ID, name, status: 'active' },
      ]);
      existingProjects.push({ id: p.id, name });
      bump('projects_created');
    } else bump('projects_existing');
    return p.id;
  }

  async function ensureTask(projectId, title, extra = {}) {
    const existing = await sbSelect(
      `tasks?select=id&workspace_id=eq.${WORKSPACE_ID}&project_id=eq.${projectId}&title=eq.${encodeURIComponent(title)}&limit=1`,
    );
    if (existing.length) return existing[0].id;
    const [t] = await sbInsert('tasks', [
      {
        id: crypto.randomUUID(),
        workspace_id: WORKSPACE_ID,
        project_id: projectId,
        title,
        sort_order: 0,
        ...extra,
      },
    ]);
    bump('tasks_created');
    return t.id;
  }

  for (const mp of mongoProjects) {
    const pid = await ensureProject(mp.title);
    projectIdByMongo[String(mp._id)] = pid;
    if (mp.projectId != null) projectIdByNumber[mp.projectId] = pid;
    map.projects[String(mp._id)] = { name: mp.title, projectId: pid };
    catchAllTaskByProject[pid] = await ensureTask(pid, 'General work (imported)');
  }

  const generalProjectId = await ensureProject('Internal — General');
  const generalTaskId = await ensureTask(generalProjectId, 'General work (imported)');
  catchAllTaskByProject[generalProjectId] = generalTaskId;

  // ---------- 3. tickets → tasks ----------
  const taskIdByTicket = {};
  for (const tk of tickets) {
    const projectId = projectIdByNumber[tk.projectId] ?? generalProjectId;
    const title = `${tk.ticketNumber ? tk.ticketNumber + ' — ' : ''}${tk.title}`.slice(0, 250);
    const taskId = await ensureTask(projectId, title, {
      description: tk.description ?? null,
      assigned_workspace_member_id: memberIdByMongo[String(tk.assignedTo)] ?? null,
      completed_at: tk.status === 'done' ? new Date().toISOString() : null,
    });
    taskIdByTicket[String(tk._id)] = taskId;
    map.tickets[String(tk._id)] = { title, taskId };
  }

  // ---------- 4. attendance + time logs ----------
  const existingAttendance = await sbSelect(
    `attendance?select=workspace_member_id,attendance_date&workspace_id=eq.${WORKSPACE_ID}&limit=10000`,
  );
  const attKey = (m, d) => `${m}|${d}`;
  const attSet = new Set(existingAttendance.map((a) => attKey(a.workspace_member_id, a.attendance_date)));

  const existingLogs = await sbSelect(
    `time_logs?select=workspace_member_id,log_date,duration,description&workspace_id=eq.${WORKSPACE_ID}&limit=10000`,
  );
  const logKey = (m, d, dur, desc) => `${m}|${d}|${dur}|${(desc ?? '').slice(0, 80)}`;
  const logSet = new Set(existingLogs.map((l) => logKey(l.workspace_member_id, l.log_date, l.duration, l.description)));

  for (const rec of attendance) {
    const memberId = memberIdByMongo[String(rec.employeeId)];
    if (!memberId) {
      bump('attendance_skipped_unknown_employee');
      continue;
    }
    const dateStr = new Date(rec.date).toISOString().slice(0, 10);

    // Collapse sessions to first-in/last-out; keep the true structure in
    // remarks so nothing is lost even though the target is single-span.
    const sessions = (rec.sessions ?? []).filter((s) => s.punchIn?.timestamp);
    const firstIn = sessions[0]?.punchIn ?? rec.punchIn;
    const lastOutSession = [...sessions].reverse().find((s) => s.punchOut?.timestamp);
    const lastOut = lastOutSession?.punchOut ?? rec.punchOut;

    const remarks = [];
    if (sessions.length > 1)
      remarks.push(
        `${sessions.length} sessions: ` +
          sessions
            .map((s) => {
              const i = s.punchIn?.timestamp ? new Date(s.punchIn.timestamp).toISOString().slice(11, 16) : '?';
              const o = s.punchOut?.timestamp ? new Date(s.punchOut.timestamp).toISOString().slice(11, 16) : '…';
              return `${i}–${o}`;
            })
            .join(', ') + ' UTC',
      );
    if (rec.wasLate) remarks.push('Late arrival (per Daylink shift rules)');
    if (rec.manualEntry) remarks.push('Manual entry by admin in Daylink');
    remarks.push(`Imported from Daylink (${rec._id})`);

    if (!attSet.has(attKey(memberId, dateStr))) {
      await sbInsert('attendance', [
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_ID,
          workspace_member_id: memberId,
          attendance_date: dateStr,
          punch_in_time: firstIn?.timestamp ? new Date(firstIn.timestamp).toISOString() : null,
          punch_out_time: lastOut?.timestamp ? new Date(lastOut.timestamp).toISOString() : null,
          punch_in_location:
            firstIn?.latitude != null ? `${firstIn.latitude},${firstIn.longitude}` : null,
          punch_out_location:
            lastOut?.latitude != null ? `${lastOut.latitude},${lastOut.longitude}` : null,
          working_hours: rec.totalHoursWorked ?? null,
          status: rec.status ?? 'Present',
          remarks: remarks.join(' · '),
          punch_in_ip: firstIn?.ipAddress ?? null,
          punch_out_ip: lastOut?.ipAddress ?? null,
          is_approved: true,
        },
      ]);
      attSet.add(attKey(memberId, dateStr));
      bump('attendance_created');
    } else bump('attendance_existing');

    // Timesheet lines → time_logs against the ticket's task, the
    // project's catch-all, or the general bucket, in that order.
    for (const line of rec.tasks ?? []) {
      if (!line.description) continue;
      const hours = Number(line.hours) || 0;
      const taskId =
        taskIdByTicket[String(line.ticketId)] ??
        (line.projectId && projectIdByMongo[String(line.projectId)]
          ? catchAllTaskByProject[projectIdByMongo[String(line.projectId)]]
          : generalTaskId);
      const description = line.projectName
        ? `[${line.projectName}] ${line.description}`
        : line.description;

      const key = logKey(memberId, dateStr, hours, description);
      if (logSet.has(key)) {
        bump('time_logs_existing');
        continue;
      }
      await sbInsert('time_logs', [
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_ID,
          task_id: taskId,
          workspace_member_id: memberId,
          log_date: dateStr,
          duration: hours,
          billable: false,
          description,
        },
      ]);
      logSet.add(key);
      bump('time_logs_created');
    }
  }

  await mongoose.disconnect();

  // ---------- output ----------
  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'daylink-import-map.json');
  if (LIVE) fs.writeFileSync(outPath, JSON.stringify(map, null, 2));

  console.log('\n=== SUMMARY ===');
  for (const [k, v] of Object.entries(stats).sort()) console.log(String(v).padStart(6), k);
  if (LIVE) console.log('\nID map written to', outPath);
  else console.log('\nDry run — nothing written. Re-run with --live.');
}

main().catch((e) => {
  console.error('IMPORT FAILED:', e.message);
  process.exit(1);
});
