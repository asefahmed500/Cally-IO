import { saveMemory } from '@/ai/flows/save-memory';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SaveMemoryRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.string(),
    })
  ),
});

export async function POST(req: NextRequest) {
  if (!process.env.MEMO_API_KEY) {
      return NextResponse.json({ message: 'Mem0 not configured' }, { status: 500 });
  }
  const request = await req.json();

  const validatedRequest = SaveMemoryRequestSchema.safeParse(request);
  if (!validatedRequest.success) {
    return new Response(JSON.stringify(validatedRequest.error), { status: 400 });
  }

  try {
    await saveMemory(validatedRequest.data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
