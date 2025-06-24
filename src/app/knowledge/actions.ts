'use server';

import { databases, storage } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { Query } from 'node-appwrite';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const embeddingsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;
const storageBucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;

export async function deleteDocument(documentId: string) {
  const user = await getLoggedInUser();
  if (!user) {
    return { error: 'Unauthorized. Please log in.' };
  }

  try {
    // 1. Find a chunk related to this documentId to verify ownership or admin status
    const chunksResponse = await databases.listDocuments(
      dbId,
      embeddingsCollectionId,
      [Query.equal('documentId', documentId), Query.limit(1)] // Just need one chunk to check userId
    );

    if (chunksResponse.documents.length > 0) {
        const docOwnerId = chunksResponse.documents[0].userId;
        const isAdmin = user.labels.includes('admin');

        // 2. Check permissions: user must be admin or the owner of the document
        if (!isAdmin && user.$id !== docOwnerId) {
            return { error: 'Unauthorized. You can only delete your own documents.' };
        }
    } else {
        // If no chunks are found, the document might not exist or be orphaned.
        // Only an admin can proceed to attempt to delete the file from storage in this case.
        if (!user.labels.includes('admin')) {
             return { error: 'Document not found or you do not have permission to delete it.' };
        }
    }

    // 3. Get all chunks to delete them
    const chunksToDelete = await databases.listDocuments(
      dbId,
      embeddingsCollectionId,
      [Query.equal('documentId', documentId), Query.limit(5000)]
    );

    // 4. Delete all found chunks from the database
    if (chunksToDelete.documents.length > 0) {
      const deletePromises = chunksToDelete.documents.map((chunk) =>
        databases.deleteDocument(dbId, embeddingsCollectionId, chunk.$id)
      );
      await Promise.all(deletePromises);
    }
    
    // 5. Delete the original file from storage
    // The documentId from the embedding collection IS the fileId in storage.
    await storage.deleteFile(storageBucketId, documentId);

    revalidatePath('/knowledge');
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete document:', e);
    // Avoid leaking detailed error messages to the client
    return { error: `Failed to delete document from the system.` };
  }
}
