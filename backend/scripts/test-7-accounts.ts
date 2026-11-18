import { createClient } from '@supabase/supabase-js';
// Development/staging helper. Creates or signs in test accounts, so it must
// never run against the production project. Passwords come from the
// environment (NIRIKSHAK_TEST_PASSWORD); none are stored in the repository.
if (process.env.NIRIKSHAK_ALLOW_TEST_ACCOUNTS !== 'true' || !process.env.NIRIKSHAK_TEST_PASSWORD) {
  throw new Error('Refusing to run: set NIRIKSHAK_ALLOW_TEST_ACCOUNTS=true and NIRIKSHAK_TEST_PASSWORD, and point SUPABASE_URL at a non-production project.');
}


const supabaseUrl = 'https://dmkhkgqyzevhxpxsrgng.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const accounts = [
  { role: 'GOVERNMENT', email: 'government.e2e@nirikshak.local', pass: process.env.NIRIKSHAK_TEST_PASSWORD! },
  { role: 'CONTRACTOR 1', email: 'contractor1.e2e@nirikshak.local', pass: process.env.NIRIKSHAK_TEST_PASSWORD! },
  { role: 'CONTRACTOR 2', email: 'contractor2.e2e@nirikshak.local', pass: process.env.NIRIKSHAK_TEST_PASSWORD! },
  { role: 'CONTRACTOR 3', email: 'contractor3.e2e@nirikshak.local', pass: process.env.NIRIKSHAK_TEST_PASSWORD! },
  { role: 'CONTRACTOR 4', email: 'contractor4.e2e@nirikshak.local', pass: process.env.NIRIKSHAK_TEST_PASSWORD! },
  { role: 'CONTRACTOR 5', email: 'contractor5.e2e@nirikshak.local', pass: process.env.NIRIKSHAK_TEST_PASSWORD! },
  { role: 'CITIZEN', email: 'citizen.e2e@nirikshak.local', pass: process.env.NIRIKSHAK_TEST_PASSWORD! },
];

async function check() {
  console.log('=== VERIFYING SUPABASE AUTH SIGN-IN FOR ALL 7 ACCOUNTS ===\n');
  let allPass = true;

  for (const acc of accounts) {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const res = await client.auth.signInWithPassword({
      email: acc.email,
      password: acc.pass,
    });

    if (res.error) {
      console.log(`❌ ${acc.role} (${acc.email}): FAILED - ${res.error.message}`);
      allPass = false;
    } else {
      console.log(`✓ ${acc.role} (${acc.email}): LOGIN SUCCESS - User ID ${res.data.user.id}`);
    }
  }

  if (!allPass) process.exit(1);
}

check().catch(console.error);
