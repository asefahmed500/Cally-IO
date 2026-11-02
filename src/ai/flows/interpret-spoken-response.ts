/**
 * LangGraph calling-agent: interprets a lead's spoken response on a Twilio
 * call, classifies intent, and produces the closing message.
 *
 * Graph: START -> classify -> (positive | negative | neutral | escalate) -> END
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { getChatModel, isAIConfigured } from '@/ai/models';

export type CallIntent = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'ESCALATE';

export type InterpretSpokenResponseOutput = {
  intent: CallIntent;
  summary: string;
  finalMessage: string;
};

const CallAgentState = Annotation.Root({
  transcript: Annotation<string>(),
  intent: Annotation<CallIntent>(),
  summary: Annotation<string>(),
  finalMessage: Annotation<string>(),
});

type Classification = { intent: CallIntent; summary: string };

async function classifyNode(state: typeof CallAgentState.State) {
  const model = getChatModel();

  const prompt = `You are an expert at understanding sales call transcripts. Analyze the following spoken response from a lead and determine their intent.

**Transcript:**
"${state.transcript}"

**Instructions:**
1. Classify the lead's intent into one of four categories:
   - POSITIVE: clear interest (e.g., "yes", "that sounds great", "I'd like to learn more")
   - NEGATIVE: clear disinterest (e.g., "no", "not interested", "remove me from your list")
   - NEUTRAL: non-committal or asks for more information (e.g., "maybe", "send an email")
   - ESCALATE: confused, angry, or the response is unclear/garbled
2. Provide a one-sentence summary of what the lead said.

Respond ONLY with JSON in this exact format:
{"intent": "POSITIVE|NEGATIVE|NEUTRAL|ESCALATE", "summary": "<one sentence>"}`;

  const response = await model.invoke(prompt);
  const raw = typeof response.content === 'string' ? response.content : String(response.content);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Classification;
    const intent: CallIntent = ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'ESCALATE'].includes(parsed.intent)
      ? parsed.intent
      : 'NEUTRAL';
    return { intent, summary: parsed.summary || 'The lead responded to the call.' };
  } catch {
    return { intent: 'NEUTRAL' as CallIntent, summary: 'Could not clearly interpret the response.' };
  }
}

async function respondNode(state: typeof CallAgentState.State) {
  const messagesByIntent: Record<CallIntent, string> = {
    POSITIVE: "That's great to hear. A specialist will be in touch with you shortly. Thank you for your time. Goodbye.",
    NEGATIVE: 'I understand. Thank you for your time. Goodbye.',
    NEUTRAL: 'No problem at all. We will send you some more information by email. Thank you for your time. Goodbye.',
    ESCALATE: "I'm sorry about the confusion. A member of our team will call you back shortly. Thank you. Goodbye.",
  };
  return { finalMessage: messagesByIntent[state.intent] };
}

function routeByIntent(state: typeof CallAgentState.State): CallIntent {
  return state.intent;
}

const callAgentGraph = new StateGraph(CallAgentState)
  .addNode('classify', classifyNode)
  .addNode('respond', respondNode)
  .addEdge(START, 'classify')
  .addConditionalEdges('classify', routeByIntent, {
    POSITIVE: 'respond',
    NEGATIVE: 'respond',
    NEUTRAL: 'respond',
    ESCALATE: 'respond',
  })
  .addEdge('respond', END)
  .compile();

export async function interpretSpokenResponse(transcript: string): Promise<InterpretSpokenResponseOutput> {
  if (!isAIConfigured()) {
    return {
      intent: 'ESCALATE',
      summary: 'AI is not configured.',
      finalMessage:
        "I'm sorry, an error occurred with our system. A specialist will reach out shortly. Goodbye.",
    };
  }

  const result = await callAgentGraph.invoke({ transcript });
  return {
    intent: result.intent,
    summary: result.summary,
    finalMessage: result.finalMessage,
  };
}
