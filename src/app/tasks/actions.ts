'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireCapability } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Task, TaskStatus, TaskType, TaskSource, Priority } from '@prisma/client';

export type TaskDto = {
  $id: string;
  type: TaskType;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  contactId?: string;
  contactName?: string;
  dueDate?: string;
  priority: Priority;
  status: TaskStatus;
  source: TaskSource;
  createdAt: string;
};

function toDto(task: Task & { assignee?: { name: string } | null; contact?: { name: string } | null }): TaskDto {
  return {
    $id: task.id,
    type: task.type,
    title: task.title,
    description: task.description ?? undefined,
    assigneeId: task.assigneeId ?? undefined,
    assigneeName: task.assignee?.name,
    contactId: task.contactId ?? undefined,
    contactName: task.contact?.name,
    dueDate: task.dueDate?.toISOString(),
    priority: task.priority,
    status: task.status,
    source: task.source,
    createdAt: task.createdAt.toISOString(),
  };
}

export async function getTasks(filters: {
  status?: TaskStatus | 'ALL';
  mineOnly?: boolean;
} = {}): Promise<TaskDto[]> {
  const ctx = await requireWorkspace();
  const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
  if (filters.status && filters.status !== 'ALL') where.status = filters.status;
  if (filters.mineOnly) where.assigneeId = ctx.user.$id;

  const tasks = await prisma.task.findMany({
    where,
    include: { assignee: { select: { name: true } }, contact: { select: { name: true } } },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    take: 200,
  });
  return tasks.map(toDto);
}

const TaskSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'CALL_BACK',
    'SEND_FOLLOW_UP',
    'REVIEW_CONVERSATION',
    'VERIFY_LEAD',
    'ESCALATION',
    'CUSTOMER_SUPPORT',
    'APPOINTMENT_CONFIRMATION',
  ]),
  title: z.string().min(2, 'Title must be at least 2 characters.').max(160),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  contactId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export async function saveTask(prevState: any, formData: FormData) {
  const ctx = await requireCapability('tasks.write');

  const validated = TaskSchema.safeParse({
    id: formData.get('id') || undefined,
    type: formData.get('type'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
    contactId: formData.get('contactId') || undefined,
    dueDate: formData.get('dueDate') || undefined,
    priority: formData.get('priority') || 'MEDIUM',
  });

  if (!validated.success) {
    return {
      status: 'error',
      message: 'Please check the form.',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { id, assigneeId, contactId, dueDate, ...data } = validated.data;

  try {
    // Validate contact belongs to the workspace when provided.
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, workspaceId: ctx.workspaceId, deletedAt: null },
      });
      if (!contact) return { status: 'error', message: 'Linked contact not found in this workspace.' };
    }

    const payload = {
      ...data,
      assigneeId: assigneeId || null,
      contactId: contactId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: ctx.user.$id,
    };

    if (id) {
      const existing = await prisma.task.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!existing) return { status: 'error', message: 'Task not found.' };
      await prisma.task.update({ where: { id }, data: payload });
    } else {
      await prisma.task.create({ data: { ...payload, workspaceId: ctx.workspaceId } });
    }

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { status: 'success', message: `Task ${id ? 'updated' : 'created'}.` };
  } catch (e: any) {
    console.error('Failed to save task:', e);
    return { status: 'error', message: 'A database error occurred. Please try again.' };
  }
}

export async function updateTaskStatus(taskId: string, status: string) {
  const ctx = await requireCapability('tasks.write');
  const valid: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'];
  if (!valid.includes(status as TaskStatus)) {
    return { error: 'Invalid status.' };
  }
  try {
    const result = await prisma.task.updateMany({
      where: { id: taskId, workspaceId: ctx.workspaceId },
      data: {
        status: status as TaskStatus,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });
    if (result.count === 0) return { error: 'Task not found.' };
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (e: any) {
    return { error: 'A database error occurred. Please try again.' };
  }
}

export async function deleteTask(taskId: string) {
  const ctx = await requireCapability('tasks.write');
  try {
    const result = await prisma.task.deleteMany({
      where: { id: taskId, workspaceId: ctx.workspaceId },
    });
    if (result.count === 0) return { error: 'Task not found.' };
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (e: any) {
    return { error: 'A database error occurred. Please try again.' };
  }
}
