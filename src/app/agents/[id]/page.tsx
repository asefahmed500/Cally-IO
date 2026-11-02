import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { can } from '@/lib/permissions';
import { getAgent } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Pencil, Bot } from 'lucide-react';
import { AgentTestConsole } from '@/components/agents/agent-test-console';

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const agent = await getAgent(params.id);
  if (!agent) notFound();

  const canManage = can(ctx.role, 'agents.manage');

  const caps = agent.config?.capabilities;
  const capList = caps
    ? Object.entries(caps)
        .filter(([, enabled]) => enabled)
        .map(([key]) =>
          key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
        )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/agents">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to agents</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{agent.name}</h1>
            <Badge variant={agent.status === 'ACTIVE' ? 'default' : 'secondary'}>{agent.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {agent.description || 'No description'} · v{agent.versionCount}
          </p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href={`/agents/${agent.$id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {[
              ['Language', agent.config?.identity.language ?? agent.language],
              ['Voice', agent.config ? `${agent.config.voice.voiceName} (${agent.config.voice.provider})` : '—'],
              ['Speed', agent.config?.personality.speakingSpeed ?? '—'],
              ['Greeting', agent.config?.personality.greeting ?? '—'],
              ['Calls', agent.config ? `${agent.config.callConfig.direction}, max ${agent.config.callConfig.maxDurationMinutes} min` : '—'],
              ['Recording', agent.config?.callConfig.recordCalls ? 'Enabled' : 'Disabled'],
              ['AI disclosure', agent.config?.callConfig.disclosureEnabled ? 'Enabled' : 'Disabled'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0">
                <span className="shrink-0 text-muted-foreground">{label}</span>
                <span className="truncate text-right font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Capabilities</CardTitle>
            <CardDescription>Enabled runtime tools</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {capList.length > 0 ? (
              capList.map((cap) => (
                <Badge key={cap} variant="secondary">
                  {cap}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No capabilities enabled.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Knowledge</CardTitle>
            <CardDescription>Bound sources (READY only)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {agent.knowledgeSources.length > 0 ? (
              agent.knowledgeSources.map((source) => (
                <div key={source.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{source.name}</span>
                  <Badge variant="outline">{source.type}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No sources bound.</p>
            )}
            <Separator className="my-1" />
            <p className="text-xs text-muted-foreground">
              Workspace FAQs: {agent.config?.knowledge.useWorkspaceFaqs ? 'enabled' : 'disabled'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" />
            Test Console
          </CardTitle>
          <CardDescription>
            Text simulation — the agent responds using its live configuration and knowledge.
            Voice testing uses the same configuration at call time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentTestConsole agentId={agent.$id} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
