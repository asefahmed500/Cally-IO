import { prisma } from '@/lib/prisma';
import { registerJobHandler, enqueueJob } from './engine';

/**
 * Background job handlers. Registered once per server process (imported by
 * the /api/jobs/tick route). Campaign dialing is window-aware, consent-aware,
 * and respects per-campaign concurrency + retry rules.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

async function isWithinCallingWindow(timezone: string, days: number[], start: string, end: string): Promise<boolean> {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = weekdayMap[get('weekday')] ?? 1;
    if (!days.includes(weekday)) return false;
    const time = `${get('hour')}:${get('minute')}`;
    return time >= start && time <= end;
  } catch {
    // Invalid timezone — default to open.
    return true;
  }
}

/** Finds a bound AI agent's phone number for caller ID, falling back to env. */
async function resolveCallerId(workspaceId: string, campaignCallerId?: string | null): Promise<string | null> {
  if (campaignCallerId) {
    const number = await prisma.phoneNumber.findFirst({
      where: { workspaceId, number: campaignCallerId, status: 'ACTIVE' },
    });
    if (number) return number.number;
  }
  return process.env.TWILIO_PHONE_NUMBER ?? null;
}

/**
 * Campaign tick: for each RUNNING campaign inside its calling window, dial up
 * to `concurrency` due contacts. Handles consent gating, retries, and per-attempt logging.
 */
async function campaignTick(payload: { campaignId?: string } = {}) {
  const { TWILIO_PHONE_NUMBER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio not configured — campaign dialing unavailable.');
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) throw new Error('NEXT_PUBLIC_BASE_URL not configured.');

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'RUNNING',
      deletedAt: null,
      ...(payload.campaignId ? { id: payload.campaignId } : {}),
    },
    include: { aiAgent: { select: { id: true, name: true, status: true } } },
    take: 10,
  });

  for (const campaign of campaigns) {
    if (campaign.aiAgent && campaign.aiAgent.status !== 'ACTIVE') continue;
    if (campaign.scheduleEnd && campaign.scheduleEnd < new Date()) {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'COMPLETED' } });
      continue;
    }
    if (!(await isWithinCallingWindow(
      campaign.timezone,
      campaign.callingDays,
      campaign.callingWindowStart,
      campaign.callingWindowEnd
    ))) {
      continue;
    }

    const inFlight = await prisma.campaignContact.count({
      where: { campaignId: campaign.id, status: 'CALLING' },
    });
    const capacity = Math.max(0, campaign.concurrency - inFlight);
    if (capacity === 0) continue;

    const now = new Date();
    const due = await prisma.campaignContact.findMany({
      where: {
        campaignId: campaign.id,
        OR: [
          { status: 'PENDING' },
          {
            status: 'QUEUED',
            nextAttemptAt: { lte: now },
          },
        ],
        contact: {
          deletedAt: null,
          consentStatus: { notIn: ['DENIED', 'OPTED_OUT'] },
          phone: { not: null },
        },
      },
      include: { contact: { select: { id: true, name: true, phone: true, consentStatus: true } } },
      orderBy: [{ status: 'asc' }, { nextAttemptAt: 'asc' }],
      take: capacity,
    });

    const callerId = await resolveCallerId(campaign.workspaceId, campaign.callerIdPhoneNumberId);

    for (const entry of due) {
      if (!entry.contact.phone) {
        await prisma.campaignContact.update({
          where: { id: entry.id },
          data: { status: 'SKIPPED', outcome: 'NO_PHONE' },
        });
        continue;
      }

      // Claim atomically before dialing — overlapping ticks must not
      // double-dial the same contact.
      const claimed = await prisma.campaignContact.updateMany({
        where: { id: entry.id, status: { in: ['PENDING', 'QUEUED'] } },
        data: { status: 'CALLING', attempts: { increment: 1 }, lastAttemptAt: now },
      });
      if (claimed.count === 0) continue; // Another tick already claimed it.

      try {
        const { twilioProvider } = await import('@/lib/telephony/twilio');
        const call = await twilioProvider.initiateCall({
          to: entry.contact.phone,
          from: callerId ?? TWILIO_PHONE_NUMBER,
          webhookUrl: new URL(`/api/twilio/call?leadId=&contactId=${entry.contactId}&campaignId=${campaign.id}`, baseUrl).toString(),
          statusCallbackUrl: new URL('/api/twilio/status', baseUrl).toString(),
        });

        // The call stays CAMPAIGN_CALLING until the provider webhook resolves
        // the outcome (status webhook transitions it).
        await prisma.call.create({
          data: {
            workspaceId: campaign.workspaceId,
            direction: 'OUTBOUND',
            status: 'QUEUED',
            providerCallSid: call.providerCallSid,
            toNumber: entry.contact.phone,
            contactId: entry.contact.id,
            campaignId: campaign.id,
            aiAgentId: campaign.aiAgentId,
            initiatedById: campaign.createdById,
          },
        });
      } catch (error: unknown) {
        console.error('Campaign dial failed:', error);
        const attempts = entry.attempts;
        const willRetry = attempts < campaign.maxAttempts;
        await prisma.campaignContact.update({
          where: { id: entry.id },
          data: {
            status: willRetry ? 'QUEUED' : 'FAILED',
            outcome: 'DIAL_ERROR',
            nextAttemptAt: willRetry ? new Date(Date.now() + campaign.retryDelayMinutes * 60_000) : null,
          },
        });
      }
    }
  }
}

