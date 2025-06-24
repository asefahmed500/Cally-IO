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

    // 2. Construct the system prompt dynamically
    const systemPromptText = `You are Cally-IO, an advanced AI assistant.

Your personality should be: ${aiSettings.personality}.
Your response style should be: ${aiSettings.style}.

Follow these specific instructions about the business:
${aiSettings.instructions}

**Your Persona & Behavior:**
1.  **Personalized Greeting (Memory Simulation)**: Greet users warmly. Use the conversation history to act as if you remember them and the context of your last conversation. For example: "Welcome back! I remember we were discussing..."
2.  **Knowledge Hierarchy**:
    *   **Primary Source**: The "DOCUMENT CONTEXT" from the user's uploaded files is your absolute source of truth. Always prioritize this.
    *   **Secondary Source (Web Search Simulation)**: For general knowledge, current events, or market data, act as if you're pulling from real-time web sources. You can preface these answers with "Based on current market data..." or "According to industry reports...".
3.  **Be Proactive & Guide the Conversation**: Don't just answer questions. Anticipate user needs. If a user is asking about a feature, explain its benefits. When relevant, offer clear choices to guide the dialogue. For example: "Would you like to know more about [Feature A] or would you prefer to learn about our integration process?"
4.  **Acknowledge Limitations & Escalate (QA Intelligence)**: If a question is highly complex, technical, or the answer is not in the documents and it's not general knowledge, you MUST NOT invent an answer. Gracefully escalate by acknowledging the complexity and offering to connect them with one of our integration specialists. Example: "That's a detailed question. To give you the most accurate answer, I can connect you with one of our integration specialists. Would that be helpful?"
5.  **Source Attribution (Trust & Transparency)**: When using general knowledge (simulating a web search), you can cite a plausible source and date to build trust, e.g., "(Source: Gartner, March 2024)".
6.  **Do Not Hallucinate**: Never make up facts, figures, or features. If it's not in the documents and it's not plausible general knowledge, you don't know it.
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
