'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, TenantError } from '@/lib/tenant';

export interface ContentSuggestion {
  prompt: string;
  count: number;
}

export interface UsageStatistic {
  fileName: string;
  count: number;
}

/**
 * Gets a list of user questions that received bad feedback, suggesting they need better answers.
 */
export async function getContentSuggestions(): Promise<ContentSuggestion[]> {
  try {
    let workspaceId: string;
    try {
      const ctx = await requireWorkspace();
      workspaceId = ctx.workspaceId;
    } catch (e) {
      if (e instanceof TenantError) return [];
      throw e;
    }

    const badMetrics = await prisma.metric.findMany({
      where: {
        workspaceId,
        feedback: 'bad',
        prompt: { not: null },
      },
      select: { prompt: true },
      take: 1000,
    });

    const suggestionCounts = new Map<string, number>();
    for (const metric of badMetrics) {
      if (metric.prompt) {
        const normalizedPrompt = metric.prompt.trim();
        suggestionCounts.set(normalizedPrompt, (suggestionCounts.get(normalizedPrompt) || 0) + 1);
      }
    }

    return Array.from(suggestionCounts.entries())
      .map(([prompt, count]) => ({ prompt, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } catch (e) {
    console.error('Failed to get content suggestions:', e);
    return [];
  }
}

/**
 * Gets a list of the most frequently used documents in AI conversations.
 */
export async function getUsageStatistics(): Promise<UsageStatistic[]> {
  try {
    let workspaceId: string;
    try {
      const ctx = await requireWorkspace();
      workspaceId = ctx.workspaceId;
    } catch (e) {
      if (e instanceof TenantError) return [];
      throw e;
    }

    const logs = await prisma.analyticsLog.findMany({
      where: { workspaceId, eventType: 'DOCUMENT_USED' },
      select: { eventData: true },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const usageCounts = new Map<string, number>();
    for (const log of logs) {
      try {
        const data = log.eventData as { sources?: Array<{ fileName: string }> };
        const sources = data?.sources;
        if (Array.isArray(sources)) {
          // Count each document only once per conversation turn
          const uniqueFileNames = new Set(sources.map((s) => s.fileName));
          uniqueFileNames.forEach((fileName) => {
            usageCounts.set(fileName, (usageCounts.get(fileName) || 0) + 1);
          });
        }
      } catch {
        // Ignore malformed event data
      }
    }

    return Array.from(usageCounts.entries())
      .map(([fileName, count]) => ({ fileName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } catch (e) {
    console.error('Failed to get usage statistics:', e);
    return [];
  }
}
