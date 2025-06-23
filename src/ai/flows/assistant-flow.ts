'use server';
/**
 * @fileOverview A conversational AI flow that answers questions based on documents.
 * - assistantFlow: Main streaming flow for the RAG-based chat assistant.
 */
import { ai } from '@/ai/genkit';
import { databases } from '@/lib/appwrite-server';
import { cosineSimilarity } from '@/lib/vector-utils';
import { Query } from 'node-appwrite';
import { z } from 'zod';
import type { Message, DocumentChunk } from '@/lib/types';
import {流, 流able} from 'genkit/experimental/streaming';

// Input schema for the assistant flow
export const AssistantFlowInputSchema = z.object({
  question: z.string(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
  userId: z.string(),
});
export type AssistantFlowInput = z.infer<typeof AssistantFlowInputSchema>;


// The main streaming flow for the assistant
export const assistantFlow = ai.defineFlow(
  {
    name: 'assistantFlow',
    inputSchema: AssistantFlowInputSchema,
    outputSchema: z.string(),
    stream: true,
  },
  async (input, streamingCallback) => {
    const { question, userId } = input;
    const embeddingModel = 'googleai/text-embedding-004';
    const llm = 'googleai/gemini-1.5-flash-latest';

    // 1. Create an embedding for the user's question
    const queryEmbedding = await ai.embed({
      embedder: embeddingModel,
      content: question,
    });
    
    // 2. Retrieve all document chunks for the user from Appwrite
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const collectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID;

    if (!databaseId || !collectionId) {
      throw new Error("Appwrite environment variables are not configured.");
    }
    
    const response = await databases.listDocuments(databaseId, collectionId, [
        Query.equal("userId", userId),
        Query.limit(5000) // Appwrite's max limit, adjust if needed
    ]);

    const allChunks = response.documents as (DocumentChunk & { embedding: number[] })[];
    
    if (allChunks.length === 0) {
        // Send sources even if empty
        streamingCallback({
            content: JSON.stringify({ type: 'sources', sources: [] }),
            isPartial: true
        });
        const noDocsMessage = "I couldn't find any documents in your knowledge base. Please upload some documents first.";
        streamingCallback({
            content: JSON.stringify({ type: 'chunk', content: noDocsMessage }),
            isPartial: false
        });
        return noDocsMessage;
    }

    // 3. Calculate similarity and find the most relevant chunks
    const chunksWithSimilarity = allChunks.map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    chunksWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    const topK = 5;
    const relevantChunks = chunksWithSimilarity.slice(0, topK).filter(c => c.similarity > 0.5);

    // 4. Send the identified sources back to the client
    const sourcesForClient = relevantChunks.map(({ documentId, fileName, chunkText, userId, $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions }) => ({
        documentId, fileName, chunkText, userId, $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions
    }));

    streamingCallback({
        content: JSON.stringify({ type: 'sources', sources: sourcesForClient }),
        isPartial: true
    });
    
    // 5. Construct the context for the language model
    const contextString = relevantChunks
        .map((chunk, index) => `Source ${index + 1} (${chunk.fileName}):\n${chunk.chunkText}`)
        .join('\n\n---\n\n');

    const systemPrompt = `You are an expert support agent for a company called Intellecta. Your name is Intellecta Assistant.
You are chatting with a user.

You MUST strictly adhere to the following rules:
1.  You must answer the user's question based ONLY on the provided "Knowledge Base Context". Do not use any external knowledge.
2.  If the context does not contain the answer, you MUST state that you cannot find the information in the knowledge base and recommend that the user contact a human support agent. Do not make up answers.
3.  You must identify the language of the user's question and respond in the same language.
4.  Do not mention the "Knowledge Base Context" or "Source X" in your response. Just provide the answer.

Here is the Knowledge Base Context you must use:
${contextString || "No relevant context found."}`;

    // 6. Generate the response using the language model in a streaming fashion
    const { stream } = ai.generateStream({
        model: llm,
        prompt: question,
        system: systemPrompt,
        history: input.history as Message[]
    });

    let finalAnswer = '';
    for await (const chunk of stream) {
        finalAnswer += chunk.text;
        streamingCallback({
            content: JSON.stringify({ type: 'chunk', content: chunk.text }),
            isPartial: true
        });
    }
    
    // Mark the stream as complete
    streamingCallback({
        content: JSON.stringify({ type: 'chunk', content: '' }),
        isPartial: false
    });

    return finalAnswer;
  }
);
