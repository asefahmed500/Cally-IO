'use server';

import { databases } from '@/lib/appwrite-server';
import { ID, Permission, Role } from 'node-appwrite';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const analyticsLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_ANALYTICS_LOGS_COLLECTION_ID!;


/**
 * Logs when a document is used as context for an AI response.
 * This is a fire-and-forget function.
 */
export async function logDocumentUsage(userId: string, sources: { documentId: string; fileName: string; }[]) {
    if (!analyticsLogsCollectionId || !dbId) {
        console.warn('Analytics logging is not configured.');
        return;
    }
    
    try {
        await databases.createDocument(
            dbId,
            analyticsLogsCollectionId,
            ID.unique(),
            {
                eventType: 'DOCUMENT_USED',
                eventData: JSON.stringify({ sources }),
                userId: userId,
            },
            [
                Permission.read(Role.label('admin')),
                Permission.write(Role.user(userId)), // Let user create their own log entries
            ]
        );
    } catch (e) {
        // Fail silently
        console.error('Failed to log document usage:', e);
    }
}
