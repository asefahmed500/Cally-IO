import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { twilioProvider } from '@/lib/telephony/twilio';

// Twilio status webhook — updates call state, appends a timeline event.
// Idempotent: retrying the same event does not duplicate timeline entries.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  // Webhook verification — fail closed unless explicitly disabled.
  const signature = request.headers.get('x-twilio-signature');
  const valid = await twilioProvider.verifyWebhook(request.url, params, signature);
  if (!valid) {
    return new NextResponse('Invalid webhook signature', { status: 403 });
  }

  // Rate limit per call (after verification) so forged floods can't exhaust
  // a shared bucket that legitimate Twilio callbacks need.
  const callSid = params['CallSid'] ?? 'unknown';
  const webhookLimit = await rateLimit('twilio:' + callSid, 'webhook');
  if (!webhookLimit.ok) return tooManyRequests(webhookLimit);

  const event = twilioProvider.parseWebhook(formData);

  if (!event.providerCallSid) {
    return new NextResponse('Missing CallSid', { status: 400 });
  }

  try {
    const existing = await prisma.call.findUnique({
      where: { providerCallSid: event.providerCallSid },
    });
    if (!existing) {
      console.warn(`No call record for SID: ${event.providerCallSid}`);
      // 200 so Twilio doesn't retry for unknown calls.
      return new NextResponse('Call record not found, but acknowledged.', { status: 200 });
    }

    const terminal =
      event.status === 'COMPLETED' ||
      event.status === 'FAILED' ||
      event.status === 'NO_ANSWER' ||
      event.status === 'BUSY' ||
      event.status === 'CANCELLED';

    const changed = !event.status || existing.status !== event.status;

    await prisma.call.update({
      where: { id: existing.id },
      data: {
        ...(event.status ? { status: event.status } : {}),
        ...(event.durationSec ? { durationSec: event.durationSec } : {}),
        ...(terminal ? { endedAt: new Date() } : {}),
      },
    });

    // Campaign outcome reconciliation.
    if (terminal) {
      const { resolveCampaignContactFromCall } = await import('@/lib/jobs/handlers');
      await resolveCampaignContactFromCall({
        campaignId: existing.campaignId,
        providerCallSid: existing.providerCallSid,
        status: event.status ?? existing.status,
        durationSec: event.durationSec ?? existing.durationSec ?? null,
      });

      // Workflow triggers: CALL_COMPLETED / CALL_MISSED.
      try {
        const { triggerWorkflows } = await import('@/lib/workflows/engine');
        const trigger = event.status === 'COMPLETED' ? 'CALL_COMPLETED' : 'CALL_MISSED';
        await triggerWorkflows({
          workspaceId: existing.workspaceId,
          trigger,
          entityType: 'Call',
          entityId: existing.id,
          call: {
            outcome: existing.outcome ?? event.status,
            direction: existing.direction,
            durationSec: event.durationSec ?? existing.durationSec,
            contactId: existing.contactId,
            leadId: null,
          },
          lead: undefined,
        });
      } catch (e) {
        console.error('Workflow trigger failed:', e);
      }
    }

    if (event.recordingUrl) {
      const existingRecording = await prisma.callRecording.findFirst({
        where: { callId: existing.id, url: event.recordingUrl },
      });
      if (!existingRecording) {
        await prisma.callRecording.create({
          data: {
            callId: existing.id,
            url: event.recordingUrl,
            durationSec: event.durationSec,
          },
        });
      }
    }

    // Conversation intelligence: process when a call ends with material.
    if (terminal) {
      try {
        const { enqueueIntelligenceProcessing } = await import('@/lib/jobs/handlers');
        await enqueueIntelligenceProcessing(existing.id);
      } catch (e) {
        console.error('Intelligence enqueue failed:', e);
      }
    }

    // Timeline event — deduped at the DB level via the (callId, type,
    // dedupeKey) unique constraint; Twilio retries aggressively.
    if (changed || event.recordingUrl) {
      const dedupeKey = createHash('sha256')
        .update(JSON.stringify([event.status ?? null, event.durationSec ?? null, !!event.recordingUrl]))
        .digest('hex')
        .slice(0, 32);
      try {
        await prisma.callEvent.create({
          data: {
            callId: existing.id,
            type: 'STATUS',
            dedupeKey,
            payload: {
              status: event.status ?? null,
              durationSec: event.durationSec ?? null,
              recording: !!event.recordingUrl,
            },
          },
        });
      } catch (e) {
        // P2002 = unique violation on (callId, type, dedupeKey): a retry of
        // an event we already recorded. Safe to ignore.
        if (
          typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          (e as { code?: string }).code === 'P2002'
        ) {
          // Duplicate — already logged this transition.
        } else {
          throw e;
        }
      }
    }

    return new NextResponse('Status updated', { status: 200 });
  } catch (error: any) {
    console.error(`Error updating call status for SID ${event.providerCallSid}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
