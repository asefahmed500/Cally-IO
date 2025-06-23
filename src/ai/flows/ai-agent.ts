'use server';
/**
 * @fileOverview An AI business analyst agent.
 *
 * - businessAnalyst - A function that handles user queries for business analysis.
 * - BusinessAnalystInput - The input type for the businessAnalyst function.
 * - BusinessAnalystOutput - The return type for the businessAnalyst function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Placeholder for a real Keywords AI logging service
async function logToKeywordsAI(data: any) {
    console.log("Logging to Keywords AI:", data.input.query);
    const apiKey = process.env.KEYWORDS_AI_API_KEY;
    if (apiKey) {
      // In a real implementation, you would send data to your Keywords AI endpoint.
      // await fetch('https://api.keywordsai.co/v1/log', {
      //     method: 'POST',
      //     headers: { 'Authorization': `Bearer ${apiKey}` },
      //     body: JSON.stringify(data)
      // });
    }
}

const BusinessAnalystInputSchema = z.object({
  query: z.string().describe('The business query or data to be analyzed.'),
  sessionId: z.string().describe('A unique identifier for the user session.'),
});
export type BusinessAnalystInput = z.infer<
  typeof BusinessAnalystInputSchema
>;

const BusinessAnalystOutputSchema = z.object({
  analysis: z
    .string()
    .describe('The generated analysis and insights for the business query.'),
});
export type BusinessAnalystOutput = z.infer<
  typeof BusinessAnalystOutputSchema
>;

export async function businessAnalyst(
  input: BusinessAnalystInput
): Promise<BusinessAnalystOutput> {
  return businessAnalystFlow(input);
}

const prompt = ai.definePrompt({
  name: 'businessAnalystPrompt',
  input: {
    schema: z.object({ query: z.string() })
  },
  output: {
    schema: BusinessAnalystOutputSchema,
  },
  prompt: `You are an expert business analyst and market researcher. Your goal is to provide insightful, data-driven analysis based on the user's request.

Analyze the provided data or query to identify key trends, generate actionable insights, and answer business questions. If the user asks about market trends, use your extensive knowledge base to provide the most relevant and up-to-date information possible.

Structure your response in a clear, professional format. Use markdown for formatting, such as headings, lists, and bold text, to improve readability.

User's Request: {{{query}}}`,
});

const businessAnalystFlow = ai.defineFlow(
  {
    name: 'businessAnalystFlow',
    inputSchema: BusinessAnalystInputSchema,
    outputSchema: BusinessAnalystOutputSchema,
  },
  async (input) => {
    const { output } = await prompt({ query: input.query });

    // Log the interaction to Keywords AI
    await logToKeywordsAI({
        input,
        output,
        timestamp: new Date().toISOString()
    });

    return { analysis: output!.analysis };
  }
);
