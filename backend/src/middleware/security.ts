import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup of expired in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Shared counter store. On serverless hosting (Vercel) every instance has its
 * own memory, so an in-memory limiter does not limit anything. When
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, counters live in
 * Redis and are shared by all instances. Without them the limiter falls back
 * to memory and logs a warning once in production.
 */
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
let warnedMemoryFallback = false;

async function incrementShared(key: string, windowMs: number): Promise<{ count: number; resetTime: number } | null> {
  if (!redisUrl || !redisToken) return null;
  try {
    const response = await fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', `rl:${key}`],
        ['PEXPIRE', `rl:${key}`, String(windowMs), 'NX'],
        ['PTTL', `rl:${key}`],
      ]),
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
    const result = (await response.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(result?.[0]?.result);
    const ttl = Number(result?.[2]?.result);
    if (!Number.isFinite(count)) throw new Error('unexpected Redis reply');
    return { count, resetTime: Date.now() + (ttl > 0 ? ttl : windowMs) };
  } catch (err: any) {
    // Fail open to the local limiter rather than taking the API down.
    console.warn('[rateLimit] shared store unavailable, using local counters:', err?.message);
    return null;
  }
}

function incrementLocal(key: string, windowMs: number): { count: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now > record.resetTime) {
    const fresh = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, fresh);
    return fresh;
  }
  record.count++;
  return record;
}

/** Client IP. Requires app.set('trust proxy', ...) so X-Forwarded-For from the platform proxy is honoured. */
export function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Fixed-window rate limiter (Rule 40). Keyed by client IP and route.
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.', keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyGenerator ? keyGenerator(req) : `${clientIp(req)}:${req.baseUrl || ''}${req.route?.path || req.path}:${windowMs}:${max}`;
      let record = await incrementShared(key, windowMs);
      if (!record) {
        if (!warnedMemoryFallback && process.env.NODE_ENV === 'production' && (!redisUrl || !redisToken)) {
          warnedMemoryFallback = true;
          console.warn('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set: rate limits are per-instance only.');
        }
        record = incrementLocal(key, windowMs);
      }

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      if (record.count > max) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((record.resetTime - Date.now()) / 1000)));
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED', message },
        });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Cloudflare Turnstile bot check for public, unauthenticated write endpoints
 * (registration, anonymous complaints, citizen AI). Enforced when
 * TURNSTILE_SECRET_KEY is set; the token comes from the
 * `cf-turnstile-response` header or `turnstileToken` in the JSON body.
 */
export function requireHuman() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) return next();
    const token = (req.header('cf-turnstile-response') || (req.body && req.body.turnstileToken) || '').toString();
    if (!token) {
      res.status(400).json({ success: false, error: { code: 'HUMAN_VERIFICATION_REQUIRED', message: 'Please complete the security check and try again.' } });
      return;
    }
    try {
      const form = new URLSearchParams({ secret, response: token, remoteip: clientIp(req) });
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(5000),
      });
      const result = (await response.json()) as { success?: boolean };
      if (!result?.success) {
        res.status(400).json({ success: false, error: { code: 'HUMAN_VERIFICATION_FAILED', message: 'The security check failed. Please try again.' } });
        return;
      }
      if (req.body && typeof req.body === 'object') delete req.body.turnstileToken;
      next();
    } catch (err: any) {
      console.error('[turnstile] verification unavailable', err?.message);
      res.status(503).json({ success: false, error: { code: 'HUMAN_VERIFICATION_UNAVAILABLE', message: 'The security check is temporarily unavailable. Please try again shortly.' } });
    }
  };
}

/**
 * Standard HTTP Security Headers (Rules 38, 98, 100).
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Attach correlation ID (Rule 73)
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Safe error handling middleware to sanitize internal errors (Rule 73).
 */
export function safeErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId || crypto.randomUUID();
  console.error(`[ERROR][${requestId}]`, {
    path: req.path,
    method: req.method,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const statusCode = err.status || err.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (isClientError ? 'CLIENT_ERROR' : 'INTERNAL_ERROR'),
      message: isClientError ? err.message : 'An unexpected error occurred. Please quote the correlation ID.',
      requestId,
    },
  });
}
