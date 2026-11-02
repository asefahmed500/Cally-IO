import twilio from 'twilio';
import {
  TelephonyProviderAdapter,
  TelephonyEvent,
  InitiateCallInput,
  mapProviderStatus,
} from './types';
import type { CallStatus } from '@prisma/client';

const CALL_STATUS_TO_TWILIO: Partial<Record<CallStatus, string>> = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  NO_ANSWER: 'no-answer',
  BUSY: 'busy',
  CANCELLED: 'canceled',
};

export class TwilioProvider implements TelephonyProviderAdapter {
  readonly name = 'TWILIO';

  private client() {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio is not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
    }
    return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  isConfigured(): boolean {
    return (
      !!process.env.TWILIO_ACCOUNT_SID &&
      !!process.env.TWILIO_AUTH_TOKEN &&
      !!process.env.TWILIO_PHONE_NUMBER
    );
  }

  async initiateCall(input: InitiateCallInput): Promise<{ providerCallSid: string }> {
    const client = this.client();
    const call = await client.calls.create({
      to: input.to,
      from: input.from,
      url: input.webhookUrl,
      statusCallback: input.statusCallbackUrl,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });
    return { providerCallSid: call.sid };
  }

  async verifyWebhook(
    url: string,
    params: Record<string, string>,
    signature: string | null
  ): Promise<boolean> {
    // Fail closed by default: webhook signatures are validated whenever an
    // auth token is present. Set TWILIO_VALIDATE_WEBHOOKS=false ONLY for
    // local testing (e.g. ngrok without a stable URL).
    if (process.env.TWILIO_VALIDATE_WEBHOOKS === 'false') {
      return true;
    }
    if (!signature) return false;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return false;

    try {
      return twilio.validateRequest(authToken, signature, url, params);
    } catch (error) {
      console.error('Twilio webhook validation error:', error);
      return false;
    }
  }

  parseWebhook(formData: FormData): TelephonyEvent {
    const get = (key: string) => (formData.get(key) as string) ?? undefined;
    const callSid = get('CallSid') ?? '';

    // Speech gathering (handle-response) payloads include SpeechResult.
    const speechResult = get('SpeechResult');
    if (speechResult !== undefined) {
      return {
        providerCallSid: callSid,
        type: 'GATHER_RESPONSE',
        speechResult,
        confidence: parseFloat(get('Confidence') ?? '0'),
      };
    }

    // Inbound call webhooks include From/To and CallStatus=ringing without a CallDuration.
    const from = get('From');
    const to = get('To');
    const status = mapProviderStatus(get('CallStatus'));
    const duration = get('CallDuration');
    const recordingUrl = get('RecordingUrl');

    if (from && to && !duration) {
      return { providerCallSid: callSid, type: 'INBOUND_CALL', from, to, status: 'RINGING' };
    }

    return {
      providerCallSid: callSid,
      type: 'STATUS',
      status,
      durationSec: duration ? parseInt(duration, 10) : undefined,
      recordingUrl,
    };
  }

  /** TwiML helper — builds the outbound call flow for a lead. */
  buildOutboundTwiML(input: {
    leadName: string;
    script: string;
    handleResponseUrl: string;
    disclosureEnabled?: boolean;
  }): string {
    const twiml = new twilio.twiml.VoiceResponse();
    if (input.disclosureEnabled) {
      twiml.say(
        { voice: 'alice' },
        'This call may be handled by an automated assistant.'
      );
    }
    twiml.say({ voice: 'alice' }, `Hello ${input.leadName}.`);
    twiml.pause({ length: 1 });
    twiml.say({ voice: 'alice' }, input.script);
    twiml.pause({ length: 1 });

    const gather = twiml.gather({
      input: ['speech'],
      action: input.handleResponseUrl,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
    });
    gather.say({ voice: 'alice' }, 'Are you interested in learning more? Please say yes or no.');

    twiml.say(
      { voice: 'alice' },
      "We didn't receive a response. We'll have someone reach out. Goodbye."
    );
    twiml.hangup();
    return twiml.toString();
  }

  buildErrorTwiML(): string {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, "I'm sorry, an error occurred with our system. Goodbye.");
    twiml.hangup();
    return twiml.toString();
  }

  /** Terminal statuses that imply the call has ended. */
  static isTerminal(status?: CallStatus): boolean {
    return (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'NO_ANSWER' ||
      status === 'BUSY' ||
      status === 'CANCELLED'
    );
  }
}

export const twilioProvider = new TwilioProvider();
