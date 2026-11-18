import { supabase } from '@/core/supabase/client';

/**
 * Uploads to the private Supabase Storage buckets. Object keys follow the
 * owner-folder convention enforced by storage RLS (migration 045):
 *   progress-evidence     <contractor org id>/<project id>/<file>
 *   contractor-documents  <contractor org id>/<file>
 *   government-documents  <government org id>/<file>
 *   complaint-evidence    <user id>/<file>
 */
export type PrivateBucket = 'progress-evidence' | 'contractor-documents' | 'government-documents' | 'complaint-evidence';

export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._ ()-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._ ]+/, '')
    .slice(-120);
  return cleaned || 'file';
}

function uniquePrefix(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}`;
}

export function buildObjectKey(folders: string[], fileName: string): string {
  return [...folders, `${uniquePrefix()}-${safeFileName(fileName)}`].join('/');
}

export async function uploadToBucket(bucket: PrivateBucket, key: string, body: Blob, contentType?: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).upload(key, body, {
    contentType: contentType || body.type || 'application/octet-stream',
    upsert: false,
  });
  if (error || !data) {
    const reason = error?.message || 'unknown error';
    throw new Error(/mfa|aal/i.test(reason)
      ? 'Two-step verification is required to upload files. Please verify and try again.'
      : `The file could not be uploaded (${reason}).`);
  }
  return data.path;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Unsupported file data.');
  const mime = match[1] || 'application/octet-stream';
  const raw = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Short-lived signed URL for viewing a private object. */
export async function signedUrl(bucket: PrivateBucket, key: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, expiresInSeconds);
  return error ? null : data?.signedUrl ?? null;
}
