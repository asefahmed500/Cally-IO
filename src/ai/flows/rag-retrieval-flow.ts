'use server';

/**
 * @fileOverview A stream-based flow for retrieving information from the knowledge base (RAG).
 * This file contains the logic for performing semantic search on user documents
 * and streaming an answer from an AI model.
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

// --- Input Schema ---
export const AssistantInputSchema = z.object({
  query: z.string().describe('The user question to answer.'),
  userId: z.string().describe('The ID of the user asking the question.'),
});
export type AssistantInput = z.infer<typeof AssistantInputSchema>;

// --- Main Streaming Function ---
export async function* streamAssistantResponse(input: AssistantInput) {
    // 1. Perform RAG retrieval from user's documents
    const queryEmbedding = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: input.query,
    });
    
    let documentContext = "No relevant documents found.";
    let documentSources: Array<{fileName: string, content: string}> = [];

    if (DATABASE_ID && COLLECTION_ID) {
        try {
            const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
                Query.equal('userId', input.userId),
                Query.limit(5000) // Fetch all documents for local similarity search
            ]);
            const allChunks = response.documents as Array<{ embedding: number[], chunkText: string, fileName:string }>;

            if (allChunks.length > 0) {
                const similarities = allChunks.map(chunk => ({
                    ...chunk,
                    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
                }));

                similarities.sort((a, b) => b.similarity - a.similarity);
                const topKChunks = similarities.slice(0, TOP_K);

                if (topKChunks.length > 0 && topKChunks[0].similarity > 0.5) {
                    documentContext = topKChunks.map(chunk => `Source: ${chunk.fileName}\nContent: ${chunk.chunkText}`).join('\n\n---\n\n');
                    documentSources = topKChunks.map(c => ({ fileName: c.fileName, content: c.chunkText }));
                }
            }
        } catch (e) {
            console.error("Could not retrieve documents from Appwrite:", e);
            documentContext = "Error: Could not retrieve documents from the knowledge base.";
        }
    }

    // 2. Generate an answer using document context and stream it
    const { stream } = await ai.generateStream({
      model: 'googleai/gemini-1.5-flash-latest',
      prompt: `You are an expert research assistant. You have been provided with some context from the user's private documents.
        
        Answer the user's query based *only* on the provided document context. If the context is insufficient, say you couldn't find an answer in the documents. Do not use any outside knowledge.
        
        After your answer, include the sources you used. Format them clearly under a '**Sources:**' heading. For each source, list the file name and a brief, relevant snippet of the content you used.

        DOCUMENT CONTEXT:
        ---
        ${documentContext}
        ---

        USER QUERY: ${input.query}`,
        // Pass the sources to the model's context, so it can cite them accurately.
        // The actual source objects are not directly used in the prompt template,
        // but including them here helps the model associate the context with filenames.
        context: documentSources.map(s => ({
            "File": s.fileName,
            "Content": s.content
        }))
    });

    for await (const chunk of stream) {
        yield chunk.text;
    }
}
