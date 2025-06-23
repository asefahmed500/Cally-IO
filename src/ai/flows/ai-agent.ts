'use server';
/**
 * @fileOverview A helpful AI assistant.
 *
 * - researchAssistant - A function that handles user queries.
 * - ResearchAssistantInput - The input type for the researchAssistant function.
 * - ResearchAssistantOutput - The return type for the researchAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Update schema to reflect a more generic assistant
const ResearchAssistantInputSchema = z.object({
  query: z.string().describe('The research query from the user.'),
});
export type ResearchAssistantInput = z.infer<
  typeof ResearchAssistantInputSchema
>;

// Remove sources from the output, as web search is disabled.
const ResearchAssistantOutputSchema = z.object({
  answer: z
    .string()
    .describe('The comprehensive answer to the research query.'),
  sources: z
    .array(z.string())
    .describe('A list of web sources used to generate the answer.')
    .optional(),
});
export type ResearchAssistantOutput = z.infer<
  typeof ResearchAssistantOutputSchema
>;

// Rename exported function for clarity
export async function researchAssistant(
  input: ResearchAssistantInput
): Promise<ResearchAssistantOutput> {
  return researchAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'researchAssistantPrompt',
  input: {
    schema: ResearchAssistantInputSchema,
  },
  output: {schema: ResearchAssistantOutputSchema},
  prompt: `You are a world-class AI assistant. Your purpose is to provide accurate, and helpful answers to user queries based on your internal knowledge.

User's Query: {{{query}}}`,
});

const researchAssistantFlow = ai.defineFlow(
  {
    name: 'researchAssistantFlow',
    inputSchema: ResearchAssistantInputSchema,
    outputSchema: ResearchAssistantOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
