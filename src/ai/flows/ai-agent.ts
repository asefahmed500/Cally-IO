'use server';
/**
 * @fileOverview An AI-powered learning companion.
 *
 * - learningCompanion - A function that acts as a tutor to explain topics.
 * - LearningCompanionInput - The input type for the learningCompanion function.
 * - LearningCompanionOutput - The return type for the learningCompanion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LearningCompanionInputSchema = z.object({
  query: z.string().describe('The topic or question the user wants to learn about.'),
  sessionId: z.string().describe('A unique identifier for the user session.'),
});
export type LearningCompanionInput = z.infer<
  typeof LearningCompanionInputSchema
>;

const LearningCompanionOutputSchema = z.object({
  explanation: z
    .string()
    .describe('The generated explanation for the given topic or question.'),
});
export type LearningCompanionOutput = z.infer<
  typeof LearningCompanionOutputSchema
>;

export async function learningCompanion(
  input: LearningCompanionInput
): Promise<LearningCompanionOutput> {
  return learningCompanionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'learningCompanionPrompt',
  input: {
    schema: z.object({ query: z.string() })
  },
  output: {
    schema: LearningCompanionOutputSchema,
  },
  prompt: `You are a friendly and encouraging AI Learning Companion. Your goal is to help users understand complex topics by breaking them down into simple, easy-to-digest explanations.

- Start by acknowledging the user's question.
- Provide a clear, concise, and accurate explanation of the topic.
- Use analogies and simple examples to make the content relatable.
- Ask a follow-up question to check for understanding or to encourage further exploration of the topic.
- Structure your response in a clear, professional format. Use markdown for formatting, such as headings, lists, and bold text, to improve readability.

User's Request: {{{query}}}`,
});

const learningCompanionFlow = ai.defineFlow(
  {
    name: 'learningCompanionFlow',
    inputSchema: LearningCompanionInputSchema,
    outputSchema: LearningCompanionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt({ query: input.query });

    return { explanation: output!.explanation };
  }
);
