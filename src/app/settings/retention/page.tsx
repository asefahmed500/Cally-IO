import { requireCapability, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { loadRetentionState } from './actions';
import { RetentionSettingsForm } from '@/components/settings/retention-settings-form';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

export default async function RetentionPage() {
  const ctx = await requireCapability('audit.view').catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const state = await loadRetentionState();

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Data retention"
        description={`Compliance windows and recording controls for ${ctx.workspaceName}.`}
        backHref="/settings"
        backLabel="Settings"
      />
      <RetentionSettingsForm
        initialPolicy={state.policy}
        initialPreview={state.preview}
      />
    </div>
  );
}