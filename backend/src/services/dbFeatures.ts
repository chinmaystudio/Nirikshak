import { supabaseAdmin } from './supabase.js';

/**
 * Compatibility helpers for rolling out code before database migrations
 * 040-045 are applied to an environment. Once they are applied, every
 * check below takes the secure path automatically.
 */

/** PostgREST "function not found" (migration not applied yet). */
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || ''));
}

/** Postgres "column does not exist" / PostgREST unknown column. */
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(error.message || ''));
}

let mfaCache: { value: boolean; at: number } | null = null;

/**
 * Whether two-step verification is required for government/contractor writes.
 *   REQUIRE_MFA=true  -> always
 *   REQUIRE_MFA=false -> never (development only)
 *   unset             -> follow the database (platform_settings.require_mfa,
 *                        created by migration 043); not required before 043.
 */
export async function mfaRequired(): Promise<boolean> {
  if (process.env.REQUIRE_MFA === 'true') return true;
  if (process.env.REQUIRE_MFA === 'false') return false;
  const now = Date.now();
  if (mfaCache && now - mfaCache.at < 60_000) return mfaCache.value;
  let value = false;
  try {
    const { data, error } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'require_mfa').maybeSingle();
    value = !error && !!data && String(data.value) !== 'false';
  } catch {
    value = mfaCache?.value ?? false;
  }
  mfaCache = { value, at: now };
  return value;
}

/** Test hook. */
export function resetMfaCache(): void {
  mfaCache = null;
}
