/**
 * True when PostgREST reports that a database function does not exist yet,
 * i.e. the environment has not applied the migration that adds it. Callers
 * then fall back to the previous behaviour until the migration is applied.
 */
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || ''));
}
