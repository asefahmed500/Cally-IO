import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  PhoneCall,
  Mail,
  Building2,
  ListTodo,
  Clock,
  Bot,
  User,
} from 'lucide-react';

function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    notFound();
  }

  // Tenant-scoped: a foreign contact id behaves as 404.
  const contact = await prisma.contact.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: {
      owner: { select: { name: true } },
      lead: true,
    },
  });
  if (!contact) notFound();

  const [calls, tasks] = await Promise.all([
    prisma.call.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { aiAgent: { select: { name: true } }, assignedUser: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { assignee: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/contacts">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to contacts</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground">
            Added {contact.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <PhoneCall className="size-4 text-muted-foreground" />
              <span>{contact.phone || 'No phone'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <span className="truncate">{contact.email || 'No email'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <span>
                {contact.company || '—'}
                {contact.jobTitle ? ` · ${contact.jobTitle}` : ''}
              </span>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{contact.priority}</Badge>
              <Badge variant="outline">{contact.consentStatus}</Badge>
              {contact.lead && <Badge>{contact.lead.stage}</Badge>}
            </div>
            {contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Owner</span>
              <span className="text-foreground">{contact.owner?.name || 'Unassigned'}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Last contacted</span>
              <span className="text-foreground">
                {contact.lastContactedAt ? contact.lastContactedAt.toLocaleDateString() : 'Never'}
              </span>
            </div>
            {contact.notes && (
              <>
                <Separator />
                <p className="text-muted-foreground">{contact.notes}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Call history</CardTitle>
              <CardDescription>Latest {calls.length || 0} calls</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {calls.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No calls yet.</p>
              ) : (
                calls.map((call) => (
                  <div key={call.id} className="flex items-center gap-3 border p-3">
                    <span className="flex size-8 shrink-0 items-center justify-center bg-secondary">
                      {call.aiAgentId ? <Bot className="size-4" /> : <User className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {call.aiAgent?.name ?? call.assignedUser?.name ?? 'Unknown agent'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.direction === 'INBOUND' ? 'Inbound' : 'Outbound'} ·{' '}
                        {formatDuration(call.durationSec)} · {call.createdAt.toLocaleString()}
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
              <CardTitle className="text-base">Tasks</CardTitle>
              <CardDescription>Related tasks for this contact</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {tasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 border p-3">
                    <ListTodo className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.assignee?.name ?? 'Unassigned'} · {task.source}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.dueDate && (
                        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                          <Clock className="size-3" />
                          {task.dueDate.toLocaleDateString()}
                        </span>
                      )}
                      <Badge
                        variant={
                          task.status === 'COMPLETED'
                            ? 'secondary'
                            : task.status === 'CANCELLED'
                              ? 'outline'
                              : 'default'
                        }
                      >
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
