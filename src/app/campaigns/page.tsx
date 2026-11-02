import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { can } from '@/lib/permissions';
import { listCampaigns } from './actions';
import { CampaignsView } from '@/components/campaigns/campaigns-view';
import { PageHeader } from '@/components/layout/page-header';

export default async function CampaignsPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const campaigns = await listCampaigns();
  const canManage = can(ctx.role, 'campaigns.manage');

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Campaigns"
        description="Structured outbound calling with schedules, retries, and consent gating."
      />

      <CampaignsView campaigns={campaigns} canManage={canManage} />
    </div>
  );
}
