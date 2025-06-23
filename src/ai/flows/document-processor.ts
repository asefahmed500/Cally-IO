'use server';

/**
 * @fileOverview A RAG processing flow for ingesting documents into a vector store.
 * - processDocument: Triggers the document processing pipeline.
 * - deleteDocumentChunks: Deletes all processed data for a given document.
 */

import { ai } from '@/ai/genkit';
import { databases, storage } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { ID, Query } from 'node-appwrite';
import { z } from 'zod';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import pdf from 'pdf-parse';
// @ts-ignore
import mammoth from 'mammoth';

const DocumentInputSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
});
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const EMBEDDINGS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;

async function extractTextFromFile(fileId: string): Promise<{ text: string; error?: string }> {
  try {
    const file = await storage.getFileView(process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!, fileId);
    const fileBuffer = Buffer.from(file);
    const fileInfo = await storage.getFile(process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!, fileId);
    
    if (fileInfo.mimeType === 'application/pdf') {
      const data = await pdf(fileBuffer);
      return { text: data.text };
    } else if (fileInfo.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      return { text: value };
    } else if (fileInfo.mimeType.startsWith('text/')) {
      return { text: fileBuffer.toString('utf-8') };
    } else {
      return { text: '', error: `Unsupported file type: ${fileInfo.mimeType}` };
    }
  } catch (e: any) {
    console.error('Error extracting text:', e);
    return { text: '', error: 'Failed to extract text from file.' };
  }
}

const documentProcessorFlow = ai.defineFlow(
  {
    name: 'documentProcessorFlow',
    inputSchema: DocumentInputSchema,
    outputSchema: z.void(),
  },
  async ({ fileId, fileName }) => {
    const user = await getLoggedInUser();
    if (!user) {
      throw new Error('User must be logged in to process documents.');
    }
    
    // First, delete any existing chunks for this document
    await deleteDocumentChunks(fileId);

    const { text, error } = await extractTextFromFile(fileId);
    if (error) {
      console.error(`Skipping processing for ${fileName}: ${error}`);
      return;
    }

    if (!text) {
      console.warn(`No text extracted from ${fileName}. Skipping embedding.`);
      return;
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100,
    });
    const chunks = await splitter.splitText(text);

    for (const chunk of chunks) {
      const { embedding } = await ai.embed({
        content: chunk,
        model: 'googleai/text-embedding-004',
      });

      await databases.createDocument(
        DATABASE_ID,
        EMBEDDINGS_COLLECTION_ID,
        ID.unique(),
        {
          documentId: fileId,
          fileName: fileName,
          chunkText: chunk,
          embedding: embedding,
          userId: user.$id,
        }
      );
    }
    console.log(`Successfully processed and embedded ${chunks.length} chunks for ${fileName}.`);
  }
);

export async function processDocument(input: DocumentInput) {
  await documentProcessorFlow(input);
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
    try {
        const user = await getLoggedInUser();
        if (!user) throw new Error("User not logged in.");

        let hasMore = true;
        let cursor = undefined;

        while(hasMore) {
            const queries = [
                Query.equal('documentId', documentId),
                Query.equal('userId', user.$id),
                Query.limit(100)
            ];
            if (cursor) {
                queries.push(Query.cursorAfter(cursor));
            }

            const response = await databases.listDocuments(
                DATABASE_ID,
                EMBEDDINGS_COLLECTION_ID,
                queries
            );
            
            if (response.documents.length === 0) {
                hasMore = false;
                continue;
            }

            for (const doc of response.documents) {
                await databases.deleteDocument(DATABASE_ID, EMBEDDINGS_COLLECTION_ID, doc.$id);
            }
            
            if (response.documents.length < 100) {
                hasMore = false;
            } else {
                cursor = response.documents[response.documents.length - 1].$id;
            }
        }
    } catch (error) {
        console.error('Failed to delete document chunks:', error);
        throw new Error('Failed to delete document chunks.');
    }
}
