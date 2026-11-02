import { notFound, redirect } from 'next/navigation';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { can } from '@/lib/permissions';
import { getAgent } from '../../actions';
import { AgentWizard } from '@/components/agents/agent-wizard';
import { listKnowledgeSourcesForAgent } from '../../actions';

export default async function EditAgentPage({ params }: { params: { id: string } }) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }
  if (!can(ctx.role, 'agents.manage')) {
    redirect('/agents');
  }

  const agent = await getAgent(params.id);
  if (!agent) notFound();

  const sources = await listKnowledgeSourcesForAgent();

  return (
    <div className="flex flex-col h-full gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Edit — {agent.name}</h1>
        <p className="text-muted-foreground">
          Saving creates a new immutable version (v{agent.versionCount + 1}).
        </p>
      </header>

      <AgentWizard
        agentId={agent.$id}
        initialConfig={agent.config ?? undefined}
        knowledgeSources={sources.filter((s) => s.status === 'READY')}
      />
    </div>
  );
}
