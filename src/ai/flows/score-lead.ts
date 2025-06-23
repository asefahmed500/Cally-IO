'use server';
/**
 * @fileOverview An AI flow for scoring sales leads.
 * - scoreLead: Scores a lead based on provided data.
 * - ScoreLeadInput: The input type for the flow.
 * - ScoreLeadOutput: The return type for the flow.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input Schema
export const ScoreLeadInputSchema = z.object({
  company: z.string().describe("The name of the lead's company."),
  title: z.string().describe("The job title of the lead."),
  industry: z.string().describe("The industry of the lead's company."),
  companyDescription: z.string().optional().describe('A brief description of the company.'),
});
export type ScoreLeadInput = z.infer<typeof ScoreLeadInputSchema>;

// Output Schema
export const ScoreLeadOutputSchema = z.object({
  score: z.number().min(1).max(100).describe('The lead score from 1 to 100.'),
  category: z.enum(['Hot', 'Warm', 'Cold']).describe('The category of the lead based on the score.'),
  rationale: z.string().describe('A brief explanation for the assigned score and category.'),
});
export type ScoreLeadOutput = z.infer<typeof ScoreLeadOutputSchema>;

// Main exported function
export async function scoreLead(input: ScoreLeadInput): Promise<ScoreLeadOutput> {
  return scoreLeadFlow(input);
}

// Genkit Flow
const scoreLeadFlow = ai.defineFlow(
  {
    name: 'scoreLeadFlow',
    inputSchema: ScoreLeadInputSchema,
    outputSchema: ScoreLeadOutputSchema,
  },
  async (input) => {
    const prompt = `You are an expert Sales Development Representative (SDR) and your job is to score new leads based on how likely they are to become a customer.

    Analyze the following lead information and provide a score from 1-100.
    - A 'Hot' lead (score 80-100) is an ideal customer profile, likely a decision-maker in a relevant industry.
    - A 'Warm' lead (score 50-79) is a good fit, might be an influencer or in a slightly less relevant industry.
    - A 'Cold' lead (score 1-49) is a poor fit, unlikely to be a decision-maker or in a completely irrelevant industry.

    Provide a brief rationale for your scoring.

    Lead Information:
    - Company: ${input.company}
    - Job Title: ${input.title}
    - Industry: ${input.industry}
    ${input.companyDescription ? `- Company Description: ${input.companyDescription}` : ''}
    `;

    const { output } = await ai.generate({
      prompt,
      model: 'googleai/gemini-1.5-flash-latest',
      output: {
        schema: ScoreLeadOutputSchema,
      },
    });

    return output!;
  }
);
