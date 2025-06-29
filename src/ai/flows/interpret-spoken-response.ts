
'use server';
/**
 * @fileOverview An AI flow to interpret the intent of a spoken response from a Twilio call.
 * - interpretSpokenResponse: The main function to classify the response.
 * - InterpretSpokenResponseOutputSchema: The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const InterpretSpokenResponseOutputSchema = z.object({
  intent: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'ESCALATE'])
    .describe('The classified intent of the spoken response.'),
  summary: z.string()
    .describe('A brief, one-sentence summary of what the lead said.'),
  finalMessage: z.string()
    .describe('A polite, final message to say to the lead before hanging up, based on their intent.')
});
export type InterpretSpokenResponseOutput = z.infer<typeof InterpretSpokenResponseOutputSchema>;

export const interpretSpokenResponse = ai.defineFlow(
  {
    name: 'interpretSpokenResponseFlow',
    inputSchema: z.string(),
    outputSchema: InterpretSpokenResponseOutputSchema,
  },
  async (transcript) => {
    const prompt = `You are an expert at understanding sales call transcripts. Your task is to analyze the following spoken response from a lead and determine their intent.

**Transcript:**
"${transcript}"

**Instructions:**
1.  Read the transcript carefully.
2.  Classify the lead's intent into one of four categories:
    *   'POSITIVE': The lead expresses clear interest (e.g., "yes", "that sounds great", "I'd like to learn more").
    *   'NEGATIVE': The lead expresses clear disinterest (e.g., "no", "not interested", "remove me from your list").
    *   'NEUTRAL': The lead is non-committal or asks for more information (e.g., "maybe", "I'm not sure", "can you send an email?").
    *   'ESCALATE': The lead is confused, angry, or the response is unclear/garbled.
3.  Provide a one-sentence summary of what the lead said.
4.  Write a final, polite message to say to the lead before hanging up. This message should acknowledge their response.

**Example for "Yes, that sounds interesting":**
- intent: 'POSITIVE'
- summary: "The lead expressed interest in learning more."
- finalMessage: "That's great to hear. A specialist will be in touch with you shortly. Thank you for your time. Goodbye."

**Example for "No thanks, I'm not the right person":**
- intent: 'NEGATIVE'
- summary: "The lead indicated they are not interested and not the right contact."
- finalMessage: "I understand. Thank you for your time. Goodbye."
`;

    const llmResponse = await ai.generate({
      prompt: prompt,
      model: 'googleai/gemini-1.5-flash-latest',
      output: {
        schema: InterpretSpokenResponseOutputSchema
      }
    });

    return llmResponse.output!;
  }
);
