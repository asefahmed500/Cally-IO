import { getLoggedInUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { can } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart2, MessageSquare, Star, Users, UserPlus, Link as LinkIcon, CheckCircle, XCircle, Phone } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getWorkspaceSettings } from '@/lib/settings';
import { SettingsForm } from '@/components/settings/settings-form';
import { AnalyticsChart } from '@/components/settings/analytics-chart';
import { MemberManagement } from '@/components/settings/member-management';
import { listMembers, listInvitations } from './members_actions';
import { UsageStatistics } from '@/components/settings/usage-statistics';
import { PageHeader } from '@/components/layout/page-header';

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

async function getAnalyticsData(workspaceId: string) {
  let satisfactionRate = 0;
  let goodFeedbackCount = 0;
  let badFeedbackCount = 0;
  let totalLeads = 0;
  let conversionRate = 0;
  let totalConversations = 0;

  try {
    const feedbackGroups = await prisma.metric.groupBy({
      by: ['feedback'],
      _count: { _all: true },
      where: { workspaceId },
    });
    const goodCount = feedbackGroups.find((g) => g.feedback === 'good')?._count._all ?? 0;
    const badCount = feedbackGroups.find((g) => g.feedback === 'bad')?._count._all ?? 0;
    const totalFeedback = goodCount + badCount;
    goodFeedbackCount = goodCount;
    badFeedbackCount = badCount;
    if (totalFeedback > 0) {
      satisfactionRate = Math.round((goodCount / totalFeedback) * 100);
    }
  } catch (e) {
    console.error('Failed to fetch feedback analytics:', e);
  }

  try {
    const stageGroups = await prisma.lead.groupBy({
      by: ['stage'],
      _count: { _all: true },
      where: { workspaceId },
    });
    totalLeads = stageGroups.reduce((acc, g) => acc + g._count._all, 0);
    if (totalLeads > 0) {
      const convertedCount = stageGroups.find((g) => g.stage === 'WON')?._count._all ?? 0;
      conversionRate = Math.round((convertedCount / totalLeads) * 100);
    }
  } catch (e) {
    console.error('Failed to fetch lead analytics:', e);
  }

  try {
    totalConversations = await prisma.conversation.count({ where: { workspaceId } });
  } catch (e) {
    console.error('Failed to fetch conversation analytics:', e);
  }

  const feedbackChartData = [
    {
      name: 'Feedback',
      good: goodFeedbackCount,
      bad: badFeedbackCount,
    },
  ];

  return { satisfactionRate, totalLeads, conversionRate, totalConversations, feedbackChartData };
}

export default async function SettingsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect('/login');
  }

  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  // Capability gate: only roles with members.manage reach the full panel.
  if (!can(ctx.role, 'members.manage')) {
    redirect('/dashboard');
  }

  const [
    { satisfactionRate, totalLeads, conversionRate, totalConversations, feedbackChartData },
    aiSettings,
    members,
    invitations,
  ] = await Promise.all([
    getAnalyticsData(ctx.workspaceId),
    getWorkspaceSettings(ctx.workspaceId),
    listMembers().catch(() => []),
    listInvitations().catch(() => []),
  ]);

  const isTwilioConfigured =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_PHONE_NUMBER;
  const isWebhookConfigured = !!process.env.WEBHOOK_URL_NEW_LEAD;
  const timezones = Intl.supportedValuesOf('timeZone');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage members, integrations, AI behavior, and system performance."
      />

      <Card>
        <CardHeader>
          <CardTitle>Performance dashboard</CardTitle>
          <CardDescription>
            An overview of your AI assistant&apos;s performance based on real-time user feedback and lead data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard title="Avg. Satisfaction" value={`${satisfactionRate}%`} icon={Star} />
            <StatCard title="Total Leads" value={totalLeads.toLocaleString()} icon={Users} />
            <StatCard title="Total Conversations" value={totalConversations.toLocaleString()} icon={MessageSquare} />
            <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={BarChart2} />
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <AnalyticsChart data={feedbackChartData} />
            <UsageStatistics />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus /> Workspace Members
          </CardTitle>
          <CardDescription>
            Invite teammates, assign roles, and manage access to {ctx.workspaceName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberManagement
            initialMembers={members}
            initialInvitations={invitations}
            currentUserId={user.$id}
            canManage={can(ctx.role, 'members.manage')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon /> Integrations
          </CardTitle>
          <CardDescription>
            Connect Cally-IO to your other business tools. See documentation for setup instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 border">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <LinkIcon size={16} /> New Lead Webhook
              </h4>
              {isWebhookConfigured ? (
                <p className="text-xs text-success mt-1 flex items-center gap-1">
                  <CheckCircle className="size-3" /> Active
                </p>
              ) : (
                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                  <XCircle className="size-3" /> Inactive: Set WEBHOOK_URL_NEW_LEAD
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <Phone size={16} /> Twilio Calling
              </h4>
              {isTwilioConfigured ? (
                <p className="text-xs text-success mt-1 flex items-center gap-1">
                  <CheckCircle className="size-3" /> Active
                </p>
              ) : (
                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                  <XCircle className="size-3" /> Inactive: Set Twilio ENV variables
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingsForm settings={aiSettings} timezones={timezones} />
    </div>
  );
}
