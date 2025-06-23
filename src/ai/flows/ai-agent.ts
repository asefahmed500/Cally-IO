'use server';
/**
 * @fileOverview An AI content writing assistant.
 *
 * - researchAssistant - A function that handles user queries for content generation.
 * - ResearchAssistantInput - The input type for the researchAssistant function.
 * - ResearchAssistantOutput - The return type for the researchAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Placeholder for a real Keywords AI logging service
async function logToKeywordsAI(data: any) {
    console.log("Logging to Keywords AI:", data.input.query);
    // In a real implementation, you would use the API key to send data
    // to your Keywords AI endpoint.
    // const apiKey = process.env.KEYWORDS_AI_API_KEY;
    // await fetch('https://api.keywordsai.co/v1/log', {
    //     method: 'POST',
    //     headers: { 'Authorization': `Bearer ${apiKey}` },
    //     body: JSON.stringify(data)
    // });
}

const ResearchAssistantInputSchema = z.object({
  query: z.string().describe('The research query or content topic from the user.'),
  sessionId: z.string().describe('A unique identifier for the user session.'),
});
export type ResearchAssistantInput = z.infer<
  typeof ResearchAssistantInputSchema
>;

const ResearchAssistantOutputSchema = z.object({
  answer: z
    .string()
    .describe('The generated content or answer to the research query.'),
});
export type ResearchAssistantOutput = z.infer<
  typeof ResearchAssistantOutputSchema
>;

export async function researchAssistant(
  input: ResearchAssistantInput
): Promise<ResearchAssistantOutput> {
  return contentGeneratorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'contentGeneratorPrompt',
  input: {
    schema: z.object({ query: z.string() })
  },
  output: {
    schema: ResearchAssistantOutputSchema,
  },
  prompt: `You are an expert content writer and research assistant. Your goal is to generate high-quality, well-researched content based on the user's request.

Synthesize the information from your knowledge to create a comprehensive and engaging article or response.

User's Request: {{{query}}}`,
});

const contentGeneratorFlow = ai.defineFlow(
  {
    name: 'contentGeneratorFlow',
    inputSchema: ResearchAssistantInputSchema,
    outputSchema: ResearchAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt({ query: input.query });

    // Log the interaction to Keywords AI
    await logToKeywordsAI({
        input,
        output,
        timestamp: new Date().toISOString()
    });

    return output!;
  }
);
