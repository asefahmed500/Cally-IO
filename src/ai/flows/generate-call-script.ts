'use server';
/**
 * @fileOverview Generates a personalized call script for a sales lead.
 * - generateScript: The main function to generate a script.
 * - GenerateCallScriptInput: The input type for the script generation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAISettings } from '@/lib/settings';

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
"Hi {{leadName}}, this is [Your Name] from Cally-IO. I saw you recently signed up and wanted to personally reach out to see how you're finding it. Is now an okay time for a quick 30-second chat?"

**Value Proposition (tailored to lead score)**:
{{#if (isGreaterThan leadScore 70)}}
"Great! Since you have a high engagement score, you might be interested in how companies like yours are using our full feature set to cut support tickets by up to 70% by integrating their existing knowledge bases."
{{else if (isGreaterThan leadScore 40)}}
"Great! Many of our users are saving a surprising amount of time by using our tool to get instant, accurate answers from their own documents. Have you had a chance to upload a file and try it out?"
{{else}}
"Great! Many people start by exploring how an AI assistant can help with internal team questions or customer support. What's the biggest challenge you're hoping to solve?"
{{/if}}

**Discovery Question**:
"Just so I can point you in the right direction, what's the biggest challenge you're facing with customer or team support right now?"

**Call to Action**:
"Based on what you've said, I'm confident a quick 15-minute demo could show you exactly how we can help with that. I have some availability tomorrow afternoon. Would that work for you?"

**Closing**:
"Excellent. I'll send a calendar invite over right away. Looking forward to speaking then, {{leadName}}!"
`;

export async function generateScript(input: GenerateCallScriptInput): Promise<string> {
    const aiSettings = await getAISettings();

    // This is a custom handlebars helper.
    // It's not standard and would require registering it with a Handlebars instance.
    // For Genkit's simple template, we'll use a workaround inside the prompt.
    const prompt = ai.definePrompt({
        name: 'generateCallScriptPrompt',
        input: { schema: GenerateCallScriptInputSchema },
        output: { schema: z.string() },
        prompt: `You are an expert sales development representative who is a master at writing concise, effective, and personalized call scripts. Your AI personality is ${aiSettings.personality}.

Your task is to generate a natural and effective call script for an agent.

**Use the provided lead information to personalize the script**:
- Name: {{leadName}}
- Status: {{leadStatus}}
- Score: {{leadScore}}

**Script Generation Instructions**:
- Use the provided script template as your guide.
- **CRITICAL**: The "Value Proposition" section MUST be adapted based on the lead's score.
    - If score is high (e.g., > 70), use a confident, feature-focused approach. Assume they are an expert user.
    - If score is medium (e.g., 40-70), focus on a core value proposition, like uploading documents. Assume they are an interested user.
    - If score is low (e.g., < 40), use a general, educational, and discovery-focused approach. Assume they are just exploring.
- **CRITICAL**: The "Opener" section MUST be adapted based on the lead's status.
    - If status is 'New', use the default opener.
    - If status is 'Contacted', modify the opener to be a follow-up: "Hi {{leadName}}, just following up on my previous message..."
    - If status is 'Qualified', make the opener more direct: "Hi {{leadName}}, I'm reaching out because your usage indicates you might be a great fit for our advanced features..."
- Replace placeholders like "[Your Name]" with generic but appropriate text (e.g., "Alex").
- The final output must be ONLY the script text, formatted in clean Markdown. Do not add any other commentary, headings, or introductions.

**Call Script Template**:
{{{scriptTemplate}}}
`,
    });

    const scriptTemplate = input.scriptTemplate || defaultScriptTemplate;
    
    const { output } = await prompt({ ...input, scriptTemplate });
    return output || "Could not generate a script.";
}
