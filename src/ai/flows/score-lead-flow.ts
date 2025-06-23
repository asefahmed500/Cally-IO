'use server';

/**
 * @fileOverview An AI flow for scoring sales leads.
 * - scoreLead: A function that analyzes lead data and returns a score and rationale.
 * - LeadDataSchema: The input schema for the lead data.
 * - LeadScoreSchema: The output schema for the lead score.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const LeadDataSchema = z.object({
  companyName: z.string().describe('The name of the company.'),
  companyDescription: z.string().describe('A brief description of the company and what it does.'),
  contactTitle: z.string().describe("The job title of the contact person."),
  industry: z.string().describe('The industry the company operates in.'),
});
export type LeadData = z.infer<typeof LeadDataSchema>;

export const LeadScoreSchema = z.object({
  score: z.number().min(0).max(100).describe('The lead score from 0 to 100.'),
  rationale: z.string().describe('A brief rationale for the assigned score, explaining the key factors.'),
});
export type LeadScore = z.infer<typeof LeadScoreSchema>;

const leadScoringPrompt = ai.definePrompt({
  name: 'leadScoringPrompt',
  input: { schema: LeadDataSchema },
  output: { schema: LeadScoreSchema },
  prompt: `You are an expert sales analyst. Your task is to score a new sales lead based on the provided information. 
  
  A higher score indicates a better fit and higher priority. A decision-maker (like a VP, Director, or C-level executive) at a company in a high-growth industry (like tech, SaaS, or AI) should get a high score. A junior employee at a company in a slow-moving industry should get a low score.

  Analyze the following lead data and provide a score from 0-100 and a brief rationale for your decision.

  LEAD DATA:
  - Company: {{{companyName}}}
  - Description: {{{companyDescription}}}
  - Contact Title: {{{contactTitle}}}
  - Industry: {{{industry}}}
  `,
});

const scoreLeadFlow = ai.defineFlow(
  {
    name: 'scoreLeadFlow',
    inputSchema: LeadDataSchema,
    outputSchema: LeadScoreSchema,
  },
  async (input) => {
    const { output } = await leadScoringPrompt(input);
    return output!;
  }
);

export async function scoreLead(input: LeadData): Promise<LeadScore> {
  return scoreLeadFlow(input);
}
