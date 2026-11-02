import { runChatStream } from '@/ai/graphs/chat-graph';
import { getLoggedInUser } from '@/lib/auth';
import { getConversationHistory, saveConversationHistory, type ChatMessage } from '@/lib/conversation';
import { isAIConfigured } from '@/ai/models';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const ChatRequestSchema = z.object({
  prompt: z.string().min(1).max(8000),
  image: z.string().max(2_000_000).optional(),
});

type ChatMessageWithId = ChatMessage;

function createChatStream(
  stream: AsyncGenerator<string>,
  userId: string,
  fullHistory: ChatMessageWithId[]
) {
  const textEncoder = new TextEncoder();
  let fullResponse = '';

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          fullResponse += chunk;
          controller.enqueue(textEncoder.encode(chunk));
        }

        const modelMessage: ChatMessageWithId = {
          role: 'model',
          content: fullResponse,
          id: randomUUID(),
        };
        await saveConversationHistory(userId, [...fullHistory, modelMessage]);
      } catch (e) {
        console.error('Error during chat stream or history update:', e);
        controller.enqueue(textEncoder.encode('\n\n[An error occurred. Please try again.]'));
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const request = await req.json();

    const validatedRequest = ChatRequestSchema.safeParse(request);
    if (!validatedRequest.success) {
      return new Response(JSON.stringify(validatedRequest.error.format()), { status: 400 });
    }

    const user = await getLoggedInUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const limit = await rateLimit(user.$id, 'aiChat');
    if (!limit.ok) {
      return tooManyRequests(limit);
    }

    if (!isAIConfigured()) {
      return new Response(
        JSON.stringify({
          error: 'AI Not Configured',
          message: 'The AI assistant is not configured. Please set the GOOGLE_API_KEY environment variable.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, image } = validatedRequest.data;

    // 1. Load existing conversation history.
    const history = await getConversationHistory(user.$id);

    // 2. Construct the user's message and save it *before* calling the AI,
    //    so it is never lost even if the AI call fails.
    const userMessage: ChatMessageWithId = {
      role: 'user',
      content: prompt,
      id: randomUUID(),
      image,
    };
    const historyWithUserMessage = [...history, userMessage];
    await saveConversationHistory(user.$id, historyWithUserMessage);

    // 3. Run the LangGraph agent and stream the response to the client.
    // Workspace is best-effort — the assistant also works without one.
    let workspaceId: string | undefined;
    try {
      const { requireWorkspace } = await import('@/lib/tenant');
      workspaceId = (await requireWorkspace()).workspaceId;
    } catch {
      workspaceId = undefined;
    }

    const { stream } = await runChatStream({
      history,
      prompt,
      image,
      userId: user.$id,
      workspaceId,
    });

    return new Response(createChatStream(stream, user.$id, historyWithUserMessage), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return new Response('Invalid JSON in request body.', { status: 400 });
    }
    console.error('An unexpected error occurred in chat API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'An internal server error occurred. Please check the server logs for more details.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
