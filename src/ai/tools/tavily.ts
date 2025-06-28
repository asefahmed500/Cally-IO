'use server';
import { ai } from '@/ai/genkit';
import Tavily from 'tavily-js';
import { z } from 'zod';

const tavilyApiKey = process.env.TAVILY_API_KEY;

let tavilyClient: Tavily | null = null;
if (tavilyApiKey) {
    tavilyClient = new Tavily(tavilyApiKey);
}

export const webSearch = ai.defineTool(
    {
        name: 'webSearch',
        description: 'Performs a web search using the Tavily search engine to answer questions about current events, competitors, or topics not found in internal documents. Only use this if you cannot answer from the provided context.',
        inputSchema: z.object({
            query: z.string().describe('The search query.'),
        }),
        outputSchema: z.string().describe('The search results in a concise, summarized JSON format.'),
    },
    async (input) => {
        if (!tavilyClient) {
            return 'Web search is not configured. Please set the TAVILY_API_KEY environment variable.';
        }
        try {
            const response = await tavilyClient.search(input.query, {
                maxResults: 5,
                includeRawContent: false,
            });
            return JSON.stringify(response.results);
        } catch (error) {
            console.error('Tavily search failed:', error);
            return 'An error occurred during the web search.';
        }
    }
);
