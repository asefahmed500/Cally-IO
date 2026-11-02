'use server';

/**
 * Extracts text from an uploaded document, chunks it, generates embeddings
 * with Gemini (text-embedding-004), and stores everything in PostgreSQL.
 */

import { z } from 'zod';
import * as mammoth from 'mammoth';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getEmbeddings, isAIConfigured } from '@/ai/models';
import { prisma } from '@/lib/prisma';
import { getLoggedInUser } from '@/lib/auth';
import type { KnowledgeSourceType } from '@prisma/client';

const ProcessDocumentInputSchema = z.object({
  fileDataUri: z.string().describe('The document file as a data URI.'),
  fileName: z.string().describe('The name of the document file.'),
});

export type ProcessDocumentInput = z.infer<typeof ProcessDocumentInputSchema>;

function sourceTypeFromFileName(fileName: string): KnowledgeSourceType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'docx') return 'DOCX';
  return 'TXT';
}

async function extractText(fileDataUri: string, fileName: string): Promise<string> {
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  const buffer = Buffer.from(fileDataUri.split(',')[1], 'base64');

  switch (fileExtension) {
    case 'pdf': {
      const data = await pdf(buffer);
      return data.text;
    }
    case 'docx': {
      const docxResult = await mammoth.extractRawText({ buffer });
      return docxResult.value;
    }
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

export async function processDocument(input: ProcessDocumentInput): Promise<{ success: boolean }> {
  const user = await getLoggedInUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  if (!isAIConfigured()) {
    throw new Error('GOOGLE_API_KEY is not configured on the server.');
  }

  const text = await extractText(input.fileDataUri, input.fileName);
  const chunks = await textSplitter.splitText(text);

  if (chunks.length === 0) {
    throw new Error('No readable text found in the document.');
  }

  // Interim (pre-workspace onboarding): attach to the user's first workspace
  // membership when one exists; KnowledgeSource.workspaceId becomes required in Phase 1.
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.$id },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true },
  });

  const source = await prisma.knowledgeSource.create({
    data: {
      workspaceId: membership?.workspaceId ?? null,
      type: sourceTypeFromFileName(input.fileName),
      name: input.fileName,
      status: 'EMBEDDING',
    },
  });

  try {
    const embeddings = await getEmbeddings().embedDocuments(chunks);

    await prisma.knowledgeChunk.createMany({
      data: chunks.map((chunkText, i) => ({
        workspaceId: membership?.workspaceId ?? null,
        sourceId: source.id,
        chunkIndex: i,
        chunkText,
        embedding: embeddings[i],
      })),
    });

    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: 'READY', chunkCount: chunks.length },
    });
  } catch (error) {
    await prisma.knowledgeSource
      .update({ where: { id: source.id }, data: { status: 'FAILED', error: String(error) } })
      .catch(() => {});
    throw error;
  }

  return { success: true };
}
