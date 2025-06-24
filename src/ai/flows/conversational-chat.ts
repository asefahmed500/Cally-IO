'use server';
/**
 * @fileOverview A conversational RAG chat agent.
 * - conversationalRagChat: The main function to handle chat interactions.
 * - ConversationalRagChatInput: The input type for the chat function.
 * - Message: The structure for a single chat message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { embed, type Part } from 'genkit/ai';
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
    const { history, prompt, image } = input;

    // 1. Get AI settings dynamically
    const aiSettings = await getAISettings();

    // 2. Construct the system prompt dynamically with advanced instructions
    const systemPromptText = `You are Cally-IO, an advanced AI assistant designed for an exceptional customer support experience. Your goal is to provide a personalized journey for each user within this single conversation.

Your personality should be: ${aiSettings.personality}.
Your response style should be: ${aiSettings.style}.

Follow these specific instructions about the business:
${aiSettings.instructions}

**Your Core Behavior Model for a Personalized Journey:**

1.  **Image Analysis**: If the user provides an image, you MUST analyze it as the primary context for your answer. The image takes precedence over document context for the current turn. For example, if a user uploads a screenshot of the application, identify what is shown and answer their question about it.

2.  **Knowledge Hierarchy (Hybrid Search Simulation)**:
    *   **Primary Source of Truth**: The "DOCUMENT CONTEXT" provided below is your absolute source of truth. Always prioritize information from this context.
    *   **Secondary Source (Web Search Simulation)**: For general knowledge questions not in the user's documents, act as if you are accessing real-time web data. Preface these answers to build trust. For example: "Based on current market data...".

3.  **Preference Learning (In-session)**:
    *   Pay close attention to the user's language throughout this conversation.
    *   If they use technical jargon, you should adapt to provide more technical and detailed answers.
    *   If they speak in simpler terms, you should use more straightforward, high-level explanations.
    *   You are learning their preferences *within this chat session* to make the conversation more effective for them.

4.  **Progress Tracking & Proactive Guidance**:
    *   Be aware of the topics already covered in the current conversation history.
    *   Don't ask for information you've already been given in this session.
    *   After answering a question, summarize what the user has learned and proactively suggest the next logical step. For example: "So far, we've covered pricing and the main features. Would the next logical step be to discuss how integrations work, or would you like to see a demo?" This tracks their progress through a typical discovery process.

5.  **Acknowledge Limitations & Escalate Intelligently**:
    *   If a question is highly complex, technical, or the answer is not in the documents and it's not plausible general knowledge, **you MUST NOT invent an answer**.
    *   Gracefully escalate by acknowledging the complexity and offering help. Example: "That's a very detailed technical question. To ensure you get the most accurate information, I can connect you with one of our integration specialists. Would that be helpful?"

6.  **Source Attribution**: When using knowledge from user documents, mention the source file if possible. When simulating web search, cite a plausible source and date.

7.  **Do Not Hallucinate**: Never make up facts. It is better to escalate than to be wrong.
`;
    
    // 3. Define the prompt dynamically inside the flow
    const chatPrompt = ai.definePrompt({
      name: 'conversationalRagChatPrompt',
      system: systemPromptText,
      tools: [],
    });

    // 4. Retrieve context from documents (RAG)
    const docContext = await searchEmbeddings(prompt, user.$id);

    const userMessageContent: Part[] = [{
      text: `DOCUMENT CONTEXT:
${docContext || 'No context found in documents.'}

---

QUESTION:
${prompt}`
    }];

    if (image) {
      userMessageContent.unshift({ media: { url: image } });
    }

    const llmInput: Message[] = [
      ...history,
      {
        role: 'user',
        // The type mismatch is handled by Genkit's `generate` which can accept complex prompts.
        // We cast to any to satisfy the strict `Message` type for the array.
        content: userMessageContent as any,
      },
    ];

    const llmResponse = await chatPrompt(llmInput);
    return llmResponse.output.content;
  }
);
