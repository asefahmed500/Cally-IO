'use server';
import { conversationalRagChat, type Message } from '@/ai/flows/conversational-chat';
import { getLoggedInUser } from '@/lib/auth';
import { getConversation, createConversation, updateConversation } from '@/lib/conversation';
import { z } from 'zod';
import { type Part } from 'genkit/ai';
import { v4 as uuidv4 } from 'uuid';

const ChatRequestSchema = z.object({
  prompt: z.string(),
  image: z.string().optional(),
});

// A custom ReadableStream that wraps the Genkit stream and handles database updates.
function createChatStream(flowPromise: Promise<any>, userId: string, fullHistory: Message[]) {
  const textEncoder = new TextEncoder();
  let fullResponse = '';
  let finalHistory: Message[] = [];

  return new ReadableStream({
    async start(controller) {
      try {
        const { stream } = await flowPromise;

        for await (const chunk of stream) {
          fullResponse += chunk;
          controller.enqueue(textEncoder.encode(chunk));
        }

        const modelMessage: Message = { role: 'model', content: fullResponse, id: uuidv4() };
        finalHistory = [...fullHistory, modelMessage];
      
        const conversation = await getConversation(userId);
        if (conversation) {
            await updateConversation(conversation.docId, finalHistory);
        } else {
            // This case should ideally not happen if createConversation is called first.
            await createConversation(userId, finalHistory);
        }

      } catch (e) {
        console.error("Error during chat stream or history update:", e);
        const errorText = "\n\n[An error occurred. Please try again.]";
        controller.enqueue(textEncoder.encode(errorText));
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  const request = await req.json();

  const validatedRequest = ChatRequestSchema.safeParse(request);
  if (!validatedRequest.success) {
    return new Response(JSON.stringify(validatedRequest.error.format()), { status: 400 });
  }

  const user = await getLoggedInUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { prompt, image } = validatedRequest.data;

  // 1. Get existing conversation or create a new one if it's the first message.
  let conversation = await getConversation(user.$id);
  if (!conversation) {
    conversation = await createConversation(user.$id);
  }

  // 2. Construct the user's message and add it to the history.
  const userMessage: Message = {
    role: 'user',
    content: prompt,
    id: uuidv4(),
    image,
  };

  const historyWithUserMessage = [...conversation.history, userMessage];
  
  // 3. Save the updated history (with the new user message) *before* calling the AI.
  // This ensures the user's message is never lost, even if the AI fails.
  await updateConversation(conversation.docId, historyWithUserMessage);

  // 4. Prepare the input for the AI flow.
  // The AI needs a slightly different format for multi-modal prompts.
  const aiInputHistory = conversation.history.map(msg => ({
      role: msg.role,
      content: msg.content
  }));

  const userPromptContent: Part[] = [{ text: prompt }];
    if (image) {
      userPromptContent.unshift({ media: { url: image } });
    }

  const aiInputWithUserMessage = [
      ...aiInputHistory,
      {
        role: 'user',
        content: userPromptContent as any,
      },
  ];

  const flowPromise = conversationalRagChat({
    history: aiInputWithUserMessage, // Pass the formatted history
    prompt: prompt, // Pass the raw prompt for RAG
    image: image,
  });

  // 5. Create and return the custom stream. It will handle saving the AI's response.
  const stream = createChatStream(flowPromise, user.$id, historyWithUserMessage);
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
