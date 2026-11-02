import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { listKnowledgeSourcesForAgent } from '../actions';
import { AgentWizard } from '@/components/agents/agent-wizard';
import { PageHeader } from '@/components/layout/page-header';

export default async function NewAgentPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  if (!(await import('@/lib/permissions')).can(ctx.role, 'agents.manage')) {
    redirect('/agents');
  }

  const sources = await listKnowledgeSourcesForAgent();

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Create AI agent"
        description="Configure your AI voice agent in 8 steps — save as draft, test, then activate."
        backHref="/agents"
        backLabel="AI agents"
      />

      <AgentWizard knowledgeSources={sources.filter((s) => s.status === 'READY')} />
    </div>
  );
}
