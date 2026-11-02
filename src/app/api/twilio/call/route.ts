import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { twilioProvider } from '@/lib/telephony/twilio';
import { generateScript } from '@/ai/flows/generate-call-script';
import { getWorkspaceSettings } from '@/lib/settings';

// Called by Twilio when it initiates a call — returns TwiML.
// Modes: ?leadId=<id> (lead flow) or ?to=<number> (dialer flow).
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leadId = searchParams.get('leadId');
  const dialerTo = searchParams.get('to');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!leadId && !dialerTo) {
    return new NextResponse('Missing leadId or to parameter', { status: 400 });
  }
  if (!baseUrl) {
    console.error('NEXT_PUBLIC_BASE_URL is not configured.');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  // Webhook verification — fail closed unless explicitly disabled
  // (TWILIO_VALIDATE_WEBHOOKS=false for local testing only).
  const signature = request.headers.get('x-twilio-signature');
  const params: Record<string, string> = {};
  let formParsed = true;
  try {
    const form = await request.formData();
    form.forEach((value, key) => {
      params[key] = String(value);
    });
  } catch {
    formParsed = false;
  }
  // An unparseable body means there is no valid signature to check.
  const valid = await twilioProvider.verifyWebhook(request.url, params, formParsed ? signature : null);
  if (!valid) {
    return new NextResponse('Invalid webhook signature', { status: 403 });
  }

  try {
    let twiml: string;
    let timelineCallId: string | null = null;

    if (leadId) {
      // ── Lead flow: personalized AI script ──
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { contact: true },
      });
      if (!lead) {
        return new NextResponse('Lead not found', { status: 404 });
      }

      const settings = await getWorkspaceSettings(lead.workspaceId);

      const personalizedScript = await generateScript({
        leadName: lead.contact.name,
        leadStatus: lead.stage,
        leadScore: lead.score,
        company: lead.contact.company ?? undefined,
        jobTitle: lead.contact.jobTitle ?? undefined,
        scriptTemplate: settings.scriptTemplate,
        workspaceId: lead.workspaceId,
      });

      twiml = twilioProvider.buildOutboundTwiML({
        leadName: lead.contact.name,
        script: personalizedScript,
        handleResponseUrl: `${baseUrl}/api/twilio/handle-response`,
        disclosureEnabled: true,
      });

      const recentCall = await prisma.call.findFirst({
        where: { contactId: lead.contactId, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      timelineCallId = recentCall?.id ?? null;
    } else {
      // ── Dialer flow: generic AI greeting + gather ──
      const recentCall = await prisma.call.findFirst({
        where: { toNumber: dialerTo!, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, workspaceId: true },
      });
      const settings = recentCall
        ? await getWorkspaceSettings(recentCall.workspaceId)
        : (await import('@/lib/settings')).defaultSettings;

      twiml = twilioProvider.buildOutboundTwiML({
        leadName: 'there',
        script: `Hello, this is an AI assistant calling. ${settings.scriptTemplate.split('\n')[0] ?? ''}`,
        handleResponseUrl: `${baseUrl}/api/twilio/handle-response`,
        disclosureEnabled: true,
      });

      timelineCallId = recentCall?.id ?? null;
    }

    if (timelineCallId) {
      await prisma.callEvent.create({
        data: {
          callId: timelineCallId,
          type: 'DIAL_SCRIPT_SERVED',
          payload: { leadId: leadId ?? null, to: dialerTo },
        },
      });
    }

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (error: any) {
    console.error('Error generating TwiML:', error);
    return new NextResponse(twilioProvider.buildErrorTwiML(), {
      status: 500,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
