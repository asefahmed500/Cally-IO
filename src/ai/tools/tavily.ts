
'use server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const tavilyApiKey = process.env.TAVILY_API_KEY;

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
        if (!tavilyApiKey) {
            return 'Web search is not configured. Please set the TAVILY_API_KEY environment variable.';
        }
        try {
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: tavilyApiKey,
                    query: input.query,
                    search_depth: "basic",
                    max_results: 5,
                    include_raw_content: false,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Tavily API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            return JSON.stringify(data.results);
        } catch (error: any) {
            console.error('Tavily search failed:', error);
            return `An error occurred during the web search: ${error.message}`;
        }
    }
);
