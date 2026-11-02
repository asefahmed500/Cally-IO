import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { buildAnalytics } from './actions';
import { AnalyticsView } from '@/components/analytics/analytics-view';
import { PageHeader } from '@/components/layout/page-header';
import type { CallDirection } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { range?: string; direction?: string };
}) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }
  if (!can(ctx.role, 'analytics.view')) {
    redirect('/dashboard');
  }

  const days = Math.min(90, Math.max(7, parseInt(searchParams.range ?? '30', 10) || 30));
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const direction = (searchParams.direction ?? 'ALL') as CallDirection | 'ALL';

  const [data, agents, campaigns, members] = await Promise.all([
    buildAnalytics({ from, to, direction }),
    prisma.aIAgent.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      select: { id: true, name: true },
      take: 50,
    }),
    prisma.campaign.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      select: { id: true, name: true },
      take: 50,
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true } } },
      take: 50,
    }),
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Analytics"
        description={`Workspace performance for ${ctx.workspaceName} — every metric computed from persisted records.`}
      />

      <AnalyticsView
        data={data}
        canExport={can(ctx.role, 'reports.export')}
        filters={{
          days,
          direction,
          from: from.toISOString(),
          to: to.toISOString(),
        }}
        options={{
          agents,
          campaigns,
          members: members.map((m) => ({ id: m.userId, name: m.user.name })),
        }}
      />
    </div>
  );
}