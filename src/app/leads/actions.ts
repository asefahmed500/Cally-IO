'use server';

import { databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

export async function updateLeadStatus(leadId: string, status: string) {
  const user = await getLoggedInUser();
  if (!user || !user.labels.includes('admin')) {
    return { error: 'Unauthorized access.' };
  }

  try {
    await databases.updateDocument(dbId, leadsCollectionId, leadId, { 
        status,
        lastActivity: new Date().toISOString() 
    });
    revalidatePath('/leads');
    return { success: true };
  } catch (e: any) {
    console.error('Failed to update lead status:', e);
    return { error: 'Failed to update lead status in the database.' };
  }
}
