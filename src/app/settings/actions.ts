'use server';

import { databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { AppwriteException, Permission, Role } from 'node-appwrite';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const settingsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID!;
const settingsDocumentId = 'default_config'; // Singleton document

export async function updateAISettings(formData: FormData) {
  const user = await getLoggedInUser();
  if (!user || !user.labels.includes('admin')) {
    return { error: 'Unauthorized access.' };
  }

  if (!dbId || !settingsCollectionId) {
    return { error: 'Settings collection is not configured in environment variables.' };
  }

  const settingsData = {
    ai_personality: formData.get('ai_personality') as string,
    ai_style: formData.get('ai_style') as string,
    ai_instructions: formData.get('ai_instructions') as string,
    business_hours_enabled: formData.get('business_hours_enabled') === 'on',
    business_hours_start: formData.get('business_hours_start') as string,
    business_hours_end: formData.get('business_hours_end') as string,
    business_hours_timezone: formData.get('business_hours_timezone') as string,
    away_message: formData.get('away_message') as string,
  };

  try {
    // Attempt to update the document first (upsert logic)
    await databases.updateDocument(
      dbId,
      settingsCollectionId,
      settingsDocumentId,
      settingsData
    );
  } catch (e: any) {
    // If the document doesn't exist, create it.
    if (e instanceof AppwriteException && e.code === 404) {
      try {
        await databases.createDocument(
          dbId,
          settingsCollectionId,
          settingsDocumentId,
          settingsData,
          [
            Permission.read(Role.label('admin')),
            Permission.update(Role.label('admin')),
          ]
        );
      } catch (createError: any) {
         console.error('Failed to create settings document:', createError);
         return { error: `Failed to create settings: ${createError.message}` };
      }
    } else {
        // For any other error, re-throw it
        console.error('Failed to update AI settings:', e);
        return { error: `Failed to update settings: ${e.message}` };
    }
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard'); // To update business hours status
  return { success: true, message: "Settings updated successfully!" };
}
