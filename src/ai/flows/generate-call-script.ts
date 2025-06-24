'use server';
/**
 * @fileOverview Generates a personalized call script for a sales lead.
 * - generateScript: The main function to generate a script.
 * - GenerateCallScriptInput: The input type for the script generation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const GenerateCallScriptInputSchema = z.object({
  leadName: z.string().describe("The name of the lead to call."),
  leadStatus: z.string().describe("The current status of the lead (e.g., New, Qualified)."),
  leadScore: z.number().describe("The lead's quality score (1-100)."),
  // In a real app, this template would be fetched from a database.
  scriptTemplate: z.string().optional().describe("A template for the call script. Uses Handlebars syntax like {{leadName}}."),
});
export type GenerateCallScriptInput = z.infer<typeof GenerateCallScriptInputSchema>;

const defaultScriptTemplate = `**Objective**: Briefly introduce Cally-IO, gauge interest, and book a 15-minute demo.

**Opener**:
"Hi {{leadName}}, this is [Your Name] from Cally-IO. I saw you signed up to try our AI assistant. I'm not calling to sell you anything right now, just wanted to personally reach out and see how you're finding it. Is now an okay time for a quick 30-second chat?"

**Value Proposition (tailored to lead score)**:
{{#if (isGreaterThan leadScore 70)}}
"Great! Since you have a high engagement score, you might be interested in how companies like yours are using our full feature set to cut support tickets by up to 70%. We're seeing a lot of success in your industry."
{{else}}
"Great! Many of our users start by using our tool to simply answer questions from their own documents, which saves a surprising amount of time. Are you currently using it for a specific project?"
{{/if}}

**Discovery Question**:
"What's the biggest challenge you're facing with customer or team support right now?"

**Call to Action**:
"Based on what you've said, I'm confident a quick 15-minute demo could show you exactly how we can help with that. I have some availability tomorrow afternoon. Would that work for you?"

**Closing**:
"Excellent. I'll send a calendar invite over right away. Looking forward to speaking then, {{leadName}}!"
`;


// This is a custom handlebars helper.
// It's not standard and would require registering it with a Handlebars instance.
// For Genkit's simple template, we'll use a workaround inside the prompt.
const prompt = ai.definePrompt({
    name: 'generateCallScriptPrompt',
    input: { schema: GenerateCallScriptInputSchema },
    output: { schema: z.string() },
    prompt: `You are an expert sales scriptwriter. Your task is to generate a natural, concise, and effective call script for a sales agent.

Use the provided lead information to personalize the script.

**Lead Information**:
- Name: {{leadName}}
- Status: {{leadStatus}}
- Score: {{leadScore}}

**Script Generation Instructions**:
- Use the provided template as a guide.
- **Crucially, adapt the "Value Proposition" section based on the lead's score.** If the score is high (e.g., > 70), use a more confident and feature-focused approach. If the score is lower, use a more general, educational approach.
- Replace all placeholders like "[Your Name]" with generic but appropriate text.
- The final output should be ONLY the script text, formatted nicely in Markdown. Do not include any other commentary.

**Call Script Template**:
{{{scriptTemplate}}}
`,
});

export async function generateScript(input: GenerateCallScriptInput): Promise<string> {
    const scriptTemplate = input.scriptTemplate || defaultScriptTemplate;
    
    const { output } = await prompt({ ...input, scriptTemplate });
    return output || "Could not generate a script.";
}
