'use server';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ReviewSchema = z.object({
  callId: z.string(),
  summary: z.string().max(2000),
  outcome: z.string().max(40),
  intent: z.string().max(120).optional(),
  sentiment: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
});

/**
 * Manager review: correct the AI-generated summary fields. Corrections are
 * attributed (reviewedBy) so AI output stays clearly distinguishable from
 * verified human input.
 */
export async function reviewCallSummary(raw: unknown) {
  const ctx = await requireCapability('calls.manage');

  const validated = ReviewSchema.safeParse(raw);
  if (!validated.success) {
    return { status: 'error' as const, message: 'Invalid review data.' };
  }
  const { callId, summary, outcome, intent, sentiment } = validated.data;

  try {
    const call = await prisma.call.findFirst({
      where: { id: callId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!call) return { status: 'error' as const, message: 'Call not found.' };

    const existing = await prisma.conversationSummary.findUnique({ where: { callId } });
    if (!existing) {
      return { status: 'error' as const, message: 'No AI summary exists for this call yet.' };
    }

    await prisma.conversationSummary.update({
      where: { callId },
      data: {
        summary,
        outcome,
        intent: intent ?? existing.intent,
        sentiment,
        reviewedById: ctx.user.$id,
        reviewedAt: new Date(),
      },
    });

    revalidatePath(`/calls/${callId}`);
    return { status: 'success' as const, message: 'Review saved.' };
  } catch (e: any) {
    return { status: 'error' as const, message: 'Could not save the review. Please try again.' };
  }
}
