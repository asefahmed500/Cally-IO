import { prisma } from '@/lib/prisma';

export type ChatMessage = {
  role: 'user' | 'model';
  content: string;
  id: string;
  image?: string;
};

/** Returns the chat history for a user (empty array when none exists). */
export async function getConversationHistory(userId: string): Promise<ChatMessage[]> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { userId },
    });
    if (!conversation || !Array.isArray(conversation.history)) return [];
    return conversation.history as unknown as ChatMessage[];
  } catch (error) {
    console.error(`Failed to load conversation for user ${userId}:`, error);
    return [];
  }
}

/** Creates or replaces the chat history for a user. */
export async function saveConversationHistory(userId: string, history: ChatMessage[]): Promise<void> {
  await prisma.conversation.upsert({
    where: { userId },
    update: { history: history as unknown as object[] },
    create: { userId, history: history as unknown as object[] },
  });
}
