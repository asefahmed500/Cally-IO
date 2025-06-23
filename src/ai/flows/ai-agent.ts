'use server';
/**
 * @fileOverview An AI agent that provides accurate and comprehensive answers by combining
 * information from the company's knowledge base, real-time web search, and conversation history.
 *
 * - accurateComprehensiveAnswers - A function that handles the process of answering questions.
 * - AccurateComprehensiveAnswersInput - The input type for the accurateComprehensiveAnswers function.
 * - AccurateComprehensiveAnswersOutput - The return type for the accurateComprehensiveAnswers function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import Tavily from 'tavily';

const AccurateComprehensiveAnswersInputSchema = z.object({
  query: z.string().describe('The question from the customer.'),
  companyDocs: z.string().describe('Relevant information retrieved from the company documents.'),
  sessionId: z.string().describe('A unique identifier for the current conversation session.'),
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
  async handler({ query }) {
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
        console.error('Tavily API key is not set.');
        return 'Web search is disabled. API key is missing.';
    }
    const tavily = new Tavily(tavilyApiKey);

    try {
        const searchResult = await tavily.search(query, { maxResults: 5 });
        return JSON.stringify(searchResult.results);
    } catch (e) {
        console.error('Tavily search error', e);
        return 'Web search failed.';
    }
  },
});

const prompt = ai.definePrompt({
  name: 'accurateComprehensiveAnswersPrompt',
  input: {schema: AccurateComprehensiveAnswersInputSchema.extend({ conversationHistory: z.string() })},
  output: {schema: AccurateComprehensiveAnswersOutputSchema},
  tools: [webSearch],
  prompt: `You are an AI customer support agent for Cally-IO. Your goal is to provide accurate and comprehensive answers to customer questions. You must be friendly and conversational.

  You have access to the following information:
  - Company Documents: {{{companyDocs}}}
  - Conversation History: {{{conversationHistory}}}
  - A web search tool to search for current information.

  Instructions:
  1. Use the conversation history to understand the context of the user's question.
  2. Use the company documents as the primary source of information.
  3. If the answer is not in the company documents or the user is asking about recent events, use the web search tool to find current information.
  4. Combine information from all sources to provide a comprehensive and up-to-date answer.
  5. Cite all sources used to generate the answer.

  Question: {{{query}}}`,
});

const accurateComprehensiveAnswersFlow = ai.defineFlow(
  {
    name: 'accurateComprehensiveAnswersFlow',
    inputSchema: AccurateComprehensiveAnswersInputSchema,
    outputSchema: AccurateComprehensiveAnswersOutputSchema,
  },
  async input => {
    // NOTE: Conversation history from Mem0 is temporarily disabled due to a package installation issue.
    const conversationHistory = '';

    const {output} = await prompt({ ...input, conversationHistory });
    
    return output!;
  }
);
