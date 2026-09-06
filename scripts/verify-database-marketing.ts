import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('Connecting to Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDatabase() {
  console.log('--- 1. Testing marketing_brand_profiles ---');
  const { data: profiles, error: pErr } = await supabase
    .from('marketing_brand_profiles')
    .select('*')
    .limit(1);
  console.log('Profiles query result:', { data: profiles, error: pErr });

  console.log('--- 2. Testing marketing_brand_assets ---');
  const { data: assets, error: aErr } = await supabase
    .from('marketing_brand_assets')
    .select('*')
    .limit(1);
  console.log('Assets query result:', { data: assets, error: aErr });

  console.log('--- 3. Testing marketing_posts ---');
  const { data: posts, error: postErr } = await supabase
    .from('marketing_posts')
    .select('id, image_prompt, video_prompt, media_type, media_source')
    .limit(1);
  console.log('Posts query result:', { data: posts, error: postErr });

  console.log('--- 4. Testing Storage Buckets ---');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('Buckets list:', buckets?.map((b) => ({ id: b.id, name: b.name, public: b.public })), 'Error:', bErr);
}

checkDatabase().catch(console.error);
