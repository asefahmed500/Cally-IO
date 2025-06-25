'use server';

import { databases, storage } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { ID, Permission, Role, Query, Models } from 'node-appwrite';
import { z } from 'zod';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const embeddingsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;
const storageBucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;
const faqsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_FAQS_COLLECTION_ID!;

export interface Faq extends Models.Document {
    question: string;
    answer: string;
}

const FaqSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters long.'),
  answer: z.string().min(10, 'Answer must be at least 10 characters long.'),
});

// DOCUMENT ACTIONS //

export async function deleteDocument(documentId: string) {
  const user = await getLoggedInUser();
  if (!user) {
    return { error: 'Unauthorized. Please log in.' };
  }

  try {
    const chunksResponse = await databases.listDocuments(
      dbId,
      embeddingsCollectionId,
      [Query.equal('documentId', documentId), Query.limit(1)]
    );

    if (chunksResponse.documents.length > 0) {
        const docOwnerId = chunksResponse.documents[0].userId;
        const isAdmin = user.labels.includes('admin');
        if (!isAdmin && user.$id !== docOwnerId) {
            return { error: 'Unauthorized. You can only delete your own documents.' };
        }
    } else {
        if (!user.labels.includes('admin')) {
             return { error: 'Document not found or you do not have permission to delete it.' };
        }
    }

    const chunksToDelete = await databases.listDocuments(
      dbId,
      embeddingsCollectionId,
      [Query.equal('documentId', documentId), Query.limit(5000)]
    );

    if (chunksToDelete.documents.length > 0) {
      const deletePromises = chunksToDelete.documents.map((chunk) =>
        databases.deleteDocument(dbId, embeddingsCollectionId, chunk.$id)
      );
      await Promise.all(deletePromises);
    }
    
    await storage.deleteFile(storageBucketId, documentId);

    revalidatePath('/knowledge');
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete document:', e);
    return { error: `Failed to delete document from the system.` };
  }
}

// FAQ ACTIONS //

export async function getFaqs(): Promise<Faq[]> {
  if (!dbId || !faqsCollectionId) return [];
  try {
    const response = await databases.listDocuments(dbId, faqsCollectionId, [Query.orderDesc('$createdAt')]);
    return response.documents as Faq[];
  } catch (e) {
    console.error('Failed to fetch FAQs:', e);
    return [];
  }
}

export async function saveFaq(prevState: any, formData: FormData) {
  const user = await getLoggedInUser();
  if (!user || !user.labels.includes('admin')) {
    return { status: 'error', message: 'Unauthorized' };
  }

  const id = formData.get('id') as string | null;
  const validatedFields = FaqSchema.safeParse({
    question: formData.get('question'),
    answer: formData.get('answer'),
  });

  if (!validatedFields.success) {
    return {
      status: 'error',
      message: 'Invalid data.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    if (id) {
      await databases.updateDocument(
        dbId,
        faqsCollectionId,
        id,
        validatedFields.data
      );
    } else {
      await databases.createDocument(
        dbId,
        faqsCollectionId,
        ID.unique(),
        validatedFields.data,
        [Permission.read(Role.any()), Permission.write(Role.label('admin'))]
      );
    }
    revalidatePath('/knowledge');
    revalidatePath('/dashboard');
    return { status: 'success', message: `FAQ ${id ? 'updated' : 'created'} successfully.` };
  } catch (e: any) {
    console.error('Failed to save FAQ:', e);
    return { status: 'error', message: 'Database operation failed.' };
  }
}

export async function deleteFaq(faqId: string) {
    const user = await getLoggedInUser();
    if (!user || !user.labels.includes('admin')) {
      return { status: 'error', message: 'Unauthorized' };
    }

    if (!faqId) {
        return { status: 'error', message: 'FAQ ID is missing.' };
    }

    try {
        await databases.deleteDocument(dbId, faqsCollectionId, faqId);
        revalidatePath('/knowledge');
        revalidatePath('/dashboard');
        return { status: 'success', message: 'FAQ deleted successfully.' };
    } catch(e: any) {
        console.error('Failed to delete FAQ:', e);
        return { status: 'error', message: 'Database operation failed.' };
    }
}
