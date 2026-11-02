import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  QUEUED: 'secondary',
  CALLING: 'default',
  COMPLETED: 'secondary',
  FAILED: 'destructive',
  SKIPPED: 'outline',
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string };
}) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }
  if (!can(ctx.role, 'campaigns.view')) {
    redirect('/dashboard');
  }

  // Tenant-scoped: a foreign campaign id behaves as 404.
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: {
      aiAgent: { select: { name: true } },
      contacts: { select: { status: true } },
    },
  });
  if (!campaign) notFound();

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const pageSize = 50;
  const [entries, total] = await Promise.all([
    prisma.campaignContact.findMany({
      where: { campaignId: campaign.id },
      include: { contact: { select: { id: true, name: true, phone: true, company: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaignContact.count({ where: { campaignId: campaign.id } }),
  ]);

  const totals = { total: campaign.contacts.length, pending: 0, queued: 0, calling: 0, completed: 0, failed: 0, skipped: 0 };
  for (const entry of campaign.contacts) {
    if (entry.status === 'PENDING') totals.pending++;
    else if (entry.status === 'QUEUED') totals.queued++;
    else if (entry.status === 'CALLING') totals.calling++;
    else if (entry.status === 'COMPLETED') totals.completed++;
    else if (entry.status === 'FAILED') totals.failed++;
    else if (entry.status === 'SKIPPED') totals.skipped++;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/campaigns">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to campaigns</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <Badge variant={campaign.status === 'RUNNING' ? 'default' : 'secondary'}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {campaign.objective || 'No objective'} · {campaign.callingWindowStart}–
            {campaign.callingWindowEnd} {campaign.timezone} · ≤{campaign.maxAttempts} attempts ·{' '}
            {campaign.concurrency} concurrent
            {campaign.aiAgent ? ` · Agent: ${campaign.aiAgent.name}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Object.entries(totals).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-semibold">{value}</p>
              <p className="text-xs capitalize text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Attempts</TableHead>
              <TableHead className="hidden lg:table-cell">Outcome</TableHead>
              <TableHead className="hidden lg:table-cell">Last attempt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Link href={`/contacts/${entry.contact.id}`} className="text-sm font-medium hover:underline">
                    {entry.contact.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{entry.contact.company}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {entry.contact.phone}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[entry.status] ?? 'outline'}>{entry.status}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {entry.attempts}/{campaign.maxAttempts}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {entry.outcome || '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {entry.lastAttemptAt ? entry.lastAttemptAt.toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/campaigns/${campaign.id}?page=${page - 1}`}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/campaigns/${campaign.id}?page=${page + 1}`}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
