'use server';

import { databases } from '@/lib/appwrite-server';
import { AppwriteException } from 'node-appwrite';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const settingsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID;
const settingsDocumentId = 'default_config'; // This is our singleton document

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

// Add the default script template here
const defaultScriptTemplate = `**Objective**: Briefly introduce Cally-IO, gauge interest, and book a 15-minute demo.

**Opener**:
"Hi {{leadName}}, this is [Your Name] from Cally-IO. I saw you recently signed up and wanted to personally reach out to see how you're finding it. Is now an okay time for a quick 30-second chat?"

**Value Proposition (tailored to lead score)**:
"Great! Many of our users are saving a surprising amount of time by using our tool to get instant, accurate answers from their own documents. Have you had a chance to upload a file and try it out?"

**Discovery Question**:
"Just so I can point you in the right direction, what's the biggest challenge you're facing with customer or team support right now?"

**Call to Action**:
"Based on what you've said, I'm confident a quick 15-minute demo could show you exactly how we can help with that. I have some availability tomorrow afternoon. Would that work for you?"

**Closing**:
"Excellent. I'll send a calendar invite over right away. Looking forward to speaking then, {{leadName}}!"
`;

const defaultSettings: AISettings = {
  personality: 'Professional',
  style: 'Conversational',
  instructions: 'Your company name is Cally-IO. You are a helpful AI assistant.',
  businessHoursEnabled: false,
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  businessHoursTimezone: 'UTC',
  awayMessage: 'We are currently away. We are available from 9 AM to 5 PM UTC. Please leave a message and we will get back to you.',
  scriptTemplate: defaultScriptTemplate,
};

export async function getAISettings(): Promise<AISettings> {
  if (!dbId || !settingsCollectionId) {
    console.warn('AI settings collection not configured. Using default settings.');
    return defaultSettings;
  }

  try {
    const document = await databases.getDocument(
      dbId,
      settingsCollectionId,
      settingsDocumentId
    );
    
    return {
        personality: document.ai_personality || defaultSettings.personality,
        style: document.ai_style || defaultSettings.style,
        instructions: document.ai_instructions || defaultSettings.instructions,
        businessHoursEnabled: document.business_hours_enabled ?? defaultSettings.businessHoursEnabled,
        businessHoursStart: document.business_hours_start || defaultSettings.businessHoursStart,
        businessHoursEnd: document.business_hours_end || defaultSettings.businessHoursEnd,
        businessHoursTimezone: document.business_hours_timezone || defaultSettings.businessHoursTimezone,
        awayMessage: document.away_message || defaultSettings.awayMessage,
        scriptTemplate: document.call_script_template || defaultSettings.scriptTemplate,
    };

  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      // Document doesn't exist, which can happen on first run.
      console.warn(`Settings document '${settingsDocumentId}' not found. Using default settings.`);
    } else {
      console.error('Failed to fetch AI settings:', error);
    }
    return defaultSettings;
  }
}
