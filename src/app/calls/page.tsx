import Link from 'next/link';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { PhoneIncoming, PhoneOutgoing, Bot, User, FileAudio, ChevronLeft, ChevronRight, PhoneCall } from 'lucide-react';

function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'COMPLETED':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    case 'IN_PROGRESS':
    case 'QUEUED':
    case 'RINGING':
      return 'default';
    default:
      return 'outline';
  }
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: { direction?: string; status?: string; page?: string };
}) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const pageSize = 25;

  const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
  if (searchParams.direction === 'INBOUND' || searchParams.direction === 'OUTBOUND') {
    where.direction = searchParams.direction;
  }
  if (searchParams.status) {
    where.status = searchParams.status;
  }

  const [calls, total, recordings] = await Promise.all([
    prisma.call.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contact: { select: { id: true, name: true } },
        aiAgent: { select: { name: true } },
        assignedUser: { select: { name: true } },
        recordings: { select: { id: true, url: true } },
      },
    }),
    prisma.call.count({ where }),
    Promise.resolve(null),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setFilter = (key: string, value?: string) => {
    const params = new URLSearchParams();
    if (value) params.set(key, value);
    return `/calls${params.toString() ? `?${params.toString()}` : ''}`;
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Call history"
        description={`${total} ${total === 1 ? 'call' : 'calls'} in ${ctx.workspaceName} — every call is logged with its full lifecycle.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: 'All', href: setFilter('direction'), active: !searchParams.direction },
          {
            label: 'Outbound',
            href: setFilter('direction', 'OUTBOUND'),
            active: searchParams.direction === 'OUTBOUND',
          },
          {
            label: 'Inbound',
            href: setFilter('direction', 'INBOUND'),
            active: searchParams.direction === 'INBOUND',
          },
        ].map((tab) => (
          <Button key={tab.label} asChild variant={tab.active ? 'default' : 'outline'} size="sm">
            <Link href={tab.href}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {calls.length > 0 ? (
            <div className="divide-y">
              {calls.map((call) => (
                <div key={call.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-secondary">
                    {call.direction === 'INBOUND' ? (
                      <PhoneIncoming className="size-5" />
                    ) : (
                      <PhoneOutgoing className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {call.contact ? (
                        <Link
                          href={`/contacts/${call.contact.id}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {call.contact.name}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-medium">
                          {call.toNumber ?? 'Unknown number'}
                        </span>
                      )}
                      <Badge variant={statusVariant(call.status)}>{call.status}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {call.direction} ·{' '}
                      {call.aiAgent ? (
                        <span className="inline-flex items-center gap-1">
                          <Bot className="size-3" /> {call.aiAgent.name}
                        </span>
                      ) : call.assignedUser ? (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" /> {call.assignedUser.name}
                        </span>
                      ) : (
                        'Unassigned'
                      )}
                      {call.notes ? ` · ${call.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {call.recordings.length > 0 && (
                      <a
                        href={call.recordings[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileAudio className="size-3" /> Recording
                      </a>
                    )}
                    <span>{formatDuration(call.durationSec)}</span>
                    <span>{call.createdAt.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <PhoneCall className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No calls yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Place a call from the Dialer or a lead card — provider-backed call logs, recordings,
                and AI notes will appear here.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/dialer">Open Dialer</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} — {total} calls
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" disabled={page <= 1}>
              <Link href={`/calls?${new URLSearchParams({ ...(searchParams.direction ? { direction: searchParams.direction } : {}), page: String(page - 1) }).toString()}`}>
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" disabled={page >= totalPages}>
              <Link href={`/calls?${new URLSearchParams({ ...(searchParams.direction ? { direction: searchParams.direction } : {}), page: String(page + 1) }).toString()}`}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
