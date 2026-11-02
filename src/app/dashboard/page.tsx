import Link from 'next/link';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getWorkspaceSettings, type AISettings } from '@/lib/settings';
import { ChatPanel } from '@/components/chat/chat-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PhoneCall,
  Bot,
  User,
  Clock,
  ListTodo,
  CalendarClock,
  BotMessageSquare,
  PhoneIncoming,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Users,
  Target,
} from 'lucide-react';
import {
  CallVolumeChart,
  OutcomePieChart,
  StageBarChart,
} from '@/components/dashboard/dashboard-charts';
import { PageHeader } from '@/components/layout/page-header';

function isWithinBusinessHours(settings: AISettings): boolean {
  if (!settings.businessHoursEnabled) return true;
  try {
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: settings.businessHoursTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = timeFormatter.format(new Date());
    return currentTime >= settings.businessHoursStart && currentTime <= settings.businessHoursEnd;
  } catch (e) {
    console.error('Error parsing business hours, defaulting to active:', e);
    return true;
  }
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default async function DashboardPage() {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const isGoogleConfigured = !!process.env.GOOGLE_API_KEY;
  const settings = await getWorkspaceSettings(ctx.workspaceId);
  const isChatActive = isWithinBusinessHours(settings);

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

  const [
    totalCalls,
    activeCalls,
    aiHandledCalls,
    humanHandledCalls,
    answeredCalls,
    completedWithDuration,
    pendingTasks,
    followUpLeads,
    recentCalls,
    leadStages,
    recentCalls7d,
    agentCount,
    contactCount,
    campaignCount,
    workflowCount,
    isAIConfigured,
  ] = await Promise.all([
    prisma.call.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.call.count({
      where: {
        workspaceId: ctx.workspaceId,
        status: { in: ['QUEUED', 'RINGING', 'IN_PROGRESS', 'ON_HOLD'] },
      },
    }),
    prisma.call.count({ where: { workspaceId: ctx.workspaceId, aiAgentId: { not: null } } }),
    prisma.call.count({
      where: { workspaceId: ctx.workspaceId, assignedUserId: { not: null }, aiAgentId: null },
    }),
    prisma.call.count({
      where: { workspaceId: ctx.workspaceId, outcome: { in: ['CONNECTED', 'VOICEMAIL'] } },
    }),
    prisma.call.aggregate({
      where: { workspaceId: ctx.workspaceId, durationSec: { not: null, gt: 0 } },
      _avg: { durationSec: true },
    }),
    prisma.task.count({
      where: { workspaceId: ctx.workspaceId, status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] } },
    }),
    prisma.lead.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        followUpDate: { not: null },
        stage: { notIn: ['WON', 'LOST'] },
      },
      include: { contact: { select: { name: true, company: true } } },
      orderBy: { followUpDate: 'asc' },
      take: 5,
    }),
    prisma.call.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { contact: { select: { name: true } } },
    }),
    prisma.lead.groupBy({
      by: ['stage'],
      _count: { _all: true },
      where: { workspaceId: ctx.workspaceId },
    }),
    prisma.call.findMany({
      where: { workspaceId: ctx.workspaceId, createdAt: { gte: since } },
      select: { createdAt: true, outcome: true, durationSec: true },
    }),
    prisma.aIAgent.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.contact.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.campaign.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.workflow.count({ where: { workspaceId: ctx.workspaceId } }),
    Promise.resolve(isGoogleConfigured),
  ]);

  const totalLeads = leadStages.reduce((acc, g) => acc + g._count._all, 0);
  const wonLeads = leadStages.find((g) => g.stage === 'WON')?._count._all ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;
  const avgHandling = completedWithDuration._avg.durationSec
    ? formatDuration(Math.round(completedWithDuration._avg.durationSec))
    : '—';

  // 7-day call volume
  const volumeByDay: { day: string; calls: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    volumeByDay.push({
      day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      calls: recentCalls7d.filter((c) => c.createdAt >= dayStart && c.createdAt < dayEnd).length,
    });
  }

  const outcomeCounts = recentCalls7d.reduce<Record<string, number>>((acc, c) => {
    if (c.outcome) acc[c.outcome] = (acc[c.outcome] ?? 0) + 1;
    return acc;
  }, {});
  const outcomeData = Object.entries(outcomeCounts).map(([name, value]) => ({ name, value }));

  const stageLabels: Record<string, string> = {
    NEW: 'New',
    CONTACTED: 'Contacted',
    QUALIFIED: 'Qualified',
    FOLLOW_UP: 'Follow-up',
    PROPOSAL: 'Proposal',
    WON: 'Won',
    LOST: 'Lost',
  };
  const stageData = leadStages.map((g) => ({
    stage: stageLabels[g.stage] ?? g.stage,
    count: g._count._all,
  }));

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Dashboard"
        description={
          <>
            Live overview for <span className="font-medium text-foreground">{ctx.workspaceName}</span> —
            last 7 days of activity.
          </>
        }
      />

      {!isAIConfigured && (
        <Alert variant="destructive">
          <KeyRound className="size-4" />
          <AlertTitle>AI not configured</AlertTitle>
          <AlertDescription>
            Set the `GOOGLE_API_KEY` environment variable to enable the AI assistant and voice
            agents.
          </AlertDescription>
        </Alert>
      )}
      {!isChatActive && (
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>Outside business hours</AlertTitle>
          <AlertDescription>{settings.awayMessage}</AlertDescription>
        </Alert>
      )}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total calls" value={totalCalls} icon={PhoneCall} hint="All time" />
        <KpiCard title="Active calls" value={activeCalls} icon={PhoneIncoming} hint="Right now" />
        <KpiCard
          title="AI vs human"
          value={`${aiHandledCalls} / ${humanHandledCalls}`}
          icon={Bot}
          hint="AI handled / human handled"
        />
        <KpiCard title="Answer rate" value={`${answerRate}%`} icon={CheckCircle2} hint="Connected or voicemail" />
        <KpiCard
          title="Avg. handling time"
          value={avgHandling}
          icon={Clock}
          hint="Completed calls"
        />
        <KpiCard title="Conversion rate" value={`${conversionRate}%`} icon={CheckCircle2} hint={`${wonLeads} of ${totalLeads} leads won`} />
        <KpiCard title="Pending follow-ups" value={followUpLeads.length} icon={CalendarClock} hint="Scheduled leads" />
        <KpiCard title="Open tasks" value={pendingTasks} icon={ListTodo} hint="Todo + in progress" />
      </div>

      {/* Setup checklist — visible until the workspace is fully set up */}
      {!(agentCount > 0 && contactCount > 0 && campaignCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Set up your call center</CardTitle>
            <CardDescription>
              Three steps stand between you and your first automated campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {[
              {
                done: agentCount > 0,
                step: 1,
                title: 'Build an AI agent',
                hint: 'Name it, bind knowledge, test it',
                href: '/agents/new',
                icon: Bot,
              },
              {
                done: contactCount > 0,
                step: 2,
                title: 'Import contacts',
                hint: 'CSV upload or add by hand',
                href: '/contacts',
                icon: Users,
              },
              {
                done: campaignCount > 0,
                step: 3,
                title: 'Launch a campaign',
                hint: 'Set the audience and calling rules',
                href: '/campaigns/new',
                icon: Target,
              },
            ].map((item) => (
              <Link
                key={item.step}
                href={item.href}
                className="group flex items-start gap-3 border p-4 transition-colors hover:bg-accent"
              >
                <span
                  className={
                    item.done
                      ? 'flex size-8 shrink-0 items-center justify-center bg-success text-white'
                      : 'flex size-8 shrink-0 items-center justify-center bg-secondary'
                  }
                >
                  {item.done ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <item.icon className="size-4" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="tabular text-xs text-muted-foreground">{item.step}.</span>
                    {item.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                </span>
                {item.done && (
                  <Badge variant="success" className="ml-auto shrink-0">
                    Done
                  </Badge>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call volume</CardTitle>
            <CardDescription>Calls placed per day, last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <CallVolumeChart data={volumeByDay} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call outcomes</CardTitle>
            <CardDescription>Distribution over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <OutcomePieChart data={outcomeData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
            <CardDescription>Current lead distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {stageData.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                No leads yet — add leads to build your pipeline.
              </div>
            ) : (
              <StageBarChart data={stageData} />
            )}
          </CardContent>
        </Card>

        {/* Recent calls + follow-ups */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent calls</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {recentCalls.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No calls yet.
                </p>
              ) : (
                recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center gap-3 border p-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center bg-secondary">
                      {call.aiAgentId ? <Bot className="size-4" /> : <User className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {call.contact?.name ?? call.toNumber ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.direction === 'INBOUND' ? 'Inbound' : 'Outbound'} ·{' '}
                        {formatDuration(call.durationSec)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        call.status === 'COMPLETED'
                          ? 'secondary'
                          : call.status === 'FAILED'
                            ? 'destructive'
                            : 'default'
                      }
                    >
                      {call.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Follow-up queue</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {followUpLeads.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No follow-ups scheduled.
                </p>
              ) : (
                followUpLeads.map((lead) => {
                  const overdue = lead.followUpDate && lead.followUpDate < new Date();
                  return (
                    <div key={lead.id} className="flex items-center gap-3 border p-2.5">
                      <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{lead.contact.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.contact.company || '—'}
                        </p>
                      </div>
                      <Badge variant={overdue ? 'destructive' : 'secondary'}>
                        {lead.followUpDate?.toLocaleDateString() ?? '—'}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI co-pilot */}
      <div className="flex-1 min-h-0">
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BotMessageSquare className="size-4" />
              AI co-pilot
            </CardTitle>
            <CardDescription>
              Ask questions grounded in your knowledge base, with web search.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ChatPanel disabled={!isAIConfigured} isChatActive={isChatActive} />
          </CardContent>
        </Card>
      </div>

      {followUpLeads.some((l) => l.followUpDate && l.followUpDate < new Date()) && (
        <Alert variant="default" className="border-warning/40">
          <AlertTriangle className="size-4 text-warning" />
          <AlertTitle>Overdue follow-ups</AlertTitle>
          <AlertDescription>
            Some leads have follow-up dates in the past — review them in the pipeline.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
