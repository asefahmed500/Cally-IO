import { conversationalRagChat, type Message } from '@/ai/flows/conversational-chat';
import { getLoggedInUser } from '@/lib/auth';
import { getConversation, createConversation, updateConversation } from '@/lib/conversation';
import { z } from 'zod';
import { Part } from 'genkit/ai';

const ChatRequestSchema = z.object({
  prompt: z.string(),
  image: z.string().optional(),
});

// A custom ReadableStream that wraps the Genkit stream and handles database updates.
function createChatStream(flowPromise: Promise<any>, userId: string, initialHistory: Message[]) {
  const textEncoder = new TextEncoder();
  let fullResponse = '';

  return new ReadableStream({
    async start(controller) {
      const { stream, response } = await flowPromise;

      for await (const chunk of stream) {
        fullResponse += chunk;
        controller.enqueue(textEncoder.encode(chunk));
      }
      
      // After the stream is finished, save the final model response.
      const modelMessage: Message = { role: 'model', content: fullResponse, id: '' };
      const finalHistory = [...initialHistory, modelMessage];
      
      try {
        const conversation = await getConversation(userId);
        if (conversation) {
            await updateConversation(conversation.docId, finalHistory);
        }
      } catch (e) {
        console.error("Failed to save model's response to history:", e);
      }

      controller.close();
    },
  });
}

export async function POST(req: Request) {
  const request = await req.json();

  const validatedRequest = ChatRequestSchema.safeParse(request);
  if (!validatedRequest.success) {
    return new Response('Invalid request', { status: 400 });
  }

  const user = await getLoggedInUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { prompt, image } = validatedRequest.data;

  // 1. Get existing conversation or create a new one.
  let conversation = await getConversation(user.$id);
  if (!conversation) {
    conversation = await createConversation(user.$id);
  }

  // 2. Construct the user's message and add it to the history.
  const userMessageContent: Part[] = [{ text: prompt }];
  if (image) {
    userMessageContent.unshift({ media: { url: image } });
  }

  const userMessage: Message = {
    role: 'user',
    content: userMessageContent as any, // Cast to any to satisfy Zod schema on backend
    id: '', // ID is client-side only
    image,
  };

  const historyWithUserMessage = [...conversation.history, userMessage];
  
  // 3. Save the updated history (with the new user message) to the database.
  await updateConversation(conversation.docId, historyWithUserMessage);

  // 4. Call the AI flow with the complete history.
  const flowPromise = conversationalRagChat({
    history: historyWithUserMessage,
    prompt: prompt,
    image: image,
  });

  // 5. Create and return the custom stream.
  const stream = createChatStream(flowPromise, user.$id, historyWithUserMessage);
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
