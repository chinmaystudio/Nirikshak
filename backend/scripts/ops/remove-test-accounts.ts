/**
 * Lists, and with --apply deletes, the demo/test accounts that were seeded
 * into the Supabase project during development. Their passwords were
 * published in this repository's history, so they must not exist in
 * production.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ops/remove-test-accounts.ts          # dry run
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ops/remove-test-accounts.ts --apply  # delete
 *
 * Deleting an auth user cascades to its profile and memberships. Audit-log
 * rows that reference the user id are kept (append-only).
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const apply = process.argv.includes('--apply');

const isTestAccount = (email: string) =>
  /@nirikshak\.local$/i.test(email) ||
  email.toLowerCase() === 'government@gmail.com' ||
  /^(government|contractor|citizen)[._-]?(test|e2e|demo)/i.test(email) ||
  /(\+test|\.test|e2e)@/i.test(email);

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const matches: { id: string; email: string }[] = [];
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) if (u.email && isTestAccount(u.email)) matches.push({ id: u.id, email: u.email });
  if (data.users.length < 1000) break;
}

console.log(`${matches.length} test/demo account(s) found${apply ? '' : ' (dry run — pass --apply to delete)'}:`);
for (const m of matches) console.log(`  ${m.email}  ${m.id}`);

if (apply) {
  for (const m of matches) {
    const { error } = await admin.auth.admin.deleteUser(m.id);
    console.log(error ? `  FAILED ${m.email}: ${error.message}` : `  deleted ${m.email}`);
  }
}
