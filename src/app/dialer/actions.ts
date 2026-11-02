'use server';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';

/**
 * Manual dialing: places an outbound call to any E.164 number via the
 * AI flow (TwiML script + gather). Human-bridge dialing (agent's phone
 * joined first) arrives with Live Operations in Phase 6.
 */
export async function dialNumber(
  number: string,
  contactId?: string
): Promise<{ success?: boolean; callSid?: string; error?: string }> {
  const ctx = await requireCapability('calls.initiate');

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return { error: 'Twilio is not configured. Add TWILIO_* keys in Settings → Integrations.' };
  }
  if (!baseUrl) {
    return { error: "NEXT_PUBLIC_BASE_URL is not configured — Twilio cannot reach the webhooks." };
  }
  if (!/^\+?[1-9]\d{6,14}$/.test(number.replace(/[\s\-()]/g, ''))) {
    return { error: 'Enter a valid phone number in international format, e.g. +15551234567.' };
  }

  const cleanNumber = number.replace(/[\s\-()]/g, '');

  try {
    const { twilioProvider } = await import('@/lib/telephony/twilio');
    if (!twilioProvider.isConfigured()) {
      return { error: 'Twilio is not configured.' };
    }

    // Link to an existing contact when the number matches (dedupe-aware).
    const contact = contactId
      ? await prisma.contact.findFirst({
          where: { id: contactId, workspaceId: ctx.workspaceId, deletedAt: null },
        })
      : await prisma.contact.findFirst({
          where: { workspaceId: ctx.workspaceId, deletedAt: null, phone: cleanNumber },
        });

    const webhookUrl = new URL(
      `/api/twilio/call?to=${encodeURIComponent(cleanNumber)}`,
      baseUrl
    );
    const statusCallbackUrl = new URL('/api/twilio/status', baseUrl);

    const { providerCallSid } = await twilioProvider.initiateCall({
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      webhookUrl: webhookUrl.toString(),
      statusCallbackUrl: statusCallbackUrl.toString(),
    });

    await prisma.call.create({
      data: {
        workspaceId: ctx.workspaceId,
        direction: 'OUTBOUND',
        status: 'QUEUED',
        providerCallSid,
        toNumber: cleanNumber,
        contactId: contact?.id ?? null,
        initiatedById: ctx.user.$id,
        assignedUserId: ctx.user.$id,
      },
    });

    revalidatePath('/calls');
    revalidatePath('/dialer');
    return { success: true, callSid: providerCallSid };
  } catch (e: any) {
    console.error('Dialer call failed:', e);
    if (e.code === 21211) {
      return { error: `Invalid phone number: ${cleanNumber}. Check the format.` };
    }
    return { error: 'Failed to place the call. Please try again.' };
  }
}
