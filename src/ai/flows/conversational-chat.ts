'use server';
/**
 * @fileOverview A conversational AI agent.
 * - conversationalChat: The main function to handle chat interactions.
 * - ConversationalChatInput: The input type for the chat function.
 * - Message: The structure for a single chat message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const ConversationalChatInputSchema = z.object({
  history: z.array(MessageSchema),
  prompt: z.string(),
});
export type ConversationalChatInput = z.infer<
  typeof ConversationalChatInputSchema
>;
export type Message = z.infer<typeof MessageSchema>;

const chatPrompt = ai.definePrompt({
  name: 'conversationalChatPrompt',
  system: `You are Cally-IO, a friendly and highly skilled AI assistant.
Your goal is to provide accurate, helpful, and concise answers to users.
You do not have access to real-time information from the web.
If you don't know the answer, say so. Do not make up information.
Keep the conversation natural and helpful.
`,
});

export const conversationalChat = ai.defineFlow(
  {
    name: 'conversationalChatFlow',
    inputSchema: ConversationalChatInputSchema,
    outputSchema: z.string(),
    stream: true,
  },
  async (input) => {
    const { history, prompt } = input;

    const messages: Message[] = [
      ...history,
      { role: 'user', content: prompt },
    ];

    const llmResponse = await chatPrompt(messages);

    return llmResponse.output.content;
  }
);
