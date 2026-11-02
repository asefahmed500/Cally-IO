import { prisma } from '@/lib/prisma';

/**
 * Logs when a document is used as context for an AI response.
 * Fire-and-forget: failures are logged but never thrown.
 */
export async function logDocumentUsage(
  userId: string,
  sources: { documentId: string; fileName: string }[],
  workspaceId?: string
) {
  try {
    await prisma.analyticsLog.create({
      data: {
        eventType: 'DOCUMENT_USED',
        eventData: { sources } as object,
        userId,
        workspaceId: workspaceId ?? null,
      },
    });
  } catch (e) {
    console.error('Failed to log document usage:', e);
  }
}
