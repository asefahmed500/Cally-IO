import { getLoggedInUser } from '@/lib/auth';
import { getConversationHistory } from '@/lib/conversation';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getLoggedInUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const history = await getConversationHistory(user.$id);
    return NextResponse.json(history);
  } catch (error: any) {
    console.error('Failed to fetch chat history:', error);
    return new Response('Error fetching history', { status: 500 });
  }
}
