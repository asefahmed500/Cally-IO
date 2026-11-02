import { NextRequest, NextResponse } from 'next/server';
import { twiml } from 'twilio';
import { prisma } from '@/lib/prisma';
import { twilioProvider } from '@/lib/telephony/twilio';
import { interpretSpokenResponse } from '@/ai/flows/interpret-spoken-response';

// Twilio gather webhook — interprets the lead's speech via the LangGraph
// calling-agent and returns the closing TwiML.
export async function POST(request: NextRequest) {
  const formData = await request.formData();

  // Webhook verification (opt-in via TWILIO_VALIDATE_WEBHOOKS=true).
  const signature = request.headers.get('x-twilio-signature');
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });
  const valid = await twilioProvider.verifyWebhook(request.url, params, signature);
  if (!valid) {
    return new NextResponse('Invalid webhook signature', { status: 403 });
  }

  const event = twilioProvider.parseWebhook(formData);
  const voiceResponse = new twiml.VoiceResponse();

  try {
    let finalMessage =
      "I'm sorry, I didn't quite catch that. We will have someone from our team reach out. Goodbye.";

    if (event.speechResult) {
      const interpretation = await interpretSpokenResponse(event.speechResult);
      finalMessage = interpretation.finalMessage;

      if (event.providerCallSid) {
        try {
          const call = await prisma.call.findUnique({
            where: { providerCallSid: event.providerCallSid },
            select: { id: true },
          });
          if (call) {
            await prisma.$transaction([
              prisma.call.update({
                where: { id: call.id },
                data: {
                  notes: `[${interpretation.intent}] ${interpretation.summary}`,
                },
              }),
              prisma.callEvent.create({
                data: {
                  callId: call.id,
                  type: 'GATHER_INTERPRETED',
                  payload: {
                    intent: interpretation.intent,
                    summary: interpretation.summary,
                    confidence: event.confidence ?? null,
                  },
                },
              }),
            ]);
          }
        } catch (e) {
          console.error('Error recording AI interpretation:', e);
          // Don't let logging failure break the call flow.
        }
      }
    }

    voiceResponse.say({ voice: 'alice' }, finalMessage);
  } catch (e) {
    console.error('Error during AI response interpretation:', e);
    voiceResponse.say(
      { voice: 'alice' },
      "I'm sorry, an error occurred with our system. A specialist will reach out shortly. Goodbye."
    );
  }

  voiceResponse.hangup();

  return new NextResponse(voiceResponse.toString(), {
    headers: { 'Content-Type': 'application/xml' },
  });
}
