import { assistantFlow } from '@/ai/flows/assistant-flow';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return new NextResponse('Bad Request: query is required', { status: 400 });
    }

    const stream = await assistantFlow({ query });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('[API Chat] Error:', error);
    // Provide a more descriptive error message to the client
    const errorMessage = error.message || 'An unexpected error occurred.';
    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
