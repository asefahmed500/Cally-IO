import { assistantFlow } from '@/ai/flows/assistant-flow';
import { getLoggedInUser } from '@/lib/auth';
import { StreamingTextResponse, streamToResponse } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getLoggedInUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { question, history } = await req.json();

    const stream = await assistantFlow.stream({
      question,
      history,
      userId: user.$id,
    });
    
    // Use a TransformStream to format the data as it comes in
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // The chunk from Genkit flow is already a stringified JSON
        // We just need to push it along
        controller.enqueue(chunk);
      },
    });

    // Pipe the Genkit stream through our transformation
    stream.pipeThrough(transformStream);
    
    // Return the response, but now it's a stream of JSON strings
    return new StreamingTextResponse(transformStream.readable);

  } catch (error: any) {
    console.error('[Chat API Error]', error);
    return new NextResponse(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
