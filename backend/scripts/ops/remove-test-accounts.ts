/**
 * Lists, and with --apply deletes, the demo/test accounts that were seeded
 * into the Supabase project during development. Their passwords were
 * published in this repository's history, so they must not exist in
 * production.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ops/remove-test-accounts.ts          # dry run
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ops/remove-test-accounts.ts --apply  # delete
 *
 * Accounts with audit history cannot be deleted (audit_logs.actor_id
 * references the user and the audit log is append-only), so those are
 * disabled instead: banned indefinitely, so no session can be refreshed. The audit
 * trail keeps who did what.
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
    if (!error) {
      console.log(`  deleted ${m.email}`);
      continue;
    }
    // Typically a foreign key from the append-only audit log: disable instead.
    const { error: banError } = await admin.auth.admin.updateUserById(m.id, { ban_duration: '876000h' });
    if (banError) {
      console.log(`  FAILED ${m.email}: ${error.message}; ban also failed: ${banError.message}`);
      continue;
    }
    // A banned user cannot refresh a session; any current access token expires within the hour.
    console.log(`  disabled ${m.email} (has audit history: ${error.message})`);
  }
}
