'use server';

/**
 * @fileOverview An AI flow for generating personalized sales call scripts and audio previews.
 * - generateScriptAndAudio: The main function to trigger the flow.
 * - ScriptGeneratorInput: The input type for the flow.
 * - ScriptGeneratorOutput: The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import wav from 'wav';
import { googleAI } from '@genkit-ai/googleai';

// Input Schema
const ScriptGeneratorInputSchema = z.object({
  leadName: z.string().describe('The name of the lead to call.'),
  title: z.string().describe('The job title of the lead.'),
  companyName: z.string().describe('The company the lead works for.'),
  companyDescription: z.string().describe('A brief description of the company.'),
});
export type ScriptGeneratorInput = z.infer<typeof ScriptGeneratorInputSchema>;

// Output Schema
const ScriptGeneratorOutputSchema = z.object({
  scriptText: z.string().describe('The generated call script text.'),
  audioDataUri: z.string().describe("A data URI of the generated audio in WAV format. Expected format: 'data:audio/wav;base64,<encoded_data>'."),
});
export type ScriptGeneratorOutput = z.infer<typeof ScriptGeneratorOutputSchema>;

// Main exported function
export async function generateScriptAndAudio(input: ScriptGeneratorInput): Promise<ScriptGeneratorOutput> {
  return scriptGeneratorFlow(input);
}

// Genkit Prompt for generating the script text
const scriptPrompt = ai.definePrompt({
  name: 'scriptGeneratorPrompt',
  input: { schema: ScriptGeneratorInputSchema },
  prompt: `You are an expert sales script writer. Your task is to generate a concise, engaging, and professional cold call script.

The goal is to introduce our company, build rapport, and secure a 15-minute follow-up meeting.

**Lead Information:**
- Name: {{{leadName}}}
- Title: {{{title}}}
- Company: {{{companyName}}}
- Company Description: {{{companyDescription}}}

**Script Requirements:**
1.  **Opening:** Start with a friendly and respectful opening. Acknowledge their role.
2.  **Introduction:** Briefly introduce yourself and "LeadKit", a smart sales automation platform.
3.  **Value Proposition:** Connect LeadKit's value to their company. For example, mention how it can help a "{{{title}}}" at a company like "{{{companyName}}}" to improve their outreach and close deals more efficiently.
4.  **Call to Action:** The primary goal is to ask for a 15-minute discovery call later in the week. Propose a specific day or ask for their availability.
5.  **Closing:** End with a polite closing.

Keep the entire script under 150 words. Do not include placeholders like "[Your Name]" or "[Your Company]". The script should be ready to be read aloud.
`,
});

// Helper function to convert raw PCM audio data to WAV format
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));

    writer.write(pcmData);
    writer.end();
  });
}

// Genkit Flow
const scriptGeneratorFlow = ai.defineFlow(
  {
    name: 'scriptGeneratorFlow',
    inputSchema: ScriptGeneratorInputSchema,
    outputSchema: ScriptGeneratorOutputSchema,
  },
  async (input) => {
    // Step 1: Generate the script text
    const scriptResponse = await scriptPrompt(input);
    const scriptText = scriptResponse.output!;

    // Step 2: Generate the audio from the script text
    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' }, // A professional-sounding voice
          },
        },
      },
      prompt: scriptText,
    });

    if (!media) {
      throw new Error('No audio media was returned from the TTS model.');
    }

    // Step 3: Convert the raw audio data to WAV format
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    const wavBase64 = await toWav(audioBuffer);
    const audioDataUri = 'data:audio/wav;base64,' + wavBase64;

    // Step 4: Return both the script and the audio data URI
    return {
      scriptText,
      audioDataUri,
    };
  }
);
