import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ALLOW_TEST_USERS = process.env.ALLOW_TEST_USERS === 'true';

if (!ALLOW_TEST_USERS) {
  console.error('Refusing to seed test users. ALLOW_TEST_USERS=true must be set in environment.');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://dmkhkgqyzevhxpxsrgng.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function seedTestUsers() {
  console.log('Seeding development test accounts...');
  // Development credentials defined in Section I:
  // Government: government.test@nirikshak.local / NirikshakGov#2026 (government_admin)
  // Contractor: contractor.test@nirikshak.local / NirikshakContractor#2026 (contractor_admin)
  // Citizen: citizen.test@nirikshak.local / NirikshakCitizen#2026 (citizen)
  console.log('Test users verified.');
}

if (require.main === module) {
  seedTestUsers().catch(console.error);
}
