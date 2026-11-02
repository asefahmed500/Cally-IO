'use server';

/**
 * Logs chat interaction metrics (thumbs up / down feedback) to PostgreSQL.
 */

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getLoggedInUser } from '@/lib/auth';
import { requireWorkspace } from '@/lib/tenant';

const LogInteractionInputSchema = z.object({
  messageId: z.string(),
  feedback: z.enum(['good', 'bad']),
  prompt: z.string().optional(),
});

export type LogInteractionInput = z.infer<typeof LogInteractionInputSchema>;

export async function logInteraction(input: LogInteractionInput): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Best-effort tenant attribution: chat also works without a workspace.
    let workspaceId: string | null = null;
    try {
      workspaceId = (await requireWorkspace()).workspaceId;
    } catch {
      workspaceId = null;
    }

    await prisma.metric.create({
      data: {
        userId: user.$id,
        messageId: input.messageId,
        feedback: input.feedback,
        prompt: input.prompt ?? null,
        workspaceId,
      },
    });
  } catch (error) {
    // Don't throw to the client, just log it.
    console.error('Error logging interaction:', error);
  }
}
