import type { ApiErrorShape } from "@/types/api";

export class ApiError extends Error implements ApiErrorShape {
  readonly status?: number;
  readonly code?: string;
  readonly offline: boolean;
  readonly notFound: boolean;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = "ApiError";
    this.status = shape.status;
    this.code = shape.code;
    this.offline = shape.offline ?? false;
    this.notFound = shape.notFound ?? false;
  }
}

export function isOnline(): boolean {
  return navigator.onLine !== false;
}

export function offlineGuard(): void {
  if (!isOnline()) {
    throw new ApiError({
      message: "You appear to be offline. Check your network connection and try again.",
      offline: true
    });
  }
}

/**
 * DF-46: simulated network latency was removed — it imitated backend/AI work
 * in production. Kept as an immediately-resolving helper so existing callers
 * (step animations) keep their shape without fake delays.
 */
export function latency(_minMs = 0, _maxMs = 0): Promise<void> {
  return Promise.resolve();
}

/**
 * fetch with a 60s AbortController timeout. Backend cold starts on
 * Render/Vercel can take tens of seconds, so the timeout is generous —
 * it exists so a sleeping/unreachable backend fails with an error
 * instead of leaving the UI on an indefinite spinner.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function notFound(message: string): ApiError {
  return new ApiError({ message, notFound: true });
}

export function failure(message: string): ApiError {
  return new ApiError({ message });
}