/**
 * Called by the Twilio status webhook when a campaign call reaches a terminal
 * state. Applies outcomes and retry rules to the CampaignContact row.
 */
export async function resolveCampaignContactFromCall(call: {
  campaignId: string | null;
  providerCallSid: string | null;
  status: string;
  durationSec: number | null;
}) {
  if (!call.campaignId) return;

  const campaign = await prisma.campaign.findUnique({ where: { id: call.campaignId } });
  if (!campaign) return;

  const terminal = ['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED'];
  if (!terminal.includes(call.status)) return;

  const entry = await prisma.campaignContact.findFirst({
    where: { campaignId: call.campaignId, status: 'CALLING' },
    orderBy: { lastAttemptAt: 'desc' },
  });
  if (!entry) return;

  const answered = call.status === 'COMPLETED' && (call.durationSec ?? 0) > 5;
  const retryable = !answered && ['NO_ANSWER', 'BUSY', 'CANCELLED', 'FAILED'].includes(call.status);
  const willRetry = retryable && entry.attempts < campaign.maxAttempts;

  await prisma.campaignContact.update({
    where: { id: entry.id },
    data: willRetry
      ? {
          status: 'QUEUED',
          outcome: call.status,
          nextAttemptAt: new Date(Date.now() + campaign.retryDelayMinutes * 60_000),
        }
      : {
          status: answered ? 'COMPLETED' : 'FAILED',
          outcome: call.status,
        },
  });
}

// Register built-in handlers.
registerJobHandler('campaign.tick', campaignTick);

// Workflow executions run on the same queue.
registerJobHandler('workflow.execute', async (payload) => {
  const { runWorkflowExecution } = await import('@/lib/workflows/engine');
  await runWorkflowExecution(String(payload.executionId));
});

// Conversation intelligence: transcribe + analyze a finished call.
registerJobHandler('intelligence.process', async (payload) => {
  const { processCallIntelligence } = await import('@/ai/flows/call-intelligence');
  const prisma = (await import('@/lib/prisma')).prisma;

  const callId = String(payload.callId);
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      contact: { select: { name: true } },
      recordings: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!call) return;

  const summary = await prisma.conversationSummary.findUnique({ where: { callId } });
  if (summary?.processingStatus === 'READY') return; // Already processed.

  await processCallIntelligence({
    callId,
    recordingUrl: call.recordings[0]?.url ?? payload.recordingUrl ?? null,
    notes: call.notes,
    contactName: call.contact?.name ?? call.toNumber ?? 'Unknown',
    direction: call.direction,
    aiIntent: call.notes,
  });
});

/** Enqueues intelligence processing when a call finishes with material to analyze. */
export async function enqueueIntelligenceProcessing(callId: string) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { notes: true, recordings: { select: { id: true } } },
  });
  if (!call) return;
  if (call.recordings.length === 0 && !call.notes) return;

  await enqueueJob('intelligence.process', { callId }, { workspaceId: undefined, maxAttempts: 3 });
}

// Recurring scheduler: every tick re-enqueues the next sweep 60s out.
export async function ensureCampaignScheduler() {
  const last = await prisma.job.findFirst({
    where: { type: 'campaign.scheduleNext' },
    orderBy: { createdAt: 'desc' },
  });
  // Only re-arm if the last scheduler ran over a minute ago.
  if (last && last.completedAt && Date.now() - last.completedAt.getTime() < 60_000) return;

  await enqueueJob('campaign.scheduleNext', {}, { runAt: new Date(Date.now() + 60_000) });
}

registerJobHandler('campaign.scheduleNext', async () => {
  await campaignTick({});
  // Supersede any duplicate schedulers created by racing ticks — the
  // check-then-enqueue in ensureCampaignScheduler is not atomic, so two
  // ticks can each enqueue one. Completing all *other* PENDING schedulers
  // here keeps exactly one live lineage.
  await prisma.job.updateMany({
    where: { type: 'campaign.scheduleNext', status: 'PENDING' },
    data: { status: 'COMPLETED', completedAt: new Date(), lastError: 'superseded' },
  });
  await enqueueJob('campaign.scheduleNext', {}, { runAt: new Date(Date.now() + 60_000) });
});
