import { prisma } from '@/lib/prisma';
import { getEmbeddings } from '@/ai/models';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getFaqContext(workspaceId?: string | null): Promise<string> {
  try {
    const faqs = await prisma.faq.findMany({
      where: workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : undefined,
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    if (faqs.length === 0) return '';
    return faqs
      .map((faq) => `Question: ${faq.question}\nAnswer: ${faq.answer}`)
      .join('\n\n---\n\n');
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return '';
  }
}

export async function searchKnowledge(
  query: string,
  options: { workspaceId?: string | null; sourceIds?: string[]; limit?: number; threshold?: number } = {}
): Promise<{ context: string; sources: { documentId: string; fileName: string }[] }> {
  const defaultResponse = { context: '', sources: [] };
  try {
    const queryEmbedding = await getEmbeddings().embedQuery(query);

    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        ...(options.workspaceId
          ? { OR: [{ workspaceId: options.workspaceId }, { workspaceId: null }] }
          : {}),
        ...(options.sourceIds && options.sourceIds.length > 0
          ? { sourceId: { in: options.sourceIds } }
          : {}),
      },
      take: 300,
      select: {
        id: true,
        sourceId: true,
        chunkText: true,
        embedding: true,
        source: { select: { name: true } },
      },
    });
    if (chunks.length === 0) return defaultResponse;

    const topResults = chunks
      .map((chunk) => ({
        ...chunk,
        fileName: chunk.source.name,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((c) => c.similarity > (options.threshold ?? 0.7))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit ?? 5);

    if (topResults.length === 0) return defaultResponse;

    const context = topResults
      .map((doc) => `File: ${doc.fileName}\nContent: ${doc.chunkText}`)
      .join('\n\n---\n\n');
    const sources = topResults.map((doc) => ({ documentId: doc.sourceId, fileName: doc.fileName }));
    return { context, sources };
  } catch (error) {
    console.error('Error searching knowledge:', error);
    return defaultResponse;
  }
}
