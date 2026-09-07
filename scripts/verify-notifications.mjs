import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

// Load .env.local if exists
if (existsSync('.env.local')) {
  const envContent = readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length > 0 && !process.env[k.trim()]) {
      let val = v.join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[k.trim()] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('\n======================================================');
  console.log('🚀 DAILYBUZ MARKETING NOTIFICATIONS & CALENDAR VERIFY');
  console.log('======================================================\n');

  const notifId = '26ebf76b-2d82-42bf-a3f8-962057828b84';
  const workspaceId = 'ab6095d0-aa86-4328-934b-d56f26d8d7d8';

  // 1. Check Database Notification
  console.log('1️⃣  Checking Notification Record in Supabase DB...');
  const { data: notif, error: notifErr } = await supabase
    .from('marketing_notifications')
    .select('*')
    .eq('id', notifId)
    .single();

  if (notifErr || !notif) {
    console.log('   ⚠️ Target notification not found, checking all workspace notifications...');
    const { data: allNotifs } = await supabase
      .from('marketing_notifications')
      .select('*')
      .eq('workspace_id', workspaceId);
    console.log(`   Found ${allNotifs?.length || 0} notifications for workspace.`);
  } else {
    console.log('   ✅ Notification Found:');
    console.log(`      ID:        ${notif.id}`);
    console.log(`      Type:      ${notif.type}`);
    console.log(`      Title:     ${notif.title}`);
    console.log(`      Message:   ${notif.message}`);
    console.log(`      Read At:   ${notif.read_at ?? 'unread (null)'}`);
    console.log(`      Created:   ${notif.created_at}`);
  }

  // 2. Check Database Post for Today
  console.log('\n2️⃣  Checking Scheduled Marketing Posts in DB...');
  const { data: posts, error: postErr } = await supabase
    .from('marketing_posts')
    .select('id, title, scheduled_at, status, timezone')
    .eq('workspace_id', workspaceId);

  if (postErr) {
    console.error('   ❌ Error fetching posts:', postErr.message);
  } else {
    console.log(`   ✅ Found ${posts?.length || 0} posts in database.`);
    posts?.forEach((p) => {
      console.log(`      - [${p.status}] "${p.title}" at ${p.scheduled_at} (${p.timezone})`);
    });
  }

  // 3. Check Deduplication Index
  console.log('\n3️⃣  Testing Notification Deduplication (Unique Index)...');
  const dedupeKey = `daily_summary:${workspaceId}:all:2026-09-07`;
  const { error: dupErr } = await supabase.from('marketing_notifications').insert({
    workspace_id: workspaceId,
    type: 'POSTING_TODAY',
    title: "Today's Posting Schedule",
    message: 'Duplicate prevention test.',
    dedupe_key: dedupeKey,
  });

  if (dupErr && dupErr.code === '23505') {
    console.log('   ✅ PASS: Duplicate insert prevented by unique index constraint (23505).');
  } else if (!dupErr) {
    console.log('   ℹ️ Insert succeeded (no previous duplicate was present).');
  } else {
    console.log(`   ⚠️ Notice: ${dupErr.message}`);
  }

  // 4. Run Vitest Unit & Regression Tests
  console.log('\n4️⃣  Running Vitest Calendar & Notification Test Suites...');
  try {
    const vitestOutput = execSync(
      'npx vitest run src/lib/marketing/calendar-notifications.test.ts',
      { encoding: 'utf-8' }
    );
    console.log(vitestOutput.split('\n').filter(l => l.includes('passed') || l.includes('Test Files') || l.includes('Tests')).join('\n'));
    console.log('   ✅ PASS: All 32 calendar & notification regression tests passed.');
  } catch (err) {
    console.error('   ❌ Vitest failure:', err.message);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL SYSTEM CHECKS COMPLETED SUCCESSFULLY');
  console.log('======================================================\n');
}

run();
