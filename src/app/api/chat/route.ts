import {runAssistant, AssistantInputSchema} from '@/ai/flows/assistant-flow';
import {NextResponse} from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const input = AssistantInputSchema.parse(body);

  const stream = await runAssistant(input);

  return new NextResponse(stream.toReadableStream(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
