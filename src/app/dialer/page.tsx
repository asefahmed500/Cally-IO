import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getContacts } from '../contacts/actions';
import { Dialer } from '@/components/dialer/dialer-view';
import { twilioProvider } from '@/lib/telephony/twilio';
import { PageHeader } from '@/components/layout/page-header';

export default async function DialerPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const { contacts } = await getContacts({ pageSize: 100 });

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Dialer"
        description="Manual and click-to-call dialing — every call is logged to the workspace timeline."
      />

      <Dialer
        contacts={contacts.filter((c) => c.phone)}
        twilioConfigured={twilioProvider.isConfigured()}
        callerId={process.env.TWILIO_PHONE_NUMBER ?? 'not configured'}
      />
    </div>
  );
}
