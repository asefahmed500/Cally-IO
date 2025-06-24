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
  if (!user || !user.labels.includes('admin')) {
    return { error: 'Unauthorized access.' };
  }

  try {
    // 1. Find all chunks related to this documentId
    const chunksToDelete = await databases.listDocuments(
      dbId,
      embeddingsCollectionId,
      [Query.equal('documentId', documentId), Query.limit(5000)]
    );

    // 2. Delete all found chunks from the database
    const deletePromises = chunksToDelete.documents.map((chunk) =>
      databases.deleteDocument(dbId, embeddingsCollectionId, chunk.$id)
    );
    await Promise.all(deletePromises);
    
    // 3. Delete the original file from storage
    // Note: The documentId from the embedding collection IS the fileId in storage.
    await storage.deleteFile(storageBucketId, documentId);

    revalidatePath('/knowledge');
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete document:', e);
    return { error: `Failed to delete document from the system: ${e.message}` };
  }
}
