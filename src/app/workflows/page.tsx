import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { can } from '@/lib/permissions';
import { listWorkflows } from './actions';
import { WorkflowsView } from '@/components/workflows/workflows-view';
import { PageHeader } from '@/components/layout/page-header';

export default async function WorkflowsPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const workflows = await listWorkflows();
  const canManage = can(ctx.role, 'workflows.manage');

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Workflows"
        description="Automate follow-ups on call outcomes, new leads, and missed calls. Executions are queue-backed and idempotent."
      />

      <WorkflowsView workflows={workflows} canManage={canManage} />
    </div>
  );
}
