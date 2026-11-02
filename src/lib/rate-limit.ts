import { prisma } from '@/lib/prisma';

/**
 * Fixed-window rate limiter backed by the database so it works across
 * serverless instances. Falls back to an in-memory map if the DB write fails.
 */

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

const memory = new Map<string, { count: number; resetAt: number }>();

const RULES = {
  aiChat: { limit: 20, windowSec: 60 },
  tts: { limit: 30, windowSec: 60 },
  agentTest: { limit: 30, windowSec: 60 },
  auth: { limit: 10, windowSec: 300 },
  webhook: { limit: 600, windowSec: 60 },
  exports: { limit: 5, windowSec: 300 },
  writes: { limit: 120, windowSec: 60 },
} as const;

export type RateLimitRule = keyof typeof RULES;

export async function rateLimit(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const { limit, windowSec } = RULES[rule];
  const now = Date.now();
  const resetAt = new Date(now + windowSec * 1000);

  // In-memory fast path (also the fallback when the DB is unavailable).
  const hit = memory.get(`${rule}:${key}`);
  if (hit && hit.resetAt > now && hit.count >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: new Date(hit.resetAt),
      retryAfterSeconds: Math.ceil((hit.resetAt - now) / 1000),
    };
  }

  try {
    const row = await prisma.rateLimitBucket.upsert({
      where: { key: `${rule}:${key}` },
      create: { key: `${rule}:${key}`, count: 1, resetAt },
      update: {},
    });

    if (row.resetAt <= new Date(now)) {
      const counted = await prisma.rateLimitBucket.update({
        where: { key: `${rule}:${key}` },
        data: { count: 1, resetAt },
      });
      memory.set(`${rule}:${key}`, { count: counted.count, resetAt: counted.resetAt.getTime() });
      return { ok: true, limit, remaining: limit - 1, resetAt: counted.resetAt, retryAfterSeconds: 0 };
    }

    const counted = await prisma.rateLimitBucket.update({
      where: { key: `${rule}:${key}` },
      data: { count: { increment: 1 } },
    });
    memory.set(`${rule}:${key}`, { count: counted.count, resetAt: counted.resetAt.getTime() });

    return {
      ok: counted.count <= limit,
      limit,
      remaining: Math.max(0, limit - counted.count),
      resetAt: counted.resetAt,
      retryAfterSeconds: Math.ceil((counted.resetAt.getTime() - now) / 1000),
    };
  } catch {
    const current = hit && hit.resetAt > now ? hit.count + 1 : 1;
    const reset = hit && hit.resetAt > now ? hit.resetAt : now + windowSec * 1000;
    memory.set(`${rule}:${key}`, { count: current, resetAt: reset });
    return {
      ok: current <= limit,
      limit,
      remaining: Math.max(0, limit - current),
      resetAt: new Date(reset),
      retryAfterSeconds: Math.max(0, Math.ceil((reset - now) / 1000)),
    };
  }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  };
}

export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSeconds),
        ...rateLimitHeaders(result),
      },
    }
  );
}