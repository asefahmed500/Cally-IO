import type { CallStatus } from '@prisma/client';

/**
 * Provider-independent telephony abstraction — see ARCHITECTURE.md §5.
 * A provider implements outbound dialing, webhook verification, event
 * parsing, and TwiML generation. Twilio is the first implementation.
 */

export type TelephonyEvent = {
  providerCallSid: string;
  type:
    | 'STATUS'
    | 'GATHER_RESPONSE'
    | 'INBOUND_CALL';
  status?: CallStatus;
  durationSec?: number;
  recordingUrl?: string;
  speechResult?: string;
  confidence?: number;
  from?: string;
  to?: string;
};

export type InitiateCallInput = {
  to: string;
  from: string;
  webhookUrl: string;
  statusCallbackUrl: string;
};

export interface TelephonyProviderAdapter {
  readonly name: string;
  isConfigured(): boolean;
  initiateCall(input: InitiateCallInput): Promise<{ providerCallSid: string }>;
  /** Returns true when the webhook is authentic. No-ops (true) when validation is disabled. */
  verifyWebhook(url: string, params: Record<string, string>, signature: string | null): Promise<boolean>;
  /** Parses form-encoded webhook payloads into a normalized event. */
  parseWebhook(formData: FormData): TelephonyEvent;
}

/** Maps provider status strings onto the internal CallStatus enum. */
export function mapProviderStatus(status: string | null | undefined): CallStatus | undefined {
  if (!status) return undefined;
  const map: Record<string, CallStatus> = {
    queued: 'QUEUED',
    ringing: 'RINGING',
    'in-progress': 'IN_PROGRESS',
    answered: 'ANSWERED',
    completed: 'COMPLETED',
    busy: 'BUSY',
    failed: 'FAILED',
    'no-answer': 'NO_ANSWER',
    canceled: 'CANCELLED',
    censored: 'FAILED',
  };
  return map[status.toLowerCase()];
}
