'use server';
/**
 * @fileOverview Generates dynamic call scripts for sales representatives.
 *
 * - generateCallScript - A function that generates a personalized call script based on company documents and conversation history.
 * - GenerateCallScriptInput - The input type for the generateCallScript function.
 * - GenerateCallScriptOutput - The return type for the generateCallScript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCallScriptInputSchema = z.object({
  companyDocuments: z
    .string()
    .describe('Company documents and product information.'),
  conversationHistory: z
    .string()
    .describe('Previous chat interactions with the lead.'),
  leadProfile: z.string().describe('Lead scoring and profile data.'),
});
export type GenerateCallScriptInput = z.infer<typeof GenerateCallScriptInputSchema>;

const GenerateCallScriptOutputSchema = z.object({
  callScript: z.string().describe('A personalized call script for the lead.'),
});
export type GenerateCallScriptOutput = z.infer<typeof GenerateCallScriptOutputSchema>;

export async function generateCallScript(input: GenerateCallScriptInput): Promise<GenerateCallScriptOutput> {
  return generateCallScriptFlow(input);
}

const generateCallScriptPrompt = ai.definePrompt({
  name: 'generateCallScriptPrompt',
  input: {schema: GenerateCallScriptInputSchema},
  output: {schema: GenerateCallScriptOutputSchema},
  prompt: `You are an expert sales script generator. Generate a personalized call script for a sales representative based on the following information:

Company Documents: {{{companyDocuments}}}

Conversation History: {{{conversationHistory}}}

Lead Profile: {{{leadProfile}}}

Call Script:`, // Removed unnecessary 'tools' property
});

const generateCallScriptFlow = ai.defineFlow(
  {
    name: 'generateCallScriptFlow',
    inputSchema: GenerateCallScriptInputSchema,
    outputSchema: GenerateCallScriptOutputSchema,
  },
  async input => {
    const {output} = await generateCallScriptPrompt(input);
    return output!;
  }
);
