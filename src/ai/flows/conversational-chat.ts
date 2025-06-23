'use server';
/**
 * @fileOverview A conversational RAG chat agent.
 * - conversationalRagChat: The main function to handle chat interactions.
 * - ConversationalRagChatInput: The input type for the chat function.
 * - Message: The structure for a single chat message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { embed } from 'genkit/ai';
import {
  appwriteDatabases,
  appwriteEmbeddingsCollectionId,
  appwriteDatabaseId,
} from '@/lib/appwrite-client';
import { Query } from 'appwrite';
import { getLoggedInUser } from '@/lib/auth';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const ConversationalRagChatInputSchema = z.object({
  history: z.array(MessageSchema),
  prompt: z.string(),
});
export type ConversationalRagChatInput = z.infer<
  typeof ConversationalRagChatInputSchema
>;
export type Message = z.infer<typeof MessageSchema>;

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchEmbeddings(
  query: string,
  userId: string
): Promise<string> {
  const dbId = await appwriteDatabaseId();
  const collectionId = await appwriteEmbeddingsCollectionId();

  if (!dbId || !collectionId) {
    console.warn(
      'Appwrite database/collection not configured. Skipping search.'
    );
    return '';
  }

  const queryEmbedding = await embed({
    embedder: 'googleai/text-embedding-004',
    content: query,
  });

  try {
    const response = await appwriteDatabases.listDocuments(
      dbId,
      collectionId,
      [Query.equal('userId', userId), Query.limit(100)] // Fetch more to sort in-memory
    );

    if (response.documents.length === 0) {
      return '';
    }

    const documentsWithSimilarity = response.documents.map((doc) => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    documentsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    // Filter out results with low similarity
    const topResults = documentsWithSimilarity.filter(d => d.similarity > 0.7).slice(0, 5);

    if (topResults.length === 0) {
        return '';
    }

    const context = topResults
      .map((doc) => `File: ${doc.fileName}\nContent: ${doc.chunkText}`)
      .join('\n\n---\n\n');

    return context;
  } catch (error) {
    console.error('Error searching embeddings in Appwrite:', error);
    return ''; // Return empty string on error
  }
}

const chatPrompt = ai.definePrompt({
  name: 'conversationalRagChatPrompt',
  system: `You are Cally-IO, a friendly and highly skilled AI assistant designed for quality and performance.
Your goal is to provide accurate, helpful, and context-aware answers based on the user's uploaded documents.

**Core Instructions:**
1.  **Prioritize Documents**: Your primary source of truth is the "DOCUMENT CONTEXT" provided. Base your answers on this information.
2.  **Use Conversation History**: Refer to the conversation history for short-term context and to avoid repeating questions.
3.  **Acknowledge Limitations & Escalate**: If the provided documents do not contain the answer, or if the user's query is highly complex, ambiguous, or they express significant frustration, you MUST NOT invent an answer. Instead, gracefully escalate the conversation. State that you don't have the information and offer to connect them with a human specialist. For example: "I couldn't find the specific information in the documents available to me. To ensure you get the best possible help, I can connect you with one of our support specialists. Would you like me to do that?"
4.  **Be Confident & Clear**: When the answer is clearly present in the documents, provide it with confidence. Be concise and direct.
5.  **Do Not Hallucinate**: Never make up information. If it's not in the documents, you don't know it.
`,
  tools: [],
});

export const conversationalRagChat = ai.defineFlow(
  {
    name: 'conversationalRagChatFlow',
    inputSchema: ConversationalRagChatInputSchema,
    outputSchema: z.string(),
    stream: true,
  },
  async (input) => {
    const user = await getLoggedInUser();
    if (!user) {
      throw new Error('User not logged in');
    }
    const { history, prompt } = input;

    // 1. Retrieve context from documents (RAG)
    const docContext = await searchEmbeddings(prompt, user.$id);

    const llmInput: Message[] = [
      ...history,
      {
        role: 'user',
        content: `DOCUMENT CONTEXT:
${docContext || 'No context found in documents.'}

---

QUESTION:
${prompt}`,
      },
    ];

    const llmResponse = await chatPrompt(llmInput);
    return llmResponse.output.content;
  }
);
