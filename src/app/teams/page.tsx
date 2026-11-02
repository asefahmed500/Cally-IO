import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/permissions';
import { listTeams } from './actions';
import { TeamsView } from '@/components/teams/teams-view';
import { PageHeader } from '@/components/layout/page-header';

export default async function TeamsPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const canManage = can(ctx.role, 'members.manage');

  const [teams, members] = await Promise.all([
    listTeams(),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Teams"
        description="Group members for lead assignment, campaigns, and reporting."
      />

      <TeamsView
        teams={teams}
        members={members.map((m) => ({ id: m.userId, name: m.user.name }))}
        canManage={canManage}
      />
    </div>
  );
}
