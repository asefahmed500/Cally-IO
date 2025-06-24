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
}

const defaultSettings: AISettings = {
  personality: 'Professional',
  style: 'Conversational',
  instructions: 'Your company name is Cally-IO. You are a helpful AI assistant.',
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
        personality: document.ai_personality,
        style: document.ai_style,
        instructions: document.ai_instructions,
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
