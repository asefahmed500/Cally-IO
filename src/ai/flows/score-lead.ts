'use server';
/**
 * @fileOverview An AI flow for generating personalized sales scripts and audio previews.
 * - generateScriptAndAudio: Creates a script and audio for a given lead.
 * - GenerateScriptAndAudioInput: The input type for the flow.
 * - GenerateScriptAndAudioOutput: The return type for the flow.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import wav from 'wav';
import { googleAI } from '@genkit-ai/googleai';

// Input Schema
export const GenerateScriptAndAudioInputSchema = z.object({
  name: z.string().describe("The name of the lead."),
  company: z.string().describe("The name of the lead's company."),
  title: z.string().describe("The job title of the lead."),
  industry: z.string().optional().describe("The industry of the lead's company."),
});
export type GenerateScriptAndAudioInput = z.infer<typeof GenerateScriptAndAudioInputSchema>;

// Output Schema
export const GenerateScriptAndAudioOutputSchema = z.object({
  script: z.string().describe('The generated call script.'),
  audioDataUri: z.string().describe('The generated audio as a data URI.'),
});
export type GenerateScriptAndAudioOutput = z.infer<typeof GenerateScriptAndAudioOutputSchema>;

// Main exported function
export async function generateScriptAndAudio(input: GenerateScriptAndAudioInput): Promise<GenerateScriptAndAudioOutput> {
  return generateScriptAndAudioFlow(input);
}

// Helper to convert PCM audio buffer to WAV format
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
const generateScriptAndAudioFlow = ai.defineFlow(
  {
    name: 'generateScriptAndAudioFlow',
    inputSchema: GenerateScriptAndAudioInputSchema,
    outputSchema: GenerateScriptAndAudioOutputSchema,
  },
  async (input) => {
    // Step 1: Generate the call script
    const scriptPrompt = `You are an expert sales script writer. Your task is to generate a compelling and personalized cold call script.

    The goal is to grab the prospect's attention, introduce our product (LeadKit, an AI-powered sales co-pilot), and secure a 15-minute discovery call.

    Be concise, professional, and friendly.

    Lead Information:
    - Name: ${input.name}
    - Company: ${input.company}
    - Title: ${input.title}
    ${input.industry ? `- Industry: ${input.industry}` : ''}

    Generate the script text only.
    `;

    const { output: scriptOutput } = await ai.generate({
      prompt: scriptPrompt,
      model: 'googleai/gemini-1.5-flash-latest',
    });
    
    const script = scriptOutput?.text;
    if (!script) {
        throw new Error('Failed to generate script.');
    }

    // Step 2: Convert the script to speech
    const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Algenib' },
                },
            },
        },
        prompt: script,
    });

    if (!media) {
      throw new Error('No media returned from TTS model');
    }
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    
    // Step 3: Convert audio to WAV format
    const wavBase64 = await toWav(audioBuffer);
    const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

    return {
      script,
      audioDataUri,
    };
  }
);
