import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTasks } from './actions';
import { TasksView } from '@/components/tasks/tasks-view';
import { PageHeader } from '@/components/layout/page-header';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { status?: string; mine?: string };
}) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const canWrite = ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'HUMAN_AGENT'].includes(
    ctx.role
  );
  const status = searchParams.status ?? 'ALL';

  const [tasks, contacts, members] = await Promise.all([
    getTasks({
      status: (status as any) || 'ALL',
      mineOnly: searchParams.mine === '1',
    }),
    prisma.contact.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Tasks"
        description="Follow-up work for your team — created by humans, AI agents, and workflows."
      />

      <TasksView
        tasks={tasks}
        contacts={contacts}
        members={members.map((m) => ({ id: m.userId, name: m.user.name }))}
        canWrite={canWrite}
        currentUserId={ctx.user.$id}
        activeTab={status}
      />
    </div>
  );
}
