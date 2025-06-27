
import { Client, Account, Storage, Databases } from 'appwrite';

export const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
export const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
export const appwriteDatabaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '';
export const appwriteEmbeddingsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID || '';
export const appwriteStorageBucketId = async () => process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || '';
export const appwriteMetricsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_METRICS_COLLECTION_ID || '';
export const appwriteLeadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID || '';
export const appwriteSettingsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID || '';
export const appwriteConversationsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_CONVERSATIONS_COLLECTION_ID || '';
export const appwriteFaqsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_FAQS_COLLECTION_ID || '';
export const appwriteCallLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_CALL_LOGS_COLLECTION_ID || '';
export const appwriteAnalyticsLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_ANALYTICS_LOGS_COLLECTION_ID || '';


const client = new Client();

if (appwriteEndpoint && appwriteProjectId) {
    client
        .setEndpoint(appwriteEndpoint)
        .setProject(appwriteProjectId);
}


export const account = new Account(client);
export const storage = new Storage(client);
export const databases = new Databases(client);
export const appwriteDatabases = databases; // alias for clarity

    
