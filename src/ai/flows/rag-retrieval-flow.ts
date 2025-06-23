'use server';

/**
 * @fileOverview A flow for retrieving information from the knowledge base (RAG).
 * This flow performs semantic search on the user's documents and uses the
 * retrieved context to answer a user's query using an advanced AI model.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { databases } from '@/lib/appwrite-server';
import { Query } from 'node-appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;
const TOP_K = 3; // Number of chunks to retrieve

// --- Helper function for Cosine Similarity ---
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


// --- Input and Output Schemas ---
const AssistantInputSchema = z.object({
  query: z.string().describe('The user question to answer.'),
  userId: z.string().describe('The ID of the user asking the question.'),
});
export type AssistantInput = z.infer<typeof AssistantInputSchema>;

const SourceSchema = z.object({
    type: z.enum(['document']),
    title: z.string(),
    content: z.string(),
});

const AssistantOutputSchema = z.object({
    answer: z.string().describe('The answer to the user query based on the retrieved context.'),
    sources: z.array(SourceSchema).describe('The document chunks used to generate the answer.')
});
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;

// --- Main Assistant Flow ---
const assistantFlow = ai.defineFlow(
  {
    name: 'assistantFlow',
    inputSchema: AssistantInputSchema,
    outputSchema: AssistantOutputSchema,
  },
  async (input) => {
    // 1. Perform RAG retrieval from user's documents
    const queryEmbedding = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: input.query,
    });
    
    let documentContext = "No relevant documents found.";
    let documentSources: z.infer<typeof SourceSchema>[] = [];

    if (DATABASE_ID && COLLECTION_ID) {
        const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
            Query.equal('userId', input.userId),
            Query.limit(5000)
        ]);
        const allChunks = response.documents as Array<{ embedding: number[], chunkText: string, fileName: string }>;

        if (allChunks.length > 0) {
            const similarities = allChunks.map(chunk => ({
                ...chunk,
                similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
            }));

            similarities.sort((a, b) => b.similarity - a.similarity);
            const topKChunks = similarities.slice(0, TOP_K);

            if (topKChunks.length > 0 && topKChunks[0].similarity > 0.5) {
                documentContext = topKChunks.map(chunk => `Source: ${chunk.fileName}\nContent: ${chunk.chunkText}`).join('\n\n---\n\n');
                documentSources = topKChunks.map(c => ({ type: 'document', title: c.fileName, content: c.chunkText }));
            }
        }
    }

    // 2. Generate an answer using document context
    const llmResponse = await ai.generate({
      model: 'googleai/gemini-1.5-flash-latest',
      prompt: `You are an expert research assistant. You have been provided with some context from the user's private documents.
        
        Answer the user's query based *only* on the provided document context. If the context is insufficient, say you couldn't find an answer in the documents. Do not use any outside knowledge.

        DOCUMENT CONTEXT:
        ---
        ${documentContext}
        ---

        USER QUERY: ${input.query}`,
    });

    return {
        answer: llmResponse.text,
        sources: documentSources,
    };
  }
);

// --- Exported wrapper function ---
export async function runAssistant(input: AssistantInput): Promise<AssistantOutput> {
  return assistantFlow(input);
}
