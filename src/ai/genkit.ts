import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Conditionally initialize the plugin to prevent a crash if GOOGLE_API_KEY is not set.
const googleApiKey = process.env.GOOGLE_API_KEY;

export const ai = genkit({
  plugins: googleApiKey ? [googleAI()] : [],
  model: googleApiKey ? 'googleai/gemini-1.5-flash-latest' : undefined,
});
