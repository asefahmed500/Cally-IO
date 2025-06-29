'use server';

import { databases } from '@/lib/appwrite-server';
import { AppwriteException, Query } from 'node-appwrite';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const metricsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_METRICS_COLLECTION_ID!;
const analyticsLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_ANALYTICS_LOGS_COLLECTION_ID!;

export interface ContentSuggestion {
    prompt: string;
    count: number;
}

export interface UsageStatistic {
    fileName: string;
    count: number;
}

/**
 * Gets a list of user questions that received bad feedback, suggesting they need better answers.
 */
export async function getContentSuggestions(): Promise<ContentSuggestion[]> {
    if (!metricsCollectionId || !dbId) return [];

    try {
        const response = await databases.listDocuments(dbId, metricsCollectionId, [
            Query.equal('feedback', 'bad'),
            Query.isNotNull('prompt'),
            Query.limit(5000),
        ]);

        const suggestionCounts = new Map<string, number>();
        for (const doc of response.documents) {
            if (doc.prompt) {
                const normalizedPrompt = doc.prompt.trim();
                suggestionCounts.set(normalizedPrompt, (suggestionCounts.get(normalizedPrompt) || 0) + 1);
            }
        }
        
        return Array.from(suggestionCounts.entries())
            .map(([prompt, count]) => ({ prompt, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Return top 10

    } catch (e) {
        if (e instanceof AppwriteException && e.code !== 404) {
             console.error('Failed to get content suggestions:', e);
        }
        return [];
    }
}

/**
 * Gets a list of the most frequently used documents in AI conversations.
 */
export async function getUsageStatistics(): Promise<UsageStatistic[]> {
    if (!analyticsLogsCollectionId || !dbId) return [];

    try {
        const response = await databases.listDocuments(dbId, analyticsLogsCollectionId, [
            Query.equal('eventType', 'DOCUMENT_USED'),
            Query.limit(5000),
        ]);

        const usageCounts = new Map<string, number>();
        for (const doc of response.documents) {
            try {
                const data = JSON.parse(doc.eventData);
                const sources = data.sources as Array<{ fileName: string }>;
                if (sources) {
                    // Use a Set to count each document only once per conversation turn
                    const uniqueFileNames = new Set(sources.map(s => s.fileName));
                    uniqueFileNames.forEach(fileName => {
                        usageCounts.set(fileName, (usageCounts.get(fileName) || 0) + 1);
                    });
                }
            } catch (e) {
                // Ignore malformed JSON
            }
        }
        
        return Array.from(usageCounts.entries())
            .map(([fileName, count]) => ({ fileName, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Return top 10

    } catch (e) {
         if (e instanceof AppwriteException && e.code !== 404) {
            console.error('Failed to get usage statistics:', e);
        }
        return [];
    }
}
