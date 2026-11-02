import { requireCapability, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AuditLogTable } from '@/components/settings/audit-log-table';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; action?: string; user?: string };
}) {
  const ctx = await requireCapability('audit.view').catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const action = searchParams.action?.trim();
  const userId = searchParams.user?.trim();

  const where = {
    workspaceId: ctx.workspaceId,
    ...(action ? { action: { contains: action } } : {}),
    ...(userId ? { userId } : {}),
  };

  const [logs, total, actionGroups, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      where: { workspaceId: ctx.workspaceId },
      orderBy: { _count: { action: 'desc' } },
      take: 30,
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 100,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Audit log"
        description={`Immutable record of privileged actions in ${ctx.workspaceName}. ${total} entries.`}
        backHref="/settings"
        backLabel="Settings"
      />

      <AuditLogTable
        logs={logs.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          metadata: (log.metadata ?? null) as Record<string, unknown> | null,
          ip: log.ip,
          createdAt: log.createdAt.toISOString(),
          actor: log.user ? { name: log.user.name, email: log.user.email } : null,
        }))}
        actions={actionGroups.map((a) => ({ action: a.action, count: a._count._all }))}
        users={users.map((m) => ({ id: m.userId, name: m.user.name }))}
        currentPage={page}
        totalPages={totalPages}
        filters={{ action: action ?? '', user: userId ?? '' }}
      />
    </div>
  );
}