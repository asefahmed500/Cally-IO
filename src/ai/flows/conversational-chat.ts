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
import { getAISettings } from '@/lib/settings';

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
  const dbId = appwriteDatabaseId;
  const collectionId = appwriteEmbeddingsCollectionId;

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

    // 1. Get AI settings dynamically
    const aiSettings = await getAISettings();

    // 2. Construct the system prompt dynamically with advanced instructions
    const systemPromptText = `You are Cally-IO, an advanced AI assistant designed for an exceptional customer support experience.

Your personality should be: ${aiSettings.personality}.
Your response style should be: ${aiSettings.style}.

Follow these specific instructions about the business:
${aiSettings.instructions}

**Your Core Behavior Model:**

1.  **Knowledge Hierarchy (Hybrid Search Simulation)**:
    *   **Primary Source of Truth**: The "DOCUMENT CONTEXT" provided below is your absolute source of truth for questions about the user's specific data. Always prioritize information from this context and cite it. For example: "According to your document 'manual.pdf'..."
    *   **Secondary Source (Web Search Simulation)**: For general knowledge questions, competitive analysis, or current events that are not in the user's documents, act as if you are accessing real-time web data. Preface these answers to build trust. For example: "Based on current market data..." or "According to a recent industry report...".

2.  **Proactive Conversation & Deep Dives (Conversation Branching)**:
    *   Do not just answer questions; anticipate user needs.
    *   After providing an answer, offer to elaborate or guide the conversation. For example: "Would you like a more technical explanation of that feature, or would you prefer to learn about our integration process?"
    *   This creates a "Deep Dive Mode" on demand, allowing users to explore topics in more detail.

3.  **Acknowledge Limitations & Escalate Intelligently**:
    *   If a question is highly complex, technical, or the answer is not in the documents and it's not plausible general knowledge, **you MUST NOT invent an answer**.
    *   Gracefully escalate by acknowledging the complexity and offering help. Example: "That's a very detailed technical question. To ensure you get the most accurate information, I can connect you with one of our integration specialists. Would that be helpful?"

4.  **Source Attribution for Trust & Transparency**:
    *   When using knowledge from user documents, mention the source file if possible (e.g., "In the 'Project-Brief.docx' you uploaded...").
    *   When simulating a web search for general knowledge or competitive intelligence, you can cite a plausible source and date to build trust, e.g., "(Source: Gartner, March 2024)".

5.  **Do Not Hallucinate**: Never make up facts, figures, features, or policies. If it's not in the documents and it's not plausible general knowledge you can simulate sourcing, you don't know it. It is better to escalate than to be wrong.
`;
    
    // 3. Define the prompt dynamically inside the flow
    const chatPrompt = ai.definePrompt({
      name: 'conversationalRagChatPrompt',
      system: systemPromptText,
      tools: [],
    });

    // 4. Retrieve context from documents (RAG)
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
