import { prisma } from '@/lib/prisma';
import type { PlanTier, UsageMetric } from '@prisma/client';

/**
 * Usage metering and plan limits — see PRD §20.
 * Metering points: AI minutes, telephony minutes, phone numbers, AI agents,
 * workspace members, storage, transcription minutes, automation runs.
 */

export type PlanLimits = {
  aiMinutes: number;
  telephonyMinutes: number;
  phoneNumbers: number;
  aiAgents: number;
  members: number;
  storageMb: number;
  transcriptionMinutes: number;
  automationRuns: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: { aiMinutes: 100, telephonyMinutes: 50, phoneNumbers: 1, aiAgents: 1, members: 3, storageMb: 100, transcriptionMinutes: 50, automationRuns: 100 },
  STARTER: { aiMinutes: 600, telephonyMinutes: 300, phoneNumbers: 2, aiAgents: 3, members: 5, storageMb: 500, transcriptionMinutes: 300, automationRuns: 1_000 },
  GROWTH: { aiMinutes: 3_000, telephonyMinutes: 1_500, phoneNumbers: 5, aiAgents: 10, members: 20, storageMb: 2_000, transcriptionMinutes: 1_500, automationRuns: 10_000 },
  BUSINESS: { aiMinutes: 15_000, telephonyMinutes: 7_500, phoneNumbers: 15, aiAgents: 30, members: 75, storageMb: 10_000, transcriptionMinutes: 7_500, automationRuns: 50_000 },
  ENTERPRISE: { aiMinutes: Infinity, telephonyMinutes: Infinity, phoneNumbers: Infinity, aiAgents: Infinity, members: Infinity, storageMb: Infinity, transcriptionMinutes: Infinity, automationRuns: Infinity },
};

export const PLAN_PRICING: Record<PlanTier, { monthly: number; label: string }> = {
  FREE: { monthly: 0, label: 'Free' },
  STARTER: { monthly: 49, label: 'Starter' },
  GROWTH: { monthly: 199, label: 'Growth' },
  BUSINESS: { monthly: 599, label: 'Business' },
  ENTERPRISE: { monthly: 0, label: 'Enterprise' }, // contact sales
};

function currentPeriod(): { start: Date; end: Date } {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export type UsageSnapshot = {
  plan: PlanTier;
  limits: PlanLimits;
  periodStart: Date;
  periodEnd: Date;
  usage: Record<UsageMetric, number>;
  /** Non-metered live counts derived from the DB. */
  counts: { members: number; aiAgents: number; phoneNumbers: number; workflows: number };
};

export async function getUsageSnapshot(workspaceId: string): Promise<UsageSnapshot> {
  const { start, end } = currentPeriod();

  const [subscription, records, members, aiAgents, phoneNumbers, workflows] = await Promise.all([
    prisma.subscription.findUnique({ where: { workspaceId } }),
    prisma.usageRecord.findMany({ where: { workspaceId, periodStart: start } }),
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.aIAgent.count({ where: { workspaceId, deletedAt: null } }),
    prisma.phoneNumber.count({ where: { workspaceId, status: 'ACTIVE' } }),
    prisma.workflow.count({ where: { workspaceId, deletedAt: null } }),
  ]);

  const plan = subscription?.plan ?? 'FREE';
  const usage = Object.fromEntries(
    [
      'AI_MINUTES',
      'TELEPHONY_MINUTES',
      'PHONE_NUMBERS',
      'AI_AGENTS',
      'MEMBERS',
      'STORAGE_MB',
      'TRANSCRIPTION_MINUTES',
      'AUTOMATION_RUNS',
    ].map((m) => [m, 0])
  ) as Record<UsageMetric, number>;

  for (const record of records) {
    usage[record.metric] = (usage[record.metric] ?? 0) + record.quantity;
  }

  // Live counts override metered aggregates for countable resources.
  usage.MEMBERS = members;
  usage.AI_AGENTS = aiAgents;
  usage.PHONE_NUMBERS = phoneNumbers;

  return {
    plan,
    limits: PLAN_LIMITS[plan],
    periodStart: start,
    periodEnd: end,
    usage,
    counts: { members, aiAgents, phoneNumbers, workflows },
  };
}

export type LimitCheck = { allowed: boolean; metric: UsageMetric; used: number; limit: number };

/** Throws-free check used by guards before expensive operations. */
export async function checkLimit(
  workspaceId: string,
  metric: UsageMetric
): Promise<LimitCheck> {
  const snapshot = await getUsageSnapshot(workspaceId);
  const used = snapshot.usage[metric] ?? 0;
  const limitKey = ({
    AI_MINUTES: 'aiMinutes',
    TELEPHONY_MINUTES: 'telephonyMinutes',
    PHONE_NUMBERS: 'phoneNumbers',
    AI_AGENTS: 'aiAgents',
    MEMBERS: 'members',
    STORAGE_MB: 'storageMb',
    TRANSCRIPTION_MINUTES: 'transcriptionMinutes',
    AUTOMATION_RUNS: 'automationRuns',
  } as Record<UsageMetric, keyof PlanLimits>)[metric];
  const limit = snapshot.limits[limitKey];
  return { allowed: used < limit, metric, used, limit };
}

/** Records metered usage (idempotent-safe upsert on the current period). */
export async function recordUsage(
  workspaceId: string,
  metric: UsageMetric,
  quantity: number
): Promise<void> {
  try {
    const { start, end } = currentPeriod();
    await prisma.usageRecord.upsert({
      where: {
        workspaceId_metric_periodStart: { workspaceId, metric, periodStart: start },
      },
      update: { quantity: { increment: quantity } },
      create: { workspaceId, metric, quantity, periodStart: start, periodEnd: end },
    });
  } catch (error) {
    console.error('Failed to record usage:', error);
  }
}