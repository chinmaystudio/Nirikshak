/**
 * Storage path checks for user-supplied object keys.
 *
 * A safe path is relative, has no traversal or control characters, uses only
 * a conservative character set, and (when an owner prefix is required) starts
 * with that owner's folder: "<owner>/...".
 */
const SAFE_SEGMENT = /^[A-Za-z0-9._ ()-]+$/;

export function isSafeStoragePath(path: unknown, requiredPrefix?: string | null): boolean {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > 512) return false;
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  if (/[\u0000-\u001f]/.test(path)) return false;
  const segments = path.split('/');
  if (segments.some((seg) => seg === '' || seg === '.' || seg === '..' || !SAFE_SEGMENT.test(seg))) return false;
  if (requiredPrefix !== undefined) {
    if (!requiredPrefix) return false;
    if (segments.length < 2 || segments[0] !== requiredPrefix) return false;
  }
  return true;
}
