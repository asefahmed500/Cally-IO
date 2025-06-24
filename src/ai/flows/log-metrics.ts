'use server';
/**
 * @fileOverview Logs chat interaction metrics to Appwrite.
 * - logInteraction: Saves user feedback for a specific message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  appwriteDatabases,
  appwriteDatabaseId,
  appwriteMetricsCollectionId,
} from '@/lib/appwrite-client';
import { getLoggedInUser } from '@/lib/auth';
import { ID, Permission, Role } from 'appwrite';

export const LogInteractionInputSchema = z.object({
  messageId: z.string(),
  feedback: z.enum(['good', 'bad']),
});

export type LogInteractionInput = z.infer<typeof LogInteractionInputSchema>;

export const logInteraction = ai.defineFlow(
  {
    name: 'logInteractionFlow',
    inputSchema: LogInteractionInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const user = await getLoggedInUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!appwriteDatabaseId || !appwriteMetricsCollectionId) {
      console.warn('Appwrite metrics collection not configured. Skipping logging.');
      return;
    }

    try {
      const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
        Permission.read(Role.label('admin')), // Admins can read all metrics
      ];

      await appwriteDatabases.createDocument(
        appwriteDatabaseId,
        appwriteMetricsCollectionId,
        ID.unique(),
        {
          userId: user.$id,
          messageId: input.messageId,
          feedback: input.feedback,
        },
        permissions
      );
    } catch (error) {
      console.error('Error logging interaction to Appwrite:', error);
      // Don't throw to the client, just log it.
    }
  }
);
