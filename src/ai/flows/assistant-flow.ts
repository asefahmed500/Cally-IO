'use server';

/**
 * @fileOverview A general-purpose AI sales assistant.
 *
 * - runAssistant: A streaming function to get responses from the assistant.
 * - AssistantInputSchema: The input type for the runAssistant function.
 */

import {ai} from '@/ai/genkit';
import {generate} from 'genkit/generate';
import {stream} from 'genkit/stream';
import {z} from 'zod';

export const AssistantInputSchema = z.object({
  query: z.string(),
});

export type AssistantInput = z.infer<typeof AssistantInputSchema>;

const assistantPrompt = ai.definePrompt({
  name: 'assistantPrompt',
  input: {schema: AssistantInputSchema},
  prompt: `You are an expert sales assistant. Be helpful, concise, and professional.
  
  User query: {{{query}}}`,
});

export async function runAssistant(input: AssistantInput) {
  const llmResponse = await generate({
    prompt: assistantPrompt,
    input: input,
    model: 'googleai/gemini-1.5-flash-latest',
    stream: true,
  });

  return stream(async function* (stream) {
    for await (const chunk of llmResponse.stream()) {
      stream.chunk(chunk.text || '');
    }
  });
}
