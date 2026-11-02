import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { LeadsKanbanView } from '@/components/leads/leads-kanban-view';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { listMembers } from '../settings/members_actions';
import type { UserSummary } from '../settings/users_actions';
import { getLeads } from './actions';
import { PageHeader } from '@/components/layout/page-header';

export default async function LeadsPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const isAdmin = ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER'].includes(ctx.role);

  const [{ leads, error: leadsError }, memberList] = await Promise.all([
    getLeads(),
    listMembers().catch(() => []),
  ]);

  // Map workspace members onto the summary shape the kanban expects.
  const allUsers: UserSummary[] = memberList.map((m) => ({
    $id: m.userId,
    name: m.name,
    email: m.email,
    isAdmin: ['WORKSPACE_OWNER', 'ADMIN'].includes(m.role),
    emailVerification: true,
    createdAt: m.createdAt,
  }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        className="mb-8"
        title={isAdmin ? 'Lead pipeline' : 'Your lead pipeline'}
        description={
          isAdmin
            ? `All leads in ${ctx.workspaceName}, through the sales funnel.`
            : 'Manage your assigned and unclaimed leads.'
        }
      />

      {leadsError ? (
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Error fetching leads</AlertTitle>
              <AlertDescription>{leadsError}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <LeadsKanbanView initialLeads={leads} currentUser={ctx.user} allUsers={allUsers} />
      )}
    </div>
  );
}
