/**
 * Generates a personalized call script for a sales lead using Gemini.
 */

import { getChatModel, isAIConfigured } from '@/ai/models';
import { getAISettings } from '@/lib/settings';

export type GenerateCallScriptInput = {
  leadName: string;
  leadStatus: string;
  leadScore: number;
  company?: string;
  jobTitle?: string;
  scriptTemplate: string;
  /** Tenant scope for personality/instructions — no workspace, no personalization. */
  workspaceId?: string;
};

export async function generateScript(input: GenerateCallScriptInput): Promise<string> {
  if (!input.scriptTemplate) {
    throw new Error('A script template must be provided.');
  }
  if (!isAIConfigured()) {
    throw new Error('GOOGLE_API_KEY is not configured on the server.');
  }

  const aiSettings = await getAISettings(input.workspaceId);

  const prompt = `You are an expert sales development representative who is a master at writing concise, effective, and personalized call scripts. Your AI personality should be: ${aiSettings.personality}.

Your task is to generate a natural and effective call script for an agent.

**Use the provided lead information to personalize the script**:
- Name: ${input.leadName}
- Status: ${input.leadStatus}
- Score: ${input.leadScore}
- Company: ${input.company || 'Not Provided'}
- Job Title: ${input.jobTitle || 'Not Provided'}

**Script Generation Instructions**:
- Use the provided script template as your guide.
- **CRITICAL**: The "Opener" section MUST be adapted based on the lead's status.
    - If status is 'New', use a welcoming opener: "Hi ${input.leadName}, this is Alex from Cally-IO. I saw you recently signed up..."
    - If status is 'Contacted' or 'Called', modify the opener to be a follow-up: "Hi ${input.leadName}, just following up on my previous message..."
    - If status is 'Qualified', make the opener more direct and value-focused: "Hi ${input.leadName}, I'm reaching out because your usage indicates you might be a great fit for our advanced features..."
- **CRITICAL**: The "Value Proposition" section MUST be adapted based on the lead's score if the template contains logic for it.
    - If score is high (> 70), use a confident, feature-focused approach. Assume they are an expert user.
    - If score is medium (40-70), focus on a core value proposition, like uploading documents. Assume they are an interested user.
    - If score is low (< 40), use a general, educational, and discovery-focused approach. Assume they are just exploring.
- If the lead's company is known, mention it. Example: "...I see you're with ${input.company || 'their company'}..."
- If the job title is known, tailor the pitch to their likely role.
- Replace placeholders like "[Your Name]" with a generic but appropriate name (e.g., "Alex").
- The final output must be ONLY the script text, formatted in clean Markdown. Do not add any other commentary, headings, or introductions.

**Call Script Template**:
${input.scriptTemplate}
`;

  const response = await getChatModel().invoke(prompt);
  const content = typeof response.content === 'string' ? response.content : String(response.content);
  return content || 'Could not generate a script.';
}
