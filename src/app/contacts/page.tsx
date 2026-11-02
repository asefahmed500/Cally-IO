import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { getContacts } from './actions';
import { ContactsView } from '@/components/contacts/contacts-view';
import { PageHeader } from '@/components/layout/page-header';
import { listMembers } from '@/app/settings/members_actions';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { q?: string; priority?: string; consent?: string; mine?: string; page?: string };
}) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }
  const canWrite = ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'HUMAN_AGENT'].includes(
    ctx.role
  );

  const [{ contacts, total, page, pageSize }, members] = await Promise.all([
    getContacts({
      search: searchParams.q,
      priority: (searchParams.priority as any) || 'ALL',
      consent: (searchParams.consent as any) || 'ALL',
      mineOnly: searchParams.mine === '1',
      page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
    }),
    listMembers().catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Contacts"
        description={`${total} ${total === 1 ? 'contact' : 'contacts'} in ${ctx.workspaceName}.`}
      />

      <ContactsView
        contacts={contacts}
        total={total}
        page={page}
        pageSize={pageSize}
        members={members.map((m) => ({ id: m.userId, name: m.name }))}
        canWrite={canWrite}
        filters={{
          q: searchParams.q ?? '',
          priority: searchParams.priority ?? 'ALL',
          consent: searchParams.consent ?? 'ALL',
          mine: searchParams.mine === '1',
        }}
      />
    </div>
  );
}
