'use server';
/**
 * @fileOverview A flow for processing uploaded documents for a RAG system.
 * - processDocument: Extracts text, chunks it, creates embeddings, and stores them.
 * - ProcessDocumentInput: The input type for the flow.
 */
import { ai } from '@/ai/genkit';
import { databases, storage } from '@/lib/appwrite-server';
import { z } from 'zod';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { TextLoader } from "@langchain/community/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ID } from 'node-appwrite';

// Input Schema
const ProcessDocumentInputSchema = z.object({
  fileId: z.string().describe('The ID of the file in Appwrite Storage.'),
  fileName: z.string().describe('The original name of the file.'),
  userId: z.string().describe('The ID of the user who uploaded the file.'),
});
export type ProcessDocumentInput = z.infer<typeof ProcessDocumentInputSchema>;

// Main exported function
export async function processDocument(input: ProcessDocumentInput): Promise<{ success: boolean; message: string }> {
  try {
    const result = await processDocumentFlow(input);
    return { success: true, message: result };
  } catch (error: any) {
    console.error("Error processing document:", error);
    // Clean up the file from storage if processing fails
    const bucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID;
    if (bucketId) {
        try {
            await storage.deleteFile(bucketId, input.fileId);
        } catch (cleanupError) {
            console.error("Failed to clean up file from storage:", cleanupError);
        }
    }
    return { success: false, message: error.message || "An unknown error occurred." };
  }
}

// Text Splitter Configuration
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Genkit Flow
const processDocumentFlow = ai.defineFlow(
  {
    name: 'processDocumentFlow',
    inputSchema: ProcessDocumentInputSchema,
    outputSchema: z.string(),
  },
  async ({ fileId, fileName, userId }) => {
    const bucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID;
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const collectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID;

    if (!bucketId || !databaseId || !collectionId) {
      throw new Error("Appwrite environment variables are not configured correctly. Please check your .env file.");
    }
    
    let loader;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    // Download file from storage
    const fileBuffer = await storage.getFileDownload(bucketId, fileId);
    const fileBlob = new Blob([fileBuffer]);

    // Select loader based on file type
    switch (fileExtension) {
      case 'pdf':
        loader = new PDFLoader(fileBlob);
        break;
      case 'docx':
        loader = new DocxLoader(fileBlob);
        break;
      case 'txt':
        loader = new TextLoader(fileBlob);
        break;
      default:
        throw new Error(`Unsupported file type: .${fileExtension}`);
    }

    // Load and split the document
    const docs = await loader.load();
    const chunks = await textSplitter.splitDocuments(docs);
    
    if (chunks.length === 0) {
      return "Document is empty or could not be processed. No data was saved.";
    }

    // Create embeddings for each chunk
    const embeddingModel = 'googleai/text-embedding-004';
    const embeddings = await ai.embed({
      embedder: embeddingModel,
      content: chunks.map(chunk => chunk.pageContent),
    });

    // Store chunks and embeddings in Appwrite Database
    let chunksStoredCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      await databases.createDocument(
        databaseId,
        collectionId,
        ID.unique(),
        {
          documentId: fileId,
          fileName: fileName,
          chunkText: chunk.pageContent,
          embedding: embedding,
          userId: userId,
        }
      );
      chunksStoredCount++;
    }
    
    return `Successfully processed ${fileName} and stored ${chunksStoredCount} chunks.`;
  }
);