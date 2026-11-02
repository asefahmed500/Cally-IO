import { prisma } from '@/lib/prisma';

export interface AISettings {
  personality: string;
  style: string;
  instructions: string;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessHoursTimezone: string;
  awayMessage: string;
  scriptTemplate: string;
}

const defaultScriptTemplate = `**Objective**: Briefly introduce Cally-IO, gauge interest, and book a 15-minute demo.

**Opener**:
"Hi {{leadName}}, this is Alex from Cally-IO. I saw you recently signed up and wanted to personally reach out to see how you're finding it. Is now an okay time for a quick 30-second chat?"

**Value Proposition (tailored to lead score)**:
"Great! Many of our users are saving a surprising amount of time by using our tool to get instant, accurate answers from their own documents. Have you had a chance to upload a file and try it out?"

**Discovery Question**:
"Just so I can point you in the right direction, what's the biggest challenge you're facing with customer or team support right now?"

**Call to Action**:
"Based on what you've said, I'm confident a quick 15-minute demo could show you exactly how we can help with that. I have some availability tomorrow afternoon. Would that work for you?"

**Closing**:
"Excellent. I'll send a calendar invite over right away. Looking forward to speaking then, {{leadName}}!"
`;

export const defaultSettings: AISettings = {
  personality: 'Professional',
  style: 'Conversational',
  instructions: 'Your company name is Cally-IO. You are a helpful AI assistant.',
  businessHoursEnabled: false,
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  businessHoursTimezone: 'UTC',
  awayMessage:
    'We are currently away. We are available from 9 AM to 5 PM UTC. Please leave a message and we will get back to you.',
  scriptTemplate: defaultScriptTemplate,
};

/** Reads per-workspace settings, falling back to platform defaults. */
export async function getWorkspaceSettings(workspaceId: string): Promise<AISettings> {
  try {
    const row = await prisma.workspaceSettings.upsert({
      where: { workspaceId },
      update: {},
      create: { workspaceId },
    });
    return {
      personality: row.personality || defaultSettings.personality,
      style: row.style || defaultSettings.style,
      instructions: row.instructions || defaultSettings.instructions,
      businessHoursEnabled: row.businessHoursEnabled,
      businessHoursStart: row.businessHoursStart || defaultSettings.businessHoursStart,
      businessHoursEnd: row.businessHoursEnd || defaultSettings.businessHoursEnd,
      businessHoursTimezone: row.businessHoursTimezone || defaultSettings.businessHoursTimezone,
      awayMessage: row.awayMessage || defaultSettings.awayMessage,
      scriptTemplate: row.scriptTemplate || defaultSettings.scriptTemplate,
    };
  } catch (error) {
    console.error('Failed to fetch workspace settings, using defaults:', error);
    return defaultSettings;
  }
}

export async function updateWorkspaceSettingsData(workspaceId: string, data: AISettings): Promise<void> {
  await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    update: data,
    create: { workspaceId, ...data },
  });
}



/**
 * Legacy shim kept for flows without a workspace context. With a
 * workspaceId it reads that workspace's settings; without one it returns
 * safe defaults — it must NEVER fall back to another tenant's settings.
 */
export async function getAISettings(workspaceId?: string): Promise<AISettings> {
  if (workspaceId) {
    return getWorkspaceSettings(workspaceId);
  }
  return defaultSettings;
}
