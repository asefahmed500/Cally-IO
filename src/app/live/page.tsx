import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { can } from '@/lib/permissions';
import { LiveOpsView } from '@/components/live/live-ops-view';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

export default async function LiveOperationsPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Live operations"
        description="Real-time view of active calls, the queue, and team availability."
      />

      <LiveOpsView canMonitor={can(ctx.role, 'liveops.monitor')} />
    </div>
  );
}
