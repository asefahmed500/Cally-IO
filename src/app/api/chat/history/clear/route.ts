import { getLoggedInUser } from '@/lib/auth';
import { saveConversationHistory } from '@/lib/conversation';
import { NextResponse } from 'next/server';

export async function POST() {
  const user = await getLoggedInUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await saveConversationHistory(user.$id, []);
    return NextResponse.json({ success: true, message: 'Chat history cleared.' });
  } catch (error) {
    console.error('Failed to clear chat history:', error);
    return new Response('Error clearing history', { status: 500 });
  }
}
