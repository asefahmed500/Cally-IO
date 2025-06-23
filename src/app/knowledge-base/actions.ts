'use server'

import { storage } from '@/lib/appwrite-server';

const bucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;

export async function getDocuments() {
    try {
        if (!bucketId) {
            throw new Error("Appwrite bucket ID is not configured.");
        }
        const response = await storage.listFiles(bucketId);
        return response.files;
    } catch (error) {
        console.error("Failed to fetch documents:", error);
        return [];
    }
}

export async function deleteDocument(fileId: string) {
    try {
        if (!bucketId) {
            throw new Error("Appwrite bucket ID is not configured.");
        }
        await storage.deleteFile(bucketId, fileId);
        return { success: true };
    } catch (error) {
        console.error(`Failed to delete document ${fileId}:`, error);
        return { success: false, error: (error as Error).message };
    }
}
