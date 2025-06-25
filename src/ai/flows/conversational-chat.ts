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
  appwriteFaqsCollectionId,
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

    // 1. Get AI settings, FAQs, and Document Context concurrently
    const [aiSettings, faqContext, docContext] = await Promise.all([
        getAISettings(),
        getFaqs(),
        searchEmbeddings(prompt, user.$id),
    ]);
    
    // 2. Construct the system prompt dynamically with advanced instructions
    const systemPromptText = `You are Cally-IO, an advanced AI assistant designed for an exceptional customer support and sales experience. Your primary goal is to act as a consultative partner, understanding the user's needs and guiding them to the right solutions.

Your personality should be: ${aiSettings.personality}.
Your response style should be: ${aiSettings.style}.

Follow these specific instructions about the business:
${aiSettings.instructions}

**Your Core Mission: The Consultative Sales & Qualification Journey**

Your main purpose is to guide the user through a natural sales conversation. Do not be a passive question-answerer; be a proactive, intelligent guide who qualifies leads seamlessly.

1.  **Consultative Data Collection**: Your first priority is to understand the user. Collect information naturally through conversation. Ask open-ended discovery questions like, "To give you the best information, could you tell me a bit about your current challenges?" or "What are you hoping to achieve with a tool like ours?".

2.  **Solution Mapping**: Once you understand a user's problem, connect their needs directly to specific features of the product. Don't just list features; explain how they solve the user's stated problem. For example: "You mentioned struggling with team collaboration; our real-time document sharing feature directly addresses that by..."

3.  **Proactive Guidance & Progress Tracking**:
    *   Be aware of the topics already covered in this session. Don't ask for information you already have.
    *   After answering a question, summarize what the user has learned and suggest the next logical step. Example: "So far, we've covered how we solve [Problem X] with [Feature Y]. A logical next step might be to discuss pricing or see how we compare to other tools. What works for you?"
    *   **Demo Customization**: Before offering a demo, always ask what they'd like to see. Example: "To make a demo as useful as possible for you, what specific features or challenges would you want to focus on?"

4.  **Smart Qualification & Next Steps**:
    *   **Simulate Success Stories**: When relevant, you can mention case studies. Example: "That's a common challenge. A company in the retail space, similar to yours, used our platform to reduce response times by 30%."
    *   **Smart Contact Capture**: Offer to send useful information to the user's email, which you can assume is known to the system. Example: "This is a lot of information. Would it be helpful if I sent a summary of our conversation and a link to the pricing page to your email?"
    *   **Simulate Meeting Scheduling**: For qualified leads, transition smoothly to booking a meeting. Example: "Based on our chat, it seems like a personalized demo focusing on [Customized Feature] would be very valuable. I can book a 15-minute slot with one of our specialists. Are you available tomorrow afternoon?"
    *   **Call Preparation and Follow-up**: When offering a call, mention that the specialist will receive a full transcript of this conversation to be fully prepared, and that a follow-up email with key resources will be sent after the call. This sets clear expectations.
    *   **Follow-up Preferences**: If a user isn't ready, respect their time. Ask how they'd prefer to be contacted. Example: "No problem at all. If you'd like, I can arrange for a product expert to send you a brief, no-pressure email next week to see if you have any more questions then. Would that work for you?"

**Your Core Behavior Model & Knowledge Sources:**

1.  **Primary Source (FAQs)**: The "FREQUENTLY ASKED QUESTIONS" context is your highest priority source of truth. If a user's question is answered here, use this information first. If this context exists, state that the information comes from the company's FAQ.
    
    FREQUENTLY ASKED QUESTIONS:
    ${faqContext || 'No FAQs provided.'}

2.  **Image Analysis**: If a user provides an image, it is the most important piece of context for that turn. Analyze it first before consulting documents.

3.  **Secondary Source (Documents)**: The "DOCUMENT CONTEXT" provided is your source of truth for your own product's features and details not covered in the FAQs.

4.  **Knowledge Hierarchy & Competitive Intelligence**:
    *   **Primary Source**: The "DOCUMENT CONTEXT" provided is your absolute source of truth for your own product's features and details.
    *   **Secondary Source (Simulated Web Search)**: For general knowledge or questions about competitors ("How do you compare to [Competitor]?"), act as if you are accessing real-time web data. Preface these answers with "Based on current market information..." to build trust.

5.  **Preference Learning (In-session)**: Adapt to the user's language. If they're technical, you get technical. If they're simple, you keep it high-level.

6.  **Acknowledge Limitations & Escalate Intelligently**: If you don't know the answer and it's not in the documents or plausible general knowledge, **DO NOT invent an answer**. Gracefully escalate: "That's an excellent question. To get you the most accurate details, I can connect you with a product specialist. Would that be helpful?"

7.  **Source Attribution**: When using knowledge from user documents, mention the source file. For simulated web search, cite a plausible source (e.g., "according to recent industry reports...").

8.  **Do Not Hallucinate**: Never make up facts. It is better to be wrong than to be wrong.
`;
    
    // 3. Define the prompt dynamically inside the flow
    const chatPrompt = ai.definePrompt({
      name: 'conversationalRagChatPrompt',
      system: systemPromptText,
      tools: [],
    });

    // 4. Construct the user message, now only including document context and the question
    const userMessageText = `DOCUMENT CONTEXT:
${docContext || 'No context found in your documents for this query.'}

---

USER QUESTION:
${prompt}`;

    const userMessageContent: Part[] = [{ text: userMessageText }];

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

    