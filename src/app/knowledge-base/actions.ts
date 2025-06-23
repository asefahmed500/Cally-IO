'use server';

import { processDocument, deleteDocumentChunks } from "@/ai/flows/document-processor";
import { getLoggedInUser } from "@/lib/auth";
import { storage, databases } from "@/lib/appwrite-server";
import { revalidatePath } from "next/cache";

const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;

export async function processDocumentAction(fileId: string, fileName: string) {
    try {
        await processDocument({ fileId, fileName });
        revalidatePath('/knowledge-base');
        return { success: true };
    } catch(error: any) {
        console.error('Error in processDocumentAction:', error);
        return { success: false, error: error.message };
    }
}

export async function listDocuments() {
    try {
        const user = await getLoggedInUser();
        if (!user) throw new Error("User not authenticated");

        const response = await storage.listFiles(BUCKET_ID);
        // In a real multi-tenant app, you'd filter by user permissions.
        // For this prototype, we'll assume the user can see all files.
        return response.files;
    } catch (error) {
        console.error('Failed to list documents:', error);
        return [];
    }
}

export async function deleteDocumentAction(fileId: string) {
    try {
        // First delete the chunks from the database
        await deleteDocumentChunks(fileId);
        // Then delete the file from storage
        await storage.deleteFile(BUCKET_ID, fileId);

        revalidatePath('/knowledge-base');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete document:', error);
        return { success: false, error: error.message };
    }
}
