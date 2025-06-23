'use server';
/**
 * @fileOverview Saves conversational interactions to Mem0 for long-term memory.
 * - saveMemory: The main function to save a turn of conversation.
 * - SaveMemoryInput: The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { Mem0Client } from 'mem0-node';
import { z } from 'zod';
import { getLoggedInUser } from '@/lib/auth';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const SaveMemoryInputSchema = z.object({
  messages: z.array(MessageSchema),
});
export type SaveMemoryInput = z.infer<typeof SaveMemoryInputSchema>;

let mem0: Mem0Client;
if (process.env.MEMO_API_KEY) {
  mem0 = new Mem0Client({
    apiKey: process.env.MEMO_API_KEY,
  });
}

export const saveMemory = ai.defineFlow(
  {
    name: 'saveMemoryFlow',
    inputSchema: SaveMemoryInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    if (!mem0) {
      console.log('Mem0 client not initialized. Skipping memory save.');
      return;
    }

    const user = await getLoggedInUser();
    if (!user) {
      throw new Error('User not logged in');
    }

    try {
      await mem0.add({
        messages: input.messages,
        userId: user.$id,
      });
    } catch (error) {
      console.error('Error saving memory to Mem0:', error);
      // Do not throw error to the client, just log it.
    }
  }
);
