'use client'

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PhoneCall, Bot, User, Radio, Users, ListOrdered, WifiOff } from 'lucide-react';

type Snapshot = {
  activeCalls: {
    id: string;
    contactName: string;
    agent: string;
    isAI: boolean;
    status: string;
    startedAt: string;
  }[];
  queue: number;
  agents: { id: string; name: string; status: string }[];
  members: { name: string; availability: string; role: string }[];
  generatedAt: string;
};

export function LiveOpsView({ canMonitor }: { canMonitor: boolean }) {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canMonitor) return;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let source: EventSource | null = null;

    const startPolling = () => {
      if (pollInterval) return;
      // Polling fallback hits the dashboard-derived data sparingly.
      pollInterval = setInterval(() => {
        window.location.reload();
      }, 15_000);
    };

    try {
      source = new EventSource('/api/live/stream');
      source.addEventListener('snapshot', (event) => {
        setConnected(true);
        setError(null);
        try {
          setSnapshot(JSON.parse((event as MessageEvent).data));
        } catch {
          // Ignore malformed frames.
        }
      });
      source.onerror = () => {
        setConnected(false);
        source?.close();
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      source?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [canMonitor]);

  if (!canMonitor) {
    return (
      <Alert>
        <WifiOff className="size-4" />
        <AlertTitle>Monitoring requires a higher role</AlertTitle>
        <AlertDescription>
          Live Operations is available to MANAGER, SUPERVISOR, ADMIN, and workspace owners.
        </AlertDescription>
      </Alert>
    );
  }

  const activeCalls = snapshot?.activeCalls ?? [];
  const availableMembers = snapshot?.members.filter((m) => m.availability === 'AVAILABLE') ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Radio className={`size-3.5 ${connected ? 'text-success' : 'text-muted-foreground'}`} />
        {connected
          ? `Live — updated ${snapshot ? new Date(snapshot.generatedAt).toLocaleTimeString() : ''}`
          : 'Connecting...'}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active calls</CardTitle>
            <PhoneCall className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {snapshot ? (
              <div className="text-2xl font-semibold">{activeCalls.length}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Waiting in queue</CardTitle>
            <ListOrdered className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {snapshot ? (
              <div className="text-2xl font-semibold">{snapshot.queue}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Available people</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {snapshot ? (
              <div className="text-2xl font-semibold">{availableMembers.length}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active calls</CardTitle>
          <CardDescription>
            Provider-confirmed calls only — state updates arrive as webhooks are processed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!snapshot ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : activeCalls.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active calls right now.
            </p>
          ) : (
            activeCalls.map((call) => (
              <div key={call.id} className="flex items-center gap-3 border p-3">
                <span className="flex size-9 shrink-0 items-center justify-center bg-secondary">
                  {call.isAI ? <Bot className="size-4" /> : <User className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{call.contactName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {call.agent} · started {new Date(call.startedAt).toLocaleTimeString()}
                  </p>
                </div>
                <Badge>{call.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI agents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!snapshot ? (
              <Skeleton className="h-12 w-full" />
            ) : snapshot.agents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No deployed agents.</p>
            ) : (
              snapshot.agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between border p-3 text-sm">
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant={agent.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {agent.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Team availability</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!snapshot ? (
              <Skeleton className="h-12 w-full" />
            ) : snapshot.members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No members yet.</p>
            ) : (
              snapshot.members.map((member) => (
                <div key={member.name} className="flex items-center justify-between border p-3 text-sm">
                  <span className="font-medium">{member.name}</span>
                  <Badge
                    variant={member.availability === 'AVAILABLE' ? 'default' : 'secondary'}
                  >
                    {member.availability}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Live connection error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
