'use server';

import { prisma } from '@/lib/prisma';
import { getLoggedInUser } from '@/lib/auth';
import { requireCapability, TenantError } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export interface Faq {
  $id: string;
  question: string;
  answer: string;
  $createdAt: string;
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
    if (user.labels.includes('admin')) {
      // Platform admins may delete shared (workspace-less) knowledge.
      await prisma.knowledgeSource.delete({ where: { id: documentId } });
    } else {
      // Workspace members need knowledge.manage, and can only delete
      // documents that belong to their active workspace.
      try {
        const ctx = await requireCapability('knowledge.manage');
        const deleted = await prisma.knowledgeSource.deleteMany({
          where: { id: documentId, workspaceId: ctx.workspaceId },
        });
        if (deleted.count === 0) {
          return { error: 'Document not found in this workspace.' };
        }
      } catch (e) {
        if (e instanceof TenantError) {
          return { error: 'Unauthorized. You cannot manage knowledge in this workspace.' };
        }
        throw e;
      }
    }

    revalidatePath('/knowledge');
    return { success: true };
  } catch (e: unknown) {
    console.error('Failed to delete document:', e);
    return { error: 'Failed to delete document from the system.' };
  }
}

// FAQ ACTIONS //

export async function getFaqs(): Promise<Faq[]> {
  try {
    const user = await getLoggedInUser();
    if (!user) return [];

    const faqs = await prisma.faq.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return faqs.map((faq) => ({
      $id: faq.id,
      question: faq.question,
      answer: faq.answer,
      $createdAt: faq.createdAt.toISOString(),
    }));
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
      await prisma.faq.update({ where: { id }, data: validatedFields.data });
    } else {
      await prisma.faq.create({ data: validatedFields.data });
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
    await prisma.faq.delete({ where: { id: faqId } });
    revalidatePath('/knowledge');
    revalidatePath('/dashboard');
    return { status: 'success', message: 'FAQ deleted successfully.' };
  } catch (e: any) {
    console.error('Failed to delete FAQ:', e);
    return { status: 'error', message: 'Database operation failed.' };
  }
}
