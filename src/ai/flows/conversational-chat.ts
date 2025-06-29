'use server';
/**
 * @fileOverview A conversational RAG chat agent with web search capabilities.
 * - conversationalRagChat: The main function to handle chat interactions.
 * - ConversationalRagChatInput: The input type for the chat function.
 * - Message: The structure for a single chat message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { embed, type Part } from '@genkit-ai/ai';
import { webSearch } from '@/ai/tools/tavily';
import {
  appwriteDatabases,
  appwriteEmbeddingsCollectionId,
  appwriteDatabaseId,
  appwriteFaqsCollectionId,
} from '@/lib/appwrite-client';
import { Query } from 'appwrite';
import { getLoggedInUser } from '@/lib/auth';
import { getAISettings } from '@/lib/settings';
import { logDocumentUsage } from '@/lib/analytics';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const ConversationalRagChatInputSchema = z.object({
  history: z.array(MessageSchema),
  prompt: z.string(),
  image: z.string().optional().describe('An optional image for the user prompt, as a data URI.'),
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

async function getFaqs(): Promise<string> {
  const dbId = appwriteDatabaseId;
  const collectionId = appwriteFaqsCollectionId;

  if (!dbId || !collectionId) {
    return '';
  }
  try {
    const response = await appwriteDatabases.listDocuments(dbId, collectionId, [
      Query.limit(100), // Fetch up to 100 FAQs
    ]);
    if (response.documents.length === 0) {
      return '';
    }
    return response.documents
      .map((doc: any) => `Question: ${doc.question}\nAnswer: ${doc.answer}`)
      .join('\n\n---\n\n');
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return ''; // Fail silently on the AI's side
  }
}

async function searchEmbeddings(
  query: string,
  userId: string
): Promise<{ context: string; sources: { documentId: string; fileName: string; }[] }> {
  const dbId = appwriteDatabaseId;
  const collectionId = appwriteEmbeddingsCollectionId;
  const defaultResponse = { context: '', sources: [] };

  if (!dbId || !collectionId) {
    console.warn(
      'Appwrite database/collection not configured. Skipping search.'
    );
    return defaultResponse;
  }
  
  const queryEmbedding = await embed(
    query,
    { embedder: 'googleai/text-embedding-004' }
  );

  try {
    const response = await appwriteDatabases.listDocuments(
      dbId,
      collectionId,
      [Query.equal('userId', userId), Query.limit(100)] // Fetch more to sort in-memory
    );

    if (response.documents.length === 0) {
      return defaultResponse;
    }

    const documentsWithSimilarity = response.documents.map((doc) => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    documentsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    // Filter out results with low similarity
    const topResults = documentsWithSimilarity.filter(d => d.similarity > 0.7).slice(0, 5);

    if (topResults.length === 0) {
        return defaultResponse;
    }

    const context = topResults
      .map((doc) => `File: ${doc.fileName}\nContent: ${doc.chunkText}`)
      .join('\n\n---\n\n');
      
    const sources = topResults.map((doc) => ({
      documentId: doc.documentId,
      fileName: doc.fileName,
    }));

    return { context, sources };
  } catch (error) {
    console.error('Error searching embeddings in Appwrite:', error);
    return defaultResponse;
  }
}

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
    const { history, prompt, image } = input;

    // 1. Fetch AI settings, FAQs, and Document Context concurrently
    const [aiSettings, faqContext, { context: docContext, sources: docSources }] = await Promise.all([
        getAISettings(),
        getFaqs(),
        searchEmbeddings(prompt, user.$id),
    ]);
    
    // 2. Log document usage for analytics (fire-and-forget)
    if (docSources.length > 0) {
        logDocumentUsage(user.$id, docSources);
    }
    
    // 3. Construct the system prompt dynamically with advanced instructions
    const systemPromptText = `You are Cally-IO, an advanced AI assistant for customer support and sales.

Your personality should be: ${aiSettings.personality}.
Your response style should be: ${aiSettings.style}.

**Core Instructions:**
1.  **Prioritize Your Knowledge**: You have three sources of information. Use them in this specific order:
    a.  **Image Analysis**: If the user provides an image, it is the most important context. Analyze it first.
    b.  **FAQs**: The "FREQUENTLY ASKED QUESTIONS" context is your highest priority. If the answer is here, use it and state that it comes from the company FAQ.
    c.  **DOCUMENT CONTEXT**: This is your second source of truth. The context is provided below, along with a list of the source file names. If you use information from this context, you MUST cite the file name(s) from the "Source Files" list. Example: "According to the 'product-manual.pdf' document, ...".
    d.  **Web Search Tool**: For questions about competitors, current events, or information not found in your internal knowledge, use the \`webSearch\` tool.

2.  **Consultative Sales Approach**: Act as a consultative partner.
    *   Ask clarifying questions to understand the user's needs.
    *   Connect their problems to specific product features.
    *   Proactively guide the conversation towards a solution, suggesting next steps like a demo or a follow-up.

3.  **Honesty and Escalation**: If you cannot find an answer using any of your tools or knowledge bases, **DO NOT invent an answer**. State that you don't have the information and offer to connect the user with a human specialist.

4.  **Business Context**:
    ${aiSettings.instructions}

**Knowledge Sources Provided for This Turn:**

FREQUENTLY ASKED QUESTIONS:
${faqContext || 'No FAQs provided.'}
---
DOCUMENT CONTEXT:
${docContext || 'No relevant information found in your documents for this query.'}

Source Files:
${docSources.map(s => `- ${s.fileName}`).join('\n') || 'N/A'}
`;
    
    // 4. Define the prompt dynamically inside the flow
    const chatPrompt = ai.definePrompt({
      name: 'conversationalRagChatPrompt',
      system: systemPromptText,
      tools: [webSearch],
    });

    const userMessageContent: Part[] = [{ text: prompt }];
    if (image) {
      userMessageContent.unshift({ media: { url: image } });
    }

    // Create the final user message object with its correct type (content is Part[])
    const userPromptWithParts = {
      role: 'user' as const,
      content: userMessageContent,
    };

    // Combine the string-based history with the new Part-based prompt.
    // The resulting array is of a mixed type.
    const llmInput = [...history, userPromptWithParts];

    // Call the prompt, casting the entire mixed-type array to 'any'.
    // This is necessary because the inferred type of `chatPrompt` expects a
    // homogenous array of `Message` (with string content), but the underlying
    // Genkit `generate` function is more flexible and can handle this mixed format.
    const llmResponse = await chatPrompt(llmInput as any);
    return llmResponse.output.content;
  }
);
