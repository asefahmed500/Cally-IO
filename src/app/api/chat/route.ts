import { conversationalRagChat } from '@/ai/flows/conversational-chat';
import { streamFlow } from '@genkit-ai/next/server';
import { z } from 'zod';

const ChatRequestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.string(),
    })
  ),
  prompt: z.string(),
});

export async function POST(req: Request) {
  const request = await req.json();

  const validatedRequest = ChatRequestSchema.safeParse(request);
  if (!validatedRequest.success) {
    return new Response('Invalid request', { status: 400 });
  }

  return streamFlow(conversationalRagChat, validatedRequest.data);
}
