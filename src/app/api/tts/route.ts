import { generateSpeech } from '@/ai/flows/text-to-speech';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getLoggedInUser } from '@/lib/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const TTSRequestSchema = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const user = await getLoggedInUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const limit = await rateLimit(user.$id, 'tts');
  if (!limit.ok) return tooManyRequests(limit);

  try {
    const request = await req.json();

    const validatedRequest = TTSRequestSchema.safeParse(request);
    if (!validatedRequest.success) {
      return new Response('Invalid request: "text" field is required.', { status: 400 });
    }

    const result = await generateSpeech(validatedRequest.data.text);

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return new Response('Invalid JSON in request body.', { status: 400 });
    }
    console.error('Error in TTS route:', error);
    return new Response('An error occurred while generating speech.', { status: 500 });
  }
}
