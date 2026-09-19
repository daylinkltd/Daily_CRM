import { createClient } from '@supabase/supabase-js';
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

console.log('\n==================================================================');
console.log('🔍 DAILYBUZ STAGING LIVE E2E ENVIRONMENT DIAGNOSTICS');
console.log('==================================================================\n');

// 1. Check Migration 136 Columns in Supabase
console.log('1️⃣  Checking Supabase Database Schema for Migration 136...');
if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: post, error: postErr } = await supabase
    .from('marketing_posts')
    .select('id, platform_results, target_channel_ids, locked_at, locked_by')
    .limit(1);

  if (postErr) {
    console.log(`   ❌ Database Migration 136 Status: NOT APPLIED (${postErr.message})`);
  } else {
    console.log('   ✅ Database Migration 136 Status: APPLIED in Supabase');
  }

  const { data: channels, error: chanErr } = await supabase
    .from('marketing_social_channels')
    .select('id, provider, platform, display_name, status, is_enabled, account_type, page_access_token_encrypted')
    .limit(10);

  if (chanErr) {
    console.log(`   ⚠️ Channels query error: ${chanErr.message}`);
  } else {
    console.log(`   ✅ marketing_social_channels: ${channels?.length || 0} rows found in database`);
    for (const ch of channels || []) {
      const hasToken = Boolean(ch.page_access_token_encrypted);
      console.log(`      - [${ch.platform}] "${ch.display_name}" (${ch.status}) | Token Stored: ${hasToken ? 'YES (Encrypted)' : 'NO'}`);
    }
  }
} else {
  console.log('   ❌ Supabase credentials missing.');
}

// 2. Check Meta Environment Variables
console.log('\n2️⃣  Checking Meta Credentials...');
const metaAppId = process.env.META_APP_ID || process.env.FACEBOOK_CLIENT_ID;
const metaSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;
console.log(`   - META_APP_ID:        ${metaAppId ? 'Configured (' + metaAppId.slice(0, 4) + '...)' : 'MISSING'}`);
console.log(`   - META_APP_SECRET:    ${metaSecret ? 'Configured (***)' : 'MISSING'}`);
console.log(`   - META_GRAPH_VERSION: ${process.env.META_GRAPH_API_VERSION || 'v22.0 (default)'}`);

// 3. Check LinkedIn Environment Variables
console.log('\n3️⃣  Checking LinkedIn Credentials...');
const liClientId = process.env.LINKEDIN_CLIENT_ID;
const liSecret = process.env.LINKEDIN_CLIENT_SECRET;
console.log(`   - LINKEDIN_CLIENT_ID:     ${liClientId ? 'Configured (' + liClientId.slice(0, 4) + '...)' : 'MISSING'}`);
console.log(`   - LINKEDIN_CLIENT_SECRET: ${liSecret ? 'Configured (***)' : 'MISSING'}`);
console.log(`   - LINKEDIN_API_VERSION:   ${process.env.LINKEDIN_API_VERSION || '202501 (default)'}`);

console.log('\n==================================================================\n');
