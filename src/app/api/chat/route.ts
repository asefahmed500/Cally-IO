'use server';
import { conversationalRagChat, type Message } from '@/ai/flows/conversational-chat';
import { getLoggedInUser } from '@/lib/auth';
import { getConversation, createConversation, updateConversation } from '@/lib/conversation';
import { z } from 'zod';
import { type Part } from '@genkit-ai/ai';
import { v4 as uuidv4 } from 'uuid';
import { AppwriteException } from 'node-appwrite';

const ChatRequestSchema = z.object({
  prompt: z.string(),
  image: z.string().optional(),
});

type ChatMessageWithId = Message & { id: string, image?:string };

// A custom ReadableStream that wraps the Genkit stream and handles database updates.
function createChatStream(
    flowPromise: Promise<any>, 
    userId: string, 
    fullHistory: ChatMessageWithId[]
) {
  const textEncoder = new TextEncoder();
  let fullResponse = '';
  let finalHistory: ChatMessageWithId[] = [];

  return new ReadableStream({
    async start(controller) {
      try {
        const { stream } = await flowPromise;

        for await (const chunk of stream) {
          fullResponse += chunk;
          controller.enqueue(textEncoder.encode(chunk));
        }

        const modelMessage: ChatMessageWithId = { role: 'model', content: fullResponse, id: uuidv4() };
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
  try {
    // Server-side guard to prevent execution if not configured.
    if (!process.env.NEXT_PUBLIC_APPWRITE_CONVERSATIONS_COLLECTION_ID || !process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID) {
       return new Response(JSON.stringify({ 
          error: "Server Configuration Error",
          message: 'Chat functionality is not configured on the server. Please check your environment variables.'
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
      
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
    const userMessage: ChatMessageWithId = {
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
    // We also remove the 'id' and 'image' from the history sent to the AI.
    const aiInputHistory = conversation.history.map(({ id, image, ...rest }) => ({
        ...rest
    }));

    const flowPromise = conversationalRagChat({
      history: aiInputHistory,
      prompt: prompt, // Pass the raw prompt for RAG
      image: image,
    });

    // 5. Create and return the custom stream. It will handle saving the AI's response.
    const stream = createChatStream(
      flowPromise, 
      user.$id, 
      historyWithUserMessage
    );
    
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    if (error instanceof AppwriteException && error.type === 'document_invalid_structure') {
        console.error("Appwrite schema error in chat API:", error);
        return new Response(JSON.stringify({
            error: "Database Schema Error",
            message: `The 'conversations' collection has a schema error which prevents chat from working. The specific error is: "${error.message}". Please check your Appwrite project configuration.`,
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof SyntaxError) {
        return new Response('Invalid JSON in request body.', { status: 400 });
    }
    console.error("An unexpected error occurred in chat API:", error);
    return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: 'An internal server error occurred. Please check the server logs for more details.',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
