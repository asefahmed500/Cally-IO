import { prisma } from '@/lib/prisma';

/**
 * Minimal DB-backed job queue — see ARCHITECTURE.md §7.
 * Jobs are claimed atomically with updateMany (optimistic lock), executed by
 * a registered handler, and retried with linear backoff up to maxAttempts.
 * The queue is drained by POST /api/jobs/tick (cron or manual trigger).
 */

export type JobPayload = Record<string, unknown>;
export type JobHandler = (payload: JobPayload, jobId: string) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

export async function enqueueJob(type: string, payload: JobPayload, options?: {
  workspaceId?: string | null;
  runAt?: Date;
  maxAttempts?: number;
}) {
  return prisma.job.create({
    data: {
      type,
      payload: payload as object,
      workspaceId: options?.workspaceId ?? null,
      runAt: options?.runAt ?? new Date(),
      maxAttempts: options?.maxAttempts ?? 3,
    },
  });
}

export async function processDueJobs(limit = 10): Promise<{ processed: number; failed: number }> {
  const now = new Date();
  let processed = 0;
  let failed = 0;

  // Claim due jobs atomically.
  const candidates = await prisma.job.findMany({
    where: { status: 'PENDING', runAt: { lte: now } },
    orderBy: { runAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  for (const candidate of candidates) {
    const claimed = await prisma.job.updateMany({
      where: { id: candidate.id, status: 'PENDING', runAt: { lte: now } },
      data: { status: 'PROCESSING', lockedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue; // Lost the race.

    const job = await prisma.job.findUnique({ where: { id: candidate.id } });
    if (!job) continue;

    const handler = handlers.get(job.type);
    // Keep the lease fresh while long handlers (AI transcription,
    // summarization) run, so the 10-minute stale-lease reaper in another
    // instance cannot double-process a live job.
    const heartbeat = setInterval(() => {
      prisma.job
        .updateMany({
          where: { id: job.id, status: 'PROCESSING' },
          data: { lockedAt: new Date() },
        })
        .catch(() => {
          // Best-effort — a missed beat only matters after 10 minutes.
        });
    }, 60_000);
    if (typeof heartbeat === 'object' && heartbeat !== null && 'unref' in heartbeat) {
      (heartbeat as { unref: () => void }).unref();
    }
    try {
      if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
      await handler(job.payload as JobPayload, job.id);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date(), lastError: null },
      });
      processed++;
    } catch (error: any) {
      const canRetry = job.attempts < job.maxAttempts;
      const backoffMs = 60_000 * job.attempts; // linear: 1min, 2min, 3min...
      await prisma.job.update({
        where: { id: job.id },
        data: canRetry
          ? {
              status: 'PENDING',
              runAt: new Date(Date.now() + backoffMs),
              lastError: String(error?.message ?? error).slice(0, 500),
            }
          : {
              status: 'DEAD',
              lastError: String(error?.message ?? error).slice(0, 500),
            },
      });
      failed++;
    } finally {
      clearInterval(heartbeat);
    }
  }

  // Requeue stuck PROCESSING jobs (crashed worker) after 10 minutes.
  await prisma.job.updateMany({
    where: {
      status: 'PROCESSING',
      lockedAt: { lt: new Date(Date.now() - 10 * 60_000) },
    },
    data: { status: 'PENDING', lockedAt: null },
  });

  // Opportunistic housekeeping: drop expired rate-limit buckets.
  try {
    await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  } catch {
    // Housekeeping must never fail the tick.
  }

  return { processed, failed };
}
