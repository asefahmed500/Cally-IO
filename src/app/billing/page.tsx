import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { can } from '@/lib/permissions';
import { getBillingState } from './actions';
import { getUsageSnapshot } from '@/lib/usage';
import { BillingView } from '@/components/billing/billing-view';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const [billing, usage] = await Promise.all([
    getBillingState(),
    getUsageSnapshot(ctx.workspaceId),
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Billing & Usage"
        description={`Plan, metered usage, and limits for ${ctx.workspaceName}.`}
      />

      <BillingView
        canManage={can(ctx.role, 'billing.manage')}
        billing={billing}
        usage={{
          plan: usage.plan,
          periodEnd: usage.periodEnd.toISOString(),
          items: [
            { label: 'AI minutes', used: usage.usage.AI_MINUTES, limit: usage.limits.aiMinutes },
            { label: 'Telephony minutes', used: usage.usage.TELEPHONY_MINUTES, limit: usage.limits.telephonyMinutes },
            { label: 'Transcription minutes', used: usage.usage.TRANSCRIPTION_MINUTES, limit: usage.limits.transcriptionMinutes },
            { label: 'Phone numbers', used: usage.usage.PHONE_NUMBERS, limit: usage.limits.phoneNumbers },
            { label: 'AI agents', used: usage.usage.AI_AGENTS, limit: usage.limits.aiAgents },
            { label: 'Members', used: usage.usage.MEMBERS, limit: usage.limits.members },
            { label: 'Workflows', used: usage.counts.workflows, limit: Infinity },
          ],
        }}
      />
    </div>
  );
}