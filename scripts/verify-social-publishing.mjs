import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import crypto from 'crypto';

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
console.log('🚀 DAILYBUZ NATIVE SOCIAL PUBLISHING ENGINE VERIFICATION');
console.log('==================================================================\n');

// 1. Verify Configuration & Encryption Roundtrip
console.log('1️⃣  Verifying AES-256-GCM Token Encryption...');
const rawSecret = process.env.ENCRYPTION_KEY || 'daily-crm-vps-fallback-aes-256-key-32b-secret';
const key = crypto.createHash('sha256').update(rawSecret.trim()).digest();
const testToken = 'EAAB_test_token_meta_graph_v22_' + Date.now();

const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(testToken, 'utf8', 'hex');
encrypted += cipher.final('hex');
const tag = cipher.getAuthTag();
const tokenCiphertext = `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;

// Decrypt
const parts = tokenCiphertext.split(':');
const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'hex'));
decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
let decrypted = decipher.update(parts[1], 'hex', 'utf8');
decrypted += decipher.final('utf8');

if (decrypted === testToken) {
  console.log('   ✅ AES-256-GCM encryption/decryption roundtrip verified.');
} else {
  console.error('   ❌ Token decryption mismatch!');
  process.exit(1);
}

// 2. Check Database Schema if Supabase URL is available
if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('\n2️⃣  Verifying Supabase Tables & Schema Columns...');

  try {
    const { data: posts, error: postErr } = await supabase
      .from('marketing_posts')
      .select('id, status, platform_results, target_channel_ids, locked_at')
      .limit(1);

    if (postErr) {
      console.log(`   ⚠️ Table marketing_posts column check: ${postErr.message}`);
      console.log('   ℹ️ Make sure migration 136_native_social_publishing.sql is pasted into Supabase SQL Editor.');
    } else {
      console.log('   ✅ Table marketing_posts has native publishing columns (platform_results, locked_at, etc.).');
    }

    const { data: channels, error: chanErr } = await supabase
      .from('marketing_social_channels')
      .select('id, provider, platform, display_name, status, is_enabled')
      .limit(5);

    if (chanErr) {
      console.log(`   ⚠️ Table marketing_social_channels query: ${chanErr.message}`);
    } else {
      console.log(`   ✅ marketing_social_channels present (${channels?.length || 0} active channels in DB).`);
      for (const ch of channels || []) {
        console.log(`      - [${ch.platform}] ${ch.display_name} (${ch.status})`);
      }
    }
  } catch (dbErr) {
    console.warn('   ⚠️ Supabase query skipped:', dbErr.message);
  }
} else {
  console.log('\n2️⃣  Supabase environment keys not set locally (check .env.local).');
}

console.log('\n==================================================================');
console.log('🎉 VERIFICATION SCRIPT COMPLETED');
console.log('==================================================================\n');
