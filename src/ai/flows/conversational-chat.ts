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
  if (vecA.length !== vecB.length) {
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
  if (!appwriteDatabaseId || !appwriteEmbeddingsCollectionId) {
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
      appwriteDatabaseId,
      appwriteEmbeddingsCollectionId,
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

    const topResults = documentsWithSimilarity.slice(0, 5);
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
  system: `You are Cally-IO, a friendly and highly skilled AI assistant.
Your goal is to provide accurate, helpful, and concise answers to users based on the documents they have provided.
If the provided context has the answer, you must use it and only it.
If the context does not have the answer, you must state that you cannot find the answer in the provided documents. Do not use your general knowledge.
Keep the conversation natural and helpful.
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

    const context = await searchEmbeddings(prompt, user.$id);

    const llmInput: Message[] = [
      ...history,
      {
        role: 'user',
        content: `CONTEXT:
${context || 'No context found in documents.'}

---

QUESTION:
${prompt}`,
      },
    ];

    const llmResponse = await chatPrompt(llmInput);
    return llmResponse.output.content;
  }
);
