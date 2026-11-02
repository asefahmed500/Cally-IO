import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { getAgents } from './actions';
import { AgentsView } from '@/components/agents/agents-view';
import { can } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/page-header';

export default async function AgentsPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const agents = await getAgents();
  const canManage = can(ctx.role, 'agents.manage');
  const canPublish = can(ctx.role, 'ai.manage');

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="AI Agents"
        description="Your AI workforce — configure, test, and deploy voice agents."
      />

      <AgentsView agents={agents} canManage={canManage} canPublish={canPublish} />
    </div>
  );
}
