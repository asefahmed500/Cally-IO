'use server';

/**
 * @fileOverview An AI flow for generating sales call scripts.
 * - generateScript: A function that analyzes lead data and returns a personalized call script.
 * - LeadDataSchema: The input schema for the lead data (re-used from score-lead-flow).
 * - CallScriptSchema: The output schema for the generated call script.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { LeadDataSchema, type LeadData } from './score-lead-flow';

export const CallScriptSchema = z.object({
  script: z.string().describe('The full, personalized sales call script.'),
});
export type CallScript = z.infer<typeof CallScriptSchema>;

const scriptGenerationPrompt = ai.definePrompt({
  name: 'scriptGenerationPrompt',
  input: { schema: LeadDataSchema },
  output: { schema: CallScriptSchema },
  prompt: `You are an expert sales strategist specializing in cold calling. Your task is to generate a personalized call script based on the provided lead information.

  The script should be professional, concise, and engaging. It must include:
  1. A compelling opening that grabs attention.
  2. A brief introduction of the caller's purpose.
  3. Mention of the lead's company or industry to show you've done research.
  4. A key value proposition tailored to their potential needs.
  5. An open-ended question to encourage conversation.
  6. A clear call-to-action for the next step.

  LEAD DATA:
  - Company: {{{companyName}}}
  - Description: {{{companyDescription}}}
  - Contact Title: {{{contactTitle}}}
  - Industry: {{{industry}}}
  `,
});

const generateScriptFlow = ai.defineFlow(
  {
    name: 'generateScriptFlow',
    inputSchema: LeadDataSchema,
    outputSchema: CallScriptSchema,
  },
  async (input) => {
    const { output } = await scriptGenerationPrompt(input);
    return output!;
  }
);

export async function generateScript(input: LeadData): Promise<CallScript> {
  return generateScriptFlow(input);
}
