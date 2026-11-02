import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { can } from '@/lib/permissions';
import { listActiveAgentsForCampaign, listCampaignAudience } from '../actions';
import { CampaignForm } from '@/components/campaigns/campaign-form';
import { PageHeader } from '@/components/layout/page-header';

export default async function NewCampaignPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }
  if (!can(ctx.role, 'campaigns.manage')) {
    redirect('/campaigns');
  }

  const [agents, audience] = await Promise.all([
    listActiveAgentsForCampaign(),
    listCampaignAudience(),
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Create campaign"
        description="Pick an audience, bind an active AI agent, and set the calling rules."
        backHref="/campaigns"
        backLabel="Campaigns"
      />

      <CampaignForm
        agents={agents}
        audience={audience.map((a) => ({
          id: a.id,
          name: a.name,
          phone: a.phone ?? '',
          company: a.company ?? '',
          consentStatus: a.consentStatus,
        }))}
        timezones={Intl.supportedValuesOf('timeZone')}
      />
    </div>
  );
}
