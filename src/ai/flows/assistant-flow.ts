'use server';

/**
 * @fileOverview An AI assistant that answers questions based on a knowledge base.
 *
 * - assistantFlow: The main flow for handling the conversational RAG pipeline.
 * - AssistantInput: The input type for the assistantFlow function.
 */

import { ai } from '@/ai/genkit';
import { databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { Query } from 'node-appwrite';
import { z } from 'zod';
import { cosineSimilarity } from '@/lib/vector-utils';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const EMBEDDINGS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;

const AssistantInputSchema = z.object({
  query: z.string(),
});
export type AssistantInput = z.infer<typeof AssistantInputSchema>;

interface Chunk {
  documentId: string;
  fileName: string;
  chunkText: string;
  embedding: number[];
}

// Function to fetch all document chunks for the user
async function fetchUserDocumentChunks(userId: string): Promise<Chunk[]> {
  try {
    let allDocuments: any[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      const queries = [
        Query.equal('userId', userId),
        Query.limit(100),
      ];
      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }

      const response = await databases.listDocuments(
        DATABASE_ID,
        EMBEDDINGS_COLLECTION_ID,
        queries
      );

      if (response.documents.length > 0) {
        allDocuments.push(...response.documents);
        cursor = response.documents[response.documents.length - 1].$id;
      } else {
        hasMore = false;
      }
    }
    return allDocuments as Chunk[];
  } catch (error) {
    console.error("Failed to fetch user's document chunks:", error);
    return [];
  }
}

// Function to find the most relevant chunks using cosine similarity
async function findRelevantChunks(query: string, chunks: Chunk[], topK: number): Promise<Chunk[]> {
  if (chunks.length === 0) return [];

  const { embedding: queryEmbedding } = await ai.embed({
    content: query,
    model: 'googleai/text-embedding-004',
  });

  const similarities = chunks.map(chunk => ({
    chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topK).map(s => s.chunk);
}

const ragPrompt = ai.definePrompt({
    name: 'ragPrompt',
    input: { schema: z.object({ query: z.string(), context: z.string() }) },
    prompt: `You are an expert AI assistant. Your task is to answer the user's question based *only* on the provided context information.
    
    If the context does not contain the answer, you must state that you couldn't find the information in the provided documents. Do not use any external knowledge.
    
    When you use information from the context, you MUST cite the source using the format [Source: file_name].
    
    Context:
    {{{context}}}
    
    Question:
    {{{query}}}
    
    Answer:`,
});

export const assistantFlow = ai.defineFlow(
  {
    name: 'assistantFlow',
    inputSchema: AssistantInputSchema,
    outputSchema: z.string().stream(),
  },
  async function* ({ query }) {
    const user = await getLoggedInUser();
    if (!user) {
      throw new Error('User must be logged in.');
    }

    const allChunks = await fetchUserDocumentChunks(user.$id);
    if (allChunks.length === 0) {
        yield "I couldn't find any documents in your knowledge base. Please upload some documents first.";
        return;
    }

    const relevantChunks = await findRelevantChunks(query, allChunks, 5);

    if (relevantChunks.length === 0) {
        yield "I couldn't find any relevant information in your documents to answer that question.";
        return;
    }
    
    const context = relevantChunks.map(chunk => `Source: ${chunk.fileName}\nContent: ${chunk.chunkText}`).join('\n\n---\n\n');
    
    const { stream } = ragPrompt.stream({ query, context });

    for await (const chunk of stream) {
        yield chunk;
    }
  }
);
