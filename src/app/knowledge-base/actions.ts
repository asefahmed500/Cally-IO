'use server'

import { storage, databases } from '@/lib/appwrite-server';
import { ID, Permission, Role } from 'node-appwrite';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { processDocument } from '@/ai/flows/document-processor';

const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;

export async function uploadDocument(prevState: any, formData: FormData) {
    const user = await getLoggedInUser();
    if (!user) {
        return { message: 'You must be logged in to upload a document.' };
    }

    const file = formData.get('document') as File | null;
    if (!file || file.size === 0) {
        return { message: 'Please select a file to upload.' };
    }

    // For now, only allow .txt files
    if (file.type !== 'text/plain') {
        return { message: 'Only .txt files are supported at this time.' };
    }

    try {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        const response = await storage.createFile(
            BUCKET_ID,
            ID.unique(),
            {
                read: [Permission.user(user.$id)],
                write: [Permission.user(user.$id)],
            },
            file.name,
            fileBuffer,
        );
        
        // Asynchronously trigger the document processing pipeline
        processDocument({ fileId: response.$id, fileName: file.name, userId: user.$id });

        revalidatePath('/knowledge-base');
        return { message: `Successfully uploaded ${file.name}. It is now being processed.` };

    } catch (e: any) {
        console.error('Error uploading document:', e);
        return { message: `Failed to upload document: ${e.message}` };
    }
}

export async function listDocuments() {
    const user = await getLoggedInUser();
    if (!user) {
        return [];
    }

    try {
        const response = await storage.listFiles(BUCKET_ID);
        // Filter files to only show those the current user has access to.
        // This is a client-side filter after getting all files. For stricter security,
        // you would manage permissions more granularly if needed.
        return response.files.filter(file => 
            file.$permissions.some(p => p.startsWith(`read("user:${user.$id}")`))
        );
    } catch (error) {
        console.error('Error listing documents:', error);
        // If the bucket doesn't exist or there's a permission error, return empty
        return [];
    }
}

export async function deleteDocument(fileId: string) {
    const user = await getLoggedInUser();
    if (!user) {
        throw new Error('Not authenticated');
    }
    try {
        // First, delete the file from storage
        await storage.deleteFile(BUCKET_ID, fileId);

        // Then, delete all associated embeddings from the database
        const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
        const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;

        // This is a simplified deletion. In a real-world scenario with millions of chunks,
        // you'd want a more robust, possibly background-job-based deletion process.
        let hasMore = true;
        while(hasMore) {
            const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
                `equal("documentId", "${fileId}")`
            ]);

            if (response.documents.length === 0) {
                hasMore = false;
                break;
            }

            for (const doc of response.documents) {
                await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, doc.$id);
            }
        }

        revalidatePath('/knowledge-base');
        return { success: true };
    } catch (e: any) {
        console.error('Error deleting document:', e);
        return { success: false, message: e.message };
    }
}
