'use server';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/tenant';
import type { CallDirection } from '@prisma/client';

/** Builds the analytics dataset for the caller's workspace + date range + filters. */
export async function buildAnalytics(input: {
  from: Date;
  to: Date;
  direction?: CallDirection | 'ALL';
  aiAgentId?: string;
  assignedUserId?: string;
  campaignId?: string;
}) {
  // Authorization: workspace comes from the session, never from the client.
  const ctx = await requireCapability('analytics.view');
  const callWhere: Record<string, unknown> = {
    workspaceId: ctx.workspaceId,
    createdAt: { gte: input.from, lte: input.to },
  };
  if (input.direction && input.direction !== 'ALL') callWhere.direction = input.direction;
  if (input.aiAgentId) callWhere.aiAgentId = input.aiAgentId;
  if (input.assignedUserId) callWhere.assignedUserId = input.assignedUserId;
  if (input.campaignId) callWhere.campaignId = input.campaignId;

  const [
    calls,
    leadStages,
    agentPerformance,
    campaignPerformance,
    taskStats,
    followUpStats,
  ] = await Promise.all([
    prisma.call.findMany({
      where: callWhere,
      select: {
        id: true,
        createdAt: true,
        direction: true,
        status: true,
        outcome: true,
        durationSec: true,
        aiAgentId: true,
        aiAgent: { select: { id: true, name: true } },
        assignedUserId: true,
        assignedUser: { select: { id: true, name: true } },
        campaignId: true,
      },
      take: 10000,
    }),
    prisma.lead.groupBy({
      by: ['stage'],
      _count: { _all: true },
      where: { workspaceId: ctx.workspaceId },
    }),
    prisma.call.groupBy({
      by: ['aiAgentId', 'assignedUserId'],
      _count: { _all: true },
      _avg: { durationSec: true },
      where: callWhere,
    }),
    prisma.campaign.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        contacts: { select: { status: true } },
        calls: { where: callWhere, select: { id: true, outcome: true, durationSec: true } },
      },
      take: 20,
    }),
    prisma.task.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { workspaceId: ctx.workspaceId, createdAt: { gte: input.from } },
    }),
    prisma.lead.groupBy({
      by: ['followUpDate'],
      _count: { _all: true },
      where: { workspaceId: ctx.workspaceId, followUpDate: { not: null } },
    }),
  ]);

  // Volume by day
  const volumeByDay: { day: string; date: string; calls: number; connected: number }[] = [];
  const days = Math.ceil((input.to.getTime() - input.from.getTime()) / 86_400_000);
  for (let i = 0; i <= days; i++) {
    const d = new Date(input.from);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const dayCalls = calls.filter((c) => c.createdAt >= d && c.createdAt < next);
    volumeByDay.push({
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: d.toISOString(),
      calls: dayCalls.length,
      connected: dayCalls.filter((c) => c.outcome === 'CONNECTED').length,
    });
  }

  const directionSplit = {
    INBOUND: calls.filter((c) => c.direction === 'INBOUND').length,
    OUTBOUND: calls.filter((c) => c.direction === 'OUTBOUND').length,
  };

  const aiVsHuman = {
    ai: calls.filter((c) => c.aiAgentId).length,
    human: calls.filter((c) => !c.aiAgentId && c.assignedUserId).length,
    unassigned: calls.filter((c) => !c.aiAgentId && !c.assignedUserId).length,
  };

  const outcomeCounts = calls.reduce<Record<string, number>>((acc, c) => {
    if (c.outcome) acc[c.outcome] = (acc[c.outcome] ?? 0) + 1;
    return acc;
  }, {});
  const outcomeData = Object.entries(outcomeCounts).map(([name, value]) => ({ name, value }));

  const connected = calls.filter((c) => c.outcome === 'CONNECTED').length;
  const totalWithDuration = calls.filter((c) => c.durationSec && c.durationSec > 0);
  const avgDurationSec = totalWithDuration.length
    ? Math.round(totalWithDuration.reduce((a, c) => a + (c.durationSec ?? 0), 0) / totalWithDuration.length)
    : 0;

  const answered = calls.filter((c) => ['ANSWERED', 'IN_PROGRESS', 'COMPLETED'].includes(c.status)).length;
  const answerRate = calls.length ? Math.round((answered / calls.length) * 100) : 0;

  const totalLeads = leadStages.reduce((a, s) => a + s._count._all, 0);
  const wonLeads = leadStages.find((s) => s.stage === 'WON')?._count._all ?? 0;
  const conversionRate = totalLeads ? Math.round((wonLeads / totalLeads) * 100) : 0;

  // Per-agent aggregation
  const agentMap = new Map<string, { name: string; type: 'AI' | 'Human' | 'Unassigned'; calls: number; totalDuration: number; durationCount: number }>();
  for (const row of agentPerformance) {
    const key = row.aiAgentId ?? row.assignedUserId ?? 'unassigned';
    // Names require lookup — resolved from the call sample.
    let name = 'Unassigned';
    let type: 'AI' | 'Human' | 'Unassigned' = 'Unassigned';
    const sample = calls.find((c) => (c.aiAgent?.id ?? c.assignedUser?.id) === key);
    if (row.aiAgentId) {
      name = calls.find((c) => c.aiAgentId === row.aiAgentId)?.aiAgent?.name ?? 'AI agent';
      type = 'AI';
    } else if (row.assignedUserId) {
      name = calls.find((c) => c.assignedUserId === row.assignedUserId)?.assignedUser?.name ?? 'Agent';
      type = 'Human';
    }
    const entry = agentMap.get(key) ?? { name, type, calls: 0, totalDuration: 0, durationCount: 0 };
    entry.calls += row._count._all;
    if (row._avg.durationSec) {
      entry.totalDuration += row._avg.durationSec * row._count._all;
      entry.durationCount += row._count._all;
    }
    agentMap.set(key, entry);
  }
  const agentPerformanceData = Array.from(agentMap.values())
    .map((a) => ({
      name: a.name,
      type: a.type,
      calls: a.calls,
      avgDurationSec: a.durationCount ? Math.round(a.totalDuration / a.durationCount) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);

  const campaignPerformanceData = campaignPerformance.map((c) => {
    const byStatus = c.contacts.reduce<Record<string, number>>((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    }, {});
    const connectedCampaign = c.calls.filter((call) => call.outcome === 'CONNECTED').length;
    return {
      name: c.name,
      status: c.status,
      contacts: c.contacts.length,
      completed: byStatus.COMPLETED ?? 0,
      failed: byStatus.FAILED ?? 0,
      calls: c.calls.length,
      connected: connectedCampaign,
      connectRate: c.calls.length ? Math.round((connectedCampaign / c.calls.length) * 100) : 0,
    };
  });

  const taskCounts = taskStats.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = t._count._all;
    return acc;
  }, {});
  const tasksTotal = Object.values(taskCounts).reduce((a, b) => a + b, 0);
  const tasksCompleted = taskCounts.COMPLETED ?? 0;
  const followUpCompletionRate = tasksTotal ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  const stageOrder = ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'PROPOSAL', 'WON', 'LOST'];
  const stageLabels: Record<string, string> = {
    NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
    FOLLOW_UP: 'Follow-up', PROPOSAL: 'Proposal', WON: 'Won', LOST: 'Lost',
  };
  const funnel = stageOrder.map((stage) => ({
    stage: stageLabels[stage],
    count: leadStages.find((s) => s.stage === stage)?._count._all ?? 0,
  }));

  return {
    totals: {
      calls: calls.length,
      connected,
      answerRate,
      avgDurationSec,
      totalLeads,
      conversionRate,
      followUpCompletionRate,
      tasksTotal,
      tasksCompleted,
    },
    volumeByDay,
    directionSplit,
    aiVsHuman,
    outcomeData,
    funnel,
    agentPerformanceData,
    campaignPerformanceData,
  };
}

/** CSV export of the filtered call rows (tenant-scoped, capability-gated). */
export async function exportCallsCsv(input: {
  from: string;
  to: string;
  direction?: string;
}): Promise<{ csv: string | null; error?: string }> {
  const ctx = await requireCapability('reports.export');
  try {
    const calls = await prisma.call.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        createdAt: { gte: new Date(input.from), lte: new Date(input.to) },
        ...(input.direction && input.direction !== 'ALL' ? { direction: input.direction as CallDirection } : {}),
      },
      include: {
        contact: { select: { name: true } },
        aiAgent: { select: { name: true } },
        assignedUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = 'Date,Direction,Status,Outcome,Contact,Agent,Handled By,Duration (s),Number';
    const rows = calls.map((c) =>
      [
        c.createdAt.toISOString(),
        c.direction,
        c.status,
        c.outcome ?? '',
        c.contact?.name ?? '',
        c.aiAgent?.name ?? '',
        c.aiAgent ? 'AI' : c.assignedUser ? 'Human' : 'Unassigned',
        c.durationSec ?? '',
        c.toNumber ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    return { csv: [header, ...rows].join('\n') };
  } catch (e: any) {
    return { csv: null, error: 'Could not export analytics. Please try again.' };
  }
}