/**
 * Conversation intelligence pipeline: fetches the Twilio recording
 * (authenticated), transcribes it with Gemini audio understanding, then runs
 * a structured analysis (summary, intent, sentiment, outcome, action items).
 * Free-tier friendly: single Gemini Flash call per stage.
 */

import { prisma } from '@/lib/prisma';

export type TranscriptResult = {
  text: string;
  segments: { speaker: string; text: string; offsetSec?: number }[];
};

export type CallAnalysis = {
  summary: string;
  intent: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  outcome: string;
  qualificationScore: number;
  actionItems: string[];
  followUpRecommended: boolean;
  escalated: boolean;
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function geminiGenerate(body: object): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not configured.');

  const response = await fetch(`${GEMINI_BASE}/gemini-2.5-flash:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty Gemini response.');
  return content;
}

/** Downloads a Twilio recording using basic auth and returns base64 + mime. */
export async function fetchTwilioRecording(recordingUrl: string): Promise<{
  base64: string;
  mimeType: string;
}> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials required to fetch recordings.');
  }
  // Twilio serves .wav/.mp3; default to wav for Gemini.
  const url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.wav`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!response.ok) {
    throw new Error(`Recording fetch failed: ${response.status}. Recordings may not be ready yet.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = recordingUrl.endsWith('.mp3') ? 'audio/mp3' : 'audio/wav';
  return { base64: buffer.toString('base64'), mimeType };
}

/** Transcribes call audio via Gemini. */
export async function transcribeCallAudio(audioBase64: string, mimeType: string): Promise<TranscriptResult> {
  const raw = await geminiGenerate({
    contents: [
      {
        parts: [
          {
            text: 'Transcribe this phone call verbatim. Return ONLY JSON: {"segments": [{"speaker": "Agent" | "Customer", "text": "..."}], "text": "<full transcript>"}. Speaker labels alternate as the audio suggests.',
          },
          { inline_data: { mime_type: mimeType, data: audioBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });

  try {
    const parsed = JSON.parse(raw);
    return {
      text: parsed.text ?? (parsed.segments ?? []).map((s: any) => `${s.speaker}: ${s.text}`).join('\n'),
      segments: Array.isArray(parsed.segments) ? parsed.segments : [],
    };
  } catch {
    return { text: raw, segments: [] };
  }
}

/** Runs the structured post-call analysis. */
export async function analyzeCallTranscript(input: {
  transcript: string;
  leadNotes?: string | null;
  aiIntent?: string | null;
  contactName: string;
  direction: string;
}): Promise<CallAnalysis> {
  const raw = await geminiGenerate({
    contents: [
      {
        parts: [
          {
            text: `You are a call-center quality analyst. Analyze this ${input.direction} call with ${input.contactName}.

Transcript:
${input.transcript.slice(0, 12000)}

${input.aiIntent ? `Early speech-intent reading from the live call: ${input.aiIntent}` : ''}
${input.leadNotes ? `Agent notes: ${input.leadNotes}` : ''}

Return ONLY JSON with exactly these fields:
{
  "summary": "2-3 sentence summary of the conversation",
  "intent": "the customer's primary intent in a few words",
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "outcome": "CONNECTED" | "VOICEMAIL" | "NOT_INTERESTED" | "CALLBACK_REQUESTED" | "WRONG_NUMBER" | "DO_NOT_CALL",
  "qualificationScore": <0-100 integer>,
  "actionItems": ["actionable item", "..."],
  "followUpRecommended": true | false,
  "escalated": true | false
}
These are AI-generated assessments, not verified facts.`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });

  const parsed = JSON.parse(raw);
  return {
    summary: String(parsed.summary ?? ''),
    intent: String(parsed.intent ?? 'Unknown'),
    sentiment: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(parsed.sentiment)
      ? parsed.sentiment
      : 'NEUTRAL',
    outcome: String(parsed.outcome ?? 'CONNECTED'),
    qualificationScore: Math.max(0, Math.min(100, Number(parsed.qualificationScore ?? 50))),
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 8) : [],
    followUpRecommended: !!parsed.followUpRecommended,
    escalated: !!parsed.escalated,
  };
}

/** Full pipeline for one call. Throws on hard failures (caller handles retry). */
export async function processCallIntelligence(input: {
  callId: string;
  recordingUrl?: string | null;
  notes?: string | null;
  contactName: string;
  direction: string;
  aiIntent?: string | null;
}): Promise<{ transcriptCreated: boolean; summaryCreated: boolean }> {
  let transcriptCreated = false;
  let transcriptText = '';

  if (input.recordingUrl) {
    const recording = await fetchTwilioRecording(input.recordingUrl);
    await prisma.transcript.upsert({
      where: { callId: input.callId },
      update: { status: 'PROCESSING', provider: 'gemini' },
      create: {
        callId: input.callId,
        status: 'PROCESSING',
        provider: 'gemini',
      },
    });
    const transcript = await transcribeCallAudio(recording.base64, recording.mimeType);
    await prisma.transcript.upsert({
      where: { callId: input.callId },
      update: {
        status: 'READY',
        text: transcript.text,
        segments: transcript.segments as unknown as object[],
        language: 'en',
      },
      create: {
        callId: input.callId,
        status: 'READY',
        provider: 'gemini',
        text: transcript.text,
        segments: transcript.segments as unknown as object[],
        language: 'en',
      },
    });
    transcriptCreated = true;
    transcriptText = transcript.text;

    // Usage metering: ~1 minute of transcription per recording segment.
    const minutes = Math.max(1, Math.ceil(transcript.text.split(/\s+/).length / 150));
    await incrementUsage(input.callId, 'TRANSCRIPTION_MINUTES', minutes);
  }

  // Summaries can also run from gather notes when no recording exists.
  const analysisSource = transcriptText || input.notes;
  if (!analysisSource) {
    return { transcriptCreated, summaryCreated: false };
  }

  const analysis = await analyzeCallTranscript({
    transcript: analysisSource,
    leadNotes: input.notes,
    aiIntent: input.aiIntent,
    contactName: input.contactName,
    direction: input.direction,
  });

  await prisma.conversationSummary.upsert({
    where: { callId: input.callId },
    update: {
      summary: analysis.summary,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      outcome: analysis.outcome,
      qualificationScore: analysis.qualificationScore,
      actionItems: analysis.actionItems as unknown as object[],
      followUpRecommended: analysis.followUpRecommended,
      escalated: analysis.escalated,
      processingStatus: 'READY',
      model: 'gemini-2.5-flash',
    },
    create: {
      callId: input.callId,
      summary: analysis.summary,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      outcome: analysis.outcome,
      qualificationScore: analysis.qualificationScore,
      actionItems: analysis.actionItems as unknown as object[],
      followUpRecommended: analysis.followUpRecommended,
      escalated: analysis.escalated,
      processingStatus: 'READY',
      model: 'gemini-2.5-flash',
    },
  });

  return { transcriptCreated, summaryCreated: true };
}

async function incrementUsage(callId: string, metric: 'TRANSCRIPTION_MINUTES' | 'AI_MINUTES', quantity: number) {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { workspaceId: true, durationSec: true },
    });
    if (!call) return;
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    const qty = metric === 'AI_MINUTES' ? Math.max(1, Math.ceil((call.durationSec ?? 60) / 60)) : quantity;

    await prisma.usageRecord.upsert({
      where: {
        workspaceId_metric_periodStart: {
          workspaceId: call.workspaceId,
          metric,
          periodStart,
        },
      },
      update: { quantity: { increment: qty } },
      create: { workspaceId: call.workspaceId, metric, quantity: qty, periodStart, periodEnd },
    });
  } catch (error) {
    console.error('Usage metering failed:', error);
  }
}
