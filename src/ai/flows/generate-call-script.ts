
'use server';
/**
 * @fileOverview Generates a personalized call script for a sales lead.
 * - generateScript: The main function to generate a script.
 * - GenerateCallScriptInput: The input type for the script generation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAISettings } from '@/lib/settings';

const GenerateCallScriptInputSchema = z.object({
  leadName: z.string().describe("The name of the lead to call."),
  leadStatus: z.string().describe("The current status of the lead (e.g., New, Qualified)."),
  leadScore: z.number().describe("The lead's quality score (1-100)."),
  company: z.string().optional().describe("The company the lead works for."),
  jobTitle: z.string().optional().describe("The lead's job title."),
  scriptTemplate: z.string().describe("A template for the call script. Uses Handlebars syntax like {{leadName}}."),
});
export type GenerateCallScriptInput = z.infer<typeof GenerateCallScriptInputSchema>;

export async function generateScript(input: GenerateCallScriptInput): Promise<string> {
    const aiSettings = await getAISettings();

    const prompt = ai.definePrompt({
        name: 'generateCallScriptPrompt',
        input: { schema: GenerateCallScriptInputSchema },
        output: { schema: z.string() },
        prompt: `You are an expert sales development representative who is a master at writing concise, effective, and personalized call scripts. Your AI personality should be: ${aiSettings.personality}.

Your task is to generate a natural and effective call script for an agent.

**Use the provided lead information to personalize the script**:
- Name: {{leadName}}
- Status: {{leadStatus}}
- Score: {{leadScore}}
- Company: {{#if company}}{{company}}{{else}}Not Provided{{/if}}
- Job Title: {{#if jobTitle}}{{jobTitle}}{{else}}Not Provided{{/if}}

**Script Generation Instructions**:
- Use the provided script template as your guide.
- **CRITICAL**: The "Opener" section MUST be adapted based on the lead's status.
    - If status is 'New', use a welcoming opener: "Hi {{leadName}}, this is [Your Name] from Cally-IO. I saw you recently signed up..."
    - If status is 'Contacted' or 'Called', modify the opener to be a follow-up: "Hi {{leadName}}, just following up on my previous message..."
    - If status is 'Qualified', make the opener more direct and value-focused: "Hi {{leadName}}, I'm reaching out because your usage indicates you might be a great fit for our advanced features..."
- **CRITICAL**: The "Value Proposition" section MUST be adapted based on the lead's score if the template contains logic for it.
    - If score is high (> 70), use a confident, feature-focused approach. Assume they are an expert user.
    - If score is medium (40-70), focus on a core value proposition, like uploading documents. Assume they are an interested user.
    - If score is low (< 40), use a general, educational, and discovery-focused approach. Assume they are just exploring.
- If the lead's company is known, mention it. Example: "...I see you're with {{company}}..."
- If the job title is known, tailor the pitch to their likely role. Example for a 'Developer': "...you might find our API particularly useful...". Example for a 'Manager': "...you could streamline your team's workflow..."
- Replace placeholders like "[Your Name]" with a generic but appropriate name (e.g., "Alex").
- The final output must be ONLY the script text, formatted in clean Markdown. Do not add any other commentary, headings, or introductions.

**Call Script Template**:
{{{scriptTemplate}}}
`,
    });

    if (!input.scriptTemplate) {
        throw new Error("A script template must be provided.");
    }
    
    const { output } = await prompt(input);
    return output || "Could not generate a script.";
}
