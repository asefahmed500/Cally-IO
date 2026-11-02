/**
 * Text-to-Speech using the Gemini TTS model via the Google Generative
 * Language REST API (free tier). Returns a WAV data URI.
 */

import wav from 'wav';

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_VOICE = 'Algenib';

async function toWavDataUri(
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

    const bufs: Buffer[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));

    writer.write(pcmData);
    writer.end();
  });
}

export async function generateSpeech(text: string): Promise<{ audioDataUri: string }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not configured on the server.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: TTS_VOICE },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const audioBase64 = data?.candidates?.[0]?.content?.parts?.find(
    (part: any) => part?.inlineData?.data
  )?.inlineData?.data;

  if (!audioBase64) {
    throw new Error('No audio data was returned from the AI model.');
  }

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const wavBase64 = await toWavDataUri(audioBuffer);
  return { audioDataUri: `data:audio/wav;base64,${wavBase64}` };
}
