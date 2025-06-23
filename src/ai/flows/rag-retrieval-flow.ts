'use server';

/**
 * @fileOverview A flow for retrieving information from the knowledge base (RAG).
 * This flow performs semantic search on the user's documents and uses the
 * retrieved context to answer a user's query.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { databases } from '@/lib/appwrite-server';
import { Query } from 'node-appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;
const TOP_K = 5; // Number of chunks to retrieve

// --- Helper function for Cosine Similarity ---
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

// --- Input and Output Schemas ---
const RAGRetrievalInputSchema = z.object({
  query: z.string().describe('The user question to answer.'),
  userId: z.string().describe('The ID of the user asking the question.'),
});
export type RAGRetrievalInput = z.infer<typeof RAGRetrievalInputSchema>;

const RAGRetrievalOutputSchema = z.object({
    answer: z.string().describe('The answer to the user query based on the retrieved context.'),
    retrievedChunks: z.array(z.object({
        fileName: z.string(),
        chunkText: z.string(),
    })).describe('The document chunks used to generate the answer.')
});
export type RAGRetrievalOutput = z.infer<typeof RAGRetrievalOutputSchema>;

// --- Main RAG Flow ---
const ragRetrievalFlow = ai.defineFlow(
  {
    name: 'ragRetrievalFlow',
    inputSchema: RAGRetrievalInputSchema,
    outputSchema: RAGRetrievalOutputSchema,
  },
  async (input) => {
    // 1. Generate an embedding for the user's query
    const queryEmbedding = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: input.query,
    });

    // 2. Fetch all document chunks for the user from Appwrite
    // WARNING: This is not scalable. For production, a real vector DB is needed.
    // This fetches all chunks into memory and calculates similarity in the flow.
    const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.equal('userId', input.userId),
        Query.limit(5000) // Appwrite limit, adjust if needed
    ]);
    const allChunks = response.documents as Array<{ embedding: number[], chunkText: string, fileName: string }>;

    if (allChunks.length === 0) {
        return {
            answer: "I couldn't find any documents in your knowledge base. Please upload some files first.",
            retrievedChunks: [],
        };
    }

    // 3. Calculate cosine similarity for each chunk and find the top K
    const similarities = allChunks.map(chunk => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topKChunks = similarities.slice(0, TOP_K);

    const context = topKChunks.map(chunk => `Source: ${chunk.fileName}\nContent: ${chunk.chunkText}`).join('\n\n---\n\n');

    // 4. Generate an answer using the retrieved context
    const llmResponse = await ai.generate({
      prompt: `You are an AI assistant. Answer the user's question based *only* on the following context. If the context doesn't contain the answer, say you don't know.

Context:
${context}

---
Question: ${input.query}
Answer:`,
    });

    return {
        answer: llmResponse.text,
        retrievedChunks: topKChunks.map(c => ({ fileName: c.fileName, chunkText: c.chunkText })),
    };
  }
);

// --- Exported wrapper function ---
export async function askQuestion(input: RAGRetrievalInput): Promise<RAGRetrievalOutput> {
  return ragRetrievalFlow(input);
}
