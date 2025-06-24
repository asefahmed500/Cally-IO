import { Client, Account, Storage, Databases } from 'appwrite';

export const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
export const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
export const appwriteDatabaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '';
export const appwriteEmbeddingsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID || '';
export const appwriteStorageBucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || '';
export const appwriteMetricsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_METRICS_COLLECTION_ID || '';


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
