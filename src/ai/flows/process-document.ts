'use server';
/**
 * @fileOverview Processes uploaded documents for RAG.
 * - processDocument: Extracts text, chunks, embeds, and stores documents.
 * - ProcessDocumentInput: The input type for the processing function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as mammoth from 'mammoth';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { embed } from '@genkit-ai/ai';
import {
  appwriteDatabases,
  appwriteDatabaseId,
  appwriteEmbeddingsCollectionId,
} from '@/lib/appwrite-client';
import { getLoggedInUser } from '@/lib/auth';
import { ID, Permission, Role } from 'appwrite';

export const ProcessDocumentInputSchema = z.object({
  fileDataUri: z.string().describe('The document file as a data URI.'),
  fileName: z.string().describe('The name of the document file.'),
  documentId: z.string().describe('The Appwrite ID of the document file.'),
});

export type ProcessDocumentInput = z.infer<typeof ProcessDocumentInputSchema>;

async function extractText(fileDataUri: string, fileName: string): Promise<string> {
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  const buffer = Buffer.from(fileDataUri.split(',')[1], 'base64');

  switch (fileExtension) {
    case 'pdf':
      const data = await pdf(buffer);
      return data.text;
    case 'docx':
      const docxResult = await mammoth.extractRawText({ buffer });
      return docxResult.value;
    case 'txt':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
  }
}

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

export const processDocument = ai.defineFlow(
  {
    name: 'processDocumentFlow',
    inputSchema: ProcessDocumentInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const user = await getLoggedInUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    if (
      !appwriteDatabaseId ||
      !appwriteEmbeddingsCollectionId
    ) {
      throw new Error('Appwrite database or collection not configured.');
    }

    try {
      const text = await extractText(input.fileDataUri, input.fileName);
      const chunks = await textSplitter.splitText(text);

      const embeddings = await embed({
        embedder: 'googleai/text-embedding-004',
        content: chunks,
      });

      const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
        Permission.read(Role.label('admin')), // Admins can read all documents
      ];

      for (let i = 0; i < chunks.length; i++) {
        await appwriteDatabases.createDocument(
          appwriteDatabaseId,
          appwriteEmbeddingsCollectionId,
          ID.unique(),
          {
            documentId: input.documentId,
            fileName: input.fileName,
            chunkText: chunks[i],
            embedding: embeddings[i],
            userId: user.$id,
          },
          permissions
        );
      }
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }
);
