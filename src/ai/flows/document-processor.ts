'use server';

/**
 * @fileOverview A flow for processing uploaded documents for the RAG system.
 * This flow is triggered after a file is uploaded to Appwrite Storage. It fetches the
 * file, splits it into chunks, generates embeddings for each chunk, and stores
 * them in an Appwrite Database collection for later retrieval.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { storage, databases } from '@/lib/appwrite-server';
import { ID } from 'node-appwrite';

const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;

const DocumentProcessInputSchema = z.object({
  fileId: z.string().describe('The ID of the file in Appwrite Storage.'),
  fileName: z.string().describe('The original name of the file.'),
  userId: z.string().describe('The ID of the user who uploaded the file.'),
});

// A simple chunking strategy. This could be improved with more advanced techniques
// like sentence splitting, recursive chunking, etc.
function chunkText(text: string, chunkSize = 1000, overlap = 100): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + chunkSize, text.length);
        chunks.push(text.slice(i, end));
        i += chunkSize - overlap;
        if (i >= text.length) break;
    }
    return chunks;
}

export const processDocumentFlow = ai.defineFlow(
  {
    name: 'documentProcessorFlow',
    inputSchema: DocumentProcessInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    console.log(`Starting processing for file: ${input.fileName} (${input.fileId})`);

    try {
      // 1. Download the file from Appwrite Storage
      const fileBuffer = await storage.getFileView(BUCKET_ID, input.fileId);
      const textContent = fileBuffer.toString('utf-8');

      // 2. Chunk the text content
      const chunks = chunkText(textContent);
      console.log(`Split file into ${chunks.length} chunks.`);

      if (chunks.length === 0) {
        console.log("No content to process.");
        return;
      }

      // 3. Generate embeddings for each chunk
      const embeddings = await ai.embed({
          embedder: 'googleai/text-embedding-004',
          content: chunks,
      });

      console.log(`Generated ${embeddings.length} embeddings.`);

      // 4. Store chunks and embeddings in Appwrite Database
      const promises = chunks.map((chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) return Promise.resolve(); // Should not happen

        return databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          {
            documentId: input.fileId,
            fileName: input.fileName,
            chunkText: chunk,
            embedding: embedding, // Appwrite stores this as a float array
            userId: input.userId,
          }
        );
      });

      await Promise.all(promises);

      console.log(`Successfully processed and stored all chunks for file: ${input.fileName}`);

    } catch (error) {
      console.error(`Failed to process document ${input.fileId}:`, error);
      // Optional: Add error handling logic, e.g., update file status in DB
      throw error; // Re-throw to mark the flow execution as failed
    }
  }
);

export async function processDocument(input: z.infer<typeof DocumentProcessInputSchema>) {
    // We don't await this call. This allows the API route to return a response
    // to the user immediately while the processing happens in the background.
    processDocumentFlow(input);
}
