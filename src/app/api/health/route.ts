import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Health/readiness probe: verifies the process is up and the database is
 * reachable. Safe for load balancers and uptime checks — returns no
 * internals, just status + latency.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: 'up',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { ok: false, db: 'down', timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
