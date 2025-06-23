'use server';
/**
 * @fileOverview Generates personalized news briefings.
 *
 * - generateNewsBriefing - A function that generates a news summary based on user interests.
 * - GenerateNewsBriefingInput - The input type for the generateNewsBriefing function.
 * - GenerateNewsBriefingOutput - The return type for the generateNewsBriefing function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNewsBriefingInputSchema = z.object({
  interests: z.array(z.string()).describe('A list of topics the user is interested in.'),
});
export type GenerateNewsBriefingInput = z.infer<
  typeof GenerateNewsBriefingInputSchema
>;

const GenerateNewsBriefingOutputSchema = z.object({
  briefing: z
    .string()
    .describe('A news briefing formatted in markdown, including headlines and short summaries.'),
});
export type GenerateNewsBriefingOutput = z.infer<
  typeof GenerateNewsBriefingOutputSchema
>;

export async function generateNewsBriefing(
  input: GenerateNewsBriefingInput
): Promise<GenerateNewsBriefingOutput> {
  return newsBriefingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'newsBriefingPrompt',
  input: {
    schema: GenerateNewsBriefingInputSchema
  },
  output: {
    schema: GenerateNewsBriefingOutputSchema,
  },
  prompt: `You are an expert news analyst and anchor. Your goal is to provide a clear, concise, and engaging news briefing based on the user's specified interests.

- Generate a summary of the top 3-5 news stories related to the provided interests.
- For each story, create a bold headline.
- Below the headline, write a 2-3 sentence summary of the key points.
- Structure the entire response in well-formatted markdown.
- Conclude with a friendly sign-off.
- You are generating this based on your internal knowledge up to your last training data. Acknowledge this limitation if a very recent event is requested.

User's Interests: {{{interests}}}`,
});

const newsBriefingFlow = ai.defineFlow(
  {
    name: 'newsBriefingFlow',
    inputSchema: GenerateNewsBriefingInputSchema,
    outputSchema: GenerateNewsBriefingOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return { briefing: output!.briefing };
  }
);
