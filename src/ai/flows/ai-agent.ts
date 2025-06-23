'use server';
/**
 * @fileOverview An AI agent that provides accurate and comprehensive answers by combining
 * information from the company's knowledge base and real-time web search.
 *
 * - accurateComprehensiveAnswers - A function that handles the process of answering questions.
 * - AccurateComprehensiveAnswersInput - The input type for the accurateComprehensiveAnswers function.
 * - AccurateComprehensiveAnswersOutput - The return type for the accurateComprehensiveAnswers function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AccurateComprehensiveAnswersInputSchema = z.object({
  query: z.string().describe('The question from the customer.'),
  companyDocs: z.string().describe('Relevant information retrieved from the company documents.'),
});
export type AccurateComprehensiveAnswersInput = z.infer<typeof AccurateComprehensiveAnswersInputSchema>;

const AccurateComprehensiveAnswersOutputSchema = z.object({
  answer: z.string().describe('The comprehensive answer to the question.'),
  sources: z.array(z.string()).describe('A list of sources used to generate the answer.'),
});
export type AccurateComprehensiveAnswersOutput = z.infer<typeof AccurateComprehensiveAnswersOutputSchema>;

export async function accurateComprehensiveAnswers(input: AccurateComprehensiveAnswersInput): Promise<AccurateComprehensiveAnswersOutput> {
  return accurateComprehensiveAnswersFlow(input);
}

const webSearch = ai.defineTool({
  name: 'webSearch',
  description: 'Searches the web for current information.',
  inputSchema: z.object({
    query: z.string().describe('The search query.'),
  }),
  outputSchema: z.string(),
  async handler(input) {
    // In a real implementation, this would call an actual web search API like Tavily.
    // For this example, we'll just return a placeholder response.
    return `Web search results for "${input.query}": Placeholder web search results.`;
  },
});

const prompt = ai.definePrompt({
  name: 'accurateComprehensiveAnswersPrompt',
  input: {schema: AccurateComprehensiveAnswersInputSchema},
  output: {schema: AccurateComprehensiveAnswersOutputSchema},
  tools: [webSearch],
  prompt: `You are an AI customer support agent for Cally-IO. Your goal is to provide accurate and comprehensive answers to customer questions.

  You have access to the following information:
  - Company Documents: {{{companyDocs}}}
  - A web search tool to search for current information.

  Instructions:
  1. Use the company documents as the primary source of information.
  2. If the answer is not found in the company documents, use the web search tool to find current information.
  3. Combine information from both sources to provide a comprehensive and up-to-date answer.
  4. Cite all sources used to generate the answer.

  Question: {{{query}}}`,
});

const accurateComprehensiveAnswersFlow = ai.defineFlow(
  {
    name: 'accurateComprehensiveAnswersFlow',
    inputSchema: AccurateComprehensiveAnswersInputSchema,
    outputSchema: AccurateComprehensiveAnswersOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
