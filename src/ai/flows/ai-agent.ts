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

// The sessionId is kept for client-side state management (localStorage)
const ResearchAssistantInputSchema = z.object({
  query: z.string().describe('The research query from the user.'),
  sessionId: z.string().describe('A unique identifier for the user session.'),
});
export type ResearchAssistantInput = z.infer<
  typeof ResearchAssistantInputSchema
>;

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

export async function researchAssistant(
  input: ResearchAssistantInput
): Promise<ResearchAssistantOutput> {
  return researchAssistantFlow(input);
}

const PromptInputSchema = z.object({
    query: z.string(),
});

const prompt = ai.definePrompt({
  name: 'researchAssistantPrompt',
  input: {
    schema: PromptInputSchema,
  },
  output: {schema: ResearchAssistantOutputSchema},
  prompt: `You are a world-class AI assistant. Your purpose is to provide accurate, and helpful answers to user queries.

User's Query: {{{query}}}`,
});

const researchAssistantFlow = ai.defineFlow(
  {
    name: 'researchAssistantFlow',
    inputSchema: ResearchAssistantInputSchema,
    outputSchema: ResearchAssistantOutputSchema,
  },
  async (input) => {
    // Mem0 functionality has been removed due to installation issues.
    // The assistant will not have long-term memory for now.
    
    const {output} = await prompt({ 
        query: input.query,
    });
    
    return output!;
  }
);
