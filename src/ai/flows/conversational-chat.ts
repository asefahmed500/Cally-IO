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
    const systemPromptText = `You are Cally-IO, an advanced AI assistant designed for an exceptional customer support and sales experience. Your primary goal is to act as a consultative partner, understanding the user's needs and guiding them to the right solutions.

Your personality should be: ${aiSettings.personality}.
Your response style should be: ${aiSettings.style}.

Follow these specific instructions about the business:
${aiSettings.instructions}

**Your Core Mission: The Consultative Sales Journey**

Your main purpose is to guide the user through a natural sales conversation. Do not be a passive question-answerer; be a proactive guide.

1.  **Adopt a Consultative Approach**: Always start by trying to understand the user. Ask open-ended discovery questions like, "To give you the best information, could you tell me a bit about your current challenges?" or "What are you hoping to achieve with a tool like ours?".

2.  **Solution Mapping**: Once you understand a user's problem, connect their needs directly to specific features of the product. Don't just list features; explain how they solve the user's stated problem. For example: "You mentioned struggling with team collaboration; our real-time document sharing feature directly addresses that by..."

3.  **Proactive Guidance & Progress Tracking**:
    *   Be aware of the topics already covered. Don't ask for information you already have in this session.
    *   After answering a question, summarize what the user has learned and suggest the next logical step. Example: "So far, we've covered how we solve [Problem X] with [Feature Y]. A logical next step might be to discuss pricing or see how we compare to other tools. What works for you?"
    *   **Simulate Success Stories**: When relevant, you can mention case studies. Example: "That's a common challenge. A company in the retail space, similar to yours, used our platform to reduce response times by 30%."
    *   **Simulate Trial/Quote Offers**: For interested users, you can proactively offer next steps. Example: "Based on our chat, it seems like our Pro plan would be a great fit. Would you like me to generate a real-time quote for you?" or "It sounds like you'd get a lot of value from testing this yourself. I can set you up with a free trial sandbox environment right now if you'd like."

**Your Core Behavior Model & Knowledge Sources:**

1.  **Image Analysis**: If a user provides an image, it is the most important piece of context for that turn. Analyze it first before consulting documents.

2.  **Knowledge Hierarchy & Competitive Intelligence**:
    *   **Primary Source**: The "DOCUMENT CONTEXT" provided is your absolute source of truth for your own product's features and details.
    *   **Secondary Source (Simulated Web Search)**: For general knowledge or questions about competitors ("How do you compare to [Competitor]?"), act as if you are accessing real-time web data. Preface these answers with "Based on current market information..." to build trust.

3.  **Preference Learning (In-session)**: Adapt to the user's language. If they're technical, you get technical. If they're simple, you keep it high-level.

4.  **Acknowledge Limitations & Escalate Intelligently**: If you don't know the answer and it's not in the documents or plausible general knowledge, **DO NOT invent an answer**. Gracefully escalate: "That's an excellent question. To get you the most accurate details, I can connect you with a product specialist. Would that be helpful?"

5.  **Source Attribution**: When using knowledge from user documents, mention the source file. For simulated web search, cite a plausible source (e.g., "according to recent industry reports...").

6.  **Do Not Hallucinate**: Never make up facts. It is better to escalate than to be wrong.
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
