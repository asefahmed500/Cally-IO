import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processDueJobs } from '@/lib/jobs/engine';
import { ensureCampaignScheduler } from '@/lib/jobs/handlers';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Constant-time comparison to keep the secret unguessable via timing. */
function secretMatches(provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Drains the background job queue. Trigger by cron (every minute) with the
 * JOBS_SECRET header, or manually: curl -X POST -H "x-jobs-secret: ..." ...
 */
export async function POST(request: NextRequest) {
  const secret = process.env.JOBS_SECRET;
  if (!secret) {
    return new NextResponse('JOBS_SECRET is not configured.', { status: 503 });
  }

  // Throttle guessing attempts before the secret comparison.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = await rateLimit(`jobs-tick:${ip}`, 'auth');
  if (!limit.ok) {
    return new NextResponse('Too many requests', { status: 429 });
  }

  if (!secretMatches(request.headers.get('x-jobs-secret'), secret)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await ensureCampaignScheduler();
    const result = await processDueJobs(15);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    // Details stay in the server log — never leak internals to the caller.
    console.error('Job tick failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
