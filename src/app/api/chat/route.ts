import { streamAssistantResponse, AssistantInputSchema } from '@/ai/flows/rag-retrieval-flow';
import { getLoggedInUser } from '@/lib/auth';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Helper to convert an async generator to a ReadableStream
function AssistantStream(readable: ReadableStream<any>) {
    const stream = new ReadableStream({
        async start(controller) {
            const reader = readable.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                }
            } catch (err) {
                controller.error(err);
            } finally {
                controller.close();
            }
        }
    });

    return stream;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getLoggedInUser();
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const parsedInput = AssistantInputSchema.safeParse({ ...body, userId: user.$id });

    if (!parsedInput.success) {
        return new Response(JSON.stringify(parsedInput.error), { status: 400 });
    }
    
    const stream = streamAssistantResponse(parsedInput.data);
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        }
    });
    
    return new Response(readableStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error in chat stream:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
