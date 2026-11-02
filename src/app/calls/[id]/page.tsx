import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireWorkspace, TenantError } from '@/lib/tenant';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getRetentionPolicy } from '@/lib/retention';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, PhoneIncoming, PhoneOutgoing, Bot, User, FileAudio, Loader2, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { CallIntelligencePanel } from '@/components/calls/call-intelligence-panel';

function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireWorkspace().catch((e) => e);
  if (ctx instanceof TenantError) {
    redirect(ctx.status === 401 ? '/login' : '/onboarding');
  }

  // Tenant-scoped: a foreign call id behaves as 404.
  const call = await prisma.call.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: {
      contact: { select: { id: true, name: true, company: true } },
      aiAgent: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
      initiatedBy: { select: { name: true } },
      campaign: { select: { id: true, name: true } },
      fromNumber: { select: { number: true } },
      events: { orderBy: { occurredAt: 'asc' } },
      recordings: { orderBy: { createdAt: 'desc' } },
      transcript: true,
      summary: { include: { reviewedBy: { select: { name: true } } } },
    },
  });
  if (!call) notFound();

  const canReview = can(ctx.role, 'calls.manage');
  const { allowRecordingDownload } = await getRetentionPolicy(ctx.workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/calls">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to call history</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {call.contact?.name ?? call.toNumber ?? 'Unknown call'}
            </h1>
            <Badge variant={call.status === 'COMPLETED' ? 'secondary' : call.status === 'FAILED' ? 'destructive' : 'default'}>
              {call.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {call.direction === 'INBOUND' ? 'Inbound' : 'Outbound'} ·{' '}
            {call.createdAt.toLocaleString()} · {formatDuration(call.durationSec)}
            {call.campaign ? ` · Campaign: ${call.campaign.name}` : ''}
          </p>
        </div>
        {call.recordings.length > 0 && allowRecordingDownload && (
          <Button asChild variant="outline" size="sm">
            <a href={call.recordings[0].url} target="_blank" rel="noopener noreferrer">
              <FileAudio />
              Recording
            </a>
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Meta */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Call details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {[
              ['Handled by', call.aiAgent ? `${call.aiAgent.name} (AI)` : call.assignedUser?.name ?? 'Unassigned'],
              ['Initiated by', call.initiatedBy?.name ?? '—'],
              ['From', call.fromNumber?.number ?? call.fromNumberRaw ?? '—'],
              ['To', call.toNumber ?? '—'],
              ['Outcome', call.outcome ?? 'Pending'],
              ['Disposition', call.disposition ?? '—'],
              ['Answered', call.answeredAt ? call.answeredAt.toLocaleTimeString() : '—'],
              ['Ended', call.endedAt ? call.endedAt.toLocaleTimeString() : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0">
                <span className="shrink-0 text-muted-foreground">{label}</span>
                <span className="truncate text-right font-medium">{value}</span>
              </div>
            ))}
            {call.notes && (
              <>
                <Separator className="my-1" />
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Live notes</p>
                  <p className="text-muted-foreground">{call.notes}</p>
                </div>
              </>
            )}
            {call.contact && (
              <>
                <Separator className="my-1" />
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/contacts/${call.contact.id}`}>Open contact</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Intelligence */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" />
                Conversation Intelligence
              </CardTitle>
              <CardDescription>
                AI-generated assessments — review before acting on them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!call.summary ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  {call.status === 'COMPLETED' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processing queued — the summary appears after the background job runs
                      (requires the /api/jobs/tick cron and GOOGLE_API_KEY).
                    </>
                  ) : (
                    'Intelligence is generated when the call completes.'
                  )}
                </div>
              ) : (
                <CallIntelligencePanel
                  callId={call.id}
                  summary={{
                    text: call.summary.summary ?? '',
                    intent: call.summary.intent ?? '',
                    sentiment: (call.summary.sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL') ?? 'NEUTRAL',
                    outcome: call.summary.outcome ?? '',
                    qualificationScore: call.summary.qualificationScore ?? 0,
                    actionItems: (call.summary.actionItems as string[] | null) ?? [],
                    escalated: call.summary.escalated,
                    model: call.summary.model ?? '',
                    reviewedByName: call.summary.reviewedBy?.name ?? null,
                    reviewedAt: call.summary.reviewedAt?.toISOString() ?? null,
                  }}
                  canReview={canReview}
                />
              )}
            </CardContent>
          </Card>

          {/* Transcript */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transcript</CardTitle>
              <CardDescription>
                {call.transcript?.provider ? `via ${call.transcript.provider}` : 'Not transcribed yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!call.transcript ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No transcript. Recordings are transcribed automatically when present.
                </p>
              ) : call.transcript.status === 'READY' ? (
                <div className="max-h-96 overflow-y-auto border bg-muted/30 p-4">
                  {call.transcript.segments && Array.isArray(call.transcript.segments) && (call.transcript.segments as { speaker: string; text: string }[]).length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {(call.transcript.segments as { speaker: string; text: string }[]).map((seg, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                            {seg.speaker}
                          </span>
                          <p className="min-w-0">{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{call.transcript.text}</p>
                  )}
                </div>
              ) : call.transcript.status === 'FAILED' ? (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Transcription failed</AlertTitle>
                  <AlertDescription>{call.transcript.error ?? 'Retry by re-running the job.'}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {call.transcript.status === 'PROCESSING' ? 'Transcribing...' : 'Waiting to process...'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Event timeline</CardTitle>
          <CardDescription>Provider events and system milestones, in order</CardDescription>
        </CardHeader>
        <CardContent>
          {call.events.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No events recorded.</p>
          ) : (
            <div className="flex flex-col">
              {call.events.map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {i === 0 ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : (
                      <span className="size-2 bg-border" />
                    )}
                    {i < call.events.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">{event.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.occurredAt.toLocaleString()}
                      {event.payload ? ` · ${JSON.stringify(event.payload).slice(0, 120)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
