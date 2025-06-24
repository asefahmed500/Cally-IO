import { generateSpeech } from '@/ai/flows/text-to-speech';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const TTSRequestSchema = z.object({
  text: z.string(),
});

export async function POST(req: Request) {
  try {
    const request = await req.json();

    const validatedRequest = TTSRequestSchema.safeParse(request);
    if (!validatedRequest.success) {
      return new Response('Invalid request: "text" field is required.', { status: 400 });
    }

    const result = await generateSpeech(validatedRequest.data);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in TTS route:', error);
    return new Response(`An error occurred: ${error.message}`, { status: 500 });
  }
}
