import crypto from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { getApiMessage, type Lang } from '../i18n/ka.js';

export function resolveLang(raw?: string | null, acceptLang?: string | null): Lang {
  const candidate = (raw || '').trim().toLowerCase();
  if (candidate === 'ka' || candidate === 'en') return candidate;
  if (acceptLang && acceptLang.toLowerCase().startsWith('ka')) return 'ka';
  return 'en';
}

export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-XSS-Protection', '0');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"
  );
};

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(maxRequests: number, windowMs: number): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  // Periodic cleanup to prevent unbounded memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets.entries()) {
      if (b.resetAt <= now) buckets.delete(ip);
    }
  }, windowMs).unref();

  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'local';
    const now = Date.now();
    const existing = buckets.get(ip);

    if (!existing || existing.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (existing.count >= maxRequests) {
      const lang = resolveLang(c.req.query('lang'), c.req.header('accept-language'));
      c.header('Retry-After', String(Math.ceil((existing.resetAt - now) / 1000)));
      return c.json({ error: getApiMessage('rate_limited', lang) }, 429);
    } else {
      existing.count += 1;
    }

    await next();
  };
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireApiKey(expectedKey: string | undefined, alwaysEnforce = true): MiddlewareHandler {
  return async (c, next) => {
    if (!alwaysEnforce && process.env.REQUIRE_API_KEY !== 'true') {
      return next();
    }

    const lang = resolveLang(c.req.query('lang'), c.req.header('accept-language'));
    if (!expectedKey) {
      return c.json({ error: getApiMessage('unauthorized', lang) }, 401);
    }

    const headerKey = c.req.header('x-api-key');
    const authHeader = c.req.header('authorization');
    const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    const provided = headerKey || bearerKey || '';

    if (!provided || !safeEqual(provided, expectedKey)) {
      return c.json({ error: getApiMessage('unauthorized', lang) }, 401);
    }

    await next();
  };
}
